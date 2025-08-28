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
 * 获取所有组卷规则（关联测试名称）
 * 
 * @return \Illuminate\Support\Collection
 */
public function get_all_paper_rules()
{
    try {
        // 1. 关联查询c_paper_rules和c_tests表，获取测试名称
        $rules = DB::table('c_paper_rules')
            // 关联c_tests表（通过c_test_id匹配）
            ->leftJoin('c_tests', 'c_paper_rules.c_test_id', '=', 'c_tests.c_id')
            ->select([
                'c_paper_rules.c_id',          // 规则ID（数据库实际字段，非key）
                'c_paper_rules.c_test_id',     // 测试ID
                'c_tests.c_name as testName',  // 测试名称（别名）
                'c_paper_rules.c_type',        // 题型（带c_前缀）
                'c_paper_rules.c_tag',         // 标签（带c_前缀）
                'c_paper_rules.c_count',       // 题数（带c_前缀）
                'c_paper_rules.c_score'        // 分数（带c_前缀）
            ])
            ->get();

        // 2. 按c_test_id分组，确保不引用不存在的$key属性
        return $rules->groupBy('c_test_id')->map(function ($group, $testId) {
            return (object)[
                'testId' => $testId,
                'testName' => $group[0]->testName ?? '未知名称', // 兼容测试名称为空
                'items' => $group->map(function ($item) {
                    // 只返回实际存在的字段，不包含$key
                    return (object)[
                        'c_id' => $item->c_id,        // 规则ID（数据库字段）
                        'c_type' => $item->c_type,    // 题型
                        'c_tag' => $item->c_tag,      // 标签
                        'c_count' => $item->c_count,  // 题数
                        'c_score' => $item->c_score   // 分数
                    ];
                })->values() // 转换为数组格式
            ];
        })->values();

    } catch (\Exception $e) {
        // 记录错误日志，便于排查
        DLOG("[get_all_paper_rules错误]{$e->getMessage()}", 'error', 'paper_rules_log');
        return collect([]); // 异常时返回空集合，避免前端崩溃
    }
}

/**
     * 添加组卷规则
     * @param string $c_test_id 测试ID
     * @param array $data 规则数据
     * @param array $question_list 题目列表
     * @return bool
     */
    public function create_paper_rules_info($c_test_id = "", $data = [], $question_list = [])
    {
        // 验证必填参数
        if (empty($c_test_id) || empty($data)) {
            return false;
        }
        
        DB::beginTransaction();
        try {
            foreach ($data as $item) {
                // 验证单条规则数据
                if (empty($item['tag']) || !isset($item['type']) || !isset($item['count']) || !isset($item['score'])) {
                    DB::rollback();
                    return false;
                }
                
                $mod = new PaperRulesModel();
                // 不再手动设置c_id，数据库会自动生成
                $mod->c_test_id = $c_test_id;
                $mod->c_tag = $item['tag'];
                $mod->c_type = $item['type'];
                $mod->c_count = $item['count'];
                $mod->c_score = $item['score'];
                
                if (!$mod->save()) {
                    DB::rollback();
                    return false;
                }
            }

            // 创建试卷信息
            $paper_mod = new PapersModel();
            $paper_res = $paper_mod->create_paper_info($c_test_id, $question_list);
            if (!$paper_res) {
                DB::rollback();
                return false;
            }
            
            DB::commit();
            return true;
        } catch (\Exception $e) {
            DB::rollback();
            DLOG("[{$e->getLine()}]{$e->getMessage()}", 'error', 'paper_rules_log');
            return false;
        }
    }
    
    /**
     * 更新组卷规则
     * @param string $c_test_id 测试ID
     * @param array $data 新的规则数据
     * @return bool
     */
    public function update_paper_rules_info($c_test_id = "", $data = [])
    {
        if (empty($c_test_id) || empty($data)) {
            return false;
        }
        
        DB::beginTransaction();
        try {
            // 先删除该测试ID下的所有旧规则
            PaperRulesModel::where('c_test_id', $c_test_id)->delete();
            
            // 插入新规则（使用自增ID）
            foreach ($data as $item) {
                if (empty($item['tag']) || !isset($item['type']) || !isset($item['count']) || !isset($item['score'])) {
                    DB::rollback();
                    return false;
                }
                
                $mod = new PaperRulesModel();
                $mod->c_test_id = $c_test_id;
                $mod->c_tag = $item['tag'];
                $mod->c_type = $item['type'];
                $mod->c_count = $item['count'];
                $mod->c_score = $item['score'];
                
                if (!$mod->save()) {
                    DB::rollback();
                    return false;
                }
            }
            
            DB::commit();
            return true;
        } catch (\Exception $e) {
            DB::rollback();
            DLOG("[{$e->getLine()}]{$e->getMessage()}", 'error', 'paper_rules_log');
            return false;
        }
    }
    
    /**
     * 删除测试ID对应的规则
     * @param string $c_test_id 测试ID
     * @return bool
     */
    public function delete_paper_rules($c_test_id = "")
    {
        if (empty($c_test_id)) {
            return false;
        }
        
        try {
            // 删除该测试ID下的所有规则
            PaperRulesModel::where('c_test_id', $c_test_id)->delete();
            return true;
        } catch (\Exception $e) {
            DLOG("[{$e->getLine()}]{$e->getMessage()}", 'error', 'paper_rules_log');
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


    /**
     * Notes:检测该测验是否有主观题
     * User: zhangnan
     * DateTime: 2025/7/25 18:49
     * @param $test_id
     * @return bool
     */
    public function verify_is_zg_question($test_id="")
    {
        $mod = new PaperRulesModel();
        $cnt = $mod->where('c_test_id',$test_id)->where('c_type',4)->count();
        if($cnt==0){
            return false;
        }
        return true;
    }


    /**
     * Notes:获取测试主观题规则
     * User: zhangnan
     * DateTime: 2025/7/25 19:27
     * @param $test_id
     * @return mixed
     */
    public function get_is_zg_question($test_id="")
    {
        $mod = new PaperRulesModel();
        $info = $mod->where('c_test_id',$test_id)->where('c_type',4)->first();
        return $info;
    }



}
?>
