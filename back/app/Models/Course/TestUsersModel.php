<?php
namespace App\Models\Course;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB as db;
use Illuminate\Support\Facades\Log;
use App\Utils\GlobalResponse;
use Illuminate\Support\Str;

class TestUsersModel extends Model{
    protected $table = 'c_test_users';
    public $timestamps = false;
    protected $primaryKey = 'c_id';
    protected $casts = [
        'c_id' => 'string', // 指定ID为主键（如果是UUID）
    ];
    public $pageSize = 20;


    /**
     * Notes:发卷
     * User: zhangnan
     * DateTime: 2025/7/22 16:00
     * @param $c_test_id
     * @param $c_username
     * @param $c_paper_id
     * @return bool
     */
    public function create_test_users_info($c_test_id="",$c_username="",$c_paper_id="")
    {
        $mod = new TestUsersModel();
        $mod->c_id = Str::uuid()->toString();
        $mod->c_test_id = $c_test_id;
        $mod->c_username = $c_username;
        $mod->c_paper_id = $c_paper_id;
        $mod->c_start = date("Y-m-d H:i:s");
        try{
            $res = $mod->save();
            if(!$res){
                return false;
            }
            return true;
        }catch(\Exception $e){
            DLOG("[{$e->getLine()}]{$e->getMessage()}",'error','test_users_log');
            return false;
        }
    }


    /**
     * Notes:交卷修改
     * User: zhangnan
     * DateTime: 2025/7/22 16:06
     * @param $info
     * @param $c_answers
     * @param $c_score
     * @param $c_correct
     * @return bool
     */
    public function update_test_users_info($info="",$c_answers="",$c_score="",$c_correct=1)
    {
        $info->c_answers = $c_answers;
        $info->c_score = $c_score;
        $info->c_correct = $c_correct;
        $info->c_end = date("Y-m-d H:i:s");;
        $info->c_submit = date("Y-m-d H:i:s");
        try{
            $res = $info->save();
            if(!$res){
                return false;
            }
            return true;
        }catch(\Exception $e){
            DLOG("[{$e->getLine()}]{$e->getMessage()}",'error','test_log');
            return false;
        }
    }


    /**
     * Notes: 通过id查询卷子发放信息
     * User: zhangnan
     * DateTime: 2025/7/22 16:07
     * @param $c_id
     * @return false
     */
    public function get_test_users_info_by_id($c_id="")
    {
        $mod = new TestUsersModel();
        $res = $mod->where('c_id',$c_id)->first();
        if(empty($res)){
            return false;
        }
        return $res;
    }

    /**
     * Notes:检测是否以发放过试卷
     * User: zhangnan
     * DateTime: 2025/7/22 16:13
     * @param $c_test_id
     * @param $user_name
     * @return false
     */
    public function check_test_users_by_user_name($c_test_id="",$user_name="")
    {
        $mod = new TestUsersModel();
        $res = $mod->where('c_test_id',$c_test_id)->where('c_username',$user_name)->first();
        if(empty($res)){
            return false;
        }
        return $res;
    }


    /**
     * Notes:获取试卷发放数据
     * User: zhangnan
     * DateTime: 2025/7/22 17:39
     * @param $test_id
     * @return mixed
     */
    public function get_test_user_by_test_id($test_id="")
    {
        $mod = new TestUsersModel();
        $res = $mod->where('c_test_id',$test_id)->get()->toArray();
        return $res;
    }

}
?>
