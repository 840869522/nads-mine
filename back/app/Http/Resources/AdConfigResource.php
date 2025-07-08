<?php

namespace App\Http\Resources;

// 确保这些 Resource 类已经被正确 use
use App\Http\Resources\TeamResource;
use App\Http\Resources\SceneConfigResource;
use App\Http\Resources\SceneInstanceResource; // 假设的场景实例资源
use App\Http\Resources\AdRefereeResource;       // 假设的裁判资源
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AdConfigResource extends JsonResource
{
    /**
     * 将资源转换为数组。
     *
     * @param  \Illuminate\Http\Request  $request
     * @return array<string, mixed>
     */
    public function toArray($request)
    {
        // $this->resource 指向传递进来的 AdConfig 模型实例
        return [
            // AdConfig 自身的核心字段
            'id' => $this->id,
            'drill_name' => $this->drill_name,
            'description' => $this->description,
            'status' => $this->status,

            // 时间字段
            'start_time' => $this->start_time ? $this->start_time : null,
            'end_time' => $this->end_time ? $this->end_time : null,
            'created_at' => $this->created_at ? $this->created_at->toDateTimeString() : null,
            'updated_at' => $this->updated_at ? $this->updated_at->toDateTimeString() : null,

            // 关联关系ID，方便前端直接使用
            'red_team_id' => $this->red_team_id,
            'blue_team_id' => $this->blue_team_id,
            'scene_config_id' => $this->scene_config_id,

            // vvvvvvvvvv   新增的两行   vvvvvvvvvv
            'scene_instance_id' => $this->scene_instance_id, // 新增：直接返回场景实例ID
            // ^^^^^^^^^^   新增的两行   ^^^^^^^^^^

            // 完整的关联对象，只有在控制器中通过 with() 预加载了才会包含
            'red_team' => new TeamResource($this->whenLoaded('redTeam')),
            'blue_team' => new TeamResource($this->whenLoaded('blueTeam')),
            'scene_config' => new SceneConfigResource($this->whenLoaded('sceneConfig')),

            // vvvvvvvvvv   新增的两行   vvvvvvvvvv
            'scene_instance' => new SceneInstanceResource($this->whenLoaded('sceneInstance')), // 新增：返回预加载的场景实例对象
            // ^^^^^^^^^^   新增的两行   ^^^^^^^^^^

            'referees' => AdRefereeResource::collection($this->whenLoaded('referees')),
        ];
    }
}
