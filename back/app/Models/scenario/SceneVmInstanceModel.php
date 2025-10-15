<?php

namespace App\Models\scenario;

use Illuminate\Database\Eloquent\Model;

class SceneVmInstanceModel extends Model
{
    /**
     * 与模型关联的表名。
     *
     * @var string
     */
    protected $table = 'c_scene_vm_instances';

    /**
     * 与表关联的主键。
     *
     * @var string
     */
    protected $primaryKey = 'c_vm_id';

    /**
     * 主键是否为自增。
     *
     * @var bool
     */
    public $incrementing = true;

    /**
     * 主键的“类型”。
     *
     * @var string
     */
    protected $keyType = 'int';

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
        'c_vm_id',
        'c_scene_instances_id',
        'c_vm_name',
        'c_ip',
        'c_flag',
        'c_team_id'
    ];

    /**
     * 获取此虚拟机实例所属的场景实例。
     */
    public function sceneInstance()
    {
        return $this->belongsTo(SceneInstanceModel::class, 'c_scene_instances_id', 'c_scene_instances_id');
    }
}
