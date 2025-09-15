<?php
// file: app/Http-Resources/AdConfigResource.php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
// ★ 确保引入了 TeamResource ★
use App\Http\Resources\TeamResource;

class AdConfigResource extends JsonResource
{
    /**
     * 将资源转换为数组。
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

            // --- 裁判信息 ---
            'referees'            => $this->referees_for_frontend,

            // ★★★ 核心修复 ★★★
            // 使用 $this->whenLoaded() 来安全地包含已加载的关联关系。
            // 当 Controller 中的 with('redTeam') 加载了 redTeam 关系后，
            // 这里就会使用 TeamResource 将其转换为 JSON 对象并包含进来。
            // 如果关系没有被加载，这个键就会被自动忽略，非常安全。
            'redTeam' => new TeamResource($this->whenLoaded('redTeam')),
            'blueTeam' => new TeamResource($this->whenLoaded('blueTeam')),

            // 同样，为 sceneConfig 也创建一个简单的 Resource 或直接返回
            'sceneConfig' => $this->whenLoaded('sceneConfig', function () {
                return [
                    'c_config_id' => $this->sceneConfig->c_config_id,
                    'c_name' => $this->sceneConfig->c_name,
                ];
            }),
        ];
    }
}
