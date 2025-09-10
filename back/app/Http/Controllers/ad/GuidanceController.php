<?php

namespace App\Http\Controllers\ad;

use App\Http\Controllers\Controller;
use App\Models\ad\GuidanceInject;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Carbon\Carbon;

class GuidanceController extends Controller
{
    /**
     * 显示事件注入列表。
     */
    public function index(Request $request)
    {
        $perPage = $request->query('per_page', 10);

        $query = GuidanceInject::query()->with(['adConfig', 'targetTeam']);

        if ($request->filled('search')) {
            $query->where('c_title', 'like', '%' . $request->search . '%');
        }

        $injects = $query->latest('c_create_at')->paginate($perPage);

        return response()->json($injects);
    }

    /**
     * 存储一个新的事件注入。
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'c_title'          => 'required|string|max:255',
            'c_description'    => 'nullable|string',
            'c_type'           => ['required', 'string', Rule::in(['INFO', 'ACTION', 'ALERT'])],
            'c_ad_config_id'   => 'required|string|exists:c_ad_configs,c_id',
            'c_target_team_id' => 'required|integer|exists:c_teams,c_id',
            'c_execution_time' => 'nullable|date',
        ]);

        $inject = GuidanceInject::create($validated);

        return response()->json($inject, 201); // 201 Created
    }

    /**
     * 显示指定的事件注入。
     */
    public function show(GuidanceInject $inject)
    {
        return response()->json($inject->load(['adConfig', 'targetTeam']));
    }

    /**
     * 更新指定的事件注入。
     */
    public function update(Request $request, GuidanceInject $inject)
    {
        // 只能更新未执行的事件
        if ($inject->c_status !== 'PENDING') {
            return response()->json(['message' => '只能编辑处于“待处理”状态的事件。'], 403); // 403 Forbidden
        }

        $validated = $request->validate([
            'c_title'          => 'required|string|max:255',
            'c_description'    => 'nullable|string',
            'c_type'           => ['required', 'string', Rule::in(['INFO', 'ACTION', 'ALERT'])],
            'c_ad_config_id'   => 'required|string|exists:c_ad_configs,c_id',
            'c_target_team_id' => 'required|integer|exists:c_teams,c_id',
            'c_execution_time' => 'nullable|date',
        ]);

        $inject->update($validated);

        return response()->json($inject);
    }

    /**
     * 删除指定的事件注入。
     */
    public function destroy(GuidanceInject $inject)
    {
        // 只能删除未执行的事件
        if ($inject->c_status !== 'PENDING') {
            return response()->json(['message' => '只能删除处于“待处理”状态的事件。'], 403);
        }

        $inject->delete();

        return response()->json(['message' => '事件已删除。'], 200);
    }

    /**
     * 执行一个事件注入。
     */
    public function execute(GuidanceInject $inject)
    {
        if ($inject->c_status !== 'PENDING') {
            return response()->json(['message' => '该事件已执行或已取消，无法重复执行。'], 409); // 409 Conflict
        }

        // ★★★ 核心业务逻辑区域 ★★★
        // 在这里，你需要实现事件注入的实际逻辑。
        // 这可能包括：
        // 1. 给目标队伍发送通知。
        // 2. 在目标场景中触发一个脚本。
        // 3. 修改目标队伍的分数。
        // 4. ...等等。
        // 这是一个示例，仅更新状态：

        DB::transaction(function () use ($inject) {
            // 实现你的事件执行逻辑...

            // 更新事件状态
            $inject->c_status = 'EXECUTED';
            $inject->c_executed_at = Carbon::now();
            $inject->save();
        });

        return response()->json(['message' => '事件注入执行成功！', 'inject' => $inject]);
    }
}
