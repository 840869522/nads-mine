# Redis Flag消息系统使用说明

## 系统概述

Redis Flag消息系统提供了完整的Flag提交消息发送和接收功能，支持实时消息推送和异步消息处理。

## 组件说明

### 1. FlagRedisSender (发送器)
位置：`app/Services/FlagRedisSender.php`

**主要功能：**
- 发送Flag提交消息到Redis队列
- 发送实时消息到Redis频道
- 保存用户最新提交记录
- 提供队列状态查询

**使用方法：**
```php
use App\Services\FlagRedisSender;

$sender = new FlagRedisSender();
$result = $sender->sendFlagMessage([
    'submission_id' => 'uuid',
    'username' => 'user1',
    'scene_instance_id' => 'scene_001',
    'instance_id' => 'container_001',
    'instance_type' => 'docker',
    'is_correct' => true,
    'points_earned' => 100,
    'attempt_count' => 1,
    'submitted_at' => '2024-03-20 10:00:00'
]);
```

### 2. FlagRedisReceiver (接收器)
位置：`app/Services/FlagRedisReceiver.php`

**主要功能：**
- 从Redis队列接收消息（阻塞/非阻塞）
- 订阅Redis频道实时消息
- 批量处理消息
- 队列状态监控

**接收方式：**

#### 方式1：阻塞接收单条消息
```php
use App\Services\FlagRedisReceiver;

$receiver = new FlagRedisReceiver();
$message = $receiver->receiveMessage(30); // 30秒超时
if ($message) {
    // 处理消息
    processMessage($message);
}
```

#### 方式2：批量接收多条消息
```php
$messages = $receiver->receiveMessages(10); // 获取最多10条
foreach ($messages as $message) {
    processMessage($message);
}
```

#### 方式3：订阅频道实时消息
```php
$callback = function($message, $channel) {
    echo "从频道 {$channel} 收到消息\n";
    processMessage($message);
};

$receiver->subscribeToChannel($callback);
```

#### 方式4：轮询处理（适合定时任务）
```php
$processor = function($message) {
    // 处理逻辑
    return processMessage($message);
};

$processedCount = $receiver->pollMessages($processor, 50);
```

## Redis数据结构

### 1. 消息队列
- **键名**: `flag_submissions_queue`
- **类型**: List
- **用途**: 存储待处理的Flag提交消息
- **操作**: LPUSH（发送），BRPOP/RPOP（接收）

### 2. 发布频道
- **键名**: `flag_submissions_channel`
- **类型**: Pub/Sub Channel
- **用途**: 实时广播Flag提交事件
- **操作**: PUBLISH（发送），SUBSCRIBE（订阅）

### 3. 最新提交记录
- **键名**: `latest_flag_submission:{user_id}`
- **类型**: String (JSON)
- **用途**: 快速查询用户最新提交状态
- **过期**: 1小时自动过期

## 消息格式

发送和接收的消息采用统一的JSON格式：

```json
{
    "event_type": "flag_submission",
    "timestamp": "2024-03-20T10:00:00.000Z",
    "message_id": "flag_msg_65f9a1b2c3d4e",
    
    "submission_id": "uuid-string",
    "username": "user1",
    "user_id": "user1",
    
    "scene_instance_id": "scene_001",
    "instance_id": "container_001",
    "instance_type": "docker",
    "instance_name": "Web Server",
    
    "is_correct": true,
    "points_earned": 100,
    "attempt_count": 1,
    "submitted_at": "2024-03-20 10:00:00",
    
    "metadata": {
        "scene_type": "web_security",
        "team_id": "team_red",
        "session_id": "session_123"
    }
}
```

## 集成到现有系统

### 1. 在FlagSubmissionController中的集成
系统已在Flag提交成功后自动发送Redis消息：

```php
// 在submitFlag方法中，提交成功后
$this->sendRedisMessage([
    'submission_id' => $submission->c_submission_id,
    'username' => $username,
    'is_correct' => $is_correct,
    'points_earned' => $points_earned,
    // ... 其他数据
]);
```

### 2. 创建消息处理器
参考 `example_redis_consumer.php` 创建你的消息处理逻辑：

```php
// 复制示例文件内容到你的处理页面
// 修改 processMessage() 函数实现你的业务逻辑
```

## 部署和运行

### 1. 确保Redis服务运行
```bash
# 检查Redis状态
redis-cli ping

# 如果返回PONG则服务正常
```

### 2. 配置Laravel Redis连接
在 `.env` 文件中确保Redis配置正确：
```env
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=null
CACHE_DRIVER=redis
```

### 3. 运行消息接收器
```bash
# 在后台运行接收器
php example_redis_consumer.php &

# 或使用进程管理器如supervisor
```

## 监控和维护

### 1. 查看队列状态
```php
$receiver = new FlagRedisReceiver();
$status = $receiver->getQueueStatus();
// 返回: ['queue_length' => 10, 'status' => 'active']
```

### 2. 查看最近消息
```php
$recentMessages = $receiver->peekMessages(10);
// 查看最近10条消息，不移除
```

### 3. 清理过期记录
```php
$expiredCount = $receiver->cleanupExpiredRecords();
// 清理过期的用户提交记录
```

## 性能优化建议

1. **批量处理**: 使用 `receiveMessages()` 批量获取消息，提高处理效率
2. **连接池**: 在高并发环境中考虑使用Redis连接池
3. **监控队列**: 定期检查队列长度，避免消息积压
4. **错误处理**: 实现消息处理失败的重试机制
5. **日志记录**: 记录详细的处理日志，便于问题排查

## 故障排除

### 1. Redis连接失败
- 检查Redis服务是否运行
- 验证 `.env` 中的连接配置
- 确认网络连通性和防火墙设置

### 2. 消息丢失
- 检查Redis持久化配置
- 验证消息发送和接收的错误处理
- 查看应用日志排查问题

### 3. 处理延迟
- 检查队列长度是否过大
- 优化消息处理逻辑
- 考虑增加处理进程数量

## 扩展功能

1. **消息优先级**: 可扩展支持不同优先级的消息队列
2. **消息过滤**: 根据条件过滤特定类型的消息
3. **死信队列**: 处理失败消息的重试和死信机制
4. **分布式处理**: 支持多个处理节点的负载均衡

## 安全注意事项

1. **Redis访问控制**: 配置Redis密码和访问限制
2. **消息加密**: 敏感信息考虑加密存储
3. **权限管理**: 控制不同角色对消息的访问权限
4. **审计日志**: 记录重要的消息处理操作
