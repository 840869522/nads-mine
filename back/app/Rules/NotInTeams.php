<?php

namespace App\Rules;

use Illuminate\Contracts\Validation\Rule;
use App\Models\ad\TeamUsers; // 引入您的 TeamUsers 模型

class NotInTeams implements Rule
{
    /**
     * 红队ID
     * @var int
     */
    protected $redTeamId;

    /**
     * 蓝队ID
     * @var int
     */
    protected $blueTeamId;

    /**
     * 冲突的用户名列表
     * @var array
     */
    protected $conflictingUsers = [];

    /**
     * 创建一个新的规则实例。
     *
     * @param int $redTeamId
     * @param int $blueTeamId
     * @return void
     */
    public function __construct(int $redTeamId, int $blueTeamId)
    {
        $this->redTeamId = $redTeamId;
        $this->blueTeamId = $blueTeamId;
    }

    /**
     * 确定验证规则是否通过。
     *
     * @param  string  $attribute  被验证的属性名 (这里会是 'referees')
     * @param  mixed  $value      被验证的值 (这里会是裁判数组)
     * @return bool
     */
    public function passes($attribute, $value)
    {
        // 如果红队或蓝队ID无效，则不进行验证，直接通过
        if (!$this->redTeamId || !$this->blueTeamId) {
            return true;
        }

        // 1. 获取红队和蓝队的所有成员用户名
        $teamUserMod = new TeamUsers();
        $teamMembers = $teamUserMod->get_teams_users($this->redTeamId, $this->blueTeamId);
        $teamMemberUsernames = collect($teamMembers)->flip(); // 使用 flip() 创建一个可以快速查找的集合

        // 2. 从请求中获取所有裁判的用户名
        $refereeUsernames = collect($value)->pluck('c_user_id');

        // 3. 找出裁判中也属于红/蓝队成员的用户
        $this->conflictingUsers = $refereeUsernames->filter(function ($username) use ($teamMemberUsernames) {
            return $teamMemberUsernames->has($username);
        })->all();

        // 4. 如果没有冲突的用户，验证通过
        return empty($this->conflictingUsers);
    }

    /**
     * 获取验证错误消息。
     *
     * @return string
     */
    public function message()
    {
        $conflicts = implode(', ', $this->conflictingUsers);
        return "以下用户不能被指派为裁判，因为他们已经是红队或蓝队的成员: {$conflicts}。";
    }
}
