<?php
namespace App\Models\Course;

use Illuminate\Support\Facades\DB;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\File;
use App\Utils\GlobalResponse;

class CategoryModel
{
    /**
     * Get all categories.
     *
     * @return array
     */
    public static function getAllCategories(): array
    {
        try {
            // 检查数据库连接
            DB::connection()->getPdo();
            $categories = DB::select('SELECT c_category_id, c_category_name FROM c_course_categories');
            return [
                'code' => 200,
                'message' => 'Categories retrieved successfully.',
                'data' => $categories,
            ];
        } catch (QueryException $e) {
            Log::error('[DATABASE] getAllCategories: ' . $e->getMessage(), [
                'sql' => 'SELECT c_category_id, c_category_name FROM c_course_categories',
                'error_code' => $e->getCode(),
                'trace' => $e->getTraceAsString(),
            ]);
            return [
                'code' => 500,
                'message' => 'Failed to retrieve categories: ' . $e->getMessage(),
                'error_details' => [
                    'sql_error' => $e->getMessage(),
                    'sql_code' => $e->getCode(),
                ],
            ];
        } catch (\Exception $e) {
            Log::error('[GENERAL] getAllCategories: ' . $e->getMessage(), [
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

    public static function insertCategory(array $data): array
    {
        try {
            if (empty($data['c_category_name'])) {
                return [
                    'code' => 422,
                    'message' => '缺少必填字段: c_category_name。',
                ];
            }

            $categoryName = mb_convert_encoding($data['c_category_name'], 'UTF-8', 'UTF-8');
            if (mb_strlen($categoryName) > 50) {
                return [
                    'code' => 422,
                    'message' => '类别名称不能超过50个字符。',
                ];
            }

            // 稳定生成 ID：从最大值加一
            $maxIdRow = DB::selectOne('SELECT MAX(CAST(c_category_id AS UNSIGNED)) as max_id FROM c_course_categories');
            $newIdNum = ($maxIdRow->max_id ?? 0) + 1;
            if ($newIdNum > 99) {
                return [
                    'code' => 422,
                    'message' => '已达到最大类别数限制（99）。',
                ];
            }
            $newId = sprintf('%02d', $newIdNum);

            $categoryFolder = public_path('web/' . $newId);
            if (!File::makeDirectory($categoryFolder, 0755, true)) {
                \Log::error('[FILESYSTEM] insertCategory: 无法创建目录', [
                    'path' => $categoryFolder,
                ]);
                return [
                    'code' => 500,
                    'message' => '无法创建类别文件夹。',
                ];
            }

            DB::beginTransaction();
            $result = DB::insert(
                'INSERT INTO c_course_categories (c_category_id, c_category_name) VALUES (?, ?)',
                [$newId, $categoryName]
            );

            if ($result) {
                DB::commit();
                return [
                    'code' => 201,
                    'message' => '类别创建成功。',
                    'data' => ['id' => $newId, 'name' => $categoryName],
                ];
            }

            DB::rollBack();
            return [
                'code' => 500,
                'message' => '无法创建类别。',
            ];
        } catch (QueryException $e) {
            DB::rollBack();
            \Log::error('[DATABASE] insertCategory: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
                'data' => $data,
                'sql' => 'INSERT INTO c_course_categories (c_category_id, c_category_name) VALUES (?, ?)',
                'bindings' => [$newId ?? '未生成', $data['c_category_name']],
            ]);
            return [
                'code' => $e->getCode() == 23000 ? 422 : 500,
                'message' => $e->getCode() == 23000 ? '类别名称已存在。' : '无法创建类别: ' . $e->getMessage(),
                'error_details' => [
                    'sql_error' => $e->getMessage(),
                    'sql_code' => $e->getCode(),
                ],
            ];
        } catch (\Exception $e) {
            DB::rollBack();
            \Log::error('[GENERAL] insertCategory: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
                'data' => $data,
            ]);
            return [
                'code' => 500,
                'message' => '发生意外错误: ' . $e->getMessage(),
                'error_details' => [
                    'error' => $e->getMessage(),
                ],
            ];
        }
    }

    public static function updateCategory(string $id, array $data): array
    {
        try {
            if (!preg_match('/^\d{2}$/', $id)) {
                return [
                    'code' => 422,
                    'message' => 'Invalid category_id format.',
                ];
            }
            if (empty($data['c_category_name'])) {
                return [
                    'code' => 422,
                    'message' => 'Missing required field: c_category_name.',
                ];
            }

            DB::beginTransaction();
            $result = DB::update(
                'UPDATE c_course_categories SET c_category_name = ? WHERE c_category_id = ?',
                [$data['c_category_name'], $id]
            );

            if ($result) {
                DB::commit();
                return [
                    'code' => 200,
                    'message' => 'Category updated successfully.',
                ];
            }

            DB::rollBack();
            return [
                'code' => 404,
                'message' => 'Category not found.',
            ];
        } catch (QueryException $e) {
            DB::rollBack();
            Log::error('[DATABASE] updateCategory: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
            ]);
            return [
                'code' => 500,
                'message' => $e->getCode() == 23000 ? 'Category name already exists.' : 'Failed to update category: ' . $e->getMessage(),
            ];
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('[GENERAL] updateCategory: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
            ]);
            return [
                'code' => 500,
                'message' => 'Unexpected error occurred: ' . $e->getMessage(),
            ];
        }
    }

    public static function deleteCategory(string $id): array
    {
        try {
            if (!preg_match('/^\d{2}$/', $id)) {
                return [
                    'code' => 422,
                    'message' => 'Invalid category_id format.',
                ];
            }

            $hasCourses = DB::table('c_courses')->where('category_id', $id)->exists();
            if ($hasCourses) {
                return [
                    'code' => 422,
                    'message' => 'Cannot delete category with associated courses.',
                ];
            }

            $categoryFolder = public_path('web/' . $id);
            DB::beginTransaction();
            $result = DB::delete('DELETE FROM c_course_categories WHERE c_category_id = ?', [$id]);
            if ($result) {
                if (File::exists($categoryFolder)) {
                    File::deleteDirectory($categoryFolder);
                }
                DB::commit();
                return [
                    'code' => 200,
                    'message' => 'Category deleted successfully.',
                ];
            }
            DB::rollBack();
            return [
                'code' => 404,
                'message' => 'Category not found.',
            ];
        } catch (QueryException $e) {
            DB::rollBack();
            Log::error('[DATABASE] deleteCategory: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
            ]);
            return [
                'code' => 500,
                'message' => $e->getCode() == 23000 ? 'Category is referenced by courses.' : 'Failed to delete category: ' . $e->getMessage(),
            ];
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('[GENERAL] deleteCategory: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
            ]);
            return [
                'code' => 500,
                'message' => 'Unexpected error occurred: ' . $e->getMessage(),
            ];
        }
    }
}
