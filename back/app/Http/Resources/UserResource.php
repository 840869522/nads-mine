<?php
// file: app/Http/Resources/UserResource.php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * 【最终修复：这是缺失的用户 API 资源文件】
 *
 * 这个文件负责将后端的 UserModel 实例，转换为前端需要的、干净、安全的 JSON 格式。
 * 当其他资源文件（例如 AdRefereeResource）调用 `new UserResource($userModel)` 时，
 * Laravel 会执行下面的 `toArray` 方法。
 */
class UserResource extends JsonResource
{
    /**
     * 将用户资源转换为数组 (Transform the resource into an array)。
     *
     * @param  \Illuminate\Http\Request  $request
     * @return array<string, mixed>
     */
    public function toArray($request) // 遵循兼容性原则，不添加返回类型声明
    {
        // 在这里, `$this` 指向一个从数据库查询出来的 UserModel 实例。
        // 我们将数据库字段（例如 c_username, c_email）映射为前端期望的 JSON 键名。
        //
        // 关键：根据你的 `c_users` 表结构，主键是 `c_username`。
        // 因此，我们使用 `c_username` 作为 API 响应中的 'id'，这是 RESTful API 的良好实践。
        return [
            // === 核心身份信息 ===
            'id'       => $this->c_username, // 使用唯一的、作为主键的 username 作为 API 的 id
            'username' => $this->c_username,

            // === 其他公开信息 ===
            'email'    => $this->c_email,

            // 假设你的 UserModel 中有一个 c_real_name 字段
            // 如果没有，可以安全地注释或删除这一行
            'real_name'=> $this->c_real_name,

            // === 时间戳信息 (已做 null 安全检查) ===
            'created_at'  => $this->c_create_at ? $this->c_create_at->toDateTimeString() : null,
            'last_login'  => $this->c_last_login ? $this->c_last_login->toDateTimeString() : null,

            // 注意：我们永远不应该在 API 中返回用户的密码 (`c_password`) 或其他敏感信息。
            // 这个 Resource 文件正是实现这种安全过滤的最佳场所。
        ];
    }
}
