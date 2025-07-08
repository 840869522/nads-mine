<?php

namespace App\Models\ad;


use App\Models\ad\Team;
use App\Models\scenario\SceneConfig;
use App\Models\Users\UserModel; // 'App\Models\Users' 已经被移除，因为它确实未被使用
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class AdConfig extends Model
{
    use HasFactory;

    // ... (类的属性 $table, $fillable 等无需任何改动)
    protected $table = 'c_ad_configs';
    public $incrementing = false;
    protected $keyType = 'string';
    protected $fillable = [
        'id', 'drill_name', 'description', 'red_team_id', 'blue_team_id',
        'scene_config_id', 'scene_instance_id', 'status', 'start_time', 'end_time',
    ];

    /**
     * 定义与红队的关系。
     * 通过魔术属性访问: $adConfig->redTeam
     *
     * @return BelongsTo
     */
    public function redTeam(): BelongsTo
    {
        return $this->belongsTo(Team::class, 'red_team_id', 'c_id');
    }

    /**
     * 定义与蓝队的关系。
     * 通过魔术属性访问: $adConfig->blueTeam
     *
     * @return BelongsTo
     */
    public function blueTeam(): BelongsTo
    {
        return $this->belongsTo(Team::class, 'blue_team_id', 'c_id');
    }

    /**
     * 定义与场景配置的关系。
     * 通过魔术属性访问: $adConfig->sceneConfig
     *
     * @return BelongsTo
     */
    public function sceneConfig(): BelongsTo
    {
        return $this->belongsTo(SceneConfig::class, 'scene_config_id', 'c_config_id');
    }

    /**
     * 定义与裁判 (用户) 的多对多关系。
     * 通过魔术属性访问: $adConfig->referees
     *
     * @return BelongsToMany
     */
    public function referees(): BelongsToMany
    {
        return $this->belongsToMany(
            UserModel::class,
            'c_ad_referees',
            'ad_config_id',
            'user_id'
        )
            ->withPivot('c_level', 'c_expertise')
            ->withTimestamps();
    }
}
