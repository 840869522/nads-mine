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
    public function index(Request $request)
    {
        try {
            $validator = Validator::make($request->json()->all(), [
                'c_course_id' => 'required|string|exists:c_courses,c_course_id',
                'page' => 'integer|min:1',
                'pageSize' => 'integer|min:1',
            ]);
            if ($validator->fails()) {
                return response()->json([
                    'code' => 422,
                    'message' => $validator->errors()->first(),
                ], 422);
            }

            $reqData = $request->json()->all();
            $modelRes = ResourceModel::getResourcesByCourseId($reqData['c_course_id'], $reqData['page'] ?? 1, $reqData['pageSize'] ?? 10);
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

    public function show(Request $request, $id)
    {
        $modelRes = ResourceModel::getResourceById($id);
        return response()->json($modelRes, $modelRes['code'] == 200 ? 200 : 404);
    }

    public function getResource($id)
    {
        $modelRes = ResourceModel::getResourceById($id);
        if ($modelRes['code'] != 200) {
            return response()->json($modelRes, 404);
        }

        $path = $modelRes['data']['c_resource_path'];
        if (!Storage::disk('public')->exists($path)) {
            return response()->json([
                'code' => 404,
                'message' => 'Resource file not found.',
            ], 404);
        }

        return response()->file(Storage::disk('public')->path($path));
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->json()->all(), [
            'c_course_id' => 'required|string|exists:c_courses,c_course_id',
            'name' => 'required|string|max:255',
            'path' => 'required|string',
            'type' => 'required|string',
            'size' => 'nullable|integer|min:0',
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

    public function upload(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'c_course_id' => 'required|string|exists:c_courses,c_course_id',
            'file' => 'required|file|mimes:pdf,jpg,jpeg,png,doc,docx|max:10240',
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

            $data = [
                'c_course_id' => $courseId,
                'c_resource_name' => $file->getClientOriginalName(),
                'c_resource_path' => Storage::disk('public')->putFile('web/' . $course->c_category_id . '/' . $courseId, $file),
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

    public function destroy(Request $request, $id)
    {
        $modelRes = ResourceModel::deleteResource($id);
        return response()->json($modelRes, $modelRes['code'] == 200 ? 200 : 404);
    }
}
