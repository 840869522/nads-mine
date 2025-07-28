<?php
namespace App\Models\Course;

use Illuminate\Support\Facades\DB;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Storage;
class CourseModel
{
    const COURSES_USERS_TABLE = 'c_courses_users';
    public static function getAllCourses(int $page = 1, int $pagesize = 10, ?string $keyword = null, ?string $c_category_id = null): array
    {
        try {
            DB::connection()->getPdo();
            if ($page < 1 || $pagesize < 1) {
                return [
                    'code' => 422,
                    'message' => 'Invalid pagination parameters.',
                ];
            }

            $offset = ($page - 1) * $pagesize;
            $likeKeyword = $keyword ? '%' . $keyword . '%' : null;

            $query = DB::table('c_courses as c')
                ->join('c_course_categories as cat', 'c.c_category_id', '=', 'cat.c_category_id')
                ->select(
                    'c.c_course_id',
                    'c.c_course_name',
                    'c.c_description',
                    'cat.c_category_name',
                    'c.created_at as uploadDate',
                    'c.updated_at',
                    DB::raw('CASE WHEN c.c_course_name LIKE ? THEN 1 ELSE 0 END as name_match_priority')
                );

            $countQuery = DB::table('c_courses as c')
                ->join('c_course_categories as cat', 'c.c_category_id', '=', 'cat.c_category_id');

            // 为 CASE 语句绑定参数
            $query->addBinding($likeKeyword ?? '%', 'select');

            if ($keyword && $likeKeyword) {
                $query->where(function ($q) use ($likeKeyword) {
                    $q->where('c.c_course_name', 'like', $likeKeyword)
                        ->orWhere('c.c_description', 'like', $likeKeyword);
                });
                $countQuery->where(function ($q) use ($likeKeyword) {
                    $q->where('c.c_course_name', 'like', $likeKeyword)
                        ->orWhere('c.c_description', 'like', $likeKeyword);
                });
            }

            if ($c_category_id) {
                if (!preg_match('/^\d{2}$/', $c_category_id)) {
                    return [
                        'code' => 422,
                        'message' => 'Invalid c_category_id format.',
                    ];
                }
                $query->where('c.c_category_id', $c_category_id);
                $countQuery->where('c.c_category_id', $c_category_id);
            }

            $courses = $query->orderBy('name_match_priority', 'desc')
                ->orderBy('c.created_at', 'desc')
                ->take($pagesize)
                ->skip($offset)
                ->get();
            $count = $countQuery->count();

            return [
                'code' => 200,
                'message' => 'Courses retrieved successfully.',
                'data' => [
                    'courses' => $courses,
                    'total' => $count,
                    'page' => $page,
                    'pageSize' => $pagesize,
                    'keyword' => $keyword, // 返回关键字便于前端高亮
                ],
            ];
        } catch (QueryException $e) {
            Log::error('[DATABASE] getAllCourses: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
                'bindings' => $query->getBindings(),
            ]);
            return [
                'code' => 500,
                'message' => 'Failed to retrieve courses: ' . $e->getMessage(),
                'error_details' => [
                    'sql_error' => $e->getMessage(),
                    'sql_code' => $e->getCode(),
                ],
            ];
        } catch (\Exception $e) {
            Log::error('[GENERAL] getAllCourses: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
            ]);
            return [
                'code' => 500,
                'message' => 'Unexpected error occurred: ' . $e->getMessage(),
                'error_details' => [
                    'error' => $e->getMessage(),
                ],
            ];
        }
    }

    // 其余方法保持不变
    public static function insertCourse(array $data): array
    {
        try {
            if (empty($data['c_category_id']) || empty($data['c_course_name'])) {
                return [
                    'code' => 422,
                    'message' => 'Missing required fields: c_category_id or c_course_name.',
                ];
            }

            if (!preg_match('/^\d{2}$/', $data['c_category_id'])) {
                return [
                    'code' => 422,
                    'message' => 'Invalid c_category_id format: Must be two digits.',
                ];
            }
            $categoryExists = DB::table('c_course_categories')
                ->where('c_category_id', $data['c_category_id'])
                ->exists();
            if (!$categoryExists) {
                return [
                    'code' => 422,
                    'message' => 'Category does not exist.',
                ];
            }

            $existingCourses = DB::table('c_courses')
                ->where('c_category_id', $data['c_category_id'])
                ->pluck('c_course_id')
                ->toArray();

            $sequenceNumbers = array_map(function ($courseId) {
                return (int) substr($courseId, -3);
            }, $existingCourses);
            $nextSequence = $sequenceNumbers ? max($sequenceNumbers) + 1 : 1;

            if ($nextSequence > 999) {
                return [
                    'code' => 422,
                    'message' => 'Maximum number of courses reached for this category.',
                ];
            }

            $newId = $data['c_category_id'] . sprintf('%03d', $nextSequence);

            $courseFolder = 'courses/' . $data['c_category_id'] . '/' . $newId;
            if (!Storage::disk('local_resources')->makeDirectory($courseFolder, 0755, true)) {
                return [
                    'code' => 500,
                    'message' => 'Failed to create course folder.',
                ];
            }

            DB::beginTransaction();
            $result = DB::insert(
                'INSERT INTO c_courses (c_course_id, c_course_name, c_description, c_category_id, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())',
                [$newId, $data['c_course_name'], $data['c_description'] ?? null, $data['c_category_id']]
            );
            DB::commit();
            return [
                'code' => 201,
                'message' => 'Course created successfully.',
                'data' => ['c_course_id' => $newId],
            ];
        } catch (QueryException $e) {
            DB::rollBack();
            Log::error('[DATABASE] insertCourse: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
            ]);
            return [
                'code' => 500,
                'message' => $e->getCode() == 23000 ? 'Course name or category ID issue.' : 'Failed to create course: ' . $e->getMessage(),
            ];
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('[GENERAL] insertCourse: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
            ]);
            return [
                'code' => 500,
                'message' => 'Unexpected error occurred: ' . $e->getMessage(),
            ];
        }
    }

    public static function updateCoursePartial(string $id, array $data): array
    {
        try {
            if (!preg_match('/^\d{5}$/', $id)) {
                return [
                    'code' => 422,
                    'message' => 'Invalid course_id format.',
                ];
            }
            if (!preg_match('/^\d{2}$/', $data['c_category_id'])) {
                return [
                    'code' => 422,
                    'message' => 'Invalid c_category_id format.',
                ];
            }

            $categoryExists = DB::table('c_course_categories')
                ->where('c_category_id', $data['c_category_id'])
                ->exists();
            if (!$categoryExists) {
                return [
                    'code' => 422,
                    'message' => 'Category does not exist.',
                ];
            }

            $oldCourse = DB::table('c_courses')->where('c_course_id', $id)->first();
            if (!$oldCourse) {
                return [
                    'code' => 404,
                    'message' => 'Course not found.',
                ];
            }

            DB::beginTransaction();

            if ($oldCourse->c_category_id !== $data['c_category_id']) {
                $existingCourses = DB::table('c_courses')
                    ->where('c_category_id', $data['c_category_id'])
                    ->pluck('c_course_id')
                    ->toArray();

                $sequenceNumbers = array_map(function ($courseId) {
                    return (int) substr($courseId, -3);
                }, $existingCourses);
                $nextSequence = $sequenceNumbers ? max($sequenceNumbers) + 1 : 1;

                if ($nextSequence > 999) {
                    DB::rollBack();
                    return [
                        'code' => 422,
                        'message' => 'Maximum number of courses reached for this category.',
                    ];
                }

                $newId = $data['c_category_id'] . sprintf('%03d', $nextSequence);

                if (DB::table('c_courses')->where('c_course_id', $newId)->exists()) {
                    DB::rollBack();
                    return [
                        'code' => 500,
                        'message' => 'New course ID already exists.',
                    ];
                }

                DB::insert(
                    'INSERT INTO c_courses (c_course_id, c_course_name, c_description, c_category_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NOW())',
                    [$newId, $data['c_course_name'], $data['c_description'] ?? null, $data['c_category_id'], $oldCourse->created_at]
                );

                $resources = DB::table('c_course_resources')->where('c_course_id', $id)->get();
                foreach ($resources as $resource) {
                    $fileName = basename($resource->c_resource_path);
                    $newPath = 'courses/' . $data['c_category_id'] . '/' . $newId . '/' . $fileName;
                    DB::update(
                        'UPDATE c_course_resources SET c_course_id = ?, c_resource_path = ? WHERE c_resource_id = ?',
                        [$newId, $newPath, $resource->c_resource_id]
                    );
                }

                // 修改：使用 Storage::disk('local_resources') 移动文件夹
                $oldFolder = 'courses/' . $oldCourse->c_category_id . '/' . $id;
                $newFolder = 'courses/' . $data['c_category_id'] . '/' . $newId;
                if (Storage::disk('local_resources')->exists($oldFolder)) {
                    Storage::disk('local_resources')->move($oldFolder, $newFolder);
                    Log::info('Moved folder from ' . $oldFolder . ' to ' . $newFolder);
                } else {
                    Log::warning('Old folder does not exist: ' . $oldFolder);
                }

                DB::delete('DELETE FROM c_courses WHERE c_course_id = ?', [$id]);

                DB::commit();
                return [
                    'code' => 200,
                    'message' => 'Course updated successfully with new ID.',
                    'data' => ['new_course_id' => $newId],
                ];
            } else {
                $result = DB::update(
                    'UPDATE c_courses SET c_course_name = ?, c_description = ?, updated_at = NOW() WHERE c_course_id = ?',
                    [$data['c_course_name'], $data['c_description'] ?? null, $id]
                );

                if ($result) {
                    DB::commit();
                    return [
                        'code' => 200,
                        'message' => 'Course updated successfully.',
                    ];
                }

                DB::rollBack();
                return [
                    'code' => 404,
                    'message' => 'Course not found.',
                ];
            }
        } catch (QueryException $e) {
            DB::rollBack();
            Log::error('[DATABASE] updateCoursePartial: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
            ]);
            return [
                'code' => 500,
                'message' => 'Failed to update course: ' . $e->getMessage(),
            ];
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('[GENERAL] updateCoursePartial: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
            ]);
            return [
                'code' => 500,
                'message' => 'Unexpected error occurred: ' . $e->getMessage(),
            ];
        }
    }

    public static function deleteCourse(string $id): array
    {
        try {
            if (!preg_match('/^\d{5}$/', $id)) {
                return [
                    'code' => 422,
                    'message' => 'Invalid course_id format.',
                ];
            }

            $course = DB::table('c_courses')->where('c_course_id', $id)->first();
            if (!$course) {
                return [
                    'code' => 404,
                    'message' => 'Course not found.',
                ];
            }
            $categoryId = $course->c_category_id;
            $courseFolder = 'courses/' . $categoryId . '/' . $id;
            if (Storage::disk('local_resources')->exists($courseFolder)) {
                Storage::disk('local_resources')->deleteDirectory($courseFolder);
            }

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
                    'code' => 200,
                    'message' => 'Course deleted successfully.',
                ];
            }
            DB::rollBack();
            return [
                'code' => 404,
                'message' => 'Course not found.',
            ];
        } catch (QueryException $e) {
            DB::rollBack();
            Log::error('[DATABASE] deleteCourse: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
            ]);
            return [
                'code' => 500,
                'message' => 'Failed to delete course: ' . $e->getMessage(),
            ];
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('[GENERAL] deleteCourse: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
            ]);
            return [
                'code' => 500,
                'message' => 'Unexpected error occurred: ' . $e->getMessage(),
            ];
        }
    }

    public static function getCourseById(string $id): array
    {
        try {
            if (!preg_match('/^\d{5}$/', $id)) {
                return [
                    'code' => 422,
                    'message' => 'Invalid course_id format.',
                ];
            }

            $course = DB::table('c_courses as c')
                ->join('c_course_categories as cat', 'c.c_category_id', '=', 'cat.c_category_id')
                ->select('c.c_course_id', 'c.c_course_name', 'c.c_description', 'cat.c_category_name', 'c.created_at as uploadDate', 'c.updated_at')
                ->where('c.c_course_id', $id)
                ->first();
            if ($course) {
                return [
                    'code' => 200,
                    'message' => 'Course retrieved successfully.',
                    'data' => $course,
                ];
            }
            return [
                'code' => 404,
                'message' => 'Course not found.',
            ];
        } catch (QueryException $e) {
            Log::error('[DATABASE] getCourseById: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
            ]);
            return [
                'code' => 500,
                'message' => 'Failed to retrieve course: ' . $e->getMessage(),
            ];
        } catch (\Exception $e) {
            Log::error('[GENERAL] getCourseById: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
            ]);
            return [
                'code' => 500,
                'message' => 'Unexpected error occurred: ' . $e->getMessage(),
            ];
        }
    }
    /**
     * 获取所有用户
     */
    public static function getAllUsers(): array
    {
        try {
            $users = DB::table('c_users')
                ->select('c_username', 'c_name')
                ->get();

            return [
                'code' => 200,
                'message' => 'Users retrieved successfully.',
                'data' => $users
            ];
        } catch (QueryException $e) {
            Log::error('[DATABASE] getAllUsers: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
            ]);
            return [
                'code' => 500,
                'message' => 'Failed to retrieve users: ' . $e->getMessage(),
            ];
        } catch (\Exception $e) {
            Log::error('[GENERAL] getAllUsers: ' . $e->getMessage(), [
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

            // 验证用户ID是否存在
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

            // 删除现有权限
            DB::table(self::COURSES_USERS_TABLE)
                ->where('c_course_id', $courseId)
                ->delete();

            // 插入新权限
            if (!empty($userIds)) {
                $insertData = array_map(function ($userId) use ($courseId) {
                    return [
                        'c_course_id' => $courseId,
                        'c_username' => $userId,
                        'created_at' => now(),
                        'updated_at' => now(),
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
     * 修改 addUserToCourse 方法，修正表名
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
                'INSERT INTO ' . self::COURSES_USERS_TABLE . ' (c_username, c_course_id, created_at, updated_at) VALUES (?, ?, NOW(), NOW())',
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
