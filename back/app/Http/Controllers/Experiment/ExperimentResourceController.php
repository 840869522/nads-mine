<?php
namespace App\Http\Controllers\Experiment;

use App\Http\Controllers\Controller;
use App\Models\Experiment\ExperimentResourceModel;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;

class ExperimentResourceController extends Controller
{
    public function index($courseId, $experimentId)
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

            $resources = DB::table('c_experiment_resources')
                ->where('c_experiment_id', $experimentId)
                ->select(
                    'c_resource_id',
                    'c_resource_name',
                    'c_resource_path',
                    'c_type',
                    'c_size'
                )
                ->get();

            return response()->json([
                'code' => 200,
                'message' => 'Resources retrieved successfully.',
                'data' => ['resources' => $resources],
            ], 200);
        } catch (\Exception $e) {
            Log::error('[GENERAL] getExperimentResources: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
            ]);
            return response()->json([
                'code' => 500,
                'message' => 'Unexpected error occurred: ' . $e->getMessage(),
            ], 500);
        }
    }
    public function upload(Request $request, $courseId, $experimentId)
    {
        $validator = Validator::make($request->all(), [
            'c_course_id' => 'required|string|exists:c_courses,c_course_id',
            'c_experiment_id' => 'required|string|exists:c_course_experiments,c_experiment_id',
            'file' => 'required|file|mimes:pdf,jpg,jpeg,png,doc,docx,mp4,avi|max:102400',
        ]);
        if ($validator->fails()) {
            return response()->json([
                'code' => 422,
                'message' => $validator->errors()->first(),
                'errors' => $validator->errors()->all(),
            ], 422);
        }

        try {
            $file = $request->file('file');
            $course = DB::table('c_courses')->where('c_course_id', $courseId)->first();
            $experiment = DB::table('c_course_experiments')->where('c_experiment_id', $experimentId)->where('c_course_id', $courseId)->first();
            if (!$course || !$experiment) {
                return response()->json([
                    'code' => 404,
                    'message' => 'Course or experiment not found.',
                ], 404);
            }

            $targetPath = "courses/{$course->c_category_id}/{$courseId}/Experiment/{$experimentId}";
            if (!Storage::disk('local_resources')->exists($targetPath)) {
                Storage::disk('local_resources')->makeDirectory($targetPath, 0755, true);
            }

            $originalName = mb_convert_encoding($file->getClientOriginalName(), 'UTF-8', 'UTF-8');
            // 去除文件扩展名
            $fileNameWithoutExtension = pathinfo($originalName, PATHINFO_FILENAME);
            $fileExtension = $file->getClientOriginalExtension(); // 例如：docx
            $fileName = $originalName;
            $counter = 1;
            while (Storage::disk('local_resources')->exists("{$targetPath}/{$fileName}")) {
                $fileName = "{$fileNameWithoutExtension}_{$counter}.{$fileExtension}";
                $counter++;
            }

            $resourcePath = Storage::disk('local_resources')->putFileAs($targetPath, $file, $fileName);
            $fullPath = Storage::disk('local_resources')->path($resourcePath);
            Log::info('File uploaded', [
                'targetPath' => $targetPath,
                'fileName' => $fileName,
                'resourcePath' => $resourcePath,
                'fullPath' => $fullPath,
                'exists' => Storage::disk('local_resources')->exists($resourcePath),
            ]);

            if (!Storage::disk('local_resources')->exists($resourcePath)) {
                return response()->json([
                    'code' => 500,
                    'message' => 'Failed to store file on disk.',
                ], 500);
            }

            $data = [
                'c_course_id' => $courseId,
                'c_experiment_id' => $experimentId,
                'c_resource_name' => $fileNameWithoutExtension, // 去除扩展名
                'c_resource_path' => $resourcePath,
                'c_type' => $fileExtension, // 存储扩展名，如 docx
                'c_size' => $file->getSize(),
            ];
            $modelRes = ExperimentResourceModel::store($data);
            if ($modelRes['code'] != 201) {
                Storage::disk('local_resources')->delete($resourcePath); // 回滚文件
                return response()->json($modelRes, 500);
            }

            return response()->json([
                'code' => 201,
                'message' => 'Experiment resource uploaded successfully.',
                'data' => $modelRes['data'],
            ], 201);
        } catch (\Exception $e) {
            Log::error('[GENERAL] uploadExperimentResource: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
            ]);
            return response()->json([
                'code' => 500,
                'message' => 'Unexpected error occurred: ' . $e->getMessage(),
            ], 500);
        }
    }
    public function destroy($courseId, $experimentId, $resourceId)
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

            $resource = DB::table('c_experiment_resources')
                ->where('c_resource_id', $resourceId)
                ->where('c_experiment_id', $experimentId)
                ->first();

            if (!$resource) {
                return response()->json([
                    'code' => 404,
                    'message' => 'Resource not found.',
                ], 404);
            }

            DB::beginTransaction();
            if (Storage::disk('local_resources')->exists($resource->c_resource_path)) {
                Storage::disk('local_resources')->delete($resource->c_resource_path);
            }

            $result = DB::table('c_experiment_resources')
                ->where('c_resource_id', $resourceId)
                ->where('c_experiment_id', $experimentId)
                ->delete();

            if (!$result) {
                DB::rollBack();
                return response()->json([
                    'code' => 500,
                    'message' => 'Failed to delete resource.',
                ], 500);
            }

            DB::commit();
            return response()->json([
                'code' => 200,
                'message' => 'Resource deleted successfully.',
            ], 200);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('[GENERAL] deleteExperimentResource: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
            ]);
            return response()->json([
                'code' => 500,
                'message' => 'Unexpected error occurred: ' . $e->getMessage(),
            ], 500);
        }
    }
    public function download(Request $request, $c_resource_id)
    {
        try {
            // 验证 c_resource_id
            $validator = Validator::make(['c_resource_id' => $c_resource_id], [
                'c_resource_id' => 'required|string|max:36',
            ]);
            if ($validator->fails()) {
                Log::error('Validation failed in ExperimentResourceController::download', [
                    'errors' => $validator->errors()->toArray(),
                    'c_resource_id' => $c_resource_id,
                ]);
                return response()->json([
                    'code' => 422,
                    'message' => $validator->errors()->first(),
                ], 422);
            }

            // 查询实验资源
            $resource = DB::table('c_experiment_resources')
                ->where('c_resource_id', $c_resource_id)
                ->first();
            if (!$resource) {
                Log::error('Experiment resource not found', [
                    'c_resource_id' => $c_resource_id,
                ]);
                return response()->json([
                    'code' => 404,
                    'message' => 'Experiment resource not found.',
                ], 404);
            }

            $path = $resource->c_resource_path;
            $fullPath = Storage::disk('local_resources')->path($path);

            // 检查文件是否存在和可读性
            if (!Storage::disk('local_resources')->exists($path) || !is_readable($fullPath)) {
                Log::error('Experiment resource file not found or not readable', [
                    'c_resource_id' => $c_resource_id,
                    'c_resource_path' => $path,
                    'full_path' => $fullPath,
                    'exists' => Storage::disk('local_resources')->exists($path),
                    'is_readable' => is_readable($fullPath),
                ]);
                return response()->json([
                    'code' => 404,
                    'message' => 'Experiment resource file not found or not readable.',
                ], 404);
            }

            // 处理 MIME 类型
            $mimeTypes = [
                'pdf' => 'application/pdf',
                'docx' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'doc' => 'application/msword',
                'mp4' => 'video/mp4',
                'avi' => 'video/x-msvideo',
                'jpg' => 'image/jpeg',
                'png' => 'image/png',
            ];
            $contentType = $mimeTypes[strtolower($resource->c_type)] ?? 'application/octet-stream';

            // 确保下载文件名包含扩展名
            $downloadFileName = $resource->c_resource_name . '.' . $resource->c_type;
            // 编码文件名以支持中文
            $encodedFileName = rawurlencode($downloadFileName);
            $headers = [
                'Content-Type' => $contentType,
                'Content-Disposition' => "attachment; filename*=UTF-8''{$encodedFileName}",
            ];

            // 日志记录
            Log::info('Downloading experiment resource', [
                'c_resource_id' => $c_resource_id,
                'c_resource_path' => $path,
                'full_path' => $fullPath,
                'file_name' => $downloadFileName,
                'content_type' => $contentType,
                'headers' => $headers,
            ]);

            // 返回文件流
            return Storage::disk('local_resources')->response($path, $downloadFileName, $headers);
    } catch (\Exception $e) {
        Log::error('[CONTROLLER] ExperimentResourceController::download: ' . $e->getMessage(), [
            'c_resource_id' => $c_resource_id,
            'c_resource_path' => $path ?? 'N/A',
            'full_path' => isset($path) ? Storage::disk('local_resources')->path($path) : 'N/A',
            'trace' => $e->getTraceAsString(),
        ]);
        return response()->json([
            'code' => 500,
            'message' => 'Unexpected error in ExperimentResourceController::download: ' . $e->getMessage(),
        ], 500);
    }
}
}
