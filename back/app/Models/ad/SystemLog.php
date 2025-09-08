<?php

namespace App\Models\ad;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\Models\Users\UserModel;
use Illuminate\Support\Str;

class SystemLog extends Model
{
    use HasFactory;

    // --- 模型核心配置 ---
    protected $table = 'c_system_logs';
    protected $primaryKey = 'c_id';
    public $incrementing = false;
    protected $keyType = 'string';
    // 系统日志通常只有创建时间，没有更新时间
    const CREATED_AT = 'c_timestamp';
    const UPDATED_AT = null;

    /**
     * 可以被批量赋值的属性。
     * 通常系统日志由程序内部创建，很少需要批量赋值，但定义出来以备不时之需。
     */
    protected $fillable = [
        'c_id',
        'c_service_name',
        'c_level',
        'c_message',
        'c_status',
        'c_acknowledged_by',
        'c_resolved_by',
        'c_resolution_notes',
    ];

    /**
     * 模型的默认属性值。
     */
    protected $attributes = [
        'c_status' => 'OPEN',
    ];

    /**
     * 模型的 "booted" 方法。
     */
    protected static function booted()
    {
        static::creating(function ($model) {
            if (empty($model->{$model->getKeyName()})) {
                $model->{$model->getKeyName()} = (string) Str::uuid();
            }
        });
    }

    // --- 模型关联关系 ---

    /**
     * 获取确认此日志的用户。
     */
    public function acknowledgedBy()
    {
        return $this->belongsTo(UserModel::class, 'c_acknowledged_by', 'c_username');
    }

    /**
     * 获取解决此日志的用户。
     */
    public function resolvedBy()
    {
        return $this->belongsTo(UserModel::class, 'c_resolved_by', 'c_username');
    }
}
