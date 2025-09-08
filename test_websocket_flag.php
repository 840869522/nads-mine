<?php
/**
 * WebSocket测试脚本 - 模拟Flag提交消息广播
 * 
 * 使用方法：
 * 1. 确保WebSocket服务正在运行：php artisan websocket:server start
 * 2. 运行此脚本：php test_websocket_flag.php
 */

// 模拟Flag提交消息
$flagSubmissionData = [
    'type' => 'flag_submission',
    'submission_id' => 'test-' . uniqid(),
    'c_username' => 'test_user',
    'c_is_correct' => true,
    'c_points_earned' => 95,
    'c_submitted_at' => date('Y-m-d H:i:s'),
    'c_scene_instances_id' => 'test-scene-' . uniqid(),
    'c_container_instance_id' => 'test-container-123',
    'c_vm_instance_id' => null,
    'instance_type' => 'docker'
];

// 发送到WebSocket内部端口2347
$message = json_encode($flagSubmissionData) . "\n";

echo "正在发送测试Flag提交消息到WebSocket服务...\n";
echo "消息内容: " . json_encode($flagSubmissionData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . "\n\n";

// 连接到WebSocket内部端口
$socket = stream_socket_client('tcp://127.0.0.1:2347', $errno, $errstr, 30);

if (!$socket) {
    die("连接失败: $errstr ($errno)\n");
}

// 发送消息
fwrite($socket, $message);

// 读取响应（如果有）
$response = fgets($socket, 1024);
if ($response) {
    echo "服务器响应: $response\n";
}

fclose($socket);

echo "✅ 测试消息已发送！\n";
echo "请检查前端页面是否收到了实时更新的Flag提交记录。\n";
echo "\n";
echo "如果前端没有收到消息，请检查：\n";
echo "1. WebSocket服务是否正常运行 (php artisan websocket:server start)\n";
echo "2. 前端页面是否已连接到WebSocket\n";
echo "3. 浏览器控制台是否有错误信息\n";
?>
