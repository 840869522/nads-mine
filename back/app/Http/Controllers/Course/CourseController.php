<?php
namespace App\Http\Controllers\Course;

use App\Http\Controllers\Controller;
use App\Models\Course\CourseModel;
use App\Utils\GlobalResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class CourseController extends Controller
{
    public function __construct()
    {
        $this->middleware('jwtcheck:view-courses')->only(['index', 'show']);
        $this->middleware('jwtcheck:manage-courses')->only(['store', 'update', 'destroy', 'addUserToCourse']);
    }

    /**
     * Get all courses with pagination and filters.
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function index(Request $request)
    {
        //echo 221;die;
        $reqData = $request->json()->all();
        $validator = Validator::make($reqData, [
            'page' => 'integer|min:1',
            'pagesize' => 'integer|min:1',
            'keyword' => 'nullable|string|max:100',
            'category' => 'nullable|string|size:2',
        ]);
        if ($validator->fails()) {
            return response()->json([
                'code' => GlobalResponse::$HTTP_REQUEST_ERROR_CODE,
                'message' => $validator->errors()->first(),
            ], 422);
        }

        $page = $reqData['page'] ?? 1;
        $pagesize = $reqData['pagesize'] ?? 10;
        $keyword = $reqData['keyword'] ?? null;
        $category_id = $reqData['category'] ?? null;

        $modelRes = CourseModel::getAllCourses($page, $pagesize, $keyword, $category_id);
        return response()->json($modelRes, $modelRes['code'] == GlobalResponse::$DATABASE_SUCCESS_CODE ? 200 : 500);
    }

    /**
     * Store a new course.
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->json()->all(), [
            'c_course_name' => 'required|string|max:100|unique:c_courses,c_course_name',
            'c_description' => 'nullable|string',
            'category_id' => 'required|string|size:2|exists:c_course_categories,c_category_id',
            'c_user_id' => 'nullable|string|exists:c_users,c_username',
        ]);
        if ($validator->fails()) {
            return response()->json([
                'code' => GlobalResponse::$HTTP_REQUEST_ERROR_CODE,
                'message' => $validator->errors()->first(),
            ], 422);
        }
        $modelRes = CourseModel::insertCourse($request->json()->all());
        return response()->json($modelRes, $modelRes['code'] == GlobalResponse::$DATABASE_SUCCESS_CODE ? 201 : 500);
    }

    /**
     * Get a course by ID.
     *
     * @param string $id
     * @return \Illuminate\Http\JsonResponse
     */
    public function show($id)
    {
        $modelRes = CourseModel::getCourseById($id);
        return response()->json($modelRes, $modelRes['code'] == GlobalResponse::$DATABASE_SUCCESS_CODE ? 200 : 404);
    }

    /**
     * Update a course.
     *
     * @param Request $request
     * @param string $id
     * @return \Illuminate\Http\JsonResponse
     */
    public function update(Request $request, $id)
    {
        $validator = Validator::make($request->json()->all(), [
            'c_course_name' => 'required|string|max:100|unique:c_courses,c_course_name,' . $id . ',c_course_id',
            'c_description' => 'nullable|string',
            'category_id' => 'required|string|size:2|exists:c_course_categories,c_category_id',
        ]);
        if ($validator->fails()) {
            return response()->json([
                'code' => GlobalResponse::$HTTP_REQUEST_ERROR_CODE,
                'message' => $validator->errors()->first(),
            ], 422);
        }
        $modelRes = CourseModel::updateCoursePartial($id, $request->json()->all());
        return response()->json($modelRes, $modelRes['code'] == GlobalResponse::$DATABASE_SUCCESS_CODE ? 200 : 500);
    }

    /**
     * Delete a course.
     *
     * @param string $id
     * @return \Illuminate\Http\JsonResponse
     */
    public function destroy($id)
    {
        $modelRes = CourseModel::deleteCourse($id);
        return response()->json($modelRes, $modelRes['code'] == GlobalResponse::$DATABASE_SUCCESS_CODE ? 200 : 404);
    }

    /**
     * Add a user to a course.
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function addUserToCourse(Request $request)
    {
        $validator = Validator::make($request->json()->all(), [
            'user_id' => 'required|string|exists:c_users,c_username',
            'course_id' => 'required|string|size:5|exists:c_courses,c_course_id',
        ]);
        if ($validator->fails()) {
            return response()->json([
                'code' => GlobalResponse::$HTTP_REQUEST_ERROR_CODE,
                'message' => $validator->errors()->first(),
            ], 422);
        }

        $reqData = $request->json()->all();
        $modelRes = CourseModel::addUserToCourse($reqData['user_id'], $reqData['course_id']);
        return response()->json($modelRes, $modelRes['code'] == GlobalResponse::$DATABASE_SUCCESS_CODE ? 200 : 400);
    }
}
