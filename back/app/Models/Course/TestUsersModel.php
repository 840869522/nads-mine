<?php
namespace App\Models\Course;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB as db;
use Illuminate\Support\Facades\Log;
use App\Utils\GlobalResponse;
use Illuminate\Support\Str;

class TestUsersModel extends Model{
    protected $table = 'c_test_users';
    public $timestamps = false;
    protected $primaryKey = 'c_id';
    protected $casts = [
        'c_id' => 'string', // 指定ID为主键（如果是UUID）
    ];
    public $pageSize = 20;

 /**
     * 根据测试ID获取关联的所有用户信息
     * @param string $testId 测试ID
     * @return \Illuminate\Database\Eloquent\Collection|static[]
     */
    public function getUsersByTestId($testId)
    {
        return $this->where('c_test_id', $testId)->get();
    }

    /**
     * 格式化答案字段（将JSON字符串转为数组）
     * @param $value 数据库中的JSON字符串
     * @return array|null
     */
    public function getCAnswersAttribute($value)
    {
        if (empty($value)) {
            return null;
        }
        // 尝试解析JSON，失败则返回原始字符串
        $decoded = json_decode($value, true);
        return json_last_error() === JSON_ERROR_NONE ? $decoded : $value;
    }

    /**
     * 格式化批改状态文字描述
     * @param $value 数据库中的状态值（0/1/2）
     * @return string
     */
    public function getCCorrectTextAttribute()
    {
        switch ($this->c_correct) {
            case 0:
                return '未交卷';
            case 1:
                return '未完成';
            case 2:
                return '已完成';
            default:
                return '未知状态';
        }
    }

    /**
     * 批量插入用户数据
     * @param array $users 包含多个用户信息的数组
     * @return int 插入成功的记录数
     */
    public function batchInsertUsers(array $users)
    {
        // 准备插入的数据，可在此处添加默认值或处理
        $insertData = [];
        $currentTime = date('Y-m-d H:i:s');
        
        foreach ($users as $user) {
            $insertData[] = [
                'c_test_id' => $user['c_test_id'],
                'c_username' => $user['c_username'],
                'c_paper_id' => $user['c_paper_id'],
                'c_start' => $currentTime,
            
            ];
        }
        
        // 执行批量插入
        return DB::table('c_test_users')->insert($insertData);
    }


        /**
     * 单个删除测试用户（根据测试ID+用户名+试卷ID联合删除）
     * @param array $params 包含c_test_id、c_username、c_paper_id的数组
     * @return int|bool 成功返回1，记录不存在返回false，业务限制返回-1
     */
    // 添加static关键字，将方法声明为静态方法
    public static function deleteSingleUser(array $params)
    {
        // 1. 提取参数（确保参数完整性，与控制器验证一致）
        $testId = $params['c_test_id'];
        $username = $params['c_username'];
        $paperId = $params['c_paper_id'];

        // 2. 先查询记录是否存在（避免删除不存在的数据）
        $existingRecord = DB::table('c_test_users')
            ->where('c_test_id', $testId)
            ->where('c_username', $username)
            ->where('c_paper_id', $paperId)
            ->first();

        // 3. 记录不存在：返回false
        if (!$existingRecord) {
            return false;
        }

        // 4. 业务限制：已交卷/已批改的记录不允许删除
        // c_submit不为null表示已交卷，c_correct=2表示已完成批改
        if (!empty($existingRecord->c_submit) || $existingRecord->c_correct === 2) {
            return -1; // 返回-1标识业务限制
        }

        // 5. 执行删除操作（联合条件删除，确保只删除目标记录）
        $deleteCount = DB::table('c_test_users')
            ->where('c_test_id', $testId)
            ->where('c_username', $username)
            ->where('c_paper_id', $paperId)
            ->delete();

        // 6. 返回删除结果（delete()方法返回删除的记录数，1表示成功）
        return $deleteCount === 1 ? 1 : false;
    }


/**
     * 获取用户专属的理论测试列表
     */
    public function getUserRelatedTests(string $username)
    {
        Log::info('用户理论测试查询参数', [
            'table' => $this->table,
            'username' => $username,
            '筛选字段' => 'c_paper_id',
            '筛选条件' => '非experiment_default值'
        ]);

        // 先查询所有用户测试记录（不区分类型）
        $allUserTests = DB::table($this->table)
            ->where('c_username', $username)
            ->get();
        Log::info('用户所有测试记录统计', [
            '总记录数' => $allUserTests->count(),
            '实验测试记录数' => $allUserTests->where('c_paper_id', '=', 'experiment_default')->count(),
            '理论测试记录数(非experiment_default)' => $allUserTests->where('c_paper_id', '!=', 'experiment_default')->count(),
            '其他记录数(空c_paper_id)' => $allUserTests->whereNull('c_paper_id')->count()
        ]);

        // 查看c_paper_id字段的所有可能值
        $distinctPaperIds = $allUserTests->pluck('c_paper_id')->unique();
        Log::info('用户测试记录中c_paper_id的所有值', ['distinct_paper_ids' => $distinctPaperIds->toArray()]);

        // 重新构建正确的查询，确保理论测试能正确显示
        $result = DB::table($this->table)
            ->join('c_tests', $this->table . '.c_test_id', '=', 'c_tests.c_id')
            ->leftJoin('c_courses', 'c_tests.c_course_id', '=', 'c_courses.c_course_id')
            ->where($this->table . '.c_username', $username)
            // 应用正确的筛选条件 - 只排除实验测试
            ->where(function($query) {
                $query->where($this->table . '.c_paper_id', '!=', 'experiment_default')
                      ->orWhereNull($this->table . '.c_paper_id');
            })
            ->select(
                $this->table . '.c_paper_id',
                $this->table . '.c_answers',
                $this->table . '.c_submit',
                $this->table . '.c_score',
                $this->table . '.c_objective_score',
                'c_tests.c_id',
                'c_tests.c_name',
                'c_tests.c_type',
                'c_tests.c_test_type',
                'c_tests.c_start as test_start',
                'c_tests.c_end as test_end',
                'c_tests.c_description',
                'c_tests.c_course_id',
                'c_courses.c_course_name'
            )
            ->orderBy('c_tests.c_start', 'desc')
            ->get();

        Log::info('理论测试查询结果', [
            '数量' => $result->count(),
            '返回的c_paper_id值' => $result->pluck('c_paper_id')->toArray()
        ]);
        return $result;
    }

    /**
     * 获取用户专属的实验列表
     */
    public function getUserRelatedExperiments(string $username)
    {
        Log::info('用户实验查询参数', [
            'table' => $this->table,
            'username' => $username,
            '筛选字段' => 'c_paper_id',
            '筛选条件' => 'experiment_default值'
        ]);

        $userTestLinks = DB::table($this->table)
            ->where('c_username', $username)
            ->get();
        Log::info('用户实验关联记录', [
            '数量' => $userTestLinks->count(),
            '关联的实验ID' => $userTestLinks->pluck('c_test_id')->toArray()
        ]);

        $query = DB::table($this->table)
            ->leftJoin('c_course_experiments', $this->table . '.c_test_id', '=', 'c_course_experiments.c_experiment_id')
            ->leftJoin('c_courses', 'c_course_experiments.c_course_id', '=', 'c_courses.c_course_id')
            ->where($this->table . '.c_paper_id', '=', 'experiment_default')
            ->where($this->table . '.c_username', $username)
            ->select(
                $this->table . '.c_paper_id',
                $this->table . '.c_answers',
                $this->table . '.c_submit',
                $this->table . '.c_score',
                $this->table . '.c_objective_score',
                $this->table . '.c_test_id as test_id',
                'c_course_experiments.c_experiment_name as c_name',
                'c_course_experiments.c_experiment_id as c_id',
                // 移除不存在的c_type字段引用
                // 为保持数据结构一致，设置默认值
                db::raw("'练习' as c_type"),
                db::raw("'实验' as c_test_type"),
                'c_course_experiments.c_start as test_start',
                'c_course_experiments.c_end as test_end',
                'c_course_experiments.c_description as c_description',
                'c_course_experiments.c_course_id as c_course_id',
                'c_courses.c_course_name'
            )
            ->orderBy('c_course_experiments.c_start', 'desc');

        Log::info('实验测试查询SQL', [
            'sql' => $query->toSql(),
            '参数' => $query->getBindings()
        ]);

        $result = $query->get();
        Log::info('实验测试查询结果', ['数量' => $result->count()]);
        return $result;
    }

    /**
     * 通过测试ID获取试卷信息
     */
    public function get_paper_info_by_test_id(string $testId)
    {
        Log::info('尝试获取试卷', ['test_id' => $testId]);
        
        $paper = $this->where('c_test_id', $testId)
            ->where('c_status', 1)
            ->first();
            
        if (!$paper) {
            Log::warning('未找到精确匹配的试卷，尝试放宽条件', ['test_id' => $testId]);
            $paper = $this->where('c_test_id', $testId)
                ->first();
        }
        
        $result = $paper ? $paper->toArray() : null;
        
        Log::info('试卷查询结果', [
            'test_id' => $testId,
            'found' => $result ? 'yes' : 'no',
            'paper_id' => $result['c_id'] ?? null
        ]);
        
        return $result;
    }

    /**
     * 检查用户是否已领取该测试的试卷
     */
    public function check_test_users_by_user_name(string $testId, string $username)
    {
        return $this->where('c_test_id', $testId)
            ->where('c_username', $username)
            ->first();
    }

    /**
     * 更新用户测试记录（交卷后）
     */
    public function update_test_users_info($testUserInfo, $answers, $objectiveScore, $correctCount)
    {
        try {
            $result = self::where('c_test_id', $testUserInfo->c_test_id)
                ->where('c_username', $testUserInfo->c_username)
                ->where('c_paper_id', $testUserInfo->c_paper_id)
                ->update([
                    'c_answers' => json_encode($answers, JSON_UNESCAPED_UNICODE),
                    'c_submit' => now(),
                    'c_score' => $objectiveScore,
                    'c_objective_score' => $objectiveScore,
                    'c_subjective_score' => 0,
                    'c_correct' => $correctCount,
                    'c_status' => 2
                ]);
            Log::info('更新测试记录成功', [
                'test_id' => $testUserInfo->c_test_id,
                'username' => $testUserInfo->c_username,
                'paper_id' => $testUserInfo->c_paper_id
            ]);
            return $result;
        } catch (\Exception $e) {
            Log::error('更新测试记录失败', [
                'test_id' => $testUserInfo->c_test_id,
                'username' => $testUserInfo->c_username,
                'paper_id' => $testUserInfo->c_paper_id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            return false;
        }
    }
    
     /**
     * 获取用户作答列表（从c_answers JSON字段中提取）
     */
    public function get_answers_list_by_name($test_id, $username, $paper_id = '')
    {
        try {
            Log::info("获取作答列表参数", [
                'test_id' => $test_id,
                'username' => $username,
                'paper_id' => $paper_id
            ]);
            
            $query = DB::table($this->table)
                ->where('c_test_id', $test_id)
                ->where('c_username', $username);
            
            // 如果提供了paper_id，则添加到查询条件
            if (!empty($paper_id)) {
                $hasPaperIdColumn = $this->checkColumnExists('c_paper_id');
                if ($hasPaperIdColumn) {
                    $query->where('c_paper_id', $paper_id);
                }
            }
            
            $result = $query->select('c_answers', 'c_paper_id')
                ->first();
            
            if (empty($result) || empty($result->c_answers)) {
                Log::warning("未找到用户作答数据");
                return [];
            }
            
            // 解析JSON格式的作答数据
            $answersData = json_decode($result->c_answers, true);
            
            if (json_last_error() !== JSON_ERROR_NONE) {
                Log::error("JSON解析错误: " . json_last_error_msg());
                return [];
            }
            
            // 提取所有题目的作答信息
            $answerList = [];
            
            if (is_array($answersData)) {
                foreach ($answersData as $section) {
                    if (isset($section['data']) && is_array($section['data'])) {
                        foreach ($section['data'] as $answer) {
                            if (!empty($answer['question_id'])) {
                                $answerList[] = [
                                    'c_question_id' => $answer['question_id'],
                                    'c_answer' => $answer['answer'] ?? '',
                                ];
                            }
                        }
                    }
                }
            }
            
            Log::info("从JSON解析出的作答数据", ['count' => count($answerList)]);
            
            return $answerList;
            
        } catch (\Exception $e) {
            Log::error("获取作答列表失败: " . $e->getMessage());
            Log::error("错误堆栈: " . $e->getTraceAsString());
            return [];
        }
    }

    /**
     * 检查表中是否存在某字段
     */
    private function checkColumnExists($columnName)
    {
        try {
            $schema = DB::getSchemaBuilder();
            return $schema->hasColumn($this->table, $columnName);
        } catch (\Exception $e) {
            Log::error("检查字段存在性失败: " . $e->getMessage());
            return false;
        }
    }

    /**
     * 批改答案（更新c_test_users表中的JSON数据和分数）
     */
    public function batch_answers($data, $answer_data, $test_id, $username, $teacher_name, $zong_score, $paper_id = '')
    {
        try {
            DB::beginTransaction();
            
            Log::info("开始批改答案", [
                'test_id' => $test_id,
                'username' => $username,
                'paper_id' => $paper_id,
                'total_score' => $zong_score
            ]);
            
            // 获取当前的作答数据
            $query = DB::table($this->table)
                ->where('c_test_id', $test_id)
                ->where('c_username', $username);
            
            if (!empty($paper_id)) {
                $hasPaperIdColumn = $this->checkColumnExists('c_paper_id');
                if ($hasPaperIdColumn) {
                    $query->where('c_paper_id', $paper_id);
                }
            }
            
            $userTest = $query->first();
            
            if (empty($userTest)) {
                Log::error("未找到用户测试记录");
                DB::rollBack();
                return false;
            }
            
            // 解析现有的作答JSON
            $answersData = json_decode($userTest->c_answers, true);
            if (json_last_error() !== JSON_ERROR_NONE) {
                Log::error("JSON解析错误: " . json_last_error_msg());
                DB::rollBack();
                return false;
            }
            
            // 更新JSON中的分数
            $updated = false;
            foreach ($answersData as &$section) {
                if (isset($section['data']) && is_array($section['data'])) {
                    foreach ($section['data'] as &$answer) {
                        $questionId = $answer['question_id'] ?? '';
                        if ($questionId && isset($answer_data[$questionId])) {
                            $answer['score'] = $answer_data[$questionId];
                            $answer['correct_status'] = 2; // 已批改
                            $answer['correct_time'] = date('Y-m-d H:i:s');
                            $answer['correct_teacher'] = $teacher_name;
                            $updated = true;
                        }
                    }
                }
            }
            
            if (!$updated) {
                Log::warning("未找到匹配的题目进行批改");
                DB::rollBack();
                return false;
            }
            
            // 准备更新数据，移除c_update_at字段
            $updateData = [
                'c_answers' => json_encode($answersData, JSON_UNESCAPED_UNICODE),
                'c_subjective_score' => $zong_score,
                'c_score' => ($userTest->c_objective_score ?? 0) + $zong_score,
                'c_correct' => 2, // 已批改
            ];
            
            $updateQuery = DB::table($this->table)
                ->where('c_test_id', $test_id)
                ->where('c_username', $username);
            
            if (!empty($paper_id) && $this->checkColumnExists('c_paper_id')) {
                $updateQuery->where('c_paper_id', $paper_id);
            }
            
            $result = $updateQuery->update($updateData);
            
            if ($result) {
                DB::commit();
                Log::info("批改成功", ['rows_affected' => $result]);
                return true;
            } else {
                DB::rollBack();
                Log::error("更新数据库失败");
                return false;
            }
            
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error("批改事务失败: " . $e->getMessage());
            Log::error("错误堆栈: " . $e->getTraceAsString());
            return false;
        }
    }

    /**
     * 获取用户作答信息
     */
    public function get_user_answers($test_id, $username, $paper_id = '')
    {
        try {
            $query = DB::table($this->table)
                ->where('c_test_id', $test_id)
                ->where('c_username', $username);
            
            // 如果提供了paper_id，则添加到查询条件
            if (!empty($paper_id)) {
                $hasPaperIdColumn = $this->checkColumnExists('c_paper_id');
                if ($hasPaperIdColumn) {
                    $query->where('c_paper_id', $paper_id);
                }
            }
            
            $result = $query->select('c_answers', 'c_paper_id', 'c_objective_score')
                ->first();
            
            return $result ? (array)$result : null;
            
        } catch (\Exception $e) {
            Log::error("获取用户作答失败: " . $e->getMessage());
            return null;
        }
    }

    /**
     * Notes:发卷
     * User: zhangnan
     * DateTime: 2025/7/22 16:00
     * @param $c_test_id
     * @param $c_username
     * @param $c_paper_id
     * @return bool
     */
    public function create_test_users_info($c_test_id="",$c_username="",$c_paper_id="")
    {
        $mod = new TestUsersModel();
        $mod->c_id = Str::uuid()->toString();
        $mod->c_test_id = $c_test_id;
        $mod->c_username = $c_username;
        $mod->c_paper_id = $c_paper_id;
        $mod->c_start = date("Y-m-d H:i:s");
        try{
            $res = $mod->save();
            if(!$res){
                return false;
            }
            return true;
        }catch(\Exception $e){
            DLOG("[{$e->getLine()}]{$e->getMessage()}",'error','test_users_log');
            return false;
        }
    }


    /**
     * Notes: 通过id查询卷子发放信息
     * User: zhangnan
     * DateTime: 2025/7/22 16:07
     * @param $c_id
     * @return false
     */
    public function get_test_users_info_by_id($c_id="")
    {
        $mod = new TestUsersModel();
        $res = $mod->where('c_id',$c_id)->first();
        if(empty($res)){
            return false;
        }
        return $res;
    }


    /**
     * Notes:获取试卷发放数据
     * User: zhangnan
     * DateTime: 2025/7/22 17:39
     * @param $test_id
     * @return mixed
     */
    public function get_test_user_by_test_id($test_id="",$correct=0)
    {
        $mod = new TestUsersModel();
        if($correct==0){
            $res = $mod->where('c_test_id',$test_id)->get()->toArray();
        }else{
            $res = $mod->where('c_test_id',$test_id)->where('c_correct',$correct)->get()->toArray();
        }

        return $res;
    }


    /**
 * Notes:主观题修改后提交
 * User: zhangnan
 * DateTime: 2025/7/28 10:07
 * @param $c_test_id
 * @param $user_name
 * @param $score
 * @return bool
 */
public function update_test_user_by_zg($c_test_id="",$user_name="",$score=0)
{
    $info = $this->check_test_users_by_user_name($c_test_id,$user_name);
    
    // 更新主观题分数
    $info->c_subjective_score = $score;
    
    // 计算总分（客观题分数 + 主观题分数）
    $z_score = $info->c_objective_score + $score;
    $info->c_score = $z_score;
    $info->c_correct = 2;
    
    try{
        $res = $info->save();
        if(!$res){
            return false;
        }
        return true;
    }catch(\Exception $e){
        DLOG("[{$e->getLine()}]{$e->getMessage()}",'error','test_users_log');
        return false;
    }
}


}
?>
