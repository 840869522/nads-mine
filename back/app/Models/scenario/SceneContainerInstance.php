<?php
namespace App\Models\scenario;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Builder;
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
     * ★ 新增：权限作用域，与 SceneVmInstance 逻辑完全相同
     */
    public function scopeForCurrentUser(Builder $query, string $sceneInstanceId): Builder
    {
        $tokenData = Request::get('token_data');
        if (!$tokenData || !isset($tokenData['username'])) { return $query->whereRaw('1 = 0'); }
        $username = $tokenData['username'];
        $isAdminOrReferee = DB::table('c_users_roles')->join('c_roles', 'c_users_roles.c_role_id', '=', 'c_roles.c_id')->where('c_users_roles.c_user_id', $username)->whereIn('c_roles.c_role_name', ['admin', 'referee'])->exists();
        if ($isAdminOrReferee) { return $query; }
        $adConfig = AdConfig::where('c_scene_instance_id', $sceneInstanceId)->first();
        if (!$adConfig) { return $query->whereRaw('1 = 0'); }
        $isRedTeamMember = DB::table('c_teams_users')->where('team_id', $adConfig->c_red_team_id)->where('user_id', $username)->exists();
        $isBlueTeamMember = DB::table('c_teams_users')->where('team_id', $adConfig->c_blue_team_id)->where('user_id', $username)->exists();
        if ($isRedTeamMember && !$isBlueTeamMember) { return $query->where(function ($q) { $q->whereNull('c_flag')->orWhere('c_flag', ''); }); }
        if ($isBlueTeamMember && !$isRedTeamMember) { return $query->whereNotNull('c_flag')->where('c_flag', '!=', ''); }
        if ($isRedTeamMember && $isBlueTeamMember) { return $query; }
        return $query->whereRaw('1 = 0');
    }
}
