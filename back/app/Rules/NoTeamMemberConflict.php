<?php

namespace App\Rules;

use Illuminate\Contracts\Validation\Rule;
use App\Models\ad\TeamUsers; // 引入我们的逻辑核心类

/**
 * NoTeamMemberConflict 自定义验证规则
 *
 * 这个类实现了 Laravel 的 Rule 接口，充当了验证系统和我们业务逻辑之间的桥梁。
 */
class NoTeamMemberConflict implements Rule
{
    /**
     * 用于存储需要与之比较的另一个队伍的ID。
     * @var int
     */
    protected $otherTeamId;

    /**
     * 用于在验证失败时，存储冲突的成员列表，以便生成错误信息。
     * @var array
     */
    protected $conflictingMembers = [];

    /**
     * 构造函数。当我们在控制器中 new NoTeamMemberConflict($otherId) 时，
     * 这个方法会被调用，将另一个队伍的ID保存到类属性中。
     *
     * @param  int  $otherTeamId
     */
    public function __construct(int $otherTeamId)
    {
        $this->otherTeamId = $otherTeamId;
    }

    /**
     * 这是规则的核心。Laravel 在验证时会自动调用此方法。
     *
     * @param  string  $attribute  正在被验证的字段名 (例如 'c_red_team_id')
     * @param  mixed   $value      正在被验证的字段的值 (例如 1)
     * @return bool                 返回 true 代表验证通过，false 代表失败。
     */
    public function passes($attribute, $value)
    {
        // 调用我们的业务逻辑核心，传入当前字段的值和构造函数传入的另一个ID。
        $conflictCheck = TeamUsers::verifyConflict((int)$value, $this->otherTeamId);

        // 检查业务逻辑的返回结果
        if ($conflictCheck['has_conflict']) {
            // 如果有冲突，将冲突成员列表保存起来
            $this->conflictingMembers = $conflictCheck['conflicting_members'];
            // 返回 false，告诉 Laravel 验证失败了。
            return false;
        }

        // 如果没有冲突，返回 true，告诉 Laravel 验证通过。
        return true;
    }

    /**
     * 获取验证错误消息。
     * 这个方法只有在 passes() 返回 false 时，才会被 Laravel 调用。
     *
     * @return string
     */
    public function message()
    {
        // 使用之前保存的冲突成员列表，生成一个对用户非常友好的错误信息。
        $names = implode(', ', $this->conflictingMembers);
        return "成员冲突：用户 \"{$names}\" 同时存在于两个队伍中。";
    }
}
