<?php

namespace App\Models\scenario;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * App\Models\scenario\SceneConfig
 *
 * @property int $c_config_id 主键 场景id
 * @property string $c_name 场景名称
 * @property string|null $c_description 场景描述
 * @property \Illuminate\Support\Carbon|null $c_created_at 创建时间
 * @property array|null $c_scene 场景json
 */
class SceneConfig extends Model
{
    use HasFactory;

    /**
     * 【修正】手动指定模型关联的数据表名。
     * Laravel 默认会使用类名的复数蛇形命名 (scene_configs)，
     * 这里我们精确匹配数据库中的表名 `c_scene_configs`。
     * @var string
     */
    protected $table = 'c_scene_configs';

    /**
     * 【修正】手动指定主键。
     * Laravel 默认主键为 `id`，这里我们指定为 `c_config_id`。
     * @var string
     */
    protected $primaryKey = 'c_config_id';

    /**
     * 【修正】由于数据库中的时间戳字段名为 `c_created_at` 且没有 `updated_at` 字段，
     * 需要明确告知 Eloquent 如何处理时间戳。
     */
    const CREATED_AT = 'c_created_at';
    const UPDATED_AT = null; // 数据库中没有更新时间字段，设为 null

    /**
     * 指示模型是否自动维护时间戳。
     * 因为我们定义了 CREATED_AT，所以这里保持 true。
     * @var bool
     */
    public $timestamps = true;


    /**
     * 【修正】可批量赋值的属性。
     * 这里的字段名需要与数据库表的列名完全对应。
     * @var array<int, string>
     */
    protected $fillable = [
        'c_name',
        'c_description',
        'c_scene',
    ];

    /**
     * 【修正】应进行类型转换的属性。
     * 将数据库中的 JSON 字段 `c_scene` 自动转换为 PHP 数组。
     * @var array<string, string>
     */
    protected $casts = [
        'c_scene' => 'array',
        'c_created_at' => 'datetime', // 推荐为时间戳字段添加转换
    ];
}
