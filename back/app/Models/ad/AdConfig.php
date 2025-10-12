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

    public function sceneConfig()
    {
        return $this->belongsTo(SceneConfig::class, 'c_scene_config_id', 'c_config_id');
    }

    public function referees(): HasMany
    {
        return $this->hasMany(Referee::class, 'c_ad_config_id', 'c_id');
    }
}
