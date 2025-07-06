<?php

namespace App\Models\Course;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Database\QueryException;
use App\Utils\GlobalResponse;

class CategoryModel extends Model
{
    protected $table = 'c_course_categories';
    protected $primaryKey = 'c_category_id';
    protected $keyType = 'string';
    public $incrementing = false;

    /**
     * Get all categories.
     *
     * @return array
     */
    public static function getAllCategories(): array
    {
        try {
            $categories = DB::table('c_course_categories')->get()->toArray();
            // Ensure UTF-8 encoding for string fields
            $categories = array_map(function ($category) {
                $category->c_category_id = mb_convert_encoding($category->c_category_id, 'UTF-8', 'UTF-8');
                $category->c_category_name = mb_convert_encoding($category->c_category_name, 'UTF-8', 'UTF-8');
                return $category;
            }, $categories);
            return [
                'code' => GlobalResponse::$DATABASE_SUCCESS_CODE,
                'data' => $categories,
                'message' => GlobalResponse::HTTP_STATUS_OK_MES,
            ];
        } catch (QueryException $e) {
            Log::error('[DATABASE] getAllCategories: ' . $e->getMessage());
            return [
                'code' => GlobalResponse::$DATABASE_ERROR_CODE,
                'message' => GlobalResponse::$DATABASE_ERROR_MES,
            ];
        }
    }

    /**
     * Insert a new category.
     *
     * @param string|null $name
     * @return array
     */
    public static function insertCategory(?string $name): array
    {
        try {
            if (empty($name)) {
                return [
                    'code' => GlobalResponse::$DATABASE_ERROR_CODE,
                    'message' => 'Category name is required.',
                    'errors' => ['name' => ['The category name field is required.']],
                ];
            }

            $name = mb_convert_encoding($name, 'UTF-8', 'UTF-8'); // Ensure UTF-8 encoding

            DB::beginTransaction();
            // Generate a two-character category ID (e.g., '01')
            $existingIds = DB::table('c_course_categories')->pluck('c_category_id')->toArray();
            $newId = sprintf('%02d', count($existingIds) + 1);

            $result = DB::insert(
                "INSERT INTO c_course_categories (c_category_id, c_category_name, created_at, updated_at) VALUES (?, ?, NOW(), NOW())",
                [$newId, $name]
            );

            DB::commit();

            return [
                'code' => $result ? GlobalResponse::$DATABASE_SUCCESS_CODE : GlobalResponse::$DATABASE_ERROR_CODE,
                'data' => ['c_category_id' => $newId, 'c_category_name' => $name],
                'message' => $result ? 'Category created successfully.' : GlobalResponse::$DATABASE_ERROR_MES,
            ];
        } catch (QueryException $e) {
            DB::rollBack();
            Log::error('[DATABASE] insertCategory: ' . $e->getMessage());
            $message = $e->getCode() == 23000 ? 'The category name has already been taken.' : GlobalResponse::$DATABASE_ERROR_MES;
            return [
                'code' => GlobalResponse::$DATABASE_ERROR_CODE,
                'message' => $message,
                'errors' => ['name' => [$message]],
            ];
        }
    }

    /**
     * Update a category by ID.
     *
     * @param string $id
     * @param string|null $name
     * @return array
     */
    public static function updateCategory(string $id, ?string $name): array
    {
        try {
            if (empty($name)) {
                return [
                    'code' => GlobalResponse::$DATABASE_ERROR_CODE,
                    'message' => 'Category name is required.',
                    'errors' => ['name' => ['The category name field is required.']],
                ];
            }

            $name = mb_convert_encoding($name, 'UTF-8', 'UTF-8'); // Ensure UTF-8 encoding
            $id = mb_convert_encoding($id, 'UTF-8', 'UTF-8'); // Ensure UTF-8 encoding for ID

            $result = DB::update(
                "UPDATE c_course_categories SET c_category_name = ?, updated_at = NOW() WHERE c_category_id = ?",
                [$name, $id]
            );

            return [
                'code' => $result ? GlobalResponse::$DATABASE_SUCCESS_CODE : GlobalResponse::$DATABASE_ERROR_CODE,
                'message' => $result ? 'Category updated successfully.' : 'Category not found.',
                'data' => $result ? ['c_category_id' => $id, 'c_category_name' => $name] : null,
            ];
        } catch (QueryException $e) {
            Log::error('[DATABASE] updateCategory: ' . $e->getMessage());
            $message = $e->getCode() == 23000 ? 'The category name has already been taken.' : GlobalResponse::$DATABASE_ERROR_MES;
            return [
                'code' => GlobalResponse::$DATABASE_ERROR_CODE,
                'message' => $message,
                'errors' => ['name' => [$message]],
            ];
        }
    }

    /**
     * Delete a category by ID.
     *
     * @param string $id
     * @return array
     */
    public static function deleteCategory(string $id): array
    {
        try {
            $id = mb_convert_encoding($id, 'UTF-8', 'UTF-8'); // Ensure UTF-8 encoding
            $result = DB::delete("DELETE FROM c_course_categories WHERE c_category_id = ?", [$id]);
            return [
                'code' => $result ? GlobalResponse::$DATABASE_SUCCESS_CODE : GlobalResponse::$DATABASE_ERROR_CODE,
                'message' => $result ? 'Category deleted successfully.' : 'Category not found.',
            ];
        } catch (QueryException $e) {
            Log::error('[DATABASE] deleteCategory: ' . $e->getMessage());
            $message = $e->getCode() == 23000 ? 'Category is referenced by courses.' : GlobalResponse::$DATABASE_ERROR_MES;
            return [
                'code' => GlobalResponse::$DATABASE_ERROR_CODE,
                'message' => $message,
            ];
        }
    }
}