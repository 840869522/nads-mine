<?php
namespace App\Models\Course;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB as db;
use Illuminate\Support\Facades\Log;
use App\Utils\GlobalResponse;

class QuestionsModel extends Model{
    protected $table = 'c_questions';
    public $timestamps = false;
    protected $primaryKey = 'c_id';
    protected $casts = [
        'c_id' => 'string', // 指定ID为主键（如果是UUID）
    ];
    public $pageSize = 20;

    /**
     * Notes:添加题目
     * User: zhangnan
     * DateTime: 2025/7/10 14:27
     * @param $c_id
     * @param $c_course_id
     * @param $c_question
     * @param $c_answer
     * @param $c_tag
     * @return bool
     */
    public function create_question_info($c_id="",$c_course_id="",$c_question="",$c_answer="",$c_tag="",$type=0,$content=[])
    {
        DB::beginTransaction();
        $mod = new QuestionsModel();
        $mod->c_id = $c_id;
        $mod->c_course_id = $c_course_id;
        $mod->c_question = $c_question;
        $mod->c_answer = $c_answer;
        $mod->c_tag = $c_tag;
        $mod->c_type = $type;
        try{
            $res = $mod->save();
            if(!$res){
                DB::rollback();
                return false;
            }
            $question_options_mod = new QuestionsOptionsModel();
            if (in_array($type,[1,2])){
                $question_options_res = $question_options_mod->create_question_options_info($c_id,$content);
                if(!$question_options_res){
                    DB::rollback();
                    return false;
                }
            }
            DB::commit();
            return true;
        }catch(\Exception $e){
            DB::rollback();
            DLOG("[{$e->getLine()}]{$e->getMessage()}",'error','question_log');
            return false;
        }
    }

    public function batch_create_question_info($array=[])
    {
        DB::beginTransaction();
        try{
            foreach($array as $k=>$v){
                $mod = new QuestionsModel();
                $mod->c_id = $v['id'];
                $mod->c_course_id = $v['course_id'];
                $mod->c_question = $v['question'];
                $mod->c_answer = $v['answer'];
                $mod->c_tag = $v['tags'];
                $mod->c_type = $v['type'];
                $res = $mod->save();
                if(!$res){
                    DB::rollback();
                    return false;
                }
                $question_options_mod = new QuestionsOptionsModel();
                if (in_array($v['type'],[1,2])){
                    $content = [];
                    foreach($v['options'] as $k1=>$v1){
                        $content[]=array(
                            'key'=>$v1['c_id'],
                            'option'=>$v1['c_content']
                        );
                    }
                    $question_options_res = $question_options_mod->create_question_options_info($v['id'],$content);
                    if(!$question_options_res){
                        DB::rollback();
                        return false;
                    }
                }
            }
            DB::commit();
            return true;
        }catch(\Exception $e){
            DB::rollback();
            DLOG("[{$e->getLine()}]{$e->getMessage()}",'error','question_log');
            return false;
        }

    }

       
    /**
     * 根据题型和标签查询题目
     * @param int $type 题型
     * @param string $tag 标签
     * @return array 题目列表（确保返回数组）
     */
  // QuestionsModel.php
public function get_questions_by_type_and_tag($type, $tag)
{
    try {
        // 关键：使用数据库实际字段名（c_id、c_question、c_answer等）
        // 并通过AS语法映射为代码中需要的键名（id、content、answer）
        $questions = DB::table('c_questions')
            ->select(
                'c_id as id',          // 数据库c_id → 代码id
                'c_question as content',// 数据库c_question → 代码content（核心修复）
                'c_answer as answer',  // 数据库c_answer → 代码answer
                'c_type as type',      // 数据库c_type → 代码type
                'c_tag as tag'         // 数据库c_tag → 代码tag
                // 注意：数据库中没有c_options字段，移除该字段的查询
            )
            ->where('c_type', $type)  // 匹配题型（数据库字段c_type）
            ->where('c_tag', $tag)    // 匹配标签（数据库字段c_tag）
            ->get()
            // 转换为数组，确保后续可用[]访问
            ->map(function ($item) {
                return (array)$item;
            })
            ->toArray();
        
        // 过滤无效数据（必须包含id和题目内容）
        return array_filter($questions, function($q) {
            // 检查id和content（即数据库的c_id和c_question）是否存在且非空
            return !empty($q['id']) && !empty($q['content']);
        });
    } catch (\Exception $e) {
        Log::error('查询题目失败', [
            'type' => $type,
            'tag' => $tag,
            'error' => $e->getMessage(),
            'trace' => $e->getTraceAsString()
        ]);
        return [];
    }
}

// 修复题目数量查询（使用正确的数据库字段）
public function get_question_cnt($type, $tag)
{
    return DB::table('c_questions')
        ->where('c_type', $type)       // 正确字段：c_type
        ->where('c_tag', $tag)         // 正确字段：c_tag
        ->whereNotNull('c_id')         // 排除无ID的无效数据
        ->whereNotNull('c_question')   // 排除无题目内容的无效数据
        ->count();
}


    /**
     * Notes:验证主键唯一性
     * User: zhangnan
     * DateTime: 2025/7/9 16:06
     * @param $c_id
     * @return bool
     */
    public function verify_c_id_only($c_id="")
    {
        $mod = new QuestionsModel();
        $cnt = $mod->where('c_id',$c_id)->count();
        if($cnt>0){
            return false;
        }
        return true;
    }

    /**
     * Notes:通过c_id获取题目详情
     * User: zhangnan
     * DateTime: 2025/7/9 16:08
     * @param $c_id
     * @return false
     */
    public function get_question_info_by_c_id($c_id="",$type=0)
    {
        $mod = new QuestionsModel();
        $find = $mod->where('c_id',$c_id)->first();
        Log::info($find);
        if(empty($find)){
            return false;
        }
        if($type==1){
            $QuestionsOptionsMod = new QuestionsOptionsModel();
            $find->connect = $QuestionsOptionsMod->get_question_options_by_question_id($find->c_id);
        }
        return $find;
    }


    /**
     * 修改题目
     * Notes:
     * User: zhangnan
     * DateTime: 2025/7/10 14:28
     * @param $info
     * @param $c_id
     * @param $c_course_id
     * @param $c_question
     * @param $c_answer
     * @param $c_tag
     * @return bool
     */
    public function update_question_info($info="",$c_id="",$c_course_id="",$c_question="",$c_answer="",$c_tag="",$type=0,$content=[])
    {
        DB::beginTransaction();
        $info->c_course_id = $c_course_id;
        $info->c_question = $c_question;
        $info->c_answer = $c_answer;
        $info->c_tag = $c_tag;
        $info->c_type = $type;
        try{
            $res = $info->save();
            if(!$res){
                return false;
            }
            if (in_array($type,[1,2])){
                $question_options_mod = new QuestionsOptionsModel();
                $question_options_res = $question_options_mod->update_question_options_info($c_id,$content);
                if(!$question_options_res){
                    DB::rollback();
                    return false;
                }
            }
            DB::commit();
            return true;
        }catch(\Exception $e){
            DB::rollback();
            DLOG("[{$e->getLine()}]{$e->getMessage()}",'error','question_log');
            return false;
        }
    }


    /**
     * Notes:删除题目
     * User: zhangnan
     * DateTime: 2025/7/9 16:24
     * @param $c_id
     * @return bool
     */
    public function del_question_info($c_id="")
    {
        DB::beginTransaction();
        try{
            $question_options_mod = new QuestionsOptionsModel();
            $question_options_res = $question_options_mod->del_question_options_info($c_id);
            if(!$question_options_res){
                DB::rollback();
                return false;
            }

            $mod = new QuestionsModel();
            $res = $mod->where("c_id",$c_id)->delete();
            if(!$res){
                DB::rollback();
                return false;
            }
            DB::commit();
            return true;
        }catch(\Exception $e){
            DB::rollback();
            DLOG("[{$e->getLine()}]{$e->getMessage()}",'error','question_log');
            return false;
        }
    }

    /**
     * Notes:获取题目列表
     * User: zhangnan
     * DateTime: 2025/7/11 10:22
     * @param $pageSize
     * @param $page
     * @return mixed
     */
    public function get_question_list($pageSize=0,$page=0)
    {
        if(empty($pageSize)){
            $pageSize = $this->pageSize;
        }
        $mod = new QuestionsModel();
        $count = $mod->count();
        if(empty($page)){
            $list = $mod->paginate($pageSize);
        }else{
            $list = $mod->paginate($pageSize, ['*'], 'page', $page);
        }
        $list->each(function($item){
            $QuestionsOptionsMod = new QuestionsOptionsModel();
            $item->connect = $QuestionsOptionsMod->get_question_options_by_question_id($item->c_id);
        });
        $data = $list->items();
        $res = array(
            'page'=>$page,
            'pageSize'=>$pageSize,
            'count'=>$count,
            'data'=>$data
        );
        return $res;
    }

 


    /**
     * Notes:获取全部题目
     * User: zhangnan
     * DateTime: 2025/7/21 16:53
     * @return mixed
     */
    public function get_question_all()
    {
        $mod = new QuestionsModel();
        $list = $mod->get()->toArray();;
        return $list;
    }


    public function get_question_by_tag($type=0,$tag="")
    {
        $mod = new QuestionsModel();
        $list = $mod->where('c_type',$type)->where('c_tag',$tag)->get()->toArray();
        return $list;
    }

    /**
     * Notes:获取问题字典
     * User: zhangnan
     * DateTime: 2025/7/21 19:06
     * @return array
     */
    public function get_question_dic()
    {
        $list = $this->get_question_all();
        $res = [];
        foreach($list as $k=>$v){
            $res[$v['c_type']][$v['c_id']] = $v;
        }
        return $res;
    }

}
?>
