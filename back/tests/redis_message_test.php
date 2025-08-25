<?php

/**
 * Redis 消息测试脚本
 * 用于测试 Flag 提交后的 Redis 消息功能
 * 
 * 运行方式：php tests/redis_message_test.php
 */

require_once __DIR__ . '/../vendor/autoload.php';

use Illuminate\Support\Facades\Cache;

// 模拟 Laravel 环境（简化版）
$app = new Illuminate\Foundation\Application(__DIR__ . '/..');
$app->singleton(Illuminate\Contracts\Http\Kernel::class, Illuminate\Foundation\Http\Kernel::class);
$app->singleton(Illuminate\Contracts\Console\Kernel::class, Illuminate\Foundation\Console\Kernel::class);
$app->singleton(Illuminate\Contracts\Debug\ExceptionHandler::class, Illuminate\Foundation\Exceptions\Handler::class);

// 启动应用
$kernel = $app->make(Illuminate\Contracts\Http\Kernel::class);
$kernel->bootstrap();

echo "Redis Flag 提交消息测试\n";
echo "=========================\n\n";

// 测试读取 Redis 消息队列
function testRedisMessages() {
    try {
        $redis = Cache::store('redis');
        
        echo "1. 测试读取 Flag 提交消息队列...\n";
        
        // 读取队列中的消息
        $listKey = 'flag_submissions_queue';
        $messages = $redis->getRedis()->lrange($listKey, 0, -1);
        
        echo "队列中共有 " . count($messages) . " 条消息\n\n";
        
        if (!empty($messages)) {
            echo "最近的 5 条消息:\n";
            echo "-----------------\n";
            
            $recentMessages = array_slice(array_reverse($messages), 0, 5);
            foreach ($recentMessages as $index => $message) {
                $data = json_decode($message, true);
                if ($data) {
                    echo ($index + 1) . ". 用户: " . $data['username'] . 
                         " | 事件: " . $data['event'] . 
                         " | 成功: " . ($data['success'] ? '是' : '否') . 
                         " | 时间: " . $data['timestamp'] . "\n";
                    
                    if (isset($data['instance_name'])) {
                        echo "   实例: " . $data['instance_name'] . 
                             " (" . $data['instance_type'] . ")" .
                             " | 得分: " . $data['points_earned'] . "\n";
                    }
                    
                    if (isset($data['message'])) {
                        echo "   消息: " . $data['message'] . "\n";
                    }
                    echo "\n";
                }
            }
        }
        
        echo "2. 测试监听 Redis 频道消息...\n";
        echo "频道名称: flag_submissions_channel\n";
        echo "使用以下 Redis 命令可以监听实时消息:\n";
        echo "redis-cli SUBSCRIBE flag_submissions_channel\n\n";
        
        echo "3. 测试最新提交记录查询...\n";
        
        // 查找所有用户的最新提交
        $pattern = 'latest_flag_submission:*';
        $keys = $redis->getRedis()->keys($pattern);
        
        if (!empty($keys)) {
            echo "找到 " . count($keys) . " 个用户的最新提交记录:\n";
            foreach ($keys as $key) {
                $data = $redis->get(str_replace($redis->getPrefix(), '', $key));
                if ($data) {
                    $submission = json_decode($data, true);
                    $userId = str_replace('latest_flag_submission:', '', str_replace($redis->getPrefix(), '', $key));
                    echo "用户 $userId: " . 
                         ($submission['success'] ? '成功' : '失败') . 
                         " | " . $submission['timestamp'] . "\n";
                }
            }
        } else {
            echo "暂无用户提交记录\n";
        }
        
    } catch (Exception $e) {
        echo "错误: " . $e->getMessage() . "\n";
    }
}

// 测试添加模拟消息
function addTestMessage() {
    try {
        $redis = Cache::store('redis');
        
        echo "\n4. 添加测试消息...\n";
        
        $testMessage = [
            'event' => 'flag_submission',
            'user_id' => 'test_user_001',
            'username' => 'test_user_001',
            'timestamp' => date('Y-m-d H:i:s'),
            'success' => true,
            'points_earned' => 85,
            'instance_type' => 'docker',
            'instance_id' => 'test_container_123',
            'instance_name' => 'Web Challenge Container',
            'scene_instance_id' => 'scene_001',
            'attempt_count' => 1,
            'submission_id' => 'test-uuid-12345',
            'message' => 'Flag提交成功！获得 85 分。'
        ];
        
        // 添加到队列
        $listKey = 'flag_submissions_queue';
        $redis->getRedis()->lpush($listKey, json_encode($testMessage));
        
        // 设置最新提交记录
        $latestKey = 'latest_flag_submission:' . $testMessage['user_id'];
        $redis->put($latestKey, json_encode($testMessage), 3600);
        
        // 发布到频道
        $channelName = 'flag_submissions_channel';
        $redis->getRedis()->publish($channelName, json_encode($testMessage));
        
        echo "测试消息添加成功！\n";
        
    } catch (Exception $e) {
        echo "添加测试消息失败: " . $e->getMessage() . "\n";
    }
}

// 清理测试数据
function cleanupTestData() {
    try {
        $redis = Cache::store('redis');
        
        echo "\n5. 清理选项 (输入 'y' 确认删除所有测试数据): ";
        $handle = fopen("php://stdin", "r");
        $line = trim(fgets($handle));
        fclose($handle);
        
        if (strtolower($line) === 'y') {
            // 清空队列
            $redis->getRedis()->del('flag_submissions_queue');
            
            // 删除所有最新提交记录
            $pattern = 'latest_flag_submission:*';
            $keys = $redis->getRedis()->keys($pattern);
            if (!empty($keys)) {
                $redis->getRedis()->del($keys);
            }
            
            echo "测试数据已清理完成！\n";
        } else {
            echo "跳过数据清理。\n";
        }
        
    } catch (Exception $e) {
        echo "清理数据失败: " . $e->getMessage() . "\n";
    }
}

// 执行测试
try {
    testRedisMessages();
    addTestMessage();
    testRedisMessages(); // 再次查看添加测试消息后的状态
    cleanupTestData();
    
    echo "\n测试完成！\n";
    echo "\n使用说明:\n";
    echo "1. Flag 提交消息会存储在 Redis 队列 'flag_submissions_queue' 中\n";
    echo "2. 每个用户的最新提交会存储在 'latest_flag_submission:{user_id}' 键中\n";
    echo "3. 实时消息会发布到 'flag_submissions_channel' 频道\n";
    echo "4. 可以使用 redis-cli 命令监听实时消息\n";
    
} catch (Exception $e) {
    echo "测试执行失败: " . $e->getMessage() . "\n";
}
