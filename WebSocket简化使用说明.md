# WebSocket 简化使用说明

## 概述
WebSocket系统已经完全简化，去掉了所有Token认证，现在可以直接使用无需任何认证步骤。

## 主要修改

### 1. 去掉Token认证
- ✅ WebSocket服务端不再需要Token验证
- ✅ WebSocket客户端不再需要设置Token
- ✅ Flag API路由组去掉JWT认证中间件
- ✅ Flag控制器简化用户信息获取

### 2. 简化连接流程
- ✅ 客户端连接时无需认证，直接可用
- ✅ 服务端向所有连接广播消息
- ✅ 移除所有认证相关的状态检查

## 使用方法

### 1. 启动WebSocket服务
```bash
cd D:\96nadsnew\nads\back
php artisan websocket:server start
```

### 2. 访问Flag历史页面
直接访问前端页面：
```
http://localhost:3000/flag-history
```

### 3. 测试WebSocket消息
运行测试脚本：
```bash
cd D:\96nadsnew\nads
php test_websocket_flag.php
```

## API接口

### Flag提交接口
```
POST /back/api/flag/submit-flag
```
**请求参数：**
```json
{
  "c_scene_instances_id": "场景ID",
  "instance_id": "靶机ID", 
  "instance_type": "docker|vm",
  "flag": "flag{uuid}",
  "username": "用户名（可选，默认为anonymous）"
}
```

### 历史记录接口
```
POST /back/api/flag/submission-history
```
**请求参数：**
```json
{
  "scope": "mine|all",
  "target_scope": "this_target|all_targets_in_scene|all_targets_in_all_scenes",
  "username": "用户名（可选）"
}
```

## 实时消息广播

当有Flag提交时，系统会自动通过WebSocket向所有连接的客户端广播消息：

```json
{
  "type": "flag_submission",
  "submission_id": "提交ID",
  "c_username": "用户名",
  "c_is_correct": true,
  "c_points_earned": 95,
  "c_submitted_at": "2024-01-01 12:00:00",
  "c_scene_instances_id": "场景ID",
  "c_container_instance_id": "容器ID",
  "c_vm_instance_id": "VM ID",
  "instance_type": "docker|vm"
}
```

## 故障排除

### 1. WebSocket连接失败
检查：
- WebSocket服务是否启动：`php artisan websocket:server start`
- 端口8080是否被占用
- 防火墙是否阻止了端口访问

### 2. 前端不显示实时更新
检查：
- 浏览器控制台是否有WebSocket连接错误
- 网络代理设置是否正确
- 页面是否正确加载了websocket.ts

### 3. API请求失败
检查：
- 后端服务是否正常运行
- API路径是否正确（需要包含/back/前缀）
- 请求方法是否正确（历史记录需要POST方法）

## 测试流程

1. **启动服务**：
   ```bash
   php artisan websocket:server start
   ```

2. **打开前端页面**：
   访问 `http://localhost:3000/flag-history`

3. **测试实时消息**：
   ```bash
   php test_websocket_flag.php
   ```

4. **验证结果**：
   - 前端页面应该实时显示新的Flag提交记录
   - 统计数据应该自动更新
   - WebSocket连接状态应该显示"已连接"

## 技术架构

```
前端页面 (React) 
    ↓ WebSocket连接 (ws://localhost:3000/ws)
WebSocket服务 (端口8080)
    ↓ 内部通信 (端口2347)  
Laravel应用 (Flag提交处理)
```

## 注意事项

1. **简化认证**：系统现在不需要任何Token认证，所有连接都被视为有效
2. **用户标识**：如果不提供username参数，系统会使用'anonymous'作为默认用户名
3. **数据安全**：生产环境建议重新加上适当的认证机制
4. **性能考虑**：WebSocket会向所有连接广播消息，连接数过多时需要考虑性能优化
