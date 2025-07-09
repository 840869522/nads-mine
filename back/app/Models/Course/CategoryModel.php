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
            $categories = DB::select('SELECT c_category_id, c_category_name, created_at, updated_at FROM c_course_categories');
            return [
                'code' => GlobalResponse::$DATABASE_SUCCESS_CODE,
                'message' => 'Categories retrieved successfully.',
                'data' => $categories,
            ];
        } catch (QueryException $e) {
            Log::error('[DATABASE] getAllCategories: ' . $e->getMessage());
            return [
                'code' => GlobalResponse::$DATABASE_ERROR_CODE,
                'message' => 'Failed to retrieve categories: ' . $e->getMessage(),
            ];
        } catch (\Exception $e) {
            Log::error('[GENERAL] getAllCategories: ' . $e->getMessage());
            return [
                'code' => GlobalResponse::$DATABASE_ERROR_CODE,
                'message' => 'Unexpected error occurred.',
            ];
        }
    }

    /**
     * Insert a new category.
     *
     * @param array $data
     * @return array
     */
    public static function insertCategory(array $data): array
    {
        try {
            if (empty($data['c_category_name'])) {
                return [
                    'code' => GlobalResponse::$DATABASE_ERROR_CODE,
                    'message' => 'Missing required field: c_category_name.',
                ];
            }

            $existingIds = array_column(DB::select('SELECT c_category_id FROM c_course_categories'), 'c_category_id');
            if (count($existingIds) >= 99) {
                return [
                    'code' => GlobalResponse::$DATABASE_ERROR_CODE,
                    'message' => 'Maximum number of categories reached.',
                ];
            }
            $newId = sprintf('%02d', count($existingIds) + 1);

            $categoryFolder = public_path('web/' . $newId);
            if (!File::makeDirectory($categoryFolder, 0755, true)) {
                return [
                    'code' => GlobalResponse::$DATABASE_ERROR_CODE,
                    'message' => 'Failed to create category folder.',
                ];
            }

            DB::beginTransaction();
            $result = DB::insert(
                'INSERT INTO c_course_categories (c_category_id, c_category_name, created_at, updated_at) VALUES (?, ?, NOW(), NOW())',
                [$newId, $data['c_category_name']]
            );

            if ($result) {
                DB::commit();
                return [
                    'code' => GlobalResponse::$DATABASE_SUCCESS_CODE,
                    'message' => 'Category created successfully.',
                    'data' => ['id' => $newId, 'name' => $data['c_category_name']],
                ];
            }

            DB::rollBack();
            return [
                'code' => GlobalResponse::$DATABASE_ERROR_CODE,
                'message' => 'Failed to create category.',
            ];
        } catch (QueryException $e) {
            DB::rollBack();
            Log::error('[DATABASE] insertCategory: ' . $e->getMessage());
            return [
                'code' => GlobalResponse::$DATABASE_ERROR_CODE,
                'message' => $e->getCode() == 23000 ? 'Category name already exists.' : 'Failed to create category: ' . $e->getMessage(),
            ];
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('[GENERAL] insertCategory: ' . $e->getMessage());
            return [
                'code' => GlobalResponse::$DATABASE_ERROR_CODE,
                'message' => 'Unexpected error occurred.',
            ];
        }
    }

    /**
     * Update a category.
     *
     * @param string $id
     * @param array $data
     * @return array
     */
    public static function updateCategory(string $id, array $data): array
    {
        try {
            if (!preg_match('/^\d{2}$/', $id)) {
                return [
                    'code' => GlobalResponse::$DATABASE_ERROR_CODE,
                    'message' => 'Invalid category_id format.',
                ];
            }
            if (empty($data['c_category_name'])) {
                return [
                    'code' => GlobalResponse::$DATABASE_ERROR_CODE,
                    'message' => 'Missing required field: c_category_name.',
                ];
            }

            DB::beginTransaction();
            $result = DB::update(
                'UPDATE c_course_categories SET c_category_name = ?, updated_at = NOW() WHERE c_category_id = ?',
                [$data['c_category_name'], $id]
            );

            if ($result) {
                DB::commit();
                return [
                    'code' => GlobalResponse::$DATABASE_SUCCESS_CODE,
                    'message' => 'Category updated successfully.',
                ];
            }

            DB::rollBack();
            return [
                'code' => GlobalResponse::$DATABASE_ERROR_CODE,
                'message' => 'Category not found.',
            ];
        } catch (QueryException $e) {
            DB::rollBack();
            Log::error('[DATABASE] updateCategory: ' . $e->getMessage());
            return [
                'code' => GlobalResponse::$DATABASE_ERROR_CODE,
                'message' => $e->getCode() == 23000 ? 'Category name already exists.' : 'Failed to update category: ' . $e->getMessage(),
            ];
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('[GENERAL] updateCategory: ' . $e->getMessage());
            return [
                'code' => GlobalResponse::$DATABASE_ERROR_CODE,
                'message' => 'Unexpected error occurred.',
            ];
        }
    }

    /**
     * Delete a category.
     *
     * @param string $id
     * @return array
     */
    public static function deleteCategory(string $id): array
    {
        try {
            if (!preg_match('/^\d{2}$/', $id)) {
                return [
                    'code' => GlobalResponse::$DATABASE_ERROR_CODE,
                    'message' => 'Invalid category_id format.',
                ];
            }

            // Check if category has associated courses
            $hasCourses = DB::table('c_courses')->where('category_id', $id)->exists();
            if ($hasCourses) {
                return [
                    'code' => GlobalResponse::$DATABASE_ERROR_CODE,
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
                    'code' => GlobalResponse::$DATABASE_SUCCESS_CODE,
                    'message' => 'Category deleted successfully.',
                ];
            }
            DB::rollBack();
            return [
                'code' => GlobalResponse::$DATABASE_ERROR_CODE,
                'message' => 'Category not found.',
            ];
        } catch (QueryException $e) {
            DB::rollBack();
            Log::error('[DATABASE] deleteCategory: ' . $e->getMessage());
            return [
                'code' => GlobalResponse::$DATABASE_ERROR_CODE,
                'message' => $e->getCode() == 23000 ? 'Category is referenced by courses.' : 'Failed to delete category: ' . $e->getMessage(),
            ];
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('[GENERAL] deleteCategory: ' . $e->getMessage());
            return [
                'code' => GlobalResponse::$DATABASE_ERROR_CODE,
                'message' => 'Unexpected error occurred.',
            ];
        }
    }
}
