<?php
namespace App\Models\Course;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB as db;
use Illuminate\Support\Facades\Log;
use App\Utils\GlobalResponse;
use Illuminate\Support\Str;

class AnswersModel extends Model{
    protected $table = 'c_answers';
    public $timestamps = false;
    protected $primaryKey = 'c_id';
    protected $casts = [
        'c_id' => 'string', // 指定ID为主键（如果是UUID）
    ];
    public $pageSize = 20;

    /**
     * Notes:添加主观答题
     * User: zhangnan
     * DateTime: 2025/7/25 19:04
     * @param $answers_res_data
     * @return bool
     */
    public function create_answers_info($answers_res_data=[])
    {
        foreach ($answers_res_data as $k=>$v){
            $mod = new AnswersModel();
            $mod->c_id = Str::uuid()->toString();
            $mod->c_test_id = $v['test_id'];
            $mod->c_username = $v['username'];
            $mod->c_answer = $v['answer'];
            $mod->c_question_id = $v['question_id'];
            $mod->c_update_at = date('Y-m-d H:i:s');
            $res = $mod->save();
            if(!$res){
                return false;
            }
        }
        return true;
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
            
            $result = $query->select('c_answers', 'c_paper_id')
                ->first();
            
            return $result ? (array)$result : null;
            
        } catch (\Exception $e) {
            Log::error("获取用户作答失败: " . $e->getMessage());
            return null;
        }
    }

}
?>
