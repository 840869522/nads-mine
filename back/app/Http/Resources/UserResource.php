<?php
// file: app/Http-Resources/UserResource.php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class UserResource extends JsonResource
{
    /**
     * 将资源转换为数组。
     *
     * @param  \Illuminate\Http\Request  $request
     * @return array
     */
    public function toArray($request)
    {
        return [
            // ★ 修复 1: 返回前端 TypeScript 定义中期望的 c_username 字段
            // 同时也返回其他前端可能用到的字段，如 c_name
            'c_username' => $this->c_username,
            'c_name'     => $this->c_name,
            'c_email'    => $this->c_email,

            // ★ 修复 2: 使用 whenPivotLoaded 安全地加载中间表数据
            // 'c_teams_users' 是你在数据库中定义的中间表名。
            // 这会检查 pivot 数据是否存在，如果存在，就添加 'pivot' 键。
            'pivot' => $this->whenPivotLoaded('c_teams_users', function () {
                return [
                    // 确保 is_banned 总是返回布尔值 (true/false)，而不是数据库的 0 或 1
                    'is_banned' => (bool) $this->pivot->is_banned,
                    'role'      => $this->pivot->role,
                ];
            }),
        ];
    }
}
