<?php
namespace App\Http\Controllers\Course;

use App\Http\Controllers\Controller;
use App\Models\Course\CoursePermissionModel;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Log;

class CoursePermissionController extends Controller
{
    /**
     * 获取所有用户的用户名
     */
    public function getAllUsernames(Request $request)
    {
        try {
            $modelRes = CoursePermissionModel::getAllUsernames();
            return response()->json($modelRes, $modelRes['code'] == 200 ? 200 : 500);
        } catch (\Exception $e) {
            Log::error('[CONTROLLER] CoursePermissionController::getAllUsernames: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
            ]);
            return response()->json([
                'code' => 500,
                'message' => 'Unexpected error in CoursePermissionController::getAllUsernames: ' . $e->getMessage(),
                'error_details' => [
                    'error' => $e->getMessage(),
                ],
            ], 500);
        }
    }

    /**
     * 获取课程的授权用户
     */
    public function getUsers($courseId)
    {
        $modelRes = CoursePermissionModel::getCourseUsers($courseId);
        return response()->json($modelRes, $modelRes['code'] == 200 ? 200 : ($modelRes['code'] == 404 ? 404 : 500));
    }

    /**
     * 批量更新课程的授权用户
     */
    public function syncUsers(Request $request, $courseId)
    {
        $validator = Validator::make($request->json()->all(), [
            'users' => 'required|array',
            'users.*' => 'string|exists:c_users,c_username',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'code' => 422,
                'message' => $validator->errors()->first(),
            ], 422);
        }

        $userIds = $request->json('users', []);
        $modelRes = CoursePermissionModel::syncCourseUsers($courseId, $userIds);
        return response()->json($modelRes, $modelRes['code'] == 200 ? 200 : ($modelRes['code'] == 404 ? 404 : 500));
    }

    /**
     * 添加单个用户到课程
     */
    public function addUserToCourse(Request $request, $courseId)
    {
        $validator = Validator::make($request->json()->all(), [
            'c_username' => 'required|string|exists:c_users,c_username',
        ]);
        if ($validator->fails()) {
            return response()->json([
                'code' => 422,
                'message' => $validator->errors()->first(),
            ], 422);
        }

        $reqData = $request->json()->all();
        $modelRes = CoursePermissionModel::addUserToCourse($reqData['c_username'], $courseId);
        return response()->json($modelRes, $modelRes['code'] == 200 ? 200 : 400);
    }
}
