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
     * 【在这里添加这个方法】
     * * 定义一个“场景实例”拥有多个“容器实例”的“一对多”关联关系。
     * 当控制器中调用 $instance->load('containers') 时，Laravel会查找并执行此方法。
     *
     * @return \Illuminate\Database\Eloquent\Relations\HasMany
     */
    public function containers()
    {
        // 这个方法的参数是：
        // 1. 关联的模型类: SceneContainerInstance::class
        // 2. 关联表中的外键: 'c_scene_instances_id' (在 c_scene_container_instances 表中)
        // 3. 本地表中的主键: 'c_scene_instances_id' (在 c_scene_instances 表中)
        // 您的命名非常规范，所以外键和主键名是一样的。
        return $this->hasMany(SceneContainerInstance::class, 'c_scene_instances_id', 'c_scene_instances_id');
    }
    /**
     * 【新增的关联方法】
     * 定义一个“场景实例”拥有多个“交换机实例”的“一对多”关联关系。
     *
     * @return \Illuminate\Database\Eloquent\Relations\HasMany
     */
    public function switches()
    {
        return $this->hasMany(SceneSwitchInstance::class, 'c_scene_instances_id', 'c_scene_instances_id');
    }
}
