<?php

namespace App\Models\ad;

use App\Models\Users; // 【重要】引入 User 模型，假设它在 App\Models 命名空间下
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * 裁判模型
 *
 * @property int $c_id 裁判自增ID
 * @property int $c_user_id 关联的用户ID
 * @property string|null $c_real_name 裁判真实姓名
 * @property string $c_level 裁判级别 (Head, Standard, Assistant)
 * @property string|null $c_expertise 负责领域
 * @property string|null $c_contact_info 内部联系方式
 * @property \Illuminate\Support\Carbon $create_at 创建时间
 * @property \Illuminate\Support\Carbon $update_at 更新时间
 *
 * @property-read User $user 关联的用户模型实例
 */
class Referee extends Model
{
    use HasFactory;

    /**
     * 与模型关联的表名
     *
     * @var string
     */
    protected $table = 'c_referees';

    /**
     * 表的主键
     *
     * @var string
     */
    protected $primaryKey = 'c_id';

    /**
     * 指示模型是否应被记入时间戳。
     * 你的表有 create_at 和 update_at，所以这里是 true。
     *
     * @var bool
     */
    public $timestamps = true;

    /**
     * 模型的时间戳列的名称。
     *
     * @var string
     */
    const CREATED_AT = 'create_at';
    const UPDATED_AT = 'update_at';

    /**
     * 可批量赋值的属性。
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'c_user_id',
        'c_real_name',
        'c_level',
        'c_expertise',
        'c_contact_info',
    ];

    /**
     * 应为该模型转换的属性。
     *
     * @var array
     */
    protected $casts = [
        // 'create_at' 和 'update_at' Eloquent 会自动处理为 Carbon 实例
    ];

    /**
     * 定义与 User 模型的关系（一个裁判属于一个用户）。
     *
     * @return \Illuminate\Database\Eloquent\Relations\BelongsTo
     */
    public function user(): BelongsTo
    {
        // 第一个参数是关联的模型类
        // 第二个参数是 c_referees 表中的外键
        // 第三个参数是 c_users 表中的主键
        return $this->belongsTo(Users\UserModel::class, 'c_user_id', 'id');
    }
}
