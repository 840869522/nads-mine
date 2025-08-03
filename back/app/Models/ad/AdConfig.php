<?php
// file: app/Models/ad/AdConfig.php

namespace App\Models\ad;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use App\Models\Users\UserModel;
use App\Models\ad\Team;
use App\Models\scenario\SceneConfig;
use Illuminate\Database\Eloquent\Casts\Attribute;

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

    /**
     * 可以被批量赋值的属性。
     * ★★★ 这是唯一的、必需的修改 ★★★
     * 将 'c_scene_instance_id' 和 'c_status' 添加到此数组中，
     * 以允许 AdController 中的 save() 方法能够成功更新它们。
     */
    protected $fillable = [
        'c_id',
        'c_drill_name',
        'c_description',
        'c_red_team_id',
        'c_blue_team_id',
        'c_scene_config_id',
        'c_scene_instance_id', // <--- 修正点：已添加
        'c_status',            // <--- 修正点：已添加
        'c_start_time',
        'c_end_time',
    ];

    // --- 裁判相关的访问器 (保持原样) ---
    protected $appends = ['referees_for_frontend'];

    // --- 日期字段转换 (保持原样) ---
    protected $dates = [
        'c_start_time', 'c_end_time', 'c_create_at', 'c_update_at',
    ];

    // --- 模型关联关系 (保持原样) ---

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

    public function referees()
    {
        return $this->belongsToMany(
            UserModel::class,
            'c_referees',
            'c_ad_config_id',
            'c_user_id',
            'c_id',
            'c_username'
        )->withPivot('c_level');
    }

    // --- 裁判相关的自定义访问器 (保持原样) ---
    protected function refereesForFrontend(): Attribute
    {
        return Attribute::make(
            get: function () {
                if (! $this->relationLoaded('referees')) {
                    return [];
                }
                return $this->referees->map(function ($user) {
                    return [
                        'c_user_id' => $user->c_username,
                        'c_level'   => $user->pivot->c_level,
                    ];
                });
            }
        );
    }
}
