<?php
/**
 * Laravel 路由调试和清理脚本
 * 用于检查和清理路由缓存问题
 */

echo "=== Laravel 路由调试脚本 ===\n\n";

// 切换到Laravel目录
chdir('back');

echo "1. 清除路由缓存...\n";
exec('php artisan route:clear', $output1, $return1);
if ($return1 === 0) {
    echo "✓ 路由缓存已清除\n";
} else {
    echo "❌ 清除路由缓存失败: " . implode("\n", $output1) . "\n";
}

echo "\n2. 清除配置缓存...\n";
exec('php artisan config:clear', $output2, $return2);
if ($return2 === 0) {
    echo "✓ 配置缓存已清除\n";
} else {
    echo "❌ 清除配置缓存失败: " . implode("\n", $output2) . "\n";
}

echo "\n3. 检查Flag相关路由...\n";
exec('php artisan route:list --name=flag 2>/dev/null', $output3, $return3);
if ($return3 === 0 && !empty($output3)) {
    echo "✓ 找到Flag相关路由:\n";
    foreach ($output3 as $line) {
        echo "  $line\n";
    }
} else {
    echo "⚠️  没有找到命名的Flag路由，检查所有包含'flag'的路由:\n";
    exec('php artisan route:list | grep -i flag', $output4, $return4);
    if (!empty($output4)) {
        foreach ($output4 as $line) {
            echo "  $line\n";
        }
    } else {
        echo "❌ 没有找到任何Flag相关路由\n";
    }
}

echo "\n4. 检查中间件...\n";
exec('php artisan route:list | grep -E "(jwtcheck|flag)"', $output5, $return5);
if (!empty($output5)) {
    echo "✓ 找到相关路由:\n";
    foreach ($output5 as $line) {
        echo "  $line\n";
    }
} else {
    echo "❌ 没有找到相关路由\n";
}

echo "\n5. 检查控制器是否存在...\n";
if (file_exists('app/Http/Controllers/FlagSubmission/FlagSubmissionController.php')) {
    echo "✓ FlagSubmissionController 存在\n";
} else {
    echo "❌ FlagSubmissionController 不存在\n";
}

echo "\n6. 检查中间件注册...\n";
if (file_exists('app/Http/Kernel.php')) {
    $kernelContent = file_get_contents('app/Http/Kernel.php');
    if (strpos($kernelContent, 'jwtcheck') !== false) {
        echo "✓ jwtcheck 中间件已在 Kernel.php 中注册\n";
    } else {
        echo "❌ jwtcheck 中间件未在 Kernel.php 中注册\n";
    }
} else {
    echo "❌ Kernel.php 文件不存在\n";
}

echo "\n7. 尝试重新生成路由缓存...\n";
exec('php artisan route:cache', $output6, $return6);
if ($return6 === 0) {
    echo "✓ 路由缓存已重新生成\n";
} else {
    echo "❌ 重新生成路由缓存失败: " . implode("\n", $output6) . "\n";
}

echo "\n8. 最终检查 - 列出所有路由中包含submit-flag的...\n";
exec('php artisan route:list | grep submit-flag', $output7, $return7);
if (!empty($output7)) {
    echo "✓ 找到submit-flag路由:\n";
    foreach ($output7 as $line) {
        echo "  $line\n";
    }
} else {
    echo "❌ 没有找到submit-flag路由\n";
    
    // 检查完整的路由列表中的flag相关路由
    echo "\n检查所有路由中是否有flag相关的:\n";
    exec('php artisan route:list', $allRoutes);
    $flagRoutes = array_filter($allRoutes, function($line) {
        return stripos($line, 'flag') !== false;
    });
    
    if (!empty($flagRoutes)) {
        echo "找到的flag相关路由:\n";
        foreach ($flagRoutes as $route) {
            echo "  $route\n";
        }
    } else {
        echo "❌ 完全没有找到flag相关路由\n";
    }
}

echo "\n=== 调试完成 ===\n";
echo "\n建议的下一步操作:\n";
echo "1. 如果没有找到路由，检查 routes/api.php 文件\n";
echo "2. 确保 composer autoload 是最新的：运行 'composer dump-autoload'\n";
echo "3. 检查 .env 文件中的 APP_ENV 和 APP_DEBUG 设置\n";
echo "4. 重启 PHP-FPM 或 Apache/Nginx\n";
