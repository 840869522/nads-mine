<?php
namespace App\Models\Course;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB as db;
use Illuminate\Support\Facades\Log;
use App\Utils\GlobalResponse;
use Illuminate\Support\Str;

class TestsModel extends Model{
    protected $table = 'c_tests';
    public $timestamps = false;
    protected $primaryKey = 'c_id';
    protected $casts = [
        'c_id' => 'string', // 指定ID为主键（如果是UUID）
    ];
    public $pageSize = 20;


    /**
     * Notes:添加测试
     * User: zhangnan
     * DateTime: 2025/7/11 13:41
     * @param $c_name
     * @param $c_description
     * @param $c_paper_count
     * @param $c_start
     * @param $c_end
     * @param $c_course_id
     * @return bool
     */
    public function create_test_info($c_name="",$c_test_type="",$c_type="",$c_description="",$c_paper_count=0,$c_start="",$c_end="",$c_course_id="")
    {
        $mod = new TestsModel();
        $mod->c_id = Str::uuid()->toString();;
        $mod->c_name = $c_name;
        $mod->c_test_type = $c_test_type;
        $mod->c_type = $c_type;
        $mod->c_description = $c_description;
        $mod->c_paper_count = $c_paper_count;
        $mod->c_start = $c_start;
        $mod->c_end = $c_end;
        $mod->c_course_id = $c_course_id;
        try{
            $res = $mod->save();
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
 * Notes:修改测试
 * User: zhangnan
 * DateTime: 2025/7/11 13:43
 * @param $info
 * @param $c_name
 * @param $c_test_type
 * @param $c_type
 * @param $c_description
 * @param $c_paper_count
 * @param $c_start
 * @param $c_end
 * @param $c_course_id
 * @return bool
 */
public function update_test_info($info="",$c_name="",$c_test_type="",$c_type="",$c_description="",$c_paper_count=0,$c_start="",$c_end="",$c_course_id="")
{
    $info->c_name = $c_name;
    $info->c_test_type = $c_test_type; // 修复：用$info而非未定义的$mod
    $info->c_type = $c_type; // 修复：用$info而非未定义的$mod
    $info->c_description = $c_description;
    $info->c_paper_count = $c_paper_count;
    $info->c_start = $c_start;
    $info->c_end = $c_end;
    $info->c_course_id = $c_course_id;
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
     * 获取测试详情
     * Notes:
     * User: zhangnan
     * DateTime: 2025/7/11 13:44
     * @param $c_id
     * @return false
     */
    public function get_test_info($c_id="")
    {
        $mod = new TestsModel();
        $find = $mod->where('c_id',$c_id)->first();
        if(empty($find)){
            return false;
        }
        return $find;
    }


    /**
     * 删除测试
     * Notes:
     * User: zhangnan
     * DateTime: 2025/7/11 13:45
     * @param $c_id
     * @return bool
     */
    public function del_test_info($c_id="")
    {
        DB::beginTransaction();
        try{
            $mod = new TestsModel();
            $res = $mod->where("c_id",$c_id)->delete();
            if(!$res){
                DB::rollback();
                return false;
            }
            $papers_rule_mod = new PaperRulesModel();
            $del_papers_rule = $papers_rule_mod->del_paper_rules_by_test_id($c_id);
            if(!$del_papers_rule){
                DB::rollback();
                return false;
            }
            $paper_mod = new PapersModel();
            $paper_del = $paper_mod->del_paper_by_test_id($c_id);
            if(!$paper_del){
                DB::rollback();
                return false;
            }
            DB::commit();
            return true;
        }catch(\Exception $e){
            DB::rollback();
            DLOG("[{$e->getLine()}]{$e->getMessage()}",'error','test_log');
            return false;
        }
    }

    /**
     * Notes:获取测试列表
     * User: zhangnan
     * DateTime: 2025/7/11 13:46
     * @param $pageSize
     * @param $page
     * @return array
     */
    public function get_test_list($pageSize=0,$page=0)
    {
        if(empty($pageSize)){
            $pageSize = $this->pageSize;
        }
        $mod = new TestsModel();
        $count = $mod->count();
        if(empty($page)){
            $list = $mod->paginate($pageSize);
        }else{
            $list = $mod->paginate($pageSize, ['*'], 'page', $page);
        }
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
