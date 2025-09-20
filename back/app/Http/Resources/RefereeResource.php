<?php

namespace App\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;
use App\Http\Resources\UserResource; // 确保 UserResource 存在且路径正确

class RefereeResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @param  \Illuminate\Http\Request  $request
     * @return array
     */
    public function toArray($request)
    {
        // $this 指向一个 Referee 模型实例
        return [
            'c_level' => $this->c_level,
            // 使用 whenLoaded 安全地加载嵌套的 user 关系
            // 它会使用 UserResource 来格式化用户信息
            'user' => new UserResource($this->whenLoaded('user')),
        ];
    }
}
