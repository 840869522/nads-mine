<?php

namespace App\Http\Controllers\Support;

use App\Http\Controllers\Controller;
use App\Models\Support\FallbackTarget;
use App\Utils\GlobalResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;

class FallbackTargetController extends Controller
{
    public function __construct(Request $request)
    {
        parent::__construct($request);
    }

    public function index()
    {
        $items = FallbackTarget::orderBy('id')->get();
        return response()->json([
            'code' => GlobalResponse::$HTTP_STATUS_OK_CODE,
            'message' => GlobalResponse::HTTP_STATUS_OK_MES,
            'data' => $items,
        ]);
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:100',
            'host' => 'required|string|max:255',
            'port' => 'required|string|max:10',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'code' => GlobalResponse::$HTTP_REQUEST_ERROR_CODE,
                'message' => GlobalResponse::$HTTP_REQUEST_ERROR_MES,
                'errors' => $validator->errors(),
            ], 422);
        }

        $data = $validator->validated();

        try {
            $item = FallbackTarget::create($data);
            return response()->json([
                'code' => GlobalResponse::$HTTP_STATUS_OK_CODE,
                'message' => '创建成功',
                'data' => $item,
            ], 201);
        } catch (\Throwable $e) {
            Log::error('新增备用节点失败: ' . $e->getMessage(), ['payload' => $data]);
            return response()->json([
                'code' => GlobalResponse::$HTTP_SERVER_ERROR_CODE,
                'message' => '服务器内部错误，创建失败',
            ], 500);
        }
    }

    public function update(Request $request, FallbackTarget $target)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:100',
            'host' => 'required|string|max:255',
            'port' => 'required|string|max:10',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'code' => GlobalResponse::$HTTP_REQUEST_ERROR_CODE,
                'message' => GlobalResponse::$HTTP_REQUEST_ERROR_MES,
                'errors' => $validator->errors(),
            ], 422);
        }

        $data = $validator->validated();

        try {
            $target->update($data);
            return response()->json([
                'code' => GlobalResponse::$HTTP_STATUS_OK_CODE,
                'message' => '更新成功',
                'data' => $target,
            ]);
        } catch (\Throwable $e) {
            Log::error('更新备用节点失败: ' . $e->getMessage(), ['id' => $target->id, 'payload' => $data]);
            return response()->json([
                'code' => GlobalResponse::$HTTP_SERVER_ERROR_CODE,
                'message' => '服务器内部错误，更新失败',
            ], 500);
        }
    }

    public function destroy(FallbackTarget $target)
    {
        try {
            $target->delete();
            return response()->json([
                'code' => GlobalResponse::$HTTP_STATUS_OK_CODE,
                'message' => '删除成功',
            ]);
        } catch (\Throwable $e) {
            Log::error('删除备用节点失败: ' . $e->getMessage(), ['id' => $target->id]);
            return response()->json([
                'code' => GlobalResponse::$HTTP_SERVER_ERROR_CODE,
                'message' => '服务器内部错误，删除失败',
            ], 500);
        }
    }
}
