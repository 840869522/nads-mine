<?php

namespace App\Models\scenario;

use Illuminate\Database\Eloquent\Model;

class SceneContainerInstanceModel extends Model
{
    /**
     * 与模型关联的表名。
     *
     * @var string
     */
    protected $table = 'c_scene_container_instances';

    /**
     * 与表关联的主键。
     *
     * @var string
     */
    protected $primaryKey = 'c_container_id';

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

    /**
     * 可以批量赋值的属性。
     *
     * @var array
     */
    protected $fillable = [
        'c_container_id',
        'c_scene_instances_id',
        'c_container_name',
        'c_ip',
        'c_flag'
    ];

    /**
     * 获取此容器实例所属的场景实例。
     */
    public function sceneInstance()
    {
        return $this->belongsTo(SceneInstanceModel::class, 'c_scene_instances_id', 'c_scene_instances_id');
    }
}
