<?php


namespace App\Http\Controllers\Course;

use App\Models\Course\AnswersModel;
use App\Models\Course\PaperRulesModel;
use App\Models\Course\PapersModel;
use App\Models\Course\QuestionsModel;
use App\Models\scenario\SceneConfig;
use App\Utils\JWTControll;


use App\Models\scenario\SceneContainerInstance;
use App\Models\scenario\SceneSwitchInstance;
use App\Models\scenario\SceneVmInstance;

use Illuminate\Support\Facades\Validator;

use App\Models\Course\QuestionsOptionsModel;
use App\Models\Course\TestsModel;
use App\Models\Course\TestUsersModel;
use App\Models\UserModel;
use Illuminate\Http\Request;
use App\Models\Course\CategoryModel;
use Illuminate\Http\JsonResponse;
use App\Http\Controllers\Controller;
use App\Utils\GlobalResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Illuminate\Support\Facades\Log;
use App\Models\Experiment\ExperimentModel;
use Illuminate\Support\Facades\Redis;
use App\Models\Flag\FlagSubmissionModel;
use App\Models\scenario\SceneContainerInstanceModel;
use App\Models\scenario\SceneVmInstanceModel;
use App\Models\scenario\SceneInstance;
use App\Models\scenario\SceneInstanceModel;

use App\RunTool\CommandLineService;
use App\RunTool\TopologyParser;

use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\File; // 引入File Facade
use Illuminate\Support\Str;


use Symfony\Component\Process\Process;
use Symfony\Component\Process\Exception\ProcessFailedException;

use Illuminate\Support\Facades\Cache;

use PhpOffice\PhpWord\PhpWord;
use PhpOffice\PhpWord\IOFactory;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;

class TestController extends Controller
{

    /**
     * Notes:增加题库接口
     * User: zhangnan
     * DateTime: 2025/7/10 16:20
     * @param Request $request
     * @return JsonResponse
     */
    public function question_add(Request $request)
    {
        try {
            $c_id     = trim($request->input('id'));
            $c_course_id     = trim($request->input('course_id'));
            $c_question     = trim($request->input('question'));
            $c_answer     = trim($request->input('answer'));
            $c_tag     = trim($request->input('tag'));
            $type     = $request->input('type');
            $content     = $request->input('content');
            $validated_data = array(
                'id' => 'required|string|max:50',
                'course_id' => 'required|exists:c_courses,c_course_id',
                'question' => 'required',
                'answer' => 'required',
                'type' => 'required|integer|in:1,2,3,4',
                'tag' => 'required|max:50'
            );
            $validated_msg = array(
                'id.required'=>"id不能为空",
                'id.string'=>"id类型错误",
                'id.max'=>"id字段超限",
                'course_id.required'=>"course_id 字段不能为空",
                'course_id.exists'=>"course_id 不存在",
                'question.required'=>"question 字段不能为空",
                'answer.required'=>"answer 字段不能为空",
                'type.required'=>"type 字段不能为空",
                'type.integer'=>"type 字段类型错误",
                'type.in'=>"type 字段参数错误",
                'tag.required'=>"tag 字段不能为空",
                'tag.max'=>"tag 字段超限",
            );
            if(in_array($type,[1,2])){
                $validated_data['content']='required|array';
                $validated_data['content.*.key']='required|max:4';
                $validated_data['content.*.option']='required';
                $validated_msg['content.required']='单选、多选选项不能为空';
                $validated_msg['content.array']='单选、多选选项格式错误';
                $validated_msg['content.*.key.required']='选项key不能为空';
                $validated_msg['content.*.key.max']='选线key超限';
                $validated_msg['content.*.option.required']='选项内容不能为空';
            }
            $validatedData = $request->validate($validated_data, $validated_msg);
            if(in_array($type,[1,2])){
                $QuestionsOptionsMod = new QuestionsOptionsModel();
                $verify_answer = 0;
                foreach($content as $k=>$v){
                  
                    if($type==1){
                        if($v['option']==$c_answer){
                            $verify_answer=1;
                        }
                    }else{
                        $answer = explode(';',$c_answer);
                        $dx_zong_cnt = count($answer);
                        if(in_array($v['option'],$answer)){
                            $dx_cnt++;
                        }
                    }
                }
                if($type==2){
                    if($dx_zong_cnt==$dx_cnt){
                        $verify_answer=1;
                    }
                }
                if($verify_answer==0){
                    return $this->_response(GlobalResponse::$HTTP_REQUEST_ERROR_CODE,"答案不在选项中");
                }
            }

            $mod = new QuestionsModel();
            $verify = $mod->verify_c_id_only($c_id);
            if(!$verify){
                return $this->_response(GlobalResponse::$HTTP_DATABASE_ERROR_CODE,"ID已存在");
            }

            $res = $mod->create_question_info($c_id,$c_course_id,$c_question,$c_answer,$c_tag,$type,$content);
            if(!$res){
                return $this->_response(GlobalResponse::$HTTP_DATABASE_ERROR_CODE,"题目插入失败");
            }
            return $this->_response(GlobalResponse::$HTTP_STATUS_OK_CODE,GlobalResponse::HTTP_STATUS_OK_MES);

        } catch (ValidationException $e) {
            return $this->_response(GlobalResponse::$HTTP_REQUEST_ERROR_CODE,$e->getMessage());
        }
    }


    /**
     * Notes: 搜索题目接口
     * User: zhangnan
     * DateTime: 2025/7/10 16:20
     * @param Request $request
     * @return JsonResponse
     */
    public function question_search(Request $request)
    {
        try {
            $page = $request->input('page', 1);
            $pageSize = $request->input('pagesize', 10);
            $searchName = trim($request->input('name', ''));
            
            // 验证参数
            $validated_data = [
                'page' => 'integer|min:1',
                'pagesize' => 'integer|min:1|max:100',
                'name' => 'string|max:255'
            ];
            
            $validated_msg = [
                'page.integer' => "page字段类型错误",
                'page.min' => "page字段最小值为1",
                'pagesize.integer' => "pagesize字段类型错误",
                'pagesize.min' => "pagesize字段最小值为1",
                'pagesize.max' => "pagesize字段最大值为100",
                'name.string' => "搜索关键词类型错误",
                'name.max' => "搜索关键词超限"
            ];
            
            $validatedData = $request->validate($validated_data, $validated_msg);
            
            // 构建基础查询
            $query = "SELECT * FROM c_questions WHERE 1=1";
            $countQuery = "SELECT COUNT(*) as total FROM c_questions WHERE 1=1";
            $searchParams = [];
            $countParams = [];
            
            // 添加搜索条件
            if (!empty($searchName)) {
                $query .= " AND (c_id LIKE ? OR c_question LIKE ? OR c_course_id LIKE ? OR c_tag LIKE ?)";
                $countQuery .= " AND (c_id LIKE ? OR c_question LIKE ? OR c_course_id LIKE ? OR c_tag LIKE ?)";
                $searchParam = "%" . $searchName . "%";
                $searchParams = [$searchParam, $searchParam, $searchParam, $searchParam];
                $countParams = [$searchParam, $searchParam, $searchParam, $searchParam];
            }
            
            // 计算分页
            $offset = ($page - 1) * $pageSize;
            $query .= " ORDER BY c_create_at DESC LIMIT ? OFFSET ?";
            
            // 为数据查询添加分页参数
            $dataParams = array_merge($searchParams, [$pageSize, $offset]);
            
            // 执行查询
            $questions = DB::select($query, $dataParams);
            $totalResult = DB::select($countQuery, $countParams);
            $total = $totalResult[0]->total;
            
            // 格式化返回数据
            $formattedQuestions = [];
            foreach ($questions as $question) {
                // 获取选项数据（如果是选择题）
                $options = [];
                if (in_array($question->c_type, [1, 2])) {
                    $optionQuery = "SELECT * FROM c_question_options WHERE c_question_id = ?";
                    $options = DB::select($optionQuery, [$question->c_id]);
                }
                
                $formattedQuestions[] = [
                    'c_id' => $question->c_id,
                    'c_course_id' => $question->c_course_id,
                    'c_question' => $question->c_question,
                    'c_answer' => $question->c_answer,
                    'c_tag' => $question->c_tag,
                    'c_type' => $question->c_type,
                    'c_create_at' => $question->c_create_at,
                    'connect' => $options
                ];
            }
            
            $responseData = [
                'data' => $formattedQuestions,
                'count' => $total,
                'current_page' => $page,
                'page_size' => $pageSize,
                'total_pages' => ceil($total / $pageSize)
            ];
            
            return $this->_response(GlobalResponse::$HTTP_STATUS_OK_CODE, GlobalResponse::HTTP_STATUS_OK_MES, $responseData);
            
        } catch (ValidationException $e) {
            return $this->_response(GlobalResponse::$HTTP_REQUEST_ERROR_CODE, $e->getMessage());
        } catch (\Exception $e) {
            Log::error('搜索题目失败: ' . $e->getMessage());
            return $this->_response(GlobalResponse::$HTTP_SERVER_ERROR_CODE, "服务器内部错误");
        }
    }

    /**
     * 修改题目
     * Notes:
     * User: zhangnan
     * DateTime: 2025/7/11 13:27
     * @param Request $request
     * @return JsonResponse
     */
    public function question_up(Request $request)
    {
        try {
            $c_id     = trim($request->input('id'));
            $c_course_id     = trim($request->input('course_id'));
            $c_question     = trim($request->input('question'));
            $c_answer     = trim($request->input('answer'));
            $c_tag     = trim($request->input('tag'));
            $type     = $request->input('type');
            $content     = $request->input('content');
            $validated_data = array(
                'id' => 'required|max:50|string|exists:c_questions,c_id',
                'course_id' => 'required|exists:c_courses,c_course_id',
                'question' => 'required',
                'answer' => 'required',
                'type' => 'required|integer|in:1,2,3,4',
                'tag' => 'required|max:50'
            );
            $validated_msg = array(
                'id.required'=>"id不能为空",
                'id.max'=>"id字段超限",
                'id.exists'=>"id不存在",
                'id.string'=>"id类型错误",
                'course_id.required'=>"course_id 字段不能为空",
                'course_id.exists'=>"course_id 不存在",
                'question.required'=>"question 字段不能为空",
                'answer.required'=>"answer 字段不能为空",
                'type.required'=>"type 字段不能为空",
                'type.integer'=>"type 字段类型错误",
                'type.in'=>"type 字段参数错误",
                'tag.required'=>"tag 字段不能为空",
                'tag.max'=>"tag 字段超限",
            );
            if(in_array($type,[1,2])){
                $validated_data['content']='required|array';
                $validated_data['content.*.key']='required|max:4';
                $validated_data['content.*.option']='required';
                $validated_msg['content.required']='单选、多选选项不能为空';
                $validated_msg['content.array']='单选、多选选项格式错误';
                $validated_msg['content.*.key.required']='选项key不能为空';
                $validated_msg['content.*.key.max']='选线key超限';
                $validated_msg['content.*.option.required']='选项内容不能为空';
            }
            $validatedData = $request->validate($validated_data, $validated_msg);
            $dx_cnt = 0;
            $dx_zong_cnt = 0;
            if(in_array($type,[1,2])){
                if(empty($content)){
                    return $this->_response(GlobalResponse::$HTTP_REQUEST_ERROR_CODE,"单选、多选选项不能为空");
                }else{
                    $QuestionsOptionsMod = new QuestionsOptionsModel();
                    $verify_answer = 0;
                    foreach($content as $k=>$v){

                      
                        if($type==1){
                            if($v['option']==$c_answer){
                                $verify_answer=1;
                            }
                        }else{
                            $answer = explode(';',$c_answer);
                            $dx_zong_cnt = count($answer);
                            if(in_array($v['option'],$answer)){
                                $dx_cnt++;
                            }
                        }
                    }
                    if($type==2){
                        if($dx_zong_cnt==$dx_cnt){
                            $verify_answer=1;
                        }
                    }
                    if($verify_answer==0){
                        return $this->_response(GlobalResponse::$HTTP_REQUEST_ERROR_CODE,"答案不在选项中");
                    }
                }
            }
            $mod = new QuestionsModel();
            $info = $mod->get_question_info_by_c_id($c_id);
            $res = $mod->update_question_info($info,$c_id,$c_course_id,$c_question,$c_answer,$c_tag,$type,$content);
            if(!$res){
                return $this->_response(GlobalResponse::$HTTP_DATABASE_ERROR_CODE,"题目修改失败");
            }
            return $this->_response(GlobalResponse::$HTTP_STATUS_OK_CODE,GlobalResponse::HTTP_STATUS_OK_MES);

        } catch (ValidationException $e) {
            return $this->_response(GlobalResponse::$HTTP_REQUEST_ERROR_CODE,$e->getMessage());
        }
    }


    public function batch_question_add(Request $request)
    {
        try {
            $questions = $request->input('questions');

            $validated_data = array(
                'questions' => 'required|array',
                'questions.*.question' => 'required',
                'questions.*.answer' => 'required',
                'questions.*.course_id' => 'required|exists:c_courses,c_course_id',
                'questions.*.id' => 'required',
                'questions.*.tags' => 'required',
                'questions.*.type' => 'required',
            );
            $validated_msg = array(
                'questions.required'=>"questions不能为空",
                'questions.array'=>"questions数据格式不正确",
                'questions.*.question.required'=>"问题不能为空",
                'questions.*.answer.required'=>"答案不能为空",
                'questions.*.course_id.required'=>"课程id不能为空",
                'questions.*.course_id.exists'=>"课程id不存在",
                'questions.*.id.required'=>"问题主键不能为空",
                'questions.*.tags.required'=>"问题标签不能为空",
                'questions.*.type.required'=>"问题类型不能为空",
            );

            $validatedData = $request->validate($validated_data, $validated_msg);
            $QuestionsOptionsMod = new QuestionsOptionsModel();
            foreach($questions as $k=>$v){
                $answer = explode(';',$v['answer']);
                $dx_zong_cnt = count($answer);
                $dx_cnt = 0;
                if(in_array($v['type'],[1,2])){
                    if(!isset($v['options'])){
                        return $this->_response(GlobalResponse::$HTTP_REQUEST_ERROR_CODE,"选项不能为空");
                    }
                    $verify_answer = 0;

                    foreach($v['options'] as $k1=>$v1){
                       
                        if($v['type']==1){
                            if($v1['c_content']==$v['answer']){
                                $verify_answer=1;
                            }
                        }else{
                            if(in_array($v1['c_content'],$answer)){
                                if(!isset($dx_cnt)){
                                    $dx_cnt=0;
                                }
                                $dx_cnt++;
                            }
                        }
                    }
                    if($v['type']==2){
                        if($dx_zong_cnt==$dx_cnt){
                            $verify_answer=1;
                        }
                    }
                    if($verify_answer==0){
                        Log::info($v);
                        return $this->_response(GlobalResponse::$HTTP_REQUEST_ERROR_CODE,"答案不在选项中");
                    }
                }

                $mod = new QuestionsModel();
                $verify = $mod->verify_c_id_only($v['id']);
                if(!$verify){
                    Log::info($v);
                    return $this->_response(GlobalResponse::$HTTP_DATABASE_ERROR_CODE,"ID已存在");
                }
            }


            $res = $mod->batch_create_question_info($questions);
            if(!$res){
                Log::info($v);
                return $this->_response(GlobalResponse::$HTTP_DATABASE_ERROR_CODE,"题目批量插入失败");
            }
            return $this->_response(GlobalResponse::$HTTP_STATUS_OK_CODE,GlobalResponse::HTTP_STATUS_OK_MES);

        } catch (ValidationException $e) {
            return $this->_response(GlobalResponse::$HTTP_REQUEST_ERROR_CODE,$e->getMessage());
        }
    }



    /**
     * 删除题目
     * Notes:
     * User: zhangnan
     * DateTime: 2025/7/11 13:27
     * @param Request $request
     * @return JsonResponse
     */
    public function question_del(Request $request)
    {
        try {
            $c_id     = trim($request->input('id'));
            $validated_data = array(
                'id' => 'required|string|exists:c_questions,c_id',
            );
            $validated_msg = array(
                'id.required'=>"id不能为空",
                'id.string'=>"id类型错误",
                'id.exists'=>"id不存在",
            );
            $validatedData = $request->validate($validated_data, $validated_msg);

            $mod = new QuestionsModel();
            $res = $mod->del_question_info($c_id);
            if(!$res){
                return $this->_response(GlobalResponse::$HTTP_DATABASE_ERROR_CODE,"题目删除失败");
            }
            return $this->_response(GlobalResponse::$HTTP_STATUS_OK_CODE,GlobalResponse::HTTP_STATUS_OK_MES);

        } catch (ValidationException $e) {
            return $this->_response(GlobalResponse::$HTTP_REQUEST_ERROR_CODE,$e->getMessage());
        }
    }

    /**
     * Notes:获取题目列表
     * User: zhangnan
     * DateTime: 2025/7/11 10:53
     * @param Request $request
     * @return JsonResponse
     */
    public function question_list(Request $request)
    {
        $page     = intval($request->input('page'));
        $pageSize     = intval($request->input('pageSize'));
        $mod = new QuestionsModel();
        $res = $mod->get_question_list($pageSize,$page);

        return $this->_response(GlobalResponse::$HTTP_STATUS_OK_CODE,GlobalResponse::HTTP_STATUS_OK_MES,$res);
    }

    /**
     * Notes:获取详情数据
     * User: zhangnan
     * DateTime: 2025/7/11 13:28
     * @param Request $request
     * @return JsonResponse
     */
    public function question_info(Request $request)
    {
        try {
            $c_id     = trim($request->input('id'));
            $validated_data = array(
                'id' => 'required|string|exists:c_questions,c_id',
            );
            $validated_msg = array(
                'id.required'=>"id不能为空",
                'id.string'=>"id类型错误",
                'id.exists'=>"id不存在",
            );
            $validatedData = $request->validate($validated_data, $validated_msg);
            $mod = new QuestionsModel();
            $info = $mod->get_question_info_by_c_id($c_id,1);
            Log::info($info);
            return $this->_response(GlobalResponse::$HTTP_STATUS_OK_CODE,GlobalResponse::HTTP_STATUS_OK_MES,$info);

        } catch (ValidationException $e) {
            return $this->_response(GlobalResponse::$HTTP_REQUEST_ERROR_CODE,$e->getMessage());
        }
    }

        /**
     * Notes: 根据题型获取试题标签接口
     * User: zhangnan
     * DateTime: 2025/12/29
     * @param Request $request
     * @return JsonResponse
     */
    public function get_tags_by_type(Request $request)
    {
        try {
            // 验证请求参数
            $validatedData = $request->validate([
                'type' => 'required|integer|in:1,2,3,4'
            ], [
                'type.required' => '题型不能为空',
                'type.integer' => '题型类型错误',
                'type.in' => '题型参数错误（1:单选题, 2:多选题, 3:判断题, 4:主观题）'
            ]);
            
            $type = $validatedData['type'];
            
            $mod = new QuestionsModel();
            
            // 获取该题型下的所有不重复标签
            $tags = $mod
                ->where('c_type', $type)
                ->whereNotNull('c_tag')
                ->where('c_tag', '!=', '')
                ->select('c_tag')
                ->distinct()
                ->orderBy('c_tag')
                ->get()
                ->pluck('c_tag')
                ->toArray();
            
            // 如果没有标签，返回空数组
            if (empty($tags)) {
                return $this->_response(GlobalResponse::$HTTP_STATUS_OK_CODE, '暂无标签', [
                    'type' => $type,
                    'tags' => [],
                    'count' => 0
                ]);
            }
            
            // 返回标签数据
            return $this->_response(GlobalResponse::$HTTP_STATUS_OK_CODE, '获取标签成功', [
                'type' => $type,
                'tags' => $tags,
                'count' => count($tags)
            ]);
            
        } catch (ValidationException $e) {
            return $this->_response(GlobalResponse::$HTTP_REQUEST_ERROR_CODE, $e->getMessage());
        } catch (\Exception $e) {
            return $this->_response(GlobalResponse::$HTTP_SERVER_ERROR_CODE, '服务器错误: ' . $e->getMessage());
        }
    }

    /**
     * Notes: 获取课程列表
     * DateTime: 2025/10/02 11:08
     * @param Request $request
     * @return JsonResponse
     */
    public function getCourses(Request $request): JsonResponse
    {
        try {
            // 直接使用 DB 门面查询 c_courses 表
            $courses = DB::table('c_courses')
                ->select('c_course_id', 'c_course_name')
                ->get()
                ->map(function ($course) {
                    return [
                        'c_course_id' => $course->c_course_id,
                        'c_course_name' => $course->c_course_name
                    ];
                })
                ->toArray();

            return $this->_response(GlobalResponse::$HTTP_STATUS_OK_CODE, GlobalResponse::HTTP_STATUS_OK_MES, $courses);
        } catch (\Exception $e) {
            return $this->_response(GlobalResponse::$HTTP_DATABASE_ERROR_CODE, "获取课程列表失败: " . $e->getMessage());
        }
    }

        /**
     * Notes: 添加测试
     * User: zhangnan
     * DateTime: 2025/7/11 14:21
     * @param Request $request
     * @return JsonResponse
     */
    public function test_add(Request $request)
    {
        try {
            $c_name     = trim($request->input('name'));
            $c_test_type     = trim($request->input('test_type'));
            $c_type     = trim($request->input('type'));
            $c_description     = trim($request->input('description'));
            $c_paper_count     = trim($request->input('paper_count'));
            $c_start     = trim($request->input('start'));
            $c_end     = trim($request->input('end'));
            $c_course_id = trim($request->input('course_id')); // 修复：改为接收 course_id
            $c_duration  = (int)trim($request->input('duration', 0)); // 新增：获取时长参数
            
            // 验证规则 - 新增时长验证
            $validated_data = array(
                'name' => 'required|max:100',
                'test_type' => 'required|max:50',
                'type' => 'required|max:50',
                'description' => 'required',
                'paper_count' => 'required|integer|max:11',
                'start' => 'required|date|before:end',
                'end' => 'required|date',
                'course_id' => 'required|exists:c_courses,c_course_id',
                // 仅考试类型需要验证时长
                'duration' => $c_type === '考试' ? 'required|integer|min:1|max:300' : 'integer'
            );
            
            $validated_msg = array(
                'name.required' => "名称不能为空",
                'name.max' => "名称字数超限",
                'description.required' => "描述不能为空",
                'paper_count.required' => "试卷数不能为空",
                'paper_count.integer' => "试卷数数据格式不正确",
                'paper_count.max' => "试卷数超限",
                'start.required' => "测试开始时间不能为空",
                'start.date_format' => "测试开始时间不格式不正确",
                'start.before' => "测试结束时间不能小于测试开始时间",
                'end.required' => "测试结束时间不能为空",
                'end.date_format' => "测试结束时间不格式不正确",
                'end.after' => "测试结束时间不能小于当前日期",
                'start.date' => "测试开始时间格式不正确，请使用有效的日期格式",
                'end.date' => "测试结束时间格式不正确，请使用有效的日期格式",
                'course_id.required' => "课程id不能为空",
                'course_id.exists' => "课程id不存在",
                // 新增时长验证消息
                'duration.required' => "测试时长不能为空",
                'duration.integer' => "测试时长必须为整数",
                'duration.min' => "测试时长不能小于1分钟",
                'duration.max' => "测试时长不能超过300分钟"
            );
            
            $validatedData = $request->validate($validated_data, $validated_msg);

            // 新增：理论测试考试类型的时长验证
            if ($c_test_type === '理论测试' && $c_type === '考试') {
                $startTime = strtotime($c_start);
                $endTime = strtotime($c_end);
                $availableMinutes = ($endTime - $startTime) / 60; // 转换为分钟
                
                if ($c_duration > $availableMinutes) {
                    return $this->_response(GlobalResponse::$HTTP_REQUEST_ERROR_CODE, "测试时长不能超过实际可用时间。实际可用时间：" . intval($availableMinutes) . "分钟");
                }
            }

            $mod = new TestsModel();

            // 修复：传递时长参数
            $res = $mod->create_test_info(
                $c_name, 
                $c_test_type, 
                $c_type, 
                $c_description, 
                $c_paper_count, 
                $c_start, 
                $c_end, 
                $c_course_id,
                $c_duration // 新增：传递时长
            );
            
            if (!$res) {
                return $this->_response(GlobalResponse::$HTTP_DATABASE_ERROR_CODE, "测试插入失败");
            }
            return $this->_response(GlobalResponse::$HTTP_STATUS_OK_CODE, GlobalResponse::HTTP_STATUS_OK_MES);

        } catch (ValidationException $e) {
            return $this->_response(GlobalResponse::$HTTP_REQUEST_ERROR_CODE, $e->getMessage());
        }
    }

    /**
     * Notes: 修改测试
     * User: zhangnan
     * DateTime: 2025/7/11 16:14
     * @param Request $request
     * @return JsonResponse
     */
    public function test_update(Request $request)
    {
        try {
            $c_id     = trim($request->input('id'));
            $c_test_type     = trim($request->input('test_type'));
            $c_type     = trim($request->input('type'));
            $c_name     = trim($request->input('name'));
            $c_description     = trim($request->input('description'));
            $c_paper_count     = trim($request->input('paper_count'));
            $c_start     = trim($request->input('start'));
            $c_end     = trim($request->input('end'));
            $c_course_id = trim($request->input('course_id')); // 修复：改为接收 course_id
            $c_duration  = (int)trim($request->input('duration', 0)); // 新增：获取时长参数
            
            // 验证规则 - 新增时长验证
            $validated_data = array(
                'id' => 'required|string|exists:c_tests,c_id',
                'name' => 'required|max:100',
                'test_type' => 'required|max:50',
                'type' => 'required|max:50',
                'description' => 'required',
                'paper_count' => 'required|integer|max:11',
                'start' => 'required|date_format:Y-m-d H:i:s|before:end',
                'end' => 'required|date_format:Y-m-d H:i:s',
                'course_id' => 'required|exists:c_courses,c_course_id',
                // 仅考试类型需要验证时长
                'duration' => $c_type === '考试' ? 'required|integer|min:1|max:300' : 'integer'
            );
            
            $validated_msg = array(
                'id.required' => "id不能为空",
                'id.string' => "id类型错误",
                'id.exists' => "id不存在",
                'name.required' => "名称不能为空",
                'name.max' => "名称字数超限",
                'description.required' => "描述不能为空",
                'paper_count.required' => "试卷数不能为空",
                'paper_count.integer' => "试卷数数据格式不正确",
                'paper_count.max' => "试卷数超限",
                'start.required' => "测试开始时间不能为空",
                'start.date_format' => "测试开始时间不格式不正确",
                'start.before' => "测试结束时间不能小于测试开始时间",
                'end.required' => "测试结束时间不能为空",
                'end.date_format' => "测试结束时间不格式不正确",
                'end.after' => "测试结束时间不能小于当前日期",
                'course_id.required' => "课程id不能为空",
                'course_id.exists' => "课程id不存在",
                // 新增时长验证消息
                'duration.required' => "测试时长不能为空",
                'duration.integer' => "测试时长必须为整数",
                'duration.min' => "测试时长不能小于1分钟",
                'duration.max' => "测试时长不能超过300分钟"
            );
            
            $validatedData = $request->validate($validated_data, $validated_msg);

            // 新增：理论测试考试类型的时长验证
            if ($c_test_type === '理论测试' && $c_type === '考试') {
                $startTime = strtotime($c_start);
                $endTime = strtotime($c_end);
                $availableMinutes = ($endTime - $startTime) / 60; // 转换为分钟
                
                if ($c_duration > $availableMinutes) {
                    return $this->_response(GlobalResponse::$HTTP_REQUEST_ERROR_CODE, "测试时长不能超过实际可用时间。实际可用时间：" . intval($availableMinutes) . "分钟");
                }
            }

            $mod = new TestsModel();
            $info = $mod->get_test_info($c_id);
            
            // 修复：传递时长参数
            $res = $mod->update_test_info(
                $info, 
                $c_name, 
                $c_test_type, 
                $c_type, 
                $c_description, 
                $c_paper_count, 
                $c_start, 
                $c_end, 
                $c_course_id,
                $c_duration // 新增：传递时长
            );
            
            if (!$res) {
                return $this->_response(GlobalResponse::$HTTP_DATABASE_ERROR_CODE, "测试修改失败");
            }
            return $this->_response(GlobalResponse::$HTTP_STATUS_OK_CODE, GlobalResponse::HTTP_STATUS_OK_MES);

        } catch (ValidationException $e) {
            return $this->_response(GlobalResponse::$HTTP_REQUEST_ERROR_CODE, $e->getMessage());
        }
    }


            /**
     * Notes: 测试删除（包含关联用户数据删除）
     * User: zhangnan
     * DateTime: 2025/7/11 16:34
     * @param Request $request
     * @return JsonResponse
     */
    public function test_del(Request $request)
    {
        try {
            $c_id = trim($request->input('id'));
            $validated_data = array(
                'id' => 'required|string|exists:c_tests,c_id',
            );
            $validated_msg = array(
                'id.required' => "id不能为空",
                'id.string' => "id类型错误",
                'id.exists' => "id不存在",
            );
            $validatedData = $request->validate($validated_data, $validated_msg);

            // 开启事务
            DB::beginTransaction();
            
            $mod = new TestsModel();
            
            // 统计关联用户数据数量
            $userCount = DB::table('c_test_users')->where('c_test_id', $c_id)->count();
            
            // 删除测试及关联数据
            $res = $mod->del_test_info($c_id);
            
            if (!$res) {
                // 回滚事务
                DB::rollBack();
                
                // 获取PDO错误信息
                $pdo = DB::connection()->getPdo();
                $errorInfo = $pdo->errorInfo();
                $errorMsg = "测试删除失败，可能存在未清理的关联数据。错误信息: " . (isset($errorInfo[2]) ? $errorInfo[2] : '未知错误');
                DLOG($errorMsg . " test_id={$c_id}", 'error', 'test_log');
                return $this->_response(GlobalResponse::$HTTP_DATABASE_ERROR_CODE, $errorMsg);
            }
            
            // 提交事务
            DB::commit();
            
            // 返回成功提示，包含删除的关联用户数量
            $message = "测试及关联的 {$userCount} 个用户数据已删除";
            return $this->_response(GlobalResponse::$HTTP_STATUS_OK_CODE, $message);

        } catch (ValidationException $e) {
            // 验证异常
            return $this->_response(GlobalResponse::$HTTP_REQUEST_ERROR_CODE, $e->getMessage());
        } catch (\Exception $e) {
            // 回滚事务
            DB::rollBack();
            
            // 捕获所有异常
            DLOG("测试删除异常: [{$e->getLine()}]{$e->getMessage()} test_id={$c_id}", 'error', 'test_log');
            return $this->_response(GlobalResponse::$HTTP_SYSTEM_ERROR_CODE, "系统异常：" . $e->getMessage());
        }
    }

    /**
     * Notes: 删除实验（包含关联用户和资源数据删除）
     * User: zhangnan
     * DateTime: 2025/10/02
     * @param Request $request
     * @return JsonResponse
     */
    public function experiment_del(Request $request)
    {
        try {
            $c_experiment_id = trim($request->input('id'));
            $validated_data = array(
                'id' => 'required|string|exists:c_course_experiments,c_experiment_id',
            );
            $validated_msg = array(
                'id.required' => "实验ID不能为空",
                'id.string' => "实验ID类型错误",
                'id.exists' => "实验ID不存在",
            );
            $request->validate($validated_data, $validated_msg);

            // 开启事务
            DB::beginTransaction();

            // 统计关联用户数据数量
            $userCount = DB::table('c_test_users')->where('c_test_id', $c_experiment_id)->count();
            DLOG("准备删除实验，关联用户数量: {$userCount}, experiment_id={$c_experiment_id}", 'info', 'experiment_log');

            // 删除关联用户数据
            $deleteUsersResult = DB::table('c_test_users')->where('c_test_id', $c_experiment_id)->delete();
            if ($deleteUsersResult === false) {
                DB::rollBack();
                DLOG("删除关联用户数据失败, experiment_id={$c_experiment_id}", 'error', 'experiment_log');
                return $this->_response(GlobalResponse::$HTTP_DATABASE_ERROR_CODE, "删除关联用户数据失败");
            }

            // 删除关联资源数据
            $resources = DB::table('c_experiment_resources')->where('c_experiment_id', $c_experiment_id)->get();
            foreach ($resources as $resource) {
                if (Storage::disk('local_resources')->exists($resource->c_resource_path)) {
                    Storage::disk('local_resources')->delete($resource->c_resource_path);
                }
            }
            $deleteResourcesResult = DB::table('c_experiment_resources')->where('c_experiment_id', $c_experiment_id)->delete();
            if ($deleteResourcesResult === false) {
                DB::rollBack();
                DLOG("删除关联资源数据失败, experiment_id={$c_experiment_id}", 'error', 'experiment_log');
                return $this->_response(GlobalResponse::$HTTP_DATABASE_ERROR_CODE, "删除关联资源数据失败");
            }

            // 获取实验所属课程ID并删除实验文件夹
            $experiment = DB::table('c_course_experiments')->where('c_experiment_id', $c_experiment_id)->first();
            if ($experiment) {
                $courseId = $experiment->c_course_id;
                $course = DB::table('c_courses')->where('c_course_id', $courseId)->first();
                if ($course) {
                    $experimentFolder = "courses/{$course->c_category_id}/{$courseId}/Experiment/{$c_experiment_id}";
                    if (Storage::disk('local_resources')->exists($experimentFolder)) {
                        Storage::disk('local_resources')->deleteDirectory($experimentFolder);
                    }
                }
            }

            // 删除实验主表数据
            $deleteExperimentResult = DB::table('c_course_experiments')->where('c_experiment_id', $c_experiment_id)->delete();
            if ($deleteExperimentResult === false || $deleteExperimentResult === 0) {
                DB::rollBack();
                DLOG("删除实验主表数据失败, experiment_id={$c_experiment_id}", 'error', 'experiment_log');
                return $this->_response(GlobalResponse::$HTTP_DATABASE_ERROR_CODE, "删除实验失败");
            }

            // 提交事务
            DB::commit();
            DLOG("实验删除成功, experiment_id={$c_experiment_id}", 'info', 'experiment_log');

            // 返回成功提示，包含删除的关联用户数量
            $message = "实验及关联的 {$userCount} 个用户数据已删除";
            return $this->_response(GlobalResponse::$HTTP_STATUS_OK_CODE, $message);

        } catch (ValidationException $e) {
            DLOG("验证异常: {$e->getMessage()}, experiment_id={$c_experiment_id}", 'error', 'experiment_log');
            return $this->_response(GlobalResponse::$HTTP_REQUEST_ERROR_CODE, $e->getMessage());
        } catch (\Exception $e) {
            DB::rollBack();
            DLOG("实验删除异常: [{$e->getLine()}]{$e->getMessage()}, experiment_id={$c_experiment_id}", 'error', 'experiment_log');
            return $this->_response(GlobalResponse::$HTTP_SYSTEM_ERROR_CODE, "系统异常：" . $e->getMessage());
        }
    }


    /**
     * Notes: 测试列表
     * User: zhangnan
     * DateTime: 2025/7/11 16:54
     * @param Request $request
     * @return JsonResponse
     */
    public function test_list(Request $request)
    {
        $page     = intval($request->input('page'));
        $pageSize     = intval($request->input('pageSize'));
        $mod = new TestsModel();
        $res = $mod->get_test_list($pageSize, $page);

        return $this->_response(GlobalResponse::$HTTP_STATUS_OK_CODE, GlobalResponse::HTTP_STATUS_OK_MES, $res);
    }


    /**
     * Notes:获取测试详情
     * User: zhangnan
     * DateTime: 2025/7/11 17:01
     * @param Request $request
     * @return JsonResponse
     */
    public function test_info(Request $request)
    {
        try {
            $c_id     = trim($request->input('id'));
            $validated_data = array(
                'id' => 'required|string|exists:c_tests,c_id',
            );
            $validated_msg = array(
                'id.required'=>"id不能为空",
                'id.string'=>"id类型错误",
                'id.exists'=>"id不存在",
            );
            $validatedData = $request->validate($validated_data, $validated_msg);
            $mod = new TestsModel();
            $info = $mod->get_test_info($c_id);
            return $this->_response(GlobalResponse::$HTTP_STATUS_OK_CODE,GlobalResponse::HTTP_STATUS_OK_MES,$info);

        } catch (ValidationException $e) {
            return $this->_response(GlobalResponse::$HTTP_REQUEST_ERROR_CODE,$e->getMessage());
        }
    }

    /**
     * Notes: 根据测试ID获取关联用户信息
     * User: zhangnan
     * DateTime: 2025/8/22 10:00
     * @param Request $request
     * @return JsonResponse
     */
    public function getTestUsersByTestId(Request $request)
    {
        try {
            // 1. 接收并验证参数
            $testId = trim($request->input('test_id'));
            $validatedData = $request->validate([
                'test_id' => 'required|string|max:50', // 与表中varchar(50)对应
            ], [
                'test_id.required' => '测试ID不能为空',
                'test_id.string' => '测试ID必须为字符串',
                'test_id.max' => '测试ID长度不能超过50个字符',
            ]);

            // 2. 调用模型查询测试关联的用户列表（test_users表）
            $testUsersModel = new TestUsersModel();
            $userList = $testUsersModel->getUsersByTestId($testId);

            // 3. 处理返回数据（直接查询c_users表获取真实姓名）
            $result = [];
            foreach ($userList as $user) {
                // 4. 直接查询c_users表获取用户真实姓名
                // 使用DB facade直接操作数据库，无需UserModel
                $userInfo = DB::table('c_users')
                            ->where('c_username', $user->c_username)
                            ->first(); // 获取用户信息
                
                $result[] = [
                    'test_id' => $user->c_test_id,
                    'username' => $user->c_username,
                    'name' => $userInfo ? $userInfo->c_name : $user->c_username, // 优先使用c_users表的c_name
                    'paper_id' => $user->c_paper_id,
                    'answers' => $user->c_answers,
                    'start_time' => $user->c_start ? date('Y-m-d H:i:s', strtotime($user->c_start)) : null,
                    'end_time' => $user->c_end ? date('Y-m-d H:i:s', strtotime($user->c_end)) : null,
                    'submit_time' => $user->c_submit ? date('Y-m-d H:i:s', strtotime($user->c_submit)) : null,
                    'c_objective_score' => $user->c_objective_score ?? 0,
                    'c_subjective_score' => $user->c_subjective_score ?? 0,
                    'score' => $user->c_score ?? 0,
                    'correct_status' => $user->c_correct,
                    'correct_status_text' => $user->c_correct_text,
                ];
            }

            // 5. 返回成功响应
            return $this->_response(
                GlobalResponse::$HTTP_STATUS_OK_CODE,
                GlobalResponse::HTTP_STATUS_OK_MES,
                $result
            );

        } catch (ValidationException $e) {
            return $this->_response(
                GlobalResponse::$HTTP_REQUEST_ERROR_CODE,
                $e->getMessage()
            );
        } catch (\Exception $e) {
            return $this->_response(
                GlobalResponse::$HTTP_SERVER_ERROR_CODE,
                '获取数据失败：' . $e->getMessage()
            );
        }
    }

    /**
     * Notes: 获取所有用户的用户名和姓名
     * DateTime: 2025/8/25 10:00
     * @return JsonResponse
     */
    public function getAllUsers()
    {
        try {
            // 1. 从c_users表查询所有用户的c_username和c_name字段
            // 只查询需要的字段，提高效率
            $users = DB::table('c_users')
                    ->select('c_username', 'c_name') // 仅获取用户名和姓名
                    ->whereNotNull('c_username') // 过滤掉用户名为空的记录
                    ->orderBy('c_name', 'asc') // 按姓名升序排序
                    ->get();

            // 2. 处理返回格式（转为数组，方便前端使用）
            $result = $users->map(function ($user) {
                return [
                    'username' => $user->c_username,
                    'name' => $user->c_name ?: $user->c_username, // 姓名为空时用用户名代替
                ];
            })->toArray();

            // 3. 返回成功响应
            return $this->_response(
                GlobalResponse::$HTTP_STATUS_OK_CODE,
                GlobalResponse::HTTP_STATUS_OK_MES,
                $result
            );

        } catch (\Exception $e) {
            // 异常处理
            return $this->_response(
                GlobalResponse::$HTTP_SERVER_ERROR_CODE,
                '获取用户列表失败：' . $e->getMessage()
            );
        }
    }       
    
    
    /**
     * Notes: 批量添加测试用户
     * User: zhangnan
     * DateTime: 2025/8/25 10:00
     * @param Request $request
     * @return JsonResponse
     */
    public function batchStoreTestUsers(Request $request)
    {
        try {
            // 1. 接收并验证参数
            $validatedData = $request->validate([
                'users' => 'required|array', // 验证用户数组必须存在且为数组
                'users.*.c_test_id' => 'required|string|max:50', // 每个用户的测试ID验证
                'users.*.c_username' => 'required|string|max:50', // 每个用户的用户名验证
                'users.*.c_paper_id' => 'required|string|max:50', // 每个用户的试卷ID验证
            ], [
                'users.required' => '用户列表不能为空',
                'users.array' => '用户列表必须为数组格式',
                'users.*.c_test_id.required' => '测试ID不能为空',
                'users.*.c_username.required' => '用户名不能为空',
                'users.*.c_paper_id.required' => '试卷ID不能为空',
                // 其他验证提示信息可以根据需要添加
            ]);
            
            $users = $validatedData['users'];
            
            // 2. 调用模型批量添加用户
            $testUsersModel = new TestUsersModel();
            $insertedCount = $testUsersModel->batchInsertUsers($users);
            
            // 3. 返回成功响应
            return $this->_response(
                GlobalResponse::$HTTP_STATUS_OK_CODE,
                "成功添加 {$insertedCount} 个用户",
                ['count' => $insertedCount]
            );

        } catch (ValidationException $e) {
            return $this->_response(
                GlobalResponse::$HTTP_REQUEST_ERROR_CODE,
                $e->getMessage()
            );
        } catch (\Exception $e) {
            return $this->_response(
                GlobalResponse::$HTTP_SERVER_ERROR_CODE,
                '批量添加用户失败：' . $e->getMessage()
            );
        }
    }

    /**
 * Notes: 单个删除测试用户（根据测试ID+用户名+试卷ID联合删除）
 * DateTime: 2025/8/26 10:00
 * @param Request $request
 * @return JsonResponse
 */
public function destroy(Request $request)
{
    try {
        // 1. 接收并验证前端参数（三个字段联合唯一标识一条记录）
        $validatedData = $request->validate([
            'c_test_id' => 'required|string|max:50',
            'c_username' => 'required|string|max:50',
            'c_paper_id' => 'required|string|max:50',
        ], [
            'c_test_id.required' => '测试ID不能为空',
            'c_username.required' => '用户名不能为空',
            'c_paper_id.required' => '试卷ID不能为空',
        ]);

        // 2. 调用模型层执行删除逻辑（静态方法必须用「类名::方法名」调用，而非实例化）
        // 注意：确保TestUsersModel的引入路径正确（如use App\Models\TestUsersModel;）
        $deleteResult = TestUsersModel::deleteSingleUser($validatedData);

        // 3. 根据删除结果返回响应
        if ($deleteResult === false) {
            return $this->_response(
                GlobalResponse::$HTTP_REQUEST_ERROR_CODE,
                '删除失败：该测试用户关联记录不存在'
            );
        }

        // 4. 删除成功（返回删除的核心信息，方便前端同步更新列表）
        return $this->_response(
            GlobalResponse::$HTTP_STATUS_OK_CODE,
            '测试用户删除成功',
            [
                'c_test_id' => $validatedData['c_test_id'],
                'c_username' => $validatedData['c_username'],
                'c_paper_id' => $validatedData['c_paper_id']
            ]
        );

    } catch (ValidationException $e) {
        // 参数验证失败（如字段为空、格式错误）
        return $this->_response(
            GlobalResponse::$HTTP_REQUEST_ERROR_CODE,
            $e->getMessage()
        );
    } catch (\Exception $e) {
        // 数据库异常或其他未知异常
        return $this->_response(
            GlobalResponse::$HTTP_SERVER_ERROR_CODE,
            '删除测试用户失败：' . $e->getMessage()
        );
    }
}

        /**
 * Notes:获取所有组卷规则
 * User: zhangnan
 * DateTime: 2025/7/11 17:01
 * @param Request $request
 * @return JsonResponse
 */
public function get_all_paper_rules(Request $request)
{
    try {
        $mod = new PaperRulesModel();
        $allRules = $mod->get_all_paper_rules();
        
        $typeDict = [
            '1' => 'single_choice',
            '2' => 'multiple_choice',
            '3' => 'true_or_false',
            '4' => 'subjective',
        ];
        
        $groupedRules = [];
        foreach ($allRules as $rule) {
            $testId = $rule->testId;
            
            if (!isset($groupedRules[$testId])) {
                $groupedRules[$testId] = [
                    'testId' => $testId,
                    'testName' => $rule->testName ?? '未知测试', // 兼容空名称
                    'items' => []
                ];
            }
            
            foreach ($rule->items as $item) { 
                if (isset($typeDict[(string)$item->c_type])) { 
                    $groupedRules[$testId]['items'][] = [
                        // 修复：用实际存在的c_id替换不存在的key
                        'key' => $item->c_id,  // 关键修复：使用数据库中的c_id字段
                        'tag' => $item->c_tag ?? '', // 兼容空标签
                        'type' => (int)$item->c_type,
                        'count' => (int)$item->c_count,
                        'score' => (int)$item->c_score
                    ];
                }
            }
        }
        
        $result = array_values($groupedRules);
        
        return $this->_response(
            GlobalResponse::$HTTP_STATUS_OK_CODE,
            GlobalResponse::HTTP_STATUS_OK_MES,
            $result
        );
        
    } catch (\Exception $e) {
        // 记录详细错误信息（包含行号）
        DLOG("[get_all_paper_rules错误] Line: {$e->getLine()}, Msg: {$e->getMessage()}", 'error', 'paper_rules_log');
        return $this->_response(
            GlobalResponse::$HTTP_REQUEST_ERROR_CODE,
            "获取规则失败：{$e->getMessage()}"
        );
    }
}

        /**
         * 根据测试ID获取组卷规则
         * Notes: 查询与指定testId相关的组卷规则
         * User: assistant
         * DateTime: 2025/9/20
         * @param Request $request
         * @return JsonResponse
         */
        public function getPaperRulesByTestId(Request $request)
        {
            try {
                // 从查询参数获取testId
                $testId = $request->query('test_id');
                
                // 验证测试ID
                if (empty($testId) || !is_string($testId)) {
                    Log::error('测试ID无效', ['test_id' => $testId]);
                    return $this->_response(
                        GlobalResponse::$HTTP_REQUEST_ERROR_CODE,
                        '测试ID无效'
                    );
                }

                // 查询 c_paper_rules 表，关联 c_tests 表获取测试名称
                $rules = DB::table('c_paper_rules')
                    ->leftJoin('c_tests', 'c_paper_rules.c_test_id', '=', 'c_tests.c_id')
                    ->select([
                        'c_paper_rules.c_id',
                        'c_paper_rules.c_test_id',
                        'c_tests.c_name as testName',
                        'c_paper_rules.c_type',
                        'c_paper_rules.c_tag',
                        'c_paper_rules.c_count',
                        'c_paper_rules.c_score'
                    ])
                    ->where('c_paper_rules.c_test_id', $testId)
                    ->get();

                $typeDict = [
                    '1' => 'single_choice',
                    '2' => 'multiple_choice',
                    '3' => 'true_or_false',
                    '4' => 'subjective',
                ];

                // 格式化规则
                $groupedRules = [
                    'testId' => $testId,
                    'testName' => $rules->isEmpty() ? '未知测试' : ($rules->first()->testName ?? '未知测试'),
                    'items' => []
                ];

                foreach ($rules as $rule) {
                    if (isset($typeDict[(string)$rule->c_type])) {
                        $groupedRules['items'][] = [
                            'key' => $rule->c_id,
                            'tag' => $rule->c_tag ?? '',
                            'type' => (int)$rule->c_type,
                            'count' => (int)$rule->c_count,
                            'score' => (int)$rule->c_score
                        ];
                    }
                }

                // 如果没有规则，返回空 items 数组
                if ($rules->isEmpty()) {
                    Log::info('未找到与测试ID关联的组卷规则', ['test_id' => $testId]);
                } else {
                    Log::info('获取组卷规则成功', [
                        'test_id' => $testId,
                        'test_name' => $groupedRules['testName'],
                        'item_count' => count($groupedRules['items'])
                    ]);
                }

                return $this->_response(
                    GlobalResponse::$HTTP_STATUS_OK_CODE,
                    GlobalResponse::HTTP_STATUS_OK_MES,
                    $groupedRules // 移除了数组包装，直接返回对象
                );
            } catch (\Exception $e) {
                Log::error("[getPaperRulesByTestId错误] Line: {$e->getLine()}, Msg: {$e->getMessage()}", [
                    'test_id' => $testId ?? 'null',
                    'trace' => $e->getTraceAsString()
                ], 'paper_rules_log');
                return $this->_response(
                    GlobalResponse::$HTTP_REQUEST_ERROR_CODE,
                    "获取规则失败：{$e->getMessage()}"
                );
            }
        }


   /**
 * Notes: 添加组题规则（支持同题型多次添加）
 * User: zhangnan
 * DateTime: 2025/7/17 13:39
 * @param Request $request
 * @return JsonResponse
 */
public function paper_rules_add(Request $request)
{
    try {
        $c_test_id = trim($request->input('test_id'));
        // 接收同题型数组（核心：每个题型接收数组而非单个对象）
        $single_choice = $request->input('single_choice', []);
        $multiple_choice = $request->input('multiple_choice', []);
        $true_or_false = $request->input('true_or_false', []);
        $subjective = $request->input('subjective', []);

        // 参数验证（支持数组及数组内元素校验）
        $validated_data = [
            'test_id' => 'required|max:50|string|exists:c_tests,c_id|unique:c_paper_rules,c_test_id',
            'single_choice' => 'nullable|array',
            'single_choice.*.tag' => 'required|max:50',
            'single_choice.*.count' => 'required|int|min:1',
            'single_choice.*.score' => 'required|int|min:1',
            'multiple_choice' => 'nullable|array',
            'multiple_choice.*.tag' => 'required|max:50',
            'multiple_choice.*.count' => 'required|int|min:1',
            'multiple_choice.*.score' => 'required|int|min:1',
            'true_or_false' => 'nullable|array',
            'true_or_false.*.tag' => 'required|max:50',
            'true_or_false.*.count' => 'required|int|min:1',
            'true_or_false.*.score' => 'required|int|min:1',
            'subjective' => 'nullable|array',
            'subjective.*.tag' => 'required|max:50',
            'subjective.*.count' => 'required|int|min:1',
            'subjective.*.score' => 'required|int|min:1',
        ];

        $validated_msg = [
            'test_id.required' => "测试主键不能为空",
            'test_id.unique' => "测试已存在组卷规则",
            'single_choice.array' => "单选题数据格式错误（需为数组）",
            'single_choice.*.tag.required' => "单选题标签不能为空",
            'multiple_choice.array' => "多选题数据格式错误（需为数组）",
            'multiple_choice.*.tag.required' => "多选题标签不能为空",
            'true_or_false.array' => "判断题数据格式错误（需为数组）",
            'true_or_false.*.tag.required' => "判断题标签不能为空",
            'subjective.array' => "主观题数据格式错误（需为数组）",
            'subjective.*.tag.required' => "主观题标签不能为空",
            '*.count.min' => ":attribute 题数不能小于1",
            '*.score.min' => ":attribute 分数不能小于1",
        ];

        // 收集所有规则项（核心：保留每个独立规则项，不合并同题型）
        $allRules = [];
        // 处理单选题数组
        foreach ($single_choice as $item) {
            $allRules[] = [
                'type' => 1,
                'tag' => $item['tag'],
                'count' => $item['count'],
                'score' => $item['score']
            ];
        }
        // 处理多选题数组
        foreach ($multiple_choice as $item) {
            $allRules[] = [
                'type' => 2,
                'tag' => $item['tag'],
                'count' => $item['count'],
                'score' => $item['score']
            ];
        }
        // 处理判断题数组
        foreach ($true_or_false as $item) {
            $allRules[] = [
                'type' => 3,
                'tag' => $item['tag'],
                'count' => $item['count'],
                'score' => $item['score']
            ];
        }
        // 处理主观题数组
        foreach ($subjective as $item) {
            $allRules[] = [
                'type' => 4,
                'tag' => $item['tag'],
                'count' => $item['count'],
                'score' => $item['score']
            ];
        }

        if (empty($allRules)) {
            return $this->_response(GlobalResponse::$HTTP_REQUEST_ERROR_CODE, "未获取到组卷规则");
        }

        $validatedData = $request->validate($validated_data, $validated_msg);

        // 验证题目是否充足（独立校验每个规则项）
        $question_mod = new QuestionsModel();
        $typeMap = [1 => '单选题', 2 => '多选题', 3 => '判断题', 4 => '主观题'];
        foreach ($allRules as $rule) {
            $availableCount = $question_mod->get_question_cnt($rule['type'], $rule['tag']);
            if ($availableCount < $rule['count']) {
                return $this->_response(
                    GlobalResponse::$HTTP_REQUEST_ERROR_CODE,
                    "{$typeMap[$rule['type']]}（标签：{$rule['tag']}）题目不足，需要{$rule['count']}题，仅找到{$availableCount}题"
                );
            }
        }

        // 自动组卷（使用新的组卷逻辑）
        $test_mod = new TestsModel();
        $test_info = $test_mod->get_test_info($c_test_id);
        $question_list = $this->automatic_question_grouping($test_info->c_paper_count, $allRules);

        // 保存规则
        $mod = new PaperRulesModel();
        $res = $mod->create_paper_rules_info($c_test_id, $allRules, $question_list);
        if (!$res) {
            return $this->_response(GlobalResponse::$HTTP_DATABASE_ERROR_CODE, "组题规则添加失败");
        }
        return $this->_response(GlobalResponse::$HTTP_STATUS_OK_CODE, "添加成功！已生成对应试卷");
    } catch (ValidationException $e) {
        return $this->_response(GlobalResponse::$HTTP_REQUEST_ERROR_CODE, $e->getMessage());
    }
}

/**
 * 2. 更新组卷规则（同步更新试卷，支持同题型多次添加）
 */
public function paper_rules_update(Request $request)
{
    try {
        $c_test_id = trim($request->input('test_id'));
        // 接收同题型数组（与添加规则保持一致）
        $single_choice = $request->input('single_choice', []);
        $multiple_choice = $request->input('multiple_choice', []);
        $true_or_false = $request->input('true_or_false', []);
        $subjective = $request->input('subjective', []);

        // 参数验证（与添加规则保持一致）
        $validated_data = [
            'test_id' => 'required|max:50|string|exists:c_tests,c_id|exists:c_paper_rules,c_test_id',
            'single_choice' => 'nullable|array',
            'single_choice.*.tag' => 'required|max:50',
            'single_choice.*.count' => 'required|int|min:1',
            'single_choice.*.score' => 'required|int|min:1',
            'multiple_choice' => 'nullable|array',
            'multiple_choice.*.tag' => 'required|max:50',
            'multiple_choice.*.count' => 'required|int|min:1',
            'multiple_choice.*.score' => 'required|int|min:1',
            'true_or_false' => 'nullable|array',
            'true_or_false.*.tag' => 'required|max:50',
            'true_or_false.*.count' => 'required|int|min:1',
            'true_or_false.*.score' => 'required|int|min:1',
            'subjective' => 'nullable|array',
            'subjective.*.tag' => 'required|max:50',
            'subjective.*.count' => 'required|int|min:1',
            'subjective.*.score' => 'required|int|min:1',
        ];

        $validated_msg = [
            'test_id.required' => "测试主键不能为空",
            'test_id.exists' => "不存在此测试的组卷规则",
            // 其他提示与添加规则一致
            'single_choice.array' => "单选题数据格式错误（需为数组）",
            'single_choice.*.tag.required' => "单选题标签不能为空",
            'multiple_choice.array' => "多选题数据格式错误（需为数组）",
            'multiple_choice.*.tag.required' => "多选题标签不能为空",
            'true_or_false.array' => "判断题数据格式错误（需为数组）",
            'true_or_false.*.tag.required' => "判断题标签不能为空",
            'subjective.array' => "主观题数据格式错误（需为数组）",
            'subjective.*.tag.required' => "主观题标签不能为空",
        ];

        $validatedData = $this->validate($request, $validated_data, $validated_msg);

        // 收集所有规则项（保留每个独立规则项）
        $allRules = [];
        foreach ($single_choice as $item) {
            $allRules[] = [
                'type' => 1,
                'tag' => $item['tag'],
                'count' => $item['count'],
                'score' => $item['score']
            ];
        }
        foreach ($multiple_choice as $item) {
            $allRules[] = [
                'type' => 2,
                'tag' => $item['tag'],
                'count' => $item['count'],
                'score' => $item['score']
            ];
        }
        foreach ($true_or_false as $item) {
            $allRules[] = [
                'type' => 3,
                'tag' => $item['tag'],
                'count' => $item['count'],
                'score' => $item['score']
            ];
        }
        foreach ($subjective as $item) {
            $allRules[] = [
                'type' => 4,
                'tag' => $item['tag'],
                'count' => $item['count'],
                'score' => $item['score']
            ];
        }

        if (empty($allRules)) {
            throw new \Exception("未获取到组卷规则（至少保留一项）");
        }

        // 验证题目是否充足（独立校验每个规则项）
        $question_mod = new QuestionsModel();
        $typeMap = [1 => '单选题', 2 => '多选题', 3 => '判断题', 4 => '主观题'];
        foreach ($allRules as $rule) {
            $availableCount = $question_mod->get_question_cnt($rule['type'], $rule['tag']);
            if ($availableCount < $rule['count']) {
                throw new \Exception(
                    "{$typeMap[$rule['type']]}（标签：{$rule['tag']}）题目不足，需要{$rule['count']}题，仅找到{$availableCount}题"
                );
            }
        }

        // 自动组卷（使用新的组卷逻辑）
        $testModel = new TestsModel();
        $testInfo = $testModel->get_test_info($c_test_id);
        $questionList = $this->automatic_question_grouping($testInfo->c_paper_count, $allRules);

        // 更新规则+试卷
        $ruleModel = new PaperRulesModel();
        $updateResult = $ruleModel->update_paper_rules_info($c_test_id, $allRules, $questionList);
        if (!$updateResult) {
            throw new \Exception("规则及试卷更新失败");
        }

        return $this->_response(200, "组卷规则修改成功，试卷已同步更新");
    } catch (ValidationException $e) {
        return $this->_response(400, $e->getMessage());
    } catch (\Exception $e) {
        Log::error('更新规则及试卷异常', [
            'test_id' => $c_test_id,
            'error' => $e->getMessage(),
            'trace' => $e->getTraceAsString()
        ]);
        return $this->_response(500, "更新失败：" . $e->getMessage());
    }
}
/**
     * 删除组卷规则（同步删除关联试卷）
     */
    public function paper_rules_del(Request $request)
    {
        try {
            $c_test_id = trim($request->input('test_id'));
            
            // 参数验证
            $this->validate($request, [
                'test_id' => 'required|max:50|string|exists:c_paper_rules,c_test_id'
            ], [
                'test_id.required' => "测试主键不能为空",
                'test_id.max' => "测试主键字段超限",
                'test_id.exists' => "不存在此测试的组卷规则",
                'test_id.string' => "测试主键类型错误"
            ]);

            DB::beginTransaction();
            // 步骤1：删除关联试卷
            $paperModel = new PapersModel();
            $paperDelResult = $paperModel->del_paper_by_test_id($c_test_id);
            if (!$paperDelResult) {
                throw new \Exception("关联试卷删除失败");
            }

            // 步骤2：删除组卷规则
            $ruleModel = new PaperRulesModel();
            $ruleDelResult = $ruleModel->del_paper_rules_by_test_id($c_test_id);
            if (!$ruleDelResult) {
                throw new \Exception("组卷规则删除失败");
            }

            DB::commit();
            return $this->_response(200, "组卷规则及关联试卷删除成功");
        } catch (ValidationException $e) {
            DB::rollback();
            return $this->_response(400, $e->getMessage());
        } catch (\Exception $e) {
            DB::rollback();
            Log::error('删除规则及试卷异常', [
                'test_id' => $c_test_id,
                'error' => $e->getMessage()
            ]);
            return $this->_response(500, "删除失败：" . $e->getMessage());
        }
    }
    


    /**
     * Notes:查询组卷规则
     * User: zhangnan
     * DateTime: 2025/7/17 15:41
     * @param Request $request
     */
    public function get_paper_rules_info(Request $request)
    {
        try {
            $c_test_id     = trim($request->input('test_id'));
            $validated_data = array(
                'test_id' => 'required|max:50|string|exists:c_paper_rules,c_test_id',
            );
            $validated_msg = array(
                'test_id.required'=>"测试主键不能为空",
                'test_id.max'=>"测试主键字段超限",
                'test_id.exists'=>"不存在此测试的组卷规则",
                'test_id.string'=>"测试主键类型错误",
            );

            $validatedData = $request->validate($validated_data, $validated_msg);
            $mod = new PaperRulesModel();
            $list = $mod->get_paper_rules_info($c_test_id);
            $dic["1"]='single_choice';
            $dic["2"]='multiple_choice';
            $dic["3"]='true_or_false';
            $dic["4"]='subjective';


            $res = array(
                'single_choice'=>array(
                    'key'=>"",
                    'tag'=>"",
                    'type'=>1,
                    'count'=>0,
                    'score'=>0
                ),
                'multiple_choice'=>array(
                    'key'=>"",
                    'tag'=>"",
                    'type'=>1,
                    'count'=>0,
                    'score'=>0
                ),
                'true_or_false'=>array(
                    'key'=>"",
                    'tag'=>"",
                    'type'=>1,
                    'count'=>0,
                    'score'=>0
                ),
                'subjective'=>array(
                    'key'=>"",
                    'tag'=>"",
                    'type'=>1,
                    'count'=>0,
                    'score'=>0
                ),
            );
            foreach($list as $k=>$v){
                $res[$dic[$v->c_type]]['key']=$v->c_id;
                $res[$dic[$v->c_type]]['tag']=$v->c_tag;
                $res[$dic[$v->c_type]]['type']=$v->c_type;
                $res[$dic[$v->c_type]]['count']=$v->c_count;
                $res[$dic[$v->c_type]]['score']=$v->c_score;
            }

            return $this->_response(GlobalResponse::$HTTP_STATUS_OK_CODE,GlobalResponse::HTTP_STATUS_OK_MES,$res);
        } catch (ValidationException $e) {
            return $this->_response(GlobalResponse::$HTTP_REQUEST_ERROR_CODE,$e->getMessage());
        }
    }


    /**
     * 新组卷逻辑：支持同题型多规则项独立处理
     * @param int $paperCount 试卷数量
     * @param array $allRules 所有独立规则项（含type、tag、count、score）
     * @return array 生成的试卷列表
     */
  public function automatic_question_grouping($paperCount, $allRules)
{
    $questionList = [];
    $questionModel = new QuestionsModel();
    $typeMap = [1 => '单选题', 2 => '多选题', 3 => '判断题', 4 => '主观题'];

    for ($p = 0; $p < $paperCount; $p++) {
        $paperQuestions = [];
        $paperAnswers = [];

        foreach ($allRules as $rule) {
            $type = $rule['type'];
            $tag = $rule['tag'];
            $needCount = $rule['count'];
            $score = $rule['score'];

            // 获取题目（使用修复后的查询方法）
            $questions = $questionModel->get_questions_by_type_and_tag($type, $tag);
            
            // 检查有效题目
            if (empty($questions)) {
                throw new \Exception("{$typeMap[$type]}（标签：{$tag}）未找到有效题目（缺少ID或题目内容）");
            }
            if (count($questions) < $needCount) {
                throw new \Exception("{$typeMap[$type]}（标签：{$tag}）有效题目不足，需要{$needCount}题，仅找到" . count($questions) . "题");
            }

            // 随机选择题目
            $randomKeys = array_rand($questions, $needCount);
            $randomKeys = is_array($randomKeys) ? $randomKeys : [$randomKeys];

            foreach ($randomKeys as $key) {
                $q = $questions[$key];
                
                // 检查核心字段是否存在（基于数据库实际结构）
                if (empty($q['id'])) {
                    throw new \Exception("题目数据异常：缺少ID（标签：{$tag}）");
                }
                if (empty($q['content'])) {
                    throw new \Exception("题目数据异常：缺少题目内容（ID：{$q['id']}，标签：{$tag}）");
                }
                if (empty($q['answer'])) {
                    Log::warning("题目缺少答案，可能影响试卷完整性", ['question_id' => $q['id'], 'tag' => $tag]);
                }

                // 组装题目数据（移除不存在的options字段）
                $paperQuestions[] = [
                    'id' => $q['id'],                // 映射后的id
                    'type' => $type,                 // 题型
                    'content' => $q['content'],      // 映射后的题目内容（核心修复）
                    'score' => $score,               // 每题分数
                    // 数据库无options字段，删除该属性
                ];

                // 组装答案数据
                $paperAnswers[] = [
                    'question_id' => $q['id'],       // 关联题目ID
                    'answer' => $q['answer'] ?? ''   // 答案（处理空值）
                ];
            }
        }

        // 组装当前试卷
        $questionList[] = [
            'question' => $paperQuestions,  // 题目列表
            'answer' => $paperAnswers       // 答案列表
        ];
    }

    return $questionList;
}

    /**
     * Notes:随机抽题
     * User: zhangnan
     * DateTime: 2025/7/21 17:26
     * @param $question_array
     * @param $not_id
     * @return array|int|mixed|string
     */
    public function extract_questions($question_array=[],$not_id=[])
    {
        $filteredData = array_diff_key($question_array, array_flip($not_id));
        $randomKey = array_rand($filteredData);
        $randomValue = $filteredData[$randomKey];
        return $randomValue;
    }

    

    /**
 * Notes: 通过测试id获取试卷
 * User: zhangnan
 * DateTime: 2025/7/21 18:48
 * @param Request $request
 * @return JsonResponse
 */
public function get_papers(Request $request)
{
    try {
        $testId = $request->input('test_id');
        $validated_data = [
            'test_id' => 'required|string|exists:c_tests,c_id',
        ];
        $validated_msg = [
            'test_id.required' => "测试ID不能为空",
            'test_id.string' => "测试ID类型错误",
            'test_id.exists' => "测试不存在",
        ];
        
        $validatedData = $request->validate($validated_data, $validated_msg);
        
        // 获取试卷列表
        $papers = DB::table('c_papers')
            ->where('c_test_id', $testId)
            ->select('c_id as paperId', 'c_test_id as testId', 'c_questions') // 直接获取c_questions字段
            ->get();
            
        // 如果没有试卷，直接返回空数组
        if ($papers->isEmpty()) {
            return $this->_response(
                GlobalResponse::$HTTP_STATUS_OK_CODE,
                GlobalResponse::HTTP_STATUS_OK_MES,
                []
            );
        }
        
        // 计算每份试卷的总分（修复核心逻辑）
        $papersWithScores = $papers->map(function ($paper) {
            // 解析题目数据（确保是数组）
            $questions = json_decode($paper->c_questions, true) ?? [];
            
            $totalScore = 0;
            $questionCount = 0;
            
            // 遍历题目数组（直接访问题目项，不依赖data键）
            foreach ($questions as $question) {
                // 累加分数（题目数组中直接包含score字段）
                $totalScore += $question['score'] ?? 0;
                // 累加题目数量
                $questionCount++;
            }
            
            return (object)[
                'paperId' => $paper->paperId,
                'testId' => $paper->testId,
                'totalScore' => $totalScore,
                'questionCount' => $questionCount
            ];
        });
        
        return $this->_response(
            GlobalResponse::$HTTP_STATUS_OK_CODE,
            GlobalResponse::HTTP_STATUS_OK_MES,
            $papersWithScores
        );
        
    } catch (ValidationException $e) {
        return $this->_response(
            GlobalResponse::$HTTP_REQUEST_ERROR_CODE,
            $e->getMessage()
        );
    } catch (\Exception $e) {
        // 记录详细错误日志便于排查
        Log::error('获取试卷失败', [
            'test_id' => $testId,
            'error' => $e->getMessage(),
            'trace' => $e->getTraceAsString()
        ]);
        return $this->_response(
            GlobalResponse::$HTTP_SERVER_ERROR_CODE,
            '获取试卷失败: ' . $e->getMessage()
        );
    }
}


    /**
 * Notes: 获取试卷详细信息（从c_question_options表获取选项）
 * 
 * @param Request $request
 * @return \Illuminate\Http\JsonResponse
 */
public function get_paper_details(Request $request)
{
    try {
        $paperId = $request->input('paper_id');
        
        // 验证参数
        $validatedData = $request->validate([
            'paper_id' => 'required|string|exists:c_papers,c_id'
        ], [
            'paper_id.required' => '试卷ID不能为空',
            'paper_id.string' => '试卷ID类型错误',
            'paper_id.exists' => '试卷不存在'
        ]);
        
        // 获取试卷基本信息
        $paper = DB::table('c_papers')
            ->where('c_id', $paperId)
            ->first();
        
        if (!$paper) {
            return $this->_response(
                GlobalResponse::$HTTP_REQUEST_ERROR_CODE,
                "试卷不存在"
            );
        }
        
        // 解析题目和答案JSON（修复核心：处理扁平数组结构）
        try {
            // 假设c_questions存储的是扁平题目数组（每个元素是独立题目）
            $questions = json_decode($paper->c_questions, true, 512, JSON_THROW_ON_ERROR) ?? [];
            // 假设c_answers存储的是扁平答案数组（每个元素对应一个题目答案）
            $answers = json_decode($paper->c_answers, true, 512, JSON_THROW_ON_ERROR) ?? [];
        } catch (\JsonException $e) {
            return $this->_response(
                GlobalResponse::$HTTP_SERVER_ERROR_CODE,
                '试卷数据解析失败: ' . $e->getMessage()
            );
        }
        
        // 创建题目ID到答案的映射（修复：直接遍历扁平答案数组）
        $answerMap = [];
        foreach ($answers as $answerItem) {
            // 答案结构应为：['question_id' => 'xxx', 'answer' => 'xxx']
            if (!empty($answerItem['question_id'])) {
                $answerMap[$answerItem['question_id']] = $answerItem['answer'] ?? '';
            }
        }
        
        // 题型映射
        $typeMap = [
            '1' => '单选题',
            '2' => '多选题',
            '3' => '判断题',
            '4' => '主观题'
        ];
        
        // 收集所有题目ID（去重）（修复：直接遍历扁平题目数组）
        $questionIds = [];
        foreach ($questions as $question) {
            if (!empty($question['id'])) { // 题目ID字段为'id'（对应c_questions表的c_id）
                $questionIds[] = $question['id'];
            }
        }
        $questionIds = array_unique($questionIds);
        
        // 1. 查询所有题目详情（从c_questions表）
        $questionDetails = DB::table('c_questions')
            ->whereIn('c_id', $questionIds)
            ->select('c_id', 'c_question', 'c_type')
            ->get()
            ->keyBy('c_id'); // 以c_id为键，便于快速查询
        
        // 2. 查询所有题目选项（从c_question_options表），并按question_id分组
        $optionsGroup = [];
        if (!empty($questionIds)) {
            $options = DB::table('c_question_options')
                ->whereIn('c_question_id', $questionIds)
                ->select('c_question_id', 'c_content', 'c_id as option_id')
                ->get()
                ->toArray();
            
            foreach ($options as $opt) {
                $qId = $opt->c_question_id;
                if (!isset($optionsGroup[$qId])) {
                    $optionsGroup[$qId] = [];
                }
                $optionsGroup[$qId][] = [
                    'optionId' => $opt->option_id,
                    'content' => $opt->c_content
                ];
            }
        }
        
        // 构建题目列表（修复：直接遍历扁平题目数组）
        $questionList = [];
        $totalScore = 0;
        
        foreach ($questions as $question) {
            // 从题目数据中提取基础信息
            $questionId = $question['id'] ?? 'unknown_' . uniqid();
            $type = (string)($question['type'] ?? ''); // 题型标识（1-4）
            $typeName = $typeMap[$type] ?? '未知题型';
            $score = $question['score'] ?? 0;
            
            // 处理题目内容（优先从c_questions表获取，其次用存储的content）
            $questionContent = '题目内容缺失';
            if (isset($questionDetails[$questionId])) {
                $questionContent = trim($questionDetails[$questionId]->c_question) ?: $questionContent;
            } else {
                $questionContent = trim($question['content'] ?? '') ?: $questionContent;
            }
            
            // 处理选项（单选/多选/判断题需要选项）
            $options = [];
            $currentQuestionType = $questionDetails[$questionId]->c_type ?? $type;
            if (in_array($currentQuestionType, ['1', '2', '3'])) { // 1:单选,2:多选,3:判断
                $options = $optionsGroup[$questionId] ?? [];
            }
            
            // 获取本题答案
            $correctAnswer = $answerMap[$questionId] ?? '';
            
            // 组装题目项
            $questionItem = [
                'id' => $questionId,
                'type' => $typeName,
                'content' => $questionContent,
                'score' => $score,
                'options' => $options,
                'answer' => $correctAnswer
            ];
            
            $questionList[] = $questionItem;
            $totalScore += $score;
        }
        
        // 响应数据
        $response = [
            'paperId' => $paper->c_id ?? '',
            'testId' => $paper->c_test_id ?? '',
            'totalScore' => $totalScore,
            'questions' => $questionList
        ];
        
        return $this->_response(
            GlobalResponse::$HTTP_STATUS_OK_CODE,
            GlobalResponse::HTTP_STATUS_OK_MES,
            $response
        );
        
    } catch (ValidationException $e) {
        return $this->_response(
            GlobalResponse::$HTTP_REQUEST_ERROR_CODE,
            $e->getMessage()
        );
    } catch (\Exception $e) {
        \Log::error('获取试卷详情异常', [
            'paper_id' => $paperId ?? '未知',
            'error' => $e->getMessage(),
            'trace' => $e->getTraceAsString()
        ]);
        return $this->_response(
            GlobalResponse::$HTTP_SERVER_ERROR_CODE,
            '获取试卷详情失败，请稍后重试'
        );
    }
}


   /**
 * Notes: 导出试卷为Word
 * 
 * @param Request $request
 * @return \Illuminate\Http\Response
 */
public function export_paper_to_word(Request $request)
{
    try {
        $paperId = $request->input('paper_id');
        $validated_data = [
            'paper_id' => 'required|string|exists:c_papers,c_id',
        ];
        $validated_msg = [
            'paper_id.required' => "试卷ID不能为空",
            'paper_id.string' => "试卷ID类型错误",
            'paper_id.exists' => "试卷不存在",
        ];
        
        $validatedData = $request->validate($validated_data, $validated_msg);
        
        // 获取试卷详情（依赖修复后的get_paper_details）
        $paperResponse = $this->get_paper_details($request);
        $paperData = json_decode($paperResponse->getContent(), true);
        
        if ($paperData['code'] !== GlobalResponse::$HTTP_STATUS_OK_CODE) {
            throw new \Exception($paperData['message'] ?? '获取试卷数据失败');
        }
        
        $paper = $paperData['data'] ?? [];
        // 确保questions是数组（容错处理）
        $questions = isset($paper['questions']) && is_array($paper['questions']) ? $paper['questions'] : [];
        
        // 创建Word文档
        $phpWord = new PhpWord();
        $section = $phpWord->addSection();
        
        // 添加试卷标题
        $section->addText("试卷", ['bold' => true, 'size' => 16], ['alignment' => 'center']);
        $section->addTextBreak(1);
        
        // 添加试卷信息
        $questionCount = count($questions);
        $testId = isset($paper['testId']) ? $paper['testId'] : '未知';
        $paperId = isset($paper['paperId']) ? $paper['paperId'] : '未知';
        $totalScore = isset($paper['totalScore']) ? $paper['totalScore'] : 0;
        $infoText = "测试ID: {$testId} | 试卷ID: {$paperId} | 总分: {$totalScore}分 | 题数: {$questionCount}题";
        $section->addText($infoText, ['size' => 12], ['alignment' => 'center']);
        $section->addTextBreak(2);
        
        // 添加题目（修复：适配扁平题目数组）
        foreach ($questions as $index => $question) {
            // 题目编号和类型（容错：处理可能缺失的字段）
            $typeName = $question['type'] ?? '未知题型';
            $score = $question['score'] ?? 0;
            $section->addText(
                ($index + 1) . ". [{$typeName}] （{$score}分）",
                ['bold' => true]
            );
            
            // 题目内容（容错处理）
            $content = $question['content'] ?? '题目内容缺失';
            $section->addText($content);
            
            // 选项（如果是选择题且有选项）
            $options = isset($question['options']) && is_array($question['options']) ? $question['options'] : [];
            if (!empty($options)) {
                foreach ($options as $optIndex => $option) {
                    // 兼容选项内容的不同格式
                    $optionContent = is_array($option) ? ($option['content'] ?? '未知选项') : '未知选项';
                    
                    $section->addText(
                        chr(65 + $optIndex) . ". " . $optionContent,
                        [],
                        ['indentation' => ['left' => 200]]
                    );
                }
            }
            
            $section->addTextBreak(1);
        }
        
        // 添加答案部分
        if (!empty($questions)) {
            $section->addTextBreak(2);
            $section->addText('参考答案', ['bold' => true, 'color' => 'FF0000', 'size' => 14]);
            $section->addTextBreak(1);
            
            foreach ($questions as $index => $question) {
                $answer = $question['answer'] ?? '无答案';
                $section->addText(
                    ($index + 1) . ". " . $answer,
                    ['size' => 12]
                );
            }
        }
        
        // 保存临时文件
        $tempFile = tempnam(sys_get_temp_dir(), 'paper') . '.docx';
        $objWriter = IOFactory::createWriter($phpWord, 'Word2007');
        $objWriter->save($tempFile);
        
        // 读取文件内容
        $fileContent = file_get_contents($tempFile);
        
        // 删除临时文件
        unlink($tempFile);
        
        // 返回文件
        return response()->make($fileContent, 200, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'Content-Disposition' => 'attachment; filename="试卷_' . ($paper['testId'] ?? '') . '_' . ($paper['paperId'] ?? '') . '.docx"'
        ]);
            
    } catch (ValidationException $e) {
        return response()->json([
            'code' => GlobalResponse::$HTTP_REQUEST_ERROR_CODE,
            'message' => $e->getMessage()
        ], 400);
    } catch (\Exception $e) {
        \Log::error('导出试卷异常', [
            'paper_id' => $paperId ?? '未知',
            'error' => $e->getMessage(),
            'trace' => $e->getTraceAsString()
        ]);
        return response()->json([
            'code' => GlobalResponse::$HTTP_SERVER_ERROR_CODE,
            'message' => '导出失败: ' . $e->getMessage()
        ], 500);
    }
}


//     /**
//      * Notes:试卷修改(未完成)
//      * User: zhangnan
//      * DateTime: 2025/7/22 15:22
//      * @param Request $request
//      * @return JsonResponse|void
//      */
//     public function update_papers(Request $request)
//     {
//         $question_data = array(
//             'question'=>array(
//                 array(
//                     'type'=>1,
//                     'score'=>0,
//                     'data'=>array(
//                         'question_id'=>1,
//                         'question'=>1,
//                     )
//                 )
//             ),
//             'answer'=>array(
//                 array(
//                     'type'=>1,
//                     'data'=>array(
//                         'question_id'=>1,
//                         'answer'=>1,
//                     )
//                 )
//             )
//         );




//         try {
//             $papers_id     = trim($request->input('papers_id'));
//             $validated_data = array(
//                 'papers_id' => 'required|string|exists:c_papers,c_id',
//                 'question_data' => 'required|array',
//                 'question_data.question' => 'required|array',
//                 'question_data.question.*.type' => 'required|in:1,2,3,4',
//                 'question_data.question.*.score' => 'required|integer',
//                 'question_data.question.*.data' => 'required|array',
//                 'question_data.question.*.data.*.question_id' => 'required',
//                 'question_data.question.*.data.*.question' => 'required',
//                 'question_data.answer' => 'required|array',
//                 'question_data.answer.*.type' => 'required|in:1,2,3,4',
//                 'question_data.answer.*.data' => 'required|array',
//                 'question_data.answer.*.data.*.question_id' => 'required',
//                 'question_data.answer.*.data.*.answer' => 'required',
//             );
//             $validated_msg = array(
//                 'papers_id.required'=>"测试不能为空",
//                 'papers_id.string'=>"测试id类型错误",
//                 'papers_id.exists'=>"测试id不存在",
//                 'question_data.required'=>"试卷数据不能为空",
//                 'question_data.array'=>"试卷数据格式不正确",
//                 'question_data.question.required'=>"试卷数据中问题组不能为空",
//                 'question_data.question.array'=>"试卷数据中问题组格式不正确",
//                 'question_data.answer.required'=>"试卷数据中答案组不能为空",
//                 'question_data.answer.array'=>"试卷数据中答案组格式不正确",
//                 'question_data.answer.*.type.required'=>"试卷数据中答案组题目类型不存在",
//                 'question_data.answer.*.type.in'=>"试卷数据中答案组题目类型错误",
//                 'question_data.answer.*.data.required'=>"试卷数据中答案组答案数据不存在",
//                 'question_data.answer.*.data.array'=>"试卷数据中答案组答案数据格式不正确",
//                 'question_data.answer.*.data.*.question_id.required'=>"试卷数据中答案组答案数据question_id不存在",
//                 'question_data.answer.*.data.*.answer.required'=>"试卷数据中答案组答案数据answer不存在",
//                 'question_data.question.*.type.required'=>"试卷数据中问题组题目类型不存在",
//                 'question_data.question.*.type.in'=>"试卷数据中问题组题目类型错误",
//                 'question_data.question.*.score.required'=>"试卷数据中问题组题目分值不存在",
//                 'question_data.question.*.score.integer'=>"试卷数据中问题组题目分值类型错误",
//                 'question_data.question.*.data.required'=>"试卷数据中问题组题目数据不存在",
//                 'question_data.question.*.data.array'=>"试卷数据中问题组题目数据格式错误",
//                 'question_data.question.*.data.*.question_id.required'=>"试卷数据中问题组题目数据中question_id不存在",
//                 'question_data.question.*.data.*.question.required'=>"试卷数据中问题组题目数据中question不存在",
//             );
//             $validatedData = $request->validate($validated_data, $validated_msg);
//             $verify_data = array(
//                 '1'=>[],
//                 '2'=>[],
//                 '3'=>[],
//                 '4'=>[],
//             );
//             $type_dic = array(
//                 '1'=>'单选题',
//                 '2'=>'多选题',
//                 '3'=>'判断题',
//                 '4'=>'主观题',
//             );
//             $question_mod = new QuestionsModel();
//             $question_dic = $question_mod->get_question_dic();
//             foreach($question_data['question'] as $k=>$v){
//                 foreach($v['data'] as $k1=>$v1){
//                     if(!isset($question_dic[$v['type']][$v1['question_id']])){
//                         return $this->_response(GlobalResponse::$HTTP_REQUEST_ERROR_CODE,$v1['question_id']."该问题不存在！");
//                     }
//                     if(in_array($v1['question_id'],$verify_data[$v['type']])){
//                         return $this->_response(GlobalResponse::$HTTP_REQUEST_ERROR_CODE,$type_dic[$v['type']]."问题存在重复！");
//                     }
//                     $question_info = $question_dic[$v['type']][$v1['question_id']];

//                 }
//             }






//             $mod = new PapersModel();
// //            $info = $mod->get_paper_list($test_id);
// //            if(!$info){
// //                return $this->_response(GlobalResponse::$HTTP_REQUEST_ERROR_CODE,"该测试下没有试卷！");
// //            }
// //            return $this->_response(GlobalResponse::$HTTP_STATUS_OK_CODE,GlobalResponse::HTTP_STATUS_OK_MES,$info);

//         } catch (ValidationException $e) {
//             return $this->_response(GlobalResponse::$HTTP_REQUEST_ERROR_CODE,$e->getMessage());
//         }
//     }


/**
 * 1. 获取用户专属的理论测试列表（前端测试列表页调用）
 */
public function getUserRelatedTests(Request $request)
{
    try {
        // 在方法内部实例化模型
        $testUsersModel = new TestUsersModel();
        
        $username = trim($request->input('username'));
        if (empty($username)) {
            Log::warning('获取测试列表：用户名为空', []);
            return $this->_response(400, "用户名不能为空");
        }

        // 验证用户存在
        $userExists = DB::table('c_users')->where('c_username', $username)->exists();
        if (!$userExists) {
            Log::warning('获取测试列表：用户不存在', ['username' => $username]);
            return $this->_response(400, "用户不存在");
        }

        // 查询用户专属的理论测试列表
        $relatedTests = $testUsersModel->getUserRelatedTests($username);

        // 区分返回信息（明确空数据原因）
        $message = $relatedTests->isNotEmpty() 
            ? "获取成功" 
            : "获取成功，当前暂无理论测试（可能未分配或类型不匹配）";

        return $this->_response(200, $message, $relatedTests);
    } catch (\Exception $e) {
            Log::error('获取测试列表失败', [
                'username' => $username ?? '未知',
                '错误信息' => $e->getMessage(),
                '堆栈跟踪' => $e->getTraceAsString()
            ]);
            return $this->_response(500, "获取测试列表失败：" . $e->getMessage());
        }
    }

    /**
     * 2. 获取用户专属的实验列表（前端测试列表页调用）
     */
    public function getUserRelatedExperiments(Request $request)
    {
        try {
            // 在方法内部实例化模型
            $testUsersModel = new TestUsersModel();
            
            $username = trim($request->input('username'));
            if (empty($username)) {
                Log::warning('获取实验列表：用户名为空', []);
                return $this->_response(400, "用户名不能为空");
            }

            // 验证用户存在
            $userExists = DB::table('c_users')->where('c_username', $username)->exists();
            if (!$userExists) {
                Log::warning('获取实验列表：用户不存在', ['username' => $username]);
                return $this->_response(400, "用户不存在");
            }

            // 查询用户专属的实验列表
            $relatedExperiments = $testUsersModel->getUserRelatedExperiments($username);

            // 区分返回信息（明确空数据原因）
            $message = $relatedExperiments->isNotEmpty() 
                ? "获取成功" 
                : "获取成功，当前暂无实验测试（可能未分配或类型不匹配）";

            return $this->_response(200, $message, $relatedExperiments);
        } catch (\Exception $e) {
            Log::error('获取实验列表失败', [
                'username' => $username ?? '未知',
                '错误信息' => $e->getMessage(),
                '堆栈跟踪' => $e->getTraceAsString()
            ]);
            return $this->_response(500, "获取实验列表失败：" . $e->getMessage());
        }
    }

    /**
 * 获取用户与测试的关联关系（包含试卷ID和考试时长）
 */
public function getTestUserRelation(Request $request)
{
    try {
        $testId = $request->input('test_id');
        $username = $request->input('username');
        
        // 验证参数
        $request->validate([
            'test_id' => 'required|string',
            'username' => 'required|string'
        ], [
            'test_id.required' => '测试ID（test_id）不能为空',
            'username.required' => '用户名（username）不能为空'
        ]);
        
        // 验证用户存在
        $user = DB::table('c_users')->where('c_username', $username)->first();
        if (!$user) {
            Log::warning('用户不存在', ['username' => $username]);
            return $this->_response(400, "用户不存在（用户名：{$username}）");
        }
        
        // 获取测试类型
        $testInfo = DB::table('c_tests')->where('c_id', $testId)->first();
        if (!$testInfo) {
            Log::warning('测试不存在', ['test_id' => $testId]);
            return $this->_response(404, "测试不存在（测试ID：{$testId}）");
        }
        
        $testType = $testInfo->c_type ?? '考试';
        
        // 如果是考试模式，检查用户是否已提交过试卷
        if ($testType === '考试') {
            $submitted = DB::table('c_test_users')
                ->where('c_test_id', $testId)
                ->where('c_username', $username)
                ->whereNotNull('c_submit')
                ->exists();
                
            if ($submitted) {
                Log::warning('用户已提交过考试试卷', [
                    'test_id' => $testId,
                    'username' => $username
                ]);
                return $this->_response(400, "您已经提交过考试试卷，不能再次参加测试");
            }
        }
        
        // 查询关联关系
        $relation = DB::table('c_test_users')
            ->join('c_tests', 'c_test_users.c_test_id', '=', 'c_tests.c_id')
            ->where('c_test_users.c_test_id', $testId)
            ->where('c_test_users.c_username', $username)
            ->select(
                'c_test_users.c_paper_id',
                'c_test_users.c_test_id',
                'c_test_users.c_username',
                'c_tests.c_duration',
                'c_tests.c_name as test_name',
                'c_tests.c_type as test_type'
            )
            ->first();
            
        if (!$relation) {
            Log::warning('未找到用户-测试关联', [
                'test_id' => $testId,
                'username' => $username
            ]);
            return $this->_response(404, "未找到用户（{$username}）在测试（{$testId}）中的关联信息");
        }
        
        if (empty($relation->c_paper_id)) {
            Log::error('试卷ID为空', [
                'test_id' => $testId,
                'username' => $username
            ]);
            return $this->_response(404, "用户（{$username}）在测试（{$testId}）中未分配有效的试卷ID");
        }
        
        Log::info('获取用户-测试关联成功', [
            'test_id' => $testId,
            'username' => $username,
            'paper_id' => $relation->c_paper_id,
            'duration' => $relation->c_duration ?? 60,
            'test_type' => $relation->test_type
        ]);

        return $this->_response(200, "获取用户-测试关联成功", [
            'test_id' => $relation->c_test_id,
            'username' => $relation->c_username,
            'paper_id' => $relation->c_paper_id,
            'duration' => $relation->c_duration ?? 60,
            'test_name' => $relation->test_name ?? '未命名测试',
            'test_type' => $relation->test_type
        ]);
    } catch (ValidationException $e) {
        Log::error('参数验证失败', [
            'test_id' => $testId ?? '未知',
            'username' => $username ?? '未知',
            'error' => $e->validator->errors()->first()
        ]);
        return $this->_response(400, $e->validator->errors()->first());
    } catch (\Exception $e) {
        Log::error('获取关联信息失败', [
            'test_id' => $testId ?? '未知',
            'username' => $username ?? '未知',
            'error' => $e->getMessage(),
            'trace' => $e->getTraceAsString()
        ]);
        return $this->_response(500, "获取关联信息失败: " . $e->getMessage());
    }
}

    /**
     * 获取考试卷详细信息
     */
    public function get_exam_paper_details(Request $request)
    {
        try {
            // 接收参数
            $testId = $request->input('test_id');
            $username = $request->input('username');
            $testType = $request->input('test_type', '考试');
            
            // 验证参数
            $request->validate([
                'test_id' => 'required|string',
                'username' => 'required|string',
                'test_type' => 'nullable|string|in:考试,练习',
            ], [
                'test_id.required' => '测试ID（test_id）不能为空',
                'username.required' => '用户名（username）不能为空',
                'test_type.in' => '测试类型必须是"考试"或"练习"'
            ]);
            
            // 验证用户存在
            $user = DB::table('c_users')
                ->where('c_username', $username)
                ->select('c_username')
                ->first();
            
            if (!$user) {
                Log::warning('用户不存在', ['username' => $username]);
                return $this->_response(400, "用户不存在（用户名：{$username}）");
            }

            // 调试：记录用户查询结果
            Log::debug('用户查询结果', [
                'username' => $username,
                'user_data' => (array)$user
            ]);

            // 使用 c_username 作为 userId
            $user_c_id = $user->c_username;
            Log::info('使用 c_username 作为 userId', [
                'username' => $username,
                'user_c_id' => $user_c_id
            ]);
            
            // 获取关联信息
            $relation = DB::table('c_test_users')
                ->join('c_tests', 'c_test_users.c_test_id', '=', 'c_tests.c_id')
                ->where('c_test_users.c_test_id', $testId)
                ->where('c_test_users.c_username', $username)
                ->select(
                    'c_test_users.c_paper_id',
                    'c_test_users.c_test_id',
                    'c_test_users.c_username',
                    'c_tests.c_duration',
                    'c_tests.c_name as test_name'
                )
                ->first();
                
            if (!$relation || empty($relation->c_paper_id)) {
                Log::warning('未找到用户测试关联或试卷ID', [
                    'test_id' => $testId,
                    'username' => $username,
                    'paper_id' => $relation->c_paper_id ?? 'null'
                ]);
                return $this->_response(404, "用户（{$username}）在测试（{$testId}）中未分配试卷");
            }
            
            // 查询试卷信息
            Log::info('查询试卷', [
                'paper_id' => $relation->c_paper_id,
                'test_id' => $testId,
                'username' => $username
            ]);
            $paper = DB::table('c_papers')
                ->where('c_id', $relation->c_paper_id)
                ->select('c_id AS c_id', 'c_test_id', 'c_questions', 'c_answers')
                ->first();
        
            if (!$paper) {
                Log::error('试卷不存在', [
                    'paper_id' => $relation->c_paper_id,
                    'test_id' => $testId,
                    'username' => $username
                ]);
                return $this->_response(404, "试卷不存在（试卷ID：{$relation->c_paper_id}），可能已被删除");
            }

            // 调试：记录原始查询结果
            Log::debug('试卷查询结果', [
                'paper_id' => $relation->c_paper_id,
                'paper_data' => (array)$paper
            ]);

            // 验证 paper c_id 字段
            $paperArray = (array)$paper;
            $paper_c_id = null;
            foreach (['c_id', 'C_id', 'cid', 'cId'] as $possibleKey) {
                if (isset($paperArray[$possibleKey])) {
                    $paper_c_id = $paperArray[$possibleKey];
                    Log::info('找到 paper c_id 字段', [
                        'field_name' => $possibleKey,
                        'value' => $paper_c_id
                    ]);
                    break;
                }
            }

            if ($paper_c_id === null) {
                Log::error('试卷查询结果缺少 c_id 字段', [
                    'paper_id' => $relation->c_paper_id,
                    'test_id' => $testId,
                    'username' => $username,
                    'paper_data' => $paperArray
                ]);
                return $this->_response(500, "试卷数据异常：缺少 c_id 字段");
            }
            
            // 解析题目和答案
            try {
                $questions = json_decode($paper->c_questions, true, 512, JSON_THROW_ON_ERROR) ?? [];
                $answers = json_decode($paper->c_answers, true, 512, JSON_THROW_ON_ERROR) ?? [];
                Log::info('试卷JSON解析成功', [
                    'paper_id' => $paper_c_id,
                    'test_id' => $testId,
                    'username' => $username,
                    'question_count' => count($questions),
                    'answer_count' => count($answers)
                ]);
            } catch (\JsonException $e) {
                Log::error('试卷JSON解析失败', [
                    'paper_id' => $paper_c_id,
                    'test_id' => $testId,
                    'username' => $username,
                    'error' => $e->getMessage(),
                    'trace' => $e->getTraceAsString()
                ]);
                return $this->_response(500, "试卷数据解析失败：" . $e->getMessage());
            }
            
            if (empty($questions)) {
                Log::warning('试卷题目为空', [
                    'paper_id' => $paper_c_id,
                    'test_id' => $testId,
                    'username' => $username
                ]);
                return $this->_response(400, "试卷（{$paper_c_id}）中没有题目，请联系管理员");
            }
            
            // 调试：记录 $paper 状态（在 JSON 解析后）
            Log::debug('JSON解析后 paper 状态', [
                'paper_id' => $paper_c_id,
                'paper_data' => (array)$paper
            ]);

            // 构建答案映射
            $answerMap = [];
            foreach ($answers as $answerItem) {
                if (!empty($answerItem['question_id'])) {
                    $answerMap[$answerItem['question_id']] = $answerItem['answer'] ?? '';
                }
            }
            
            // 题型映射
            $typeMap = [
                '1' => 'single',
                '2' => 'multiple',
                '3' => 'judgment',
                '4' => 'text'
            ];
            
            // 收集题目ID
            $questionIds = array_unique(array_column($questions, 'id'));
            
            // 查询题目详情
            $questionDetails = DB::table('c_questions')
                ->whereIn('c_id', $questionIds)
                ->select('c_id', 'c_question', 'c_type')
                ->get()
                ->keyBy('c_id');
            
            // 查询题目选项
            $optionsGroup = [];
            if (!empty($questionIds)) {
                $options = DB::table('c_question_options')
                    ->whereIn('c_question_id', $questionIds)
                    ->select('c_question_id', 'c_content', 'c_id as option_id')
                    ->get()
                    ->groupBy('c_question_id');
                
                foreach ($options as $qId => $opts) {
                    $optionsGroup[$qId] = $opts->map(function ($opt) {
                        return [
                            'optionId' => $opt->option_id,
                            'content' => $opt->c_content
                        ];
                    })->toArray();
                }
            }
            
            // 调试：记录 $paper 状态（在题目选项查询后）
            Log::debug('题目选项查询后 paper 状态', [
                'paper_id' => $paper_c_id,
                'paper_data' => (array)$paper
            ]);

            // 构建题目列表
            $questionList = [];
            $totalScore = 0;
            
            foreach ($questions as $question) {
                $questionId = $question['id'] ?? 'unknown_' . uniqid();
                $backendType = (string)($question['type'] ?? '4');
                $frontendType = $typeMap[$backendType] ?? 'text';
                $score = $question['score'] ?? 0;
                $totalScore += $score;
                
                $questionContent = '题目内容缺失';
                if (isset($questionDetails[$questionId])) {
                    $questionContent = trim($questionDetails[$questionId]->c_question) ?: $questionContent;
                } else {
                    $questionContent = trim($question['content'] ?? '') ?: $questionContent;
                }
                
                $options = [];
                $currentQuestionType = $questionDetails[$questionId]->c_type ?? $backendType;
                if (in_array($currentQuestionType, ['1', '2', '3'])) {
                    $options = $optionsGroup[$questionId] ?? [];
                }
                
                $questionItem = [
                    'id' => $questionId,
                    'type' => $frontendType,
                    'content' => $questionContent,
                    'score' => $score,
                    'options' => $options
                ];
                
                if ($testType === '练习') {
                    $questionItem['answer'] = $answerMap[$questionId] ?? '未设置答案';
                }
                
                $questionList[] = $questionItem;
            }
            
            // 调试：记录 $paper 和 $user 状态（在构建 response 前）
            Log::debug('构建 response 前 paper 状态', [
                'paper_id' => $paper_c_id,
                'paper_data' => (array)$paper
            ]);
            Log::debug('构建 response 前 user 状态', [
                'username' => $username,
                'user_data' => (array)$user
            ]);

            // 构建响应数据
            $response = [
                'userInfo' => [
                    'username' => $username,
                    'userId' => $user_c_id // 使用 c_username 作为 userId
                ],
                'testInfo' => [
                    'testId' => $testId,
                    'testType' => $testType
                ],
                'paperInfo' => [
                    'paperId' => $paper_c_id,
                    'totalScore' => $totalScore,
                    'questionCount' => count($questionList),
                    'duration' => $relation->c_duration ?? 60,
                    'paperName' => $relation->test_name ?? '未命名试卷'
                ],
                'questions' => $questionList
            ];
            
            Log::info('试卷查询成功', [
                'test_id' => $testId,
                'username' => $username,
                'paper_id' => $paper_c_id,
                'question_count' => count($questionList),
                'total_score' => $totalScore
            ]);
            
            return $this->_response(200, "成功获取试卷", $response);
            
        } catch (ValidationException $e) {
            Log::error('参数验证失败', [
                'test_id' => $testId ?? '未知',
                'username' => $username ?? '未知',
                'error' => $e->validator->errors()->first()
            ]);
            return $this->_response(400, $e->validator->errors()->first());
        } catch (\Exception $e) {
            Log::error('获取试卷失败', [
                'test_id' => $testId ?? '未知',
                'username' => $username ?? '未知',
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            return $this->_response(500, "获取试卷失败：" . $e->getMessage());
        }
    }
/**
 * 交卷评分接口（前端提交试卷时调用）
 * 客观题自动评分，主观题保存答案，更新c_test_users表
 */
public function submit_papers(Request $request)
{
    try {
        // 在方法内部实例化模型
        $testUsersModel = new TestUsersModel();
        $papersModel = new PapersModel();
        
        // 记录请求头和原始输入
        Log::debug('请求头', ['headers' => $request->headers->all()]);
        Log::debug('原始输入', ['content' => $request->getContent()]);

        //  修改验证规则 - 完全移除内部验证 
        $validator = Validator::make($request->all(), [
            'test_id' => 'required|string',
            'username' => 'required|string|exists:c_users,c_username',
            'paper_id' => 'required|string|exists:c_papers,c_id',
            'answers' => 'present|array',
            // 移除所有内部验证规则
        ]);

        if ($validator->fails()) {
            Log::error('验证失败', ['errors' => $validator->errors()->toArray()]);
            return response()->json([
                'code' => 400,
                'message' => '试卷数据格式错误',
                'errors' => $validator->errors()->toArray(),
                'input' => $request->all()
            ], 400);
        }

        $validatedData = $validator->validated();
        Log::debug('提交试卷参数', ['data' => $validatedData]);

        $test_id = $validatedData['test_id'];
        $username = $validatedData['username'];
        $paper_id = $validatedData['paper_id'];
        $answers = $validatedData['answers'];
        $test_type = $validatedData['test_type'] ?? '考试';

        //  手动验证 answers 数据结构（只有当 answers 不为空时）
        if (!empty($answers)) {
            foreach ($answers as $index => $answer_group) {
                if (!isset($answer_group['type']) || !in_array($answer_group['type'], [1, 2, 3, 4])) {
                    return response()->json([
                        'code' => 400,
                        'message' => "答案组 {$index} 的 type 字段无效",
                        'input' => $request->all()
                    ], 400);
                }
                
                if (!isset($answer_group['data']) || !is_array($answer_group['data'])) {
                    return response()->json([
                        'code' => 400,
                        'message' => "答案组 {$index} 的 data 字段无效",
                        'input' => $request->all()
                    ], 400);
                }
                
                foreach ($answer_group['data'] as $data_index => $answer_item) {
                    if (!isset($answer_item['question_id']) || !is_string($answer_item['question_id'])) {
                        return response()->json([
                            'code' => 400,
                            'message' => "答案组 {$index} 的数据项 {$data_index} 的 question_id 字段无效",
                            'input' => $request->all()
                        ], 400);
                    }
                    
                    if (!isset($answer_item['answer']) || !is_string($answer_item['answer'])) {
                        return response()->json([
                            'code' => 400,
                            'message' => "答案组 {$index} 的数据项 {$data_index} 的 answer 字段无效",
                            'input' => $request->all()
                        ], 400);
                    }
                }
            }
        }

        // 获取测试类型
        $testInfo = DB::table('c_tests')->where('c_id', $test_id)->first();
        if (!$testInfo) {
            Log::error('测试不存在', ['test_id' => $test_id]);
            return response()->json([
                'code' => 404,
                'message' => '测试不存在',
                'input' => $validatedData
            ], 404);
        }
        
        $testType = $testInfo->c_type ?? '考试';
        
        // 如果是考试模式，检查用户是否已提交过试卷
        if ($testType === '考试') {
            $existingSubmission = $testUsersModel->where('c_test_id', $test_id)
                ->where('c_username', $username)
                ->where('c_paper_id', $paper_id)
                ->whereNotNull('c_submit')
                ->first();
                
            if ($existingSubmission) {
                Log::warning('用户已提交过考试试卷', [
                    'test_id' => $test_id,
                    'username' => $username,
                    'paper_id' => $paper_id
                ]);
                return response()->json([
                    'code' => 400,
                    'message' => '您已经提交过考试试卷，不能重复提交'
                ], 400);
            }
        }

        // 获取试卷信息
        Log::info('调用 PapersModel::get_paper_info_by_id', ['paper_id' => $paper_id]);
        $paper_info = $papersModel->get_paper_info_by_id($paper_id);
        if (!$paper_info) {
            Log::error('试卷不存在', ['paper_id' => $paper_id]);
            return response()->json([
                'code' => 404,
                'message' => '试卷不存在',
                'input' => $validatedData
            ], 404);
        }

        // 解析试卷的题目和答案
        try {
            $questions = json_decode($paper_info->c_questions, true, 512, JSON_THROW_ON_ERROR) ?? [];
            $correct_answers = json_decode($paper_info->c_answers, true, 512, JSON_THROW_ON_ERROR) ?? [];
            Log::info('试卷JSON解析成功', [
                'paper_id' => $paper_id,
                'question_count' => count($questions),
                'answer_count' => count($correct_answers)
            ]);
        } catch (\JsonException $e) {
            Log::error('试卷JSON解析失败', [
                'paper_id' => $paper_id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            return response()->json([
                'code' => 500,
                'message' => '试卷数据解析失败：' . $e->getMessage(),
                'input' => $validatedData
            ], 500);
        }

        // 检查试卷中是否有主观题
        $hasSubjectiveQuestions = false;
        foreach ($questions as $question) {
            if (isset($question['type']) && $question['type'] == 4) {
                $hasSubjectiveQuestions = true;
                break;
            }
        }

        // 构建正确答案映射
        $correctAnswerMap = [];
        foreach ($correct_answers as $answer) {
            if (isset($answer['question_id'], $answer['answer'])) {
                $correctAnswerMap[$answer['question_id']] = $answer['answer'];
            }
        }

        $objective_score = 0;
        $correct_count = 0;

        //  只有当 answers 不为空时才处理答案 
        if (!empty($answers)) {
            foreach ($answers as $answer_group) {
                $type = $answer_group['type'];
                $data = $answer_group['data'];

                foreach ($data as $answer_item) {
                    $question_id = $answer_item['question_id'];
                    $user_answer = $answer_item['answer'];

                    // 查找正确答案
                    if (!isset($correctAnswerMap[$question_id])) {
                        Log::warning('正确答案不存在', ['question_id' => $question_id]);
                        continue;
                    }

                    $correct_answer = $correctAnswerMap[$question_id];

                    // 比较答案
                    Log::debug('比较答案', [
                        'question_id' => $question_id,
                        'user_answer' => $user_answer,
                        'correct_answer' => $correct_answer,
                        'type' => $type
                    ]);

                    if ($type == 1 || $type == 3) {
                        // 单选或判断题
                        if ($user_answer === $correct_answer) {
                            // 查找题目分数
                            $score = 0;
                            foreach ($questions as $q) {
                                if (isset($q['id']) && $q['id'] == $question_id) {
                                    $score = $q['score'] ?? 0;
                                    break;
                                }
                            }
                            $objective_score += $score;
                            $correct_count++;
                        }
                    } elseif ($type == 2) {
                        // 多选题
                        $user_answers = explode(';', $user_answer);
                        $correct_answers_arr = explode(';', $correct_answer);
                        sort($user_answers);
                        sort($correct_answers_arr);
                        if ($user_answers === $correct_answers_arr) {
                            // 查找题目分数
                            $score = 0;
                            foreach ($questions as $q) {
                                if (isset($q['id']) && $q['id'] == $question_id) {
                                    $score = $q['score'] ?? 0;
                                    break;
                                }
                            }
                            $objective_score += $score;
                            $correct_count++;
                        }
                    }
                    // 主观题 (type=4) 由人工批改
                }
            }
        }

        // 设置批改状态
        $correct_status = $hasSubjectiveQuestions ? 1 : 2; // 1=未批改完成，2=已批改完成
        
        // 设置总分 - 在没有主观题或主观题未批改时，总分等于客观题分数
        $total_score = $objective_score;

        // 检查现有测试记录
        $test_user_info = $testUsersModel->where('c_test_id', $test_id)
            ->where('c_username', $username)
            ->where('c_paper_id', $paper_id)
            ->first();

        $result = false;
        if ($test_user_info) {
            // 更新现有记录
            $update_data = [
                'c_answers' => json_encode($answers, JSON_UNESCAPED_UNICODE),
                'c_submit' => now(),
                'c_score' => $total_score, // 使用计算后的总分
                'c_objective_score' => $objective_score,
                'c_subjective_score' => 0, // 主观题分数等待人工批改
                'c_correct' => $correct_status // 根据是否有主观题设置批改状态
            ];
            
            $result = $testUsersModel->where('c_test_id', $test_id)
                ->where('c_username', $username)
                ->where('c_paper_id', $paper_id)
                ->update($update_data);
        } else {
            // 创建新记录
            $test_user_data = [
                'c_test_id' => $test_id,
                'c_username' => $username,
                'c_paper_id' => $paper_id,
                'c_answers' => json_encode($answers, JSON_UNESCAPED_UNICODE),
                'c_score' => $total_score, // 使用计算后的总分
                'c_objective_score' => $objective_score,
                'c_subjective_score' => 0, // 主观题分数等待人工批改
                'c_correct' => $correct_status, // 根据是否有主观题设置批改状态
                'c_submit' => now()
            ];
            $result = $testUsersModel->create($test_user_data);
        }

        if (!$result) {
            Log::error('保存测试记录失败', ['test_id' => $test_id, 'username' => $username]);
            return response()->json([
                'code' => 500,
                'message' => '保存测试记录失败',
                'input' => $validatedData
            ], 500);
        }

        Log::info('保存测试记录成功', [
            'test_id' => $test_id,
            'username' => $username,
            'objective_score' => $objective_score,
            'total_score' => $total_score,
            'correct_count' => $correct_count,
            'correct_status' => $correct_status,
            'has_subjective_questions' => $hasSubjectiveQuestions,
            'test_type' => $testType
        ]);

        return $this->_response(
            GlobalResponse::$HTTP_STATUS_OK_CODE,
            '交卷成功',
            [
                'objective_score' => $objective_score,
                'total_score' => $total_score,
                'correct_count' => $correct_count,
                'has_subjective_questions' => $hasSubjectiveQuestions,
                'correct_status' => $correct_status,
                'test_type' => $testType
            ]
        );
    } catch (ValidationException $e) {
        Log::error('验证异常', ['errors' => $e->errors(), 'input' => $request->all()]);
        return response()->json([
            'code' => 400,
            'message' => '试卷数据格式错误',
            'errors' => $e->errors(),
            'input' => $request->all()
        ], 400);
    } catch (\Exception $e) {
        Log::error('交卷异常', [
            'message' => $e->getMessage(),
            'input' => $request->all(),
            'trace' => $e->getTraceAsString()
        ]);
        return response()->json([
            'code' => 500,
            'message' => '服务器错误: ' . $e->getMessage(),
            'input' => $request->all()
        ], 500);
    }
}

    /**
     * 辅助方法：格式化试卷数据（适配前端渲染）
     * @param array $paperInfo 试卷原始数据
     * @param string $testType 测试类型（考试/练习）
     * @return array
     */
    private function _formatPaperData($paperInfo, $testType)
    {
        try {
            Log::info('开始格式化试卷数据', ['paper_id' => $paperInfo['c_id'], 'test_type' => $testType]);
            
            $questions = json_decode($paperInfo['c_questions'], true, 512, JSON_THROW_ON_ERROR) ?? [];
            $correctAnswers = json_decode($paperInfo['c_answers'], true, 512, JSON_THROW_ON_ERROR) ?? [];
            $correctAnswerMap = [];

            // 构建正确答案映射（仅练习模式返回正确答案）
            if ($testType === '练习' && !empty($correctAnswers)) {
                foreach ($correctAnswers as $answerGroup) {
                    if (!isset($answerGroup['data']) || !is_array($answerGroup['data'])) {
                        continue;
                    }
                    foreach ($answerGroup['data'] as $item) {
                        if (isset($item['question_id'], $item['answer'])) {
                            $correctAnswerMap[$item['question_id']] = $item['answer'];
                        }
                    }
                }
                Log::info('正确答案映射', ['correct_answer_map' => $correctAnswerMap]);
            }

            // 格式化题目列表
            $formattedQuestions = [];
            foreach ($questions as $questionGroup) {
                if (!isset($questionGroup['data']) || !is_array($questionGroup['data'])) {
                    Log::warning('题目组数据无效', ['question_group' => $questionGroup]);
                    continue;
                }
                foreach ($questionGroup['data'] as $item) {
                    if (!isset($item['question_id'], $item['question_content'])) {
                        Log::warning('题目数据无效', ['item' => $item]);
                        continue;
                    }
                    $formattedQuestion = [
                        'id' => $item['question_id'],
                        'type' => $this->_mapQuestionType($questionGroup['type']),
                        'text' => $item['question_content'],
                        'score' => $questionGroup['score'] ?? 0,
                    ];

                    // 单选/多选题添加选项
                    if (in_array($questionGroup['type'], [1, 2]) && !empty($item['options'])) {
                        $formattedQuestion['options'] = array_map(function ($opt) {
                            return [
                                'id' => $opt['option_id'] ?? uniqid(),
                                'text' => $opt['option_content'] ?? ''
                            ];
                        }, $item['options']);
                    }

                    // 练习模式添加正确答案和解析
                    if ($testType === '练习' && isset($correctAnswerMap[$item['question_id']])) {
                        $formattedQuestion['correctAnswer'] = $correctAnswerMap[$item['question_id']];
                        $formattedQuestion['explanation'] = $item['explanation'] ?? '';
                    }

                    $formattedQuestions[] = $formattedQuestion;
                }
            }

            $result = [
                'code' => 200,
                'message' => 'success',
                'data' => [
                    'paper_id' => $paperInfo['c_id'],
                    'paper_name' => $paperInfo['c_name'] ?? '未命名试卷',
                    'duration' => $paperInfo['c_duration'] ?? $paperInfo['c_test_duration'] ?? 60,
                    'totalScore' => array_sum(array_column($questions, 'score') ?: [0]),
                    'questionCount' => count($formattedQuestions),
                    'questions' => $formattedQuestions
                ]
            ];

            Log::info('试卷格式化成功', ['result' => $result]);
            return $result;
        } catch (\JsonException $e) {
            Log::error('试卷数据解析失败', [
                'paper_id' => $paperInfo['c_id'] ?? '未知',
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            return [
                'code' => 500,
                'message' => '试卷数据解析失败: ' . $e->getMessage()
            ];
        } catch (\Exception $e) {
            Log::error('格式化试卷数据失败', [
                'paper_id' => $paperInfo['c_id'] ?? '未知',
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            return [
                'code' => 500,
                'message' => '格式化试卷数据失败: ' . $e->getMessage()
            ];
        }
    }

    /**
     * 辅助方法：后端题目类型映射为前端类型
     * 后端：1=单选，2=多选，3=主观；前端：single/multiple/text
     */
    private function _mapQuestionType($backendType): string
    {
        return match ((int)$backendType) {
            1 => 'single',
            2 => 'multiple',
            3 => 'text',
            default => 'text'
        };
    }
    
    
    


    /**
     * Notes:获取主观题作答名单
     * User: zhangnan
     * DateTime: 2025/7/25 18:46
     * @param Request $request
     * @return JsonResponse
     */
    public function get_answers_name_list(Request $request)
    {
        try {
            $test_id     = trim($request->input('test_id'));
            $validated_data = array(
                'test_id' => 'required|string|exists:c_tests,c_id',
            );
            $validated_msg = array(
                'test_id.required'=>"测试id不能为空",
                'test_id.string'=>"测试id类型错误",
                'test_id.exists'=>"测试id不存在",
            );
            $validatedData = $request->validate($validated_data, $validated_msg);

            $paper_rules_mod = new PaperRulesModel();
            $verify_question = $paper_rules_mod->verify_is_zg_question($test_id);
            if(!$verify_question){
                return $this->_response(GlobalResponse::$HTTP_REQUEST_ERROR_CODE,"该测试无主观题");
            }
            $test_users_mod = new TestUsersModel();
            $test_user_list = $test_users_mod->get_test_user_by_test_id($test_id,1);
            $data =[];
            foreach($test_user_list as $k=>$v){
                $data[] = array(
                    'username'=>$v['c_username'],
                    'paper_id'=>$v['c_paper_id'],
                );
            }

            return $this->_response(GlobalResponse::$HTTP_STATUS_OK_CODE,GlobalResponse::HTTP_STATUS_OK_MES,$data);

        } catch (ValidationException $e) {
            return $this->_response(GlobalResponse::$HTTP_REQUEST_ERROR_CODE,$e->getMessage());
        }
    }

  public function get_answers_name_info(Request $request)
{
    try {
        $test_id = trim($request->input('test_id'));
        $username = trim($request->input('username'));
        $paper_id = trim($request->input('paper_id', ''));
        
        // 移除用户存在性验证，因为要支持所有考生
        $validated_data = [
            'test_id' => 'required|string|exists:c_tests,c_id',
            'username' => 'required|string',
        ];
        
        $validated_msg = [
            'test_id.required' => "测试id不能为空",
            'test_id.string' => "测试id类型错误",
            'username.required' => "考生不能为空",
            'username.string' => "考生类型不正确",
        ];
        
        $validatedData = $request->validate($validated_data, $validated_msg);

        // 获取考生作答数据
        $test_users_mod = new TestUsersModel();
        $user_answers = $test_users_mod->get_user_answers($test_id, $username, $paper_id);
        
        if (empty($user_answers) || empty($user_answers['c_answers'])) {
            Log::warning("未找到考生作答数据", ['test_id' => $test_id, 'username' => $username]);
            return $this->_response(GlobalResponse::$HTTP_REQUEST_ERROR_CODE, "未找到考生作答数据");
        }

        // 解析 JSON 格式的 c_answers
        $answers_data = json_decode($user_answers['c_answers'], true);
        
        if (json_last_error() !== JSON_ERROR_NONE) {
            Log::error("JSON解析错误", ['error' => json_last_error_msg(), 'c_answers' => $user_answers['c_answers']]);
            return $this->_response(GlobalResponse::$HTTP_REQUEST_ERROR_CODE, "作答数据格式错误");
        }

        $subjective_questions = [];
        
        // 查找 type=4 的主观题
        if (is_array($answers_data)) {
            foreach ($answers_data as $answer_section) {
                if (isset($answer_section['type']) && $answer_section['type'] == 4 && !empty($answer_section['data'])) {
                    foreach ($answer_section['data'] as $subjective_answer) {
                        if (!empty($subjective_answer['question_id'])) {
                            // 获取题目详情
                            $question_info = $this->get_question_info_by_c_id($subjective_answer['question_id']);
                            
                            if ($question_info) {
                                $subjective_questions[] = [
                                    'id' => uniqid(),
                                    'question_id' => $subjective_answer['question_id'],
                                    'question' => $question_info->c_question,
                                    'highest_score' => $question_info->c_score ?? 10,
                                    'answer' => $subjective_answer['answer'] ?? '',
                                    'score' => $subjective_answer['score'] ?? 0, // 已有分数
                                    'correct_status' => $subjective_answer['correct_status'] ?? 0, // 批改状态
                                    'question_type' => 4,
                                ];
                            }
                        }
                    }
                    break;
                }
            }
        }

        if (empty($subjective_questions)) {
            Log::warning("没有主观题作答", ['test_id' => $test_id, 'username' => $username]);
            return $this->_response(GlobalResponse::$HTTP_REQUEST_ERROR_CODE, "该考生没有主观题作答");
        }

        return $this->_response(GlobalResponse::$HTTP_STATUS_OK_CODE, GlobalResponse::HTTP_STATUS_OK_MES, $subjective_questions);

    } catch (ValidationException $e) {
        Log::error("参数验证失败: " . $e->getMessage());
        return $this->_response(GlobalResponse::$HTTP_REQUEST_ERROR_CODE, $e->getMessage());
    } catch (\Exception $e) {
        Log::error("获取考生作答失败: " . $e->getMessage());
        Log::error("错误堆栈: " . $e->getTraceAsString());
        return $this->_response(GlobalResponse::$HTTP_SERVER_ERROR_CODE, "服务器内部错误");
    }
}
/**
 * 获取题目信息
 */
private function get_question_info($question_id)
{
    $question_mod = new QuestionsModel();
    $question = $question_mod->get_question_by_id($question_id);
    
    if ($question) {
        return [
            'c_question' => $question['c_question'],
            'c_score' => $question['c_score']
        ];
    }
    
    return null;
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
 * Notes: 获取所有考生客观题成绩
 * User: zhangnan
 * DateTime: 2025/1/18 10:00
 * @return JsonResponse
 */
public function getAllStudentsObjectiveScore()
{
    try {
        // 从请求中获取测试ID
        $test_id = request()->input('test_id');
        
        if (empty($test_id)) {
            return $this->_response(GlobalResponse::$HTTP_REQUEST_ERROR_CODE, "测试ID不能为空");
        }
        
        Log::info("开始获取所有考生成绩", ['test_id' => $test_id]);
        
        // 验证测试是否存在
        $testExists = DB::table('c_tests')
            ->where('c_id', $test_id)
            ->exists();
            
        if (!$testExists) {
            Log::warning("测试ID不存在", ['test_id' => $test_id]);
            return $this->_response(GlobalResponse::$HTTP_REQUEST_ERROR_CODE, "测试ID不存在");
        }
        
        // 获取该测试中所有考生的试卷成绩
        $studentScores = DB::table('c_test_users')
            ->where('c_test_id', $test_id)
            ->select(
                'c_username',
                'c_paper_id',
                'c_objective_score',
                'c_subjective_score',
                'c_score',
                'c_correct',
                'c_submit'
            )
            ->orderBy('c_username')
            ->orderBy('c_paper_id')
            ->get();
        
        Log::info("查询结果", ['count' => count($studentScores)]);
        
        if ($studentScores->isEmpty()) {
            Log::warning("未找到考试成绩记录", ['test_id' => $test_id]);
            return $this->_response(GlobalResponse::$HTTP_REQUEST_ERROR_CODE, "未找到考试成绩记录");
        }
        
        // 按用户名分组，为每个用户生成试卷名称
        $groupedScores = [];
        foreach ($studentScores as $score) {
            if (!isset($groupedScores[$score->c_username])) {
                $groupedScores[$score->c_username] = [];
            }
            $groupedScores[$score->c_username][] = $score;
        }
        
        // 转换为前端需要的格式
        $formattedScores = [];
        foreach ($groupedScores as $username => $scores) {
            $userScores = [];
            $paperCounter = 1;
            
            foreach ($scores as $score) {
                $userScores[] = [
                    'paper_id' => $score->c_paper_id,
                    'paper_name' => '试卷' . $paperCounter++,
                    'objective_score' => (int)($score->c_objective_score ?? 0),
                    'subjective_score' => (int)($score->c_subjective_score ?? 0),
                    'total_score' => (int)($score->c_score ?? 0),
                    'correct_status' => (int)($score->c_correct ?? 0),
                    'correct_status_text' => $this->getCorrectStatusText($score->c_correct ?? 0),
                    'submit_time' => $score->c_submit ? date('Y-m-d H:i:s', strtotime($score->c_submit)) : ''
                ];
            }
            
            $formattedScores[] = [
                'username' => $username,
                'scores' => $userScores
            ];
        }
        
        $data = [
            'test_id' => $test_id,
            'students' => $formattedScores
        ];
        
        Log::info("成功获取所有考生成绩", ['student_count' => count($formattedScores)]);
        
        return $this->_response(GlobalResponse::$HTTP_STATUS_OK_CODE, "获取成绩成功", $data);
        
    } catch (\Exception $e) {
        Log::error("获取所有考生成绩失败: " . $e->getMessage());
        Log::error("错误堆栈: " . $e->getTraceAsString());
        return $this->_response(GlobalResponse::$HTTP_SERVER_ERROR_CODE, "服务器内部错误: " . $e->getMessage());
    }
}

/**
 * 获取批改状态文本
 */
private function getCorrectStatusText($status)
{
    $statusMap = [
        0 => '未批改',
        1 => '批改中', 
        2 => '已批改',
        3 => '批改异常'
    ];
    
    return $statusMap[$status] ?? '未知状态';
}


/**
 * Notes:主观题批卷
 */
public function batch_answers_name(Request $request)
{
    try {
        $test_id = trim($request->input('test_id'));
        $username = trim($request->input('username'));
        $paper_id = trim($request->input('paper_id'));
        $batch_data = $request->input('batch_data');
        
        Log::info("=== 开始批改 ===");
        Log::info("测试ID: " . $test_id);
        Log::info("用户名: " . $username);
        Log::info("试卷ID: " . $paper_id);
        Log::info("批改数据: " . json_encode($batch_data));

        // 获取考生作答数据
        $test_users_mod = new TestUsersModel();
        $answres_list = $test_users_mod->get_answers_list_by_name($test_id, $username, $paper_id);
        
        Log::info("考生作答列表: " . json_encode($answres_list));
        
        // 提取考生作答中的题目ID
        $question_ids = array_column($answres_list, 'c_question_id');
        Log::info("考生作答题目ID: " . json_encode($question_ids));
        
        // 提取批改数据中的题目ID
        $batch_question_ids = array_column($batch_data, 'question_id');
        Log::info("批改题目ID: " . json_encode($batch_question_ids));
        
        // 检查不匹配的题目ID
        $missing_questions = array_diff($batch_question_ids, $question_ids);
        if (!empty($missing_questions)) {
            Log::error("不匹配的题目ID: " . json_encode(array_values($missing_questions)));
            return $this->_response(GlobalResponse::$HTTP_REQUEST_ERROR_CODE, "该考生不存在该试题！");
        }

        $paper_rules = new PaperRulesModel();
        $paper_rules_zg = $paper_rules->get_is_zg_question($test_id);
        
        if (empty($paper_rules_zg)) {
            return $this->_response(GlobalResponse::$HTTP_REQUEST_ERROR_CODE, "未查询到主观题组卷规则！");
        }
        
        $zd_score = $paper_rules_zg->c_score;
        $zong_score = 0;
        $answer_data = [];
        
        foreach ($batch_data as $k => $v) {
            $question_id = trim($v['question_id']);
            $score = floatval($v['score']);
            
            if ($score > $zd_score) {
                return $this->_response(GlobalResponse::$HTTP_REQUEST_ERROR_CODE, "批改分数大于题目最大分数！");
            }
            
            $zong_score += $score;
            $answer_data[$question_id] = $score;
        }
        
        // 使用TestUsersModel进行批改
        $res = $test_users_mod->batch_answers($answres_list, $answer_data, $test_id, $username, 'teacher', $zong_score, $paper_id);
        
        if (!$res) {
            return $this->_response(GlobalResponse::$HTTP_REQUEST_ERROR_CODE, "批改失败！");
        }
        
        return $this->_response(GlobalResponse::$HTTP_STATUS_OK_CODE, "批改成功", ['total_score' => $zong_score]);

    } catch (\Exception $e) {
        Log::error("批改失败: " . $e->getMessage());
        Log::error("错误堆栈: " . $e->getTraceAsString());
        return $this->_response(GlobalResponse::$HTTP_SERVER_ERROR_CODE, "服务器内部错误");
    }
}
//     /**
//      * Notes:查询成绩
//      * User: zhangnan
//      * DateTime: 2025/7/28 14:16
//      * @param Request $request
//      * @return JsonResponse
//      */
//     public function query_results(Request $request)
//     {
//         try {
//             $test_id = trim($request->input('test_id'));
//             $c_username     = trim($request->input('username'));
//             $validated_data = array(
//                 'test_id' => 'required|string|exists:c_tests,c_id',
//                 'username' => 'required|string|exists:c_users,c_username',
//             );
//             $validated_msg = array(
//                 'test_id.required'=>"测试id不能为空",
//                 'test_id.string'=>"测试id类型错误",
//                 'test_id.exists'=>"测试id不存在",
//                 'username.required'=>"考生不能为空",
//                 'username.string'=>"考生类型不正确",
//                 'username.exists'=>"考生不存在",
//             );
//             $validatedData = $request->validate($validated_data, $validated_msg);
//             $test_user_mod = new TestUsersModel();
//             $check_test_users = $test_user_mod->check_test_users_by_user_name($test_id,$c_username);
//             if(!$check_test_users){
//                 return $this->_response(GlobalResponse::$HTTP_REQUEST_ERROR_CODE,"未查询到答卷信息！");
//             }
//             if($check_test_users->c_correct==0){
//                 return $this->_response(GlobalResponse::$HTTP_REQUEST_ERROR_CODE,"考生未交卷！");
//             }else if($check_test_users->c_correct==1){
//                 return $this->_response(GlobalResponse::$HTTP_REQUEST_ERROR_CODE,"该试卷批改中！");
//             }else{
//                 $res = array(
//                     'paper_id'=>$check_test_users->c_paper_id,
//                     'submit'=>$check_test_users->c_submit,
//                     'score'=>$check_test_users->c_score,
//                 );
//                 return $this->_response(GlobalResponse::$HTTP_STATUS_OK_CODE,GlobalResponse::HTTP_STATUS_OK_MES,$res);
//             }
//         } catch (ValidationException $e) {
//             return $this->_response(GlobalResponse::$HTTP_REQUEST_ERROR_CODE,$e->getMessage());
//         }
//     }


//     public function redis_test()
//     {
//         $a = array(
//             'a'=>1,
//             'b'=>2,
//             'c'=>3
//         );
// //        Cache::put('test', json_encode($a));

//         $redis = Cache::store('redis');
//         $fs = $redis->put('test',json_encode($a));//发送
//         $fs = $redis->put('test',json_encode($a),10);//带计时
//         $hq = $redis->get('test');//获取
//         $del = $redis->delete('test');//删除
//     }

  /**
     * Notes: 获取课程及相关测试和实验列表
     * User: assistant
     * DateTime: 2025/9/16 19:21
     * @param Request $request
     * @return JsonResponse
     */
    public function get_course_tests_experiments(Request $request)
    {
        try {
            // 获取所有课程
            $courses = DB::table('c_courses')
                ->select('c_course_id', 'c_course_name')
                ->get();

            $result = [];
            
            foreach ($courses as $course) {
                // 查询理论测试，仅获取类型为“考试”的记录
                $tests = DB::table('c_tests')
                    ->where('c_course_id', $course->c_course_id)
                    ->where('c_type', '考试')
                    ->select(
                        'c_id',
                        'c_name',
                        'c_description',
                        'c_start',
                        'c_end',
                        'c_type'
                    )
                    ->get()
                    ->map(function ($test) {
                        return [
                            'id' => $test->c_id,
                            'name' => $test->c_name,
                            'description' => $test->c_description,
                            'start' => $test->c_start,
                            'end' => $test->c_end,
                            'type' => '理论测试',
                            'category' => '理论测试'
                        ];
                    })->toArray();

                // 查询实验
                $experiments = DB::table('c_course_experiments')
                    ->where('c_course_id', $course->c_course_id)
                    ->select(
                        'c_experiment_id as id',
                        'c_experiment_name as name',
                        'c_description as description',
                        'c_start as start',
                        'c_end as end'
                    )
                    ->get()
                    ->map(function ($experiment) {
                        return [
                            'id' => $experiment->id,
                            'name' => $experiment->name,
                            'description' => $experiment->description,
                            'start' => $experiment->start,
                            'end' => $experiment->end,
                            'type' => '实验',
                            'category' => '实验'
                        ];
                    })->toArray();

                // 合并测试和实验
                $items = array_merge($tests, $experiments);
                
                // 仅当课程有相关测试或实验时才添加到结果
                if (!empty($items)) {
                    $course_data = [
                        'course_id' => $course->c_course_id,
                        'course_name' => $course->c_course_name,
                        'items' => $items
                    ];
                    $result[] = $course_data;
                }
            }

            Log::info('获取课程及测试实验列表成功', [
                'course_count' => count($result),
                'total_items' => array_sum(array_map(fn($course) => count($course['items']), $result))
            ]);

            return $this->_response(
                GlobalResponse::$HTTP_STATUS_OK_CODE,
                GlobalResponse::HTTP_STATUS_OK_MES,
                $result
            );

        } catch (\Exception $e) {
            Log::error('获取课程及测试实验列表失败', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            return $this->_response(
                GlobalResponse::$HTTP_SERVER_ERROR_CODE,
                "获取课程及测试实验列表失败：" . $e->getMessage()
            );
        }
    }

   /**
 * Notes: 获取课程下所有测试/实验成绩
 * User: assistant
 * DateTime: 2025/9/16 20:00
 * @param Request $request
 * @return JsonResponse
 */
public function get_test_scores(Request $request)
{
    try {
        $courseId = trim($request->input('course_id'));

        $validated_data = [
            'course_id' => 'required|string',
        ];
        $validated_msg = [
            'course_id.required' => '课程ID不能为空',
        ];
        $request->validate($validated_data, $validated_msg);

        $optionalTables = ['c_scene_container_instances', 'c_scene_vm_instances'];
        foreach ($optionalTables as $table) {
            if (!\Illuminate\Support\Facades\Schema::hasTable($table)) {
                Log::warning("可选表缺失: {$table}, 将使用默认值 '空'");
            }
        }

        $result = ['course_id' => $courseId, 'tests' => [], 'experiments' => []];

        // 查询课程名称
        $course = DB::table('c_courses')
            ->where('c_course_id', $courseId)
            ->select('c_course_name')
            ->first();
        if (!$course) {
            Log::warning('课程不存在', ['course_id' => $courseId]);
            return $this->_response(GlobalResponse::$HTTP_REQUEST_ERROR_CODE, '课程不存在');
        }
        $result['course_name'] = $course->c_course_name;

        // 查询理论测试成绩
        $tests = DB::table('c_tests')
            ->where('c_course_id', $courseId)
            ->where('c_type', '考试')
            ->select('c_id', 'c_name')
            ->get();

        foreach ($tests as $test) {
            $userScores = DB::table('c_test_users')
                ->where('c_test_id', $test->c_id)
                ->select('c_username', 'c_paper_id', 'c_start', 'c_submit', 'c_score', 'c_objective_score', 'c_subjective_score')
                ->orderBy('c_username')
                ->orderBy('c_paper_id')
                ->get();

            Log::debug('userScores 数据', ['test_id' => $test->c_id, 'scores' => $userScores->toArray()]);

            $papers = DB::table('c_papers')
                ->whereIn('c_id', $userScores->pluck('c_paper_id')->unique())
                ->select('c_id')
                ->orderBy('c_id')
                ->get()
                ->values()
                ->map(function ($paper, $index) {
                    return [
                        'paper_id' => $paper->c_id,
                        'paper_name' => '试卷' . ($index + 1)
                    ];
                })->keyBy('paper_id')->toArray();

            Log::debug('papers 数据', ['test_id' => $test->c_id, 'papers' => $papers]);

            $formattedScores = $userScores->groupBy('c_username')->map(function ($userPapers, $username) use ($papers) {
                return [
                    'username' => $username,
                    'papers' => $userPapers->map(function ($score) use ($papers) {
                        $paperName = isset($papers[$score->c_paper_id]) ? $papers[$score->c_paper_id]['paper_name'] : '未知试卷';
                        return [
                            'paper_id' => $score->c_paper_id,
                            'paper_name' => $paperName,
                            'start_time' => $score->c_start,
                            'submit_time' => $score->c_submit,
                            'total_score' => isset($score->c_score) ? $score->c_score : 0,
                            'objective_score' => isset($score->c_objective_score) ? $score->c_objective_score : 0,
                            'subjective_score' => isset($score->c_subjective_score) ? $score->c_subjective_score : 0
                        ];
                    })->values()->toArray()
                ];
            })->values()->toArray();

            $result['tests'][] = [
                'test_id' => $test->c_id,
                'test_name' => $test->c_name,
                'category' => '理论测试',
                'scores' => $formattedScores
            ];
        }

        // 查询实验 Flag 提交历史
        $experiments = DB::table('c_course_experiments')
            ->where('c_course_id', $courseId)
            ->select('c_experiment_id', 'c_experiment_name', 'c_config_id')
            ->get();

        foreach ($experiments as $experiment) {
            // 修改：直接从 c_test_users 获取 usernames 和 c_scene_instance_id，按 c_scene_instance_id 降序取每个用户最新的
            $testUsers = DB::table('c_test_users')
                ->where('c_test_id', $experiment->c_experiment_id)
                ->select('c_username', 'c_scene_instance_id')
                ->orderBy('c_scene_instance_id', 'desc')
                ->get()
                ->groupBy('c_username')
                ->map(function ($group) {
                    return $group->first()->c_scene_instance_id;
                })->toArray();

            $usernames = array_keys($testUsers);

            Log::debug('实验 usernames 和 c_config_id', [
                'experiment_id' => $experiment->c_experiment_id,
                'usernames' => $usernames,
                'c_config_id' => $experiment->c_config_id
            ]);

            $submissionHistory = [];
            if (!empty($usernames)) {
                // 修改：直接使用从 c_test_users 获取的 sceneInstances
                $sceneInstances = $testUsers;

                Log::debug('sceneInstances 数据', [
                    'experiment_id' => $experiment->c_experiment_id,
                    'scene_instances' => $sceneInstances
                ]);

                foreach ($usernames as $username) {
                    if (isset($sceneInstances[$username])) {
                        $sceneInstanceId = $sceneInstances[$username];

                        // 查询容器和虚拟机 ID
                        $containerIds = SceneContainerInstanceModel::where('c_scene_instances_id', $sceneInstanceId)
                            ->pluck('c_container_id')
                            ->toArray();
                        $vmIds = SceneVmInstanceModel::where('c_scene_instances_id', $sceneInstanceId)
                            ->pluck('c_vm_id')
                            ->toArray();

                        Log::debug('容器和虚拟机 ID', [
                            'username' => $username,
                            'scene_instance_id' => $sceneInstanceId,
                            'container_ids' => $containerIds,
                            'vm_ids' => $vmIds
                        ]);

                        // 修改：查询 c_flag_submissions，添加 c_scene_instances_id 条件
                        $history = FlagSubmissionModel::select([
                                'c_submission_id',
                                'c_username',
                                'c_submitted_at',
                                'c_is_correct',
                                'c_attempt_count',
                                'c_points_earned',
                                'c_container_instance_id',
                                'c_vm_instance_id',
                                'c_submitted_flag',
                                'c_scene_instances_id'
                            ])
                            ->with([
                                'containerInstance:c_container_id,c_container_name,c_ip,c_scene_instances_id',
                                'vmInstance:c_vm_id,c_vm_name,c_ip,c_scene_instances_id'
                            ])
                            ->where('c_username', $username)
                            ->where('c_scene_instances_id', $sceneInstanceId) // 新增条件
                            ->where(function ($q) use ($containerIds, $vmIds) {
                                $q->whereIn('c_container_instance_id', $containerIds)
                                  ->orWhereIn('c_vm_instance_id', $vmIds)
                                  ->orWhereNull('c_container_instance_id')
                                  ->orWhereNull('c_vm_instance_id');
                            })
                            ->orderBy('c_submitted_at', 'desc')
                            ->get()
                            ->map(function ($record) {
                                $instanceId = isset($record->c_container_instance_id) ? $record->c_container_instance_id : (isset($record->c_vm_instance_id) ? $record->c_vm_instance_id : '空');
                                $instanceType = isset($record->c_container_instance_id) ? 'docker' : (isset($record->c_vm_instance_id) ? 'vm' : '空');
                                $instanceIp = '空';
                                $instanceName = '空';
                                $sceneId = $record->c_scene_instances_id;

                                if ($record->containerInstance) {
                                    $instanceIp = isset($record->containerInstance->c_ip) ? $record->containerInstance->c_ip : '空';
                                    $instanceName = isset($record->containerInstance->c_container_name) ? $record->containerInstance->c_container_name : '空';
                                    Log::info('Container Instance Debug', [
                                        'container_id' => $record->c_container_instance_id,
                                        'container_data' => $record->containerInstance ? $record->containerInstance->toArray() : 'null',
                                        'extracted_ip' => $instanceIp,
                                        'extracted_name' => $instanceName
                                    ]);
                                } elseif ($record->vmInstance) {
                                    $instanceIp = isset($record->vmInstance->c_ip) ? $record->vmInstance->c_ip : '空';
                                    $instanceName = isset($record->vmInstance->c_vm_name) ? $record->vmInstance->c_vm_name : '空';
                                    Log::info('VM Instance Debug', [
                                        'vm_id' => $record->c_vm_instance_id,
                                        'vm_data' => $record->vmInstance ? $record->vmInstance->toArray() : 'null',
                                        'extracted_ip' => $instanceIp,
                                        'extracted_name' => $instanceName
                                    ]);
                                }

                                return [
                                    'c_submission_id' => $record->c_submission_id,
                                    'c_username' => $record->c_username,
                                    'c_submitted_at' => $record->c_submitted_at,
                                    'c_is_correct' => isset($record->c_is_correct) ? $record->c_is_correct : false,
                                    'c_attempt_count' => isset($record->c_attempt_count) ? $record->c_attempt_count : 0,
                                    'c_points_earned' => isset($record->c_points_earned) ? $record->c_points_earned : 0,
                                    'c_submitted_flag' => isset($record->c_submitted_flag) ? $record->c_submitted_flag : '',
                                    'instance_id' => $instanceId,
                                    'instance_ip' => $instanceIp,
                                    'instance_name' => $instanceName,
                                    'instance_type' => $instanceType,
                                    'c_scene_instances_id' => $sceneId,
                                ];
                            })->toArray();

                        Log::debug('Flag 提交历史', [
                            'username' => $username,
                            'scene_instance_id' => $sceneInstanceId,
                            'history' => $history
                        ]);

                        if (!empty($history)) {
                            $submissionHistory[] = [
                                'username' => $username,
                                'history' => $history
                            ];
                        }
                    } else {
                        Log::warning('未找到用户场景实例', [
                            'username' => $username,
                            'experiment_id' => $experiment->c_experiment_id
                        ]);
                    }
                }
            }

            $result['experiments'][] = [
                'test_id' => $experiment->c_experiment_id,
                'test_name' => $experiment->c_experiment_name,
                'category' => '实验',
                'history' => $submissionHistory
            ];
        }

        return $this->_response(GlobalResponse::$HTTP_STATUS_OK_CODE, '成绩获取成功', $result);

    } catch (ValidationException $e) {
        Log::warning('参数验证失败', ['error' => $e->getMessage(), 'course_id' => $courseId]);
        return $this->_response(GlobalResponse::$HTTP_REQUEST_ERROR_CODE, $e->getMessage());
    } catch (\Exception $e) {
        Log::error('获取成绩失败', [
            'error' => $e->getMessage(),
            'trace' => $e->getTraceAsString(),
            'course_id' => $courseId
        ]);
        return $this->_response(GlobalResponse::$HTTP_SERVER_ERROR_CODE, '获取成绩失败：' . $e->getMessage());
    }
}

   /**
 * Notes: 下载课程下所有测试/实验成绩 CSV
 * User: assistant
 * DateTime: 2025/9/16 20:00
 * @param Request $request
 * @return \Symfony\Component\HttpFoundation\StreamedResponse|JsonResponse
 */
public function download_test_scores(Request $request)
{
    try {
        $courseId = trim($request->input('course_id'));

        $validated_data = [
            'course_id' => 'required|string',
        ];
        $validated_msg = [
            'course_id.required' => '课程ID不能为空',
        ];
        $request->validate($validated_data, $validated_msg);

        $optionalTables = ['c_scene_container_instances', 'c_scene_vm_instances'];
        foreach ($optionalTables as $table) {
            if (!\Illuminate\Support\Facades\Schema::hasTable($table)) {
                Log::warning("可选表缺失: {$table}, 将使用默认值 '空'");
            }
        }

        $course = DB::table('c_courses')
            ->where('c_course_id', $courseId)
            ->select('c_course_name')
            ->first();
        if (!$course) {
            Log::warning('课程不存在', ['course_id' => $courseId]);
            return $this->_response(GlobalResponse::$HTTP_REQUEST_ERROR_CODE, '课程不存在');
        }

        $csvData = [];

        // 理论测试成绩
        $tests = DB::table('c_tests')
            ->where('c_course_id', $courseId)
            ->where('c_type', '考试')
            ->select('c_id', 'c_name')
            ->get();

        foreach ($tests as $test) {
            $userScores = DB::table('c_test_users')
                ->where('c_test_id', $test->c_id)
                ->select('c_username', 'c_paper_id', 'c_start', 'c_submit', 'c_score', 'c_objective_score', 'c_subjective_score')
                ->orderBy('c_username')
                ->orderBy('c_paper_id')
                ->get();

            Log::debug('userScores 数据', ['test_id' => $test->c_id, 'scores' => $userScores->toArray()]);

            $papers = DB::table('c_papers')
                ->whereIn('c_id', $userScores->pluck('c_paper_id')->unique())
                ->select('c_id')
                ->orderBy('c_id')
                ->get()
                ->values()
                ->map(function ($paper, $index) {
                    return [
                        'paper_id' => $paper->c_id,
                        'paper_name' => '试卷' . ($index + 1)
                    ];
                })->keyBy('paper_id')->toArray();

            Log::debug('papers 数据', ['test_id' => $test->c_id, 'papers' => $papers]);

            $csvData[] = "理论测试: {$test->c_name}";
            $csvData[] = '用户名,试卷名称,开始时间,提交时间,总分,客观题分,主观题分';
            foreach ($userScores as $score) {
                $paperName = isset($papers[$score->c_paper_id]) ? $papers[$score->c_paper_id]['paper_name'] : '未知试卷';
                $csvData[] = "{$score->c_username},{$paperName},{$score->c_start},{$score->c_submit}," .
                    (isset($score->c_score) ? $score->c_score : 0) . "," .
                    (isset($score->c_objective_score) ? $score->c_objective_score : 0) . "," .
                    (isset($score->c_subjective_score) ? $score->c_subjective_score : 0);
            }
            $csvData[] = '';
        }

        // 实验 Flag 提交历史
        $experiments = DB::table('c_course_experiments')
            ->where('c_course_id', $courseId)
            ->select('c_experiment_id', 'c_experiment_name', 'c_config_id')
            ->get();

        foreach ($experiments as $experiment) {
            // 修改：直接从 c_test_users 获取 usernames 和 c_scene_instance_id，按 c_scene_instance_id 降序取每个用户最新的
            $testUsers = DB::table('c_test_users')
                ->where('c_test_id', $experiment->c_experiment_id)
                ->select('c_username', 'c_scene_instance_id')
                ->orderBy('c_scene_instance_id', 'desc')
                ->get()
                ->groupBy('c_username')
                ->map(function ($group) {
                    return $group->first()->c_scene_instance_id;
                })->toArray();

            $usernames = array_keys($testUsers);

            Log::debug('实验 usernames 和 c_config_id', [
                'experiment_id' => $experiment->c_experiment_id,
                'usernames' => $usernames,
                'c_config_id' => $experiment->c_config_id
            ]);

            $csvData[] = "实验: {$experiment->c_experiment_name}";
            $csvData[] = '用户名,提交时间,是否正确,尝试次数,获得积分,提交的Flag,靶机ID,靶机IP,靶机名称,靶机类型';
            if (!empty($usernames)) {
                // 修改：直接使用从 c_test_users 获取的 sceneInstances
                $sceneInstances = $testUsers;

                Log::debug('sceneInstances 数据', [
                    'experiment_id' => $experiment->c_experiment_id,
                    'scene_instances' => $sceneInstances
                ]);

                foreach ($usernames as $username) {
                    if (isset($sceneInstances[$username])) {
                        $sceneInstanceId = $sceneInstances[$username];

                        // 查询容器和虚拟机 ID
                        $containerIds = SceneContainerInstanceModel::where('c_scene_instances_id', $sceneInstanceId)
                            ->pluck('c_container_id')
                            ->toArray();
                        $vmIds = SceneVmInstanceModel::where('c_scene_instances_id', $sceneInstanceId)
                            ->pluck('c_vm_id')
                            ->toArray();

                        Log::debug('容器和虚拟机 ID', [
                            'username' => $username,
                            'scene_instance_id' => $sceneInstanceId,
                            'container_ids' => $containerIds,
                            'vm_ids' => $vmIds
                        ]);

                        // 修改：查询 c_flag_submissions，添加 c_scene_instances_id 条件
                        $history = FlagSubmissionModel::select([
                                'c_submission_id',
                                'c_username',
                                'c_submitted_at',
                                'c_is_correct',
                                'c_attempt_count',
                                'c_points_earned',
                                'c_container_instance_id',
                                'c_vm_instance_id',
                                'c_submitted_flag',
                                'c_scene_instances_id'
                            ])
                            ->with([
                                'containerInstance:c_container_id,c_container_name,c_ip,c_scene_instances_id',
                                'vmInstance:c_vm_id,c_vm_name,c_ip,c_scene_instances_id'
                            ])
                            ->where('c_username', $username)
                            ->where('c_scene_instances_id', $sceneInstanceId) // 新增条件
                            ->where(function ($q) use ($containerIds, $vmIds) {
                                $q->whereIn('c_container_instance_id', $containerIds)
                                  ->orWhereIn('c_vm_instance_id', $vmIds)
                                  ->orWhereNull('c_container_instance_id')
                                  ->orWhereNull('c_vm_instance_id');
                            })
                            ->orderBy('c_submitted_at', 'desc')
                            ->get()
                            ->map(function ($record) {
                                $instanceId = isset($record->c_container_instance_id) ? $record->c_container_instance_id : (isset($record->c_vm_instance_id) ? $record->c_vm_instance_id : '空');
                                $instanceType = isset($record->c_container_instance_id) ? 'docker' : (isset($record->c_vm_instance_id) ? 'vm' : '空');
                                $instanceIp = '空';
                                $instanceName = '空';
                                $sceneId = $record->c_scene_instances_id;

                                if ($record->containerInstance) {
                                    $instanceIp = isset($record->containerInstance->c_ip) ? $record->containerInstance->c_ip : '空';
                                    $instanceName = isset($record->containerInstance->c_container_name) ? $record->containerInstance->c_container_name : '空';
                                    Log::info('Container Instance Debug', [
                                        'container_id' => $record->c_container_instance_id,
                                        'container_data' => $record->containerInstance ? $record->containerInstance->toArray() : 'null',
                                        'extracted_ip' => $instanceIp,
                                        'extracted_name' => $instanceName
                                    ]);
                                } elseif ($record->vmInstance) {
                                    $instanceIp = isset($record->vmInstance->c_ip) ? $record->vmInstance->c_ip : '空';
                                    $instanceName = isset($record->vmInstance->c_vm_name) ? $record->vmInstance->c_vm_name : '空';
                                    Log::info('VM Instance Debug', [
                                        'vm_id' => $record->c_vm_instance_id,
                                        'vm_data' => $record->vmInstance ? $record->vmInstance->toArray() : 'null',
                                        'extracted_ip' => $instanceIp,
                                        'extracted_name' => $instanceName
                                    ]);
                                }

                                return [
                                    'c_username' => $record->c_username,
                                    'c_submitted_at' => $record->c_submitted_at,
                                    'c_is_correct' => isset($record->c_is_correct) ? $record->c_is_correct : false,
                                    'c_attempt_count' => isset($record->c_attempt_count) ? $record->c_attempt_count : 0,
                                    'c_points_earned' => isset($record->c_points_earned) ? $record->c_points_earned : 0,
                                    'c_submitted_flag' => isset($record->c_submitted_flag) ? $record->c_submitted_flag : '',
                                    'instance_id' => $instanceId,
                                    'instance_ip' => $instanceIp,
                                    'instance_name' => $instanceName,
                                    'instance_type' => $instanceType,
                                    'c_scene_instances_id' => $sceneId,
                                ];
                            })->toArray();

                        Log::debug('Flag 提交历史', [
                            'username' => $username,
                            'scene_instance_id' => $sceneInstanceId,
                            'history' => $history
                        ]);

                        foreach ($history as $record) {
                            $csvData[] = "{$record['c_username']},{$record['c_submitted_at']}," .
                                ($record['c_is_correct'] ? '是' : '否') . "," .
                                "{$record['c_attempt_count']},{$record['c_points_earned']}," .
                                "{$record['c_submitted_flag']},{$record['instance_id']},{$record['instance_ip']},{$record['instance_name']},{$record['instance_type']}";
                        }
                    } else {
                        Log::warning('未找到用户场景实例', [
                            'username' => $username,
                            'experiment_id' => $experiment->c_experiment_id
                        ]);
                    }
                }
            }
            $csvData[] = '';
        }

        // 返回 CSV 下载
        $csvContent = "\xEF\xBB\xBF" . implode("\n", $csvData); // 添加 BOM 确保中文不乱码
        $filename = "课程_{$courseId}_成绩.csv";
        $response = response($csvContent)
            ->header('Content-Type', 'text/csv; charset=UTF-8')
            ->header('Content-Disposition', "attachment; filename=\"{$filename}\"")
            ->header('Cache-Control', 'no-cache');

        return $response;

    } catch (ValidationException $e) {
        Log::warning('参数验证失败', ['error' => $e->getMessage(), 'course_id' => $courseId]);
        return $this->_response(GlobalResponse::$HTTP_REQUEST_ERROR_CODE, $e->getMessage());
    } catch (\Exception $e) {
        Log::error('下载成绩失败', [
            'error' => $e->getMessage(),
            'trace' => $e->getTraceAsString(),
            'course_id' => $courseId
        ]);
        return $this->_response(GlobalResponse::$HTTP_SERVER_ERROR_CODE, '下载成绩失败：' . $e->getMessage());
    }
}

/**
 * Notes: 获取单个测试/实验成绩详情
 * User: assistant
 * DateTime: 2025/9/16 20:00
 * @param Request $request
 * @return JsonResponse
 */
public function get_test_score_detail(Request $request)
{
    try {
        $courseId = trim($request->input('course_id'));
        $testId = trim($request->input('test_id'));
        $category = trim($request->input('category'));

        $validated_data = [
            'course_id' => 'required|string',
            'test_id' => 'required|string',
            'category' => 'required|string|in:理论测试,实验'
        ];
        $validated_msg = [
            'course_id.required' => '课程ID不能为空',
            'test_id.required' => '测试ID不能为空',
            'category.required' => '类型不能为空',
            'category.in' => '类型必须是理论测试或实验'
        ];
        $request->validate($validated_data, $validated_msg);

        $optionalTables = ['c_scene_container_instances', 'c_scene_vm_instances'];
        foreach ($optionalTables as $table) {
            if (!\Illuminate\Support\Facades\Schema::hasTable($table)) {
                Log::warning("可选表缺失: {$table}, 将使用默认值 '空'");
            }
        }

        // 查询课程名称
        $course = DB::table('c_courses')
            ->where('c_course_id', $courseId)
            ->select('c_course_name')
            ->first();
        if (!$course) {
            Log::warning('课程不存在', ['course_id' => $courseId]);
            return $this->_response(GlobalResponse::$HTTP_REQUEST_ERROR_CODE, '课程不存在');
        }

        $result = [
            'course_id' => $courseId,
            'course_name' => $course->c_course_name,
            'test_id' => $testId,
            'test_name' => '',
            'category' => $category
        ];

        if ($category === '理论测试') {
            // 查询理论测试成绩
            $test = DB::table('c_tests')
                ->where('c_id', $testId)
                ->where('c_course_id', $courseId)
                ->where('c_type', '考试')
                ->select('c_id', 'c_name')
                ->first();

            if (!$test) {
                return $this->_response(GlobalResponse::$HTTP_REQUEST_ERROR_CODE, '测试不存在');
            }

            $result['test_name'] = $test->c_name;

            $userScores = DB::table('c_test_users')
                ->where('c_test_id', $testId)
                ->select('c_username', 'c_paper_id', 'c_start', 'c_submit', 'c_score', 'c_objective_score', 'c_subjective_score')
                ->orderBy('c_username')
                ->orderBy('c_paper_id')
                ->get();

            $papers = DB::table('c_papers')
                ->whereIn('c_id', $userScores->pluck('c_paper_id')->unique())
                ->select('c_id')
                ->orderBy('c_id')
                ->get()
                ->values()
                ->map(function ($paper, $index) {
                    return [
                        'paper_id' => $paper->c_id,
                        'paper_name' => '试卷' . ($index + 1)
                    ];
                })->keyBy('paper_id')->toArray();

            $formattedScores = $userScores->groupBy('c_username')->map(function ($userPapers, $username) use ($papers) {
                return [
                    'username' => $username,
                    'papers' => $userPapers->map(function ($score) use ($papers) {
                        $paperName = isset($papers[$score->c_paper_id]) ? $papers[$score->c_paper_id]['paper_name'] : '未知试卷';
                        return [
                            'paper_id' => $score->c_paper_id,
                            'paper_name' => $paperName,
                            'start_time' => $score->c_start,
                            'submit_time' => $score->c_submit,
                            'total_score' => isset($score->c_score) ? $score->c_score : 0,
                            'objective_score' => isset($score->c_objective_score) ? $score->c_objective_score : 0,
                            'subjective_score' => isset($score->c_subjective_score) ? $score->c_subjective_score : 0
                        ];
                    })->values()->toArray()
                ];
            })->values()->toArray();

            $result['scores'] = $formattedScores;

        } else if ($category === '实验') {
            // 查询实验 Flag 提交历史
            $experiment = DB::table('c_course_experiments')
                ->where('c_experiment_id', $testId)
                ->where('c_course_id', $courseId)
                ->select('c_experiment_id', 'c_experiment_name', 'c_config_id')
                ->first();

            if (!$experiment) {
                return $this->_response(GlobalResponse::$HTTP_REQUEST_ERROR_CODE, '实验不存在');
            }

            $result['test_name'] = $experiment->c_experiment_name;

            // 直接从 c_test_users 获取 usernames 和 c_scene_instance_id
            $testUsers = DB::table('c_test_users')
                ->where('c_test_id', $testId)
                ->select('c_username', 'c_scene_instance_id')
                ->orderBy('c_scene_instance_id', 'desc')
                ->get()
                ->groupBy('c_username')
                ->map(function ($group) {
                    return $group->first()->c_scene_instance_id;
                })->toArray();

            $usernames = array_keys($testUsers);
            $submissionHistory = [];

            if (!empty($usernames)) {
                $sceneInstances = $testUsers;

                foreach ($usernames as $username) {
                    if (isset($sceneInstances[$username])) {
                        $sceneInstanceId = $sceneInstances[$username];

                        // 查询容器和虚拟机 ID
                        $containerIds = SceneContainerInstanceModel::where('c_scene_instances_id', $sceneInstanceId)
                            ->pluck('c_container_id')
                            ->toArray();
                        $vmIds = SceneVmInstanceModel::where('c_scene_instances_id', $sceneInstanceId)
                            ->pluck('c_vm_id')
                            ->toArray();

                        // 查询 c_flag_submissions
                        $history = FlagSubmissionModel::select([
                                'c_submission_id',
                                'c_username',
                                'c_submitted_at',
                                'c_is_correct',
                                'c_attempt_count',
                                'c_points_earned',
                                'c_container_instance_id',
                                'c_vm_instance_id',
                                'c_submitted_flag',
                                'c_scene_instances_id'
                            ])
                            ->with([
                                'containerInstance:c_container_id,c_container_name,c_ip,c_scene_instances_id',
                                'vmInstance:c_vm_id,c_vm_name,c_ip,c_scene_instances_id'
                            ])
                            ->where('c_username', $username)
                            ->where('c_scene_instances_id', $sceneInstanceId)
                            ->where(function ($q) use ($containerIds, $vmIds) {
                                $q->whereIn('c_container_instance_id', $containerIds)
                                  ->orWhereIn('c_vm_instance_id', $vmIds)
                                  ->orWhereNull('c_container_instance_id')
                                  ->orWhereNull('c_vm_instance_id');
                            })
                            ->orderBy('c_submitted_at', 'desc')
                            ->get()
                            ->map(function ($record) {
                                $instanceId = isset($record->c_container_instance_id) ? $record->c_container_instance_id : (isset($record->c_vm_instance_id) ? $record->c_vm_instance_id : '空');
                                $instanceType = isset($record->c_container_instance_id) ? 'docker' : (isset($record->c_vm_instance_id) ? 'vm' : '空');
                                $instanceIp = '空';
                                $instanceName = '空';
                                $sceneId = $record->c_scene_instances_id;

                                if ($record->containerInstance) {
                                    $instanceIp = isset($record->containerInstance->c_ip) ? $record->containerInstance->c_ip : '空';
                                    $instanceName = isset($record->containerInstance->c_container_name) ? $record->containerInstance->c_container_name : '空';
                                } elseif ($record->vmInstance) {
                                    $instanceIp = isset($record->vmInstance->c_ip) ? $record->vmInstance->c_ip : '空';
                                    $instanceName = isset($record->vmInstance->c_vm_name) ? $record->vmInstance->c_vm_name : '空';
                                }

                                return [
                                    'c_submission_id' => $record->c_submission_id,
                                    'c_username' => $record->c_username,
                                    'c_submitted_at' => $record->c_submitted_at,
                                    'c_is_correct' => isset($record->c_is_correct) ? $record->c_is_correct : false,
                                    'c_attempt_count' => isset($record->c_attempt_count) ? $record->c_attempt_count : 0,
                                    'c_points_earned' => isset($record->c_points_earned) ? $record->c_points_earned : 0,
                                    'c_submitted_flag' => isset($record->c_submitted_flag) ? $record->c_submitted_flag : '',
                                    'instance_id' => $instanceId,
                                    'instance_ip' => $instanceIp,
                                    'instance_name' => $instanceName,
                                    'instance_type' => $instanceType,
                                    'c_scene_instances_id' => $sceneId,
                                ];
                            })->toArray();

                        if (!empty($history)) {
                            $submissionHistory[] = [
                                'username' => $username,
                                'history' => $history
                            ];
                        }
                    }
                }
            }

            $result['history'] = $submissionHistory;
        }

        return $this->_response(GlobalResponse::$HTTP_STATUS_OK_CODE, '成绩获取成功', $result);

    } catch (ValidationException $e) {
        Log::warning('参数验证失败', ['error' => $e->getMessage(), 'course_id' => $courseId, 'test_id' => $testId]);
        return $this->_response(GlobalResponse::$HTTP_REQUEST_ERROR_CODE, $e->getMessage());
    } catch (\Exception $e) {
        Log::error('获取成绩失败', [
            'error' => $e->getMessage(),
            'trace' => $e->getTraceAsString(),
            'course_id' => $courseId,
            'test_id' => $testId
        ]);
        return $this->_response(GlobalResponse::$HTTP_SERVER_ERROR_CODE, '获取成绩失败：' . $e->getMessage());
    }
}

/**
 * Notes: 下载单个测试/实验成绩 CSV
 * User: assistant
 * DateTime: 2025/9/16 20:00
 * @param Request $request
 * @return \Symfony\Component\HttpFoundation\StreamedResponse|JsonResponse
 */
public function download_test_score_detail(Request $request)
{
    try {
        $courseId = trim($request->input('course_id'));
        $testId = trim($request->input('test_id'));
        $category = trim($request->input('category'));

        $validated_data = [
            'course_id' => 'required|string',
            'test_id' => 'required|string',
            'category' => 'required|string|in:理论测试,实验'
        ];
        $validated_msg = [
            'course_id.required' => '课程ID不能为空',
            'test_id.required' => '测试ID不能为空',
            'category.required' => '类型不能为空',
            'category.in' => '类型必须是理论测试或实验'
        ];
        $request->validate($validated_data, $validated_msg);

        $course = DB::table('c_courses')
            ->where('c_course_id', $courseId)
            ->select('c_course_name')
            ->first();
        if (!$course) {
            Log::warning('课程不存在', ['course_id' => $courseId]);
            return $this->_response(GlobalResponse::$HTTP_REQUEST_ERROR_CODE, '课程不存在');
        }

        $csvData = [];
        $testName = '';

        if ($category === '理论测试') {
            // 查询理论测试成绩
            $test = DB::table('c_tests')
                ->where('c_id', $testId)
                ->where('c_course_id', $courseId)
                ->where('c_type', '考试')
                ->select('c_id', 'c_name')
                ->first();

            if (!$test) {
                return $this->_response(GlobalResponse::$HTTP_REQUEST_ERROR_CODE, '测试不存在');
            }

            $testName = $test->c_name;

            $userScores = DB::table('c_test_users')
                ->where('c_test_id', $testId)
                ->select('c_username', 'c_paper_id', 'c_start', 'c_submit', 'c_score', 'c_objective_score', 'c_subjective_score')
                ->orderBy('c_username')
                ->orderBy('c_paper_id')
                ->get();

            $papers = DB::table('c_papers')
                ->whereIn('c_id', $userScores->pluck('c_paper_id')->unique())
                ->select('c_id')
                ->orderBy('c_id')
                ->get()
                ->values()
                ->map(function ($paper, $index) {
                    return [
                        'paper_id' => $paper->c_id,
                        'paper_name' => '试卷' . ($index + 1)
                    ];
                })->keyBy('paper_id')->toArray();

            $csvData[] = "理论测试: {$testName}";
            $csvData[] = '用户名,试卷名称,开始时间,提交时间,总分,客观题分,主观题分';
            foreach ($userScores as $score) {
                $paperName = isset($papers[$score->c_paper_id]) ? $papers[$score->c_paper_id]['paper_name'] : '未知试卷';
                $csvData[] = "{$score->c_username},{$paperName},{$score->c_start},{$score->c_submit}," .
                    (isset($score->c_score) ? $score->c_score : 0) . "," .
                    (isset($score->c_objective_score) ? $score->c_objective_score : 0) . "," .
                    (isset($score->c_subjective_score) ? $score->c_subjective_score : 0);
            }

        } else if ($category === '实验') {
            // 查询实验 Flag 提交历史
            $experiment = DB::table('c_course_experiments')
                ->where('c_experiment_id', $testId)
                ->where('c_course_id', $courseId)
                ->select('c_experiment_id', 'c_experiment_name', 'c_config_id')
                ->first();

            if (!$experiment) {
                return $this->_response(GlobalResponse::$HTTP_REQUEST_ERROR_CODE, '实验不存在');
            }

            $testName = $experiment->c_experiment_name;

            // 直接从 c_test_users 获取 usernames 和 c_scene_instance_id
            $testUsers = DB::table('c_test_users')
                ->where('c_test_id', $testId)
                ->select('c_username', 'c_scene_instance_id')
                ->orderBy('c_scene_instance_id', 'desc')
                ->get()
                ->groupBy('c_username')
                ->map(function ($group) {
                    return $group->first()->c_scene_instance_id;
                })->toArray();

            $usernames = array_keys($testUsers);

            $csvData[] = "实验: {$testName}";
            $csvData[] = '用户名,提交时间,是否正确,尝试次数,获得积分,提交的Flag,靶机ID,靶机IP,靶机名称,靶机类型';
            
            if (!empty($usernames)) {
                $sceneInstances = $testUsers;

                foreach ($usernames as $username) {
                    if (isset($sceneInstances[$username])) {
                        $sceneInstanceId = $sceneInstances[$username];

                        // 查询容器和虚拟机 ID
                        $containerIds = SceneContainerInstanceModel::where('c_scene_instances_id', $sceneInstanceId)
                            ->pluck('c_container_id')
                            ->toArray();
                        $vmIds = SceneVmInstanceModel::where('c_scene_instances_id', $sceneInstanceId)
                            ->pluck('c_vm_id')
                            ->toArray();

                        // 查询 c_flag_submissions
                        $history = FlagSubmissionModel::select([
                                'c_submission_id',
                                'c_username',
                                'c_submitted_at',
                                'c_is_correct',
                                'c_attempt_count',
                                'c_points_earned',
                                'c_container_instance_id',
                                'c_vm_instance_id',
                                'c_submitted_flag',
                                'c_scene_instances_id'
                            ])
                            ->with([
                                'containerInstance:c_container_id,c_container_name,c_ip,c_scene_instances_id',
                                'vmInstance:c_vm_id,c_vm_name,c_ip,c_scene_instances_id'
                            ])
                            ->where('c_username', $username)
                            ->where('c_scene_instances_id', $sceneInstanceId)
                            ->where(function ($q) use ($containerIds, $vmIds) {
                                $q->whereIn('c_container_instance_id', $containerIds)
                                  ->orWhereIn('c_vm_instance_id', $vmIds)
                                  ->orWhereNull('c_container_instance_id')
                                  ->orWhereNull('c_vm_instance_id');
                            })
                            ->orderBy('c_submitted_at', 'desc')
                            ->get()
                            ->map(function ($record) {
                                $instanceId = isset($record->c_container_instance_id) ? $record->c_container_instance_id : (isset($record->c_vm_instance_id) ? $record->c_vm_instance_id : '空');
                                $instanceType = isset($record->c_container_instance_id) ? 'docker' : (isset($record->c_vm_instance_id) ? 'vm' : '空');
                                $instanceIp = '空';
                                $instanceName = '空';
                                $sceneId = $record->c_scene_instances_id;

                                if ($record->containerInstance) {
                                    $instanceIp = isset($record->containerInstance->c_ip) ? $record->containerInstance->c_ip : '空';
                                    $instanceName = isset($record->containerInstance->c_container_name) ? $record->containerInstance->c_container_name : '空';
                                } elseif ($record->vmInstance) {
                                    $instanceIp = isset($record->vmInstance->c_ip) ? $record->vmInstance->c_ip : '空';
                                    $instanceName = isset($record->vmInstance->c_vm_name) ? $record->vmInstance->c_vm_name : '空';
                                }

                                return [
                                    'c_username' => $record->c_username,
                                    'c_submitted_at' => $record->c_submitted_at,
                                    'c_is_correct' => isset($record->c_is_correct) ? $record->c_is_correct : false,
                                    'c_attempt_count' => isset($record->c_attempt_count) ? $record->c_attempt_count : 0,
                                    'c_points_earned' => isset($record->c_points_earned) ? $record->c_points_earned : 0,
                                    'c_submitted_flag' => isset($record->c_submitted_flag) ? $record->c_submitted_flag : '',
                                    'instance_id' => $instanceId,
                                    'instance_ip' => $instanceIp,
                                    'instance_name' => $instanceName,
                                    'instance_type' => $instanceType,
                                    'c_scene_instances_id' => $sceneId,
                                ];
                            })->toArray();

                        foreach ($history as $record) {
                            $csvData[] = "{$record['c_username']},{$record['c_submitted_at']}," .
                                ($record['c_is_correct'] ? '是' : '否') . "," .
                                "{$record['c_attempt_count']},{$record['c_points_earned']}," .
                                "{$record['c_submitted_flag']},{$record['instance_id']},{$record['instance_ip']},{$record['instance_name']},{$record['instance_type']}";
                        }
                    }
                }
            }
        }

        // 返回 CSV 下载
        $csvContent = "\xEF\xBB\xBF" . implode("\n", $csvData);
        $filename = "{$category}_{$testName}_成绩.csv";
        $response = response($csvContent)
            ->header('Content-Type', 'text/csv; charset=UTF-8')
            ->header('Content-Disposition', "attachment; filename=\"{$filename}\"")
            ->header('Cache-Control', 'no-cache');

        return $response;

    } catch (ValidationException $e) {
        Log::warning('参数验证失败', ['error' => $e->getMessage(), 'course_id' => $courseId, 'test_id' => $testId]);
        return $this->_response(GlobalResponse::$HTTP_REQUEST_ERROR_CODE, $e->getMessage());
    } catch (\Exception $e) {
        Log::error('下载成绩失败', [
            'error' => $e->getMessage(),
            'trace' => $e->getTraceAsString(),
            'course_id' => $courseId,
            'test_id' => $testId
        ]);
        return $this->_response(GlobalResponse::$HTTP_SERVER_ERROR_CODE, '下载成绩失败：' . $e->getMessage());
    }
}

/**
 * Notes: 获取指定用户在指定测试下的成绩
 * User: assistant
 * DateTime: 2025/9/29 20:00
 * @param Request $request
 * @return JsonResponse
 */
public function get_user_test_score(Request $request)
{
    try {
        $courseId = trim($request->input('course_id'));
        $username = trim($request->input('username'));
        $testId = trim($request->input('c_test_id'));

        $validated_data = [
            'course_id' => 'required|string',
            'username' => 'required|string',
            'c_test_id' => 'required|string',
        ];
        $validated_msg = [
            'course_id.required' => '课程ID不能为空',
            'username.required' => '用户名不能为空',
            'c_test_id.required' => '测试ID不能为空',
        ];
        $request->validate($validated_data, $validated_msg);

        $optionalTables = ['c_scene_container_instances', 'c_scene_vm_instances'];
        foreach ($optionalTables as $table) {
            if (!\Illuminate\Support\Facades\Schema::hasTable($table)) {
                Log::warning("可选表缺失: {$table}, 将使用默认值 '空'");
            }
        }

        $result = ['course_id' => $courseId, 'tests' => [], 'experiments' => []];

        // 查询课程名称
        $course = DB::table('c_courses')
            ->where('c_course_id', $courseId)
            ->select('c_course_name')
            ->first();
        if (!$course) {
            Log::warning('课程不存在', ['course_id' => $courseId]);
            return $this->_response(GlobalResponse::$HTTP_REQUEST_ERROR_CODE, '课程不存在');
        }
        $result['course_name'] = $course->c_course_name;

        // 查询理论测试成绩
        $test = DB::table('c_tests')
            ->where('c_course_id', $courseId)
            ->where('c_type', '考试')
            ->where('c_id', $testId)
            ->select('c_id', 'c_name')
            ->first();

        if ($test) {
            $userScores = DB::table('c_test_users')
                ->where('c_test_id', $test->c_id)
                ->where('c_username', $username)
                ->select('c_username', 'c_paper_id', 'c_start', 'c_submit', 'c_score', 'c_objective_score', 'c_subjective_score')
                ->orderBy('c_paper_id')
                ->get();

            Log::debug('userScores 数据', ['test_id' => $test->c_id, 'scores' => $userScores->toArray()]);

            $papers = DB::table('c_papers')
                ->whereIn('c_id', $userScores->pluck('c_paper_id')->unique())
                ->select('c_id')
                ->orderBy('c_id')
                ->get()
                ->values()
                ->map(function ($paper, $index) {
                    return [
                        'paper_id' => $paper->c_id,
                        'paper_name' => '试卷' . ($index + 1)
                    ];
                })->keyBy('paper_id')->toArray();

            Log::debug('papers 数据', ['test_id' => $test->c_id, 'papers' => $papers]);

            $formattedScores = $userScores->groupBy('c_username')->map(function ($userPapers, $username) use ($papers) {
                return [
                    'username' => $username,
                    'papers' => $userPapers->map(function ($score) use ($papers) {
                        $paperName = isset($papers[$score->c_paper_id]) ? $papers[$score->c_paper_id]['paper_name'] : '未知试卷';
                        return [
                            'paper_id' => $score->c_paper_id,
                            'paper_name' => $paperName,
                            'start_time' => $score->c_start,
                            'submit_time' => $score->c_submit,
                            'total_score' => isset($score->c_score) ? $score->c_score : 0,
                            'objective_score' => isset($score->c_objective_score) ? $score->c_objective_score : 0,
                            'subjective_score' => isset($score->c_subjective_score) ? $score->c_subjective_score : 0
                        ];
                    })->values()->toArray()
                ];
            })->values()->toArray();

            $result['tests'][] = [
                'test_id' => $test->c_id,
                'test_name' => $test->c_name,
                'category' => '理论测试',
                'scores' => $formattedScores
            ];
        }

        // 查询实验 Flag 提交历史
        $experiment = DB::table('c_course_experiments')
            ->where('c_experiment_id', $testId)
            ->select('c_experiment_id', 'c_experiment_name', 'c_config_id')
            ->first();

        if ($experiment) {
            // 获取指定用户的最新 c_scene_instance_id
            $testUser = DB::table('c_test_users')
                ->where('c_test_id', $experiment->c_experiment_id)
                ->where('c_username', $username)
                ->select('c_username', 'c_scene_instance_id')
                ->orderBy('c_scene_instance_id', 'desc')
                ->first();

            Log::debug('实验 username 和 c_config_id', [
                'experiment_id' => $experiment->c_experiment_id,
                'username' => $username,
                'c_config_id' => $experiment->c_config_id
            ]);

            $submissionHistory = [];
            if ($testUser && $testUser->c_scene_instance_id !== null) {
                $sceneInstanceId = $testUser->c_scene_instance_id;

                Log::debug('sceneInstance 数据', [
                    'experiment_id' => $experiment->c_experiment_id,
                    'scene_instance' => $sceneInstanceId
                ]);

                // 查询容器和虚拟机 ID
                $containerIds = SceneContainerInstanceModel::where('c_scene_instances_id', $sceneInstanceId)
                    ->pluck('c_container_id')
                    ->toArray();
                $vmIds = SceneVmInstanceModel::where('c_scene_instances_id', $sceneInstanceId)
                    ->pluck('c_vm_id')
                    ->toArray();

                Log::debug('容器和虚拟机 ID', [
                    'username' => $username,
                    'scene_instance_id' => $sceneInstanceId,
                    'container_ids' => $containerIds,
                    'vm_ids' => $vmIds
                ]);

                // 查询 c_flag_submissions，添加 c_scene_instances_id 条件
                $history = FlagSubmissionModel::select([
                        'c_submission_id',
                        'c_username',
                        'c_submitted_at',
                        'c_is_correct',
                        'c_attempt_count',
                        'c_points_earned',
                        'c_container_instance_id',
                        'c_vm_instance_id',
                        'c_submitted_flag',
                        'c_scene_instances_id'
                    ])
                    ->with([
                        'containerInstance:c_container_id,c_container_name,c_ip,c_scene_instances_id',
                        'vmInstance:c_vm_id,c_vm_name,c_ip,c_scene_instances_id'
                    ])
                    ->where('c_username', $username)
                    ->where('c_scene_instances_id', $sceneInstanceId)
                    ->where(function ($q) use ($containerIds, $vmIds) {
                        $q->whereIn('c_container_instance_id', $containerIds)
                          ->orWhereIn('c_vm_instance_id', $vmIds)
                          ->orWhereNull('c_container_instance_id')
                          ->orWhereNull('c_vm_instance_id');
                    })
                    ->orderBy('c_submitted_at', 'desc')
                    ->get()
                    ->map(function ($record) {
                        $instanceId = isset($record->c_container_instance_id) ? $record->c_container_instance_id : (isset($record->c_vm_instance_id) ? $record->c_vm_instance_id : '空');
                        $instanceType = isset($record->c_container_instance_id) ? 'docker' : (isset($record->c_vm_instance_id) ? 'vm' : '空');
                        $instanceIp = '空';
                        $instanceName = '空';
                        $sceneId = $record->c_scene_instances_id;

                        if ($record->containerInstance) {
                            $instanceIp = isset($record->containerInstance->c_ip) ? $record->containerInstance->c_ip : '空';
                            $instanceName = isset($record->containerInstance->c_container_name) ? $record->containerInstance->c_container_name : '空';
                            Log::info('Container Instance Debug', [
                                'container_id' => $record->c_container_instance_id,
                                'container_data' => $record->containerInstance ? $record->containerInstance->toArray() : 'null',
                                'extracted_ip' => $instanceIp,
                                'extracted_name' => $instanceName
                            ]);
                        } elseif ($record->vmInstance) {
                            $instanceIp = isset($record->vmInstance->c_ip) ? $record->vmInstance->c_ip : '空';
                            $instanceName = isset($record->vmInstance->c_vm_name) ? $record->vmInstance->c_vm_name : '空';
                            Log::info('VM Instance Debug', [
                                'vm_id' => $record->c_vm_instance_id,
                                'vm_data' => $record->vmInstance ? $record->vmInstance->toArray() : 'null',
                                'extracted_ip' => $instanceIp,
                                'extracted_name' => $instanceName
                            ]);
                        }

                        return [
                            'c_submission_id' => $record->c_submission_id,
                            'c_username' => $record->c_username,
                            'c_submitted_at' => $record->c_submitted_at,
                            'c_is_correct' => isset($record->c_is_correct) ? $record->c_is_correct : false,
                            'c_attempt_count' => isset($record->c_attempt_count) ? $record->c_attempt_count : 0,
                            'c_points_earned' => isset($record->c_points_earned) ? $record->c_points_earned : 0,
                            'c_submitted_flag' => isset($record->c_submitted_flag) ? $record->c_submitted_flag : '',
                            'instance_id' => $instanceId,
                            'instance_ip' => $instanceIp,
                            'instance_name' => $instanceName,
                            'instance_type' => $instanceType,
                            'c_scene_instances_id' => $sceneId,
                        ];
                    })->toArray();

                Log::debug('Flag 提交历史', [
                    'username' => $username,
                    'scene_instance_id' => $sceneInstanceId,
                    'history' => $history
                ]);

                if (!empty($history)) {
                    $submissionHistory[] = [
                        'username' => $username,
                        'history' => $history
                    ];
                }
            } else {
                Log::warning('未找到用户场景实例或 c_scene_instance_id 为空', [
                    'username' => $username,
                    'experiment_id' => $experiment->c_experiment_id,
                    'test_user_exists' => $testUser ? true : false,
                    'c_scene_instance_id' => $testUser ? $testUser->c_scene_instance_id : null
                ]);
            }

            $result['experiments'][] = [
                'test_id' => $experiment->c_experiment_id,
                'test_name' => $experiment->c_experiment_name,
                'category' => '实验',
                'history' => $submissionHistory
            ];
        }

        return $this->_response(GlobalResponse::$HTTP_STATUS_OK_CODE, '成绩获取成功', $result);

    } catch (ValidationException $e) {
        Log::warning('参数验证失败', ['error' => $e->getMessage(), 'course_id' => $courseId, 'username' => $username, 'test_id' => $testId]);
        return $this->_response(GlobalResponse::$HTTP_REQUEST_ERROR_CODE, $e->getMessage());
    } catch (\Exception $e) {
        Log::error('获取成绩失败', [
            'error' => $e->getMessage(),
            'trace' => $e->getTraceAsString(),
            'course_id' => $courseId,
            'username' => $username,
            'test_id' => $testId
        ]);
        return $this->_response(GlobalResponse::$HTTP_SERVER_ERROR_CODE, '获取成绩失败：' . $e->getMessage());
    }
}

// 修复后的代码
public function _response($code = '', $message = 0, $data = [])
    {
        // 保持原有的方法逻辑不变
        return response()->json([
            'code' => $code,
            'message' => $message,
            'data' => $data
        ])->header('X-Content-Type-Options', 'nosniff');
    }

 /**
     * 根据测试ID获取场景信息
     * Notes: 通过测试ID查询c_course_experiments表获取c_config_id，再查询c_scene_configs表获取场景信息
     * User: assistant
     * DateTime: 2025/9/20
     * @param string $testId
     * @return JsonResponse
     */
    public function getScenarioByTestId($testId)
    {
        try {
            // 验证测试ID
            if (empty($testId) || !is_string($testId)) {
                Log::error('测试ID无效', ['test_id' => $testId]);
                return response()->json([
                    'code' => 400,
                    'message' => '测试ID无效',
                    'data' => null
                ], 400);
            }

            // 查询 c_course_experiments 表获取 c_config_id
            $experiment = DB::table('c_course_experiments')
                ->where('c_experiment_id', $testId)
                ->first();

            if (!$experiment) {
                Log::error('未找到对应的测试信息', ['test_id' => $testId]);
                return response()->json([
                    'code' => 400,
                    'message' => '未找到对应的测试信息',
                    'data' => null
                ], 400);
            }

            // 获取 c_config_id
            $configId = $experiment->c_config_id;
            if (!$configId) {
                Log::error('测试未关联场景ID', ['test_id' => $testId]);
                return response()->json([
                    'code' => 400,
                    'message' => '未找到关联的场景ID',
                    'data' => null
                ], 400);
            }

            // 查询 c_scene_configs 表获取场景信息
            $scenario = DB::table('c_scene_configs')
                ->where('c_config_id', $configId)
                ->first();

            if (!$scenario) {
                Log::error('场景配置不存在', ['config_id' => $configId, 'test_id' => $testId]);
                return response()->json([
                    'code' => 400,
                    'message' => "场景配置不存在：{$configId}",
                    'data' => null
                ], 400);
            }

            // 解析场景配置
            $sceneData = json_decode($scenario->c_scene, true) ?? [];
            $nodeCount = isset($sceneData['nodes']) ? count($sceneData['nodes']) : 0;

            // 确保 name 字段不为空
            $scenarioName = $scenario->c_name ?? '未知场景';
            if (empty($scenario->c_name)) {
                Log::warning('场景名称为空，设置默认值', ['config_id' => $configId]);
            }

            // 格式化返回数据，与 index 方法一致
            $scenarioData = [
                'id' => $scenario->c_config_id,
                'name' => $scenarioName,
                'description' => $scenario->c_description ?? '无描述',
                'uploadDate' => $scenario->c_created_at ? date('c', strtotime($scenario->c_created_at)) : null,
                'nodeCount' => $nodeCount,
                'topology_json' => $sceneData
            ];

            // 记录返回数据
            Log::info('获取场景信息成功', [
                'test_id' => $testId,
                'config_id' => $configId,
                'scenario_name' => $scenarioName,
                'response_data' => $scenarioData
            ]);

            return response()->json([
                'code' => 200,
                'message' => '场景信息获取成功',
                'data' => $scenarioData
            ], 200);
        } catch (\Exception $e) {
            Log::error('获取场景信息失败', [
                'test_id' => $testId,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            return response()->json([
                'code' => 500,
                'message' => '获取场景信息失败：' . $e->getMessage(),
                'data' => null
            ], 500);
        }
    }

 private CommandLineService $cliService;
    private array $vmImageOsMap = []; // 用于存储镜像操作系统映射

    public function __construct(CommandLineService $cliService, Request $req)
    {
        // 加载父类的构造方法
        parent::__construct($req);
        $this->cliService = $cliService;
        // 在构造函数中加载并解析JSON映射文件
        $this->loadVmImageOsMap();
    }

    /**
     * 加载 vmImageOverrides.json 文件内容到类属性
     */
    private function loadVmImageOsMap(): void
    {
        try {
            // ★★★ 核心修复：修正文件路径 ★★★
            // base_path() -> /var/www/nads/back
            // .. -> /var/www/nads
            // 最终路径 -> /var/www/nads/src/data/vmImageOverrides.json
            $path = base_path('../src/data/vmImageOverrides.json');

            Log::info("正在尝试从以下路径加载虚拟机镜像操作系统映射: {$path}");

            if (File::exists($path)) {
                $jsonContent = File::get($path);
                $this->vmImageOsMap = json_decode($jsonContent, true);
                Log::info('成功加载虚拟机镜像操作系统映射。');
                Log::debug('加载到的 vmImageOsMap 内容:', $this->vmImageOsMap);
            } else {
                Log::warning('虚拟机镜像操作系统映射文件 (vmImageOverrides.json) 不存在。', ['path' => $path]);
            }
        } catch (\Exception $e) {
            Log::error('加载虚拟机镜像操作系统映射失败: ' . $e->getMessage());
        }
    }


    /**
     * 检查系统CPU和内存资源是否在可接受的范围内。
     *
     * @return \Illuminate\Http\JsonResponse|null 如果资源超限则返回JSON响应，否则返回null。
     */
    private function checkSystemResources()
    {
        try {
            // 检查内存使用率
            $memCommand = "free | grep Mem | awk '{print $3/$2 * 100.0}'";
            $processMem = Process::fromShellCommandline($memCommand);
            $processMem->run();
            if (!$processMem->isSuccessful()) {
                throw new ProcessFailedException($processMem);
            }
            $memoryUsage = round((float) $processMem->getOutput(), 2);

            if ($memoryUsage > 85) {
                Log::warning("启动场景失败：内存使用率过高 ({$memoryUsage}%)");
                return response()->json(['message' => "启动失败：系统内存使用率 ({$memoryUsage}%) 超过 85% 的阈值。请联系管理员清理"], 503); // 503 Service Unavailable
            }

            // 检查CPU使用率
            $cpuCommand = "top -bn1 | grep 'Cpu(s)' | sed 's/.*, *\\([0-9.]*\\)%* id.*/\\1/' | awk '{print 100 - $1}'";
            $processCpu = Process::fromShellCommandline($cpuCommand);
            $processCpu->run();
            if (!$processCpu->isSuccessful()) {
                throw new ProcessFailedException($processCpu);
            }
            $cpuUsage = round((float) $processCpu->getOutput(), 2);

            if ($cpuUsage > 85) {
                Log::warning("启动场景失败：CPU使用率过高 ({$cpuUsage}%)");
                return response()->json(['message' => "启动失败：系统CPU使用率 ({$cpuUsage}%) 超过 85% 的阈值。请联系管理员清理"], 503);
            }

            Log::info("系统资源检查通过", ['cpu_usage' => $cpuUsage, 'memory_usage' => $memoryUsage]);
            return null; //一切正常

        } catch (\Exception $e) {
            Log::error("检查系统资源时发生错误: " . $e->getMessage());
            // 如果检查过程出错，为安全起见，阻止场景启动
            return response()->json(['message' => '检查系统资源时发生错误，无法启动场景。'], 500);
        }
    }


       /**
 * 接受指令启动一个演练场景.
 *
 * @param Request $request
 * @param SceneConfig $scenario
 * @return \Illuminate\Http\JsonResponse
 */
public function startDrill(Request $request, SceneConfig $scenario)
{
    // 在执行任何操作前，首先检查系统资源
    $resourceCheckResponse = $this->checkSystemResources();
    if ($resourceCheckResponse !== null) {
        return $resourceCheckResponse;
    }

    $validator = Validator::make($request->all(), [
        'username' => 'required|string|max:50',
        'test_id' => 'required|string|max:50'
    ]);
    if ($validator->fails()) {
        return response()->json(['message' => '请求参数验证失败', 'errors' => $validator->errors()], 422);
    }
    
    $userName = $request->input('username');
    $testId = $request->input('test_id');
    $topologyJson = $scenario->c_scene;

    $parsedTopology = TopologyParser::parse($topologyJson);
    $nodesById = collect($topologyJson['nodes'])->keyBy('id');

    $connections = &$parsedTopology['connections'];

    $vmsParsed = collect($parsedTopology['vms'])->keyBy('id');
    $containersParsed = collect($parsedTopology['containers'])->keyBy('id');
    $createdSwitchesInfo = [];
    $createdItemsInfo = [];
    $sceneInstance = null;

    try {
        $this->assignIpAddresses($connections);
    } catch (\Exception $e) {
        Log::error("IP地址自动分配失败: " . $e->getMessage());
        return response()->json(['message' => 'IP地址分配失败：' . $e->getMessage()], 500);
    }

    $containerIps = [];
    foreach ($connections as $conn) {
        if ($conn['source']['type'] === 'container' && !empty($conn['source']['ip'])) {
            $containerIps[$conn['source']['id']] = $conn['source']['ip'];
        }
        if ($conn['target']['type'] === 'container' && !empty($conn['target']['ip'])) {
            $containerIps[$conn['target']['id']] = $conn['target']['ip'];
        }
    }

    try {
        $sceneInstance = SceneInstance::create([
            'c_config_id'     => $scenario->c_config_id,
            'c_username'      => $userName,
            'c_status'        => 'CREATING',
            // 将场景模板 JSON 直接写入实例表的 c_scene_config
            'c_scene_config'  => $topologyJson,
            'c_hostname'      => SceneInstance::resolveHostname(),
        ]);
        Log::info("创建场景实例记录成功", ['instance_id' => $sceneInstance->c_scene_instances_id]);

        // 查询并更新 c_test_users 表
        $updated = \DB::table('c_test_users')
            ->where('c_test_id', $testId)
            ->where('c_username', $userName)
            ->update(['c_scene_instance_id' => $sceneInstance->c_scene_instances_id]);

        if ($updated) {
            Log::info("成功更新c_test_users表", [
                'test_id' => $testId,
                'username' => $userName,
                'scene_instance_id' => $sceneInstance->c_scene_instances_id
            ]);
        } else {
            Log::warning("未找到对应的c_test_users记录", [
                'test_id' => $testId,
                'username' => $userName
            ]);
        }

        $instanceShortId = substr(str_replace('-', '', $sceneInstance->c_scene_instances_id), -8);
        $switchIdSuffix = substr(str_replace('-', '', $sceneInstance->c_scene_instances_id), -5);

        foreach ($parsedTopology['switches'] as $switchData) {
            $switchName = str_replace([' '], '_', $switchData['label']) . '_' . $switchIdSuffix;
            $this->cliService->createSwitch($switchName, null, true);
            $this->cliService->connectSwitchToSwitch($switchName, 'ovs-switch');
            $createdSwitchesInfo[$switchData['id']] = ['actual_name' => $switchName, 'label' => $switchData['label']];
            SceneSwitchInstance::create([
                'c_switch_name' => $switchName, 'c_scene_instances_id' => $sceneInstance->c_scene_instances_id,
            ]);
        }

        foreach ($parsedTopology['containers'] as $containerData) {
             $containerName = str_replace([' '], '_', $containerData['label']) . '_' . $instanceShortId;
             $options = [
                'image' => $containerData['image'],
                'name'  => $containerName,
                'ports' => $containerData['portMappings'],
                'env'   => $containerData['env'],
                'scene_instance_id' => $sceneInstance->c_scene_instances_id,
             ];

            $flagUuid = null;
            if ($containerData['isTarget']) {
                $flagUuid = Str::uuid()->toString();
                $options['env'][] = ['key' => 'FLAG', 'value' => $flagUuid];
            }

             $containerId = $this->cliService->createContainer($options);
             $containerIp = $containerIps[$containerData['id']] ?? null;
             SceneContainerInstance::create([
                 'c_container_id' => $containerId,
                 'c_scene_instances_id' => $sceneInstance->c_scene_instances_id,
                 'c_flag' => $flagUuid,
                 'c_ip' => $containerIp,
                 'c_container_name' => $containerName,
             ]);
             $createdItemsInfo[$containerData['id']] = [
                 'id' => $containerId, 'actual_name' => $containerName, 'type' => 'container'
             ];
        }

        Log::info("================== 开始创建虚拟机并建立连接 ==================");

        $baseDir = $this->_get_global_directory();
        $imageDir = $baseDir . '/virsh/images';
        $instanceBaseDir = $baseDir . '/virsh/instances/' . $sceneInstance->c_scene_instances_id;

        foreach ($connections as $conn) {
            $itemNode = null; $switchNode = null; $ip = null;

            if ($conn['source']['type'] === 'virtual_machine' && $conn['target']['type'] === 'switch') {
                $itemNode = $nodesById[$conn['source']['id']];
                $switchNode = $nodesById[$conn['target']['id']];
                $ip = $conn['source']['ip'];
            } elseif ($conn['target']['type'] === 'virtual_machine' && $conn['source']['type'] === 'switch') {
                $itemNode = $nodesById[$conn['target']['id']];
                $switchNode = $nodesById[$conn['source']['id']];
                $ip = $conn['target']['ip'];
            }

            if (!$itemNode || !$switchNode) continue;

            $parsedVmNode = $vmsParsed[$itemNode['id']];
            $correctImageName = $parsedVmNode['image'];

            if (empty($correctImageName) || $correctImageName === 'vm-qemu:latest') {
                $correctImageName = 'v_att_tcpScanning';
                Log::info("节点 {$itemNode['label']} 未指定镜像或镜像无效, 将使用默认镜像: {$correctImageName}");
            }

            $imageFileName = Str::endsWith($correctImageName, '.qcow2') ? $correctImageName : $correctImageName . '.qcow2';

            $osData = $this->vmImageOsMap[$imageFileName] ?? null;
            $osType = strtolower($osData['osType'] ?? 'ubuntu'); // 默认为ubuntu
            Log::info("正在为镜像 '{$imageFileName}' 查找操作系统类型", [
                'found_data' => $osData,
                'determined_os_type' => $osType
            ]);

            $vmName = str_replace([' '], '_', $itemNode['label']) . '_' . $instanceShortId;

            $flagUuid = null;
            if ($parsedVmNode['isTarget'] ?? false) {
                $flagUuid = Str::uuid()->toString();
            }

            $vmInstance = SceneVmInstance::create([
                'c_vm_name'            => $vmName,
                'c_scene_instances_id' => $sceneInstance->c_scene_instances_id,
                'c_ip'                 => $ip,
                'c_flag'               => $flagUuid,
            ]);
            $vmDbId = $vmInstance->c_vm_id;
            Log::info("VM 记录已创建，ID: {$vmDbId}", ['name' => $vmName]);

            $actualSwitchName = $createdSwitchesInfo[$switchNode['id']]['actual_name'];

            if ($osType === 'win7') {
                $this->cliService->createVmWin7([
                    'id'                  => $vmDbId,
                    'vm_name'             => $vmName,
                    'image'               => $correctImageName,
                    'ip'                  => $ip,
                    'scene_instance_id'   => $sceneInstance->c_scene_instances_id,
                    'flag'                => $flagUuid ?? 'NULL',
                    'switch_name'         => $actualSwitchName,
                    'image_dir'           => $imageDir,
                    'instance_base_dir'   => $instanceBaseDir,
                ]);
            } elseif ($osType === 'win7_1') {
                $this->cliService->createVmWin7_1([
                    'id'                  => $vmDbId,
                    'vm_name'             => $vmName,
                    'image'               => $correctImageName,
                    'switch_name'         => $actualSwitchName,
                    'image_dir'           => $imageDir,
                    'instance_base_dir'   => $instanceBaseDir,
                ]);
            } elseif ($osType === 'win2003') {
                $this->cliService->createVmWin2003([
                    'id'                  => $vmDbId,
                    'vm_name'             => $vmName,
                    'image'               => $correctImageName,
                    'switch_name'         => $actualSwitchName,
                    'image_dir'           => $imageDir,
                    'instance_base_dir'   => $instanceBaseDir,
                ]);
            } elseif ($osType === 'win10') {
                $this->cliService->createVmWin10([
                    'id'                  => $vmDbId,
                    'vm_name'             => $vmName,
                    'image'               => $correctImageName,
                    'switch_name'         => $actualSwitchName,
                    'image_dir'           => $imageDir,
                    'instance_base_dir'   => $instanceBaseDir,
                ]);
            } elseif ($osType === 'kylin' || $osType === 'kylin10' || $osType === 'kylin_v10') {
                $this->cliService->createVmKylin([
                    'id'                  => $vmDbId,
                    'vm_name'             => $vmName,
                    'image'               => $correctImageName,
                    'switch_name'         => $actualSwitchName,
                    'image_dir'           => $imageDir,
                    'instance_base_dir'   => $instanceBaseDir,
                ]);
            } elseif ($osType === 'kali') {
                $this->cliService->createVmKali([
                    'id'                  => $vmDbId,
                    'vm_name'             => $vmName,
                    'image'               => $correctImageName,
                    'ip'                  => $ip,
                    'scene_instance_id'   => $sceneInstance->c_scene_instances_id,
                    'flag'                => $flagUuid ?? 'NULL',
                    'switch_name'         => $actualSwitchName,
                    'image_dir'           => $imageDir,
                    'instance_base_dir'   => $instanceBaseDir,
                ]);
            } else { // 默认为 ubuntu
                $this->cliService->createVm([
                    'id'                  => $vmDbId,
                    'vm_name'             => $vmName,
                    'image'               => $correctImageName,
                    'ip'                  => $ip,
                    'scene_instance_id'   => $sceneInstance->c_scene_instances_id,
                    'flag'                => $flagUuid ?? 'NULL',
                    'switch_name'         => $actualSwitchName,
                    'image_dir'           => $imageDir,
                    'instance_base_dir'   => $instanceBaseDir,
                ]);
            }

            $createdItemsInfo[$itemNode['id']] = [
                'id' => $vmDbId, 'actual_name' => $vmName, 'type' => 'virtual_machine'
            ];
        }

        Log::info("================== 开始建立剩余网络连接 ==================");
        foreach ($connections as $conn) {
            $source = $conn['source'];
            $target = $conn['target'];

            if ($source['type'] === 'switch' && $target['type'] === 'switch') {
                $this->cliService->connectSwitchToSwitch(
                    $createdSwitchesInfo[$source['id']]['actual_name'],
                    $createdSwitchesInfo[$target['id']]['actual_name']
                );
            }
            elseif (($source['type'] === 'container' && $target['type'] === 'switch') || ($source['type'] === 'switch' && $target['type'] === 'container')) {
                $containerNode = $source['type'] === 'container' ? $source : $target;
                $switchNode = $source['type'] === 'switch' ? $source : $target;

                $this->cliService->connectContainerToSwitch(
                    $createdSwitchesInfo[$switchNode['id']]['actual_name'],
                    $createdItemsInfo[$containerNode['id']]['actual_name'],
                    $containerNode['ip']
                );
            }
            elseif (($source['type'] === 'switch' && $target['type'] === 'nat_bridge') || ($source['type'] === 'nat_bridge' && $target['type'] === 'switch')) {
                $switchNode = $source['type'] === 'switch' ? $source : $target;
                $bridgeNode = $source['type'] === 'nat_bridge' ? $source : $target;

                $actualSwitchName = $createdSwitchesInfo[$switchNode['id']]['actual_name'];
                $bridgeName = $bridgeNode['label'];

                Log::info("正在连接 OVS 交换机 '{$actualSwitchName}' 到 Linux Bridge '{$bridgeName}");

                $this->cliService->connectSwitchToBr0($actualSwitchName, $bridgeName);
            }
        }
        //添加iptables转发
        if (!empty($parsedTopology['iptablesRules'])) {
            Log::info("================== Applying iptables rules ==================");
            $this->cliService->applyIptablesRules($parsedTopology['iptablesRules'], $createdItemsInfo, $connections);
        }
        // 配置网关IP和所有容器的路由
        $gatewayIp = '10.100.0.254/16'; // 定义一个固定的网关IP

        $containersToRoute = [];

        $switchesConnectedToBridge = [];
        foreach ($connections as $conn) {
            if ($conn['source']['type'] === 'nat_bridge' && $conn['target']['type'] === 'switch') {
                $switchesConnectedToBridge[$conn['target']['id']] = true;
            } elseif ($conn['target']['type'] === 'nat_bridge' && $conn['source']['type'] === 'switch') {
                $switchesConnectedToBridge[$conn['source']['id']] = true;
            }
        }

        if (!empty($switchesConnectedToBridge)) {
            foreach ($connections as $conn) {
                $containerNode = null;
                $switchNode = null;

                if ($conn['source']['type'] === 'container' && $conn['target']['type'] === 'switch') {
                    $containerNode = $conn['source'];
                    $switchNode = $conn['target'];
                } elseif ($conn['target']['type'] === 'container' && $conn['source']['type'] === 'switch') {
                    $containerNode = $conn['target'];
                    $switchNode = $conn['source'];
                }

                if ($containerNode && isset($switchesConnectedToBridge[$switchNode['id']])) {
                    $actualContainerName = $createdItemsInfo[$containerNode['id']]['actual_name'];
                    $containersToRoute[] = ['name' => $actualContainerName];
                }
            }
        }

        if (!empty($containersToRoute)) {
            $this->cliService->configureBridgeAndRoutes('br0', $gatewayIp, $containersToRoute);
            Log::info("================== 网关和路由配置完成 ==================");
        }
        $sceneInstance->c_status = 'RUNNING';
        $sceneInstance->save();
        return response()->json([
            'message' => '演练场景已成功启动！', 'scene_instance_id' => $sceneInstance->c_scene_instances_id,
            'created_items' => $createdItemsInfo, 'created_switches' => $createdSwitchesInfo,
        ]);

    } catch (\Exception $e) {
        if ($sceneInstance) {
            $sceneInstance->c_status = 'FAILED';
            $sceneInstance->save();
        }
        $errorMessage = $e->getMessage();
        Log::error("启动场景时发生严重错误: " . $errorMessage, ['trace' => $e->getTraceAsString()]);
        return response()->json(['message' => '场景启动失败'], 500);
    }
}

    private function assignIpAddresses(array &$connections): void
    {
        $vmIps = DB::table('c_scene_vm_instances')->whereNotNull('c_ip')->pluck('c_ip');
        $containerIps = DB::table('c_scene_container_instances')->whereNotNull('c_ip')->pluck('c_ip');

        $existingIps = $vmIps->merge($containerIps)->map(function ($ip) {
            return explode('/', $ip)[0];
        })->unique()->flip();

        Log::info('Found existing IPs in DB', $existingIps->keys()->toArray());

        $octet3 = 0;
        $octet4 = 0;

        $getNextIp = function() use (&$octet3, &$octet4, &$existingIps) {
            do {
                if ($octet4 >= 254) {
                    $octet4 = 1;
                    $octet3++;
                } else {
                    $octet4++;
                }

                if ($octet3 >= 255) {
                    throw new \Exception("IP地址池 10.100.0.0/16 已耗尽。");
                }

                $newIp = "10.100.{$octet3}.{$octet4}";

            } while (isset($existingIps[$newIp]));

            $existingIps[$newIp] = true;

            Log::info("Assigned new IP: {$newIp}");
            return $newIp . "/16";
        };

        foreach ($connections as &$connection) {
            if ($connection['source']['type'] === 'nat_bridge' || $connection['target']['type'] === 'nat_bridge') {
                continue;
            }

            if (empty($connection['source']['ip'])) {
                $connection['source']['ip'] = $getNextIp();
            }
            if (empty($connection['target']['ip'])) {
                $connection['target']['ip'] = $getNextIp();
            }
        }
    }


  public function index(Request $request)
{
    try {
        $auth = $request->header("Authorization", null);
        $jwtRes = JWTControll::decodeJWT($auth);
        if ($jwtRes["err"] != null) {
            return response()->json([
                "code" => GlobalResponse::$HTTP_TOKEN_ERROR_CODE,
                "message" => GlobalResponse::$HTTP_TOKEN_ERROR_MES
            ]);
        }

        // 从 Request 对象获取用户信息
        $token_data = $jwtRes["data"];
        Log::info($token_data);
        if (!$token_data) {
            return response()->json([
                'code' => 401,
                'message' => '用户未认证或token无效',
                'data' => []
            ], 401);
        }

        $username = $token_data['id'];
        
        // 获取前端传入的测试id
        $testId = $request->input('test_id');
        if (!$testId) {
            return response()->json([
                'code' => 400,
                'message' => '缺少测试ID参数',
                'data' => []
            ], 400);
        }

        // 查询c_test_users表获取场景实例ID
        $testUser = \DB::table('c_test_users')
            ->where('c_test_id', $testId)
            ->where('c_username', $username)
            ->first();

        if (!$testUser) {
            return response()->json([
                'code' => 404,
                'message' => '未找到对应的测试用户记录',
                'data' => []
            ], 404);
        }

        if (!$testUser->c_scene_instance_id) {
            return response()->json([
                'code' => 404,
                'message' => '该测试用户未关联任何场景实例',
                'data' => []
            ], 404);
        }

        // 根据场景实例ID查询场景实例表
        $instance = SceneInstance::with('sceneConfig')
            ->where('c_scene_instances_id', $testUser->c_scene_instance_id)
            ->first();

        if (!$instance) {
            return response()->json([
                'code' => 404,
                'message' => '未找到对应的场景实例',
                'data' => []
            ], 404);
        }

        // 构建返回数据
        $data = [
            'instance_id'   => $instance->c_scene_instances_id,
            'scenario_name' => $instance->sceneConfig->c_name ?? '未知场景',
            'username'      => $instance->c_username,
            'runtime'       => $instance->c_runtime ? $instance->c_runtime->toIso8601String() : null,
            'status'        => $instance->c_status,
            'c_scene_config' => $instance->c_scene_config,
            'test_id'       => $testId // 同时返回测试ID
        ];

        // 返回干净的JSON响应
        return response()->json([
            'code' => 200,
            'message' => 'success',
            'data' => $data
        ]);

    } catch (\Exception $e) {
        \Log::error('获取场景实例列表错误: ' . $e->getMessage() . ' at ' . $e->getFile() . ':' . $e->getLine());
        
        return response()->json([
            'code' => 500,
            'message' => '服务器内部错误',
            'data' => []
        ], 500);
    }
}

}
