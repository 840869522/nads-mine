<?php
namespace App\Models\Course;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB as db;
use Illuminate\Support\Facades\Log;
use App\Utils\GlobalResponse;

class QuestionsModel extends Model{
    protected $table = 'c_questions';
    public $timestamps = false;
    protected $primaryKey = 'c_id';
    protected $casts = [
        'c_id' => 'string', // 指定ID为主键（如果是UUID）
    ];
    public $pageSize = 20;

    /**
     * Notes:添加题目
     * User: zhangnan
     * DateTime: 2025/7/10 14:27
     * @param $c_id
     * @param $c_course_id
     * @param $c_question
     * @param $c_answer
     * @param $c_tag
     * @return bool
     */
    public function create_question_info($c_id="",$c_course_id="",$c_question="",$c_answer="",$c_tag="",$type=0,$content=[])
    {
        DB::beginTransaction();
        $mod = new QuestionsModel();
        $mod->c_id = $c_id;
        $mod->c_course_id = $c_course_id;
        $mod->c_question = $c_question;
        $mod->c_answer = $c_answer;
        $mod->c_tag = $c_tag;
        $mod->c_type = $type;
        try{
            $res = $mod->save();
            if(!$res){
                return false;
            }
            $question_options_mod = new QuestionsOptionsModel();
            $question_options_res = $question_options_mod->create_question_options_info($c_id,$content);
            if(!$question_options_res){
                DB::rollback();
                return false;
            }
            DB::commit();
            return true;
        }catch(\Exception $e){
            DB::rollback();
            DLOG("[{$e->getLine()}]{$e->getMessage()}",'error','question_log');
            return false;
        }
    }

    /**
     * Notes:验证主键唯一性
     * User: zhangnan
     * DateTime: 2025/7/9 16:06
     * @param $c_id
     * @return bool
     */
    public function verify_c_id_only($c_id="")
    {
        $mod = new QuestionsModel();
        $cnt = $mod->where('c_id',$c_id)->count();
        if($cnt>0){
            return false;
        }
        return true;
    }

    /**
     * Notes:通过c_id获取题目详情
     * User: zhangnan
     * DateTime: 2025/7/9 16:08
     * @param $c_id
     * @return false
     */
    public function get_question_info_by_c_id($c_id="",$type=0)
    {
        $mod = new QuestionsModel();
        $find = $mod->where('c_id',$c_id)->first();
        if(empty($find)){
            return false;
        }
        if($type==1){
            $QuestionsOptionsMod = new QuestionsOptionsModel();
            $find->connect = $QuestionsOptionsMod->get_question_options_by_question_id($find->c_id);
        }
        return $find;
    }


    /**
     * 修改题目
     * Notes:
     * User: zhangnan
     * DateTime: 2025/7/10 14:28
     * @param $info
     * @param $c_id
     * @param $c_course_id
     * @param $c_question
     * @param $c_answer
     * @param $c_tag
     * @return bool
     */
    public function update_question_info($info="",$c_id="",$c_course_id="",$c_question="",$c_answer="",$c_tag="",$type=0,$content=[])
    {
        DB::beginTransaction();
        $info->c_course_id = $c_course_id;
        $info->c_question = $c_question;
        $info->c_answer = $c_answer;
        $info->c_tag = $c_tag;
        $info->c_type = $type;
        try{
            $res = $info->save();
            if(!$res){
                return false;
            }
            $question_options_mod = new QuestionsOptionsModel();
            $question_options_res = $question_options_mod->update_question_options_info($c_id,$content);
            if(!$question_options_res){
                DB::rollback();
                return false;
            }
            DB::commit();
            return true;
        }catch(\Exception $e){
            DB::rollback();
            DLOG("[{$e->getLine()}]{$e->getMessage()}",'error','question_log');
            return false;
        }
    }


    /**
     * Notes:删除题目
     * User: zhangnan
     * DateTime: 2025/7/9 16:24
     * @param $c_id
     * @return bool
     */
    public function del_question_info($c_id="")
    {
        DB::beginTransaction();
        try{
            $question_options_mod = new QuestionsOptionsModel();
            $question_options_res = $question_options_mod->del_question_options_info($c_id);
            if(!$question_options_res){
                DB::rollback();
                return false;
            }

            $mod = new QuestionsModel();
            $res = $mod->where("c_id",$c_id)->delete();
            if(!$res){
                DB::rollback();
                return false;
            }
            DB::commit();
            return true;
        }catch(\Exception $e){
            DB::rollback();
            DLOG("[{$e->getLine()}]{$e->getMessage()}",'error','question_log');
            return false;
        }
    }

    /**
     * Notes:获取题目列表
     * User: zhangnan
     * DateTime: 2025/7/11 10:22
     * @param $pageSize
     * @param $page
     * @return mixed
     */
    public function get_question_list($pageSize=0,$page=0)
    {
        if(empty($pageSize)){
            $pageSize = $this->pageSize;
        }
        $mod = new QuestionsModel();
        $count = $mod->count();
        if(empty($page)){
            $list = $mod->paginate($pageSize);
        }else{
            $list = $mod->paginate($pageSize, ['*'], 'page', $page);
        }
        $list->each(function($item){
            $QuestionsOptionsMod = new QuestionsOptionsModel();
            $item->connect = $QuestionsOptionsMod->get_question_options_by_question_id($item->c_id);
        });
        $data = $list->items();
        $res = array(
            'page'=>$page,
            'pageSize'=>$pageSize,
            'count'=>$count,
            'data'=>$data
        );
        return $res;
    }

}
?>
