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

public function update_paper_info($c_test_id = "", $qusetion_list = [])
{
    if (empty($c_test_id) || empty($qusetion_list)) {
        Log::error('更新试卷失败：参数缺失', [
            'c_test_id' => $c_test_id,
            'qusetion_list_count' => count($qusetion_list)
        ]);
        return false;
    }

    DB::beginTransaction();
    try {
        // 1. 删除旧试卷
        $this->where('c_test_id', $c_test_id)->delete();
        Log::info('删除旧试卷成功', ['test_id' => $c_test_id]);

        // 2. 生成新试卷（适配无options字段的题目）
        foreach ($qusetion_list as $paper) {
            // 检查试卷数据结构
            if (!isset($paper['question']) || !isset($paper['answer'])) {
                throw new \Exception("试卷数据格式错误：缺少question/answer字段");
            }

            $newPaper = new self();
            $newPaper->c_id = Str::uuid()->toString();  // 生成唯一ID
            $newPaper->c_test_id = $c_test_id;          // 关联测试ID
            // 存储题目（无options字段，与组卷逻辑一致）
            $newPaper->c_questions = json_encode($paper['question'], JSON_UNESCAPED_UNICODE);
            // 存储答案
            $newPaper->c_answers = json_encode($paper['answer'], JSON_UNESCAPED_UNICODE);
            
            if (!$newPaper->save()) {
                throw new \Exception("保存新试卷失败");
            }
        }

        DB::commit();
        Log::info('更新试卷成功', [
            'test_id' => $c_test_id,
            'new_paper_count' => count($qusetion_list)
        ]);
        return true;
    } catch (\Exception $e) {
        DB::rollback();
        Log::error('更新试卷异常', [
            'test_id' => $c_test_id,
            'error' => $e->getMessage(),
            'trace' => $e->getTraceAsString()
        ]);
        return false;
    }
}

    /**
     * 通过测试ID删除所有试卷（删除规则时同步调用）
     */
    public function del_paper_by_test_id($c_test_id = "")
    {
        if (empty($c_test_id)) {
            Log::error('删除试卷失败：测试ID为空');
            return false;
        }

        try {
            $deleteCount = self::where('c_test_id', $c_test_id)->delete();
            Log::info('试卷删除成功', [
                'c_test_id' => $c_test_id,
                '删除数量' => $deleteCount
            ]);
            return true;
        } catch (\Exception $e) {
            Log::error('删除试卷异常', [
                'c_test_id' => $c_test_id,
                'error' => $e->getMessage()
            ]);
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
