<?php
namespace App\Models\Course;

use Illuminate\Support\Facades\DB;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Storage;

class CoursePermissionModel
{
    const COURSES_USERS_TABLE = 'c_courses_users';

    /**
     * 获取所有用户的用户名
     */
    public static function getAllUsernames(): array
    {
        try {
            $users = DB::table('c_users')
                ->select('c_username')
                ->where('c_username', '!=', 'admin') // 排除 c_username = 'admin'
                ->get()
                ->toArray();

            return [
                'code' => 200,
                'message' => 'Usernames retrieved successfully.',
                'data' => $users
            ];
        } catch (QueryException $e) {
            Log::error('[DATABASE] getAllUsernames: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
            ]);
            return [
                'code' => 500,
                'message' => 'Failed to retrieve usernames: ' . $e->getMessage(),
            ];
        } catch (\Exception $e) {
            Log::error('[GENERAL] getAllUsernames: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
            ]);
            return [
                'code' => 500,
                'message' => 'Unexpected error occurred: ' . $e->getMessage(),
            ];
        }
    }

    /**
     * 获取课程的授权用户
     */
    public static function getCourseUsers(string $courseId): array
    {
        try {
            if (!preg_match('/^\d{5}$/', $courseId)) {
                return [
                    'code' => 422,
                    'message' => 'Invalid course_id format.',
                ];
            }

            $courseExists = DB::table('c_courses')->where('c_course_id', $courseId)->exists();
            if (!$courseExists) {
                return [
                    'code' => 404,
                    'message' => 'Course not found.',
                ];
            }

            $users = DB::table(self::COURSES_USERS_TABLE . ' as cu')
                ->join('c_users as u', 'cu.c_username', '=', 'u.c_username')
                ->select('u.c_username', 'u.c_name')
                ->where('cu.c_course_id', $courseId)
                ->get();

            return [
                'code' => 200,
                'message' => 'Course users retrieved successfully.',
                'data' => $users
            ];
        } catch (QueryException $e) {
            Log::error('[DATABASE] getCourseUsers: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
            ]);
            return [
                'code' => 500,
                'message' => 'Failed to retrieve course users: ' . $e->getMessage(),
            ];
        } catch (\Exception $e) {
            Log::error('[GENERAL] getCourseUsers: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
            ]);
            return [
                'code' => 500,
                'message' => 'Unexpected error occurred: ' . $e->getMessage(),
            ];
        }
    }

    /**
     * 批量更新课程的授权用户
     */
    public static function syncCourseUsers(string $courseId, array $userIds): array
    {
        try {
            if (!preg_match('/^\d{5}$/', $courseId)) {
                return [
                    'code' => 422,
                    'message' => 'Invalid course_id format.',
                ];
            }

            $courseExists = DB::table('c_courses')->where('c_course_id', $courseId)->exists();
            if (!$courseExists) {
                return [
                    'code' => 404,
                    'message' => 'Course not found.',
                ];
            }

            $validUsers = DB::table('c_users')
                ->whereIn('c_username', $userIds)
                ->pluck('c_username')
                ->toArray();

            if (count($validUsers) !== count($userIds)) {
                return [
                    'code' => 422,
                    'message' => 'One or more user IDs are invalid.',
                ];
            }

            DB::beginTransaction();

            DB::table(self::COURSES_USERS_TABLE)
                ->where('c_course_id', $courseId)
                ->delete();

            if (!empty($userIds)) {
                $insertData = array_map(function ($userId) use ($courseId) {
                    return [
                        'c_course_id' => $courseId,
                        'c_username' => $userId,
                    ];
                }, $userIds);

                DB::table(self::COURSES_USERS_TABLE)->insert($insertData);
            }

            DB::commit();
            return [
                'code' => 200,
                'message' => 'Course users updated successfully.',
            ];
        } catch (QueryException $e) {
            DB::rollBack();
            Log::error('[DATABASE] syncCourseUsers: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
            ]);
            return [
                'code' => 500,
                'message' => 'Failed to update course users: ' . $e->getMessage(),
            ];
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('[GENERAL] syncCourseUsers: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
            ]);
            return [
                'code' => 500,
                'message' => 'Unexpected error occurred: ' . $e->getMessage(),
            ];
        }
    }

    /**
     * 添加单个用户到课程
     */
    public static function addUserToCourse(string $userId, string $courseId): array
    {
        try {
            if (!preg_match('/^\d{5}$/', $courseId)) {
                return [
                    'code' => 422,
                    'message' => 'Invalid course_id format.',
                ];
            }

            $courseExists = DB::table('c_courses')->where('c_course_id', $courseId)->exists();
            if (!$courseExists) {
                return [
                    'code' => 422,
                    'message' => 'Course does not exist.',
                ];
            }

            $userExists = DB::table('c_users')->where('c_username', $userId)->exists();
            if (!$userExists) {
                return [
                    'code' => 422,
                    'message' => 'User does not exist.',
                ];
            }

            DB::beginTransaction();
            $result = DB::insert(
                'INSERT INTO ' . self::COURSES_USERS_TABLE . ' (c_username, c_course_id) VALUES (?, ?, NOW(), NOW())',
                [$userId, $courseId]
            );

            if ($result) {
                DB::commit();
                return [
                    'code' => 200,
                    'message' => 'User added to course successfully.',
                ];
            }

            DB::rollBack();
            return [
                'code' => 500,
                'message' => 'Failed to add user to course.',
            ];
        } catch (QueryException $e) {
            DB::rollBack();
            Log::error('[DATABASE] addUserToCourse: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
            ]);
            return [
                'code' => 500,
                'message' => $e->getCode() == 23000 ? 'User already associated with course.' : 'Failed to add user to course: ' . $e->getMessage(),
            ];
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('[GENERAL] addUserToCourse: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
            ]);
            return [
                'code' => 500,
                'message' => 'Unexpected error occurred: ' . $e->getMessage(),
            ];
        }
    }
}
