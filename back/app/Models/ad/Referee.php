<?php
// file: app/Models/ad/Referee.php (正确的内容)

namespace App\Models\ad;

use App\Models\Users\UserModel;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Referee extends Model
{
    use HasFactory;

    protected $table = 'c_referees';
    public $incrementing = false;
    protected $primaryKey = ['c_ad_config_id', 'c_user_id'];
    public $timestamps = true;
    const CREATED_AT = 'c_create_at';
    const UPDATED_AT = 'c_update_at';

    protected $fillable = [
        'c_user_id',
        'c_ad_config_id',
        'c_level',
    ];

    /**
     * 定义与 User 模型的关系。
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(UserModel::class, 'c_user_id', 'c_username');
    }

    /**
     * 定义与 AdConfig 模型的关系。
     */
    public function adConfig(): BelongsTo
    {
        return $this->belongsTo(AdConfig::class, 'c_ad_config_id', 'c_id');
    }
}
