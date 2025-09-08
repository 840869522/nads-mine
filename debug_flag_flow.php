<?php
/**
 * Flag提交流程调试脚本
 */

require 'back/vendor/autoload.php';

// 加载Laravel应用程序
$app = require_once 'back/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\DB;

echo "=== Flag提交流程调试 ===\n\n";

try {
    // 1. 检查数据库中的Flag提交记录
    echo "1. 检查最近的Flag提交记录...\n";
    
    $recentSubmissions = DB::table('c_flag_submission')
        ->select(['c_submission_id', 'c_username', 'c_is_correct', 'c_points_earned', 'c_submitted_at', 'created_at', 'updated_at'])
        ->orderBy('c_submitted_at', 'desc')
        ->limit(10)
        ->get();
    
    if ($recentSubmissions->count() > 0) {
        echo "✓ 找到 " . $recentSubmissions->count() . " 条最近记录:\n";
        foreach ($recentSubmissions as $submission) {
            $status = $submission->c_is_correct ? '✅' : '❌';
            echo "  {$status} [{$submission->c_submitted_at}] {$submission->c_username} - {$submission->c_points_earned}分\n";
            echo "    ID: {$submission->c_submission_id}\n";
            echo "    创建时间: {$submission->created_at}\n";
        }
    } else {
        echo "❌ 数据库中没有找到任何Flag提交记录\n";
    }

    // 2. 检查最近5分钟内的提交
    echo "\n2. 检查最近5分钟内的提交...\n";
    $recentMinutes = DB::table('c_flag_submission')
        ->where('c_submitted_at', '>=', now()->subMinutes(5))
        ->orderBy('c_submitted_at', 'desc')
        ->get(['c_submission_id', 'c_username', 'c_is_correct', 'c_submitted_at']);
    
    if ($recentMinutes->count() > 0) {
        echo "✓ 最近5分钟内有 " . $recentMinutes->count() . " 条提交:\n";
        foreach ($recentMinutes as $submission) {
            $status = $submission->c_is_correct ? '✅' : '❌';
            echo "  {$status} [{$submission->c_submitted_at}] {$submission->c_username}\n";
        }
    } else {
        echo "❌ 最近5分钟内没有提交记录\n";
    }

    // 3. 测试历史记录API查询
    echo "\n3. 测试历史记录查询逻辑...\n";
    
    $query = DB::table('c_flag_submission')
        ->select([
            'c_submission_id',
            'c_username', 
            'c_submitted_at',
            'c_is_correct',
            'c_attempt_count',
            'c_points_earned',
            'c_container_instance_id',
            'c_vm_instance_id',
        ])
        ->orderBy('c_submitted_at', 'desc')
        ->limit(20);
    
    $historyData = $query->get();
    
    if ($historyData->count() > 0) {
        echo "✓ 历史记录查询返回 " . $historyData->count() . " 条记录\n";
        
        // 检查数据格式
        $firstRecord = $historyData->first();
        echo "第一条记录字段:\n";
        foreach ($firstRecord as $key => $value) {
            echo "  {$key}: " . (is_null($value) ? 'NULL' : $value) . "\n";
        }
        
        // 检查实例类型判断逻辑
        $dockerCount = $historyData->whereNotNull('c_container_instance_id')->count();
        $vmCount = $historyData->whereNotNull('c_vm_instance_id')->count();
        echo "Docker实例记录: {$dockerCount} 条\n";
        echo "VM实例记录: {$vmCount} 条\n";
        
    } else {
        echo "❌ 历史记录查询没有返回任何数据\n";
    }

    // 4. 检查场景和实例数据
    echo "\n4. 检查场景和实例数据完整性...\n";
    
    $sceneCount = DB::table('c_scene_instances')->count();
    echo "场景实例总数: {$sceneCount}\n";
    
    $containerCount = DB::table('c_scene_container_instances')
        ->whereNotNull('c_flag')
        ->count();
    echo "有Flag的容器实例: {$containerCount}\n";
    
    $vmCount = DB::table('c_scene_vm_instances')
        ->whereNotNull('c_flag') 
        ->count();
    echo "有Flag的VM实例: {$vmCount}\n";

    // 5. 检查最近的提交是否关联了正确的实例
    echo "\n5. 检查实例关联情况...\n";
    if ($recentSubmissions->count() > 0) {
        $latestSubmission = $recentSubmissions->first();
        
        if ($latestSubmission->c_container_instance_id) {
            // 检查容器实例
            $containerInfo = DB::table('c_scene_container_instances')
                ->where('c_container_id', $latestSubmission->c_container_instance_id)
                ->first(['c_container_name', 'c_scene_instances_id', 'c_flag']);
            
            if ($containerInfo) {
                echo "✓ 最新提交关联的容器实例存在:\n";
                echo "  容器名: {$containerInfo->c_container_name}\n";
                echo "  场景ID: {$containerInfo->c_scene_instances_id}\n";
                echo "  有Flag: " . ($containerInfo->c_flag ? 'YES' : 'NO') . "\n";
            } else {
                echo "❌ 最新提交关联的容器实例不存在\n";
            }
        } elseif ($latestSubmission->c_vm_instance_id) {
            // 检查VM实例
            $vmInfo = DB::table('c_scene_vm_instances')
                ->where('c_vm_id', $latestSubmission->c_vm_instance_id)
                ->first(['c_vm_name', 'c_scene_instances_id', 'c_flag']);
            
            if ($vmInfo) {
                echo "✓ 最新提交关联的VM实例存在:\n";
                echo "  VM名: {$vmInfo->c_vm_name}\n";
                echo "  场景ID: {$vmInfo->c_scene_instances_id}\n";
                echo "  有Flag: " . ($vmInfo->c_flag ? 'YES' : 'NO') . "\n";
            } else {
                echo "❌ 最新提交关联的VM实例不存在\n";
            }
        } else {
            echo "⚠️  最新提交没有关联任何实例\n";
        }
    }

    // 6. 检查WorkermanService连接
    echo "\n6. 测试Workerman内部通信...\n";
    $testMessage = [
        'type' => 'test_message',
        'content' => 'Debug test from PHP script',
        'timestamp' => date('Y-m-d H:i:s')
    ];
    
    $messageJson = json_encode($testMessage) . "\n";
    
    try {
        $client = stream_socket_client('tcp://127.0.0.1:2347', $errno, $errmsg, 3);
        if ($client) {
            $result = fwrite($client, $messageJson);
            fclose($client);
            echo "✓ Workerman内部通信测试成功，发送了 {$result} 字节\n";
        } else {
            echo "❌ Workerman内部通信失败: {$errmsg} ({$errno})\n";
        }
    } catch (Exception $e) {
        echo "❌ Workerman通信异常: " . $e->getMessage() . "\n";
    }

} catch (Exception $e) {
    echo "❌ 调试脚本执行失败: " . $e->getMessage() . "\n";
    echo "错误文件: " . $e->getFile() . " 行号: " . $e->getLine() . "\n";
}

echo "\n=== 调试完成 ===\n";
echo "\n🔧 建议的检查步骤:\n";
echo "1. 查看Laravel日志: tail -f back/storage/logs/laravel.log\n";
echo "2. 查看Workerman控制台输出\n";
echo "3. 查看浏览器控制台的WebSocket消息\n";
echo "4. 检查数据库记录时间是否正确\n";
