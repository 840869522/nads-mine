<?php

namespace App\Models\ad;

use Illuminate\Support\Facades\DB;
use App\Models\Users\UserModel;
use Illuminate\Database\Eloquent\Model;

/**
 * TeamUsers 逻辑处理类 (服务类)
 *
 * 封装与队伍成员相关的复杂业务逻辑。
 */
class TeamUsers extends Model
{
    // 这些属性对于静态服务类来说不是必需的，但保留它们不会影响功能
    protected $table = 'c_teams_users';
    public $timestamps = false;

    /**
     * 校验一组队伍是否存在成员冲突。
     * 这是一个静态方法，可以直接通过 TeamUsers::verifyConflict() 调用。
     *
     * @param int[] $team_ids 包含所有待检查队伍ID的数组
     * @return array{has_conflict: bool, conflicting_members: array}
     *         返回一个结构化的数组，表明是否有冲突以及冲突的成员列表。
     */
    public static function verifyConflict(array $team_ids): array
    {
        // 步骤 1: 清理并处理边缘情况
        $team_ids = array_filter(array_unique($team_ids)); // 移除空值和重复值
        if (count($team_ids) < 2) {
            // 如果只有一个或没有队伍，不可能存在冲突
            return ['has_conflict' => false, 'conflicting_members' => []];
        }

        // 步骤 2: 执行一次高效的数据库查询，获取所有队伍的所有成员ID。
        $all_member_ids = DB::table('c_teams_users')
            ->whereIn('team_id', $team_ids)
            ->pluck('user_id') // 只获取 user_id 列
            ->all();

        // 步骤 3: 统计每个成员ID出现的次数。
        // 如果一个成员ID出现超过一次，说明他/她存在于多个队伍中。
        $member_counts = array_count_values($all_member_ids);

        // 步骤 4: 找出所有出现次数 > 1 的成员ID，即冲突的成员ID。
        $conflicting_ids = [];
        foreach ($member_counts as $user_id => $count) {
            if ($count > 1) {
                $conflicting_ids[] = $user_id;
            }
        }

        // 步骤 5: 如果没有冲突，返回成功结果。
        if (empty($conflicting_ids)) {
            return [
                'has_conflict' => false,
                'conflicting_members' => [],
            ];
        }

        // 步骤 6: 如果存在冲突，查询这些冲突ID对应的用户名，以便生成更友好的错误信息。
        // UserModel 的查询逻辑保持不变，因为我们最终还是需要用户名
        $conflicting_users = UserModel::whereIn('c_username', $conflicting_ids)
            ->pluck('c_username')
            ->all();

        // 步骤 7: 返回包含冲突信息的失败结果。
        return [
            'has_conflict' => true,
            'conflicting_members' => $conflicting_users,
        ];
    }

    /**
     * MODIFIED: 获取一组队伍的所有成员 user_id 列表。
     * 将此方法改为静态方法，以便在控制器或其他服务中直接调用，无需实例化。
     *
     * @param int[] $team_ids 队伍ID数组
     * @return string[] 返回一个包含所有不重复的用户ID的数组
     */
    public static function get_teams_users(array $team_ids = []): array
    {
        if (empty($team_ids)) {
            return [];
        }

        // 使用 DB Facade 实现，简洁高效
        return DB::table('c_teams_users')
            ->whereIn('team_id', $team_ids)
            ->pluck('user_id')
            ->unique() // 返回去重后的用户ID列表
            ->all();
    }
}
