<?php
// file: app/Models/ad/AdConfig.php

namespace App\Models\ad;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use App\Models\scenario\SceneConfig;
use Illuminate\Database\Eloquent\Relations\HasMany;
use App\Models\ad\Referee;
use App\Models\ad\Team; // ★ 1. 导入 Team 模型
use Illuminate\Support\Facades\DB; // ★ 2. 导入 DB Facade

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

    /**
     * ★ 3. 新增：获取参与此演练的所有队伍的访问器。
     * 当调用 $adConfig->teams 时，此方法会自动执行。
     *
     * @return \Illuminate\Database\Eloquent\Collection
     */
    public function getTeamsAttribute()
    {
        // 如果演练没有关联的场景实例ID，则不可能有队伍，直接返回空集合
        if (empty($this->c_scene_instance_id)) {
            return collect();
        }

        // 从虚拟机实例表中查找队伍ID
        $teamIdsFromVms = DB::table('c_scene_vm_instances')
            ->where('c_scene_instances_id', $this->c_scene_instance_id)
            ->whereNotNull('c_team_id')
            ->pluck('c_team_id');

        // 从容器实例表中查找队伍ID
        $teamIdsFromContainers = DB::table('c_scene_container_instances')
            ->where('c_scene_instances_id', $this->c_scene_instance_id)
            ->whereNotNull('c_team_id')
            ->pluck('c_team_id');

        // 合并并去重所有找到的队伍ID
        $allTeamIds = $teamIdsFromVms->merge($teamIdsFromContainers)->unique();

        // 如果没有找到任何队伍ID，返回空集合
        if ($allTeamIds->isEmpty()) {
            return collect();
        }

        // 根据队伍ID批量查询队伍信息，只选择需要的字段
        return Team::whereIn('c_id', $allTeamIds)->select('c_id', 'c_name')->get();
    }
}
