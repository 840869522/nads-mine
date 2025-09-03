<?php

namespace App\Services;

use Exception;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Redis;

/**
 * Flag Redis消息发送器
 * 专门负责将Flag提交信息发送到Redis队列和频道
 */
class FlagRedisSender
{
    /**
     * Redis队列和频道配置
     */
    private const REDIS_CONFIG = [
        'queue_key' => 'flag_submissions_queue',
        'channel_key' => 'flag_submissions_channel',
        'latest_key_prefix' => 'latest_flag_submission',
        'ttl' => 3600, // 1小时
    ];

    /**
     * 发送Flag提交消息到Redis
     *
     * @param array $flagData Flag提交数据
     * @return bool 发送是否成功
     */
    public function sendFlagMessage(array $flagData): bool
    {
        try {
            // 准备消息数据
            $message = $this->prepareMessage($flagData);
            
            // 获取Redis连接
            $redis = Redis::connection('cache');
            
            // 1. 发送到Redis队列（用于异步处理）
            $queueSuccess = $this->sendToQueue($redis, $message);
            
            // 2. 发送到Redis频道（用于实时通知）
            $channelSuccess = $this->sendToChannel($redis, $message);
            
            // 3. 保存最新提交记录（用于快速查询）
            $latestSuccess = $this->saveLatestSubmission($redis, $message);
            
            $overallSuccess = $queueSuccess && $channelSuccess && $latestSuccess;
            
            Log::info('Flag Redis消息发送完成', [
                'submission_id' => $message['submission_id'],
                'username' => $message['username'],
                'queue_success' => $queueSuccess,
                'channel_success' => $channelSuccess,
                'latest_success' => $latestSuccess,
                'overall_success' => $overallSuccess
            ]);
            
            return $overallSuccess;
            
        } catch (Exception $e) {
            Log::error('Flag Redis消息发送失败', [
                'error' => $e->getMessage(),
                'flag_data' => $flagData
            ]);
            return false;
        }
    }

    /**
     * 准备消息数据
     *
     * @param array $flagData
     * @return array
     */
    private function prepareMessage(array $flagData): array
    {
        return [
            // 消息基础信息
            'event_type' => 'flag_submission',
            'timestamp' => now()->toISOString(),
            'message_id' => uniqid('flag_msg_'),
            
            // 提交基础信息
            'submission_id' => $flagData['submission_id'],
            'username' => $flagData['username'],
            'user_id' => $flagData['user_id'] ?? $flagData['username'],
            
            // 场景和实例信息
            'scene_instance_id' => $flagData['scene_instance_id'],
            'instance_id' => $flagData['instance_id'],
            'instance_type' => $flagData['instance_type'],
            'instance_name' => $flagData['instance_name'] ?? null,
            
            // 提交结果
            'is_correct' => $flagData['is_correct'],
            'points_earned' => $flagData['points_earned'],
            'attempt_count' => $flagData['attempt_count'],
            'submitted_at' => $flagData['submitted_at'],
            
            // 扩展信息
            'metadata' => [
                'scene_type' => $flagData['scene_type'] ?? null,
                'team_id' => $flagData['team_id'] ?? null,
                'session_id' => $flagData['session_id'] ?? null,
            ]
        ];
    }

    /**
     * 发送消息到Redis队列
     *
     * @param \Illuminate\Redis\Connections\Connection $redis
     * @param array $message
     * @return bool
     */
    private function sendToQueue($redis, array $message): bool
    {
        try {
            $queueKey = self::REDIS_CONFIG['queue_key'];
            $redis->lpush($queueKey, json_encode($message));
            return true;
        } catch (Exception $e) {
            Log::error('发送到Redis队列失败', [
                'error' => $e->getMessage(),
                'queue_key' => $queueKey ?? 'unknown'
            ]);
            return false;
        }
    }

    /**
     * 发送消息到Redis频道
     *
     * @param \Illuminate\Redis\Connections\Connection $redis
     * @param array $message
     * @return bool
     */
    private function sendToChannel($redis, array $message): bool
    {
        try {
            $channelKey = self::REDIS_CONFIG['channel_key'];
            $redis->publish($channelKey, json_encode($message));
            return true;
        } catch (Exception $e) {
            Log::error('发送到Redis频道失败', [
                'error' => $e->getMessage(),
                'channel_key' => $channelKey ?? 'unknown'
            ]);
            return false;
        }
    }

    /**
     * 保存用户最新提交记录
     *
     * @param \Illuminate\Redis\Connections\Connection $redis
     * @param array $message
     * @return bool
     */
    private function saveLatestSubmission($redis, array $message): bool
    {
        try {
            $latestKey = self::REDIS_CONFIG['latest_key_prefix'] . ':' . $message['user_id'];
            $ttl = self::REDIS_CONFIG['ttl'];
            $redis->setex($latestKey, $ttl, json_encode($message));
            return true;
        } catch (Exception $e) {
            Log::error('保存最新提交记录失败', [
                'error' => $e->getMessage(),
                'user_id' => $message['user_id'] ?? 'unknown'
            ]);
            return false;
        }
    }

    /**
     * 获取队列中的消息数量
     *
     * @return int
     */
    public function getQueueLength(): int
    {
        try {
            $redis = Redis::connection('cache');
            return $redis->llen(self::REDIS_CONFIG['queue_key']);
        } catch (Exception $e) {
            Log::error('获取队列长度失败', ['error' => $e->getMessage()]);
            return 0;
        }
    }

    /**
     * 获取用户最新提交
     *
     * @param string $userId
     * @return array|null
     */
    public function getUserLatestSubmission(string $userId): ?array
    {
        try {
            $redis = Redis::connection('cache');
            $latestKey = self::REDIS_CONFIG['latest_key_prefix'] . ':' . $userId;
            $data = $redis->get($latestKey);
            
            return $data ? json_decode($data, true) : null;
        } catch (Exception $e) {
            Log::error('获取用户最新提交失败', [
                'error' => $e->getMessage(),
                'user_id' => $userId
            ]);
            return null;
        }
    }
}
