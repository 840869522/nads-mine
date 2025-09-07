<?php

namespace App\Http\Controllers\scenario;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use Symfony\Component\Process\Process;
use Symfony\Component\Process\Exception\ProcessFailedException;

class IptablesController extends Controller
{
    /**
     * 列出指定表（默认 nat）的所有规则（解析自 iptables-save）。
     * GET /api/iptables?table=nat
     */
    public function index(Request $request)
    {
        $table = $request->query('table', 'nat');
        $allowed = ['nat', 'filter', 'mangle', 'raw', 'security'];
        if (!in_array($table, $allowed, true)) {
            return response()->json(['message' => '非法表名', 'allowed' => $allowed], 422);
        }

        try {
            $cmd = ['sudo', 'iptables-save', '-t', $table];
            $p = new Process($cmd);
            $p->run();
            if (!$p->isSuccessful()) {
                throw new ProcessFailedException($p);
            }

            $lines = preg_split('/\r?\n/', $p->getOutput());
            $rules = [];
            foreach ($lines as $line) {
                $line = trim($line);
                if ($line === '' || !str_starts_with($line, '-A ')) continue;
                $parts = preg_split('/\s+/', $line);
                if (count($parts) < 3) continue;
                $chain = $parts[1] ?? '';
                $args = array_slice($parts, 2);

                // 提取常见字段，便于前端展示
                $dport = null; $jump = null; $toDest = null; $proto = null;
                for ($i = 0; $i < count($args); $i++) {
                    if ($args[$i] === '-p' && isset($args[$i+1])) $proto = $args[$i+1];
                    if ($args[$i] === '--dport' && isset($args[$i+1])) $dport = $args[$i+1];
                    if ($args[$i] === '-j' && isset($args[$i+1])) $jump = $args[$i+1];
                    if ($args[$i] === '--to-destination' && isset($args[$i+1])) $toDest = $args[$i+1];
                }

                $id = hash('sha1', $chain . '|' . implode(' ', $args) . "|{$table}");
                $rules[] = [
                    'id' => $id,
                    'table' => $table,
                    'chain' => $chain,
                    'args' => $args,
                    'raw' => $line,
                    'protocol' => $proto,
                    'dport' => $dport,
                    'jump' => $jump,
                    'to_destination' => $toDest,
                ];
            }

            return response()->json(['table' => $table, 'rules' => $rules]);
        } catch (\Throwable $e) {
            Log::error('[iptables] 获取规则失败: ' . $e->getMessage());
            return response()->json(['message' => '获取 iptables 规则失败', 'error' => $e->getMessage()], 500);
        }
    }

    /**
     * 删除一条规则：支持传 raw（-A 开头的行）或 chain+args（数组）。
     * DELETE /api/iptables
     * body: { table?: 'nat', raw?: string } | { table?: 'nat', chain: string, args: string[] }
     */
    public function destroy(Request $request)
    {
        $table = $request->input('table', 'nat');
        $allowed = ['nat', 'filter', 'mangle', 'raw', 'security'];
        if (!in_array($table, $allowed, true)) {
            return response()->json(['message' => '非法表名', 'allowed' => $allowed], 422);
        }

        $raw = $request->input('raw');
        $chain = $request->input('chain');
        $args = $request->input('args');

        if ($raw) {
            $line = trim($raw);
            if (!str_starts_with($line, '-A ')) {
                return response()->json(['message' => 'raw 必须以 -A 开头的规则行'], 422);
            }
            $parts = preg_split('/\s+/', $line);
            if (count($parts) < 3) {
                return response()->json(['message' => 'raw 规则格式不合法'], 422);
            }
            $chain = $parts[1];
            $args = array_slice($parts, 2);
        } else {
            $v = Validator::make($request->all(), [
                'chain' => 'required|string',
                'args' => 'required|array',
            ]);
            if ($v->fails()) {
                return response()->json(['message' => '缺少必要参数（raw 或 chain+args）', 'errors' => $v->errors()], 422);
            }
            if (!is_array($args)) {
                return response()->json(['message' => 'args 必须为字符串数组'], 422);
            }
        }

        // 执行删除
        try {
            $cmd = array_merge(['sudo', 'iptables', '-t', $table, '-D', $chain], $args);
            Log::info('[iptables] 删除规则: ' . implode(' ', $cmd));
            $p = new Process($cmd);
            $p->run();
            if (!$p->isSuccessful()) {
                // 以容错为主：返回 207，便于前端提示但不中断批量操作
                return response()->json([
                    'message' => '删除规则失败，可能规则不存在',
                    'error' => $p->getErrorOutput(),
                    'stderr' => $p->getErrorOutput(),
                    'stdout' => $p->getOutput(),
                ], 207);
            }
            return response()->json(['message' => '删除成功']);
        } catch (\Throwable $e) {
            Log::error('[iptables] 删除规则异常: ' . $e->getMessage());
            return response()->json(['message' => '删除规则异常', 'error' => $e->getMessage()], 500);
        }
    }
}

