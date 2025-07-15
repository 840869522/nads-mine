<?php
// file: app/Http/Resources/AdConfigResource.php

namespace App\Http\Resources;

// 你可能不再需要 AdRefereeResource，因为我们直接在模型中格式化了数据
// use App\Http\Resources\AdRefereeResource;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * 【最终修复：统一前后端数据合同】
 * 将所有返回给前端的 JSON 键名，修改为前端期望的、带 c_ 前缀的格式。
 */
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
            // --- AdConfig 自身属性 (保持不变，格式正确) ---
            'c_id'                => $this->c_id,
            'c_drill_name'        => $this->c_drill_name,
            'c_description'       => $this->c_description,
            'c_status'            => $this->c_status,
            'c_start_time'        => $this->c_start_time ? $this->c_start_time->toDateTimeString() : null,
            'c_end_time'          => $this->c_end_time ? $this->c_end_time->toDateTimeString() : null,
            'c_create_at'         => $this->c_create_at ? $this->c_create_at->toDateTimeString() : null,
            'c_update_at'         => $this->c_update_at ? $this->c_update_at->toDateTimeString() : null,
            'c_red_team_id'       => $this->c_red_team_id,
            'c_blue_team_id'      => $this->c_blue_team_id,
            'c_scene_config_id'   => $this->c_scene_config_id,
            'c_scene_instance_id' => $this->c_scene_instance_id,

            // --- 关联对象 (保持不变，格式正确) ---
            // 注意：这些键名没有 c_ 前缀，但前端的辅助函数 (findTeamNameById 等) 是基于 ID 查找的，所以这里是正确的。
            // 如果前端需要，也可以在这里直接返回 name 等信息。
            // 'red_team_name' => $this->whenLoaded('redTeam', fn() => $this->redTeam->c_name),
            // 'blue_team_name' => $this->whenLoaded('blueTeam', fn() => $this->blueTeam->c_name),

            // 【★★★ 核心修复 ★★★】
            // 之前：'referees' => AdRefereeResource::collection($this->whenLoaded('referees')),
            //
            // 现在：直接使用我们在 AdConfig 模型中创建的、为前端格式化好的 'referees_for_frontend' 访问器。
            // 最终输出的 JSON 键名仍然是 'referees'，以匹配前端的期望，无需修改前端代码。
            'referees'            => $this->referees_for_frontend,
        ];
    }
}
