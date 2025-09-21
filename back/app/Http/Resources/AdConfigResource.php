<?php
// file: app/Http/Resources/AdConfigResource.php

namespace App\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;
use App\Http\Resources\TeamResource;
use App\Http\Resources\RefereeResource;

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
            'c_type'              => $this->c_type,
            'c_show_attack'       => $this->c_show_attack,
            'c_create_at'         => $this->c_create_at->toDateTimeString(),
            'c_update_at'         => $this->c_update_at->toDateTimeString(),
            'c_red_team_id'       => $this->c_red_team_id,
            'c_blue_team_id'      => $this->c_blue_team_id,
            'c_scene_config_id'   => $this->c_scene_config_id,
            'c_scene_instance_id' => $this->c_scene_instance_id,

            // --- 关联关系 ---
            // 使用 whenLoaded 可以防止在未加载关联关系时出现N+1查询问题
            'redTeam' => new TeamResource($this->whenLoaded('redTeam')),
            'blueTeam' => new TeamResource($this->whenLoaded('blueTeam')),

            // ★★★ 核心修复 ★★★
            // 1. 使用 whenLoaded 确保只有在 sceneConfig 被预加载时才执行闭包
            // 2. 取消 topology_json 的注释
            // 3. 增加健壮性检查，处理 c_scene 可能为 JSON 字符串或数组的情况
            'sceneConfig' => $this->whenLoaded('sceneConfig', function () {
                // 增加一个检查，以防 sceneConfig 为 null
                if (!$this->sceneConfig) {
                    return null;
                }

                return [
                    'c_config_id'   => $this->sceneConfig->c_config_id,
                    'c_name'        => $this->sceneConfig->c_name,

                    // 将后端的 c_scene 字段转换为前端期望的 topology_json 字段
                    'topology_json' => is_string($this->sceneConfig->c_scene)
                                       ? json_decode($this->sceneConfig->c_scene, true)
                                       : $this->sceneConfig->c_scene,
                ];
            }),

            'referees' => RefereeResource::collection($this->whenLoaded('referees')),
        ];
    }
}
