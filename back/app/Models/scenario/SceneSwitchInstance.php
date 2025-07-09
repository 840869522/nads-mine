<?php

namespace App\Models\scenario;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SceneSwitchInstance extends Model
{
    use HasFactory;

    protected $table = 'c_scene_switch_instances';
    public $timestamps = false;

    // 由于是复合主键，Eloquent 的标准主键设置不完全适用。
    // 我们通过 $fillable 属性确保数据可以被正确创建。
    protected $fillable = [
        'c_switch_name',
        'c_scene_instances_id',
    ];

    /**
     * 定义与 SceneInstance 模型的关联关系（一个交换机实例属于一个场景实例）。
     */
    public function sceneInstance()
    {
        return $this->belongsTo(SceneInstance::class, 'c_scene_instances_id', 'c_scene_instances_id');
    }
}