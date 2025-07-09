<?php
namespace App\Models\Course;

use Illuminate\Support\Facades\DB;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\File;
use App\Utils\GlobalResponse;

class CourseModel
{
    /**
     * Get all courses with pagination and filters.
     *
     * @param int $page
     * @param int $pagesize
     * @param ?string $keyword
     * @param ?string $category_id
     * @return array
     */
    public static function getAllCourses(int $page = 1, int $pagesize = 10, ?string $keyword = null, ?string $category_id = null): array
    {
        try {
            if ($page < 1 || $pagesize < 1) {
                return [
                    'code' => GlobalResponse::$DATABASE_ERROR_CODE,
                    'message' => 'Invalid pagination parameters.',
                ];
            }

            $offset = ($page - 1) * $pagesize;
            $query = DB::table('c_courses as c')
                ->join('c_course_categories as cat', 'c.category_id', '=', 'cat.c_category_id')
                ->select('c.c_course_id', 'c.c_course_name', 'c.c_description', 'cat.c_category_name', 'c.created_at as uploadDate', 'c.updated_at');

            $countQuery = DB::table('c_courses as c')
                ->join('c_course_categories as cat', 'c.category_id', '=', 'cat.c_category_id');

            if ($keyword) {
                $query->where('c.c_course_name', 'like', '%' . $keyword . '%');
                $countQuery->where('c.c_course_name', 'like', '%' . $keyword . '%');
            }
            if ($category_id) {
                if (!preg_match('/^\d{2}$/', $category_id)) {
                    return [
                        'code' => GlobalResponse::$DATABASE_ERROR_CODE,
                        'message' => 'Invalid category_id format.',
                    ];
                }
                $query->where('c.category_id', $category_id);
                $countQuery->where('c.category_id', $category_id);
            }

            $courses = $query->orderBy('c.created_at', 'desc')
                ->take($pagesize)
                ->skip($offset)
                ->get();
            $count = $countQuery->count();

            return [
                'code' => GlobalResponse::$DATABASE_SUCCESS_CODE,
                'message' => 'Courses retrieved successfully.',
                'data' => [
                    'courses' => $courses,
                    'total' => $count,
                    'page' => $page,
                    'pageSize' => $pagesize,
                ],
            ];
        } catch (QueryException $e) {
            Log::error('[DATABASE] getAllCourses: ' . $e->getMessage());
            return [
                'code' => GlobalResponse::$DATABASE_ERROR_CODE,
                'message' => 'Failed to retrieve courses: ' . $e->getMessage(),
            ];
        } catch (\Exception $e) {
            Log::error('[GENERAL] getAllCourses: ' . $e->getMessage());
            return [
                'code' => GlobalResponse::$DATABASE_ERROR_CODE,
                'message' => 'Unexpected error occurred.',
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
            // Validate required fields
            if (empty($data['category_id']) || empty($data['c_course_name'])) {
                return [
                    'code' => GlobalResponse::$DATABASE_ERROR_CODE,
                    'message' => 'Missing required fields: category_id or c_course_name.',
                ];
            }

            // Validate category exists and format
            if (!preg_match('/^\d{2}$/', $data['category_id'])) {
                return [
                    'code' => GlobalResponse::$DATABASE_ERROR_CODE,
                    'message' => 'Invalid category_id format: Must be two digits.',
                ];
            }
            $categoryExists = DB::table('c_course_categories')
                ->where('c_category_id', $data['category_id'])
                ->exists();
            if (!$categoryExists) {
                return [
                    'code' => GlobalResponse::$DATABASE_ERROR_CODE,
                    'message' => 'Category does not exist.',
                ];
            }

            // Get existing courses for this category
            $existingCourses = DB::table('c_courses')
                ->where('category_id', $data['category_id'])
                ->pluck('c_course_id')
                ->toArray();

            // Extract sequence numbers and find the next available
            $sequenceNumbers = array_map(function ($courseId) {
                return (int) substr($courseId, -3);
            }, $existingCourses);
            $nextSequence = $sequenceNumbers ? max($sequenceNumbers) + 1 : 1;

            if ($nextSequence > 999) {
                return [
                    'code' => GlobalResponse::$DATABASE_ERROR_CODE,
                    'message' => 'Maximum number of courses reached for this category.',
                ];
            }

            // Generate new course ID (e.g., "01001" for category "01" and sequence "001")
            $newId = $data['category_id'] . sprintf('%03d', $nextSequence);

            // Create course folder
            $courseFolder = public_path('web/' . $data['category_id'] . '/' . $newId);
            if (!File::makeDirectory($courseFolder, 0755, true)) {
                return [
                    'code' => GlobalResponse::$DATABASE_ERROR_CODE,
                    'message' => 'Failed to create course folder.',
                ];
            }

            DB::beginTransaction();
            $result = DB::insert(
                'INSERT INTO c_courses (c_course_id, c_course_name, c_description, category_id, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())',
                [$newId, $data['c_course_name'], $data['c_description'] ?? null, $data['category_id']]
            );

            if ($result && isset($data['c_user_id'])) {
                $userExists = DB::table('c_users')->where('c_username', $data['c_user_id'])->exists();
                if (!$userExists) {
                    DB::rollBack();
                    return [
                        'code' => GlobalResponse::$DATABASE_ERROR_CODE,
                        'message' => 'User does not exist.',
                    ];
                }
                $userResult = DB::insert(
                    'INSERT INTO c_users_courses (user_id, c_course_id, created_at, updated_at) VALUES (?, ?, NOW(), NOW())',
                    [$data['c_user_id'], $newId]
                );
                if (!$userResult) {
                    DB::rollBack();
                    return [
                        'code' => GlobalResponse::$DATABASE_ERROR_CODE,
                        'message' => 'Failed to associate user with course.',
                    ];
                }
            }

            DB::commit();
            return [
                'code' => GlobalResponse::$DATABASE_SUCCESS_CODE,
                'message' => 'Course created successfully.',
                'data' => ['id' => $newId],
            ];
        } catch (QueryException $e) {
            DB::rollBack();
            Log::error('[DATABASE] insertCourse: ' . $e->getMessage());
            return [
                'code' => GlobalResponse::$DATABASE_ERROR_CODE,
                'message' => $e->getCode() == 23000 ? 'Course name or category ID issue.' : 'Failed to create course: ' . $e->getMessage(),
            ];
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('[GENERAL] insertCourse: ' . $e->getMessage());
            return [
                'code' => GlobalResponse::$DATABASE_ERROR_CODE,
                'message' => 'Unexpected error occurred.',
            ];
        }
    }

    /**
     * Update a course partially.
     *
     * @param string $id
     * @param array $data
     * @return array
     */
    public static function updateCoursePartial(string $id, array $data): array
    {
        try {
            if (!preg_match('/^\d{5}$/', $id)) {
                return [
                    'code' => GlobalResponse::$DATABASE_ERROR_CODE,
                    'message' => 'Invalid course_id format.',
                ];
            }
            if (!preg_match('/^\d{2}$/', $data['category_id'])) {
                return [
                    'code' => GlobalResponse::$DATABASE_ERROR_CODE,
                    'message' => 'Invalid category_id format.',
                ];
            }

            $categoryExists = DB::table('c_course_categories')
                ->where('c_category_id', $data['category_id'])
                ->exists();
            if (!$categoryExists) {
                return [
                    'code' => GlobalResponse::$DATABASE_ERROR_CODE,
                    'message' => 'Category does not exist.',
                ];
            }

            $oldCourse = DB::table('c_courses')->where('c_course_id', $id)->first();
            if (!$oldCourse) {
                return [
                    'code' => GlobalResponse::$DATABASE_ERROR_CODE,
                    'message' => 'Course not found.',
                ];
            }

            $oldFolder = public_path('web/' . $oldCourse->category_id . '/' . $id);
            $newFolder = public_path('web/' . $data['category_id'] . '/' . $id);

            if ($oldCourse->category_id !== $data['category_id']) {
                if (File::exists($newFolder)) {
                    return [
                        'code' => GlobalResponse::$DATABASE_ERROR_CODE,
                        'message' => 'Target folder already exists.',
                    ];
                }
                if (File::exists($oldFolder)) {
                    File::moveDirectory($oldFolder, $newFolder, true);
                }
            }

            DB::beginTransaction();
            $result = DB::update(
                'UPDATE c_courses SET c_course_name = ?, c_description = ?, category_id = ?, updated_at = NOW() WHERE c_course_id = ?',
                [$data['c_course_name'], $data['c_description'] ?? null, $data['category_id'], $id]
            );

            if ($result) {
                DB::commit();
                return [
                    'code' => GlobalResponse::$DATABASE_SUCCESS_CODE,
                    'message' => 'Course updated successfully.',
                ];
            }

            DB::rollBack();
            return [
                'code' => GlobalResponse::$DATABASE_ERROR_CODE,
                'message' => 'Course not found.',
            ];
        } catch (QueryException $e) {
            DB::rollBack();
            Log::error('[DATABASE] updateCourse: ' . $e->getMessage());
            return [
                'code' => GlobalResponse::$DATABASE_ERROR_CODE,
                'message' => $e->getCode() == 23000 ? 'Course name or category ID issue.' : 'Failed to update course: ' . $e->getMessage(),
            ];
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('[GENERAL] updateCourse: ' . $e->getMessage());
            return [
                'code' => GlobalResponse::$DATABASE_ERROR_CODE,
                'message' => 'Unexpected error occurred.',
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
            if (!preg_match('/^\d{5}$/', $id)) {
                return [
                    'code' => GlobalResponse::$DATABASE_ERROR_CODE,
                    'message' => 'Invalid course_id format.',
                ];
            }

            $course = DB::table('c_courses')->where('c_course_id', $id)->first();
            if (!$course) {
                return [
                    'code' => GlobalResponse::$DATABASE_ERROR_CODE,
                    'message' => 'Course not found.',
                ];
            }
            $categoryId = $course->category_id;
            $courseFolder = public_path('web/' . $categoryId . '/' . $id);

            // Delete associated resources
            $resources = DB::table('c_course_resources')->where('c_course_id', $id)->get();
            foreach ($resources as $resource) {
                ResourceModel::deleteResource($resource->c_resource_id);
            }

            DB::beginTransaction();
            $result = DB::delete('DELETE FROM c_courses WHERE c_course_id = ?', [$id]);
            if ($result) {
                if (File::exists($courseFolder)) {
                    File::deleteDirectory($courseFolder);
                }
                DB::commit();
                return [
                    'code' => GlobalResponse::$DATABASE_SUCCESS_CODE,
                    'message' => 'Course deleted successfully.',
                ];
            }
            DB::rollBack();
            return [
                'code' => GlobalResponse::$DATABASE_ERROR_CODE,
                'message' => 'Course not found.',
            ];
        } catch (QueryException $e) {
            DB::rollBack();
            Log::error('[DATABASE] deleteCourse: ' . $e->getMessage());
            return [
                'code' => GlobalResponse::$DATABASE_ERROR_CODE,
                'message' => 'Failed to delete course: ' . $e->getMessage(),
            ];
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('[GENERAL] deleteCourse: ' . $e->getMessage());
            return [
                'code' => GlobalResponse::$DATABASE_ERROR_CODE,
                'message' => 'Unexpected error occurred.',
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
            if (!preg_match('/^\d{5}$/', $id)) {
                return [
                    'code' => GlobalResponse::$DATABASE_ERROR_CODE,
                    'message' => 'Invalid course_id format.',
                ];
            }

            $course = DB::table('c_courses as c')
                ->join('c_course_categories as cat', 'c.category_id', '=', 'cat.c_category_id')
                ->select('c.c_course_id', 'c.c_course_name', 'c.c_description', 'cat.c_category_name', 'c.created_at as uploadDate', 'c.updated_at')
                ->where('c.c_course_id', $id)
                ->first();
            if ($course) {
                return [
                    'code' => GlobalResponse::$DATABASE_SUCCESS_CODE,
                    'message' => 'Course retrieved successfully.',
                    'data' => $course,
                ];
            }
            return [
                'code' => GlobalResponse::$DATABASE_ERROR_CODE,
                'message' => 'Course not found.',
            ];
        } catch (QueryException $e) {
            Log::error('[DATABASE] getCourseById: ' . $e->getMessage());
            return [
                'code' => GlobalResponse::$DATABASE_ERROR_CODE,
                'message' => 'Failed to retrieve course: ' . $e->getMessage(),
            ];
        } catch (\Exception $e) {
            Log::error('[GENERAL] getCourseById: ' . $e->getMessage());
            return [
                'code' => GlobalResponse::$DATABASE_ERROR_CODE,
                'message' => 'Unexpected error occurred.',
            ];
        }
    }

    /**
     * Add a user to a course.
     *
     * @param string $userId
     * @param string $courseId
     * @return array
     */
    public static function addUserToCourse(string $userId, string $courseId): array
    {
        try {
            if (!preg_match('/^\d{5}$/', $courseId)) {
                return [
                    'code' => GlobalResponse::$DATABASE_ERROR_CODE,
                    'message' => 'Invalid course_id format.',
                ];
            }

            $courseExists = DB::table('c_courses')->where('c_course_id', $courseId)->exists();
            if (!$courseExists) {
                return [
                    'code' => GlobalResponse::$DATABASE_ERROR_CODE,
                    'message' => 'Course does not exist.',
                ];
            }

            $userExists = DB::table('c_users')->where('c_username', $userId)->exists();
            if (!$userExists) {
                return [
                    'code' => GlobalResponse::$DATABASE_ERROR_CODE,
                    'message' => 'User does not exist.',
                ];
            }

            DB::beginTransaction();
            $result = DB::insert(
                'INSERT INTO c_users_courses (user_id, c_course_id, created_at, updated_at) VALUES (?, ?, NOW(), NOW())',
                [$userId, $courseId]
            );

            if ($result) {
                DB::commit();
                return [
                    'code' => GlobalResponse::$DATABASE_SUCCESS_CODE,
                    'message' => 'User added to course successfully.',
                ];
            }

            DB::rollBack();
            return [
                'code' => GlobalResponse::$DATABASE_ERROR_CODE,
                'message' => 'Failed to add user to course.',
            ];
        } catch (QueryException $e) {
            DB::rollBack();
            Log::error('[DATABASE] addUserToCourse: ' . $e->getMessage());
            return [
                'code' => GlobalResponse::$DATABASE_ERROR_CODE,
                'message' => $e->getCode() == 23000 ? 'User already associated with course.' : 'Failed to add user to course: ' . $e->getMessage(),
            ];
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('[GENERAL] addUserToCourse: ' . $e->getMessage());
            return [
                'code' => GlobalResponse::$DATABASE_ERROR_CODE,
                'message' => 'Unexpected error occurred.',
            ];
        }
    }
}
