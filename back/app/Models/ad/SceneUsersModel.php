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



}
