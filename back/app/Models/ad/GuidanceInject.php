<?php

namespace App\Models\ad;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\Models\ad\AdConfig;
use App\Models\ad\Team;
use Illuminate\Support\Str;

class GuidanceInject extends Model
{
    use HasFactory;

    // --- 模型核心配置 ---
    protected $table = 'c_guidance_injects';
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
        'c_title',
        'c_description',
        'c_type',
        'c_ad_config_id',
        'c_target_team_id',
        'c_status',
        'c_execution_time',
        'c_executed_at',
    ];

    /**
     * 需要转换为 Carbon 日期实例的属性。
     */
    protected $dates = [
        'c_execution_time',
        'c_executed_at',
        'c_create_at',
        'c_update_at',
    ];

    /**
     * 模型的默认属性值。
     */
    protected $attributes = [
        'c_status' => 'PENDING',
    ];

    /**
     * 模型的 "booted" 方法，用于定义模型事件监听器。
     * 在创建新记录时自动生成 UUID。
     */
    protected static function booted()
    {
        static::creating(function ($model) {
            if (empty($model->{$model->getKeyName()})) {
                $model->{$model->getKeyName()} = (string) Str::uuid();
            }
        });
    }

    // --- 模型关联关系 ---

    /**
     * 获取此事件注入所属的演练配置。
     */
    public function adConfig()
    {
        return $this->belongsTo(AdConfig::class, 'c_ad_config_id', 'c_id');
    }

    /**
     * 获取此事件注入的目标队伍。
     */
    public function targetTeam()
    {
        return $this->belongsTo(Team::class, 'c_target_team_id', 'c_id');
    }
}
