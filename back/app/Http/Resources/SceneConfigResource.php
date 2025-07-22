<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SceneConfigResource extends JsonResource
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
            'id' => $this->c_config_id,
            'name' => $this->c_name,
            'description' => $this->c_description,
            'scene_details' => $this->c_scene,

            // 时间戳字段
            // 【关键修改】在调用 toDateTimeString() 之前，先检查属性值是否为 null。
            'created_at' => $this->c_created_at ? $this->c_created_at->toDateTimeString() : null,
            'updated_at' => $this->c_updated_at ? $this->c_updated_at->toDateTimeString() : null, // <-- 第39行的修复
        ];
    }
}
