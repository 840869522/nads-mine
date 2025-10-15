<?php

namespace App\Models\scenario;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Request;

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
     * ★ 重构版：检查给定用户信息是否有权操作此虚拟机实例。
     * 新的逻辑移除了红队/蓝队概念，改为判断用户是否属于分配给此VM的队伍。
     *
     * @param object|null $data 包含用户令牌数据的上下文对象。
     * @return bool
     */
    public function canBeOperatedByUser(?object $data): bool
    {
        // 步骤 1: 检查传入的用户信息是否有效
        $tokenData = $data->token_data ?? null;
        if (!$tokenData || !isset($tokenData['id'])) {
            Log::warning('权限检查失败(VM)：传入的用户信息(token_data)无效或缺失。', [
                'vm_name' => $this->c_vm_name,
                'received_token_data' => $tokenData,
            ]);
            return false;
        }
        $userId = $tokenData['id'];
        $userTeamId = $tokenData['team_id'] ?? null; // 假设JWT Token中包含用户的team_id

        // 步骤 2: 检查用户是否为管理员或裁判 (特权角色)
        $isPrivilegedUser = DB::table('c_users_roles')
            ->join('c_roles', 'c_users_roles.c_role_id', '=', 'c_roles.c_id')
            ->where('c_users_roles.c_user_id', $userId)
            ->whereIn('c_roles.c_id', ['admin', 'referee']) // 根据您的角色定义调整
            ->exists();

        if ($isPrivilegedUser) {
            // 如果是管理员或裁判，直接授予权限
            return true;
        }

        // 步骤 3: 如果是普通用户，检查用户是否属于分配给此虚拟机的队伍
        // (前提是虚拟机已经被分配了一个队伍)
        $vmTeamId = $this->c_team_id;

        if ($vmTeamId && $userTeamId && $vmTeamId === (string)$userTeamId) {
            // 用户所属队伍ID与虚拟机分配的队伍ID匹配，授予权限
            return true;
        }

        // 步骤 4: 如果上述所有规则都不满足，则权限检查失败
        Log::warning('权限检查失败(VM)：用户非特权角色，且不属于此虚拟机分配的队伍。', [
            'user_id' => $userId,
            'user_team_id' => $userTeamId,
            'vm_name' => $this->c_vm_name,
            'vm_assigned_team_id' => $vmTeamId,
        ]);

        return false;
    }
}
