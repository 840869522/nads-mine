<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

// 导入其他需要的 Resource 类
use App\Http\Resources\SceneConfigResource;
use App\Http\Resources\SceneContainerInstanceResource; // 注意：这是下一步可能需要创建的类

/**
 * API Resource for the SceneInstance model.
 * 定义 SceneInstance 模型如何转换为 JSON。
 */
class SceneInstanceResource extends JsonResource
{
    /**
     * 将资源转换为数组。
     *
     * @param  \Illuminate\Http\Request  $request
     * @return array
     */
    public function toArray($request) // 遵循兼容性原则，不添加返回类型 :array
    {
        // `$this` 指向被转换的 SceneInstance 模型实例
        return [
            // 主键 (string, UUID)
            'id' => $this->c_scene_instances_id,

            // 核心业务字段
            'status' => $this->c_status,
            'username' => $this->c_username,
            'scene_config_id' => $this->c_config_id, // 直接暴露外键，方便前端使用

            // 时间戳 (模型中 CREATED_AT 指向 c_runtime)
            // 模型中 UPDATED_AT 为 null，所以这里不包含 updated_at 字段
            'runtime' => $this->c_runtime ? $this->c_runtime->toDateTimeString() : null,

            // 关联关系：使用 whenLoaded 避免 N+1 查询问题
            // 'scene_config' => 包含了该实例所使用的场景配置的详细信息
            'scene_config' => new SceneConfigResource($this->whenLoaded('sceneConfig')),

            // 'containers' => 包含了该场景实例下的所有容器实例列表
            'containers' => SceneContainerInstanceResource::collection($this->whenLoaded('containers')),
        ];
    }
}
