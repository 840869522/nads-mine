<?php
namespace App\Models\Course;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB as db;
use Illuminate\Support\Facades\Log;
use App\Utils\GlobalResponse;
use Illuminate\Support\Str;

class PapersModel extends Model{
    protected $table = 'c_papers';
    public $timestamps = false;
    protected $primaryKey = 'c_id';
    protected $casts = [
        'c_id' => 'string', // 指定ID为主键（如果是UUID）
    ];
    public $pageSize = 20;

    /**
     * Notes:添加试卷
     * User: zhangnan
     * DateTime: 2025/7/21 17:44
     * @param $c_test_id
     * @param $qusetion_list
     * @return bool
     */
    public function create_paper_info($c_test_id="",$qusetion_list=[])
    {
        foreach($qusetion_list as $k=>$v){
            $mod = new PapersModel();
            $mod->c_id = Str::uuid()->toString();
            $mod->c_test_id =$c_test_id;
            $mod->c_questions =json_encode($v['question'],JSON_UNESCAPED_UNICODE);
            $mod->c_answers =json_encode($v['answer'],JSON_UNESCAPED_UNICODE);
            $res = $mod->save();
            if(!$res){
                return false;
            }
        }
        return true;
    }


    /**
     * Notes:修改试卷
     * User: zhangnan
     * DateTime: 2025/7/21 17:52
     * @param $c_test_id
     * @param $qusetion_list
     * @return bool
     */
    public function update_paper_info($c_test_id="",$qusetion_list=[])
    {
        $del = $this->del_paper_by_test_id($c_test_id);
        if(!$del){
            return false;
        }
        foreach($qusetion_list as $k=>$v){
            $mod = new PapersModel();
            $mod->c_id = Str::uuid()->toString();
            $mod->c_test_id =$c_test_id;
            $mod->c_questions =json_encode($v['question'],JSON_UNESCAPED_UNICODE);
            $mod->c_answers =json_encode($v['answer'],JSON_UNESCAPED_UNICODE);
            $res = $mod->save();
            if(!$res){
                return false;
            }
        }
        return true;
    }


    /**
     * Notes:删除测试中所有的试卷
     * User: zhangnan
     * DateTime: 2025/7/21 17:51
     * @param $c_test_id
     * @return bool
     */
    public function del_paper_by_test_id($c_test_id="")
    {
        try{
            $mod = new PapersModel();
            $res = $mod->where("c_test_id",$c_test_id)->delete();
            if(!$res){
                return false;
            }
            return true;
        }catch(\Exception $e){
            return false;
        }
    }

    /**
     * Notes:获取测试下所有试卷
     * User: zhangnan
     * DateTime: 2025/7/21 18:42
     * @param $c_test_id
     * @return false
     */
    public function get_paper_list($c_test_id="")
    {
        $mod = new PapersModel();
        $res = $mod->where("c_test_id",$c_test_id)->get()->toArray();
        if(empty($res)){
            return false;
        }
        return $res;
    }

    /**
     * Notes:获取试卷信息
     * User: zhangnan
     * DateTime: 2025/7/22 16:15
     * @param $c_id
     * @return false
     */
    public function get_paper_info_by_id($c_id="")
    {
        $mod = new PapersModel();
        $res = $mod->where("c_id",$c_id)->first();
        if(empty($res)){
            return false;
        }
        return $res;
    }

}
?>
