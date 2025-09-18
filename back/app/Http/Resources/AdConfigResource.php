<?php
// file: app/Http/Resources/AdConfigResource.php

namespace App\Http\Resources;

// ★ 1. 移除 Illuminate\Http\Request 的 use 语句，因为方法签名中不再需要它
// use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use App\Http\Resources\TeamResource;
use App\Http\Resources\UserResource;

class AdConfigResource extends JsonResource
{
    /**
     * 将资源转换为数组。
     *
     * @param  \Illuminate\Http\Request  $request
     * @return array
     */
    // ★★★ 2. 核心修复：移除方法签名中的类型提示 ★★★
    public function toArray($request)
    {
        return [
            // --- AdConfig 自身属性 ---
            'c_id'                => $this->c_id,
            'c_drill_name'        => $this->c_drill_name,
            'c_description'       => $this->c_description,
            'c_status'            => $this->c_status,
            'c_start_time'        => $this->c_start_time ? $this->c_start_time->toDateTimeString() : null,
            'c_end_time'          => $this->c_end_time ? $this->c_end_time->toDateTimeString() : null,
            'c_create_at'         => $this->c_create_at->toDateTimeString(),
            'c_update_at'         => $this->c_update_at->toDateTimeString(),
            'c_red_team_id'       => $this->c_red_team_id,
            'c_blue_team_id'      => $this->c_blue_team_id,
            'c_scene_config_id'   => $this->c_scene_config_id,
            'c_scene_instance_id' => $this->c_scene_instance_id,

            // --- 关联关系 ---
            'referees' => UserResource::collection($this->whenLoaded('referees')),
            'redTeam' => new TeamResource($this->whenLoaded('redTeam')),
            'blueTeam' => new TeamResource($this->whenLoaded('blueTeam')),
            'sceneConfig' => $this->whenLoaded('sceneConfig', function () {
                return [
                    'c_config_id'   => $this->sceneConfig->c_config_id,
                    'c_name'        => $this->sceneConfig->c_name,
                    'topology_json' => $this->sceneConfig->c_scene,
                ];
            }),
        ];
    }
}
