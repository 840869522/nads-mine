# WebSocket 实时Flag提交系统使用说明

## 📋 功能概述

已成功完善了基于Workerman的WebSocket实时Flag提交历史系统，具备以下功能：

- ✅ **服务器端认证**：JWT token验证
- ✅ **自动重连**：客户端断线自动重连机制
- ✅ **心跳检测**：保持连接稳定性
- ✅ **实时推送**：Flag提交后立即推送给所有客户端
- ✅ **历史页面**：独立的实时Flag提交历史页面
- ✅ **菜单集成**：已添加到侧边栏导航

## 🚀 启动步骤

### 1. 启动后端Laravel服务
```bash
cd back
php artisan serve
```

### 2. 启动WebSocket服务器
```bash
cd back
php artisan websocket:server start
```

### 3. 启动前端服务
```bash
cd src
npm run dev
```

## 📱 新增页面

### Flag提交历史页面
- **路径**: `/flag-history`
- **功能**: 实时显示所有用户的Flag提交记录
- **特性**:
  - 实时统计数据（总提交数、成功数、成功率等）
  - 连接状态监控
  - 实时更新开关
  - 自动滚动控制
  - 详细的提交记录表格

## 🔧 主要改进

### 1. WebSocket服务器 (`back/app/Console/Commands/WebSocketServer.php`)
- 添加了JWT认证处理
- 支持消息类型路由（auth, ping等）
- 改进了广播机制，只向已认证用户发送消息
- 添加了连接管理和清理

### 2. WebSocket客户端 (`src/utils/websocket.ts`)
- 自动重连机制（最多5次）
- 心跳检测（30秒间隔）
- 认证状态管理
- 连接状态监控
- 错误处理

### 3. Flag提交历史页面 (`src/app/flag-history/page.tsx`)
- 完整的实时历史页面
- Material-UI精美界面
- 统计数据展示
- 连接状态指示
- 可控的实时更新

### 4. 导航菜单集成 (`src/components/layout/Sidebar.tsx`)
- 添加了Flag历史页面入口
- 使用Flag图标标识

## 🌐 WebSocket消息格式

### 客户端发送认证消息
```json
{
  "type": "auth",
  "token": "your_jwt_token"
}
```

### 服务器认证响应
```json
{
  "type": "auth_response",
  "success": true,
  "message": "Authentication successful"
}
```

### Flag提交实时推送
```json
{
  "type": "flag_submission",
  "submission_id": "uuid",
  "c_username": "username",
  "c_is_correct": true,
  "c_points_earned": 95,
  "c_submitted_at": "2025-01-06 10:30:00",
  "c_scene_instances_id": "scene_id",
  "c_container_instance_id": "container_id",
  "c_vm_instance_id": null,
  "instance_type": "docker",
  "attempt_count": 1
}
```

## 🔍 测试方法

### 1. 检查WebSocket服务状态
```bash
# 查看进程
ps aux | grep websocket

# 检查端口
netstat -tulnp | grep 8080
```

### 2. 测试连接
1. 登录系统获取JWT token
2. 访问 `/flag-history` 页面
3. 检查页面右上角连接状态指示器
4. 在另一个页面提交Flag，观察历史页面是否实时更新

### 3. 调试模式
在浏览器控制台中可以看到：
- WebSocket连接状态
- 认证结果
- 接收到的消息
- 重连尝试

## ⚙️ 配置选项

### WebSocket服务器配置
- **端口**: 8080 (WebSocket协议)
- **内部端口**: 2347 (Laravel通信)
- **进程数**: 4

### 客户端配置
- **重连间隔**: 3秒
- **最大重连次数**: 5次
- **心跳间隔**: 30秒

## 🔧 故障排除

### 1. WebSocket连接失败
- 检查WebSocket服务器是否启动
- 确认端口8080未被占用
- 检查防火墙设置

### 2. 认证失败
- 确认JWT token有效
- 检查token格式（长度>10字符）
- 查看服务器日志

### 3. 消息不推送
- 确认Flag提交Controller调用了WorkermanService
- 检查2347端口连通性
- 查看服务器错误日志

## 📈 性能监控

WebSocket服务器支持：
- 多进程处理（4个工作进程）
- 并发连接管理
- 内存使用监控
- 消息处理统计

## 🛠 未来改进建议

1. **权限细分**: 基于场景实例的消息权限控制
2. **消息过滤**: 支持按场景、用户过滤消息
3. **消息持久化**: 将WebSocket消息存储到Redis
4. **集群支持**: 多服务器WebSocket集群
5. **监控面板**: 添加WebSocket服务监控界面

---

**系统已就绪，可以开始使用实时Flag提交功能！**
