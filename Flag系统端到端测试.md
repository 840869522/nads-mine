# Flag 系统端到端测试指南

## 🎯 测试目标

确保 Flag 提交系统的完整功能链路正常工作，从前端用户操作到后端处理，再到 Redis 消息发送。

## 📋 测试环境要求

### 必要服务
- ✅ MySQL 数据库服务
- ✅ Redis 服务  
- ✅ Laravel 后端应用
- ✅ React 前端应用
- ✅ Web 服务器 (Apache/Nginx)

### 测试数据准备
- 至少一个场景实例
- 至少一个容器或VM实例
- 实例需要设置 `c_flag` 字段值
- 测试用户账号

## 🧪 测试步骤

### 阶段 1: 数据库验证

```sql
-- 1. 检查核心表是否存在
SHOW TABLES LIKE 'c_flag_submissions';
SHOW TABLES LIKE 'c_scene_container_instances';
SHOW TABLES LIKE 'c_scene_vm_instances';
SHOW TABLES LIKE 'c_scene_instances';

-- 2. 检查 Flag 提交表结构
DESCRIBE c_flag_submissions;

-- 3. 检查是否有测试数据
SELECT * FROM c_scene_instances LIMIT 5;
SELECT c_container_id, c_scene_instances_id, c_flag FROM c_scene_container_instances WHERE c_flag IS NOT NULL LIMIT 5;
SELECT c_vm_id, c_vm_name, c_scene_instances_id, c_flag FROM c_scene_vm_instances WHERE c_flag IS NOT NULL LIMIT 5;

-- 4. 如果没有测试数据，创建一些
-- 注意：需要根据实际的场景实例ID调整
INSERT INTO c_scene_container_instances (c_container_id, c_scene_instances_id, c_flag, c_container_name) 
VALUES ('test-container-001', 'your-scene-instance-id', 'flag{12345678-1234-1234-1234-123456789abc}', 'Test Web Challenge');

INSERT INTO c_scene_vm_instances (c_vm_name, c_scene_instances_id, c_flag) 
VALUES ('test-vm-001', 'your-scene-instance-id', 'flag{87654321-4321-4321-4321-ba0987654321}');
```

### 阶段 2: Redis 连接测试

```bash
# 1. 测试 Redis 连接
redis-cli ping
# 预期输出：PONG

# 2. 清空之前的测试数据（可选）
redis-cli DEL flag_submissions_queue
redis-cli DEL latest_flag_submission:test_user

# 3. 监听 Flag 提交频道（在单独的终端中运行）
redis-cli SUBSCRIBE flag_submissions_channel
```

### 阶段 3: 后端 API 测试

```bash
# 1. 测试用户登录（获取JWT Token）
curl -X POST http://your-domain/back/api/support/user/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test_user","password":"test_password"}'

# 保存返回的 JWT Token，用于后续请求

# 2. 测试 Flag 提交 API（正确的 Flag）
curl -X POST http://your-domain/back/api/flag/submit-flag \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "c_scene_instances_id": "your-scene-instance-id",
    "instance_id": "test-container-001",
    "instance_type": "docker",
    "flag": "flag{12345678-1234-1234-1234-123456789abc}"
  }'

# 预期响应：
# {
#   "code": 200,
#   "message": "Flag提交成功！获得 XX 分。",
#   "data": {
#     "points": XX,
#     "is_correct": true
#   }
# }

# 3. 测试错误的 Flag 提交
curl -X POST http://your-domain/back/api/flag/submit-flag \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "c_scene_instances_id": "your-scene-instance-id",
    "instance_id": "test-container-001",
    "instance_type": "docker",
    "flag": "flag{wrong-flag-value-1234-1234-123456789abc}"
  }'

# 预期响应：
# {
#   "code": 200,
#   "message": "Flag不正确，请继续尝试。",
#   "data": {
#     "points": 0,
#     "is_correct": false
#   }
# }

# 4. 测试 Flag 格式错误
curl -X POST http://your-domain/back/api/flag/submit-flag \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "c_scene_instances_id": "your-scene-instance-id",
    "instance_id": "test-container-001",
    "instance_type": "docker",
    "flag": "invalid-flag-format"
  }'

# 预期响应：HTTP 400，格式错误消息

# 5. 测试提交历史查询
curl -X GET "http://your-domain/back/api/flag/submission-history?scope=mine&target_scope=all_targets_in_all_scenes" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"
```

### 阶段 4: Redis 消息验证

在 API 测试完成后，检查 Redis 中的消息：

```bash
# 1. 查看消息队列
redis-cli LRANGE flag_submissions_queue 0 -1

# 2. 查看用户最新提交
redis-cli KEYS "latest_flag_submission:*"
redis-cli GET "latest_flag_submission:test_user"

# 3. 检查监听终端是否收到实时消息
# （应该在之前开启的 SUBSCRIBE 终端中看到消息）
```

### 阶段 5: 前端界面测试

#### 5.1 访问页面
1. 登录系统
2. 导航到场景管理 → 场景实例
3. 选择一个有靶机的场景实例
4. 切换到"容器实例"或"虚拟机实例"标签页

#### 5.2 界面验证
- **检查点 1**: 确认实例列表正常显示
- **检查点 2**: 确认"是否为靶机"列显示正确（有 Flag 的显示"是"，没有的显示"否"）
- **检查点 3**: 确认只有靶机才显示 Flag 提交按钮（旗帜图标）
- **检查点 4**: 确认只有运行中的实例的 Flag 按钮才可点击

#### 5.3 Flag 提交流程测试
1. **点击 Flag 按钮**
   - 预期：弹出 Flag 提交模态框
   - 显示实例信息（名称、类型）

2. **测试格式验证**
   - 输入错误格式的 Flag（如 "wrong-format"）
   - 预期：显示格式错误提示

3. **提交正确的 Flag**
   - 输入正确的 Flag
   - 点击提交
   - 预期：显示成功消息，包含得分信息

4. **重复提交相同 Flag**
   - 再次提交同样的正确 Flag
   - 预期：显示"已提交过正确Flag，无法再次获得分数"

5. **提交错误的 Flag**
   - 输入错误的 Flag
   - 预期：显示"Flag不正确"消息

### 阶段 6: 数据库记录验证

```sql
-- 检查 Flag 提交记录
SELECT * FROM c_flag_submissions ORDER BY c_submitted_at DESC LIMIT 10;

-- 检查积分计算是否正确
SELECT c_username, c_is_correct, c_points_earned, c_attempt_count, c_submitted_at 
FROM c_flag_submissions 
WHERE c_username = 'test_user' 
ORDER BY c_submitted_at DESC;
```

## ✅ 测试检查清单

### 后端功能测试
- [ ] 数据库连接正常
- [ ] 所有必需表存在
- [ ] JWT 认证工作正常
- [ ] Flag 格式验证正确
- [ ] 正确 Flag 提交成功，返回正确积分
- [ ] 错误 Flag 提交失败，返回适当消息
- [ ] 重复提交防止重复得分
- [ ] API 限流机制工作（可选测试）

### Redis 消息测试
- [ ] Redis 连接正常
- [ ] 成功提交时发送消息到队列
- [ ] 失败提交时发送消息到队列
- [ ] 用户最新提交缓存更新
- [ ] 实时频道消息发布正常

### 前端界面测试
- [ ] 实例列表正常显示
- [ ] "是否为靶机"列显示正确
- [ ] 只有靶机显示 Flag 按钮
- [ ] 只有运行中实例的按钮可点击
- [ ] Flag 提交模态框正常打开
- [ ] 格式验证工作正常
- [ ] 提交成功显示正确消息
- [ ] 提交失败显示错误消息

### 数据完整性测试
- [ ] 数据库记录正确保存
- [ ] 积分计算准确
- [ ] 尝试次数统计正确
- [ ] 时间戳记录准确

## 🐛 常见问题和解决方案

### 1. 数据库相关
**问题**: 表不存在
```bash
# 解决：运行迁移
php artisan migrate
```

**问题**: 外键约束错误
```sql
-- 临时禁用外键约束进行测试
SET FOREIGN_KEY_CHECKS = 0;
-- 测试完成后重新启用
SET FOREIGN_KEY_CHECKS = 1;
```

### 2. Redis 相关
**问题**: Redis 连接失败
```bash
# 检查 Redis 服务状态
redis-server --version
redis-cli ping

# 检查 Laravel 配置
php artisan config:cache
```

### 3. JWT 相关
**问题**: JWT Token 无效
```bash
# 生成新的应用密钥
php artisan key:generate

# 清除配置缓存
php artisan config:clear
```

### 4. 前端相关
**问题**: API 调用失败
- 检查网络连接
- 验证 API 基础URL配置
- 检查浏览器开发者工具中的错误信息

## 📊 测试结果记录

| 测试项目 | 状态 | 备注 |
|---------|------|------|
| 数据库连接 | ⏳ 待测 | |
| 表结构验证 | ⏳ 待测 | |
| Redis连接 | ⏳ 待测 | |
| JWT认证 | ⏳ 待测 | |
| Flag提交API | ⏳ 待测 | |
| Redis消息 | ⏳ 待测 | |
| 前端界面 | ⏳ 待测 | |
| 端到端流程 | ⏳ 待测 | |

**测试完成后，请将 ⏳ 待测 更新为 ✅ 通过 或 ❌ 失败，并在备注中说明具体情况。**
