<?php


namespace App\Http\Controllers\Course;

use App\Models\Course\PaperRulesModel;
use App\Models\Course\QuestionsModel;
use App\Models\Course\TempUsersModel;

use App\Models\Course\QuestionsOptionsModel;
use App\Models\Course\TestsModel;
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
                        if($v['option']==$c_answer){
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
            }
            $res = $mod->create_paper_rules_info($c_test_id,$res_data);
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
            }
            $res = $mod->update_paper_rules_info($c_test_id,$res_data);
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
    public function automatic_question_grouping($paper_count=0,$single_choice=0,$multiple_choice=0,$true_or_false=0,$subjective=0)
    {

    }







}
