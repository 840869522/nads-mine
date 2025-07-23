<?php

namespace App\Models\scenario;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB; // ★★★ 确保引入了 DB Facade ★★★
use App\Utils\GlobalResponse;
use Illuminate\Support\Facades\Log;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use App\Models\Users\UserModel; // 确保已引入
use App\Models\ScenarioPermission; // 确保已引入自定义的 Pivot 模型
// ★★★ 确保引入了 GlobalResponse ★★★

class SceneConfig extends Model
{
    use HasFactory;

    /**
     * 【修正】手动指定与模型关联的、正确的小写表名。
     * @var string
     */
    protected $table = 'c_scene_configs';

    /**
     * 【修正】手动指定正确的主键字段名。
     * @var string
     */
    protected $primaryKey = 'c_config_id';

    /**
     * 【修正】明确告知 Laravel 时间戳字段的自定义名称。
     * 这是解决 "Unknown column 'created_at'" 错误的关键。
     */
    const CREATED_AT = 'c_created_at';
    const UPDATED_AT = 'c_updated_at';

    /**
     * 启用 Eloquent 的自动时间戳管理。
     * 因为我们定义了上面的常量，所以 Laravel 会自动管理 c_created_at 和 c_updated_at。
     * @var bool
     */
    public $timestamps = true;

    /**
     * 【修正】定义可批量赋值的属性，所有字段名都已更新为 c_ 前缀。
     * @var array<int, string>
     */
    protected $fillable = [
        'c_name',
        'c_description',
        'c_scene', // 你的数据库字段是 c_scene (json类型)
    ];

    /**
     * 【修正】定义属性类型转换，将 c_scene 字段自动转换为数组/对象。
     * @var array<string, string>
     */
    protected $casts = [
        'c_scene' => 'array',
    ];

    // 如果 SceneConfig 有任何关联关系，可以在这里定义
    // 例如，一个场景配置可以被多个攻防演练配置使用
    // public function adConfigs()
    // {
    //     return $this->hasMany(AdConfig::class, 'c_scene_config_id', 'c_config_id');
    // }

    /**
     * 获取指定场景ID的权限用户列表。
     *
     * @param string|int $scenarioId
     * @return array 返回一个包含用户名的简单数组，例如: ['user1', 'user2']
     */
    public static function getPermissionedUsers($scenarioId): array
    {
        $sql = "SELECT c_username FROM `c_scene_users` WHERE c_scene_configs_id = ?";
        try {
            $results = DB::select($sql, [$scenarioId]);
            // 将返回的对象数组转换为纯字符串数组
            return array_map(fn($row) => $row->c_username, $results);
        } catch (QueryException $e) {
            Log::info('[DATABASE]: FAILED TO GET SCENE PERMISSIONS: ' . $e->getMessage());
            return [];
        }
    }

    /**
     * 同步一个场景的权限用户列表 (先删后插)。
     *
     * @param string|int $scenarioId
     * @param array $userIds 新的权限用户名数组
     * @return int 返回 GlobalResponse 状态码
     */
    public static function syncPermissions($scenarioId, array $userIds): int
    {
        DB::beginTransaction();
        try {
            // 步骤 1: 删除此场景的所有旧权限
            DB::table('c_scene_users')->where('c_scene_configs_id', $scenarioId)->delete();

            // 步骤 2: 如果新的用户列表不为空，则批量插入新权限
            if (!empty($userIds)) {
                $insertData = array_map(function($userId) use ($scenarioId) {
                    return [
                        'c_scene_configs_id' => $scenarioId,
                        'c_username' => $userId,
                        'created_at' => now(), // c_scene_users 表需要一个 created_at 字段
                    ];
                }, $userIds);

                DB::table('c_scene_users')->insert($insertData);
            }

            DB::commit();
            return GlobalResponse::$DATABASE_SUCCESS_CODE;

        } catch (QueryException $e) {
            DB::rollBack();
            Log::info('[DATABASE]: FAILED TO SYNC PERMISSIONS: ' . $e->getMessage());
            return GlobalResponse::$DATABASE_ERROR_CODE;
        }
    }

    public function users(): BelongsToMany
    {
        return $this->belongsToMany(
            UserModel::class,
            'c_scene_users',       // 中间表名
            'c_scene_configs_id',  // 本模型在中间表的外键名
            'c_username'           // 关联模型在中间表的外键名
        )
            ->using(ScenarioPermission::class) // ★ 使用自定义的透视模型
            ->withTimestamps('created_at', null); // ★ 让关系知道如何处理时间戳
    }
}
