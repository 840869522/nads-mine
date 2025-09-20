<?php
namespace App\Models\Course;

use Illuminate\Support\Facades\DB;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Log;

class CourseLearnModel
{
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
                ->where('c.c_status', 'published')  // 新增：只查询已发布
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
                ->join('c_course_categories as cat', 'c.c_category_id', '=', 'cat.c_category_id')
                ->where('c.c_status', 'published');

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
}
