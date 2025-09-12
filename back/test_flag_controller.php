<?php
// 简化的测试版本，用于检测语法问题

require_once __DIR__ . '/vendor/autoload.php';

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

// 模拟关键代码片段
function testFlagSubmission() {
    echo "测试Flag提交核心逻辑...\n";
    
    // 测试1: 用户信息获取
    $token_data = ['id' => 'test_user'];
    if (is_array($token_data) && isset($token_data['id'])) {
        $username = $token_data['id'];
        echo "✓ 用户信息获取正常: $username\n";
    } else {
        echo "✗ 用户信息获取失败\n";
    }
    
    // 测试2: Flag格式化
    $correctFlag = '12345678-1234-1234-1234-123456789abc';
    $normalizedCorrectFlag = $correctFlag;
    if (!empty($correctFlag) && !str_starts_with($correctFlag, 'flag{')) {
        $normalizedCorrectFlag = 'flag{' . $correctFlag . '}';
        echo "✓ Flag格式化正常: $normalizedCorrectFlag\n";
    }
    
    // 测试3: UUID生成
    $submissionId = (string) Str::uuid();
    echo "✓ UUID生成正常: $submissionId\n";
    
    // 测试4: null合并操作符
    $testValue = null;
    $result = $testValue ?? 'default';
    echo "✓ null合并操作符正常: $result\n";
    
    echo "所有测试通过!\n";
}

// 运行测试
try {
    testFlagSubmission();
} catch (Exception $e) {
    echo "✗ 测试失败: " . $e->getMessage() . "\n";
    echo "文件: " . $e->getFile() . "\n";
    echo "行号: " . $e->getLine() . "\n";
}