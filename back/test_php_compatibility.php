<?php

echo "PHP版本: " . PHP_VERSION . "\n";
echo "测试PHP兼容性...\n";

// 测试兼容性函数
require_once __DIR__ . '/app/Helpers/functions.php';

echo "测试str_starts_with函数: ";
if (str_starts_with('flag{test}', 'flag{')) {
    echo "✓ 工作正常\n";
} else {
    echo "✗ 函数问题\n";
}

echo "测试str_ends_with函数: ";
if (str_ends_with('test.txt', '.txt')) {
    echo "✓ 工作正常\n";
} else {
    echo "✗ 函数问题\n";
}

echo "测试str_contains函数: ";
if (str_contains('hello world', 'world')) {
    echo "✓ 工作正常\n";
} else {
    echo "✗ 函数问题\n";
}

// 测试null合并操作符
$test = null;
$result = $test ?? 'default';
echo "测试null合并操作符: " . ($result === 'default' ? "✓ 工作正常" : "✗ 不工作") . "\n";

// 测试语法检查
$testCode = '<?php
if (!empty($correctFlag) && !str_starts_with($correctFlag, "flag{")) {
    $normalizedCorrectFlag = "flag{" . $correctFlag . "}";
}
';

echo "测试关键代码语法: ";
$tmpFile = tempnam(sys_get_temp_dir(), 'php_syntax_test');
file_put_contents($tmpFile, $testCode);

$output = [];
$returnCode = 0;
exec("php -l $tmpFile 2>&1", $output, $returnCode);

if ($returnCode === 0) {
    echo "✓ 语法正确\n";
} else {
    echo "✗ 语法错误: " . implode("\n", $output) . "\n";
}

unlink($tmpFile);
echo "兼容性测试完成。\n";