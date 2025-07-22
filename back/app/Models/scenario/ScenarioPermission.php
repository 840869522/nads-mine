<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\Pivot;

/**
 * Class ScenarioPermission
 *
 * 这是一个透视模型 (Pivot Model)，代表 c_scene_users 中间表。
 * 它继承自 Illuminate\Database\Eloquent\Relations\Pivot。
 */
class ScenarioPermission extends Pivot
{
    /**
     * 与模型关联的表名。
     *
     * @var string
     */
    protected $table = 'c_scene_users';

    /**
     * 该模型的主键。
     *
     * @var string
     */
    protected $primaryKey = 'id';

    /**
     * 指示主键是否是自增的。
     *
     * @var bool
     */
    public $incrementing = true;

    /**
     * 指示模型是否应被时间戳。
     * c_scene_users 表中有一个 created_at 字段。
     */
    public $timestamps = true;
    const CREATED_AT = 'created_at'; // 字段名是 created_at
    const UPDATED_AT = null; // 没有 updated_at 字段

    /**
     * 可以被批量赋值的属性。
     *
     * @var array
     */
    protected $fillable = [
        'c_scene_configs_id',
        'c_username',
    ];

    // 如果您想在这个模型上定义与 ScenarioConfig 或 User 的关联，
    // 您可以使用 belongsTo 关系。
    // 这在某些高级查询中可能有用，但对于基本的权限管理不是必需的。

    public function scenario()
    {
        return $this->belongsTo(ScenarioConfig::class, 'c_scene_configs_id', 'c_config_id');
    }

    public function user()
    {
        return $this->belongsTo(UserModel::class, 'c_username', 'c_username');
    }
}
