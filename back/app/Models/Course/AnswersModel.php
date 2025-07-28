<?php
namespace App\Models\Course;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB as db;
use Illuminate\Support\Facades\Log;
use App\Utils\GlobalResponse;
use Illuminate\Support\Str;

class AnswersModel extends Model{
    protected $table = 'c_answers';
    public $timestamps = false;
    protected $primaryKey = 'c_id';
    protected $casts = [
        'c_id' => 'string', // 指定ID为主键（如果是UUID）
    ];
    public $pageSize = 20;

    /**
     * Notes:添加主观答题
     * User: zhangnan
     * DateTime: 2025/7/25 19:04
     * @param $answers_res_data
     * @return bool
     */
    public function create_answers_info($answers_res_data=[])
    {
        foreach ($answers_res_data as $k=>$v){
            $mod = new AnswersModel();
            $mod->c_id = Str::uuid()->toString();
            $mod->c_test_id = $v['test_id'];
            $mod->c_username = $v['username'];
            $mod->c_answer = $v['answer'];
            $mod->c_question_id = $v['question_id'];
            $mod->c_update_at = date('Y-m-d H:i:s');
            $res = $mod->save();
            if(!$res){
                return false;
            }
        }
        return true;
    }


    /**
     * Notes:通过测试id和考生查看主观题答题数据
     * User: zhangnan
     * DateTime: 2025/7/25 19:05
     * @param $test_id
     * @param $username
     * @return mixed
     */
    public function get_answers_list_by_name($test_id="",$username="")
    {
        $mod = new AnswersModel();
        $res = $mod->where('c_test_id',$test_id)->where('c_username',$username)->get()->toArray();
        return $res;
    }


    /**
     * Notes:主观题批卷
     * User: zhangnan
     * DateTime: 2025/7/28 09:55
     * @param $data
     * @param $answre_data
     * @param $c_teacher_name
     * @return bool
     */
    public function batch_answers($data=[],$answre_data=[],$c_test_id="",$user_name="",$c_teacher_name="",$zong_score=0)
    {
        DB::beginTransaction();
        try{
            foreach($data as $k=>$v){
                $mod = new AnswersModel();
                $score = $answre_data[$v['question_id']];
                $res_data = array(
                    'c_update_at'=>date('Y-m-d H:i:s'),
                    'c_score'=>$score,
                    'c_teacher'=>$c_teacher_name,
                    'c_score_at'=>date('Y-m-d H:i:s'),
                );
                $res = $mod->where('c_id',$v['id'])->update($res_data);
                if(!$res){
                    DB::rollback();
                    return false;
                }
            }
            $test_user_mod = new TestUsersModel();
            $test_user_res = $test_user_mod->update_test_user_by_zg($c_test_id,$user_name,$zong_score);
            if(!$test_user_res){
                DB::rollback();
                return false;
            }

            DB::commit();
            return true;
        }catch(\Exception $e){
            DB::rollback();
            DLOG("[{$e->getLine()}]{$e->getMessage()}",'error','batch_answers_log');
            return false;
        }
    }

}
?>
