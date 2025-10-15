<?php
namespace App\Models\scenario;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log; // ★ 1. 添加 Log use 声明

class SceneContainerInstance extends Model
{
    use HasFactory;

    protected $table = 'c_scene_container_instances';
    protected $primaryKey = 'c_container_id';
    protected $keyType = 'string';
    public $incrementing = false;
    public $timestamps = false;
    protected $fillable = ['c_container_id', 'c_scene_instances_id', 'c_flag', 'c_ip', 'c_container_name', 'c_team_id'];

    public function sceneInstance(): BelongsTo
    {
        return $this->belongsTo(SceneInstance::class, 'c_scene_instances_id', 'c_scene_instances_id');
    }

    /**
     * ★★★ 核心修改：添加与 SceneVmInstance 一致的权限检查方法 ★★★
     * 检查给定用户信息是否有权操作此容器实例。
     *
     * @param object|null $data 包含 token_data 的对象，由控制器注入。
     * @return bool
     */
    public function canBeOperatedByUser(?object $data): bool
    {
        // 步骤 1: 检查传入的用户信息是否有效
        $tokenData = $data->token_data ?? null;
        if (!$tokenData || !isset($tokenData['id'])) {
            Log::warning('权限检查失败(Container)：传入的用户信息(token_data)无效或缺失。', [
                'container_name' => $this->c_container_name
            ]);
            return false;
        }
        $userId = $tokenData['id'];
        $userTeamId = $tokenData['team_id'] ?? null;

        // 步骤 2: 检查用户是否为管理员或裁判 (特权角色)
        $isPrivilegedUser = DB::table('c_users_roles')
            ->where('c_user_id', $userId)
            ->whereIn('c_role_id', ['admin', 'referee'])
            ->exists();

        if ($isPrivilegedUser) {
            // 如果是管理员或裁判，直接授予权限
            return true;
        }

        // 步骤 3: 如果是普通用户，检查用户是否属于分配给此容器的队伍
        $containerTeamId = $this->c_team_id;

        if ($containerTeamId && $userTeamId && $containerTeamId === (string)$userTeamId) {
            // 用户所属队伍ID与容器分配的队伍ID匹配，授予权限
            return true;
        }

        // 步骤 4: 如果上述所有规则都不满足，则权限检查最终失败
        Log::warning('权限检查失败(Container)：用户非特权角色，且不属于此容器分配的队伍。', [
            'user_id' => $userId,
            'user_team_id' => $userTeamId,
            'container_name' => $this->c_container_name,
            'container_assigned_team_id' => $containerTeamId,
        ]);

        return false;
    }
}
