<?php

namespace App\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

class TeamResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @param  \Illuminate\Http\Request  $request
     * @return array
     */
    public function toArray($request) // 确保这里没有 `: array`
    {
        return [
            'c_id'          => $this->id,
            'c_name'        => $this->c_name,
            'c_color'       => $this->c_color,
            'c_description' => $this->c_description,
            'score'         => $this->score ?? 0,
            // 关键：使用 UserResource::collection 来转换每一个 member 对象
            // whenLoaded 可以防止在没有预加载关联时出现 N+1 问题
            'members'       => UserResource::collection($this->whenLoaded('members')),
        ];
    }
}
