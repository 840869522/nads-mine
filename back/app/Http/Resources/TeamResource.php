<?php
// file: app/Http-Resources/TeamResource.php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
// ★ 确保引入了 UserResource ★
use App\Http\Resources\UserResource;

class TeamResource extends JsonResource
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
            // ★ 修复 1: 使用正确的模型属性名 (c_id 而不是 id)
            'c_id'          => $this->c_id,
            'c_name'        => $this->c_name,
            'c_color'       => $this->c_color,
            'c_description' => $this->c_description,
            'score'         => $this->score ?? 0,

            // ★ 修复 2: 使用正确的关联关系名 'users' (与 Team 模型中定义的一致)
            // 当 Team 的 users 关系被加载时，使用 UserResource::collection 来转换它们。
            // 这会生成一个 users 数组，每个元素都是 UserResource 定义的格式。
            'users'         => UserResource::collection($this->whenLoaded('users')),
        ];
    }
}
