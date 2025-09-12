<?php

echo "测试Flag正则表达式...\n";

// 测试原始正则表达式
$regex = '/^flag\{[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\}$/';
$testFlag = 'flag{12345678-1234-1234-1234-123456789abc}';

echo "正则表达式: $regex\n";
echo "测试Flag: $testFlag\n";

if (preg_match($regex, $testFlag)) {
    echo "✓ 正则表达式匹配成功\n";
} else {
    echo "✗ 正则表达式匹配失败\n";
}

// 测试Validator规则数组
$rules = [
    'c_scene_instances_id' => ['required', 'string'],
    'instance_id' => ['required', 'string'],
    'instance_type' => ['required', 'string', 'in:docker,vm'],
    'flag' => ['required', 'string', 'regex:/^flag\{[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\}$/'],
];

echo "✓ 验证规则数组语法正常\n";

// 检查是否有语法错误
$testCode = '<?php
$validator = Validator::make($request->all(), [
    "c_scene_instances_id" => ["required", "string", "exists:c_scene_instances,c_scene_instances_id"],
    "instance_id" => ["required", "string"],
    "instance_type" => ["required", "string", "in:docker,vm"],
    "flag" => ["required", "string", "regex:/^flag\{[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\}$/"],
], [
    "c_scene_instances_id.exists" => "场景实例不存在",
    "instance_type.in" => "实例类型不合法",
    "flag.regex" => "Flag格式不正确"
]);
';

echo "测试验证器代码语法: ";
$tmpFile = tempnam(sys_get_temp_dir(), 'php_validator_test');
file_put_contents($tmpFile, $testCode);

$output = [];
$returnCode = 0;
exec("php -l $tmpFile 2>&1", $output, $returnCode);

if ($returnCode === 0) {
    echo "✓ 验证器语法正确\n";
} else {
    echo "✗ 验证器语法错误: " . implode("\n", $output) . "\n";
}

unlink($tmpFile);
echo "正则表达式测试完成。\n";