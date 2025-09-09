<?php

namespace App\Models\scenario;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Models\ad\AdConfig;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Request;

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
    /**
     * ★ 查询作用域：根据当前用户的角色和团队成员身份过滤虚拟机实例
     *
     * @param \Illuminate\Database\Eloquent\Builder $query
     * @param string $sceneInstanceId 场景实例ID
     * @return \Illuminate\Database\Eloquent\Builder
     */
    public function scopeForCurrentUser($query, $sceneInstanceId)
    {
        $tokenData = Request::get('token_data');
        if (!$tokenData || !isset($tokenData['username'])) {
            // 未认证用户无法查看任何VM
            return $query->whereRaw('1 = 0');
        }
        $username = $tokenData['username'];

        // 检查用户是否是管理员或裁判
        $isAdminOrReferee = DB::table('c_users_roles')
            ->join('c_roles', 'c_users_roles.c_role_id', '=', 'c_roles.c_id')
            ->where('c_users_roles.c_user_id', $username)
            ->whereIn('c_roles.c_role_name', ['admin', 'referee'])
            ->exists();

        if ($isAdminOrReferee) {
            // 管理员和裁判可以查看所有VM
            return $query;
        }

        // 查找对应的演练配置
        $adConfig = DB::table('c_scene_instances as si')
            ->join('c_ad_configs as ac', 'si.c_config_id', '=', 'ac.c_config_id')
            ->where('si.c_scene_instances_id', $sceneInstanceId)
            ->first();

        if (!$adConfig) {
            // 找不到对应的演练配置，拒绝访问
            return $query->whereRaw('1 = 0');
        }

        // 检查用户团队成员身份
        $isRedTeamMember = DB::table('c_teams_users')
            ->where('team_id', $adConfig->c_red_team_id)
            ->where('user_id', $username)
            ->exists();
        $isBlueTeamMember = DB::table('c_teams_users')
            ->where('team_id', $adConfig->c_blue_team_id)
            ->where('user_id', $username)
            ->exists();

        if ($isRedTeamMember) {
            // 红队成员只能访问非靶机（c_flag为空或null的VM）
            return $query->where(function($q) {
                $q->whereNull('c_flag')->orWhere('c_flag', '=', '');
            });
        } elseif ($isBlueTeamMember) {
            // 蓝队成员只能访问靶机（c_flag不为空的VM）
            return $query->whereNotNull('c_flag')->where('c_flag', '!=', '');
        } else {
            // 不是红队也不是蓝队成员，拒绝访问
            return $query->whereRaw('1 = 0');
        }
    }

    /**
     * ★ 检查当前登录用户是否有权操作此虚拟机实例
     *
     * @param AdConfig|object|null $adConfig 演练配置，可以是AdConfig模型或包含c_red_team_id和c_blue_team_id属性的对象
     * @return bool
     */
    public function canBeOperatedByUser($adConfig = null): bool
    {
        $tokenData = Request::get('token_data');
        if (!$tokenData || !isset($tokenData['username'])) {
            return false;
        }
        $username = $tokenData['username'];

        // 检查管理员和裁判权限
        $isAdminOrReferee = DB::table('c_users_roles')
            ->join('c_roles', 'c_users_roles.c_role_id', '=', 'c_roles.c_id')
            ->where('c_users_roles.c_user_id', $username)
            ->whereIn('c_roles.c_role_name', ['admin', 'referee'])
            ->exists();
        if ($isAdminOrReferee) {
            return true;
        }

        // 如果没有提供演练配置，尝试从数据库查找
        if (!$adConfig) {
            $adConfig = DB::table('c_scene_instances as si')
                ->join('c_ad_configs as ac', 'si.c_config_id', '=', 'ac.c_config_id')
                ->where('si.c_scene_instances_id', $this->c_scene_instances_id)
                ->first();
        }

        if (!$adConfig) {
            return false;
        }

        // 获取红队和蓝队ID（兼容AdConfig模型和stdClass对象）
        $redTeamId = $adConfig->c_red_team_id ?? null;
        $blueTeamId = $adConfig->c_blue_team_id ?? null;

        if (!$redTeamId || !$blueTeamId) {
            return false;
        }

        // 检查用户团队成员身份
        $isRedTeamMember = DB::table('c_teams_users')
            ->where('team_id', $redTeamId)
            ->where('user_id', $username)
            ->exists();
        $isBlueTeamMember = DB::table('c_teams_users')
            ->where('team_id', $blueTeamId)
            ->where('user_id', $username)
            ->exists();

        $isTargetMachine = !empty($this->c_flag);

        // 权限判断逻辑：
        // 红队成员只能操作非靶机（用于攻击）
        // 蓝队成员只能操作靶机（用于防御）
        if ($isRedTeamMember && !$isTargetMachine) {
            return true;
        }
        if ($isBlueTeamMember && $isTargetMachine) {
            return true;
        }

        return false;
    }
}
