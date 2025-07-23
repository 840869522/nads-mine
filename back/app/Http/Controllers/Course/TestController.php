<?php


namespace App\Http\Controllers\Course;

use App\Models\Course\PaperRulesModel;
use App\Models\Course\PapersModel;
use App\Models\Course\QuestionsModel;
use App\Models\Course\TempUsersModel;

use App\Models\Course\QuestionsOptionsModel;
use App\Models\Course\TestsModel;
use App\Models\Course\TestUsersModel;
use Illuminate\Http\Request;
use App\Models\Course\CategoryModel;
use Illuminate\Http\JsonResponse;
use App\Http\Controllers\Controller;
use App\Utils\GlobalResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Illuminate\Support\Facades\Log;

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

                    $verify_options_only = $QuestionsOptionsMod->verify_c_id_only($v['key']);
                    if(!$verify_options_only){
                        return $this->_response(GlobalResponse::$HTTP_REQUEST_ERROR_CODE,"选项主键以存在");
                    }
                    if($v['option']==$c_answer){
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
                return $this->_response(GlobalResponse::$HTTP_DATABASE_ERROR_CODE,"主键已存在");
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

                        $verify_options_only = $QuestionsOptionsMod->verify_c_id_only($v['key'],$c_id);
                        if(!$verify_options_only){
                            return $this->_response(GlobalResponse::$HTTP_REQUEST_ERROR_CODE,"选项主键以存在");
                        }
                        if($type==1){
                            if($v['option']==$c_answer){
                                $verify_answer=1;
                            }
                        }else{
                            $answer = explode(';',$c_answer);
                            Log::info($answer);
                            Log::info($c_answer);
                            Log::info($v['option']);
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
                    Log::info([
                        $verify_answer,
                        $dx_zong_cnt,
                        $dx_cnt]
                    );
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
     * Notes:添加测试
     * User: zhangnan
     * DateTime: 2025/7/11 14:21
     * @param Request $request
     * @return JsonResponse
     */
    public function test_add(Request $request)
    {
        try {
            $c_name     = trim($request->input('name'));
            $c_description     = trim($request->input('description'));
            $c_paper_count     = trim($request->input('paper_count'));
            $c_start     = trim($request->input('start'));
            $c_end     = trim($request->input('end'));
            $c_course_id     = trim($request->input('course_id'));
            $validated_data = array(
                'name' => 'required|max:100',
                'description' => 'required',
                'paper_count' => 'required|integer|max:11',
                'start' => 'required|date_format:Y-m-d H:i:s|after:now|before:end',
                'end' => 'required|date_format:Y-m-d H:i:s|after:now',
                'course_id' => 'required|exists:c_courses,c_course_id',
            );
            $validated_msg = array(
                'name.required'=>"名称不能为空",
                'name.max'=>"名称字数超限",
                'description.required'=>"描述不能为空",
                'paper_count.required'=>"试卷数不能为空",
                'paper_count.integer'=>"试卷数数据格式不正确",
                'paper_count.max'=>"试卷数超限",
                'start.required'=>"测试开始时间不能为空",
                'start.date_format'=>"测试开始时间不格式不正确",
                'start.after'=>"测试开始时间不能小于当前日期",
                'start.before'=>"测试结束时间不能小于测试开始时间",
                'end.required'=>"测试结束时间不能为空",
                'end.date_format'=>"测试结束时间不格式不正确",
                'end.after'=>"测试结束时间不能小于当前日期",
                'course_id.required'=>"课程id不能为空",
                'course_id.exists'=>"课程id不存在",
            );
            $validatedData = $request->validate($validated_data, $validated_msg);

            $mod = new TestsModel();

            $res = $mod->create_test_info($c_name,$c_description,$c_paper_count,$c_start,$c_end,$c_course_id);
            if(!$res){
                return $this->_response(GlobalResponse::$HTTP_DATABASE_ERROR_CODE,"测试插入失败");
            }
            return $this->_response(GlobalResponse::$HTTP_STATUS_OK_CODE,GlobalResponse::HTTP_STATUS_OK_MES);

        } catch (ValidationException $e) {
            return $this->_response(GlobalResponse::$HTTP_REQUEST_ERROR_CODE,$e->getMessage());
        }
    }


    /**
     * Notes:修改测试
     * User: zhangnan
     * DateTime: 2025/7/11 16:14
     * @param Request $request
     * @return JsonResponse
     */
    public function test_update(Request $request)
    {
        try {
            $c_id     = trim($request->input('id'));
            $c_name     = trim($request->input('name'));
            $c_description     = trim($request->input('description'));
            $c_paper_count     = trim($request->input('paper_count'));
            $c_start     = trim($request->input('start'));
            $c_end     = trim($request->input('end'));
            $c_course_id     = trim($request->input('course_id'));
            $validated_data = array(
                'id' => 'required|string|exists:c_tests,c_id',
                'name' => 'required|max:100',
                'description' => 'required',
                'paper_count' => 'required|integer|max:11',
                'start' => 'required|date_format:Y-m-d H:i:s|after:now|before:end',
                'end' => 'required|date_format:Y-m-d H:i:s|after:now',
                'course_id' => 'required|exists:c_courses,c_course_id',
            );
            $validated_msg = array(
                'id.required'=>"id不能为空",
                'id.string'=>"id类型错误",
                'id.exists'=>"id不存在",
                'name.required'=>"名称不能为空",
                'name.max'=>"名称字数超限",
                'description.required'=>"描述不能为空",
                'paper_count.required'=>"试卷数不能为空",
                'paper_count.integer'=>"试卷数数据格式不正确",
                'paper_count.max'=>"试卷数超限",
                'start.required'=>"测试开始时间不能为空",
                'start.date_format'=>"测试开始时间不格式不正确",
                'start.after'=>"测试开始时间不能小于当前日期",
                'start.before'=>"测试结束时间不能小于测试开始时间",
                'end.required'=>"测试结束时间不能为空",
                'end.date_format'=>"测试结束时间不格式不正确",
                'end.after'=>"测试结束时间不能小于当前日期",
                'course_id.required'=>"课程id不能为空",
                'course_id.exists'=>"课程id不存在",
            );
            $validatedData = $request->validate($validated_data, $validated_msg);

            $mod = new TestsModel();
            $info = $mod->get_test_info($c_id);
            $res = $mod->update_test_info($info,$c_name,$c_description,$c_paper_count,$c_start,$c_end,$c_course_id);
            if(!$res){
                return $this->_response(GlobalResponse::$HTTP_DATABASE_ERROR_CODE,"测试修改失败");
            }
            return $this->_response(GlobalResponse::$HTTP_STATUS_OK_CODE,GlobalResponse::HTTP_STATUS_OK_MES);

        } catch (ValidationException $e) {
            return $this->_response(GlobalResponse::$HTTP_REQUEST_ERROR_CODE,$e->getMessage());
        }
    }


    /**
     * Notes:测试删除
     * User: zhangnan
     * DateTime: 2025/7/11 16:34
     * @param Request $request
     * @return JsonResponse
     */
    public function test_del(Request $request)
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
            $res = $mod->del_test_info($c_id);
            if(!$res){
                return $this->_response(GlobalResponse::$HTTP_DATABASE_ERROR_CODE,"测试删除失败");
            }
            return $this->_response(GlobalResponse::$HTTP_STATUS_OK_CODE,GlobalResponse::HTTP_STATUS_OK_MES);

        } catch (ValidationException $e) {
            return $this->_response(GlobalResponse::$HTTP_REQUEST_ERROR_CODE,$e->getMessage());
        }
    }


    /**
     * Notes:测试列表
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
        $res = $mod->get_test_list($pageSize,$page);

        return $this->_response(GlobalResponse::$HTTP_STATUS_OK_CODE,GlobalResponse::HTTP_STATUS_OK_MES,$res);
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
     * Notes:添加组题规则
     * User: zhangnan
     * DateTime: 2025/7/17 13:39
     * @param Request $request
     * @return JsonResponse
     */
    public function paper_rules_add(Request $request)
    {

        try {
            $c_test_id     = trim($request->input('test_id'));
            $single_choice     = $request->input('single_choice');//单选
            $multiple_choice     = $request->input('multiple_choice');//多选
            $true_or_false     = $request->input('true_or_false');//判断
            $subjective     = $request->input('subjective');//主观
            $validated_data = array(
                'test_id' => 'required|max:50|string|exists:c_tests,c_id|unique:c_paper_rules,c_test_id',
            );
            $validated_msg = array(
                'test_id.required'=>"测试主键不能为空",
                'test_id.max'=>"测试主键字段超限",
                'test_id.exists'=>"测试主键不存在",
                'test_id.string'=>"测试主键类型错误",
                'test_id.unique'=>"测试已存在组卷规则",
            );

            $verify_list = [];
            if(!empty($single_choice)){
                $verify_list[] = array(
                    'name'=>"单选题",
                    'field'=>"single_choice",
                    'type'=>1,
                    'data'=>$single_choice
                );
            }
            if(!empty($multiple_choice)){
                $verify_list[] = array(
                    'name'=>"多选题",
                    'field'=>"multiple_choice",
                    'type'=>2,
                    'data'=>$multiple_choice
                );
            }
            if(!empty($true_or_false)){
                $verify_list[] = array(
                    'name'=>"判断题",
                    'field'=>"true_or_false",
                    'type'=>3,
                    'data'=>$true_or_false
                );
            }
            if(!empty($subjective)){
                $verify_list[] = array(
                    'name'=>"主观题",
                    'field'=>"subjective",
                    'type'=>4,
                    'data'=>$subjective
                );
            }

            if(empty($verify_list)){
                return $this->_response(GlobalResponse::$HTTP_REQUEST_ERROR_CODE,"未获取到组卷规则");
            }
            foreach($verify_list as $k=>$v){
                $validated_data[$v['field']]='array';
                $validated_data[$v['field'].'.key']='required|max:10';
                $validated_data[$v['field'].'.tag']='required|max:50';
                $validated_data[$v['field'].'.count']='required|int';
                $validated_data[$v['field'].'.score']='required|int';
                $validated_msg[$v['field'].'.array']=$v['name'].'数据格式错误';
                $validated_msg[$v['field'].'.key.required']=$v['name'].'组卷规则主键不能为空';
                $validated_msg[$v['field'].'.key.max']=$v['name'].'组卷规则主键超限';
                $validated_msg[$v['field'].'.tag.required']=$v['name'].'组卷规则试题标签不能为空';
                $validated_msg[$v['field'].'.tag.max']=$v['name'].'组卷规则试题标签超限';
                $validated_msg[$v['field'].'.count.required']=$v['name'].'组卷规则试题数量不能为空';
                $validated_msg[$v['field'].'.count.int']=$v['name'].'组卷规则试题数量格式不正确';
                $validated_msg[$v['field'].'.score.required']=$v['name'].'组卷规则分数不能为空';
                $validated_msg[$v['field'].'.score.int']=$v['name'].'组卷规则分数格式不正确';
            }
            $validatedData = $request->validate($validated_data, $validated_msg);
            $mod = new PaperRulesModel();
            $question_mod = new QuestionsModel();
            $res_data = [];
            $verify_key = [];
            $test_creation = array(
                '1'=>array(
                    'count'=>0,
                    'score'=>0,
                ),
                '2'=>array(
                    'count'=>0,
                    'score'=>0,
                ),
                '3'=>array(
                    'count'=>0,
                    'score'=>0,
                ),
                '4'=>array(
                    'count'=>0,
                    'score'=>0,
                )
            );
            //开始组题，校验
            foreach($verify_list as $k=>$v){
                $verify_c_id = $mod->verify_paper_rules_c_id($v['data']['key']);
                if(!$verify_c_id){
                    return $this->_response(GlobalResponse::$HTTP_REQUEST_ERROR_CODE,$v['name']."主键以存在！");
                }
                if(in_array($v['data']['key'],$verify_key)){
                    return $this->_response(GlobalResponse::$HTTP_REQUEST_ERROR_CODE,$v['name']."组卷规则主键重复！");
                }
                $cnt = $question_mod->get_question_cnt($v['type']);
                if($cnt<$v['data']['count']){
                    return $this->_response(GlobalResponse::$HTTP_REQUEST_ERROR_CODE,$v['name']."题库题目不足，请更新题库后重试！");
                }
                $v['data']['type'] = $v['type'];
                $res_data[] = $v['data'];
                $verify_key[] = $v['data']['key'];
                $test_creation[$v['type']]['count'] = $v['data']['count'];
                $test_creation[$v['type']]['score'] = $v['data']['score'];
            }

            //自动组题
            $test_mod = new TestsModel();
            $test_info = $test_mod->get_test_info($c_test_id);
            $c_paper_count = $test_info->c_paper_count;
            $qusetion_list = $this->automatic_question_grouping($c_paper_count,$test_creation);

            $res = $mod->create_paper_rules_info($c_test_id,$res_data,$qusetion_list);
            if(!$res){
                return $this->_response(GlobalResponse::$HTTP_DATABASE_ERROR_CODE,"组题规则添加失败");
            }
            return $this->_response(GlobalResponse::$HTTP_STATUS_OK_CODE,GlobalResponse::HTTP_STATUS_OK_MES);
        } catch (ValidationException $e) {
            return $this->_response(GlobalResponse::$HTTP_REQUEST_ERROR_CODE,$e->getMessage());
        }
    }

    /**
     * 修改组卷规则
     * Notes:
     * User: zhangnan
     * DateTime: 2025/7/17 15:35
     * @param Request $request
     * @return JsonResponse
     */
    public function paper_rules_update(Request $request)
    {
        try {
            $c_test_id     = trim($request->input('test_id'));
            $single_choice     = $request->input('single_choice');//单选
            $multiple_choice     = $request->input('multiple_choice');//多选
            $true_or_false     = $request->input('true_or_false');//判断
            $subjective     = $request->input('subjective');//主观
            $validated_data = array(
                'test_id' => 'required|max:50|string|exists:c_tests,c_id|exists:c_paper_rules,c_test_id',
            );
            $validated_msg = array(
                'test_id.required'=>"测试主键不能为空",
                'test_id.max'=>"测试主键字段超限",
                'test_id.exists'=>"测试主键不存在",
                'test_id.exists_1'=>"不存在此测试的组卷规则",
                'test_id.string'=>"测试主键类型错误",
            );

            $verify_list = [];
            if(!empty($single_choice)){
                $verify_list[] = array(
                    'name'=>"单选题",
                    'field'=>"single_choice",
                    'type'=>1,
                    'data'=>$single_choice
                );
            }
            if(!empty($multiple_choice)){
                $verify_list[] = array(
                    'name'=>"多选题",
                    'field'=>"multiple_choice",
                    'type'=>2,
                    'data'=>$multiple_choice
                );
            }
            if(!empty($true_or_false)){
                $verify_list[] = array(
                    'name'=>"判断题",
                    'field'=>"true_or_false",
                    'type'=>3,
                    'data'=>$true_or_false
                );
            }
            if(!empty($subjective)){
                $verify_list[] = array(
                    'name'=>"主观题",
                    'field'=>"subjective",
                    'type'=>4,
                    'data'=>$subjective
                );
            }

            if(empty($verify_list)){
                return $this->_response(GlobalResponse::$HTTP_REQUEST_ERROR_CODE,"未获取到组卷规则");
            }
            foreach($verify_list as $k=>$v){
                $validated_data[$v['field']]='array';
                $validated_data[$v['field'].'.key']='required|max:10';
                $validated_data[$v['field'].'.tag']='required|max:50';
                $validated_data[$v['field'].'.count']='required|int';
                $validated_data[$v['field'].'.score']='required|int';
                $validated_msg[$v['field'].'.array']=$v['name'].'数据格式错误';
                $validated_msg[$v['field'].'.key.required']=$v['name'].'组卷规则主键不能为空';
                $validated_msg[$v['field'].'.key.max']=$v['name'].'组卷规则主键超限';
                $validated_msg[$v['field'].'.tag.required']=$v['name'].'组卷规则试题标签不能为空';
                $validated_msg[$v['field'].'.tag.max']=$v['name'].'组卷规则试题标签超限';
                $validated_msg[$v['field'].'.count.required']=$v['name'].'组卷规则试题数量不能为空';
                $validated_msg[$v['field'].'.count.int']=$v['name'].'组卷规则试题数量格式不正确';
                $validated_msg[$v['field'].'.score.required']=$v['name'].'组卷规则分数不能为空';
                $validated_msg[$v['field'].'.score.int']=$v['name'].'组卷规则分数格式不正确';
            }
            $validatedData = $request->validate($validated_data, $validated_msg);
            $mod = new PaperRulesModel();
            $question_mod = new QuestionsModel();
            $res_data = [];
            $verify_key = [];
            $test_creation = array(
                '1'=>array(
                    'count'=>0,
                    'score'=>0,
                ),
                '2'=>array(
                    'count'=>0,
                    'score'=>0,
                ),
                '3'=>array(
                    'count'=>0,
                    'score'=>0,
                ),
                '4'=>array(
                    'count'=>0,
                    'score'=>0,
                )
            );
            //开始组题，校验
            foreach($verify_list as $k=>$v){
                $verify_c_id = $mod->verify_paper_rules_c_id($v['data']['key'],$c_test_id);
                if(!$verify_c_id){
                    return $this->_response(GlobalResponse::$HTTP_REQUEST_ERROR_CODE,$v['name']."主键以存在！");
                }
                if(in_array($v['data']['key'],$verify_key)){
                    return $this->_response(GlobalResponse::$HTTP_REQUEST_ERROR_CODE,$v['name']."组卷规则主键重复！");
                }
                $cnt = $question_mod->get_question_cnt($v['type']);
                if($cnt<$v['data']['count']){
                    return $this->_response(GlobalResponse::$HTTP_REQUEST_ERROR_CODE,$v['name']."题库题目不足，请更新题库后重试！");
                }
                $v['data']['type'] = $v['type'];
                $res_data[] = $v['data'];
                $verify_key[] = $v['data']['key'];
                $test_creation[$v['type']]['count'] = $v['data']['count'];
                $test_creation[$v['type']]['score'] = $v['data']['score'];
            }
            //自动组题
            $test_mod = new TestsModel();
            $test_info = $test_mod->get_test_info($c_test_id);
            $c_paper_count = $test_info->c_paper_count;
            $qusetion_list = $this->automatic_question_grouping($c_paper_count,$test_creation);

            $res = $mod->update_paper_rules_info($c_test_id,$res_data,$qusetion_list);
            if(!$res){
                return $this->_response(GlobalResponse::$HTTP_DATABASE_ERROR_CODE,"组题规则修改失败");
            }
            return $this->_response(GlobalResponse::$HTTP_STATUS_OK_CODE,GlobalResponse::HTTP_STATUS_OK_MES);
        } catch (ValidationException $e) {
            return $this->_response(GlobalResponse::$HTTP_REQUEST_ERROR_CODE,$e->getMessage());
        }
    }

    /**
     * Notes:删除组卷规则
     * User: zhangnan
     * DateTime: 2025/7/17 15:36
     * @param Request $request
     */
    public function paper_rules_del(Request $request)
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
            $res = $mod->del_paper_rules_by_test_id($c_test_id);
            if(!$res){
                return $this->_response(GlobalResponse::$HTTP_DATABASE_ERROR_CODE,"组题规则删除失败");
            }
            return $this->_response(GlobalResponse::$HTTP_STATUS_OK_CODE,GlobalResponse::HTTP_STATUS_OK_MES);
        } catch (ValidationException $e) {
            return $this->_response(GlobalResponse::$HTTP_REQUEST_ERROR_CODE,$e->getMessage());
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
     * Notes:自动组卷
     * User: zhangnan
     * DateTime: 2025/7/17 15:13
     * @param $paper_count //试卷数
     * @param $single_choice //单选题数
     * @param $multiple_choice //多选题数
     * @param $true_or_false //判断题数
     * @param $subjective //主观题数
     */
    public function automatic_question_grouping($paper_count=0,$test_creation=[])
    {
        $question_mod = new QuestionsModel();
        $question_list = $question_mod->get_question_all();
        $single_choice = [];
        $multiple_choice = [];
        $true_or_false = [];
        $subjective = [];
        foreach($question_list as $k=>$v){
            $single_choice[$v['c_type']][$v['c_id']] = $v;
        }
        $res = [];
        for($i=0;$i<$paper_count;$i++){
            $selected_data = array(
                '1'=>[],
                '2'=>[],
                '3'=>[],
                '4'=>[],
            );
            $question_data = [];
            $answer_data = [];
            foreach($test_creation as $k=>$v){
                for($j=0;$j<$v['count'];$j++){
                    if(isset($question_data[$k])){
                        $question_data[$k] = array(
                            'type'=>$k,
                            'score'=>$v['score'],
                            'data'=>[],
                        );
                    }
                    if(isset($answer_data[$k])){
                        $answer_data[$k] = array(
                            'type'=>$k,
                            'data'=>[],
                        );
                    }
                    $extract_questions_res = $this->extract_questions($single_choice[$k],$selected_data[$k]);
                    $selected_data[$k][]=$extract_questions_res['c_id'];
                    $question_data[$k]['data'] = array(
                        'question_id'=>$extract_questions_res['c_id'],
                        'question'=>$extract_questions_res['c_question'],
                    );
                    if($k==4){
                        $answer_data[$k]['data'] = array(
                            'question_id'=>$extract_questions_res['c_id'],
                            'answer'=>"*",
                        );
                    }else{
                        $answer_data[$k]['data'] = array(
                            'question_id'=>$extract_questions_res['c_id'],
                            'answer'=>$extract_questions_res['c_answer']
                        );
                    }
                }
            }
            $res[] = array(
                'question'=>array_values($question_data),
                'answer'=>array_values($answer_data),
            );
        }
        return $res;
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
     * Notes:通过测试id获取试卷
     * User: zhangnan
     * DateTime: 2025/7/21 18:48
     * @param Request $request
     * @return JsonResponse
     */
    public function get_papers(Request $request)
    {
        try {
            $test_id     = trim($request->input('test_id'));
            $validated_data = array(
                'test_id' => 'required|string|exists:c_tests,c_id',
            );
            $validated_msg = array(
                'test_id.required'=>"测试不能为空",
                'test_id.string'=>"测试id类型错误",
                'test_id.exists'=>"测试id不存在",
            );
            $validatedData = $request->validate($validated_data, $validated_msg);
            $mod = new PapersModel();
            $info = $mod->get_paper_list($test_id);
            if(!$info){
                return $this->_response(GlobalResponse::$HTTP_REQUEST_ERROR_CODE,"该测试下没有试卷！");
            }
            return $this->_response(GlobalResponse::$HTTP_STATUS_OK_CODE,GlobalResponse::HTTP_STATUS_OK_MES,$info);

        } catch (ValidationException $e) {
            return $this->_response(GlobalResponse::$HTTP_REQUEST_ERROR_CODE,$e->getMessage());
        }
    }


    /**
     * Notes:试卷修改(未完成)
     * User: zhangnan
     * DateTime: 2025/7/22 15:22
     * @param Request $request
     * @return JsonResponse|void
     */
    public function update_papers(Request $request)
    {
        $question_data = array(
            'question'=>array(
                array(
                    'type'=>1,
                    'score'=>0,
                    'data'=>array(
                        'question_id'=>1,
                        'question'=>1,
                    )
                )
            ),
            'answer'=>array(
                array(
                    'type'=>1,
                    'data'=>array(
                        'question_id'=>1,
                        'answer'=>1,
                    )
                )
            )
        );




        try {
            $papers_id     = trim($request->input('papers_id'));
            $validated_data = array(
                'papers_id' => 'required|string|exists:c_papers,c_id',
                'question_data' => 'required|array',
                'question_data.question' => 'required|array',
                'question_data.question.*.type' => 'required|in:1,2,3,4',
                'question_data.question.*.score' => 'required|integer',
                'question_data.question.*.data' => 'required|array',
                'question_data.question.*.data.*.question_id' => 'required',
                'question_data.question.*.data.*.question' => 'required',
                'question_data.answer' => 'required|array',
                'question_data.answer.*.type' => 'required|in:1,2,3,4',
                'question_data.answer.*.data' => 'required|array',
                'question_data.answer.*.data.*.question_id' => 'required',
                'question_data.answer.*.data.*.answer' => 'required',
            );
            $validated_msg = array(
                'papers_id.required'=>"测试不能为空",
                'papers_id.string'=>"测试id类型错误",
                'papers_id.exists'=>"测试id不存在",
                'question_data.required'=>"试卷数据不能为空",
                'question_data.array'=>"试卷数据格式不正确",
                'question_data.question.required'=>"试卷数据中问题组不能为空",
                'question_data.question.array'=>"试卷数据中问题组格式不正确",
                'question_data.answer.required'=>"试卷数据中答案组不能为空",
                'question_data.answer.array'=>"试卷数据中答案组格式不正确",
                'question_data.answer.*.type.required'=>"试卷数据中答案组题目类型不存在",
                'question_data.answer.*.type.in'=>"试卷数据中答案组题目类型错误",
                'question_data.answer.*.data.required'=>"试卷数据中答案组答案数据不存在",
                'question_data.answer.*.data.array'=>"试卷数据中答案组答案数据格式不正确",
                'question_data.answer.*.data.*.question_id.required'=>"试卷数据中答案组答案数据question_id不存在",
                'question_data.answer.*.data.*.answer.required'=>"试卷数据中答案组答案数据answer不存在",
                'question_data.question.*.type.required'=>"试卷数据中问题组题目类型不存在",
                'question_data.question.*.type.in'=>"试卷数据中问题组题目类型错误",
                'question_data.question.*.score.required'=>"试卷数据中问题组题目分值不存在",
                'question_data.question.*.score.integer'=>"试卷数据中问题组题目分值类型错误",
                'question_data.question.*.data.required'=>"试卷数据中问题组题目数据不存在",
                'question_data.question.*.data.array'=>"试卷数据中问题组题目数据格式错误",
                'question_data.question.*.data.*.question_id.required'=>"试卷数据中问题组题目数据中question_id不存在",
                'question_data.question.*.data.*.question.required'=>"试卷数据中问题组题目数据中question不存在",
            );
            $validatedData = $request->validate($validated_data, $validated_msg);
            $verify_data = array(
                '1'=>[],
                '2'=>[],
                '3'=>[],
                '4'=>[],
            );
            $type_dic = array(
                '1'=>'单选题',
                '2'=>'多选题',
                '3'=>'判断题',
                '4'=>'主观题',
            );
            $question_mod = new QuestionsModel();
            $question_dic = $question_mod->get_question_dic();
            foreach($question_data['question'] as $k=>$v){
                foreach($v['data'] as $k1=>$v1){
                    if(!isset($question_dic[$v['type']][$v1['question_id']])){
                        return $this->_response(GlobalResponse::$HTTP_REQUEST_ERROR_CODE,$v1['question_id']."该问题不存在！");
                    }
                    if(in_array($v1['question_id'],$verify_data[$v['type']])){
                        return $this->_response(GlobalResponse::$HTTP_REQUEST_ERROR_CODE,$type_dic[$v['type']]."问题存在重复！");
                    }
                    $question_info = $question_dic[$v['type']][$v1['question_id']];

                }
            }






            $mod = new PapersModel();
//            $info = $mod->get_paper_list($test_id);
//            if(!$info){
//                return $this->_response(GlobalResponse::$HTTP_REQUEST_ERROR_CODE,"该测试下没有试卷！");
//            }
//            return $this->_response(GlobalResponse::$HTTP_STATUS_OK_CODE,GlobalResponse::HTTP_STATUS_OK_MES,$info);

        } catch (ValidationException $e) {
            return $this->_response(GlobalResponse::$HTTP_REQUEST_ERROR_CODE,$e->getMessage());
        }
    }


    /**
     * Notes:发卷
     * User: zhangnan
     * DateTime: 2025/7/22 15:37
     * @param Request $request
     * @return JsonResponse
     */
    public function send_papers(Request $request)
    {
        try {
            $test_id     = trim($request->input('test_id'));
            $c_username     = trim($request->input('username'));
            $validated_data = array(
                'test_id' => 'required|string|exists:c_tests,c_id',
                'username' => 'required|string|exists:c_users,c_username',
            );
            $validated_msg = array(
                'test_id.required'=>"测试不能为空",
                'test_id.string'=>"测试id类型错误",
                'test_id.exists'=>"测试id不存在",
                'username.exists'=>"用户不能为空",
                'username.string'=>"用户类型不正确",
                'username.exists'=>"用户不存在",
            );
            $validatedData = $request->validate($validated_data, $validated_msg);
            $tests_mod = new TestsModel();
            $test_info = $tests_mod->get_test_info($test_id);
            if(time()<strtotime($test_info['c_start'])){
                return $this->_response(GlobalResponse::$HTTP_REQUEST_ERROR_CODE,"未到测试开始时间！");
            }

            if(time()>strtotime($test_info['c_end'])){
                return $this->_response(GlobalResponse::$HTTP_REQUEST_ERROR_CODE,"测试时间已结束！");
            }

            $test_user_mod = new TestUsersModel();
            $paper_mod =  new PapersModel();
            $check_test_users = $test_user_mod->check_test_users_by_user_name($test_id,$c_username);
            if(!$check_test_users){
                $paper_id = $check_test_users->c_paper_id;
                $paper_info = $paper_mod->get_paper_info_by_id($paper_id);
                if(!$paper_info){
                    return $this->_response(GlobalResponse::$HTTP_REQUEST_ERROR_CODE,"试卷信息获取失败！");
                }
                return $this->_response(GlobalResponse::$HTTP_STATUS_OK_CODE,GlobalResponse::HTTP_STATUS_OK_MES,$paper_info->c_questions);
            }else{
                $papers_list = $paper_mod->get_paper_list($test_id);
                if(!$papers_list){
                    return $this->_response(GlobalResponse::$HTTP_REQUEST_ERROR_CODE,"该测试下无试卷！");
                }
                $papers_dic = [];
                foreach($papers_list as $k=>$v){
                    $papers_dic[$v['c_id']] = $v;
                }
                $papers_info = $this->distribute_test_papers($test_id,$papers_dic);
                $res = $test_user_mod->create_test_users_info($test_id,$c_username,$papers_info['c_id']);
                if(!$res){
                    return $this->_response(GlobalResponse::$HTTP_REQUEST_ERROR_CODE,"试卷派发失败！");
                }
                return $this->_response(GlobalResponse::$HTTP_STATUS_OK_CODE,GlobalResponse::HTTP_STATUS_OK_MES,$papers_info['c_questions']);

            }

            $mod = new PapersModel();
            $info = $mod->get_paper_list($test_id);
            if(!$info){
                return $this->_response(GlobalResponse::$HTTP_REQUEST_ERROR_CODE,"该测试下没有试卷！");
            }
            return $this->_response(GlobalResponse::$HTTP_STATUS_OK_CODE,GlobalResponse::HTTP_STATUS_OK_MES,$info);

        } catch (ValidationException $e) {
            return $this->_response(GlobalResponse::$HTTP_REQUEST_ERROR_CODE,$e->getMessage());
        }
    }


    /**
     * Notes:派发试卷
     * User: zhangnan
     * DateTime: 2025/7/22 17:35
     * @param $test_id
     * @param $papers_list
     */
    public function distribute_test_papers($test_id="",$papers_list="")
    {
        $papers_dic = [];
        foreach($papers_list as $k=>$v){
            $papers_dic[] = $v['c_id'];
        }
        $test_user_papers_dic = [];
        $test_users_mod =  new TestUsersModel();
        $test_users_list = $test_users_mod->get_test_user_by_test_id($test_id);
        foreach($test_users_list as $k=>$v){
            $test_user_papers_dic[] = $v['c_paper_id'];
        }
        $result = array_diff($test_user_papers_dic, $papers_dic);
        if(!empty($result)){
            $randomKey = array_rand($result);  // 随机获取一个键
            $randomValue = $result[$randomKey]; // 通过键获取对应的值
            return $papers_list[$randomValue];
        }else{
            $randomKey = array_rand($papers_dic);  // 随机获取一个键
            $randomValue = $papers_dic[$randomKey]; // 通过键获取对应的值
            return $papers_list[$randomValue];
        }
    }










}
