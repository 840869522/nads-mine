<?php
namespace App\Models\Course;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB as db;
use Illuminate\Support\Facades\Log;
use App\Utils\GlobalResponse;

class QuestionsOptionsModel extends Model{
    protected $table = 'c_question_options';
    public $timestamps = false;


    /**
     * Notes:批量增加题目选项
     * User: zhangnan
     * DateTime: 2025/7/10 15:25
     * @param $c_question_id
     * @param $content
     * @return bool
     */
    public function create_question_options_info($c_question_id="",$content = [])
    {
        foreach($content as $k=>$v){
            $mod = new QuestionsOptionsModel();
            $mod->c_id=$v['key'];
            $mod->c_question_id = $c_question_id;
            $mod->c_content = $v['option'];
            try{
                $res = $mod->save();
                if(!$res){
                    return false;
                }
            }catch(\Exception $e){
                DLOG("[{$e->getLine()}]{$e->getMessage()}",'error','question_options_log');
                return false;
            }

        }
        return true;
    }



    public function verify_c_id_only($c_id="",$c_question_id="")
    {
        $mod = new QuestionsOptionsModel();
        $where['c_id'] = $c_id;
        if(!empty($c_question_id)){
            $where[] = ['c_question_id','<>',$c_question_id];
        }
        $cnt = $mod->where($where)->count();
        if($cnt>0){
            return false;
        }
        return true;
    }


    /**
     * Notes:修改选项
     * User: zhangnan
     * DateTime: 2025/7/10 16:45
     * @param $c_question_id
     * @param $content
     * @return bool
     */
    public function update_question_options_info($c_question_id="",$content = [])
    {
        $del = $this->del_question_options_info($c_question_id);
        if(!$del){
            return false;
        }
        foreach($content as $k=>$v){
            $mod = new QuestionsOptionsModel();
            $mod->c_id=$v['key'];
            $mod->c_question_id = $c_question_id;
            $mod->c_content = $v['option'];
            try{
                $res = $mod->save();
                if(!$res){
                    return false;
                }
            }catch(\Exception $e){
                DLOG("[{$e->getLine()}]{$e->getMessage()}",'error','question_options_log');
                return false;
            }

        }
        return true;
    }


    /**
     * Notes:通过题目id删除选项
     * User: zhangnan
     * DateTime: 2025/7/10 16:44
     * @param $c_question_id
     * @return bool
     */
    public function del_question_options_info($c_question_id="")
    {
        $mod = new QuestionsOptionsModel();
        $res = $mod->where('c_question_id',$c_question_id)->delete();
        if(!$res){
            return false;
        }
        return true;
    }


    /**
     * Notes:通过题目获取选项
     * User: zhangnan
     * DateTime: 2025/7/11 10:39
     * @param $c_question_id
     * @return mixed
     */
    public function get_question_options_by_question_id($c_question_id="")
    {
        $mod = new QuestionsOptionsModel();
        $res = $mod->where('c_question_id',$c_question_id)->get();
        return $res;
    }


}
?>
