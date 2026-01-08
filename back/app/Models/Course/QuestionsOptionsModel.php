<?php
namespace App\Models\Course;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB as db;
use Illuminate\Support\Facades\Log;
use App\Utils\GlobalResponse;

class QuestionsOptionsModel extends Model{
    protected $table = 'c_question_options';
    protected $casts = [
        'c_id' => 'string', // 指定ID为主键（如果是UUID）
    ];
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
            $where[] = ['c_question_id','=',$c_question_id];
        }
        $cnt = $mod->where($where)->count();
        if($cnt>0){
            return false;
        }
        return true;
    }


       public function update_question_options_info($c_question_id="",$content = [])
{
    // 开启事务
    DB::beginTransaction();
    
    try {
        // 1. 删除原有选项
        $del = $this->where('c_question_id', $c_question_id)->delete();
        
        // 2. 添加新选项
        foreach($content as $k=>$v){
            $mod = new QuestionsOptionsModel();
            
            // 联合主键的两个字段都要赋值
            $mod->c_id = $v['key'];           // 选项key（A/B/C/D）
            $mod->c_question_id = $c_question_id; // 题目ID
            $mod->c_content = $v['option'];   // 选项内容
            
            $res = $mod->save();
            if(!$res){
                DB::rollback();
                return false;
            }
        }
        
        DB::commit();
        return true;
        
    } catch(\Exception $e){
        DB::rollback();
        DLOG("[{$e->getLine()}]{$e->getMessage()}",'error','question_options_log');
        return false;
    }
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
        try {
            $mod = new QuestionsOptionsModel();
            $res = $mod->where('c_question_id', $c_question_id)->delete();
            
            // 删除成功或没有数据都返回 true
            // $res 可能是整数（删除的行数）或布尔值
            // 对于没有数据的情况，delete() 可能返回 0
            return $res !== false;  // 只要不是 false 就返回 true
            
        } catch (\Exception $e) {
            DLOG("[{$e->getLine()}]{$e->getMessage()}", 'error', 'question_log');
            return false;
        }
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
