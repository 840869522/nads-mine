# Flag 提交系统

## 系统概述

这是一个完整的CTF（Capture The Flag）竞赛Flag提交与验证系统，支持Docker容器和虚拟机两种靶机类型。

## 功能特性

- ✅ **Flag提交与验证** - 支持UUID格式的Flag提交和自动验证
- ✅ **动态计分机制** - 首位满分100分，随后递减的动态计分算法
- ✅ **实时数据更新** - WebSocket实时推送提交结果
- ✅ **历史记录查看** - 完整的提交历史和统计信息
- ✅ **多种靶机支持** - 支持Docker容器和VM实例
- ✅ **权限控制** - JWT认证和API限流保护
- ✅ **防重复计分** - 同一用户同一靶机只能获得一次分数

## 系统架构

```
前端 (React + TypeScript + Material-UI)
├── Flag提交表单
├── 历史记录展示
├── 实时数据更新
└── 响应式UI设计

后端 (Laravel + PHP)
├── JWT身份认证
├── API限流保护
├── Flag验证逻辑
├── 动态计分算法
└── WebSocket推送

数据库 (MySQL)
├── c_flag_submission (Flag提交记录)
├── c_scene_instances (场景实例)
├── c_scene_container_instances (容器实例)
└── c_scene_vm_instances (VM实例)
```

## 部署步骤

### 1. 数据库设置

```bash
# 1. 执行数据库迁移脚本
mysql -u your_username -p your_database < back/database/migrations/create_flag_system_tables.sql

# 2. 验证表创建成功
mysql -u your_username -p your_database -e "SHOW TABLES LIKE 'c_%';"
```

### 2. 后端配置

```bash
# 1. 确保Laravel依赖已安装
cd back
composer install

# 2. 检查路由配置
php artisan route:list | grep flag

# 3. 清理缓存
php artisan config:clear
php artisan route:clear
php artisan cache:clear
```

### 3. 前端配置

```bash
# 1. 安装前端依赖
cd src
npm install

# 2. 检查API配置
# 确保 constants.ts 中的 BACK_IP_PORT 正确设置

# 3. 启动开发服务器
npm run dev
```

## API 接口文档

### 认证方式
所有API都需要JWT认证，请在请求头中添加：
```
Authorization: Bearer <your_jwt_token>
```

### 接口列表

#### 1. 获取场景实例列表
```http
GET /api/flag/scene-instances
```

**响应示例:**
```json
{
    "code": 200,
    "message": "场景实例获取成功",
    "data": [
        {
            "c_scene_instances_id": "test-scene-001"
        }
    ]
}
```

#### 2. 获取靶机实例列表
```http
GET /api/flag/target-instances?scene_id=test-scene-001
```

**响应示例:**
```json
{
    "code": 200,
    "message": "靶机实例获取成功",
    "data": [
        {
            "id": "web-challenge-001",
            "type": "docker"
        }
    ]
}
```

#### 3. 提交Flag
```http
POST /api/flag/submit-flag
```

**请求体:**
```json
{
    "c_scene_instances_id": "test-scene-001",
    "instance_id": "web-challenge-001",
    "instance_type": "docker",
    "flag": "flag{a1b2c3d4-e5f6-7890-abcd-ef1234567890}"
}
```

**响应示例:**
```json
{
    "code": 200,
    "message": "Flag提交成功！获得 100 分。",
    "data": {
        "points": 100,
        "is_correct": true
    }
}
```

#### 4. 获取提交历史
```http
GET /api/flag/submission-history?scope=mine&target_scope=all_targets_in_all_scenes
```

## 使用指南

### 1. Flag格式要求
Flag必须符合以下正则表达式格式：
```regex
/^flag\{[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\}$/
```

示例: `flag{12345678-1234-1234-1234-123456789abc}`

### 2. 计分规则
- 首位正确提交：100分
- 第二位正确提交：99分
- 第三位正确提交：98分
- ...以此类推，最低1分
- 同一用户重复提交正确Flag：0分

### 3. 前端使用

#### 基础组件使用：
```jsx
import FlagSubmissionForm from './components/FlagSubmissionSrc/FlagSubmissionForm';

<FlagSubmissionForm 
    instanceId="web-challenge-001"
    sceneInstanceId="test-scene-001" 
    instanceType="docker"
/>
```

#### 完整页面使用：
```jsx
import FlagSubmissionPage from './features/flag-submission/FlagSubmissionPage';

<FlagSubmissionPage />
```

### 4. 系统测试
访问测试页面来验证系统功能：
```jsx
import FlagSystemTest from './test/FlagSystemTest';

<FlagSystemTest />
```

## 故障排查

### 常见问题

#### 1. 401 Unauthorized 错误
```bash
# 检查JWT配置
# 确保用户已正确登录并获取token
# 验证token是否在请求头中正确设置
```

#### 2. 场景实例为空
```bash
# 检查数据库中是否有测试数据
mysql -u username -p -e "SELECT * FROM c_scene_instances;"

# 如果没有数据，执行插入脚本
mysql -u username -p database < back/database/migrations/create_flag_system_tables.sql
```

#### 3. Flag格式错误
```bash
# 确保Flag格式正确
# 正确: flag{12345678-1234-1234-1234-123456789abc}
# 错误: Flag{12345678-1234-1234-1234-123456789abc}
# 错误: flag{invalid-format}
```

#### 4. API路由不存在
```bash
# 检查路由是否正确注册
cd back
php artisan route:list | grep flag

# 清理路由缓存
php artisan route:clear
```

### 调试模式
在开发环境中可以启用详细的错误日志：

```php
// 在 .env 文件中设置
APP_DEBUG=true
LOG_LEVEL=debug
```

## 安全特性

- **JWT认证** - 所有API都需要有效的JWT token
- **API限流** - Flag提交接口限制为60次/分钟
- **输入验证** - 严格的参数验证和格式检查
- **SQL注入防护** - 使用Eloquent ORM防止SQL注入
- **XSS防护** - 前端数据转义和过滤

## 性能优化

- **数据库索引** - 为常用查询字段添加索引
- **查询优化** - 使用Eloquent关联查询减少N+1问题
- **前端缓存** - 合理使用React状态缓存
- **WebSocket连接池** - 优化实时推送性能

## 扩展功能

系统预留了以下扩展接口：

1. **积分排行榜** - 可基于现有数据实现排名系统
2. **团队竞赛** - 支持团队模式的Flag提交
3. **题目分类** - 支持不同类型题目的分类管理
4. **实时监控** - 管理员实时监控提交情况
5. **数据导出** - 支持比赛数据的导出和分析

## 更新日志

- **v1.0.0** - 初始版本，包含基础Flag提交功能
- **v1.1.0** - 添加实时推送和历史记录功能
- **v1.2.0** - 完善错误处理和用户体验

## 贡献指南

欢迎提交Issue和Pull Request来改进这个系统！

## 许可证

MIT License
