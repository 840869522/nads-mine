<?php
// file: app/Models/ad/Team.php

namespace App\Models\ad;

use App\Models\Users\UserModel;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Team extends Model
{
    use HasFactory;

    protected $table = 'c_teams';
    protected $primaryKey = 'c_id';
    public $timestamps = false;

    protected $fillable = [
        'c_name',
        'c_description',
    ];

    /**
     * 定义一个队伍 (Team) 与其成员 (User) 的关系。
     * 这是一个 "多对多" (BelongsToMany) 关系，通过 c_teams_users 中间表连接。
     *
     * @return \Illuminate\Database\Eloquent\Relations\BelongsToMany
     */
    public function users(): BelongsToMany
    {
        return $this->belongsToMany(
            UserModel::class,
            'c_teams_users',  // 中间表名称
            'team_id',        // 中间表中关联到当前模型(Team)的外键
            'user_id',        // 中间表中关联到目标模型(UserModel)的外键
            'c_id',           // 当前模型(Team)的主键
            'c_username'      // 目标模型(UserModel)的主键
        )
            // withPivot() 告诉 Eloquent 在加载这个关系时，
            // 也要从中间表 c_teams_users 中获取 is_banned 和 role 这两个额外字段。
            ->withPivot('is_banned', 'role');
    }

    /*
     * 如果之前尝试添加过错误的 drills() 方法，请确保它已被删除或注释掉。
     * 例如：
     * public function drills() { ... } // <--- 删除此方法
     */
}
