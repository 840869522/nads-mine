<?php

namespace App\Models\scenario;

use Illuminate\Database\Eloquent\Model;

class SceneInstanceModel extends Model
{
    /**
     * 与模型关联的表名。
     *
     * @var string
     */
    protected $table = 'c_scene_instances';

    /**
     * 与表关联的主键。
     *
     * @var string
     */
    protected $primaryKey = 'c_scene_instances_id';

    /**
     * 主键是否为自增。
     *
     * @var bool
     */
    public $incrementing = false;

    /**
     * 主键的“类型”。
     *
     * @var string
     */
    protected $keyType = 'string';

    /**
     * 该模型是否应被戳记时间。
     *
     * @var bool
     */
    public $timestamps = true;

    // 可以在这里定义与其他模型的关联
}
