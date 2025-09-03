<?php

/**
 * Redis Flag 消息接收处理器示例
 * 
 * 这是一个独立的处理脚本，展示如何接收和处理Redis中的Flag消息
 * 你可以复制这个代码到你的处理页面中进行配置
 */

require_once __DIR__ . '/vendor/autoload.php';

// 启动Laravel应用环境
$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Services\FlagRedisReceiver;
use Illuminate\Support\Facades\Log;

echo "🚀 Flag消息接收器启动\n";
echo "====================\n\n";

// 创建接收器实例
$receiver = new FlagRedisReceiver();

// 示例1: 处理单个消息（阻塞模式）
function processMessage($message) {
    try {
        // 消息处理逻辑 - 你可以在这里写你的业务代码
        echo "📨 接收到消息:\n";
        echo "   提交ID: " . ($message['submission_id'] ?? 'N/A') . "\n";
        echo "   用户: " . ($message['username'] ?? 'N/A') . "\n";
        echo "   是否正确: " . ($message['is_correct'] ? '✅ 是' : '❌ 否') . "\n";
        echo "   得分: " . ($message['points_earned'] ?? 0) . "\n";
        echo "   实例: " . ($message['instance_name'] ?? 'N/A') . 
             " (" . ($message['instance_type'] ?? 'N/A') . ")\n";
        echo "   时间: " . ($message['submitted_at'] ?? 'N/A') . "\n";
        echo "   -------------------------\n";
        
        // 这里可以添加你的具体业务处理逻辑，比如:
        // - 更新用户积分
        // - 发送通知
        // - 记录统计数据
        // - 触发其他系统的API
        
        // 示例业务处理
        if ($message['is_correct']) {
            // 正确提交的处理逻辑
            handleCorrectSubmission($message);
        } else {
            // 错误提交的处理逻辑
            handleIncorrectSubmission($message);
        }
        
        return true;
        
    } catch (Exception $e) {
        echo "❌ 消息处理失败: " . $e->getMessage() . "\n";
        Log::error('Flag消息处理失败', [
            'error' => $e->getMessage(),
            'message' => $message
        ]);
        return false;
    }
}

// 正确提交处理逻辑
function handleCorrectSubmission($message) {
    echo "🎉 处理正确提交\n";
    
    // 示例：可以在这里实现
    // - 更新排行榜
    // - 发送奖励
    // - 通知其他用户
    // - 更新统计数据等
    
    Log::info('正确Flag提交处理', [
        'username' => $message['username'],
        'points' => $message['points_earned']
    ]);
}

// 错误提交处理逻辑
function handleIncorrectSubmission($message) {
    echo "📝 记录错误尝试\n";
    
    // 示例：可以在这里实现
    // - 记录尝试次数
    // - 防刷保护
    // - 统计分析等
    
    Log::info('错误Flag提交记录', [
        'username' => $message['username'],
        'attempt_count' => $message['attempt_count']
    ]);
}

// 使用方式1: 循环处理消息（推荐用于独立进程）
echo "📥 模式1: 循环接收消息（按 Ctrl+C 停止）\n";
echo "等待消息中...\n\n";

$processedCount = 0;
while (true) {
    try {
        // 阻塞等待消息（30秒超时）
        $message = $receiver->receiveMessage(30);
        
        if ($message) {
            if (processMessage($message)) {
                $processedCount++;
                echo "✅ 已处理消息总数: {$processedCount}\n\n";
            }
        } else {
            echo "⏱️ 30秒内无新消息，继续等待...\n";
        }
        
    } catch (Exception $e) {
        echo "❌ 接收消息时发生错误: " . $e->getMessage() . "\n";
        Log::error('消息接收错误', ['error' => $e->getMessage()]);
        
        // 等待几秒后重试
        sleep(5);
    }
}

// 注意：以下代码不会执行，因为上面是无限循环
// 但这些是其他使用方式的示例

// 使用方式2: 批量处理消息（适用于定时任务）
/*
echo "\n📦 模式2: 批量处理消息\n";
$processor = function($message) {
    return processMessage($message);
};

$processedCount = $receiver->pollMessages($processor, 10);
echo "批量处理完成，处理了 {$processedCount} 条消息\n";
*/

// 使用方式3: 订阅频道实时消息（适用于实时通知）
/*
echo "\n📡 模式3: 订阅频道消息\n";
$channelHandler = function($message, $channel) {
    echo "从频道 {$channel} 接收到实时消息:\n";
    processMessage($message);
};

$receiver->subscribeToChannel($channelHandler);
*/

// 使用方式4: 查看队列状态（适用于监控）
/*
echo "\n📊 队列状态信息:\n";
$status = $receiver->getQueueStatus();
print_r($status);

echo "\n👀 查看最近10条消息（不移除）:\n";
$recentMessages = $receiver->peekMessages(10);
foreach ($recentMessages as $i => $message) {
    echo ($i + 1) . ". " . ($message['username'] ?? 'Unknown') . 
         " - " . ($message['submitted_at'] ?? 'N/A') . "\n";
}
*/
