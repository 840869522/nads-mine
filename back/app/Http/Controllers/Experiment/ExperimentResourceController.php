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
    public function index($experimentId)
    {
        try {
            // 检查实验是否存在（移除课程检查）
            $experiment = DB::table('c_course_experiments')->where('c_experiment_id', $experimentId)->first();
            if (!$experiment) {
                return response()->json([
                    'code' => 404,
                    'message' => 'Experiment not found.',
                ], 404);
            }
            $courseId = $experiment->c_course_id;  // 推导courseId（虽未使用，但保持一致）

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
            'file' => 'required|file|mimes:pdf,jpg,jpeg,png,doc,pptx,docx,mp4,avi|max:2097152',
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
    
    public function destroy($experimentId, $resourceId)
    {
        try {
            // 获取experiment并推导courseId（虽未直接使用，但保持一致）
            $experiment = DB::table('c_course_experiments')->where('c_experiment_id', $experimentId)->first();
            if (!$experiment) {
                return response()->json([
                    'code' => 404,
                    'message' => 'Experiment not found.',
                ], 404);
            }
            $courseId = $experiment->c_course_id;  // 推导

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
    public function viewResource(Request $request, $c_resource_id)
    {
        // 此方法不变，已独立
        try {
            $validator = Validator::make(['c_resource_id' => $c_resource_id], [
                'c_resource_id' => 'required|string',
            ]);
            if ($validator->fails()) {
                Log::error('Validation failed in ExperimentResourceController::viewResource', [
                    'errors' => $validator->errors()->toArray(),
                    'c_resource_id' => $c_resource_id,
                ]);
                return response()->json(['code' => 422, 'message' => $validator->errors()->first()], 422);
            }

            $resource = DB::table('c_experiment_resources')->where('c_resource_id', $c_resource_id)->first();
            if (!$resource) {
                Log::error('Experiment resource not found in ExperimentResourceController::viewResource', [
                    'c_resource_id' => $c_resource_id,
                ]);
                return response()->json(['code' => 404, 'message' => 'Experiment resource not found'], 404);
            }

            // 检查文件是否存在
            if (!Storage::disk('local_resources')->exists($resource->c_resource_path)) {
                Log::error('Experiment resource file not found in ExperimentResourceController::viewResource', [
                    'c_resource_id' => $c_resource_id,
                    'c_resource_path' => $resource->c_resource_path,
                    'exists' => Storage::disk('local_resources')->exists($resource->c_resource_path),
                ]);
                return response()->json(['code' => 404, 'message' => 'Experiment resource file not found'], 404);
            }

            $downloadUrl = url("/api/study/experiment-resources/{$c_resource_id}?disposition=attachment");
            $viewUrl = url("/api/study/experiment-resources/{$c_resource_id}?disposition=inline");

            // 检查文件类型（使用扩展名以保持一致性）
            $isImage = in_array($resource->c_type, ['jpg', 'jpeg', 'png']);
            $isPdf = $resource->c_type === 'pdf';
            $isVideo = in_array($resource->c_type, ['mp4', 'avi']);
            $isWord = in_array($resource->c_type, ['doc', 'docx']);
            $isPptx = $resource->c_type === 'pptx';

            if ($isImage) {
                $viewerContent = "<img src='{$viewUrl}' style='max-width: 100%; max-height: 100%; object-fit: contain;' alt='{$resource->c_resource_name}'>";
            } elseif ($isPdf) {
                $viewerContent = "<embed src='{$viewUrl}' type='application/pdf' width='100%' height='100%' />";
            } elseif ($isVideo) {
                $viewerContent = "<video controls width='100%' height='auto'><source src='{$viewUrl}' type='video/{$resource->c_type}' />您的浏览器不支持视频播放。</video>";
            } elseif ($isWord || $isPptx) {
                // DOCX 和 PPTX 将在前端模态框预览，此处仅提供占位提示
                $viewerContent = "<p>此文件将在模态框中预览。如果不支持，请下载。</p>";
            } else {
                $viewerContent = "<object id='viewer' data='{$viewUrl}' type='application/octet-stream' width='100%' height='100%'>
                <p>浏览器不支持此文件类型，请下载查看。</p>
            </object>";
            }

            $html = <<<HTML
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{$resource->c_resource_name}.{$resource->c_type}</title>  <!-- 显示完整文件名 -->
    <style>
        body { margin: 0; padding: 0; display: flex; flex-direction: column; height: 100vh; justify-content: center; align-items: center; font-family: Arial, sans-serif; }
        #viewer { max-width: 100%; max-height: calc(100% - 50px); object-fit: contain; }
        #download-bar { padding: 10px; background: #f0f0f0; text-align: center; width: 100%; position: fixed; bottom: 0; box-sizing: border-box; }
        button { padding: 10px 20px; background: #1976d2; color: white; border: none; cursor: pointer; border-radius: 4px; }
        button:hover { background: #1565c0; }
        p { text-align: center; margin: 20px; }
        img, video, embed, object { max-width: 100%; max-height: calc(100vh - 50px); object-fit: contain; }
    </style>
</head>
<body>
    {$viewerContent}
    <div id="download-bar">
        <button onclick="window.location.href='{$downloadUrl}'">下载文件</button>  <!-- 确保所有类型有下载按钮 -->
    </div>
</body>
</html>
HTML;

            return response($html)->header('Content-Type', 'text/html');
        } catch (\Exception $e) {
            Log::error('[CONTROLLER] ExperimentResourceController::viewResource: ' . $e->getMessage(), [
                'c_resource_id' => $c_resource_id,
                'trace' => $e->getTraceAsString(),
            ]);
            return response()->json(['code' => 500, 'message' => 'Failed to view experiment resource'], 500);
        }
    }
    public function download(Request $request, $c_resource_id)
    {
        // 此方法不变，已独立
        try {
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

            $resource = DB::table('c_experiment_resources')->where('c_resource_id', $c_resource_id)->first();
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

            if (!Storage::disk('local_resources')->exists($path) || !is_readable($fullPath)) {
                Log::error('Experiment resource file not found or not readable', [
                    'c_resource_id' => $c_resource_id,
                    'c_resource_path' => $path,
                    'full_path' => $fullPath,
                    'exists' => Storage::disk('local_resources')->exists($path),
                    'is_readable' => is_readable($fullPath),
                    'disk_root' => Storage::disk('local_resources')->path(''),
                ]);
                return response()->json([
                    'code' => 404,
                    'message' => 'Experiment resource file not found or not readable.',
                ], 404);
            }
            
            // 确保文件在存储目录内
            $diskRoot = Storage::disk('local_resources')->path('');
            if (!str_starts_with(realpath($fullPath), realpath($diskRoot))) {
                Log::error('Invalid file path - outside storage directory', [
                    'c_resource_id' => $c_resource_id,
                    'c_resource_path' => $path,
                    'full_path' => $fullPath,
                    'disk_root' => $diskRoot,
                ]);
                return response()->json([
                    'code' => 400,
                    'message' => 'Invalid file path.',
                ], 400);
            }

            $disposition = $request->query('disposition', 'attachment');
            $contentType = [
                'pdf' => 'application/pdf',
                'docx' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'doc' => 'application/msword',
                'mp4' => 'video/mp4',
                'avi' => 'video/x-msvideo',
                'jpg' => 'image/jpeg',
                'png' => 'image/png',
            ][strtolower($resource->c_type)] ?? 'application/octet-stream';

            $downloadFileName = $resource->c_resource_name . '.' . $resource->c_type;
            $encodedFileName = rawurlencode($downloadFileName);

            Log::info('Downloading experiment resource', [
                'c_resource_id' => $c_resource_id,
                'c_resource_path' => $path,
                'full_path' => $fullPath,
                'file_name' => $downloadFileName,
                'content_type' => $contentType,
                'disposition' => $disposition,
            ]);

            return Storage::disk('local_resources')->response($path, $downloadFileName, [
                'Content-Type' => $contentType,
                'Content-Disposition' => "{$disposition}; filename*=UTF-8''{$encodedFileName}",
            ]);
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

   public function uploadMultiple(Request $request, $experimentId)
{
    // 批量上传实验资源
    $validator = Validator::make($request->all(), [
        'files' => 'required|array',
        'files.*' => 'file|mimes:pdf,jpg,jpeg,png,doc,pptx,docx,mp4,avi|max:512000',
    ]);
    
    if ($validator->fails()) {
        return response()->json([
            'code' => 422,
            'message' => $validator->errors()->first(),
            'errors' => $validator->errors()->all(),
        ], 422);
    }

    try {
        Log::info('开始批量上传实验资源', ['experiment_id' => $experimentId]);
        
        // 获取experiment并推导courseId
        $experiment = DB::table('c_course_experiments')->where('c_experiment_id', $experimentId)->first();
        if (!$experiment) {
            Log::error('实验未找到', ['experiment_id' => $experimentId]);
            return response()->json([
                'code' => 404,
                'message' => 'Experiment not found.',
            ], 404);
        }
        
        $courseId = $experiment->c_course_id;
        $course = DB::table('c_courses')->where('c_course_id', $courseId)->first();
        if (!$course) {
            Log::error('课程未找到', ['course_id' => $courseId]);
            return response()->json([
                'code' => 404,
                'message' => 'Course not found.',
            ], 404);
        }

        $targetPath = "courses/{$course->c_category_id}/{$courseId}/Experiment/{$experimentId}";
        Log::info('目标存储路径', ['path' => $targetPath]);
        
        // 使用 Storage::disk('local_resources') 确保目录存在
        $disk = Storage::disk('local_resources');
        if (!$disk->exists($targetPath)) {
            $disk->makeDirectory($targetPath, 0755, true);
        }
        
        $uploadedFiles = $request->file('files');
        $uploadedResources = [];
        $errors = [];

        Log::info('接收到的文件数量', ['count' => count($uploadedFiles)]);

        foreach ($uploadedFiles as $index => $file) {
            try {
                Log::info('处理文件', [
                    'index' => $index,
                    'original_name' => $file->getClientOriginalName(),
                    'size' => $file->getSize(),
                    'mime_type' => $file->getMimeType()
                ]);

                $originalName = mb_convert_encoding($file->getClientOriginalName(), 'UTF-8', 'UTF-8');
                $fileNameWithoutExtension = pathinfo($originalName, PATHINFO_FILENAME);
                $fileExtension = $file->getClientOriginalExtension();
                
                $fileName = $originalName;
                $counter = 1;
                while ($disk->exists("{$targetPath}/{$fileName}")) {
                    $fileName = "{$fileNameWithoutExtension}_{$counter}.{$fileExtension}";
                    $counter++;
                }

                Log::info('准备存储文件', [
                    'target_path' => $targetPath,
                    'file_name' => $fileName
                ]);

                // 使用 putFileAs 方法存储文件
                $resourcePath = $disk->putFileAs($targetPath, $file, $fileName);
                
                Log::info('文件存储结果', ['resource_path' => $resourcePath]);

                // 检查文件是否成功存储
                if (!$disk->exists($resourcePath)) {
                    $errorMsg = "文件 {$originalName} 存储失败";
                    $errors[] = $errorMsg;
                    Log::error($errorMsg);
                    continue;
                }

                // 准备数据并调用 store 方法
                $data = [
                    'c_course_id' => $courseId,
                    'c_experiment_id' => $experimentId,
                    'c_resource_name' => $fileNameWithoutExtension,
                    'c_resource_path' => $resourcePath,
                    'c_type' => $fileExtension,
                    'c_size' => $file->getSize(),
                ];
                
                Log::info('调用 store 方法保存到数据库', ['data' => $data]);
                
                // 调用 store 方法进行数据库存储
                $modelRes = ExperimentResourceModel::store($data);
                
                if ($modelRes['code'] != 201) {
                    // 数据库存储失败，删除已上传的文件
                    $disk->delete($resourcePath);
                    $errorMsg = "文件 {$originalName} 数据库保存失败: " . $modelRes['message'];
                    $errors[] = $errorMsg;
                    Log::error($errorMsg, ['response' => $modelRes]);
                    continue;
                }

                $uploadedResources[] = [
                    'file_name' => $fileName,
                    'resource_id' => $modelRes['data']['c_resource_id'],
                    'size' => $file->getSize(),
                    'type' => $fileExtension,
                    'path' => $resourcePath
                ];

                Log::info('文件上传成功', ['file_name' => $fileName]);

            } catch (\Exception $e) {
                $errorMsg = "文件 {$file->getClientOriginalName()} 上传失败: " . $e->getMessage();
                $errors[] = $errorMsg;
                Log::error($errorMsg, [
                    'file_index' => $index,
                    'file_name' => $file->getClientOriginalName(),
                    'error' => $e->getMessage(),
                    'trace' => $e->getTraceAsString(),
                ]);
            }
        }

        $response = [
            'code' => 201,
            'message' => '批量上传完成',
            'data' => [
                'uploaded_count' => count($uploadedResources),
                'total_count' => count($uploadedFiles),
                'uploaded_files' => $uploadedResources,
                'errors' => $errors,
            ],
        ];

        if (count($errors) > 0) {
            $response['message'] .= '，部分文件上传失败';
        }

        Log::info('批量上传完成', $response);

        return response()->json($response, 201);

    } catch (\Exception $e) {
        Log::error('[GENERAL] 批量上传实验资源失败: ' . $e->getMessage(), [
            'experiment_id' => $experimentId,
            'trace' => $e->getTraceAsString(),
        ]);
        return response()->json([
            'code' => 500,
            'message' => '批量上传失败: ' . $e->getMessage(),
        ], 500);
    }
}

    public function officePreview(Request $request, $c_resource_id)
    {
        try {
            $validator = Validator::make(['c_resource_id' => $c_resource_id], [
                'c_resource_id' => 'required|string',
            ]);
            if ($validator->fails()) {
                Log::error('Validation failed in ExperimentResourceController::officePreview', [
                    'errors' => $validator->errors()->toArray(),
                    'c_resource_id' => $c_resource_id,
                ]);
                return response()->json(['code' => 422, 'message' => $validator->errors()->first()], 422);
            }

            $resource = DB::table('c_experiment_resources')->where('c_resource_id', $c_resource_id)->first();
            if (!$resource) {
                Log::error('Experiment resource not found in ExperimentResourceController::officePreview', [
                    'c_resource_id' => $c_resource_id,
                ]);
                return response()->json(['code' => 404, 'message' => 'Experiment resource not found'], 404);
            }

            // 检查文件是否存在
            if (!Storage::disk('local_resources')->exists($resource->c_resource_path)) {
                Log::error('Experiment resource file not found in ExperimentResourceController::officePreview', [
                    'c_resource_id' => $c_resource_id,
                    'c_resource_path' => $resource->c_resource_path,
                ]);
                return response()->json(['code' => 404, 'message' => 'Experiment resource file not found'], 404);
            }

            // 检查是否为Office文档类型或PDF
            $previewTypes = ['doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'pdf'];
            if (!in_array(strtolower($resource->c_type), $previewTypes)) {
                return response()->json(['code' => 400, 'message' => '文件类型不支持在线预览'], 400);
            }

            // 获取文件的完整URL
            $fileUrl = url("/api/study/experiment-resources/{$c_resource_id}?disposition=inline");
            
            // 如果是PDF文件，直接使用浏览器内置PDF查看器
            if (strtolower($resource->c_type) === 'pdf') {
                return redirect($fileUrl);
            }
            
            // 对于Office文件，提供友好的提示和下载选项
            $downloadUrl = url("/api/study/experiment-resources/{$c_resource_id}?disposition=attachment");
            $inlineUrl = url("/api/study/experiment-resources/{$c_resource_id}?disposition=inline");
            
            $html = <<<HTML
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{$resource->c_resource_name} - 文件预览</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body { 
            margin: 0; 
            padding: 0; 
            height: 100vh; 
            display: flex; 
            flex-direction: column; 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }
        
        .header {
            background: rgba(255, 255, 255, 0.95);
            padding: 20px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            backdrop-filter: blur(10px);
        }
        
        .file-info {
            display: flex;
            align-items: center;
            gap: 15px;
            max-width: 800px;
            margin: 0 auto;
            width: 100%;
        }
        
        .file-icon {
            width: 48px;
            height: 48px;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            font-size: 20px;
            color: white;
        }
        
        .file-icon.docx,
        .file-icon.doc { background: linear-gradient(135deg, #2b579a, #1e3f6f); }
        .file-icon.pptx,
        .file-icon.ppt { background: linear-gradient(135deg, #d04727, #a0351f); }
        .file-icon.xlsx,
        .file-icon.xls { background: linear-gradient(135deg, #217346, #155a2f); }
        .file-icon.pdf { background: linear-gradient(135deg, #ea4335, #c62828); }
        
        .file-details h1 {
            font-size: 18px;
            font-weight: 600;
            color: #333;
            margin-bottom: 5px;
        }
        
        .file-details .file-type-badge {
            background: #e3f2fd;
            color: #1976d2;
            padding: 4px 12px;
            border-radius: 16px;
            font-size: 12px;
            font-weight: 500;
            display: inline-block;
        }
        
        .preview-container {
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 40px 20px;
        }
        
        .preview-card {
            background: white;
            padding: 50px;
            border-radius: 16px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.1);
            text-align: center;
            max-width: 500px;
            width: 100%;
            animation: fadeIn 0.5s ease-out;
        }
        
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }
        
        .preview-icon {
            width: 80px;
            height: 80px;
            margin: 0 auto 30px;
            border-radius: 16px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 36px;
            color: white;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }
        
        .preview-icon.docx,
        .preview-icon.doc { background: linear-gradient(135deg, #2b579a, #1e3f6f); }
        .preview-icon.pptx,
        .preview-icon.ppt { background: linear-gradient(135deg, #d04727, #a0351f); }
        .preview-icon.xlsx,
        .preview-icon.xls { background: linear-gradient(135deg, #217346, #155a2f); }
        .preview-icon.pdf { background: linear-gradient(135deg, #ea4335, #c62828); }
        
        .preview-title {
            font-size: 24px;
            font-weight: 700;
            color: #333;
            margin-bottom: 10px;
        }
        
        .preview-subtitle {
            font-size: 16px;
            color: #666;
            margin-bottom: 40px;
            line-height: 1.5;
        }
        
        .action-buttons {
            display: flex;
            gap: 15px;
            justify-content: center;
            flex-wrap: wrap;
            margin-bottom: 30px;
        }
        
        .btn {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 14px 28px;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 600;
            text-decoration: none;
            cursor: pointer;
            transition: all 0.3s ease;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        
        .btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        }
        
        .btn:active {
            transform: translateY(0);
        }
        
        .btn-primary {
            background: linear-gradient(135deg, #1976d2, #1565c0);
            color: white;
        }
        
        .btn-secondary {
            background: linear-gradient(135deg, #f5f5f5, #e0e0e0);
            color: #333;
        }
        
        .btn-danger {
            background: linear-gradient(135deg, #f44336, #d32f2f);
            color: white;
        }
        
        .info-section {
            margin-top: 30px;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 12px;
            text-align: left;
        }
        
        .info-section h3 {
            font-size: 16px;
            font-weight: 600;
            color: #333;
            margin-bottom: 10px;
        }
        
        .info-section ul {
            list-style: none;
            color: #666;
            font-size: 14px;
            line-height: 1.6;
        }
        
        .info-section li {
            margin-bottom: 5px;
            padding-left: 20px;
            position: relative;
        }
        
        .info-section li::before {
            content: "•";
            color: #1976d2;
            font-weight: bold;
            position: absolute;
            left: 0;
        }
        
        .file-size {
            font-size: 14px;
            color: #888;
            margin-top: 10px;
        }
        
        @media (max-width: 600px) {
            .preview-card {
                margin: 20px;
                padding: 30px 20px;
            }
            
            .action-buttons {
                flex-direction: column;
                align-items: stretch;
            }
            
            .btn {
                justify-content: center;
            }
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="file-info">
            <div class="file-icon {$resource->c_type}">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20M13,13V7.5L18.5,13H13Z"/>
                </svg>
            </div>
            <div class="file-details">
                <h1>{$resource->c_resource_name}</h1>
                <span class="file-type-badge">.{$resource->c_type}</span>
            </div>
        </div>
    </div>
    
    <div class="preview-container">
        <div class="preview-card">
            <div class="preview-icon {$resource->c_type}">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20M13,13V7.5L18.5,13H13Z"/>
                </svg>
            </div>
            
            <div class="preview-title">{$resource->c_resource_name}</div>
            <div class="preview-subtitle">
                该文件为{$resource->c_type}格式，需要相应的应用程序才能查看。请选择以下操作：
            </div>
            
            <div class="action-buttons">
                <a href="{$downloadUrl}" class="btn btn-primary" download="{$resource->c_resource_name}">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M5,20H19V18H5M19,9H15V3H9V9H5L12,16L19,9Z"/>
                    </svg>
                    下载文件
                </a>
            </div>
            
            <div class="info-section">
                <h3>💡 使用提示</h3>
                <ul>
                    <li>Microsoft Office (Word/PowerPoint/Excel)</li>
                    <li>WPS Office（免费且兼容性好）</li>
                    <li>LibreOffice（开源免费）</li>
                    <li>在线Office应用（无需安装）</li>
                </ul>
            </div>
        </div>
    </div>
    
    <script>
        // 页面加载完成后的初始化
        document.addEventListener('DOMContentLoaded', function() {
            // 如果是iframe，通知父窗口预览已加载
            if (window.parent && window.parent !== window) {
                window.parent.postMessage('previewLoaded', '*');
            }
        });
        
        // 下载完成后的处理
        document.querySelectorAll('a[download]').forEach(link => {
            link.addEventListener('click', function() {
                // 可以在这里添加下载成功的提示
                setTimeout(() => {
                    if (window.parent && window.parent !== window) {
                        window.parent.postMessage('downloadComplete', '*');
                    }
                }, 1000);
            });
        });
    </script>
</body>
</html>
HTML;

            return response($html)->header('Content-Type', 'text/html');
        } catch (\Exception $e) {
            Log::error('[CONTROLLER] ExperimentResourceController::officePreview: ' . $e->getMessage(), [
                'c_resource_id' => $c_resource_id,
                'trace' => $e->getTraceAsString(),
            ]);
            return response()->json([
                'code' => 500,
                'message' => 'Failed to generate office preview: ' . $e->getMessage(),
            ], 500);
        }
    }
}
