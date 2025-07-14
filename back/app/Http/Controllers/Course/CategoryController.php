<?php
namespace App\Http\Controllers\Course;

use App\Http\Controllers\Controller;
use App\Models\Course\CategoryModel;
use App\Utils\GlobalResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Log;

class CategoryController extends Controller
{
    /**
     * Get all categories.
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function index(Request $request)
    {
        try {
            $modelRes = CategoryModel::getAllCategories();
            return response()->json($modelRes, $modelRes['code'] == 200 ? 200 : 500);
        } catch (\Exception $e) {
            Log::error('[CONTROLLER] CategoryController::index: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
            ]);
            return response()->json([
                'code' => 500,
                'message' => 'Unexpected error in CategoryController::index: ' . $e->getMessage(),
                'error_details' => [
                    'error' => $e->getMessage(),
                ],
            ], 500);
        }
    }

    /**
     * Store a new category.
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function store(Request $request)
    {
        try {
            $data = $request->json()->all();
            if (empty($data)) {
                return response()->json([
                    'code' => 400,
                    'message' => '请求体为空或无效 JSON。',
                ], 400);
            }

            $validator = Validator::make($data, [
                'c_category_name' => 'required|string|max:50|unique:c_course_categories,c_category_name',
            ]);
            if ($validator->fails()) {
                return response()->json([
                    'code' => 422,
                    'message' => $validator->errors()->first(),
                    'errors' => $validator->errors()->all(),
                ], 422);
            }

            $modelRes = CategoryModel::insertCategory($data);
            return response()->json($modelRes, $modelRes['code'] == 201 ? 201 : 500);
        } catch (\Exception $e) {
            \Log::error('[CONTROLLER] CategoryController::store: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
                'request' => $data,
            ]);
            return response()->json([
                'code' => 500,
                'message' => 'CategoryController::store 发生意外错误: ' . $e->getMessage(),
                'error_details' => [
                    'error' => $e->getMessage(),
                ],
            ], 500);
        }
    }

    /**
     * Update a category.
     *
     * @param Request $request
     * @param string $id
     * @return \Illuminate\Http\JsonResponse
     */
    public function update(Request $request, $id)
    {
        $validator = Validator::make($request->json()->all(), [
            'c_category_name' => 'required|string|max:50|unique:c_course_categories,c_category_name,' . $id . ',c_category_id',
        ]);
        if ($validator->fails()) {
            return response()->json([
                'code' => 422,
                'message' => $validator->errors()->first(),
            ], 422);
        }
        $modelRes = CategoryModel::updateCategory($id, $request->json()->all());
        return response()->json($modelRes, $modelRes['code'] == 200 ? 200 : 500);
    }

    /**
     * Delete a category.
     *
     * @param Request $request
     * @param string $id
     * @return \Illuminate\Http\JsonResponse
     */
    public function destroy(Request $request, $id)
    {
        $modelRes = CategoryModel::deleteCategory($id);
        return response()->json($modelRes, $modelRes['code'] == 200 ? 200 : 404);
    }
}
