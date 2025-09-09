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

    /**
     * ★ 新增：检查当前登录用户是否有权操作此容器实例
     */
    public function canBeOperatedByUser(): bool
    {
        $tokenData = Request::get('token_data');
        if (!$tokenData || !isset($tokenData['username'])) { return false; }
        $username = $tokenData['username'];
        $isAdminOrReferee = DB::table('c_users_roles')->join('c_roles', 'c_users_roles.c_role_id', '=', 'c_roles.c_id')->where('c_users_roles.c_user_id', $username)->whereIn('c_roles.c_role_name', ['admin', 'referee'])->exists();
        if ($isAdminOrReferee) { return true; }
        $adConfig = AdConfig::where('c_scene_instance_id', $this->c_scene_instances_id)->first();
        if (!$adConfig) { return false; }
        $isRedTeamMember = DB::table('c_teams_users')->where('team_id', $adConfig->c_red_team_id)->where('user_id', $username)->exists();
        $isBlueTeamMember = DB::table('c_teams_users')->where('team_id', $adConfig->c_blue_team_id)->where('user_id', $username)->exists();
        $isTargetMachine = !empty($this->c_flag);
        if ($isRedTeamMember && !$isTargetMachine) { return true; }
        if ($isBlueTeamMember && $isTargetMachine) { return true; }
        return false;
    }
}
