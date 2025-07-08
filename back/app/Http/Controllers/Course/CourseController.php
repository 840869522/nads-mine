<?php

namespace App\Http\Controllers\Course;

use Illuminate\Http\Request;
use App\Models\Course\CourseModel;
use Illuminate\Http\JsonResponse;
use App\Http\Controllers\Controller;
use App\Utils\GlobalResponse;
use Illuminate\Validation\ValidationException;

class CourseController extends Controller
{
    /**
     * Display a listing of courses.
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function index(Request $request): JsonResponse
    {
        try {
            $request->validate([
                'page' => 'integer|min:1',
                'pageSize' => 'integer|min:1|max:100',
                'keyword' => 'nullable|string|max:255',
            ]);

            $page = (int) $request->query('page', 1);
            $pageSize = (int) $request->query('pageSize', 10);
            $keyword = $request->query('keyword');

            $response = CourseModel::getAllCourses($page, $pageSize, $keyword);
            return response()->json($response, $response['code'] === GlobalResponse::$DATABASE_SUCCESS_CODE ? 200 : 500);
        } catch (ValidationException $e) {
            return response()->json([
                'code' => 422,
                'message' => 'Validation failed.',
                'errors' => $e->errors(),
            ], 422);
        }
    }

    /**
     * Display the specified course.
     *
     * @param string $id
     * @return JsonResponse
     */
    public function show(string $id): JsonResponse
    {
        $response = CourseModel::getCourseById($id);
        return response()->json($response, $response['code'] === GlobalResponse::$DATABASE_SUCCESS_CODE && $response['data'] ? 200 : 404);
    }

    /**
     * Store a new course.
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function store(Request $request): JsonResponse
    {
        try {
            $request->validate([
                'name' => 'required|string|max:100',
                'description' => 'nullable|string',
                'category_id' => 'required|string|max:2|exists:c_course_categories,c_category_id',
                'c_user_id' => 'required|string|max:50|exists:c_users,username',
            ]);

            $response = CourseModel::insertCourse([
                'name' => $request->input('name'),
                'description' => $request->input('description'),
                'category_id' => $request->input('category_id'),
                'user_id' => $request->input('c_user_id'),
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
     * Update the specified course.
     *
     * @param Request $request
     * @param string $id
     * @return JsonResponse
     */
    public function update(Request $request, string $id): JsonResponse
    {
        try {
            $request->validate([
                'name' => 'nullable|string|max:100',
                'description' => 'nullable|string',
                'category_id' => 'nullable|string|max:2|exists:c_course_categories,c_category_id',
            ]);

            $data = array_filter([
                'name' => $request->input('name'),
                'description' => $request->input('description'),
                'category_id' => $request->input('category_id'),
            ], fn($value) => !is_null($value));

            if (empty($data)) {
                return response()->json([
                    'code' => 422,
                    'message' => 'No fields provided for update.',
                ], 422);
            }

            $response = CourseModel::updateCoursePartial($id, $data);
            return response()->json($response, $response['code'] === GlobalResponse::$DATABASE_SUCCESS_CODE ? 200 : 500);
        } catch (ValidationException $e) {
            return response()->json([
                'code' => 422,
                'message' => 'Validation failed.',
                'errors' => $e->errors(),
            ], 422);
        }
    }

    /**
     * Remove the specified course.
     *
     * @param string $id
     * @return JsonResponse
     */
    public function destroy(string $id): JsonResponse
    {
        $response = CourseModel::deleteCourse($id);
        return response()->json($response, $response['code'] === GlobalResponse::$DATABASE_SUCCESS_CODE ? 200 : 404);
    }

    /**
     * Add a user to a course.
     *
     * @param Request $request
     * @param string $courseId
     * @return JsonResponse
     */
    public function addUser(Request $request, string $courseId): JsonResponse
    {
        try {
            $request->validate([
                'c_user_id' => 'required|string|max:50|exists:c_users,username',
            ]);

            $response = CourseModel::addUserToCourse($courseId, $request->input('c_user_id'));
            return response()->json($response, $response['code'] === GlobalResponse::$DATABASE_SUCCESS_CODE ? 201 : 500);
        } catch (ValidationException $e) {
            return response()->json([
                'code' => 422,
                'message' => 'Validation failed.',
                'errors' => $e->errors(),
            ], 422);
        }
    }
}