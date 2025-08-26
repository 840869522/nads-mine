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
     * Notes:交卷修改
     * User: zhangnan
     * DateTime: 2025/7/22 16:06
     * @param $info
     * @param $c_answers
     * @param $c_score
     * @param $c_correct
     * @return bool
     */
    public function update_test_users_info($info="",$c_answers="",$c_score="",$c_correct=1,$answers_res_data=[])
    {
        DB::beginTransaction();
        try{
            $info->c_answers = $c_answers;
            $info->c_score = $c_score;
            $info->c_correct = $c_correct;
            $info->c_end = date("Y-m-d H:i:s");;
            $info->c_submit = date("Y-m-d H:i:s");
            $res = $info->save();
            if(!$res){
                DB::rollback();
                return false;
            }
            if(!empty($answers_res_data)){
                $answre_mod = new AnswersModel();
                $answre_res = $answre_mod->create_answers_info($answers_res_data);
                if(!$answre_res){
                    DB::rollback();
                    return false;
                }
            }
            DB::commit();
            return true;
        }catch(\Exception $e){
            DB::rollback();
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
     * Notes:检测是否以发放过试卷
     * User: zhangnan
     * DateTime: 2025/7/22 16:13
     * @param $c_test_id
     * @param $user_name
     * @return false
     */
    public function check_test_users_by_user_name($c_test_id="",$user_name="")
    {
        $mod = new TestUsersModel();
        $res = $mod->where('c_test_id',$c_test_id)->where('c_username',$user_name)->first();
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
     * @param $scor1e
     * @return bool
     */
    public function update_test_user_by_zg($c_test_id="",$user_name="",$score=0)
    {
        $info = $this->check_test_users_by_user_name($c_test_id,$user_name);
        $z_score = $info->c_score+$score;
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
