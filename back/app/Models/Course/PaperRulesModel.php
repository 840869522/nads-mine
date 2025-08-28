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

// PaperRulesModel.php
/**
 * 添加组卷规则（支持同题型多规则项）
 * @param string $c_test_id 测试ID
 * @param array $allRules 所有独立规则项
 * @param array $question_list 题目列表
 * @return bool
 */
public function create_paper_rules_info($c_test_id = "", $allRules = [], $question_list = [])
{
    if (empty($c_test_id) || empty($allRules)) {
        return false;
    }
    
    DB::beginTransaction();
    try {
        // 循环保存每个规则项（核心：不合并，每个规则项单独保存）
        foreach ($allRules as $item) {
            $mod = new self();
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

        // 创建试卷
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
        Log::error("添加规则异常: {$e->getMessage()}", ['trace' => $e->getTraceAsString()]);
        return false;
    }
}

/**
 * 更新组卷规则（支持同题型多规则项）
 * @param string $c_test_id 测试ID
 * @param array $allRules 所有独立规则项
 * @param array $question_list 题目列表
 * @return bool
 */
public function update_paper_rules_info($c_test_id, $allRules, $question_list)
{
    return DB::transaction(function () use ($c_test_id, $allRules, $question_list) {
        // 1. 删除旧规则
        $deleteOld = DB::table('c_paper_rules')
            ->where('c_test_id', $c_test_id)
            ->delete();
        if ($deleteOld === false) {
            throw new \Exception("删除旧规则失败");
        }

        // 2. 保存新规则（每个规则项单独保存）
        foreach ($allRules as $item) {
            $newRule = new self();
            $newRule->c_test_id = $c_test_id;
            $newRule->c_tag = $item['tag'];
            $newRule->c_type = $item['type'];
            $newRule->c_count = $item['count'];
            $newRule->c_score = $item['score'];
            if (!$newRule->save()) {
                throw new \Exception("保存规则项失败（标签：{$item['tag']}）");
            }
        }

        // 3. 更新试卷
        $paperModel = new PapersModel();
        $updatePapers = $paperModel->update_paper_info($c_test_id, $question_list);
        if (!$updatePapers) {
            throw new \Exception("更新试卷失败");
        }

        return true;
    });
}
    
    


    /**
     *  通过测试ID删除组卷规则（解决del_paper_rules_by_test_id未定义问题）
     */
    public function del_paper_rules_by_test_id($c_test_id = "")
    {
        if (empty($c_test_id) || !is_string($c_test_id)) {
            Log::error('删除组卷规则失败：测试ID无效', ['c_test_id' => $c_test_id]);
            return false;
        }

        try {
            $deleteCount = self::where('c_test_id', $c_test_id)->delete();
            Log::info('组卷规则删除成功', [
                'c_test_id' => $c_test_id,
                '删除数量' => $deleteCount
            ]);
            return true;
        } catch (\Exception $e) {
            Log::error('删除组卷规则异常', [
                'c_test_id' => $c_test_id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
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
