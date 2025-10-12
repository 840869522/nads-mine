<?php
namespace App\Http\Controllers\Experiment;

use App\Http\Controllers\Controller;
use App\Models\Experiment\ExperimentModel;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class ExperimentController extends Controller
{
   /**
 * Notes: 获取实验列表
 * User: zhangnan
 * DateTime: 2025/10/02
 * @return JsonResponse
 */
public function index(Request $request)
{
    try {
        // 获取请求参数
        $page = $request->get('page', 1);
        $pageSize = $request->get('pageSize', 5);
        $search = $request->get('search', '');
        $startDate = $request->get('startDate', '');
        $endDate = $request->get('endDate', '');
        $sort = $request->get('sort', 'created_at');
        $order = $request->get('order', 'desc');

        // 构建查询
        $query = DB::table('c_course_experiments')
            ->leftJoin('c_scene_configs', 'c_course_experiments.c_config_id', '=', 'c_scene_configs.c_config_id')
            ->leftJoin('c_courses', 'c_course_experiments.c_course_id', '=', 'c_courses.c_course_id')
            ->select(
                'c_course_experiments.c_experiment_id',
                'c_course_experiments.c_course_id',
                'c_course_experiments.c_experiment_name',
                'c_course_experiments.c_description',
                'c_course_experiments.c_config_id',
                'c_course_experiments.c_start',
                'c_course_experiments.c_end',
                'c_scene_configs.c_name',
                'c_courses.c_course_name',
                'c_course_experiments.created_at'
            );

        // 搜索条件
        if (!empty($search)) {
            $query->where(function ($q) use ($search) {
                $q->where('c_course_experiments.c_experiment_name', 'like', "%{$search}%")
                  ->orWhere('c_course_experiments.c_description', 'like', "%{$search}%")
                  ->orWhere('c_courses.c_course_name', 'like', "%{$search}%");
            });
        }

        // 日期范围条件
        if (!empty($startDate)) {
            $query->whereDate('c_course_experiments.c_start', '>=', $startDate);
        }
        if (!empty($endDate)) {
            $query->whereDate('c_course_experiments.c_end', '<=', $endDate);
        }

        // 排序
        $allowedSortFields = ['created_at', 'c_experiment_name', 'c_course_name', 'c_start', 'c_end'];
        $sortField = in_array($sort, $allowedSortFields) ? $sort : 'created_at';
        $sortOrder = $order === 'asc' ? 'asc' : 'desc';
        
        $query->orderBy($sortField, $sortOrder);

        // 获取总数
        $total = $query->count();

        // 分页
        $offset = ($page - 1) * $pageSize;
        $experiments = $query->offset($offset)
            ->limit($pageSize)
            ->get()
            ->map(function ($exp) {
                $resources = DB::table('c_experiment_resources')
                    ->where('c_experiment_id', $exp->c_experiment_id)
                    ->select(
                        'c_resource_id',
                        'c_resource_name',
                        'c_resource_path',
                        'c_type',
                        'c_size'
                    )
                    ->get()
                    ->toArray();
                
                return [
                    'c_experiment_id' => $exp->c_experiment_id,
                    'c_course_id' => $exp->c_course_id,
                    'c_experiment_name' => $exp->c_experiment_name,
                    'c_description' => $exp->c_description,
                    'c_config_id' => $exp->c_config_id,
                    'c_start' => $exp->c_start,
                    'c_end' => $exp->c_end,
                    'c_name' => $exp->c_name,
                    'c_course_name' => $exp->c_course_name ?? '未知课程',
                    'created_at' => $exp->created_at,
                    'resources' => $resources,
                ];
            });

        return response()->json([
            'code' => 200,
            'message' => 'Experiments retrieved successfully.',
            'data' => [
                'experiments' => $experiments,
                'total' => $total,
                'current_page' => (int)$page,
                'page_size' => (int)$pageSize,
                'total_pages' => ceil($total / $pageSize)
            ],
        ], 200);
        
    } catch (\Exception $e) {
        Log::error('[GENERAL] getExperiments: ' . $e->getMessage(), [
            'trace' => $e->getTraceAsString(),
        ]);
        return response()->json([
            'code' => 500,
            'message' => 'Unexpected error occurred: ' . $e->getMessage(),
        ], 500);
    }
}

    public function store(Request $request)
    {
        Log::info('Experiment store request:', $request->json()->all());
        // 2. 补充 c_start、c_end的验证规则
        $validator = Validator::make($request->json()->all(), [
            'c_course_id' => 'required|string|exists:c_courses,c_course_id|max:5', // 匹配表字段 varchar(5)
            'c_experiment_name' => 'required|string|max:100',
            'c_description' => 'nullable|string',
            'c_config_id' => 'required|integer|exists:c_scene_configs,c_config_id',
            // 新增：时间字段验证（格式+逻辑约束）
            'c_start' => 'required|date_format:Y-m-d H:i:s|after:now', // 开始时间需晚于当前
            'c_end' => 'required|date_format:Y-m-d H:i:s|after:c_start', // 结束时间需晚于开始时间
        ], [
            // 自定义错误提示（可选，增强可读性）
            'c_course_id.max' => '课程ID长度不能超过5个字符',
            'c_start.date_format' => '开始时间格式必须为 Y-m-d H:i:s',
            'c_start.after' => '开始时间必须晚于当前时间',
            'c_end.after' => '结束时间必须晚于开始时间'       
        ]);
        if ($validator->fails()) {
            return response()->json([
                'code' => 422,
                'message' => $validator->errors()->first(),
                'errors' => $validator->errors()->all(),
            ], 422);
        }

        $data = $request->json()->all();
        $courseId = $data['c_course_id'];


        // 实验名称唯一性验证（同课程下不重复）
        $nameValidator = Validator::make(['c_experiment_name' => $data['c_experiment_name']], [
            'c_experiment_name' => 'unique:c_course_experiments,c_experiment_name,NULL,c_experiment_id,c_course_id,' . $courseId,
        ]);
        if ($nameValidator->fails()) {
            return response()->json([
                'code' => 422,
                'message' => $nameValidator->errors()->first(),
            ], 422);
        }

        // 3. 数据传入模型（包含新增的3个字段）
        $modelRes = ExperimentModel::createExperiment($courseId, $data);

        // 实验创建成功后同步用户权限
        if ($modelRes['code'] == 201) {
            $this->syncSceneUsers($courseId, $data['c_config_id']);
        }

        return response()->json($modelRes, $modelRes['code'] == 201 ? 201 : 500);
    }

    /**
     * 同步课程用户到场景用户权限表
     */
    private function syncSceneUsers($courseId, $sceneId)
    {
        try {
            DB::beginTransaction();

            // 获取课程的授权用户
            $courseUsers = DB::table('c_courses_users')
                ->where('c_course_id', $courseId)
                ->pluck('c_username')
                ->toArray();
            $courseUsers[] = 'admin'; // 添加默认的 admin 用户
            $courseUsers = array_unique($courseUsers); // 去重

            // 检查并同步到 c_scene_users
            foreach ($courseUsers as $username) {
                $exists = DB::table('c_scene_users')
                    ->where('c_scene_configs_id', $sceneId)
                    ->where('c_username', $username)
                    ->exists();

                if (!$exists) {
                    DB::table('c_scene_users')->insert([
                        'c_scene_configs_id' => $sceneId,
                        'c_username' => $username,
                        'created_at' => now(),
                    ]);
                }
            }

            DB::commit();
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('[GENERAL] syncSceneUsers: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
            ]);
        }
    }

    public function update(Request $request, $experimentId)
    {
        Log::info('Experiment update request:', ['experimentId' => $experimentId, 'data' => $request->json()->all()]);
        // 4. 补充更新接口的 c_start、c_end 验证
        $validator = Validator::make($request->json()->all(), [
            'c_experiment_name' => 'required|string|max:100',
            'c_description' => 'nullable|string',
            'c_config_id' => 'required|integer|exists:c_scene_configs,c_config_id',
            // 新增：同store的时间字段验证
            'c_start' => 'required|date_format:Y-m-d H:i:s|after:now',
            'c_end' => 'required|date_format:Y-m-d H:i:s|after:c_start',
        ], [
            // 自定义错误提示
            'c_start.date_format' => '开始时间格式必须为 Y-m-d H:i:s',
            'c_start.after' => '开始时间必须晚于当前时间',
            'c_end.after' => '结束时间必须晚于开始时间',
        ]);
        if ($validator->fails()) {
            return response()->json([
                'code' => 422,
                'message' => $validator->errors()->first(),
                'errors' => $validator->errors()->all(),
            ], 422);
        }

        // 获取实验所属课程ID（验证实验存在）
        $experiment = DB::table('c_course_experiments')->where('c_experiment_id', $experimentId)->first();
        if (!$experiment) {
            return response()->json([
                'code' => 404,
                'message' => 'Experiment not found.',
            ], 404);
        }
        $courseId = $experiment->c_course_id;

        // 实验名称唯一性验证（排除当前实验）
        $nameValidator = Validator::make(['c_experiment_name' => $request->json('c_experiment_name')], [
            'c_experiment_name' => 'unique:c_course_experiments,c_experiment_name,' . $experimentId . ',c_experiment_id,c_course_id,' . $courseId,
        ]);
        if ($nameValidator->fails()) {
            return response()->json([
                'code' => 422,
                'message' => $nameValidator->errors()->first(),
            ], 422);
        }

        $data = $request->json()->all();
    

        // 5. 数据传入模型（包含新增的3个字段）
        $modelRes = ExperimentModel::updateExperiment($courseId, $experimentId, $data);
        return response()->json($modelRes, $modelRes['code'] == 200 ? 200 : 500);
    }

    public function show($experimentId)
    {
        try {
            // 获取单个实验详情
            $experiment = DB::table('c_course_experiments')
                ->leftJoin('c_scene_configs', 'c_course_experiments.c_config_id', '=', 'c_scene_configs.c_config_id')
                ->select(
                    'c_course_experiments.c_experiment_id',
                    'c_course_experiments.c_course_id',
                    'c_course_experiments.c_experiment_name as c_name',
                    'c_course_experiments.c_description',
                    'c_course_experiments.c_config_id',
                    'c_course_experiments.c_start',
                    'c_course_experiments.c_end',
                    'c_scene_configs.c_name as c_scene_name'
                )
                ->where('c_course_experiments.c_experiment_id', $experimentId)
                ->first();

            if (!$experiment) {
                return response()->json([
                    'code' => 404,
                    'message' => 'Experiment not found.',
                ], 404);
            }

            // 获取实验资源
            $resources = DB::table('c_experiment_resources')
                ->where('c_experiment_id', $experimentId)
                ->select(
                    'c_resource_id',
                    'c_resource_name',
                    'c_resource_path',
                    'c_type',
                    'c_size'
                )
                ->get()
                ->toArray();

            return response()->json([
                'code' => 200,
                'message' => 'Experiment retrieved successfully.',
                'data' => [
                    'c_experiment_id' => $experiment->c_experiment_id,
                    'c_course_id' => $experiment->c_course_id,
                    'c_name' => $experiment->c_name,
                    'c_description' => $experiment->c_description,
                    'c_config_id' => $experiment->c_config_id,
                    'c_start' => $experiment->c_start,
                    'c_end' => $experiment->c_end,
                    'c_scene_name' => $experiment->c_scene_name,
                    'resources' => $resources,
                ],
            ], 200);
        } catch (\Exception $e) {
            Log::error('[GENERAL] getExperiment: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
            ]);
            return response()->json([
                'code' => 500,
                'message' => 'Unexpected error occurred: ' . $e->getMessage(),
            ], 500);
        }
    }

    public function destroy($experimentId)
    {
        try {
            // 获取实验所属课程ID（验证实验存在）
            $experiment = DB::table('c_course_experiments')->where('c_experiment_id', $experimentId)->first();
            if (!$experiment) {
                return response()->json([
                    'code' => 404,
                    'message' => 'Experiment not found.',
                ], 404);
            }
            $courseId = $experiment->c_course_id;

            DB::beginTransaction();
            // 删除关联资源
            $resources = DB::table('c_experiment_resources')
                ->where('c_experiment_id', $experimentId)
                ->get();
            foreach ($resources as $resource) {
                if (Storage::disk('local_resources')->exists($resource->c_resource_path)) {
                    Storage::disk('local_resources')->delete($resource->c_resource_path);
                }
            }
            DB::table('c_experiment_resources')->where('c_experiment_id', $experimentId)->delete();

            // 删除实验文件夹
            $course = DB::table('c_courses')->where('c_course_id', $courseId)->first();
            $experimentFolder = "courses/{$course->c_category_id}/{$courseId}/Experiment/{$experimentId}";
            if (Storage::disk('local_resources')->exists($experimentFolder)) {
                Storage::disk('local_resources')->deleteDirectory($experimentFolder);
            }

            // 删除实验记录（包含新增字段的表数据）
            $result = DB::table('c_course_experiments')
                ->where('c_experiment_id', $experimentId)
                ->delete();

            if (!$result) {
                DB::rollBack();
                return response()->json([
                    'code' => 500,
                    'message' => 'Failed to delete experiment.',
                ], 500);
            }

            DB::commit();
            return response()->json([
                'code' => 200,
                'message' => 'Experiment deleted successfully.',
            ], 200);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('[GENERAL] deleteExperiment: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
            ]);
            return response()->json([
                'code' => 500,
                'message' => 'Unexpected error occurred: ' . $e->getMessage(),
            ], 500);
        }
    }
}
