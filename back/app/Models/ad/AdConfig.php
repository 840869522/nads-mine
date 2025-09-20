<?php
// file: app/Models/ad/AdConfig.php

namespace App\Models\ad;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use App\Models\Users\UserModel;
use App\Models\ad\Team;
use App\Models\scenario\SceneConfig;
// ★★★ 1. 引入 HasMany 和 Referee 模型 ★★★
use Illuminate\Database\Eloquent\Relations\HasMany;
use App\Models\ad\Referee;

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
     */
    protected $fillable = [
        'c_id',
        'c_drill_name',
        'c_description',
        'c_red_team_id',
        'c_blue_team_id',
        'c_scene_config_id',
        'c_scene_instance_id',
        'c_status',
        'c_start_time',
        'c_end_time',
    ];

    // --- 日期字段转换 ---
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
     * 定义一个演练配置 (AdConfig) 与其裁判指派记录 (Referee) 的关系。
     * 这是一个 "一对多" (HasMany) 关系：一个演练可以有多条裁判指派记录。
     *
     * @return \Illuminate\Database\Eloquent\Relations\HasMany
     */
    public function referees(): HasMany
    {
        return $this->hasMany(Referee::class, 'c_ad_config_id', 'c_id');
    }
}
