<?php

namespace App\Models\ad;

// 确保引入了 User 模型和 BelongsToMany 关系类型
use App\Models\Users\UserModel; // 假设您的用户模型是 App\Models\User，如果不是请修改
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
        'c_color',
        'c_description',
    ];

    /**
     * 定义与 User 模型的多对多关系。
     *
     * @return BelongsToMany
     */
    public function users(): BelongsToMany
    {
        // Eloquent 会根据模型名自动推断中间表为 'team_user'
        // 因为我们的表名是 c_teams_users，所以需要手动指定所有参数
        return $this->belongsToMany(
            UserModel::class,       // 关联的模型
            'c_teams_users',   // 中间表名
            'team_id',         // 本模型在中间表的外键名
            'user_id'          // 关联模型在中间表的外键名
        );
    }
}
