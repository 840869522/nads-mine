<?php

/**
 * NADS Flag 提交消息监听器
 * 
 * 功能：
 * 1. 监听Redis队列中的Flag提交消息
 * 2. 实时显示Flag提交结果
 * 3. 美观的消息格式化输出
 * 4. 统计信息显示
 * 
 * 使用方法：
 * php redis_message_listener.php
 * 
 * 按 Ctrl+C 退出
 */

// 设置无限执行时间
set_time_limit(0);
ignore_user_abort(true);

// 包含Laravel自动加载和初始化
require_once __DIR__ . '/back/vendor/autoload.php';

// 初始化Laravel应用
$app = require_once __DIR__ . '/back/bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

// 导入必要的类
use Illuminate\Support\Facades\Redis;
use Illuminate\Support\Facades\Log;

// 颜色输出函数
function colorOutput($text, $color = 'white') {
    $colors = [
        'black' => '0;30',
        'red' => '0;31',
        'green' => '0;32',
        'yellow' => '0;33',
        'blue' => '0;34',
        'magenta' => '0;35',
        'cyan' => '0;36',
        'white' => '0;37',
        'bright_black' => '1;30',
        'bright_red' => '1;31',
        'bright_green' => '1;32',
        'bright_yellow' => '1;33',
        'bright_blue' => '1;34',
        'bright_magenta' => '1;35',
        'bright_cyan' => '1;36',
        'bright_white' => '1;37'
    ];
    
    if (isset($colors[$color])) {
        return "\033[{$colors[$color]}m{$text}\033[0m";
    }
    return $text;
}

// 信号处理函数
function signalHandler($signal) {
    global $running, $messageCount, $startTime, $redis;
    
    echo "\n" . colorOutput("收到中断信号，正在优雅退出...", 'yellow') . "\n";
    $running = false;
    
    // 显示统计信息
    $endTime = time();
    $duration = $endTime - $startTime;
    
    echo "\n" . colorOutput("📊 监听结束统计:", 'bright_cyan') . "\n";
    echo colorOutput("───────────────────────────────────────────", 'cyan') . "\n";
    echo colorOutput("总接收消息数: {$messageCount}", 'white') . "\n";
    echo colorOutput("运行时长: {$duration} 秒", 'white') . "\n";
    
    try {
        if ($redis) {
            $queueLength = $redis->llen('flag_submissions_queue');
            $userRecords = count($redis->keys('latest_flag_submission:*'));
            echo colorOutput("最终队列长度: {$queueLength}", 'white') . "\n";
            echo colorOutput("最终用户记录: {$userRecords}", 'white') . "\n";
        }
    } catch (Exception $e) {
        // 忽略关闭时的Redis错误
    }
    
    echo "\n" . colorOutput("👋 监听器已退出", 'bright_green') . "\n\n";
    exit(0);
}

// 注册信号处理器
pcntl_signal(SIGTERM, 'signalHandler');
pcntl_signal(SIGINT, 'signalHandler');

// 全局变量
$running = true;
$messageCount = 0;
$startTime = time();
$redis = null;

// 主程序开始
echo colorOutput("🔊 NADS Flag消息监听器", 'bright_cyan') . "\n";
echo colorOutput("═══════════════════════════════════════════", 'cyan') . "\n";
echo colorOutput("按 Ctrl+C 退出监听", 'yellow') . "\n\n";

try {
    // 初始化Laravel环境
    echo colorOutput("✅ Laravel环境初始化成功", 'green') . "\n";
    
    // 连接到Redis
    $redis = Redis::connection('cache');
    echo colorOutput("✅ Redis连接建立成功", 'green') . "\n";
    
    // 显示当前状态
    $queueLength = $redis->llen('flag_submissions_queue');
    $userRecords = count($redis->keys('latest_flag_submission:*'));
    
    echo "\n" . colorOutput("📊 当前状态:", 'bright_yellow') . "\n";
    echo colorOutput("   队列中消息数: {$queueLength}", 'white') . "\n";
    echo colorOutput("   用户提交记录: {$userRecords}", 'white') . "\n";
    echo colorOutput("   监听频道: flag_submissions_channel", 'white') . "\n";
    
    echo "\n" . colorOutput("⏳ 等待Flag消息...", 'bright_white') . "\n";
    echo colorOutput("───────────────────────────────────────────", 'cyan') . "\n";
    
    // 主监听循环
    while ($running) {
        // 处理信号
        pcntl_signal_dispatch();
        
        try {
            // 从Redis队列中获取消息 (阻塞式，超时5秒)
            $result = $redis->brpop('flag_submissions_queue', 5);
            
            if ($result && count($result) >= 2) {
                $messageJson = $result[1];
                $messageData = json_decode($messageJson, true);
                
                if ($messageData && is_array($messageData)) {
                    $messageCount++;
                    
                    // 解析消息数据
                    $timestamp = $messageData['timestamp'] ?? date('H:i:s');
                    $username = $messageData['username'] ?? 'unknown';
                    $success = $messageData['success'] ?? false;
                    $points = $messageData['points_earned'] ?? 0;
                    $instanceType = $messageData['instance_type'] ?? 'unknown';
                    $instanceName = $messageData['instance_name'] ?? 'Unknown Instance';
                    $sceneId = $messageData['scene_instance_id'] ?? 'unknown';
                    $attemptCount = $messageData['attempt_count'] ?? 0;
                    $message = $messageData['message'] ?? '';
                    
                    // 格式化显示时间（只显示时分秒）
                    $displayTime = date('H:i:s', strtotime($timestamp));
                    
                    // 根据成功/失败选择不同的显示样式
                    if ($success) {
                        $statusIcon = colorOutput("🟢 成功", 'bright_green');
                        $pointsText = colorOutput("+{$points}分", 'bright_green');
                    } else {
                        $statusIcon = colorOutput("🔴 失败", 'bright_red');
                        $pointsText = colorOutput("{$points}分", 'red');
                    }
                    
                    // 显示消息
                    echo colorOutput("[{$displayTime}]", 'bright_blue') . " ";
                    echo "{$statusIcon} | ";
                    echo colorOutput($username, 'bright_white') . " | ";
                    echo colorOutput("{$instanceType}:{$instanceName}", 'cyan') . " | ";
                    echo "{$pointsText}\n";
                    echo colorOutput("           场景: {$sceneId} | 尝试: {$attemptCount} | {$message}", 'white') . "\n";
                    echo colorOutput("───────────────────────────────────────────", 'cyan') . "\n";
                    
                    // 记录到日志（可选）
                    Log::info("Flag消息监听器接收到消息", [
                        'username' => $username,
                        'success' => $success,
                        'points' => $points,
                        'instance' => "{$instanceType}:{$instanceName}",
                        'message_count' => $messageCount
                    ]);
                    
                } else {
                    echo colorOutput("⚠️ 接收到无效的消息格式", 'yellow') . "\n";
                }
            }
            
        } catch (Exception $e) {
            if ($running) {
                echo colorOutput("❌ 监听过程中出现错误: " . $e->getMessage(), 'red') . "\n";
                echo colorOutput("⏳ 5秒后重试连接...", 'yellow') . "\n";
                sleep(5);
            }
        }
    }
    
} catch (Exception $e) {
    echo colorOutput("❌ 初始化失败: " . $e->getMessage(), 'red') . "\n";
    echo colorOutput("请检查Redis连接和Laravel配置", 'yellow') . "\n";
    exit(1);
}

echo colorOutput("监听器正常结束", 'green') . "\n";
