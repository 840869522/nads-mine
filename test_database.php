<?php
/**
 * 数据库查询测试脚本
 * 检查Flag提交记录和数据表状态
 */

require 'back/vendor/autoload.php';

// 加载Laravel应用程序
$app = require_once 'back/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\DB;

echo "=== Flag提交系统数据库检查 ===\n\n";

try {
    // 1. 检查连接
    echo "1. 检查数据库连接...\n";
    $connectionName = DB::getDefaultConnection();
    echo "✓ 数据库连接正常: {$connectionName}\n\n";

    // 2. 检查Flag提交表是否存在
    echo "2. 检查c_flag_submission表...\n";
    $tableExists = DB::getSchemaBuilder()->hasTable('c_flag_submission');
    if ($tableExists) {
        echo "✓ c_flag_submission表存在\n";
        
        // 获取表结构
        $columns = DB::getSchemaBuilder()->getColumnListing('c_flag_submission');
        echo "表字段: " . implode(', ', $columns) . "\n";
        
        // 获取记录总数
        $totalRecords = DB::table('c_flag_submission')->count();
        echo "总记录数: {$totalRecords}\n\n";
        
        // 获取最新的10条记录
        echo "3. 最新的Flag提交记录:\n";
        $recentSubmissions = DB::table('c_flag_submission')
            ->select(['c_submission_id', 'c_username', 'c_is_correct', 'c_points_earned', 'c_submitted_at', 'c_instance_type'])
            ->orderBy('c_submitted_at', 'desc')
            ->limit(10)
            ->get();
        
        if ($recentSubmissions->count() > 0) {
            foreach ($recentSubmissions as $submission) {
                $status = $submission->c_is_correct ? '✅ 成功' : '❌ 失败';
                $instanceType = $submission->c_instance_type ?? '未知';
                echo "- [{$submission->c_submitted_at}] {$submission->c_username} | {$status} | {$submission->c_points_earned}分 | 类型: {$instanceType}\n";
            }
        } else {
            echo "❌ 没有找到任何Flag提交记录\n";
        }
        
    } else {
        echo "❌ c_flag_submission表不存在\n";
    }

    echo "\n4. 检查场景实例表...\n";
    $sceneInstancesCount = DB::table('c_scene_instances')->count();
    echo "c_scene_instances 记录数: {$sceneInstancesCount}\n";

    echo "\n5. 检查容器实例表...\n";
    $containerInstancesCount = DB::table('c_scene_container_instances')->count();
    echo "c_scene_container_instances 记录数: {$containerInstancesCount}\n";
    
    // 检查有flag的容器
    $containersWithFlag = DB::table('c_scene_container_instances')
        ->whereNotNull('c_flag')
        ->count();
    echo "有Flag的容器数: {$containersWithFlag}\n";

    echo "\n6. 检查VM实例表...\n";
    $vmInstancesCount = DB::table('c_scene_vm_instances')->count();
    echo "c_scene_vm_instances 记录数: {$vmInstancesCount}\n";
    
    // 检查有flag的VM
    $vmsWithFlag = DB::table('c_scene_vm_instances')
        ->whereNotNull('c_flag')
        ->count();
    echo "有Flag的VM数: {$vmsWithFlag}\n";

    echo "\n7. 检查最近1小时内的提交记录...\n";
    $recentHour = DB::table('c_flag_submission')
        ->where('c_submitted_at', '>=', now()->subHour())
        ->orderBy('c_submitted_at', 'desc')
        ->get(['c_username', 'c_is_correct', 'c_submitted_at', 'c_submitted_flag']);
    
    if ($recentHour->count() > 0) {
        echo "最近1小时内的提交:\n";
        foreach ($recentHour as $submission) {
            $status = $submission->c_is_correct ? '✅' : '❌';
            $flag = substr($submission->c_submitted_flag, 0, 20) . '...';
            echo "  {$status} [{$submission->c_submitted_at}] {$submission->c_username}: {$flag}\n";
        }
    } else {
        echo "❌ 最近1小时内没有提交记录\n";
    }

} catch (Exception $e) {
    echo "❌ 数据库查询失败: " . $e->getMessage() . "\n";
    echo "错误文件: " . $e->getFile() . " 行号: " . $e->getLine() . "\n";
}

echo "\n=== 检查完成 ===\n";
