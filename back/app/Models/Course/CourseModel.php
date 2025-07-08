<?php

namespace App\Models\Course;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Database\QueryException;
use App\Utils\GlobalResponse;

class CourseModel extends Model
{
    protected $table = 'c_courses';
    protected $primaryKey = 'c_course_id';
    protected $keyType = 'string';
    public $incrementing = false;

    /**
     * Get all courses with pagination and optional keyword search.
     *
     * @param int $page
     * @param int $pageSize
     * @param string|null $keyword
     * @return array
     */
    public static function getAllCourses(int $page = 1, int $pageSize = 10, ?string $keyword = null): array
    {
        $offset = ($page - 1) * $pageSize;
        try {
            $query = DB::table('c_courses');
            $countQuery = DB::table('c_courses');

            if (!empty($keyword)) {
                $query->where(function ($q) use ($keyword) {
                    $q->where('c_course_name', 'LIKE', "%{$keyword}%")
                      ->orWhere('c_description', 'LIKE', "%{$keyword}%");
                });
                $countQuery->where(function ($q) use ($keyword) {
                    $q->where('c_course_name', 'LIKE', "%{$keyword}%")
                      ->orWhere('c_description', 'LIKE', "%{$keyword}%");
                });
            }

            $courses = $query->limit($pageSize)->offset($offset)->get()->toArray();
            $total = $countQuery->count();

            return [
                'code' => GlobalResponse::$DATABASE_SUCCESS_CODE,
                'data' => [
                    'courses' => $courses,
                    'total' => $total,
                    'page' => $page,
                    'pageSize' => $pageSize,
                ],
            ];
        } catch (QueryException $e) {
            Log::error('[DATABASE] getAllCourses: ' . $e->getMessage());
            return [
                'code' => GlobalResponse::$DATABASE_ERROR_CODE,
                'message' => 'Failed to retrieve courses.',
            ];
        }
    }

    /**
     * Get a course by ID.
     *
     * @param string $id
     * @return array
     */
    public static function getCourseById(string $id): array
    {
        try {
            $course = DB::table('c_courses')->where('c_course_id', $id)->first();
            return [
                'code' => GlobalResponse::$DATABASE_SUCCESS_CODE,
                'data' => $course ?: null,
            ];
        } catch (QueryException $e) {
            Log::error('[DATABASE] getCourseById: ' . $e->getMessage());
            return [
                'code' => GlobalResponse::$DATABASE_ERROR_CODE,
                'message' => 'Failed to retrieve course.',
            ];
        }
    }

    /**
     * Insert a new course.
     *
     * @param array $data
     * @return array
     */
    public static function insertCourse(array $data): array
    {
        try {
            if (empty($data['name']) || empty($data['category_id']) || empty($data['c_user_id'])) {
                return [
                    'code' => GlobalResponse::$DATABASE_ERROR_CODE,
                    'message' => 'Missing required fields: name, category_id, or c_user_id.',
                ];
            }

            // Check for duplicate course name
            if (DB::table('c_courses')->where('c_course_name', $data['name'])->exists()) {
                return [
                    'code' => GlobalResponse::$DATABASE_ERROR_CODE,
                    'message' => 'Course name already exists.',
                    'errors' => ['name' => ['The course name has already been taken.']],
                ];
            }

            // Validate category_id and c_user_id existence
            $categoryExists = DB::table('c_course_categories')->where('c_category_id', $data['category_id'])->exists();
            if (!$categoryExists) {
                return [
                    'code' => GlobalResponse::$DATABASE_ERROR_CODE,
                    'message' => 'Invalid category_id: Category does not exist.',
                ];
            }

            $userExists = DB::table('c_users')->where('username', $data['c_user_id'])->exists();
            if (!$userExists) {
                return [
                    'code' => GlobalResponse::$DATABASE_ERROR_CODE,
                    'message' => 'Invalid c_user_id: User does not exist.',
                ];
            }

            DB::beginTransaction();
            // Generate a four-character course ID (e.g., '0101')
            $existingIds = DB::table('c_courses')->pluck('c_course_id')->toArray();
            $newId = sprintf('%04d', count($existingIds) + 1);

            $result = DB::insert(
                "INSERT INTO c_courses (c_course_id, c_course_name, c_description, c_category_id, c_user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NOW(), NOW())",
                [$newId, $data['name'], $data['description'] ?? null, $data['category_id'], $data['c_user_id']]
            );

            // Insert into c_courses_users
            $userResult = DB::insert(
                "INSERT INTO c_courses_users (c_user_id, c_course_id) VALUES (?, ?)",
                [$data['c_user_id'], $newId]
            );

            DB::commit();

            return [
                'code' => $result && $userResult ? GlobalResponse::$DATABASE_SUCCESS_CODE : GlobalResponse::$DATABASE_ERROR_CODE,
                'data' => ['c_course_id' => $newId],
            ];
        } catch (QueryException $e) {
            DB::rollBack();
            Log::error('[DATABASE] insertCourse: ' . $e->getMessage());
            return [
                'code' => GlobalResponse::$DATABASE_ERROR_CODE,
                'message' => 'Failed to insert course: ' . ($e->getCode() == 23000 ? 'Duplicate entry or invalid foreign key.' : $e->getMessage()),
            ];
        }
    }

    /**
     * Partially update a course.
     *
     * @param string $id
     * @param array $data
     * @return array
     */
    public static function updateCoursePartial(string $id, array $data): array
    {
        try {
            $fields = [];
            $params = [];

            if (isset($data['name']) && !empty($data['name'])) {
                // Check for duplicate course name (excluding current course)
                if (DB::table('c_courses')->where('c_course_name', $data['name'])->where('c_course_id', '!=', $id)->exists()) {
                    return [
                        'code' => GlobalResponse::$DATABASE_ERROR_CODE,
                        'message' => 'Course name already exists.',
                        'errors' => ['name' => ['The course name has already been taken.']],
                    ];
                }
                $fields[] = "c_course_name = ?";
                $params[] = $data['name'];
            }

            if (isset($data['description'])) {
                $fields[] = "c_description = ?";
                $params[] = $data['description'];
            }

            if (isset($data['category_id']) && !empty($data['category_id'])) {
                if (!DB::table('c_course_categories')->where('c_category_id', $data['category_id'])->exists()) {
                    return [
                        'code' => GlobalResponse::$DATABASE_ERROR_CODE,
                        'message' => 'Invalid category_id: Category does not exist.',
                    ];
                }
                $fields[] = "c_category_id = ?";
                $params[] = $data['category_id'];
            }

            if (empty($fields)) {
                return [
                    'code' => GlobalResponse::$DATABASE_ERROR_CODE,
                    'message' => 'No valid fields provided for update.',
                ];
            }

            $sql = "UPDATE c_courses SET " . implode(', ', $fields) . ", updated_at = NOW() WHERE c_course_id = ?";
            $params[] = $id;

            $result = DB::update($sql, $params);
            return [
                'code' => $result ? GlobalResponse::$DATABASE_SUCCESS_CODE : GlobalResponse::$DATABASE_ERROR_CODE,
                'message' => $result ? 'Course updated successfully.' : 'Course not found.',
            ];
        } catch (QueryException $e) {
            Log::error('[DATABASE] updateCoursePartial: ' . $e->getMessage());
            return [
                'code' => GlobalResponse::$DATABASE_ERROR_CODE,
                'message' => 'Failed to update course: ' . ($e->getCode() == 23000 ? 'Invalid foreign key.' : $e->getMessage()),
            ];
        }
    }

    /**
     * Delete a course by ID.
     *
     * @param string $id
     * @return array
     */
    public static function deleteCourse(string $id): array
    {
        try {
            $result = DB::delete("DELETE FROM c_courses WHERE c_course_id = ?", [$id]);
            return [
                'code' => $result ? GlobalResponse::$DATABASE_SUCCESS_CODE : GlobalResponse::$DATABASE_ERROR_CODE,
                'message' => $result ? 'Course deleted successfully.' : 'Course not found.',
            ];
        } catch (QueryException $e) {
            Log::error('[DATABASE] deleteCourse: ' . $e->getMessage());
            return [
                'code' => GlobalResponse::$DATABASE_ERROR_CODE,
                'message' => 'Failed to delete course.',
            ];
        }
    }

    /**
     * Add a user to a course (c_courses_users).
     *
     * @param string $courseId
     * @param string $c_user_id
     * @return array
     */
    public static function addUserToCourse(string $courseId, string $c_user_id): array
    {
        try {
            if (!DB::table('c_users')->where('username', $c_user_id)->exists()) {
                return [
                    'code' => GlobalResponse::$DATABASE_ERROR_CODE,
                    'message' => 'Invalid c_user_id: User does not exist.',
                ];
            }

            if (!DB::table('c_courses')->where('c_course_id', $courseId)->exists()) {
                return [
                    'code' => GlobalResponse::$DATABASE_ERROR_CODE,
                    'message' => 'Invalid c_course_id: Course does not exist.',
                ];
            }

            if (DB::table('c_courses_users')->where('c_user_id', $c_user_id)->where('c_course_id', $courseId)->exists()) {
                return [
                    'code' => GlobalResponse::$DATABASE_ERROR_CODE,
                    'message' => 'User is already enrolled in the course.',
                ];
            }

            $result = DB::insert(
                "INSERT INTO c_courses_users (c_user_id, c_course_id) VALUES (?, ?)",
                [$c_user_id, $courseId]
            );
            return [
                'code' => $result ? GlobalResponse::$DATABASE_SUCCESS_CODE : GlobalResponse::$DATABASE_ERROR_CODE,
                'message' => $result ? 'User added to course successfully.' : 'Failed to add user to course.',
            ];
        } catch (QueryException $e) {
            Log::error('[DATABASE] addUserToCourse: ' . $e->getMessage());
            return [
                'code' => GlobalResponse::$DATABASE_ERROR_CODE,
                'message' => 'Failed to add user to course: ' . ($e->getCode() == 23000 ? 'Duplicate entry or invalid foreign key.' : $e->getMessage()),
            ];
        }
    }
}