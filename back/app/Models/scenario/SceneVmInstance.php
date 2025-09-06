<?php

namespace App\Models\scenario;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
// ★ 新增：为了解决类型错误和Auth类不存在错误，引入以下必要的类
use Illuminate\Database\Eloquent\Builder;
use App\Models\ad\AdConfig;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Auth;

/**
 * 虚拟机实例与场景实例的关联模型
 *
 * @property int $c_vm_id 主键,自增ID
 * @property string $c_vm_name 虚拟机唯一名称
 * @property string $c_scene_instances_id 关联的场景实例ID (外键)
 * @property string|null $c_ip 虚拟机IP地址
 * @property string|null $c_flag 靶机flag
 */
class SceneVmInstance extends Model
{
    use HasFactory;

    // --- 以下是你提供的原始代码，完整保留，不做任何修改 ---

    /**
     * 与模型关联的表名
     */
    protected $table = 'c_scene_vm_instances';

    /**
     * 表的主键
     */
    protected $primaryKey = 'c_vm_id';

    /**
     * 指示主键是否是自增的
     */
    public $incrementing = true;

    /**
     * 主键的类型
     */
    protected $keyType = 'int';

    /**
     * 指示模型是否应被记入时间戳
     */
    public $timestamps = false;

    /**
     * 可批量赋值的属性
     */
    protected $fillable = [
        'c_vm_name',
        'c_scene_instances_id',
        'c_ip',
        'c_flag',
    ];

    /**
     * 定义与 SceneInstance 模型的关联关系
     */
    public function sceneInstance(): BelongsTo
    {
        return $this->belongsTo(SceneInstance::class, 'c_scene_instances_id', 'c_scene_instances_id');
    }

    // --- 原始代码结束 ---


    // ==============================================================================
    // ★★★★★★★★★★★★★★★★★★★   开始新增代码   ★★★★★★★★★★★★★★★★★★★★★★★
    // ==============================================================================

    /**
     * 权限作用域：根据当前登录用户的角色，过滤虚拟机列表 (最终修正版)
     *
     * @param \Illuminate\Database\Eloquent\Builder $query
     * @param string $sceneInstanceId
     * @return \Illuminate\Database\Eloquent\Builder
     */
    public function scopeForCurrentUser(Builder $query, string $sceneInstanceId): Builder
    {
        $user = Auth::user();

        if (!$user || !isset($user->c_username)) {
            return $query->whereRaw('1 = 0');
        }
        $username = $user->c_username;

        $isAdminOrReferee = DB::table('c_users_roles')
            ->join('c_roles', 'c_users_roles.c_role_id', '=', 'c_roles.c_id')
            ->where('c_users_roles.c_user_id', $username)
            ->whereIn('c_roles.c_role_name', ['admin', 'referee']) // 假设角色名存在于 c_roles.c_role_name
            ->exists();

        if ($isAdminOrReferee) {
            return $query;
        }

        $adConfig = AdConfig::where('c_scene_instance_id', $sceneInstanceId)->first();
        if (!$adConfig) {
            return $query->whereRaw('1 = 0');
        }

        $isRedTeamMember = DB::table('c_teams_users')
            ->where('team_id', $adConfig->c_red_team_id)
            ->where('user_id', $username)
            ->exists();

        $isBlueTeamMember = DB::table('c_teams_users')
            ->where('team_id', $adConfig->c_blue_team_id)
            ->where('user_id', $username)
            ->exists();

        if ($isRedTeamMember && !$isBlueTeamMember) {
            return $query->where(function ($q) {
                $q->whereNull('c_flag')->orWhere('c_flag', '');
            });
        }
        if ($isBlueTeamMember && !$isRedTeamMember) {
            return $query->whereNotNull('c_flag')->where('c_flag', '!=', '');
        }
        if ($isRedTeamMember && $isBlueTeamMember) {
            return $query;
        }

        return $query->whereRaw('1 = 0');
    }
    // ==============================================================================
    // ★★★★★★★★★★★★★★★★★★★    结束新增代码   ★★★★★★★★★★★★★★★★★★★★★★★
    // ==============================================================================
}
