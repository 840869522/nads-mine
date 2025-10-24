<?php
// file: app/Models/ad/AdConfig.php

namespace App\Models\ad;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use App\Models\scenario\SceneConfig;
use Illuminate\Database\Eloquent\Relations\HasMany;
use App\Models\ad\Referee;

class AdConfig extends Model
{
    use HasFactory;

    protected $table = 'c_ad_configs';
    protected $primaryKey = 'c_id';
    public $incrementing = false;
    protected $keyType = 'string';
    const CREATED_AT = 'c_create_at';
    const UPDATED_AT = 'c_update_at';

    protected $fillable = [
        'c_id',
        'c_drill_name',
        'c_description',
        'c_scene_config_id',
        'c_scene_instance_id',
        'c_status',
        'c_start_time',
        'c_end_time',
        'c_type',
        'c_show_attack',
    ];

    protected $dates = [
        'c_start_time', 'c_end_time', 'c_create_at', 'c_update_at',
    ];

    /**
     * 定义与场景配置模板 (SceneConfig) 的 "属于" (belongsTo) 关系。
     *
     * @return \Illuminate\Database\Eloquent\Relations\BelongsTo
     */
    public function sceneConfig()
    {
        return $this->belongsTo(SceneConfig::class, 'c_scene_config_id', 'c_config_id');
    }

    /**
     * 定义与裁判 (Referee) 的 "一对多" (hasMany) 关系。
     *
     * @return \Illuminate\Database\Eloquent\Relations\HasMany
     */
    public function referees(): HasMany
    {
        return $this->hasMany(Referee::class, 'c_ad_config_id', 'c_id');
    }
}
