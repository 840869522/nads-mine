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
                    'c.c_status',
                    'cat.c_category_name',
                    'c.created_at',
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

    public static function insertCourse(array $data): array
    {
        try {
            if (empty($data['c_category_id']) || empty($data['c_course_name'])) {
                return [
                    'code' => 422,
                    'message' => 'Missing required fields: c_category_id or c_course_name.',
                ];
            }
            // 新增：校验 c_status
            if (isset($data['c_status']) && !in_array($data['c_status'], ['draft', 'published'])) {
                return ['code' => 422, 'message' => 'Invalid c_status: Must be "draft" or "published".'];
            }
            $status = $data['c_status'] ?? 'published';  // 默认 'published'

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

            // 确保 $existingCourses 是数组
            if (!is_array($existingCourses)) {
                $existingCourses = [];
            }
            
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
                'INSERT INTO c_courses (c_course_id, c_course_name, c_description, c_category_id, c_status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NOW(), NOW())',
                [$newId, $data['c_course_name'], $data['c_description'] ?? null, $data['c_category_id'], $status]  // 新增 $status
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
            // 添加：校验 c_status，如果提供则必须是 'draft' 或 'published'，否则默认 'published'
            if (isset($data['c_status']) && !in_array($data['c_status'], ['draft', 'published'])) {
                return [
                    'code' => 422,
                    'message' => 'Invalid c_status: Must be "draft" or "published".',
                ];
            }
            $status = $data['c_status'] ?? 'published';  // 默认 'published'

            $oldCourse = DB::table('c_courses')->where('c_course_id', $id)->first();
            if (!$oldCourse) {
                return [
                    'code' => 404,
                    'message' => 'Course not found.',
                ];
            }

            DB::beginTransaction();

            if ($oldCourse->c_category_id !== $data['c_category_id']) {
                // 生成新课程ID
                $existingCourses = DB::table('c_courses')
                    ->where('c_category_id', $data['c_category_id'])
                    ->pluck('c_course_id')
                    ->toArray();
                    
                // 确保 $existingCourses 是数组
                if (!is_array($existingCourses)) {
                    $existingCourses = [];
                }
                
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

            // 插入新课程记录
            DB::insert(
                'INSERT INTO c_courses (c_course_id, c_course_name, c_description, c_category_id, c_status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, NOW())',
                [$newId, $data['c_course_name'], $data['c_description'] ?? null, $data['c_category_id'], $status, $oldCourse->created_at]
            );

                // 计算前缀
                $oldPrefix = $oldCourse->c_category_id . $id; // 旧前缀，如 '1212001'
                $newPrefix = $data['c_category_id'] . $newId; // 新前缀，如 '0707001'

                // 更新课程资源表 (c_course_resources)
                $resources = DB::table('c_course_resources')->where('c_course_id', $id)->get();
                foreach ($resources as $resource) {
                    $resource->c_resource_id = rtrim($resource->c_resource_id); // Trim trailing spaces for char fields
                    $fileName = basename($resource->c_resource_path);
                    $newPath = 'courses/' . $data['c_category_id'] . '/' . $newId . '/' . $fileName;
                    $result = DB::update(
                        'UPDATE c_course_resources SET c_course_id = ?, c_resource_path = ?, updated_at = NOW() WHERE c_resource_id = ?',
                        [$newId, $newPath, $resource->c_resource_id]
                    );
                    if ($result === 0) {
                        DB::rollBack();
                        Log::error('Update failed for course resource', ['c_resource_id' => $resource->c_resource_id]);
                        return [
                            'code' => 500,
                            'message' => 'Failed to update course resource: ' . $resource->c_resource_id,
                        ];
                    }
                    Log::info('Updated course resource', [
                        'c_resource_id' => $resource->c_resource_id,
                        'new_path' => $newPath,
                        'rows_affected' => $result
                    ]);
                }

                // 更新实验表 (c_course_experiments)
                $experiments = DB::table('c_course_experiments')->where('c_course_id', $id)->get();
                foreach ($experiments as $exp) {
                    $exp->c_experiment_id = rtrim($exp->c_experiment_id); // Trim trailing spaces
                    // 计算新实验ID: 动态提取序号
                    $oldSequence = substr($exp->c_experiment_id, strlen($oldPrefix));
                    $newExpId = $newPrefix . $oldSequence;

                    $result = DB::update(
                        'UPDATE c_course_experiments SET c_course_id = ?, c_experiment_id = ?, updated_at = NOW() WHERE c_experiment_id = ?',
                        [$newId, $newExpId, $exp->c_experiment_id]
                    );
                    if ($result === 0) {
                        DB::rollBack();
                        Log::error('Update failed for experiment', ['c_experiment_id' => $exp->c_experiment_id]);
                        return [
                            'code' => 500,
                            'message' => 'Failed to update experiment: ' . $exp->c_experiment_id,
                        ];
                    }
                    Log::info('Updated experiment', [
                        'old_experiment_id' => $exp->c_experiment_id,
                        'new_experiment_id' => $newExpId,
                        'rows_affected' => $result
                    ]);
                }

                // 更新实验资源表 (c_experiment_resources)
                $expResources = DB::table('c_experiment_resources')->where('c_course_id', $id)->orWhere('c_course_id', $newId)->get();
                Log::info('Starting update for experiment resources', [
                    'c_course_id' => $id,
                    'new_course_id' => $newId,
                    'resource_count' => count($expResources)
                ]);
                if (count($expResources) === 0) {
                    Log::warning('No experiment resources found for course', ['c_course_id' => $id, 'new_course_id' => $newId]);
                }
                foreach ($expResources as $res) {
                    $res->c_resource_id = rtrim($res->c_resource_id); // Trim trailing spaces
                    $res->c_experiment_id = rtrim($res->c_experiment_id);
                    // 计算新实验 ID
                    $oldExpId = $res->c_experiment_id;
                    $oldSequence = substr($oldExpId, strlen($oldPrefix));
                    $newExpId = $newPrefix . $oldSequence;

                    // 计算新资源 ID
                    $oldResSequence = substr($res->c_resource_id, strlen($oldExpId));
                    $newResId = $newExpId . $oldResSequence;

                    // 检查新资源 ID 是否唯一
                    if (DB::table('c_experiment_resources')->where('c_resource_id', $newResId)->exists()) {
                        DB::rollBack();
                        Log::error('New resource ID already exists', [
                            'new_resource_id' => $newResId,
                            'old_resource_id' => $res->c_resource_id
                        ]);
                        return [
                            'code' => 500,
                            'message' => 'New resource ID already exists: ' . $newResId,
                        ];
                    }

                    // 更新路径
                    $oldPath = $res->c_resource_path;
                    $fileName = basename($oldPath);
                    $newPath = "courses/{$data['c_category_id']}/{$newId}/Experiment/{$newExpId}/{$fileName}";

                    // 验证旧路径格式
                    $expectedPrefix = "courses/{$oldCourse->c_category_id}/{$id}/Experiment/{$oldExpId}/";
                    if (strpos($oldPath, $expectedPrefix) !== 0 && strpos($oldPath, "courses/{$data['c_category_id']}/{$newId}/Experiment/{$newExpId}/") !== 0) {
                        Log::warning('Invalid experiment resource path format, attempting to fix', [
                            'c_resource_id' => $res->c_resource_id,
                            'old_path' => $oldPath,
                            'expected_prefix' => $expectedPrefix
                        ]);
                        // 强制构建新路径
                        $newPath = "courses/{$data['c_category_id']}/{$newId}/Experiment/{$newExpId}/{$fileName}";
                    }

                    // 检查替换是否成功
                    if ($newPath === $oldPath) {
                        DB::rollBack();
                        Log::error('Experiment resource path replacement failed (no change)', [
                            'c_resource_id' => $res->c_resource_id,
                            'old_path' => $oldPath,
                            'new_path' => $newPath
                        ]);
                        return [
                            'code' => 500,
                            'message' => 'Path replacement failed for experiment resource: ' . $res->c_resource_id,
                        ];
                    }

                    Log::info('Path replacement for experiment resource', [
                        'c_resource_id' => $res->c_resource_id,
                        'old_path' => $oldPath,
                        'new_path' => $newPath
                    ]);

                    // 更新数据库
                    $result = DB::update(
                        'UPDATE c_experiment_resources SET c_course_id = ?, c_experiment_id = ?, c_resource_id = ?, c_resource_path = ?, updated_at = NOW() WHERE c_resource_id = ?',
                        [$newId, $newExpId, $newResId, $newPath, $res->c_resource_id]
                    );
                    if ($result === 0) {
                        DB::rollBack();
                        Log::error('Update failed for experiment resource', [
                            'c_resource_id' => $res->c_resource_id,
                            'new_resource_id' => $newResId,
                            'new_path' => $newPath
                        ]);
                        return [
                            'code' => 500,
                            'message' => 'Failed to update experiment resource: ' . $res->c_resource_id,
                        ];
                    }

                    // 验证数据库更新
                    $updatedResource = DB::table('c_experiment_resources')->where('c_resource_id', $newResId)->first();
                    if (!$updatedResource || $updatedResource->c_resource_path !== $newPath) {
                        DB::rollBack();
                        Log::error('Database path not updated correctly for experiment resource', [
                            'c_resource_id' => $newResId,
                            'expected_path' => $newPath,
                            'actual_path' => $updatedResource ? $updatedResource->c_resource_path : null
                        ]);
                        return [
                            'code' => 500,
                            'message' => 'Database path not updated correctly for experiment resource: ' . $newResId,
                        ];
                    }

                    Log::info('Updated experiment resource', [
                        'old_resource_id' => $res->c_resource_id,
                        'new_resource_id' => $newResId,
                        'old_path' => $oldPath,
                        'new_path' => $newPath,
                        'rows_affected' => $result
                    ]);
                }

                // 移动并重命名文件系统
                $oldFolder = 'courses/' . $oldCourse->c_category_id . '/' . $id;
                $newFolder = 'courses/' . $data['c_category_id'] . '/' . $newId;
                if (Storage::disk('local_resources')->exists($oldFolder)) {
                    Storage::disk('local_resources')->move($oldFolder, $newFolder);
                    Log::info('Moved folder from ' . $oldFolder . ' to ' . $newFolder);

                    // 重命名实验子文件夹
                    $experiments = DB::table('c_course_experiments')->where('c_course_id', $newId)->get();
                    foreach ($experiments as $exp) {
                        $exp->c_experiment_id = rtrim($exp->c_experiment_id); // Trim for char fields
                        $oldSequence = substr($exp->c_experiment_id, strlen($newPrefix));
                        $oldExpFolder = "{$newFolder}/Experiment/{$oldCourse->c_category_id}{$id}{$oldSequence}";
                        $newExpFolder = "{$newFolder}/Experiment/{$exp->c_experiment_id}";
                        if (Storage::disk('local_resources')->exists($oldExpFolder)) {
                            Storage::disk('local_resources')->move($oldExpFolder, $newExpFolder);
                            Log::info('Moved experiment folder from ' . $oldExpFolder . ' to ' . $newExpFolder);
                        } else {
                            Log::warning('Old experiment folder does not exist', [
                                'old_exp_folder' => $oldExpFolder
                            ]);
                        }
                    }
                } else {
                    Log::warning('Old folder does not exist: ' . $oldFolder);
                }

                // 删除旧课程记录
                DB::delete('DELETE FROM c_courses WHERE c_course_id = ?', [$id]);

            DB::commit();
            return [
                'code' => 200,
                'message' => 'Course updated successfully with new ID.',
                'data' => ['new_course_id' => $newId],
            ];
        } else {
            $result = DB::update(
                'UPDATE c_courses SET c_course_name = ?, c_description = ?, c_status = ?, updated_at = NOW() WHERE c_course_id = ?',
                [$data['c_course_name'], $data['c_description'] ?? null, $status, $id]
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
                ->select('c.c_course_id', 'c.c_course_name', 'c.c_description', 'c.c_status', 'cat.c_category_name', 'c.created_at', 'c.updated_at')
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
     * 更新课程ID及所有相关表的ID和路径
     */
    public static function updateCourseIdAndRelated($oldCourseId, $newCourseId)
    {
        return DB::transaction(function () use ($oldCourseId, $newCourseId) {
            Log::info('Starting updateCourseIdAndRelated', [
                'oldCourseId' => $oldCourseId,
                'newCourseId' => $newCourseId
            ]);

            // 1. 更新课程表
            DB::table('c_courses')
                ->where('c_course_id', $oldCourseId)
                ->update(['c_course_id' => $newCourseId]);

            // 2. 更新课程资源表
            DB::table('c_course_resources')
                ->where('c_course_id', $oldCourseId)
                ->update([
                    'c_course_id' => $newCourseId,
                    'c_resource_path' => DB::raw("REPLACE(c_resource_path, '{$oldCourseId}', '{$newCourseId}')")
                ]);

            // 3. 更新课程实验表
            DB::table('c_course_experiments')
                ->where('c_course_id', $oldCourseId)
                ->update([
                    'c_course_id' => $newCourseId,
                    'c_experiment_id' => DB::raw("REPLACE(c_experiment_id, '{$oldCourseId}', '{$newCourseId}')")
                ]);

            // 4. 更新实验资源表
            $updatedResources = DB::table('c_experiment_resources')
                ->where('c_course_id', $oldCourseId)
                ->update([
                    'c_course_id' => $newCourseId,
                    'c_experiment_id' => DB::raw("REPLACE(c_experiment_id, '{$oldCourseId}', '{$newCourseId}')"),
                    'c_resource_id' => DB::raw("REPLACE(c_resource_id, '{$oldCourseId}', '{$newCourseId}')"),
                    'c_resource_path' => DB::raw("REPLACE(c_resource_path, '{$oldCourseId}', '{$newCourseId}')")
                ]);
            Log::info('Updated experiment resources', ['rows_affected' => $updatedResources]);

            // 5. 移动文件夹
            $oldPath = storage_path("app/resources/{$oldCourseId}");
            $newPath = storage_path("app/resources/{$newCourseId}");
            if (\File::exists($oldPath)) {
                \File::move($oldPath, $newPath);
                Log::info('Moved folder', ['oldPath' => $oldPath, 'newPath' => $newPath]);
            }

            return [
                'code' => 200,
                'message' => 'Course ID and related data updated successfully.'
            ];
        });
    }

}
