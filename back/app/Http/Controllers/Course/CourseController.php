<?php
namespace App\Http\Controllers\Course;

use App\Http\Controllers\Controller;
use App\Models\Course\CourseModel;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Log;

class CourseController extends Controller
{
    public function index(Request $request)
    {
        try {
            // 从查询参数获取数据，而不是 JSON body
            $validator = Validator::make($request->query(), [
                'page' => 'integer|min:1',
                'pageSize' => 'integer|min:1',
                'keyword' => 'nullable|string|max:100',
                'c_category_id' => 'nullable|string|size:2',
            ]);
            if ($validator->fails()) {
                return response()->json([
                    'code' => 422,
                    'message' => $validator->errors()->first(),
                ], 422);
            }

            $page = $request->query('page', 1);
            $pageSize = $request->query('pageSize', 10);
            $keyword = $request->query('keyword');
            $category_id = $request->query('c_category_id');

            $modelRes = CourseModel::getAllCourses($page, $pageSize, $keyword, $category_id);
            return response()->json($modelRes, $modelRes['code'] == 200 ? 200 : 500);
        } catch (\Exception $e) {
            Log::error('[CONTROLLER] CourseController::index: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
            ]);
            return response()->json([
                'code' => 500,
                'message' => 'Unexpected error in CourseController::index: ' . $e->getMessage(),
                'error_details' => [
                    'error' => $e->getMessage(),
                ],
            ], 500);
        }
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->json()->all(), [
            'c_course_name' => 'required|string|max:100|unique:c_courses,c_course_name',
            'c_description' => 'nullable|string',
            'c_category_id' => 'required|string|size:2|exists:c_course_categories,c_category_id',
        ]);
        if ($validator->fails()) {
            return response()->json([
                'code' => 422,
                'message' => $validator->errors()->first(),
            ], 422);
        }
        $modelRes = CourseModel::insertCourse($request->json()->all());
        return response()->json($modelRes, $modelRes['code'] == 201 ? 201 : 500);
    }

    public function show($id)
    {
        $modelRes = CourseModel::getCourseById($id);
        return response()->json($modelRes, $modelRes['code'] == 200 ? 200 : 404);
    }

    public function update(Request $request, $id)
    {
        $validator = Validator::make($request->json()->all(), [
            'c_course_name' => 'required|string|max:100|unique:c_courses,c_course_name,' . $id . ',c_course_id',
            'c_description' => 'nullable|string',
            'c_category_id' => 'required|string|size:2|exists:c_course_categories,c_category_id',
        ]);
        if ($validator->fails()) {
            return response()->json([
                'code' => 422,
                'message' => $validator->errors()->first(),
            ], 422);
        }
        $modelRes = CourseModel::updateCoursePartial($id, $request->json()->all());
        return response()->json($modelRes, $modelRes['code'] == 200 ? 200 : 500);
    }

    public function destroy($id)
    {
        $modelRes = CourseModel::deleteCourse($id);
        return response()->json($modelRes, $modelRes['code'] == 200 ? 200 : 404);
    }

}
