<?php

namespace App\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

class UserResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @param  \Illuminate\Http\Request  $request
     * @return array
     */
    public function toArray($request) // 这里也没有 `: array`
    {
        // 这个文件负责将后端的 User 模型字段，映射为前端需要的格式
        // 虽然前端现在自己做了转换，但后端提供干净的 API 是更好的实践
        return [
            'id'           => $this->id, // 如果你的 User 模型有 id
            'c_username'   => $this->c_username,
            // 你可以在这里只返回需要的字段，而不是整个 User 模型
        ];
    }
}
