<?php
// file: app/Models/ad/AdConfig.php

namespace App\Models\ad;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use App\Models\Users\UserModel; // 确保 UserModel 路径正确
use App\Models\ad\Team; // 确保 Team 模型路径正确
use App\Models\scenario\SceneConfig; // 确保 SceneConfig 模型路径正确
use Illuminate\Database\Eloquent\Casts\Attribute; // 【★★★ 第 1 处修改 ★★★】 引入 Attribute 类

class AdConfig extends Model
{
    use HasFactory;

    // --- 模型核心配置 ---
    protected $table = 'c_ad_configs';
    protected $primaryKey = 'c_id';
    public $incrementing = false;
    protected $keyType = 'string';
    const CREATED_AT = 'c_create_at';
    const UPDATED_AT = 'c_update_at';

    // --- 可批量赋值的字段 ---
    protected $fillable = [
        'c_id', 'c_drill_name', 'c_description', 'c_red_team_id', 'c_blue_team_id',
        'c_scene_config_id', 'c_scene_instance_id', 'c_status', 'c_start_time', 'c_end_time',
    ];

    // 【★★★ 第 2 处修改 ★★★】 添加 $appends 属性
    /**
     * 追加到模型数组或JSON形式的访问器。
     * 这会让 'referees_for_frontend' 这个自定义属性自动出现在JSON输出中。
     *
     * @var array
     */
    protected $appends = ['referees_for_frontend'];

    // --- 日期字段转换 ---
    // Laravel 7+ 推荐使用 $casts 属性来处理日期转换，这里保留你的 $dates 写法
    protected $dates = [
        'c_start_time', 'c_end_time', 'c_create_at', 'c_update_at',
    ];

    // --- 模型关联关系 ---

    public function redTeam()
    {
        return $this->belongsTo(Team::class, 'c_red_team_id', 'c_id');
    }

    public function blueTeam()
    {
        return $this->belongsTo(Team::class, 'c_blue_team_id', 'c_id');
    }

    public function sceneConfig()
    {
        return $this->belongsTo(SceneConfig::class, 'c_scene_config_id', 'c_config_id');
    }

    /**
     * 多对多关联到裁判 (UserModel)
     * 这个方法保持原样，供后端内部逻辑使用，它的结构是正确的。
     */
    public function referees()
    {
        return $this->belongsToMany(
            UserModel::class,
            'c_referees',          // 1. 中间表名
            'c_ad_config_id',      // 2. 中间表中，指向本模型 (AdConfig) 的外键名
            'c_user_id',           // 3. 中间表中，指向关联模型 (UserModel) 的外键名
            'c_id',                // 4. 本模型 (AdConfig) 的主键名
            'c_username'           // 5. 【关键】关联模型 (UserModel) 的主键名
        )
            // 【重要】withPivot 告诉 Eloquent 从中间表额外获取 'c_level' 字段
            ->withPivot('c_level');
    }


    // 【★★★ 第 3 处修改 ★★★】 添加一个专为前端服务的自定义访问器 (Accessor)
    /**
     * 定义一个名为 'referees_for_frontend' 的新属性。
     * 这个属性会生成前端所期望的扁平化 referees 数组结构。
     *
     * @return \Illuminate\Database\Eloquent\Casts\Attribute
     */
    protected function refereesForFrontend(): Attribute
    {
        return Attribute::make(
            get: function () {
                // 检查 referees 关系是否已经被加载，避免不必要的数据库查询
                if (! $this->relationLoaded('referees')) {
                    return [];
                }

                // 遍历原始的 referees 关系，并转换成前端需要的格式
                return $this->referees->map(function ($user) {
                    return [
                        'c_user_id' => $user->c_username, // 从 User 模型获取用户名
                        'c_level'   => $user->pivot->c_level,   // 从 pivot 对象获取裁判级别
                        // 如果前端还需要完整的 user 对象，可以在这里附加
                        // 'user' => $user,
                    ];
                });
            }
        );
    }
}
