<?php
// file: app/Http/Resources/AdConfigResource.php

namespace App\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;
use App\Http\Resources\TeamResource;
use App\Http\Resources\RefereeResource; // ★★★ 引入新的 RefereeResource ★★★

class AdConfigResource extends JsonResource
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
            'redTeam' => new TeamResource($this->whenLoaded('redTeam')),
            'blueTeam' => new TeamResource($this->whenLoaded('blueTeam')),
            'sceneConfig' => $this->whenLoaded('sceneConfig', function () {
                return [
                    'c_config_id'   => $this->sceneConfig->c_config_id,
                    'c_name'        => $this->sceneConfig->c_name,
                    // 如果需要，可以包含其他字段
                    // 'topology_json' => $this->sceneConfig->c_scene,
                ];
            }),

            // ★★★ 核心修复：使用 RefereeResource::collection 来格式化裁判列表 ★★★
            'referees' => RefereeResource::collection($this->whenLoaded('referees')),
        ];
    }
}
