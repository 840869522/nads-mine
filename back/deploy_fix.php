<?php
// 部署修复脚本 - 检查和应用 FlagSubmissionController 修复
echo "=== FlagSubmissionController 修复部署脚本 ===\n";

// 检查目标文件路径
$target_file = '/var/www/html/98nads/nads/back/app/Http/Controllers/FlagSubmission/FlagSubmissionController.php';
$backup_file = $target_file . '.backup.' . date('YmdHis');
$fix_file = 'D:\\98nads\\nads\\back\\FlagSubmissionController_final.php';

echo "目标文件: $target_file\n";
echo "备份文件: $backup_file\n";
echo "修复文件: $fix_file\n\n";

// 1. 检查目标文件是否存在
if (!file_exists($target_file)) {
    echo "❌ 错误: 目标文件不存在\n";
    exit(1);
}

// 2. 检查修复文件是否存在
if (!file_exists($fix_file)) {
    echo "❌ 错误: 修复文件不存在\n";
    exit(1);
}

echo "✓ 文件检查通过\n\n";

// 3. 创建备份
echo "📦 创建备份...\n";
if (copy($target_file, $backup_file)) {
    echo "✓ 备份创建成功: $backup_file\n";
} else {
    echo "❌ 备份创建失败\n";
    exit(1);
}

// 4. 应用修复
echo "\n🔧 应用修复...\n";
if (copy($fix_file, $target_file)) {
    echo "✓ 修复应用成功\n";
} else {
    echo "❌ 修复应用失败\n";
    // 恢复备份
    copy($backup_file, $target_file);
    echo "✓ 已恢复备份\n";
    exit(1);
}

// 5. 语法检查
echo "\n🔍 检查PHP语法...\n";
$syntax_check = shell_exec("php -l $target_file 2>&1");
if (strpos($syntax_check, 'No syntax errors') !== false) {
    echo "✓ PHP语法检查通过\n";
} else {
    echo "❌ PHP语法检查失败:\n";
    echo $syntax_check . "\n";
    
    // 恢复备份
    copy($backup_file, $target_file);
    echo "✓ 已恢复备份\n";
    exit(1);
}

// 6. 清理Laravel缓存
echo "\n🧹 清理Laravel缓存...\n";
$commands = [
    'php /var/www/html/98nads/nads/back/artisan config:clear',
    'php /var/www/html/98nads/nads/back/artisan route:clear',
    'php /var/www/html/98nads/nads/back/artisan view:clear',
    'php /var/www/html/98nads/nads/back/artisan cache:clear'
];

foreach ($commands as $cmd) {
    echo "执行: $cmd\n";
    $output = shell_exec($cmd . ' 2>&1');
    if ($output) {
        echo "输出: " . trim($output) . "\n";
    }
}

echo "\n✅ 修复部署完成！\n";
echo "\n修复内容总结:\n";
echo "- 移除了复杂的正则表达式验证规则，避免语法解析问题\n";
echo "- 改用简单的字符串长度验证 + 代码内正则校验\n";
echo "- 优化了Flag格式验证逻辑\n";
echo "- 改进了用户名获取逻辑\n";
echo "- 保持了完整的功能性\n";
echo "\n建议测试:\n";
echo "1. 提交正确的Flag格式 (flag{uuid})\n";
echo "2. 提交错误的Flag格式\n";
echo "3. 验证JWT token认证\n";
echo "4. 检查分数计算和历史记录\n";

// 7. 显示关键改动
echo "\n📋 关键改动:\n";
echo "- 第66-74行: 简化的验证规则\n";
echo "- 第86-89行: 新的Flag格式验证调用\n";
echo "- 第137-155行: 改进的validateFlagFormat方法\n";
echo "- 第48-63行: 改进的用户名获取逻辑\n";

echo "\n部署完成时间: " . date('Y-m-d H:i:s') . "\n";
?>