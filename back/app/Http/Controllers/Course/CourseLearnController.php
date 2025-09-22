<?php
namespace App\Http\Controllers\Course;

use App\Http\Controllers\Controller;
use App\Models\Course\CourseLearnModel;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Log;

class CourseLearnController extends Controller
{
    public function index(Request $request)
    {
        try {
            // 复制 CourseController::index 的验证和逻辑，但调用 CourseLearnModel::getAllCourses
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

            $modelRes = CourseLearnModel::getAllCourses($page, $pageSize, $keyword, $category_id);
            return response()->json($modelRes, $modelRes['code'] == 200 ? 200 : 500);
        } catch (\Exception $e) {
            Log::error('[CONTROLLER] CourseLearnController::index: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
            ]);
            return response()->json([
                'code' => 500,
                'message' => 'Unexpected error in CourseLearnController::index: ' . $e->getMessage(),
            ], 500);
        }
    }
}
