<?php

namespace App\Models\scenario;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SceneConfig extends Model
{
    use HasFactory;

    /**
     * 【关键修改】手动指定模型关联的数据表名。
     * 精确匹配数据库中的大写表名 `c_SCENE_CONFIGS`。
     * @var string
     */
    protected $table = 'c_SCENE_CONFIGS';

    /**
     * Manually specify the primary key.
     * @var string
     */
    protected $primaryKey = 'config_id';

    /**
     * Indicates if the model should be timestamped.
     * @var bool
     */
    public $timestamps = true;

    /**
     * The attributes that are mass assignable.
     * @var array<int, string>
     */
    protected $fillable = [
        'name',
        'description',
        'topology_json',
    ];

    /**
     * The attributes that should be cast.
     * @var array<string, string>
     */
    protected $casts = [
        'topology_json' => 'array',
    ];
}
