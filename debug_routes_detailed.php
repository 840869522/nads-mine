<?php
/**
 * 详细的路由加载调试脚本
 */

echo "=== 详细路由加载调试 ===\n\n";

// 切换到Laravel目录
chdir('back');

echo "1. 检查api.php文件...\n";
if (file_exists('routes/api.php')) {
    echo "✓ routes/api.php 文件存在\n";
    
    // 检查文件内容是否有语法错误
    $output = [];
    $return = 0;
    exec('php -l routes/api.php 2>&1', $output, $return);
    if ($return === 0) {
        echo "✓ api.php 语法检查通过\n";
    } else {
        echo "❌ api.php 语法错误:\n";
        foreach ($output as $line) {
            echo "  $line\n";
        }
    }
    
    // 检查FlagSubmissionController导入
    $content = file_get_contents('routes/api.php');
    if (strpos($content, 'FlagSubmissionController') !== false) {
        echo "✓ FlagSubmissionController 已在api.php中导入\n";
    } else {
        echo "❌ FlagSubmissionController 未在api.php中导入\n";
    }
    
    // 检查flag路由定义
    if (strpos($content, 'Route::prefix(\'flag\')') !== false) {
        echo "✓ flag路由前缀存在\n";
    } else {
        echo "❌ flag路由前缀不存在\n";
    }
    
    if (strpos($content, 'submit-flag') !== false) {
        echo "✓ submit-flag路由定义存在\n";
    } else {
        echo "❌ submit-flag路由定义不存在\n";
    }
    
} else {
    echo "❌ routes/api.php 文件不存在\n";
}

echo "\n2. 检查RouteServiceProvider...\n";
if (file_exists('app/Providers/RouteServiceProvider.php')) {
    echo "✓ RouteServiceProvider 存在\n";
    
    $content = file_get_contents('app/Providers/RouteServiceProvider.php');
    if (strpos($content, 'api.php') !== false) {
        echo "✓ RouteServiceProvider 包含api.php加载逻辑\n";
    } else {
        echo "❌ RouteServiceProvider 不包含api.php加载逻辑\n";
    }
} else {
    echo "❌ RouteServiceProvider 不存在\n";
}

echo "\n3. 运行composer dump-autoload...\n";
exec('composer dump-autoload 2>&1', $autoloadOutput, $autoloadReturn);
if ($autoloadReturn === 0) {
    echo "✓ Composer autoload 重新生成成功\n";
} else {
    echo "❌ Composer autoload 重新生成失败:\n";
    foreach ($autoloadOutput as $line) {
        echo "  $line\n";
    }
}

echo "\n4. 尝试手动加载路由文件...\n";
try {
    // 临时测试加载路由文件
    include_once 'vendor/autoload.php';
    $app = require_once 'bootstrap/app.php';
    
    // 检查是否可以实例化控制器
    try {
        $controller = new \App\Http\Controllers\FlagSubmission\FlagSubmissionController(
            new \App\Services\WorkermanService()
        );
        echo "✓ FlagSubmissionController 可以正常实例化\n";
    } catch (Exception $e) {
        echo "❌ FlagSubmissionController 实例化失败: " . $e->getMessage() . "\n";
    }
    
} catch (Exception $e) {
    echo "❌ Laravel应用加载失败: " . $e->getMessage() . "\n";
}

echo "\n5. 检查中间件是否可用...\n";
try {
    if (class_exists('App\Http\Middleware\JWTCheckMiddleware')) {
        echo "✓ JWTCheckMiddleware 类存在\n";
    } else {
        echo "❌ JWTCheckMiddleware 类不存在\n";
    }
} catch (Exception $e) {
    echo "❌ 检查中间件时出错: " . $e->getMessage() . "\n";
}

echo "\n6. 手动执行路由注册逻辑...\n";
try {
    // 创建一个最小的路由测试
    $testRouteFile = 'test_routes.php';
    $testContent = '<?php
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\FlagSubmission\FlagSubmissionController;

Route::prefix("flag")->group(function () {
    Route::post("/submit-flag", [FlagSubmissionController::class, "submitFlag"]);
});
';
    
    file_put_contents($testRouteFile, $testContent);
    
    // 检查测试路由文件语法
    exec("php -l $testRouteFile 2>&1", $testOutput, $testReturn);
    if ($testReturn === 0) {
        echo "✓ 测试路由文件语法正确\n";
    } else {
        echo "❌ 测试路由文件语法错误:\n";
        foreach ($testOutput as $line) {
            echo "  $line\n";
        }
    }
    
    // 清理测试文件
    unlink($testRouteFile);
    
} catch (Exception $e) {
    echo "❌ 路由测试失败: " . $e->getMessage() . "\n";
}

echo "\n7. 检查Laravel版本和配置...\n";
exec('php artisan --version 2>&1', $versionOutput);
if (!empty($versionOutput)) {
    echo "Laravel版本: " . $versionOutput[0] . "\n";
}

// 检查.env文件
if (file_exists('.env')) {
    echo "✓ .env 文件存在\n";
    $envContent = file_get_contents('.env');
    if (strpos($envContent, 'APP_ENV=') !== false) {
        preg_match('/APP_ENV=(.*)/', $envContent, $matches);
        $appEnv = isset($matches[1]) ? trim($matches[1]) : 'unknown';
        echo "APP_ENV: $appEnv\n";
    }
} else {
    echo "❌ .env 文件不存在\n";
}

echo "\n8. 最后尝试 - 清除所有缓存并重新注册路由...\n";
$commands = [
    'php artisan config:clear',
    'php artisan route:clear',
    'php artisan cache:clear',
    'php artisan view:clear',
    'composer dump-autoload',
    'php artisan route:cache'
];

foreach ($commands as $command) {
    echo "执行: $command\n";
    exec("$command 2>&1", $cmdOutput, $cmdReturn);
    if ($cmdReturn === 0) {
        echo "✓ 成功\n";
    } else {
        echo "❌ 失败: " . implode(' ', $cmdOutput) . "\n";
    }
    $cmdOutput = []; // 清空输出数组
}

echo "\n9. 最终路由检查...\n";
exec('php artisan route:list | grep -i flag 2>&1', $finalOutput, $finalReturn);
if (!empty($finalOutput)) {
    echo "✓ 找到flag相关路由:\n";
    foreach ($finalOutput as $line) {
        echo "  $line\n";
    }
} else {
    echo "❌ 仍然没有找到flag相关路由\n";
    
    // 输出前20条路由用于参考
    echo "\n前20条已注册的路由:\n";
    exec('php artisan route:list | head -20', $sampleRoutes);
    foreach ($sampleRoutes as $route) {
        echo "  $route\n";
    }
}

echo "\n=== 详细调试完成 ===\n";
