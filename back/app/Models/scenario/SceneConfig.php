<?php

namespace App\Models\scenario;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SceneConfig extends Model
{
    use HasFactory;

    /**
     * 【修正】手动指定与模型关联的、正确的小写表名。
     * @var string
     */
    protected $table = 'c_scene_configs';

    /**
     * 【修正】手动指定正确的主键字段名。
     * @var string
     */
    protected $primaryKey = 'c_config_id';

    /**
     * 【修正】明确告知 Laravel 时间戳字段的自定义名称。
     * 这是解决 "Unknown column 'created_at'" 错误的关键。
     */
    const CREATED_AT = 'c_created_at';
    const UPDATED_AT = 'c_updated_at';

    /**
     * 启用 Eloquent 的自动时间戳管理。
     * 因为我们定义了上面的常量，所以 Laravel 会自动管理 c_created_at 和 c_updated_at。
     * @var bool
     */
    public $timestamps = true;

    /**
     * 【修正】定义可批量赋值的属性，所有字段名都已更新为 c_ 前缀。
     * @var array<int, string>
     */
    protected $fillable = [
        'c_name',
        'c_description',
        'c_scene', // 你的数据库字段是 c_scene (json类型)
    ];

    /**
     * 【修正】定义属性类型转换，将 c_scene 字段自动转换为数组/对象。
     * @var array<string, string>
     */
    protected $casts = [
        'c_scene' => 'array',
    ];

    // 如果 SceneConfig 有任何关联关系，可以在这里定义
    // 例如，一个场景配置可以被多个攻防演练配置使用
    // public function adConfigs()
    // {
    //     return $this->hasMany(AdConfig::class, 'c_scene_config_id', 'c_config_id');
    // }
}
