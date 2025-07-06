<?php

namespace App\Http\Controllers\Course;

use Illuminate\Http\Request;
use App\Models\Course\ResourceModel;
use Illuminate\Http\JsonResponse;
use App\Http\Controllers\Controller;
use App\Utils\GlobalResponse;
use Illuminate\Validation\ValidationException;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\DB;

class ResourceController extends Controller
{
    /**
     * Display resources for a course.
     *
     * @param string $courseId
     * @return JsonResponse
     */
    public function index(string $courseId): JsonResponse
    {
        $response = ResourceModel::getResourcesByCourseId($courseId);
        return response()->json($response, $response['code'] === GlobalResponse::$DATABASE_SUCCESS_CODE ? 200 : 500);
    }

    /**
     * Store a new resource.
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function store(Request $request): JsonResponse
    {
        try {
            $request->validate([
                'course_id' => 'required|string|max:4|exists:c_courses,c_course_id',
                'name' => 'required|string|max:255',
                'path' => 'required|string|max:255',
                'type' => 'required|string|max:50',
                'size' => 'nullable|integer|min:0',
            ]);

            $response = ResourceModel::insertResource([
                'course_id' => $request->input('course_id'),
                'name' => $request->input('name'),
                'path' => $request->input('path'),
                'type' => $request->input('type'),
                'size' => $request->input('size'),
            ]);

            return response()->json($response, $response['code'] === GlobalResponse::$DATABASE_SUCCESS_CODE ? 201 : 500);
        } catch (ValidationException $e) {
            return response()->json([
                'code' => 422,
                'message' => 'Validation failed.',
                'errors' => $e->errors(),
            ], 422);
        }
    }

    /**
     * Upload a resource file.
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function upload(Request $request): JsonResponse
    {
        try {
            $request->validate([
                'course_id' => 'required|string|max:4|exists:c_courses,c_course_id',
                'file' => 'required|file|max:102400|mimes:pdf,doc,docx,jpg,jpeg,png,mp4', // 100MB max, restricted file types
            ]);

            $file = $request->file('file');
            $originalName = $file->getClientOriginalName();
            $path = $file->store('uploads/resources', 'public');
            $type = $file->getClientMimeType();
            $size = $file->getSize();

            $response = ResourceModel::insertResource([
                'course_id' => $request->input('course_id'),
                'name' => $originalName,
                'path' => $path,
                'type' => $type,
                'size' => $size,
            ]);

            return response()->json($response, $response['code'] === GlobalResponse::$DATABASE_SUCCESS_CODE ? 201 : 500);
        } catch (ValidationException $e) {
            return response()->json([
                'code' => 422,
                'message' => 'Validation failed.',
                'errors' => $e->errors(),
            ], 422);
        }
    }

    /**
     * Remove the specified resource.
     *
     * @param string $id
     * @return JsonResponse
     */
    public function destroy(string $id): JsonResponse
    {
        try {
            $resource = DB::table('c_course_resources')->where('c_resource_id', $id)->first();
            if ($resource) {
                Storage::disk('public')->delete($resource->c_resource_path);
            }
            $response = ResourceModel::deleteResource($id);
            return response()->json($response, $response['code'] === GlobalResponse::$DATABASE_SUCCESS_CODE ? 200 : 404);
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::error('[CONTROLLER] ResourceController::destroy: ' . $e->getMessage());
            return response()->json([
                'code' => GlobalResponse::$DATABASE_ERROR_CODE,
                'message' => 'Failed to delete resource.',
                'errors' => ['server' => [$e->getMessage()]],
            ], 500);
        }
    }
}