<?php

namespace App\Services;

use Exception;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Redis;

/**
 * Flag Redis消息接收器
 * 专门负责从Redis队列和频道接收Flag提交消息
 */
class FlagRedisReceiver
{
    /**
     * Redis配置
     */
    private const REDIS_CONFIG = [
        'queue_key' => 'flag_submissions_queue',
        'channel_key' => 'flag_submissions_channel',
        'latest_key_prefix' => 'latest_flag_submission',
        'processing_timeout' => 30, // 消息处理超时时间
    ];

    /**
     * 从Redis队列获取一条消息（阻塞方式）
     *
     * @param int $timeout 阻塞超时时间（秒）
     * @return array|null 返回消息数据或null
     */
    public function receiveMessage(int $timeout = 30): ?array
    {
        try {
            $redis = Redis::connection('cache');
            $queueKey = self::REDIS_CONFIG['queue_key'];
            
            // 使用BRPOP进行阻塞式获取（从队列右端取出）
            $result = $redis->brpop($queueKey, $timeout);
            
            if ($result && count($result) >= 2) {
                $messageJson = $result[1]; // BRPOP返回[key, value]
                $message = json_decode($messageJson, true);
                
                if ($message && is_array($message)) {
                    Log::info('从Redis队列接收到消息', [
                        'submission_id' => $message['submission_id'] ?? 'unknown',
                        'username' => $message['username'] ?? 'unknown',
                        'event_type' => $message['event_type'] ?? 'unknown'
                    ]);
                    
                    return $message;
                }
            }
            
            return null;
            
        } catch (Exception $e) {
            Log::error('从Redis队列接收消息失败', [
                'error' => $e->getMessage(),
                'timeout' => $timeout
            ]);
            return null;
        }
    }

    /**
     * 批量获取队列中的多条消息（非阻塞）
     *
     * @param int $count 获取消息数量
     * @return array 消息数组
     */
    public function receiveMessages(int $count = 10): array
    {
        try {
            $redis = Redis::connection('cache');
            $queueKey = self::REDIS_CONFIG['queue_key'];
            
            $messages = [];
            for ($i = 0; $i < $count; $i++) {
                $messageJson = $redis->rpop($queueKey);
                
                if ($messageJson) {
                    $message = json_decode($messageJson, true);
                    if ($message && is_array($message)) {
                        $messages[] = $message;
                    }
                } else {
                    break; // 队列为空，停止获取
                }
            }
            
            if (!empty($messages)) {
                Log::info('批量接收Redis消息', [
                    'count' => count($messages),
                    'requested_count' => $count
                ]);
            }
            
            return $messages;
            
        } catch (Exception $e) {
            Log::error('批量接收Redis消息失败', [
                'error' => $e->getMessage(),
                'count' => $count
            ]);
            return [];
        }
    }

    /**
     * 订阅Redis频道消息（用于实时处理）
     *
     * @param callable $callback 消息处理回调函数
     * @param array $channels 要订阅的频道列表
     * @return void
     */
    public function subscribeToChannel(callable $callback, array $channels = []): void
    {
        try {
            $redis = Redis::connection('cache');
            
            // 如果没有指定频道，使用默认频道
            if (empty($channels)) {
                $channels = [self::REDIS_CONFIG['channel_key']];
            }
            
            Log::info('开始订阅Redis频道', ['channels' => $channels]);
            
            // 订阅频道
            $redis->subscribe($channels, function ($message, $channel) use ($callback) {
                try {
                    $data = json_decode($message, true);
                    
                    if ($data && is_array($data)) {
                        Log::info('接收到频道消息', [
                            'channel' => $channel,
                            'submission_id' => $data['submission_id'] ?? 'unknown',
                            'event_type' => $data['event_type'] ?? 'unknown'
                        ]);
                        
                        // 调用回调函数处理消息
                        call_user_func($callback, $data, $channel);
                    }
                } catch (Exception $e) {
                    Log::error('处理频道消息失败', [
                        'error' => $e->getMessage(),
                        'channel' => $channel,
                        'message' => $message
                    ]);
                }
            });
            
        } catch (Exception $e) {
            Log::error('订阅Redis频道失败', [
                'error' => $e->getMessage(),
                'channels' => $channels ?? []
            ]);
        }
    }

    /**
     * 轮询方式接收消息（适用于定时任务）
     *
     * @param callable $processor 消息处理器函数
     * @param int $batchSize 每次处理的消息数量
     * @return int 处理的消息数量
     */
    public function pollMessages(callable $processor, int $batchSize = 50): int
    {
        try {
            $messages = $this->receiveMessages($batchSize);
            $processedCount = 0;
            
            foreach ($messages as $message) {
                try {
                    // 调用处理器函数
                    $result = call_user_func($processor, $message);
                    
                    if ($result) {
                        $processedCount++;
                        Log::debug('消息处理成功', [
                            'submission_id' => $message['submission_id'] ?? 'unknown'
                        ]);
                    } else {
                        Log::warning('消息处理失败', [
                            'submission_id' => $message['submission_id'] ?? 'unknown'
                        ]);
                    }
                    
                } catch (Exception $e) {
                    Log::error('消息处理异常', [
                        'error' => $e->getMessage(),
                        'message' => $message
                    ]);
                }
            }
            
            if ($processedCount > 0) {
                Log::info('轮询消息处理完成', [
                    'total_messages' => count($messages),
                    'processed_count' => $processedCount,
                    'batch_size' => $batchSize
                ]);
            }
            
            return $processedCount;
            
        } catch (Exception $e) {
            Log::error('轮询消息处理失败', [
                'error' => $e->getMessage(),
                'batch_size' => $batchSize
            ]);
            return 0;
        }
    }

    /**
     * 获取队列状态信息
     *
     * @return array
     */
    public function getQueueStatus(): array
    {
        try {
            $redis = Redis::connection('cache');
            $queueKey = self::REDIS_CONFIG['queue_key'];
            
            return [
                'queue_length' => $redis->llen($queueKey),
                'queue_key' => $queueKey,
                'redis_connection' => 'cache',
                'status' => 'active'
            ];
            
        } catch (Exception $e) {
            Log::error('获取队列状态失败', ['error' => $e->getMessage()]);
            return [
                'queue_length' => 0,
                'queue_key' => self::REDIS_CONFIG['queue_key'],
                'status' => 'error',
                'error' => $e->getMessage()
            ];
        }
    }

    /**
     * 获取最近的消息（不移除）
     *
     * @param int $count 获取数量
     * @return array
     */
    public function peekMessages(int $count = 10): array
    {
        try {
            $redis = Redis::connection('cache');
            $queueKey = self::REDIS_CONFIG['queue_key'];
            
            // 使用LRANGE查看消息，不移除
            $messagesJson = $redis->lrange($queueKey, -$count, -1);
            $messages = [];
            
            foreach ($messagesJson as $messageJson) {
                $message = json_decode($messageJson, true);
                if ($message && is_array($message)) {
                    $messages[] = $message;
                }
            }
            
            return array_reverse($messages); // 反转以获得最新的在前
            
        } catch (Exception $e) {
            Log::error('查看队列消息失败', [
                'error' => $e->getMessage(),
                'count' => $count
            ]);
            return [];
        }
    }

    /**
     * 清理过期的用户最新提交记录
     *
     * @return int 清理的记录数量
     */
    public function cleanupExpiredRecords(): int
    {
        try {
            $redis = Redis::connection('cache');
            $pattern = self::REDIS_CONFIG['latest_key_prefix'] . ':*';
            
            $keys = $redis->keys($pattern);
            $expiredCount = 0;
            
            foreach ($keys as $key) {
                $ttl = $redis->ttl($key);
                
                // 如果TTL为-1（永不过期）或-2（已过期/不存在），进行处理
                if ($ttl === -2) {
                    $expiredCount++;
                }
            }
            
            return $expiredCount;
            
        } catch (Exception $e) {
            Log::error('清理过期记录失败', ['error' => $e->getMessage()]);
            return 0;
        }
    }
}
