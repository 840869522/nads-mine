<?php

namespace App\Models\scenario;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
// ★ 新增：为了实现权限作用域，我们需要引入以下类
use Illuminate\Database\Eloquent\Builder;
use App\Models\ad\AdConfig;
use App\Models\Users\UserModel; // 请确保这是你项目中正确的用户模型类
use Illuminate\Support\Facades\Auth;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property string $c_container_id
 * @property string $c_scene_instances_id
 * @property string|null $c_flag
 * @property string|null $c_ip
 * @property string|null $c_container_name
 */
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
        'c_container_name',
        // ★ 新增(如果修改DB)：'c_is_target'，如果不想改DB则不需要加
    ];

    /**
     * ★ (可选但推荐) 新增：定义属性类型转换
     * The attributes that should be cast.
     * @var array<string, string>
     */
    // protected $casts = [
    //     'c_is_target' => 'boolean', // 如果修改了DB，加上这行
    // ];


    /**
     * 定义与 SceneInstance 模型的关系。(此方法保持不变)
     */
    public function sceneInstance(): BelongsTo
    {
        return $this->belongsTo(SceneInstance::class, 'c_scene_instances_id', 'c_scene_instances_id');
    }

    /**
     * ★ 新增：权限作用域，用于根据当前用户角色过滤容器列表 (不修改DB版)
     * 这个方法是新增的，不会影响任何已有的代码调用。
     * 只有在控制器中明确调用 ->forCurrentUser() 时，它才会生效。
     *
     * @param \Illuminate\Database\Eloquent\Builder $query
     * @param string $sceneInstanceId
     * @return \Illuminate\Database\Eloquent\Builder
     */
    public function scopeForCurrentUser(Builder $query, string $sceneInstanceId): Builder
    {
        /** @var UserModel|null $user */
        $user = Auth::user();

        // 场景1：没有用户登录，不返回任何数据
        if (!$user) {
            return $query->whereRaw('1 = 0');
        }

        // 场景2：用户是管理员或裁判，返回所有数据
        if ($user->hasRole('admin') || $user->hasRole('referee')) {
            return $query;
        }

        // 场景3：对于普通用户，根据其队伍身份进行过滤
        $adConfig = AdConfig::where('c_scene_instance_id', $sceneInstanceId)->first();
        if (!$adConfig) {
            return $query->whereRaw('1 = 0');
        }

        $isRedTeamMember = $user->teams()->where('team_id', $adConfig->c_red_team_id)->exists();
        $isBlueTeamMember = $user->teams()->where('team_id', $adConfig->c_blue_team_id)->exists();

        // 根据队伍身份应用核心过滤规则 (基于 c_flag 推断)
        if ($isRedTeamMember && !$isBlueTeamMember) {
            // 红队成员：只能看到攻击机 (c_flag 为 NULL 或为空字符串)
            return $query->where(function ($q) {
                $q->whereNull('c_flag')->orWhere('c_flag', '');
            });
        }

        if ($isBlueTeamMember && !$isRedTeamMember) {
            // 蓝队成员：只能看到靶机 (c_flag 不为 NULL 且不为空字符串)
            return $query->whereNotNull('c_flag')->where('c_flag', '!=', '');
        }

        if ($isRedTeamMember && $isBlueTeamMember) {
            return $query; // 同时属于红蓝队，看到所有
        }

        // 默认情况：如果用户不属于演练的任何一方，则什么都看不到
        return $query->whereRaw('1 = 0');
    }
}
