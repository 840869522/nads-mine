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


    // 修改添加测试的模型方法，添加时长参数并保存
public function create_test_info(
    $c_name="",
    $c_test_type="",
    $c_type="",
    $c_description="",
    $c_paper_count=0,
    $c_start="",
    $c_end="",
    $c_course_id="",
    $c_duration=0 // 新增：添加时长参数
) {
    $mod = new TestsModel();
    $mod->c_id = Str::uuid()->toString();
    $mod->c_name = $c_name;
    $mod->c_test_type = $c_test_type;
    $mod->c_type = $c_type;
    $mod->c_description = $c_description;
    $mod->c_paper_count = $c_paper_count;
    $mod->c_start = $c_start;
    $mod->c_end = $c_end;
    $mod->c_course_id = $c_course_id;
    $mod->c_duration = $c_duration; // 新增：保存时长到数据库
    
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
public function update_test_info(
    $info="",
    $c_name="",
    $c_test_type="",
    $c_type="",
    $c_description="",
    $c_paper_count=0,
    $c_start="",
    $c_end="",
    $c_course_id="",
    $c_duration=0 // 新增：测试时长参数
) {
    $info->c_name = $c_name;
    $info->c_test_type = $c_test_type;
    $info->c_type = $c_type;
    $info->c_description = $c_description;
    $info->c_paper_count = $c_paper_count;
    $info->c_start = $c_start;
    $info->c_end = $c_end;
    $info->c_course_id = $c_course_id;
    $info->c_duration = $c_duration; // 新增：更新测试时长
    
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
 * 删除测试（精简版：只处理实际存在的三个关联表）
 * Notes: 分数和作答信息包含在c_test_users表中
 * @param $c_id
 * @return bool
 */
public function del_test_info($c_id="")
{
    DB::beginTransaction();
    try{
        // 定义实际存在的关联表
        $relationTables = [
            'c_test_users' => 'c_test_id',    // 包含用户关联、分数和作答信息
            'c_paper_rules' => 'c_test_id',   // 试卷规则表
            'c_papers' => 'c_test_id'         // 试卷表
        ];

        // 检查并删除每个关联表的数据
        foreach ($relationTables as $table => $field) {
            $hasData = DB::table($table)->where($field, $c_id)->exists();
            if ($hasData) {
                $deleteRes = DB::table($table)->where($field, $c_id)->delete();
                if ($deleteRes === false) {
                    DB::rollback();
                    DLOG("删除关联表[{$table}]数据失败: test_id={$c_id}",'error','test_log');
                    return false;
                }
                DLOG("删除关联表[{$table}]数据成功: 共删除" . $deleteRes . "条 test_id={$c_id}",'info','test_log');
            }
        }

        // 删除测试主表数据
        $res = DB::table('c_tests')->where('c_id', $c_id)->delete();
        if ($res === false || $res === 0) {
            DB::rollback();
            DLOG("删除测试主表数据失败（无数据或删除错误）: test_id={$c_id}",'error','test_log');
            return false;
        }

        DB::commit();
        DLOG("测试删除成功: test_id={$c_id}",'info','test_log');
        return true;
    }catch(\Exception $e){
        DB::rollback();
        $pdo = DB::connection()->getPdo();
        $errorInfo = $pdo->errorInfo();
        $pdoError = isset($errorInfo[2]) ? $errorInfo[2] : '未知PDO错误';
        DLOG("[{$e->getLine()}]{$e->getMessage()} | PDO错误: {$pdoError} | test_id={$c_id}",'error','test_log');
        return false;
    }
}

   /**
 * Notes: 获取测试列表
 * User: zhangnan
 * DateTime: 2025/7/11 13:46
 * @param int $pageSize
 * @param int $page
 * @return array
 */
public function get_test_list($pageSize = 0, $page = 0)
{
    if (empty($pageSize)) {
        $pageSize = $this->pageSize;
    }

    $mod = new TestsModel();
    // 使用 JOIN 查询 c_courses 表获取 c_course_name
    $query = $mod->select('c_tests.*', 'c_courses.c_course_name')
                 ->leftJoin('c_courses', 'c_tests.c_course_id', '=', 'c_courses.c_course_id');

    $count = $query->count();
    
    if (empty($page)) {
        $list = $query->paginate($pageSize);
    } else {
        $list = $query->paginate($pageSize, ['*'], 'page', $page);
    }

    $data = $list->items();
    $res = array(
        'page' => $page,
        'pageSize' => $pageSize,
        'count' => $count,
        'data' => $data
    );

    return $res;
}

}
?>
