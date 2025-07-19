<?php
namespace App\Models\Course;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB as db;
use Illuminate\Support\Facades\Log;
use App\Utils\GlobalResponse;
use Illuminate\Support\Str;

class PaperRulesModel extends Model{
    protected $table = 'c_paper_rules';
    public $timestamps = false;
    protected $primaryKey = 'c_id';
    protected $casts = [
        'c_id' => 'string', // 指定ID为主键（如果是UUID）
    ];
    public $pageSize = 20;


    /**
     * Notes:添加组卷规则
     * User: zhangnan
     * DateTime: 2025/7/15 16:33
     * @param $data
     * @return bool
     */
    public function create_paper_rules_info($c_test_id="",$data=[])
    {
        DB::beginTransaction();
        try{
            foreach($data as $k=>$v){
                $mod = new PaperRulesModel();
                $mod->c_id= $v['key'];
                $mod->c_test_id= $c_test_id;
                $mod->c_tag= $v['tag'];
                $mod->c_type= $v['type'];
                $mod->c_count= $v['count'];;
                $mod->c_score= $v['score'];
                $res = $mod->save();
                if(!$res){
                    DB::rollback();
                    return false;
                }
            }
            DB::commit();
            return true;
        }catch(\Exception $e){
            DB::rollback();
            DLOG("[{$e->getLine()}]{$e->getMessage()}",'error','paper_rules_log');
            return false;
        }

    }


    /**
     * 修改组卷规则
     * Notes:
     * User: zhangnan
     * DateTime: 2025/7/15 16:38
     * @param $c_test_id
     * @param $data
     * @return bool
     */
    public function update_paper_rules_info($c_test_id="",$data=[])
    {
        DB::beginTransaction();
        try{
            $del = $this->del_paper_rules_by_test_id($c_test_id);
            if(!$del){
                DB::rollback();
                return false;
            }
            foreach($data as $k=>$v){
                $mod = new PaperRulesModel();
                $mod->c_id= $v['key'];
                $mod->c_test_id= $c_test_id;
                $mod->c_tag= $v['tag'];
                $mod->c_type= $v['type'];
                $mod->c_count= $v['count'];;
                $mod->c_score= $v['score'];
                $res = $mod->save();
                if(!$res){
                    DB::rollback();
                    return false;
                }
            }
            DB::commit();
            return true;
        }catch(\Exception $e){
            DB::rollback();
            DLOG("[{$e->getLine()}]{$e->getMessage()}",'error','paper_rules_log');
            return false;
        }
    }


    /**
     * Notes:通过测试id删除组卷规则
     * User: zhangnan
     * DateTime: 2025/7/15 16:35
     * @param $c_test_id
     * @return bool
     */
    public function del_paper_rules_by_test_id($c_test_id="")
    {
        try{
            $mod = new PaperRulesModel();
            $res = $mod->where("c_test_id",$c_test_id)->delete();
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
     * Notes:通过c_test_id查询组卷规则
     * User: zhangnan
     * DateTime: 2025/7/15 16:39
     * @param $c_id
     * @return false
     */
    public function get_paper_rules_info($c_test_id="")
    {
        $mod = new PaperRulesModel();
        $find = $mod->where('c_test_id',$c_test_id)->get();
        if(empty($find)){
            return false;
        }
        return $find;
    }


    /**
     * Notes:验证id是否存在
     * User: zhangnan
     * DateTime: 2025/7/16 13:38
     * @param $c_id
     * @return bool
     */
    public function verify_paper_rules_c_id($c_id="",$test_id="")
    {
        $mod = new PaperRulesModel();
        if(empty($test_id)){
            $cnt = $mod->where('c_id',$c_id)->count();
        }else{
            $cnt = $mod->where('c_id',$c_id)->where('c_test_id','<>',$test_id)->count();
        }

        if($cnt>0){
            return false;
        }
        return true;
    }


}
?>
