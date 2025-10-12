<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use App\Http\Resources\RefereeResource;

class AdConfigResource extends JsonResource
{
    /**
     * 将资源转换为数组。
     *
     * @param  Request  $request
     * @return array
     */
    public function toArray($request): array
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
            'c_scene_config_id'   => $this->c_scene_config_id,
            'c_scene_instance_id' => $this->c_scene_instance_id,

            // --- 关联关系 ---

            // 使用闭包手动构建 sceneConfig 对象，以确保 topology_json 字段存在。
            'sceneConfig' => $this->whenLoaded('sceneConfig', function () {
                // 添加一个健壮性检查，以防 sceneConfig 关系本身为 null
                if (!$this->sceneConfig) {
                    return null;
                }

                return [
                    'c_config_id'   => $this->sceneConfig->c_config_id,
                    'c_name'        => $this->sceneConfig->c_name,

                    // 将后端的 c_scene 字段(JSON) 转换为前端期望的 topology_json 字段
                    // 并处理 c_scene 可能已经是数组或仍是字符串的两种情况
                    'topology_json' => is_string($this->sceneConfig->c_scene)
                        ? json_decode($this->sceneConfig->c_scene, true)
                        : $this->sceneConfig->c_scene,
                ];
            }),

            // 裁判信息
            'referees' => RefereeResource::collection($this->whenLoaded('referees')),
        ];
    }
}
