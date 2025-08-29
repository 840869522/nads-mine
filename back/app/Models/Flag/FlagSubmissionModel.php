<?php

namespace App\Models\Flag;

use Illuminate\Database\Eloquent\Model;
use App\Models\scenario\SceneContainerInstanceModel;
use App\Models\scenario\SceneVmInstanceModel;

class FlagSubmissionModel extends Model
{
    /**
     * 与模型关联的表名。
     *
     * @var string
     */
    protected $table = 'c_flag_submission';

    /**
     * 与表关联的主键。
     *
     * @var string
     */
    protected $primaryKey = 'c_submission_id';

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
        'c_submission_id',
        'c_username',
        'c_scene_instances_id',
        'c_container_instance_id',
        'c_vm_instance_id',
        'c_submitted_flag',
        'c_is_correct',
        'c_points_earned',
        'c_submitted_at',
        'c_attempt_count'
    ];

    /**
     * 获取提交此 Flag 的容器实例。
     */
    public function containerInstance()
    {
        return $this->belongsTo(SceneContainerInstanceModel::class, 'c_container_instance_id', 'c_container_id');
    }

    /**
     * 获取提交此 Flag 的虚拟机实例。
     */
    public function vmInstance()
    {
        return $this->belongsTo(SceneVmInstanceModel::class, 'c_vm_instance_id', 'c_vm_id');
    }
}
