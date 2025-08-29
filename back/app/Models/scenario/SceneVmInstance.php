<?php

namespace App\Models\scenario;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Builder;
use App\Models\ad\AdConfig;
use App\Models\Users\UserModel; // 请确保这是你项目中正确的用户模型类
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
     * 可批量赋值的属性 (保持原样)
     */
    protected $fillable = [
        'c_vm_name',
        'c_scene_instances_id',
        'c_ip',
        'c_flag',
    ];

    /**
     * 定义与 SceneInstance 模型的关联关系 (保持原样)
     */
    public function sceneInstance(): BelongsTo
    {
        return $this->belongsTo(SceneInstance::class, 'c_scene_instances_id', 'c_scene_instances_id');
    }

    /**
     * ★ 修改：权限作用域，将权限判断逻辑改为基于 c_flag 字段
     */
    public function scopeForCurrentUser(Builder $query, string $sceneInstanceId): Builder
    {
        /** @var UserModel|null $user */
        $user = Auth::user();

        if (!$user) {
            return $query->whereRaw('1 = 0');
        }

        if ($user->hasRole('admin') || $user->hasRole('referee')) {
            return $query;
        }

        $adConfig = AdConfig::where('c_scene_instance_id', $sceneInstanceId)->first();
        if (!$adConfig) {
            return $query->whereRaw('1 = 0');
        }

        $isRedTeamMember = $user->teams()->where('team_id', $adConfig->c_red_team_id)->exists();
        $isBlueTeamMember = $user->teams()->where('team_id', $adConfig->c_blue_team_id)->exists();

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

        return $query->whereRaw('1 = 0');
    }
}
