<?php

namespace App\Http\Resources;

// use Illuminate\Http\Request; // 这一行现在不是必需的，可以保留也可以删除
use Illuminate\Http\Resources\Json\JsonResource;

class TeamResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @param  \Illuminate\Http\Request  $request  // 在文档注释中指明类型是好习惯
     * @return array<string, mixed>
     */
    public function toArray($request): array // <--- 移除了参数的类型提示
    {
        // 'this' 关键字在这里指向传递进来的 Team 模型实例
        return [
            // 将模型的属性映射到你希望前端接收到的 JSON 键名
            'id' => $this->id,
            'name' => $this->name,
            'color' => $this->color,
            'description' => $this->description,
            'logo_url' => $this->logo_url,
            'captain_id' => $this->captain_id,
            'is_public' => $this->is_public,
            'status' => $this->status,
            'created_at' => $this->created_at->toDateTimeString(), // 格式化日期
            'updated_at' => $this->updated_at->toDateTimeString(),

            // 你还可以添加关联数据或计算属性
            // 'members_count' 会在控制器中使用了 withCount('members') 时存在
            'member_count' => $this->when(isset($this->members_count), $this->members_count),

            // 如果需要包含队长信息 (前提是控制器中使用了 ->load('captain'))
            // 'captain' => new UserResource($this->whenLoaded('captain')),
        ];
    }
}
