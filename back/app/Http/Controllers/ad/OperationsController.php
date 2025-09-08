<?php

namespace App\Http\Controllers\ad;

use App\Http\Controllers\Controller;
use App\Models\ad\SystemLog;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rule;

class OperationsController extends Controller
{
    /**
     * 显示系统日志列表。
     */
    public function index(Request $request)
    {
        $request->validate([
            'level' => ['nullable', 'string', Rule::in(['INFO', 'WARNING', 'ERROR', 'CRITICAL'])],
            'status' => ['nullable', 'string', Rule::in(['OPEN', 'ACKNOWLEDGED', 'RESOLVED'])],
        ]);

        $perPage = $request->query('per_page', 10);

        $query = SystemLog::query();

        if ($request->filled('level')) {
            $query->where('c_level', $request->level);
        }
        if ($request->filled('status')) {
            $query->where('c_status', $request->status);
        }

        $logs = $query->latest('c_timestamp')->paginate($perPage);

        return response()->json($logs);
    }

    /**
     * 确认一条日志。
     */
    public function acknowledge(SystemLog $log)
    {
        if ($log->c_status !== 'OPEN') {
            return response()->json(['message' => '该日志已被处理，无法再次确认。'], 409);
        }

        $log->c_status = 'ACKNOWLEDGED';
        $log->c_acknowledged_by = Auth::user()->c_username; // 记录当前操作用户
        $log->save();

        return response()->json(['message' => '日志已确认。', 'log' => $log]);
    }

    /**
     * 解决一条日志。
     */
    public function resolve(Request $request, SystemLog $log)
    {
        if ($log->c_status === 'RESOLVED') {
            return response()->json(['message' => '该日志已被解决。'], 409);
        }

        $validated = $request->validate([
            'notes' => 'required|string|min:5',
        ]);

        $log->c_status = 'RESOLVED';
        $log->c_resolved_by = Auth::user()->c_username;
        $log->c_resolution_notes = $validated['notes'];
        $log->save();

        return response()->json(['message' => '日志已解决。', 'log' => $log]);
    }
}
