<?php
// file: app/Models/ad/Team.php

namespace App\Models\ad;

use App\Models\Users\UserModel;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\Models\ad\AdConfig; // <-- 新增: 引入 AdConfig 模型
use Illuminate\Database\Eloquent\Relations\HasMany; // <-- 新增: 引入 HasMany 关系类型

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

    public function users(): BelongsToMany
    {
        return $this->belongsToMany(
            UserModel::class,
            'c_teams_users',
            'team_id',
            'user_id'
        );
    }

    /**
     * 新增: 获取该队伍作为红队参与的所有演练。
     */
    public function drillsAsRed(): HasMany
    {
        return $this->hasMany(AdConfig::class, 'c_red_team_id', 'c_id');
    }

    /**
     * 新增: 获取该队伍作为蓝队参与的所有演练。
     */
    public function drillsAsBlue(): HasMany
    {
        return $this->hasMany(AdConfig::class, 'c_blue_team_id', 'c_id');
    }
}
