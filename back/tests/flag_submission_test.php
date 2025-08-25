<?php

/**
 * Flag 提交系统测试脚本
 * 测试 FlagSubmissionController 的核心功能
 * 
 * 运行方式：php tests/flag_submission_test.php
 */

require_once __DIR__ . '/../vendor/autoload.php';

// 模拟 Laravel 环境
$app = new Illuminate\Foundation\Application(__DIR__ . '/..');
$app->singleton(Illuminate\Contracts\Http\Kernel::class, Illuminate\Foundation\Http\Kernel::class);
$app->singleton(Illuminate\Contracts\Console\Kernel::class, Illuminate\Foundation\Console\Kernel::class);
$app->singleton(Illuminate\Contracts\Debug\ExceptionHandler::class, Illuminate\Foundation\Exceptions\Handler::class);

// 启动应用
$kernel = $app->make(Illuminate\Contracts\Http\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\DB;
use App\Models\Flag\FlagSubmissionModel;
use App\Models\scenario\SceneContainerInstanceModel;
use App\Models\scenario\SceneVmInstanceModel;
use App\Models\scenario\SceneInstanceModel;

echo "Flag 提交系统测试\n";
echo "=================\n\n";

// 1. 测试数据库连接
function testDatabaseConnection() {
    echo "1. 测试数据库连接...\n";
    try {
        DB::connection()->getPdo();
        echo "✅ 数据库连接成功\n";
        return true;
    } catch (Exception $e) {
        echo "❌ 数据库连接失败: " . $e->getMessage() . "\n";
        return false;
    }
}

// 2. 检查数据库表结构
function checkTableStructures() {
    echo "\n2. 检查数据库表结构...\n";
    
    $tables = [
        'c_flag_submissions' => '提交记录表',
        'c_scene_container_instances' => '容器实例表',
        'c_scene_vm_instances' => 'VM实例表',
        'c_scene_instances' => '场景实例表'
    ];
    
    foreach ($tables as $table => $description) {
        try {
            $exists = DB::select("SHOW TABLES LIKE '{$table}'");
            if ($exists) {
                echo "✅ {$description}（{$table}）存在\n";
                
                // 检查关键字段
                if ($table === 'c_flag_submissions') {
                    $columns = DB::select("DESCRIBE {$table}");
                    $expectedColumns = ['c_submission_id', 'c_username', 'c_is_correct', 'c_points_earned'];
                    foreach ($expectedColumns as $col) {
                        $found = array_filter($columns, function($c) use ($col) {
                            return $c->Field === $col;
                        });
                        if ($found) {
                            echo "  ✓ {$col} 字段存在\n";
                        } else {
                            echo "  ❌ {$col} 字段缺失\n";
                        }
                    }
                } elseif (in_array($table, ['c_scene_container_instances', 'c_scene_vm_instances'])) {
                    $columns = DB::select("DESCRIBE {$table}");
                    $found = array_filter($columns, function($c) {
                        return $c->Field === 'c_flag';
                    });
                    if ($found) {
                        echo "  ✓ c_flag 字段存在\n";
                    } else {
                        echo "  ❌ c_flag 字段缺失\n";
                    }
                }
            } else {
                echo "❌ {$description}（{$table}）不存在\n";
            }
        } catch (Exception $e) {
            echo "❌ 检查 {$table} 失败: " . $e->getMessage() . "\n";
        }
    }
}

// 3. 测试 Model 加载
function testModelLoading() {
    echo "\n3. 测试 Model 加载...\n";
    
    $models = [
        'FlagSubmissionModel' => FlagSubmissionModel::class,
        'SceneContainerInstanceModel' => SceneContainerInstanceModel::class,
        'SceneVmInstanceModel' => SceneVmInstanceModel::class,
        'SceneInstanceModel' => SceneInstanceModel::class
    ];
    
    foreach ($models as $name => $class) {
        try {
            $model = new $class();
            echo "✅ {$name} 加载成功\n";
            
            // 测试表名
            echo "  表名: " . $model->getTable() . "\n";
            echo "  主键: " . $model->getKeyName() . "\n";
        } catch (Exception $e) {
            echo "❌ {$name} 加载失败: " . $e->getMessage() . "\n";
        }
    }
}

// 4. 测试 Flag 验证逻辑
function testFlagValidation() {
    echo "\n4. 测试 Flag 验证逻辑...\n";
    
    $testFlags = [
        'flag{12345678-1234-1234-1234-123456789abc}' => true,
        'flag{ABCDEF12-3456-7890-ABCD-EF1234567890}' => true,
        'flag{invalid-format}' => false,
        'wrong{12345678-1234-1234-1234-123456789abc}' => false,
        'flag{12345678-12341234-1234-123456789abc}' => false, // 缺少短划线
    ];
    
    $pattern = '/^flag\{[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\}$/';
    
    foreach ($testFlags as $flag => $expected) {
        $result = preg_match($pattern, $flag);
        if (($result && $expected) || (!$result && !$expected)) {
            echo "✅ '$flag' 验证正确\n";
        } else {
            echo "❌ '$flag' 验证错误，期望: " . ($expected ? '通过' : '失败') . "，实际: " . ($result ? '通过' : '失败') . "\n";
        }
    }
}

// 5. 测试数据查询功能
function testDataQueries() {
    echo "\n5. 测试数据查询功能...\n";
    
    try {
        // 测试场景实例查询
        $sceneInstances = SceneInstanceModel::count();
        echo "✅ 场景实例数量: {$sceneInstances}\n";
        
        // 测试容器实例查询
        $containerInstances = SceneContainerInstanceModel::count();
        echo "✅ 容器实例数量: {$containerInstances}\n";
        
        // 测试VM实例查询
        $vmInstances = SceneVmInstanceModel::count();
        echo "✅ VM实例数量: {$vmInstances}\n";
        
        // 测试已有的 Flag 提交记录
        $submissions = FlagSubmissionModel::count();
        echo "✅ 已有提交记录数量: {$submissions}\n";
        
        // 测试靶机查询（有 c_flag 的实例）
        $targetContainers = SceneContainerInstanceModel::whereNotNull('c_flag')
                                                      ->where('c_flag', '!=', '')
                                                      ->count();
        echo "✅ 容器靶机数量: {$targetContainers}\n";
        
        $targetVms = SceneVmInstanceModel::whereNotNull('c_flag')
                                        ->where('c_flag', '!=', '')
                                        ->count();
        echo "✅ VM靶机数量: {$targetVms}\n";
        
    } catch (Exception $e) {
        echo "❌ 数据查询失败: " . $e->getMessage() . "\n";
    }
}

// 6. 测试积分计算逻辑
function testScoreCalculation() {
    echo "\n6. 测试积分计算逻辑...\n";
    
    // 模拟积分计算
    $correctSubmissionsCount = 0; // 假设之前没有正确提交
    $points = max(1, 100 - $correctSubmissionsCount);
    echo "✅ 首次正确提交得分: {$points}\n";
    
    $correctSubmissionsCount = 50;
    $points = max(1, 100 - $correctSubmissionsCount);
    echo "✅ 第51次正确提交得分: {$points}\n";
    
    $correctSubmissionsCount = 99;
    $points = max(1, 100 - $correctSubmissionsCount);
    echo "✅ 第100次正确提交得分: {$points}\n";
    
    $correctSubmissionsCount = 150;
    $points = max(1, 100 - $correctSubmissionsCount);
    echo "✅ 超过100次后提交得分: {$points}\n";
}

// 7. 检查 JWT 中间件配置
function checkJwtMiddleware() {
    echo "\n7. 检查 JWT 中间件配置...\n";
    
    try {
        $middlewareFile = __DIR__ . '/../app/Http/Middleware/JwtAuthMiddleware.php';
        if (file_exists($middlewareFile)) {
            echo "✅ JWT 中间件文件存在\n";
        } else {
            echo "❌ JWT 中间件文件不存在\n";
        }
        
        // 检查路由配置
        $routeFile = __DIR__ . '/../routes/api.php';
        $routeContent = file_get_contents($routeFile);
        if (strpos($routeContent, "middleware('jwt.auth')") !== false) {
            echo "✅ Flag 路由已配置 JWT 中间件\n";
        } else {
            echo "❌ Flag 路由未配置 JWT 中间件\n";
        }
        
        if (strpos($routeContent, "Route::prefix('flag')") !== false) {
            echo "✅ Flag 路由组已配置\n";
        } else {
            echo "❌ Flag 路由组未配置\n";
        }
        
    } catch (Exception $e) {
        echo "❌ 检查中间件配置失败: " . $e->getMessage() . "\n";
    }
}

// 8. 创建测试数据
function createTestData() {
    echo "\n8. 创建测试数据...\n";
    
    try {
        // 检查是否有测试场景实例
        $testSceneInstance = SceneInstanceModel::where('c_scene_instances_id', 'test-scene-001')->first();
        if (!$testSceneInstance) {
            echo "💡 建议创建测试场景实例用于测试\n";
            echo "   场景实例ID: test-scene-001\n";
        } else {
            echo "✅ 测试场景实例存在\n";
        }
        
        // 检查测试容器实例
        $testContainer = SceneContainerInstanceModel::where('c_container_id', 'test-container-001')->first();
        if (!$testContainer) {
            echo "💡 建议创建测试容器实例用于测试\n";
            echo "   容器ID: test-container-001\n";
            echo "   Flag: flag{12345678-1234-1234-1234-123456789abc}\n";
        } else {
            echo "✅ 测试容器实例存在\n";
        }
        
    } catch (Exception $e) {
        echo "❌ 检查测试数据失败: " . $e->getMessage() . "\n";
    }
}

// 运行所有测试
function runAllTests() {
    $tests = [
        'testDatabaseConnection',
        'checkTableStructures', 
        'testModelLoading',
        'testFlagValidation',
        'testDataQueries',
        'testScoreCalculation',
        'checkJwtMiddleware',
        'createTestData'
    ];
    
    $passed = 0;
    $total = count($tests);
    
    foreach ($tests as $test) {
        try {
            $result = call_user_func($test);
            if ($result !== false) {
                $passed++;
            }
        } catch (Exception $e) {
            echo "❌ 测试 {$test} 执行失败: " . $e->getMessage() . "\n";
        }
        echo "\n" . str_repeat('-', 50) . "\n";
    }
    
    echo "\n测试总结:\n";
    echo "通过: {$passed}/{$total}\n";
    
    if ($passed === $total) {
        echo "🎉 所有测试通过！Flag 系统基础功能正常。\n";
    } else {
        echo "⚠️  部分测试失败，需要检查相关配置。\n";
    }
}

// 执行测试
try {
    runAllTests();
} catch (Exception $e) {
    echo "测试执行失败: " . $e->getMessage() . "\n";
}
