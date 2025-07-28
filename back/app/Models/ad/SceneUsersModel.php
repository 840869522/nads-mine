<?php

namespace App\Models\ad;

// 我们只需要 DB Facade 来查询数据库，和 UserModel 来获取用户名
use App\Models\Course\TestsModel;
use Illuminate\Support\Facades\DB;
use App\Models\Users\UserModel;
use Illuminate\Database\Eloquent\Model;

/**
 * TeamUsers 逻辑处理类
 *
 * 这个类不继承 Model，因为它不代表数据库中的某一行数据。
 * 它是一个服务类，专门用于封装与队伍成员相关的复杂业务逻辑。
 */
class SceneUsersModel extends Model
{
    protected $table = 'c_scene_users';
    public $timestamps = false;
    public $pageSize = 20;

    public function get_scene_users_info($c_scene_configs_id=0,$c_username="")
    {
        $mod = new SceneUsersModel();
        $cnt = $mod->where('c_scene_configs_id',$c_scene_configs_id)->where("c_username",$c_username)->count();
        if($cnt>0){
            return false;
        }
        return true;
    }


    public function create_scene_users_info($c_scene_configs_id=0,$c_username="")
    {
        $mod = new SceneUsersModel();
        $mod->c_scene_configs_id = $c_scene_configs_id;
        $mod->c_username = $c_username;
        try{
            $res = $mod->save();
            if(!$res){
                return false;
            }
            return true;
        }catch(\Exception $e){
            return false;
        }
    }


    public static function revokePermissions(int $sceneId, array $usernames)
    {
        if (empty($usernames)) {
            return 0;
        }

        // 使用 whereIn 来批量删除
        return static::where('c_scene_configs_id', $sceneId)
            ->whereIn('c_username', $usernames)
            ->delete();
    }

    /**
     * 根据场景ID，移除该场景下的所有用户权限
     *
     * @param int $sceneId
     * @return int The number of records deleted.
     */
    public static function revokeAllPermissionsForScene(int $sceneId)
    {
        return static::where('c_scene_configs_id', $sceneId)->delete();
    }

    // 为了让 create 方法工作，需要定义 fillable
    protected $fillable = ['c_scene_configs_id', 'c_username'];

    // 我们也把另外两个方法改成静态的，并优化一下
    public static function userHasPermission(int $sceneId, string $username)
    {
        return static::where('c_scene_configs_id', $sceneId)
            ->where('c_username', $username)
            ->exists();
    }

    public static function grantPermission(int $sceneId, string $username)
    {
        try {
            // 使用 firstOrCreate 避免重复创建和捕获异常
            static::firstOrCreate([
                'c_scene_configs_id' => $sceneId,
                'c_username'         => $username,
            ]);
            return true;
        } catch (\Exception $e) {
            // 在真实应用中，这里应该记录日志
            // Log::error("Failed to grant permission for user {$username} in scene {$sceneId}: " . $e->getMessage());
            return false;
        }
    }



}
