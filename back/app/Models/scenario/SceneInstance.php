<?php

namespace App\Models\scenario;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str; // 引入 Str 以便使用 UUID

class SceneInstance extends Model
{
    use HasFactory;

    /**
     * 手动指定模型关联的数据表名。
     * @var string
     */
    protected $table = 'c_scene_instances';

    /**
     * 手动指定主键。
     * @var string
     */
    protected $primaryKey = 'c_scene_instances_id';

    /**
     * 主键不是自增整数。
     * @var bool
     */
    public $incrementing = false;

    /**
     * 主键的类型是字符串 (UUID)。
     * @var string
     */
    protected $keyType = 'string';

    /**
     * 定义时间戳字段的名称。
     */
    const CREATED_AT = 'c_runtime';
    const UPDATED_AT = null; // 数据库中没有更新时间字段

    /**
     * 可批量赋值的属性。
     * @var array<int, string>
     */
    protected $fillable = [
        'c_scene_instances_id',
        'c_config_id',
        'c_username',
        'c_status',
        // 注意：c_runtime 会在创建时自动填充
    ];

    /**
     * 为模型创建事件添加一个引导方法，用于自动生成 UUID。
     */
    protected static function boot()
    {
        parent::boot();

        static::creating(function ($model) {
            // 在创建新记录时，如果主键为空，则自动为其生成一个 UUID
            if (empty($model->{$model->getKeyName()})) {
                $model->{$model->getKeyName()} = Str::uuid()->toString();
            }
        });
    }
}
