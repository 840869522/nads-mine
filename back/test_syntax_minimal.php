<?php

echo "PHP版本: " . PHP_VERSION . "\n";

// 测试正则表达式
$testFlag = 'flag{12345678-1234-1234-1234-123456789abc}';

// 方法1：简单正则
$pattern1 = '/^flag\{[0-9a-fA-F-]+\}$/';
if (preg_match($pattern1, $testFlag)) {
    echo "✓ 简单正则匹配成功\n";
}

// 方法2：复杂正则（问题可能在这里）
$pattern2 = '/^flag\{[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\}$/';
if (preg_match($pattern2, $testFlag)) {
    echo "✓ 复杂正则匹配成功\n";
} else {
    echo "✗ 复杂正则匹配失败\n";
}

// 测试数组访问
$tokenData = ['id' => 'test_user'];
if (is_array($tokenData) && isset($tokenData['id'])) {
    echo "✓ 数组访问正常: " . $tokenData['id'] . "\n";
}

// 测试Validator语法模拟
$rules = [
    'flag' => 'required|string|min:40|max:50'
];
echo "✓ Validator规则语法正常\n";

// 测试可能有问题的语法结构
try {
    $test = null ?? 'default';
    echo "✓ null合并操作符正常\n";
} catch (Exception $e) {
    echo "✗ null合并操作符错误: " . $e->getMessage() . "\n";
}

// 测试字符串函数
if (function_exists('str_starts_with')) {
    echo "✓ str_starts_with函数存在\n";
} else {
    echo "✗ str_starts_with函数不存在\n";
}

echo "语法测试完成\n";