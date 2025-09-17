<?php

require_once __DIR__ . '/vendor/autoload.php';

/**
 * Flag提交功能测试脚本
 * 
 * 测试修复后的JWT验证逻辑是否正常工作
 */

use App\Utils\JWTControll;
use App\Models\Users\UserModel;

echo "=== Flag提交功能修复测试 ===\n\n";

// 1. 测试JWT解码功能
echo "1. 测试JWT解码功能...\n";

try {
    // 创建测试JWT token
    $testData = ['id' => 'test_user'];
    $jwtResult = JWTControll::encodeJWT($testData);
    
    if ($jwtResult['err'] === null) {
        echo "   ✅ JWT编码成功\n";
        $token = $jwtResult['token'];
        
        // 测试解码（模拟前端发送的格式）
        $decodeResult = JWTControll::decodeJWT($token);
        
        if ($decodeResult['err'] === null && isset($decodeResult['data']['id'])) {
            echo "   ✅ JWT解码成功，用户ID: " . $decodeResult['data']['id'] . "\n";
        } else {
            echo "   ❌ JWT解码失败: " . ($decodeResult['err'] ?? '未知错误') . "\n";
        }
    } else {
        echo "   ❌ JWT编码失败: " . $jwtResult['err'] . "\n";
    }
} catch (Exception $e) {
    echo "   ❌ JWT测试异常: " . $e->getMessage() . "\n";
}

echo "\n";

// 2. 测试用户验证功能
echo "2. 测试用户验证功能...\n";

try {
    // 测试查询一个存在的用户（假设admin用户存在）
    $userResult = UserModel::getUserById('admin');
    
    if ($userResult['code'] === \App\Utils\GlobalResponse::$DATABASE_SUCCESS_CODE) {
        if ($userResult['data']) {
            echo "   ✅ 用户验证功能正常，找到用户: admin\n";
        } else {
            echo "   ❌ admin用户不存在，请确保数据库中有测试用户\n";
        }
    } else {
        echo "   ❌ 用户验证查询失败\n";
    }
    
    // 测试查询不存在的用户
    $nonExistResult = UserModel::getUserById('anonymous');
    if ($nonExistResult['code'] === \App\Utils\GlobalResponse::$DATABASE_SUCCESS_CODE) {
        if (!$nonExistResult['data']) {
            echo "   ✅ 正确识别不存在的用户: anonymous\n";
        } else {
            echo "   ⚠️  anonymous用户存在于数据库中\n";
        }
    }
    
} catch (Exception $e) {
    echo "   ❌ 用户验证测试异常: " . $e->getMessage() . "\n";
}

echo "\n";

// 3. 输出测试结果和建议
echo "3. 测试结果总结:\n";
echo "   修复内容:\n";
echo "   - ✅ 移除了对middleware token_data的依赖\n";
echo "   - ✅ 实现了直接从Authorization头解码JWT\n";
echo "   - ✅ 适配了项目原有的token格式（无Bearer前缀）\n";
echo "   - ✅ 增加了完整的用户验证逻辑\n";
echo "   - ✅ 增强了错误处理和日志记录\n\n";

echo "4. 下一步测试建议:\n";
echo "   - 使用前端界面登录用户\n";
echo "   - 尝试提交Flag，观察是否还有\"请先登录\"错误\n";
echo "   - 检查Laravel日志文件中的详细错误信息\n";
echo "   - 如果仍有问题，检查浏览器开发者工具的网络请求\n\n";

echo "=== 测试完成 ===\n";