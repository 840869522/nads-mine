<?php
namespace App\Http\Controllers\Experiment;

use App\Http\Controllers\Controller;
use App\Models\Experiment\ExperimentModel;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Storage;
class ExperimentController extends Controller
{
    public function index($courseId)
    {
        try {
            if (!DB::table('c_courses')->where('c_course_id', $courseId)->exists()) {
                return response()->json([
                    'code' => 404,
                    'message' => 'Course not found.',
                ], 404);
            }

            $experiments = DB::table('c_course_experiments')
                ->where('c_course_id', $courseId)
                ->leftJoin('c_scene_configs', 'c_course_experiments.c_config_id', '=', 'c_scene_configs.c_config_id')
                ->select(
                    'c_course_experiments.c_experiment_id',
                    'c_course_experiments.c_course_id',
                    'c_course_experiments.c_experiment_name',
                    'c_course_experiments.c_description',
                    'c_course_experiments.c_config_id',
                    'c_scene_configs.c_name',
                    'c_course_experiments.created_at'
                )
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
                        'c_name' => $exp->c_name,
                        'created_at' => $exp->created_at,
                        'resources' => $resources,
                    ];
                });

            return response()->json([
                'code' => 200,
                'message' => 'Experiments retrieved successfully.',
                'data' => ['experiments' => $experiments],
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

    public function store(Request $request, $courseId)
    {
        Log::info('Experiment store request:', $request->json()->all());
        $validator = Validator::make($request->json()->all(), [
            'c_experiment_name' => 'required|string|max:100|unique:c_course_experiments,c_experiment_name,NULL,c_experiment_id,c_course_id,' . $courseId,
            'c_description' => 'nullable|string',
            'c_config_id' => 'required|integer|exists:c_scene_configs,c_config_id',
        ]);
        if ($validator->fails()) {
            return response()->json([
                'code' => 422,
                'message' => $validator->errors()->first(),
                'errors' => $validator->errors()->all(),
            ], 422);
        }

        $data = $request->json()->all();
        $modelRes = ExperimentModel::createExperiment($courseId, $data);

        // 如果实验创建成功，同步用户权限
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

    public function update(Request $request, $courseId, $experimentId)
    {
        Log::info('Experiment update request:', ['courseId' => $courseId, 'experimentId' => $experimentId, 'data' => $request->json()->all()]);
        $validator = Validator::make($request->json()->all(), [
            'c_experiment_name' => 'required|string|max:100|unique:c_course_experiments,c_experiment_name,' . $experimentId . ',c_experiment_id,c_course_id,' . $courseId,
            'c_description' => 'nullable|string',
            'c_config_id' => 'required|integer|exists:c_scene_configs,c_config_id',
        ]);
        if ($validator->fails()) {
            return response()->json([
                'code' => 422,
                'message' => $validator->errors()->first(),
                'errors' => $validator->errors()->all(),
            ], 422);
        }

        $data = $request->json()->all();
        $modelRes = ExperimentModel::updateExperiment($courseId, $experimentId, $data);
        return response()->json($modelRes, $modelRes['code'] == 200 ? 200 : 500);
    }

    public function destroy($courseId, $experimentId)
    {
        try {
            if (!DB::table('c_courses')->where('c_course_id', $courseId)->exists()) {
                return response()->json([
                    'code' => 404,
                    'message' => 'Course not found.',
                ], 404);
            }

            if (!DB::table('c_course_experiments')->where('c_experiment_id', $experimentId)->where('c_course_id', $courseId)->exists()) {
                return response()->json([
                    'code' => 404,
                    'message' => 'Experiment not found.',
                ], 404);
            }

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

            // 删除实验记录
            $result = DB::table('c_course_experiments')
                ->where('c_experiment_id', $experimentId)
                ->where('c_course_id', $courseId)
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
