<?php

namespace App\Http\Controllers\ad;

use App\Http\Controllers\Controller;
use App\Models\ad\Referee; // 引入 Referee 模型
use App\Models\User;           // 引入 User 模型
use App\Models\Users\UserModel;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * RefereeController for managing referees using the Eloquent model.
 * It handles CRUD operations and provides a list of users available to become referees.
 */
class RefereeController extends Controller
{
    /**
     * 获取所有裁判的列表，并包含其关联的用户信息。
     * Handles: GET /api/drill/referee
     *
     * @return \Illuminate\Http\JsonResponse
     */
    public function index()
    {
        // 使用 with('user') 进行预加载，避免 N+1 查询问题，提高性能
        // 这会将关联的 user 对象一并返回给前端
        $referees = Referee::with('user')->latest('c_id')->get();

        return response()->json([
            'status' => 'success',
            'data' => $referees
        ]);
    }

    /**
     * 创建一个新裁判并保存到数据库。
     * Handles: POST /api/drill/referee
     *
     * @param  \Illuminate\Http\Request  $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function store(Request $request)
    {
        // 验证前端发送过来的数据
        $validatedData = $request->validate([
            // 确保 c_user_id 存在于 users 表中，并且在 c_referees 表中是唯一的
            'c_user_id'       => 'required|integer|exists:users,id|unique:c_referees,c_user_id',
            'c_real_name'     => 'nullable|string|max:50',
            // 使用 Rule::in 确保级别是预设的几个值之一
            'c_level'         => ['required', 'string', Rule::in(['Head', 'Standard', 'Assistant'])],
            'c_expertise'     => 'nullable|string|max:255',
            'c_contact_info'  => 'nullable|string|max:255',
        ]);

        // 创建新裁判
        $referee = Referee::create($validatedData);

        // 加载关联的用户信息，并返回给前端，以便前端实时更新列表
        $referee->load('user');

        return response()->json([
            'message' => '裁判 "' . $referee->user->user_name . '" 已成功创建！',
            'data'    => $referee
        ], 201);
    }

    /**
     * 显示指定的裁判信息。
     * Handles: GET /api/drill/referee/{referee}
     *
     * @param  \App\Models\ad\Referee  $referee
     * @return \Illuminate\Http\JsonResponse
     */
    public function show(Referee $referee)
    {
        // 路由模型绑定已自动找到裁判，我们只需加载其用户信息并返回
        $referee->load('user');
        return response()->json($referee);
    }

    /**
     * 更新指定的裁判信息。
     * Handles: PUT /api/drill/referee/{referee}
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  \App\Models\ad\Referee  $referee
     * @return \Illuminate\Http\JsonResponse
     */
    public function update(Request $request, Referee $referee)
    {
        // 验证要更新的数据
        $validatedData = $request->validate([
            // 注意：我们通常不允许修改裁判所关联的用户ID (c_user_id)
            'c_real_name'     => 'nullable|string|max:50',
            'c_level'         => ['required', 'string', Rule::in(['Head', 'Standard', 'Assistant'])],
            'c_expertise'     => 'nullable|string|max:255',
            'c_contact_info'  => 'nullable|string|max:255',
        ]);

        // 更新裁判数据
        $referee->update($validatedData);

        // 加载关联的用户信息并返回
        $referee->load('user');

        return response()->json($referee);
    }

    /**
     * 删除指定的裁判。
     * Handles: DELETE /api/drill/referee/{referee}
     *
     * @param  \App\Models\ad\Referee  $referee
     * @return \Illuminate\Http\Response
     */
    public function destroy(Referee $referee)
    {
        // 删除裁判记录，由于外键约束，不会影响 c_users 表中的用户
        $referee->delete();

        return response()->noContent();
    }

    /**
     * 获取所有尚未被指定为裁判的用户列表。
     * 这是前端“添加新裁判”下拉框所需的数据源。
     * Handles: GET /api/drill/available-users
     *
     * @return \Illuminate\Http\JsonResponse
     */
    public function availableUsers()
    {
        // 1. 获取所有已经被分配为裁判的用户ID
        $assignedUserIds = Referee::pluck('c_user_id');

        // 2. 从 users 表中查询ID不在此列表中的用户
        $availableUsers = UserModel::whereNotIn('id', $assignedUserIds)
            ->select('id', 'user_name', 'email') // 只选择前端需要的字段
            ->orderBy('user_name', 'asc')      // 按用户名排序
            ->get();

        return response()->json(['data' => $availableUsers]);
    }
}
