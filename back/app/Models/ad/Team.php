<?php
// file: app/Models/ad/Team.php

namespace App\Models\ad;

use App\Models\Users\UserModel;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\Models\ad\AdConfig;

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
     * (此方法保持不变)
     *
     * @return \Illuminate\Database\Eloquent\Relations\BelongsToMany
     */
    public function users(): BelongsToMany
    {
        return $this->belongsToMany(
            UserModel::class,
            'c_teams_users',
            'team_id',
            'user_id',
            'c_id',          // 当前模型 (Team) 在中间表的外键对应的本地主键
            'c_username'     // 关联模型 (UserModel) 在中间表的外键对应的本地主键
        )
            // withPivot() 告诉 Eloquent 在加载这个关系时，
            // 也要从中间表 c_teams_users 中获取 is_banned 和 role 这两个额外字段。
            ->withPivot('is_banned', 'role');
    }

    // REMOVED: drillsAsRed() 方法已被移除
    // REMOVED: drillsAsBlue() 方法已被移除

    /**
     * MODIFIED: 新增 drills() 方法以定义与 AdConfig 模型的 多对多 关系。
     * 这个关系是 AdConfig::teams() 的反向关系，同样通过 c_ad_participants 中间表建立。
     *
     * @return \Illuminate\Database\Eloquent\Relations\BelongsToMany
     */
    public function drills(): BelongsToMany
    {
        return $this->belongsToMany(
            AdConfig::class,
            'c_ad_participants', // 中间表名称
            'c_team_id',         // 中间表中关联到 Team 的外键
            'c_ad_config_id'     // 中间表中关联到 AdConfig 的外键
        );
    }
}
