<?php

namespace App\Models\scenario;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Models\ad\AdConfig;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Request;
use Illuminate\Support\Facades\Log;

class SceneVmInstance extends Model
{
    use HasFactory;

    protected $table = 'c_scene_vm_instances';
    protected $primaryKey = 'c_vm_id';
    public $incrementing = true;
    protected $keyType = 'int';
    public $timestamps = false;
    protected $fillable = ['c_vm_name', 'c_scene_instances_id', 'c_ip', 'c_flag', 'c_team_id'];

    public function sceneInstance(): BelongsTo
    {
        return $this->belongsTo(SceneInstance::class, 'c_scene_instances_id', 'c_scene_instances_id');
    }

    /**
     * ★ 最终修复版：检查给定用户信息是否有权操作此虚拟机实例。
     * 这个版本接收一个可能为 null 的用户信息数组作为参数，使其不依赖全局 Request 对象，
     * 同时也保留了详细的诊断日志。
     *
     * @param array|null $tokenData 由认证中间件注入的用户信息数组，可能为 null。
     * @return bool
     */
    public function canBeOperatedByUser(?Object $data): bool
    {
        // 步骤 1: 检查传入的用户信息是否有效
        // 我们检查 'username' 字段，因为它在后续逻辑中被使用。

        $tokenData = $data->token_data;
        //Log::info($tokenData);
        if (!$tokenData || !isset($tokenData['id'])) {
            // 添加日志：记录因缺少有效用户信息而失败
            Log::warning('权限检查失败(VM)：传入的用户信息(token_data)无效或缺失。', [
                'vm_name' => $this->c_vm_name,
                'received_token_data' => $tokenData,
                'scene_instance_id' => $this->c_scene_instances_id,
                'request_path' => Request::path(), // 记录请求路径以供追溯
            ]);
            return false;
        }
        $username = $tokenData['id'];
        Log::info('权限检查 canBeOperatedByUser 开始', ['id' => $username, 'vm_name' => $this->c_vm_name]);

        // 步骤 2: 检查用户是否为管理员或裁判
        $isAdminOrReferee = DB::table('c_users_roles')
            ->join('c_roles', 'c_users_roles.c_role_id', '=', 'c_roles.c_id')
            ->where('c_users_roles.c_user_id', $username)
            ->whereIn('c_roles.c_id', ['admin', 'referee'])
            ->exists();
        //Log::info($isAdminOrReferee);
        if ($isAdminOrReferee) {
            // 如果是管理员或裁判，直接授予权限
            return true;
        }

        // 步骤 3: 如果不是管理员，检查场景是否为对抗演练
        $adConfig = AdConfig::where('c_scene_instance_id', $this->c_scene_instances_id)->first();
        Log::info($adConfig);
        if (!$adConfig) {
            // 添加日志：记录因场景非对抗演练而失败
            Log::warning('权限检查失败(VM)：用户非管理员，且未找到与此场景实例关联的对抗演练配置(AdConfig)。', [
                'username' => $username,
                'vm_name' => $this->c_vm_name,
                'scene_instance_id' => $this->c_scene_instances_id,
            ]);
            return false;
        }

        // 步骤 4: 如果是对抗演练，则按红/蓝队规则检查
        $isRedTeamMember = DB::table('c_teams_users')->where('team_id', $adConfig->c_red_team_id)->where('user_id', $username)->exists();
        $isBlueTeamMember = DB::table('c_teams_users')->where('team_id', $adConfig->c_blue_team_id)->where('user_id', $username)->exists();

        $isTargetMachine = !empty($this->c_flag);
        if ($isRedTeamMember && !$isTargetMachine) {
            // 红队成员操作攻击机，权限通过
            return true;
        }
Log::info([
 'Red' =>DB::table('c_teams_users')->where('team_id', $adConfig->c_red_team_id)->where('user_id', $username)->toSql(),
 'Blue' =>DB::table('c_teams_users')->where('team_id', $adConfig->c_blue_team_id)->where('user_id', $username)->toSql(),
 'team' =>[1=>$adConfig->c_red_team_id,2=>$adConfig->c_blue_team_id]
]);
Log::info($isBlueTeamMember);
Log::info($isTargetMachine);
        if ($isBlueTeamMember && $isTargetMachine) {
            // 蓝队成员操作靶机，权限通过
            return true;
        }

        // 步骤 5: 如果上述规则都不满足，则权限检查最终失败
        // 添加日志：记录因团队与虚拟机角色不匹配而失败
        Log::warning('权限检查失败(VM)：用户团队与虚拟机角色不匹配。', [
            'username' => $username,
            'vm_name' => $this->c_vm_name,
            'is_red_team_member' => $isRedTeamMember,
            'is_blue_team_member' => $isBlueTeamMember,
            'is_target_vm' => $isTargetMachine,
            'required_rule' => '红队需操作非靶机, 蓝队需操作靶机。',
        ]);
        return false;
    }
}
