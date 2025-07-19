<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

// 【重要】引入 UserResource，因为 Referee 模型关联了 User 模型
use App\Http\Resources\UserResource;

/**
 * API Resource for the Referee model.
 * 定义 Referee 模型（在 Ad 上下文中）如何转换为 JSON。
 */
class AdRefereeResource extends JsonResource
{
    /**
     * 将资源转换为数组。
     *
     * @param  \Illuminate\Http\Request  $request
     * @return array
     */
    public function toArray($request) // 遵循兼容性原则，不添加返回类型 :array
    {
        // `$this` 指向被转换的 Referee 模型实例
        return [
            // 主键
            'id' => $this->c_id,

            // 核心业务字段，将 c_ 前缀的字段名映射为更简洁的 JSON 键名
            'user_id' => $this->c_user_id,
            'real_name' => $this->c_real_name,
            'level' => $this->c_level,
            'expertise' => $this->c_expertise,
            'contact_info' => $this->c_contact_info,

            // 关联的用户信息
            // 使用 whenLoaded 避免 N+1 查询问题。
            // 只有在控制器中通过 with('user') 预加载了 user 关联时，这里才会包含 user 对象。
            'user' => new UserResource($this->whenLoaded('user')),

            // 时间戳字段
            // 模型中已定义 const CREATED_AT = 'create_at' 和 UPDATED_AT = 'update_at'
            'created_at' => $this->create_at ? $this->create_at->toDateTimeString() : null,
            'updated_at' => $this->update_at ? $this->update_at->toDateTimeString() : null,
        ];
    }
}
