<?php
/**
 * WebSocket连接测试脚本
 * 用于测试Laravel到Workerman的消息传递
 */

// 测试发送消息到Workerman内部端口
function testWorkermanConnection() {
    $testMessage = [
        'type' => 'flag_submission',
        'submission_id' => 'test-' . uniqid(),
        'c_username' => 'test_user',
        'c_is_correct' => true,
        'c_points_earned' => 100,
        'c_submitted_at' => date('Y-m-d H:i:s'),
        'c_scene_instances_id' => 'test-scene-123',
        'c_container_instance_id' => 'test-container-456',
        'c_vm_instance_id' => null,
        'instance_type' => 'docker'
    ];

    $message = json_encode($testMessage) . "\n";
    
    echo "尝试连接到Workerman内部端口2347...\n";
    echo "发送的消息: " . $message . "\n";
    
    try {
        $client = stream_socket_client('tcp://127.0.0.1:2347', $errno, $errmsg, 3);
        
        if (!$client) {
            echo "连接失败: {$errmsg} ({$errno})\n";
            return false;
        }
        
        echo "连接成功！\n";
        
        $result = fwrite($client, $message);
        fclose($client);
        
        if ($result === false) {
            echo "数据写入失败\n";
            return false;
        }
        
        echo "消息发送成功，写入了 {$result} 字节\n";
        return true;
        
    } catch (Exception $e) {
        echo "异常: " . $e->getMessage() . "\n";
        return false;
    }
}

// 检查端口是否开放
function checkPort($host, $port) {
    $connection = @fsockopen($host, $port, $errno, $errstr, 1);
    if ($connection) {
        fclose($connection);
        return true;
    }
    return false;
}

echo "=== WebSocket连接测试脚本 ===\n\n";

echo "1. 检查Workerman WebSocket端口8080...\n";
if (checkPort('127.0.0.1', 8080)) {
    echo "✓ 端口8080开放\n";
} else {
    echo "✗ 端口8080未开放\n";
}

echo "\n2. 检查Workerman内部端口2347...\n";
if (checkPort('127.0.0.1', 2347)) {
    echo "✓ 端口2347开放\n";
} else {
    echo "✗ 端口2347未开放\n";
}

echo "\n3. 测试消息发送...\n";
if (testWorkermanConnection()) {
    echo "✓ 消息发送测试成功\n";
} else {
    echo "✗ 消息发送测试失败\n";
}

echo "\n=== 测试完成 ===\n";
