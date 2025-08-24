<?php
namespace App\Http\Controllers\Course;

use App\Http\Controllers\Controller;
use App\Models\Course\ResourceModel;
use App\Utils\GlobalResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Database\QueryException;
use Illuminate\Support\Str;

class ResourceController extends Controller
{
    // 修改：添加 $courseId 参数，调整验证逻辑为查询参数
    public function index(Request $request, $courseId)
    {
        try {
            // 修改：从查询参数和 URL 参数合并验证，移除 JSON 验证
            $validator = Validator::make(array_merge($request->query(), ['c_course_id' => $courseId]), [
                'c_course_id' => 'required|string|exists:c_courses,c_course_id',
                'page' => 'integer|min:1',
                'pageSize' => 'integer|min:1',
            ]);
            // 修改：添加详细日志记录验证失败
            if ($validator->fails()) {
                Log::error('Validation failed in ResourceController::index', [
                    'errors' => $validator->errors()->toArray(),
                    'courseId' => $courseId,
                    'query' => $request->query()
                ]);
                return response()->json([
                    'code' => 422,
                    'message' => $validator->errors()->first(),
                ], 422);
            }

            // 修改：从查询参数获取 page 和 pageSize，courseId 直接使用
            $reqData = $request->query();
            $modelRes = ResourceModel::getResourcesByCourseId($courseId, $reqData['page'] ?? 1, $reqData['pageSize'] ?? 10);
            return response()->json($modelRes, $modelRes['code'] == 200 ? 200 : 500);
        } catch (\Exception $e) {
            Log::error('[CONTROLLER] ResourceController::index: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
            ]);
            return response()->json([
                'code' => 500,
                'message' => 'Unexpected error in ResourceController::index: ' . $e->getMessage(),
                'error_details' => [
                    'error' => $e->getMessage(),
                ],
            ], 500);
        }
    }

    // 未修改：保持原样
    public function show(Request $request, $id)
    {
        $modelRes = ResourceModel::getResourceById($id);
        return response()->json($modelRes, $modelRes['code'] == 200 ? 200 : 404);
    }

    // 未修改：保持原样
    public function getResource($id)
    {
        $modelRes = ResourceModel::getResourceById($id);
        if ($modelRes['code'] != 200) {
            return response()->json($modelRes, 404);
        }

        $path = $modelRes['data']['c_resource_path'];
        if (!Storage::disk('local_resources')->exists($path)) {
            return response()->json([
                'code' => 404,
                'message' => 'Resource file not found.',
            ], 404);
        }

        return response()->file(Storage::disk('local_resources')->path($path));
    }

    // 未修改：保持原样
    public function store(Request $request)
    {
        $validator = Validator::make($request->json()->all(), [
            'c_course_id' => 'required|string|exists:c_courses,c_course_id',
            'c_resource_name' => 'required|string|max:255',
            'c_resource_path' => 'required|string',
            'c_type' => 'required|string',
            'c_size' => 'nullable|integer|min:0',
        ]);
        if ($validator->fails()) {
            return response()->json([
                'code' => 422,
                'message' => $validator->errors()->first(),
            ], 422);
        }

        $modelRes = ResourceModel::store($request->json()->all());
        return response()->json($modelRes, $modelRes['code'] == 201 ? 201 : 500);
    }

    // 未修改：保持原样
    public function upload(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'c_course_id' => 'required|string|exists:c_courses,c_course_id',
            'file' => 'required|file|mimes:pdf,jpg,jpeg,png,doc,docx,mp4,pptx,avi|max:102400',
        ]);
        if ($validator->fails()) {
            return response()->json([
                'code' => 422,
                'message' => $validator->errors()->first(),
            ], 422);
        }

        try {
            $courseId = $request->input('c_course_id');
            $file = $request->file('file');
            $course = DB::table('c_courses')->where('c_course_id', $courseId)->first();
            if (!$course) {
                return response()->json([
                    'code' => 404,
                    'message' => 'Course not found.',
                ], 404);
            }

            $originalName = $file->getClientOriginalName();
            $targetPath = 'courses/' . $course->c_category_id . '/' . $courseId;
            $fileName = $originalName;

            // 检查是否已存在同名文件
            $counter = 1;
            while (Storage::disk('local_resources')->exists($targetPath . '/' . $fileName)) {
                $fileName = pathinfo($originalName, PATHINFO_FILENAME) . '_' . $counter . '.' . $file->getClientOriginalExtension();
                $counter++;
            }

            $data = [
                'c_course_id' => $courseId,
                'c_resource_name' => $originalName,
                'c_resource_path' => Storage::disk('local_resources')->putFileAs($targetPath, $file, $fileName),
                'c_type' => $file->getMimeType(),
                'c_size' => $file->getSize(),
            ];
            $modelRes = ResourceModel::store($data);
            if ($modelRes['code'] != 201) {
                return response()->json($modelRes, 500);
            }

            return response()->json([
                'code' => 201,
                'message' => 'Resource uploaded successfully.',
                'data' => $modelRes['data'],
            ], 201);
        } catch (QueryException $e) {
            Log::error('[DATABASE] uploadResource: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
                'file_name' => $file->getClientOriginalName(),
                'file_size' => $file->getSize(),
                'mime_type' => $file->getMimeType(),
            ]);
            return response()->json([
                'code' => 500,
                'message' => 'Failed to upload resource: ' . $e->getMessage(),
                'error_details' => [
                    'sql_error' => $e->getMessage(),
                    'sql_code' => $e->getCode(),
                ],
            ], 500);
        } catch (\Exception $e) {
            Log::error('[GENERAL] uploadResource: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
                'file_name' => $file->getClientOriginalName(),
                'file_size' => $file->getSize(),
                'mime_type' => $file->getMimeType(),
            ]);
            return response()->json([
                'code' => 500,
                'message' => 'Unexpected error occurred: ' . $e->getMessage(),
                'error_details' => [
                    'error' => $e->getMessage(),
                ],
            ], 500);
        }
    }

    // 未修改：保持原样
    public function destroy(Request $request, $id)
    {
        $modelRes = ResourceModel::deleteResource($id);
        return response()->json($modelRes, $modelRes['code'] == 200 ? 200 : 404);
    }
    public function viewResource(Request $request, $c_resource_id)
    {
        try {
            $validator = Validator::make(['c_resource_id' => $c_resource_id], [
                'c_resource_id' => 'required|string|uuid',
            ]);
            if ($validator->fails()) {
                Log::error('Validation failed in ResourceController::viewResource', [
                    'errors' => $validator->errors()->toArray(),
                    'c_resource_id' => $c_resource_id,
                ]);
                return response()->json(['code' => 422, 'message' => $validator->errors()->first()], 422);
            }

            $modelRes = ResourceModel::getResourceById($c_resource_id);
            if ($modelRes['code'] != 200) {
                Log::error('Resource not found in ResourceController::viewResource', [
                    'c_resource_id' => $c_resource_id,
                ]);
                return response()->json($modelRes, $modelRes['code']);
            }

            $resource = $modelRes['data'];
            $downloadUrl = url("/api/study/resources/{$c_resource_id}?disposition=attachment");
            $viewUrl = url("/api/study/resources/{$c_resource_id}?disposition=inline");

            // 检查文件类型（使用扩展名以保持一致性）
            $isImage = in_array($resource['c_type'], ['jpg', 'jpeg', 'png']);
            $isPdf = $resource['c_type'] === 'pdf';
            $isVideo = in_array($resource['c_type'], ['mp4', 'avi']);
            $isWord = in_array($resource['c_type'], ['doc', 'docx']);
            $isPptx = $resource['c_type'] === 'pptx';

            if ($isImage) {
                $viewerContent = "<img src='{$viewUrl}' style='max-width: 100%; max-height: 100%; object-fit: contain;' alt='{$resource['c_resource_name']}'>";
            } elseif ($isPdf) {
                $viewerContent = "<embed src='{$viewUrl}' type='application/pdf' width='100%' height='100%' />";
            } elseif ($isVideo) {
                $viewerContent = "<video controls width='100%' height='auto'><source src='{$viewUrl}' type='video/{$resource['c_type']}' />您的浏览器不支持视频播放。</video>";
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
    <title>{$resource['c_resource_name']}.{$resource['c_type']}</title>  <!-- 显示完整文件名 -->
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
            Log::error('[CONTROLLER] ResourceController::viewResource: ' . $e->getMessage(), [
                'c_resource_id' => $c_resource_id,
                'trace' => $e->getTraceAsString(),
            ]);
            return response()->json(['code' => 500, 'message' => 'Failed to view resource'], 500);
        }
    }


    public function download(Request $request, $c_resource_id)
    {
        try {
            $validator = Validator::make(['c_resource_id' => $c_resource_id], [
                'c_resource_id' => 'required|string|uuid',
            ]);
            if ($validator->fails()) {
                Log::error('Validation failed in ResourceController::download', [
                    'errors' => $validator->errors()->toArray(),
                    'c_resource_id' => $c_resource_id,
                ]);
                return response()->json([
                    'code' => 422,
                    'message' => $validator->errors()->first(),
                ], 422);
            }

            $modelRes = ResourceModel::getResourceById($c_resource_id);
            if ($modelRes['code'] != 200) {
                Log::error('Resource not found in ResourceController::download', [
                    'c_resource_id' => $c_resource_id,
                ]);
                return response()->json($modelRes, $modelRes['code']);
            }

            $resource = $modelRes['data'];
            $path = $resource['c_resource_path'];

            if (!Storage::disk('local_resources')->exists($path)) {
                Log::error('Resource file not found in ResourceController::download', [
                    'c_resource_id' => $c_resource_id,
                    'path' => $path,
                ]);
                return response()->json([
                    'code' => 404,
                    'message' => 'Resource file not found.',
                ], 404);
            }

            $disposition = $request->query('disposition', 'attachment');
            $contentType = $resource['c_type'] ?: 'application/octet-stream';
            $downloadFileName = $resource['c_resource_name'];
            $encodedFileName = rawurlencode($downloadFileName);

            Log::info('Serving resource', [
                'c_resource_id' => $c_resource_id,
                'path' => $path,
                'file_name' => $downloadFileName,
                'disposition' => $disposition,
                'content_type' => $contentType,
            ]);

            // 确保 disposition=inline 时不强制下载
            return Storage::disk('local_resources')->response($path, $downloadFileName, [
                'Content-Type' => $contentType,
                'Content-Disposition' => $disposition === 'inline' ? 'inline' : "attachment; filename*=UTF-8''{$encodedFileName}",
            ]);
        } catch (\Exception $e) {
            Log::error('[CONTROLLER] ResourceController::download: ' . $e->getMessage(), [
                'c_resource_id' => $c_resource_id,
                'trace' => $e->getTraceAsString(),
            ]);
            return response()->json([
                'code' => 500,
                'message' => 'Unexpected error in ResourceController::download: ' . $e->getMessage(),
            ], 500);
        }
    }
}
