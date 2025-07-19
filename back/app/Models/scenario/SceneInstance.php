<?php

namespace App\Models\scenario;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class SceneInstance extends Model
{
    use HasFactory;

    protected $table = 'c_scene_instances';
    protected $primaryKey = 'c_scene_instances_id';
    public $incrementing = false;
    protected $keyType = 'string';
    const CREATED_AT = 'c_runtime';
    const UPDATED_AT = null;

    protected $fillable = [
        'c_scene_instances_id',
        'c_config_id',
        'c_username',
        'c_status',
    ];

    protected static function boot()
    {
        parent::boot();
        static::creating(function ($model) {
            if (empty($model->{$model->getKeyName()})) {
                $model->{$model->getKeyName()} = Str::uuid()->toString();
            }
        });
    }

    /**
     * 定义与 SceneConfig 模型的关联关系。
     */
    public function sceneConfig()
    {
        return $this->belongsTo(SceneConfig::class, 'c_config_id', 'c_config_id')
            ->withDefault([
                'c_name' => '场景已删除或未知'
            ]);
    }

    /**
     * 定义一个“场景实例”拥有多个“容器实例”的“一对多”关联关系。
     * @return \Illuminate\Database\Eloquent\Relations\HasMany
     */
    public function containers()
    {
        return $this->hasMany(SceneContainerInstance::class, 'c_scene_instances_id', 'c_scene_instances_id');
    }

    /**
     * 定义一个“场景实例”拥有多个“交换机实例”的“一对多”关联关系。
     * @return \Illuminate\Database\Eloquent\Relations\HasMany
     */
    public function switches()
    {
        return $this->hasMany(SceneSwitchInstance::class, 'c_scene_instances_id', 'c_scene_instances_id');
    }
    
    /**
     * ★★★ 在这里添加这个方法 ★★★
     * 定义一个“场景实例”拥有多个“虚拟机实例”的“一对多”关联关系。
     * * @return \Illuminate\Database\Eloquent\Relations\HasMany
     */
    public function vms()
    {
        // 参数1: 关联的模型类: SceneVmInstance::class
        // 参数2: SceneVmInstance 表中的外键: 'c_scene_instances_id'
        // 参数3: SceneInstance (当前模型) 表中的主键: 'c_scene_instances_id'
        return $this->hasMany(SceneVmInstance::class, 'c_scene_instances_id', 'c_scene_instances_id');
    }
}