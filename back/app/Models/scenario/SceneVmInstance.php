<?php

namespace App\Models\scenario;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
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

    // ==============================================================================
    // ★★★★★★★★★★★★★★★★★★★   开始新增代码   ★★★★★★★★★★★★★★★★★★★★★★★
    // ==============================================================================

    /**
     * 权限作用域：根据当前登录用户的角色，过滤虚拟机列表 (不修改UserModel版)
     *
     * 这个方法是全新的，不会影响任何已有的代码调用，因为它必须被明确调用才会生效。
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

        // 步骤 1: 判断用户是否为管理员或裁判
        $isAdminOrReferee = DB::table('c_users_roles')
            ->join('c_roles', 'c_users_roles.c_role_id', '=', 'c_roles.c_id')
            ->where('c_users_roles.c_user_id', $username)
            ->whereIn('c_roles.c_role_name', ['admin', 'referee']) // 假设角色名存在于 c_roles.c_role_name
            ->exists();

        if ($isAdminOrReferee) {
            return $query;
        }

        // 步骤 2: 对于普通用户，根据其在当前演练中的队伍身份进行过滤
        $adConfig = AdConfig::where('c_scene_instance_id', $sceneInstanceId)->first();
        if (!$adConfig) {
            return $query->whereRaw('1 = 0');
        }

        // 步骤 3: 直接查询团队成员关联表 c_teams_users
        $isRedTeamMember = DB::table('c_teams_users')
            ->where('team_id', $adConfig->c_red_team_id)
            ->where('user_id', $username)
            ->exists();

        $isBlueTeamMember = DB::table('c_teams_users')
            ->where('team_id', $adConfig->c_blue_team_id)
            ->where('user_id', $username)
            ->exists();

        // 步骤 4: 根据队伍身份应用核心过滤规则 (基于 c_flag 推断)
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
