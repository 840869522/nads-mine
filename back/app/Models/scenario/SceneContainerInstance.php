<?php

namespace App\Models\scenario;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SceneContainerInstance extends Model
{
    use HasFactory;

    /**
     * 手动指定模型关联的数据表名。
     * @var string
     */
    protected $table = 'c_scene_container_instances';

    /**
     * 手动指定主键。
     * @var string
     */
    protected $primaryKey = 'c_container_id';

    /**
     * 主键的类型是字符串 (CHAR/VARCHAR)。
     * @var string
     */
    protected $keyType = 'string';

    /**
     * 主键不是自增整数。
     * @var bool
     */
    public $incrementing = false;

    /**
     * 指示模型是否自动维护时间戳。
     * 因为表中没有 created_at 和 updated_at 字段，所以设为 false。
     * @var bool
     */
    public $timestamps = false;

    /**
     * 可批量赋值的属性。
     * @var array<int, string>
     */
    protected $fillable = [
        'c_container_id',
        'c_scene_instances_id',
        'c_flag',
        'c_ip',
        'c_container_name', // <-- Added this line
    ];

    /**
     * 定义与 SceneInstance 模型的关系 (可选，但推荐)。
     * 假设 SceneInstance 的主键是 c_scene_instances_id。
     */
    public function sceneInstance()
    {
        return $this->belongsTo(SceneInstance::class, 'c_scene_instances_id', 'c_scene_instances_id');
    }
    /**
     * ★ 新增：检查当前登录用户是否有权操作此容器实例
     */
    public function canBeOperatedByUser(?AdConfig $adConfig): bool
    {
        $tokenData = Request::get('token_data');
        if (!$tokenData || !isset($tokenData['username'])) { return false; }
        $username = $tokenData['username'];
        $isAdminOrReferee = DB::table('c_users_roles')->join('c_roles', 'c_users_roles.c_role_id', '=', 'c_roles.c_id')->where('c_users_roles.c_user_id', $username)->whereIn('c_roles.c_role_name', ['admin', 'referee'])->exists();
        if ($isAdminOrReferee) { return true; }
        if (!$adConfig) { return false; }
        $isRedTeamMember = DB::table('c_teams_users')->where('team_id', $adConfig->c_red_team_id)->where('user_id', $username)->exists();
        $isBlueTeamMember = DB::table('c_teams_users')->where('team_id', $adConfig->c_blue_team_id)->where('user_id', $username)->exists();
        $isTargetMachine = !empty($this->c_flag);
        if ($isRedTeamMember && !$isTargetMachine) { return true; }
        if ($isBlueTeamMember && $isTargetMachine) { return true; }
        return false;
    }
}
