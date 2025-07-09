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
    public function __construct()
    {
        $this->middleware('jwtcheck:view-resources')->only(['index', 'show', 'getResource']);
        $this->middleware('jwtcheck:manage-resources')->only(['store', 'upload', 'destroy']);
    }

    /**
     * Get resources by course ID.
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function index(Request $request)
    {
        $validator = Validator::make($request->json()->all(), [
            'course_id' => 'required|string|size:5|exists:c_courses,c_course_id',
            'page' => 'integer|min:1',
            'pageSize' => 'integer|min:1',
        ]);
        if ($validator->fails()) {
            return response()->json([
                'code' => GlobalResponse::$HTTP_REQUEST_ERROR_CODE,
                'message' => $validator->errors()->first(),
            ], 422);
        }

        $reqData = $request->json()->all();
        $modelRes = ResourceModel::getResourcesByCourseId($reqData['course_id'], $reqData['page'] ?? 1, $reqData['pageSize'] ?? 10);
        return response()->json($modelRes, $modelRes['code'] == GlobalResponse::$DATABASE_SUCCESS_CODE ? 200 : 500);
    }

    /**
     * Get a resource by ID.
     *
     * @param Request $request
     * @param string $id
     * @return \Illuminate\Http\JsonResponse
     */
    public function show(Request $request, $id)
    {
        $modelRes = ResourceModel::getResourceById($id);
        return response()->json($modelRes, $modelRes['code'] == GlobalResponse::$DATABASE_SUCCESS_CODE ? 200 : 404);
    }

    /**
     * Get a resource file by ID.
     *
     * @param string $id
     * @return \Illuminate\Http\Response
     */
    public function getResource($id)
    {
        $modelRes = ResourceModel::getResourceById($id);
        if ($modelRes['code'] != GlobalResponse::$DATABASE_SUCCESS_CODE) {
            return response()->json($modelRes, 404);
        }

        $path = $modelRes['data']['c_resource_path'];
        if (!Storage::disk('public')->exists($path)) {
            return response()->json([
                'code' => GlobalResponse::$DATABASE_ERROR_CODE,
                'message' => 'Resource file not found.',
            ], 404);
        }

        return response()->file(Storage::disk('public')->path($path));
    }

    /**
     * Store a new resource.
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->json()->all(), [
            'course_id' => 'required|string|size:5|exists:c_courses,c_course_id',
            'name' => 'required|string|max:255',
            'path' => 'required|string',
            'type' => 'required|string',
            'size' => 'nullable|integer|min:0',
        ]);
        if ($validator->fails()) {
            return response()->json([
                'code' => GlobalResponse::$HTTP_REQUEST_ERROR_CODE,
                'message' => $validator->errors()->first(),
            ], 422);
        }

        $modelRes = ResourceModel::store($request->json()->all());
        return response()->json($modelRes, $modelRes['code'] == GlobalResponse::$DATABASE_SUCCESS_CODE ? 201 : 500);
    }

    /**
     * Upload resources for a course.
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function upload(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'course_id' => 'required|string|size:5|exists:c_courses,c_course_id',
            'files.*' => 'required|file|mimes:pdf,jpg,jpeg,png,doc,docx|max:10240', // 10MB max
        ]);
        if ($validator->fails()) {
            return response()->json([
                'code' => GlobalResponse::$HTTP_REQUEST_ERROR_CODE,
                'message' => $validator->errors()->first(),
            ], 422);
        }

        try {
            $courseId = $request->input('course_id');
            $files = $request->file('files');
            $course = DB::table('c_courses')->where('c_course_id', $courseId)->first();
            if (!$course) {
                return response()->json([
                    'code' => GlobalResponse::$HTTP_DATABASE_ERROR_CODE,
                    'message' => 'Course not found.',
                ], 404);
            }

            $uploadedFiles = [];
            foreach ($files as $file) {
                $data = [
                    'course_id' => $courseId,
                    'name' => $file->getClientOriginalName(),
                    'path' => Storage::disk('public')->putFile('web/' . $course->category_id . '/' . $courseId, $file),
                    'type' => $file->getMimeType(),
                    'size' => $file->getSize(),
                ];
                $modelRes = ResourceModel::store($data);
                if ($modelRes['code'] != GlobalResponse::$DATABASE_SUCCESS_CODE) {
                    return response()->json($modelRes, 500);
                }
                $uploadedFiles[] = $modelRes['data'];
            }

            return response()->json([
                'code' => GlobalResponse::$HTTP_STATUS_OK_CODE,
                'message' => 'Resources uploaded successfully.',
                'data' => $uploadedFiles,
            ], 201);
        } catch (QueryException $e) {
            Log::error('[DATABASE] uploadResource: ' . $e->getMessage());
            return response()->json([
                'code' => GlobalResponse::$HTTP_DATABASE_ERROR_CODE,
                'message' => 'Failed to upload resources: ' . $e->getMessage(),
            ], 500);
        } catch (\Exception $e) {
            Log::error('[GENERAL] uploadResource: ' . $e->getMessage());
            return response()->json([
                'code' => GlobalResponse::$HTTP_DATABASE_ERROR_CODE,
                'message' => 'Unexpected error occurred.',
            ], 500);
        }
    }

    /**
     * Delete a resource.
     *
     * @param Request $request
     * @param string $id
     * @return \Illuminate\Http\JsonResponse
     */
    public function destroy(Request $request, $id)
    {
        $modelRes = ResourceModel::deleteResource($id);
        return response()->json($modelRes, $modelRes['code'] == GlobalResponse::$DATABASE_SUCCESS_CODE ? 200 : 404);
    }
}
