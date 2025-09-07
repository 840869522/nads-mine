<?php

namespace App\Models\scenario;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * 虚拟机实例与场景实例的关联模型
 *
 * @property int $c_vm_id 主键,自增ID
 * @property string $c_vm_name 虚拟机唯一名称
 * @property string $c_scene_instances_id 关联的场景实例ID (外键)
 * @property string|null $c_ip 虚拟机IP地址
 * @property string|null $c_flag 靶机flag
 */
class SceneVmInstance extends Model
{
    use HasFactory;

    /**
     * 与模型关联的表名
     */
    protected $table = 'c_scene_vm_instances';

    /**
     * 表的主键
     */
    protected $primaryKey = 'c_vm_id';

    /**
     * 指示主键是否是自增的
     */
    public $incrementing = true;

    /**
     * 主键的类型
     */
    protected $keyType = 'int';

    /**
     * 指示模型是否应被记入时间戳
     */
    public $timestamps = false;

    /**
     * 可批量赋值的属性
     */
    protected $fillable = [
        'c_vm_name',
        'c_scene_instances_id',
        'c_ip',
        'c_flag',
    ];

    /**
     * 定义与 SceneInstance 模型的关联关系
     */
    public function sceneInstance(): BelongsTo
    {
        return $this->belongsTo(SceneInstance::class, 'c_scene_instances_id', 'c_scene_instances_id');
    }
}
