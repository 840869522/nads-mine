<?php
namespace App\Models\scenario;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Models\ad\AdConfig;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Request;

class SceneContainerInstance extends Model
{
    use HasFactory;

    protected $table = 'c_scene_container_instances';
    protected $primaryKey = 'c_container_id';
    protected $keyType = 'string';
    public $incrementing = false;
    public $timestamps = false;
    protected $fillable = ['c_container_id', 'c_scene_instances_id', 'c_flag', 'c_ip', 'c_container_name'];

    public function sceneInstance(): BelongsTo
    {
        return $this->belongsTo(SceneInstance::class, 'c_scene_instances_id', 'c_scene_instances_id');
    }
//    /**
//     * ★ 最终版权限检查方法 ★
//     * 检查给定用户信息是否有权操作此容器实例。
//     *
//     * @param object|null $data 包含 token_data 的对象，由控制器注入。
//     * @return bool
//     */
//    public function canBeOperatedByUser(?object $data): bool
//    {
//        // 步骤 1: 检查传入的用户信息是否有效
//        $tokenData = $data->token_data ?? null;
//        if (!$tokenData || !isset($tokenData['id'])) {
//            Log::warning('权限检查失败(Container)：传入的用户信息(token_data)无效或缺失。', [
//                'container_name' => $this->c_container_name,
//                'received_token_data' => $tokenData,
//                'scene_instance_id' => $this->c_scene_instances_id,
//                'request_path' => Request::path(),
//            ]);
//            return false;
//        }
//        $username = $tokenData['id'];
//        Log::info('权限检查(Container) canBeOperatedByUser 开始', ['id' => $username, 'container_name' => $this->c_container_name]);
//
//        // 步骤 2: 检查用户是否为管理员或裁判
//        $isAdminOrReferee = DB::table('c_users_roles')
//            ->join('c_roles', 'c_users_roles.c_role_id', '=', 'c_roles.c_id')
//            ->where('c_users_roles.c_user_id', $username)
//            ->whereIn('c_roles.c_id', ['admin', 'referee'])
//            ->exists();
//
//        if ($isAdminOrReferee) {
//            return true;
//        }
//
//        // 步骤 3: 如果不是管理员，检查场景是否为对抗演练
//        $adConfig = AdConfig::where('c_scene_instance_id', $this->c_scene_instances_id)->first();
//        if (!$adConfig) {
//            Log::warning('权限检查失败(Container)：用户非管理员，且未找到与此场景实例关联的对抗演练配置(AdConfig)。', [
//                'username' => $username,
//                'container_name' => $this->c_container_name,
//                'scene_instance_id' => $this->c_scene_instances_id,
//            ]);
//            return false;
//        }
//
//        // 步骤 4: 如果是对抗演练，则按红/蓝队规则检查
//        $isRedTeamMember = DB::table('c_teams_users')->where('team_id', $adConfig->c_red_team_id)->where('user_id', $username)->exists();
//        $isBlueTeamMember = DB::table('c_teams_users')->where('team_id', $adConfig->c_blue_team_id)->where('user_id', $username)->exists();
//
//        $isTargetMachine = !empty($this->c_flag);
//
//        if ($isRedTeamMember && !$isTargetMachine) {
//            return true;
//        }
//        if ($isBlueTeamMember && $isTargetMachine) {
//            return true;
//        }
//
//        // 步骤 5: 如果上述规则都不满足，则权限检查最终失败
//        Log::warning('权限检查失败(Container)：用户团队与容器角色不匹配。', [
//            'username' => $username,
//            'container_name' => $this->c_container_name,
//            'is_red_team_member' => $isRedTeamMember,
//            'is_blue_team_member' => $isBlueTeamMember,
//            'is_target_container' => $isTargetMachine,
//            'required_rule' => '红队需操作非靶机, 蓝队需操作靶机。',
//        ]);
//        return false;
//    }
}

