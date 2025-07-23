<?php

namespace App\Models\ad;

// 我们只需要 DB Facade 来查询数据库，和 UserModel 来获取用户名
use App\Models\Course\TestsModel;
use Illuminate\Support\Facades\DB;
use App\Models\Users\UserModel;
use Illuminate\Database\Eloquent\Model;

/**
 * TeamUsers 逻辑处理类
 *
 * 这个类不继承 Model，因为它不代表数据库中的某一行数据。
 * 它是一个服务类，专门用于封装与队伍成员相关的复杂业务逻辑。
 */
class TeamUsers extends Model
{
    protected $table = 'c_teams_users';
    public $timestamps = false;
    public $pageSize = 20;
    /**
     * 校验两个队伍是否存在成员冲突。
     * 这是一个静态方法，意味着我们可以直接通过 TeamUsers::verifyConflict() 调用，无需创建实例。
     *
     * @param int $team1_id 第一个队伍的ID
     * @param int $team2_id 第二个队伍的ID
     * @return array{has_conflict: bool, conflicting_members: array}
     *         返回一个结构化的数组，清晰地表明是否有冲突以及冲突的成员列表。
     */
    public static function verifyConflict(int $team1_id, int $team2_id): array
    {
        // 步骤 1: 处理边缘情况，如果两个ID相同，直接判定为冲突。
        if ($team1_id === $team2_id) {
            return [
                'has_conflict' => true,
                'conflicting_members' => [], // 没有具体成员，但逻辑上冲突
            ];
        }

        // 步骤 2: 执行一次高效的数据库查询，获取两个队伍的所有成员ID。
        // 我们使用 DB Facade 直接操作 c_teams_users 表。
        $grouped_members = DB::table('c_teams_users')
            ->whereIn('team_id', [$team1_id, $team2_id])
            ->get(['team_id', 'user_id'])
            ->groupBy('team_id'); // 使用 groupBy 将结果按 team_id 分组

        // 步骤 3: 从分组后的结果中，分别提取两个队伍的成员ID数组。
        $team1_members = $grouped_members->get($team1_id, collect())->pluck('user_id')->all();
        $team2_members = $grouped_members->get($team2_id, collect())->pluck('user_id')->all();

        // 步骤 4: 使用 PHP 内置函数计算两个数组的交集，找出共同的成员ID。
        $conflicting_ids = array_intersect($team1_members, $team2_members);

        // 步骤 5: 如果交集为空，说明没有冲突，返回成功结果。
        if (empty($conflicting_ids)) {
            return [
                'has_conflict' => false,
                'conflicting_members' => [],
            ];
        }

        // 步骤 6: 如果存在冲突，查询这些冲突ID对应的用户名，以便生成更友好的错误信息。
        $conflicting_users = UserModel::whereIn('c_username', $conflicting_ids)
            ->pluck('c_username')
            ->all();

        // 步骤 7: 返回包含冲突信息的失败结果。
        return [
            'has_conflict' => true,
            'conflicting_members' => $conflicting_users,
        ];
    }


    public function get_teams_users($team1_id=0,$team2_id=0)
    {
        $mod = new TeamUsers();
        $list = $mod->whereIn('team_id',[$team1_id,$team2_id])->get();
        $res = [];
        foreach($list as $k=>$v){
            $res[] = $v->user_id;
        }
        return $res;
    }


}
