<?php
namespace App\Http\Controllers\Course;

use App\Http\Controllers\Controller;
use App\Models\Course\CategoryModel;
use App\Utils\GlobalResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class CategoryController extends Controller
{
    public function __construct()
    {
        $this->middleware('jwtcheck:view-categories')->only(['index']);
        $this->middleware('jwtcheck:manage-categories')->only(['store', 'update', 'destroy']);
    }

    /**
     * Get all categories.
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function index(Request $request)
    {
        $modelRes = CategoryModel::getAllCategories();
        return response()->json($modelRes, $modelRes['code'] == GlobalResponse::$DATABASE_SUCCESS_CODE ? 200 : 500);
    }

    /**
     * Store a new category.
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->json()->all(), [
            'c_category_name' => 'required|string|max:50|unique:c_course_categories,c_category_name',
        ]);
        if ($validator->fails()) {
            return response()->json([
                'code' => GlobalResponse::$HTTP_REQUEST_ERROR_CODE,
                'message' => $validator->errors()->first(),
            ], 422);
        }
        $modelRes = CategoryModel::insertCategory($request->json()->all());
        return response()->json($modelRes, $modelRes['code'] == GlobalResponse::$DATABASE_SUCCESS_CODE ? 201 : 500);
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
                'code' => GlobalResponse::$HTTP_REQUEST_ERROR_CODE,
                'message' => $validator->errors()->first(),
            ], 422);
        }
        $modelRes = CategoryModel::updateCategory($id, $request->json()->all());
        return response()->json($modelRes, $modelRes['code'] == GlobalResponse::$DATABASE_SUCCESS_CODE ? 200 : 500);
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
        return response()->json($modelRes, $modelRes['code'] == GlobalResponse::$DATABASE_SUCCESS_CODE ? 200 : 404);
    }
}
