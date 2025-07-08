<?php

namespace App\Http\Controllers\Course;

use Illuminate\Http\Request;
use App\Models\Course\CategoryModel;
use Illuminate\Http\JsonResponse;
use App\Http\Controllers\Controller;
use App\Utils\GlobalResponse;
use Illuminate\Validation\ValidationException;
use Illuminate\Support\Facades\Log;

class CategoryController extends Controller
{
    /**
     * Display a listing of categories.
     *
     * @return JsonResponse
     */
    public function index(): JsonResponse
    {
        $response = CategoryModel::getAllCategories();
        return response()->json($response, $response['code'] === GlobalResponse::$DATABASE_SUCCESS_CODE ? GlobalResponse::$HTTP_STATUS_OK_CODE : GlobalResponse::$HTTP_SERVER_ERROR_CODE);
    }

    /**
     * Store a newly created category.
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function store(Request $request): JsonResponse
    {
        try {
            $request->validate([
                'name' => 'required|string|max:50|unique:c_course_categories,c_category_name',
            ]);

            $name = trim($request->input('name')); // Sanitize input
            $response = CategoryModel::insertCategory($name);
            return response()->json($response, $response['code'] === GlobalResponse::$DATABASE_SUCCESS_CODE ? 201 : 500);
        } catch (ValidationException $e) {
            return response()->json([
                'code' => GlobalResponse::$DATABASE_ERROR_CODE,
                'message' => GlobalResponse::$HTTP_REQUEST_ERROR_MES,
                'errors' => $e->errors(),
            ], 422);
        } catch (\Exception $e) {
            Log::error('[CONTROLLER] CategoryController::store: ' . $e->getMessage());
            return response()->json([
                'code' => GlobalResponse::$DATABASE_ERROR_CODE,
                'message' => GlobalResponse::$DATABASE_ERROR_MES,
                'errors' => ['server' => [$e->getMessage()]],
            ], 500);
        }
    }

    /**
     * Update the specified category.
     *
     * @param Request $request
     * @param string $id
     * @return JsonResponse
     */
    public function update(Request $request, string $id): JsonResponse
    {
        try {
            $request->validate([
                'name' => 'required|string|max:50|unique:c_course_categories,c_category_name,' . $id . ',c_category_id',
            ]);

            $name = trim($request->input('name')); // Sanitize input
            $response = CategoryModel::updateCategory($id, $name);
            return response()->json($response, $response['code'] === GlobalResponse::$DATABASE_SUCCESS_CODE ? GlobalResponse::$HTTP_STATUS_OK_CODE : 500);
        } catch (ValidationException $e) {
            return response()->json([
                'code' => GlobalResponse::$DATABASE_ERROR_CODE,
                'message' => GlobalResponse::$HTTP_REQUEST_ERROR_MES,
                'errors' => $e->errors(),
            ], 422);
        } catch (\Exception $e) {
            Log::error('[CONTROLLER] CategoryController::update: ' . $e->getMessage());
            return response()->json([
                'code' => GlobalResponse::$DATABASE_ERROR_CODE,
                'message' => GlobalResponse::$DATABASE_ERROR_MES,
                'errors' => ['server' => [$e->getMessage()]],
            ], 500);
        }
    }

    /**
     * Remove the specified category.
     *
     * @param string $id
     * @return JsonResponse
     */
    public function destroy(string $id): JsonResponse
    {
        try {
            $response = CategoryModel::deleteCategory($id);
            return response()->json($response, $response['code'] === GlobalResponse::$DATABASE_SUCCESS_CODE ? GlobalResponse::$HTTP_STATUS_OK_CODE : GlobalResponse::$HTTP_STATUS_NOTFOUND_CODE);
        } catch (\Exception $e) {
            Log::error('[CONTROLLER] CategoryController::destroy: ' . $e->getMessage());
            return response()->json([
                'code' => GlobalResponse::$DATABASE_ERROR_CODE,
                'message' => GlobalResponse::$DATABASE_ERROR_MES,
                'errors' => ['server' => [$e->getMessage()]],
            ], 500);
        }
    }
}