<?php
namespace App\Http\Controllers\Course;

use App\Http\Controllers\Controller;
use App\Models\Course\CourseLearnModel;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Log;
use App\Utils\JWTControll;
use Illuminate\Support\Facades\Cache;

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

            // 获取当前用户信息
            $authHeader = $request->header("Authorization");
            $username = null;
            $userRoles = [];
            
            if ($authHeader) {
                $jwtResult = JWTControll::decodeJWT($authHeader);
                if ($jwtResult["err"] === null && isset($jwtResult["data"]["id"])) {
                    $username = $jwtResult["data"]["id"];
                    $userRoles = $jwtResult["data"]["role"] ?? [];
                    
                    // 如果有权限缓存，也获取权限信息
                    if (isset($jwtResult["data"]["permission"])) {
                        $cachedData = Cache::get($jwtResult["data"]["permission"]);
                        if ($cachedData) {
                            $userPermissions = array_map(function($item) {
                                if (is_object($item)) return (string)$item->c_id;
                                if (is_array($item)) return (string)($item['c_id'] ?? '');
                                return is_string($item) ? $item : '';
                            }, $cachedData);
                        }
                    }
                }
            }

            $modelRes = CourseLearnModel::getAllCourses($page, $pageSize, $keyword, $category_id, $username, $userRoles);
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