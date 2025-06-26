<?php

namespace App\Http\Controllers\Drill;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
// use App\Models\Team; // 我们不再需要模型，因为不使用数据库
// We will call the File facade by its full name, so this 'use' statement is no longer needed.
// use Illuminate\Support\Facades\File; 
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

/**
 * TeamController for managing teams using a JSON file as storage.
 */
class TeamController extends Controller
{
    /**
     * 获取 teams.json 文件的完整路径
     * @return string
     */
    private function getTeamsFilePath(): string
    {
        // storage_path('app/...') 是 Laravel 存放非公开文件的标准位置
        return storage_path('app/teams.json');
    }

    /**
     * 从 JSON 文件中读取所有队伍数据
     * @return array
     */
    private function readTeamsFromFile(): array
    {
        $path = $this->getTeamsFilePath();

        // 如果文件不存在，直接返回空数组
        // FIX: Use the fully qualified class name to prevent namespace issues.
        if (!\Illuminate\Support\Facades\File::exists($path)) {
            return [];
        }

        // 读取文件内容并解码 JSON
        // FIX: Use the fully qualified class name.
        $jsonContent = \Illuminate\Support\Facades\File::get($path);
        // 如果解码失败或文件为空，也返回空数组
        return json_decode($jsonContent, true) ?: [];
    }

    /**
     * 获取所有队伍的列表
     * Handles GET /api/drill/team
     *
     * @return \Illuminate\Http\JsonResponse
     */
    public function index()
    {
        // 从文件读取数据，而不是从数据库
        $teams = $this->readTeamsFromFile();

        // 为了与前端兼容，我们保留模拟数据的功能
        $teamsWithSimulatedData = array_map(function ($team) {
            $team['member_count'] = $team['member_count'] ?? rand(1, 1);
            $team['score'] = $team['score'] ?? rand(101, 101);
            return $team;
        }, $teams);
        
        // 倒序排列数组，模拟 latest() 的效果，让最新的队伍排在前面
        $sortedTeams = array_reverse($teamsWithSimulatedData);

        return response()->json([
            'status' => 'success',
            'data' => $sortedTeams
        ]);
    }

    /**
     * 创建一个新队伍并保存到文件
     * Handles POST /api/drill/team
     *
     * @param  \Illuminate\Http\Request  $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function store(Request $request)
    {
        // 首先，读取现有数据用于验证
        $allTeams = $this->readTeamsFromFile();

        // 验证规则基本不变，但 unique 规则需要自定义
        $validator = Validator::make($request->all(), [
            'name' => [
                'required',
                'string',
                'max:255',
                // 自定义验证规则，检查名称在文件中是否唯一
                function ($attribute, $value, $fail) use ($allTeams) {
                    $nameExists = collect($allTeams)->contains(function ($team) use ($value) {
                        return strtolower($team['name']) === strtolower($value);
                    });
                    if ($nameExists) {
                        // 使用和 Laravel 默认一样的错误消息
                        $fail('The ' . str_replace('_', ' ', $attribute) . ' has already been taken.');
                    }
                }
            ],
            'color' => ['required', 'string', Rule::in(['red', 'blue'])],
            'description' => 'nullable|string|max:1000',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'The given data was invalid.',
                'errors' => $validator->errors()
            ], 422);
        }

        // 手动生成新 ID
        // 获取最后一个队伍的 ID，如果数组为空则为 0，然后加 1
        $lastId = !empty($allTeams) ? end($allTeams)['id'] : 0;
        
        $newTeam = [
            'id' => $lastId + 1,
            'name' => $request->input('name'),
            'color' => $request->input('color'),
            'description' => $request->input('description'),

        ];

        // 将新队伍添加到数组中
        $allTeams[] = $newTeam;

        // 将更新后的整个数组写回 JSON 文件
        // JSON_PRETTY_PRINT 让文件内容更易读
        // FIX: Use the fully qualified class name.
        \Illuminate\Support\Facades\File::put($this->getTeamsFilePath(), json_encode($allTeams, JSON_PRETTY_PRINT));

        // 返回与之前一致的成功响应
        return response()->json($newTeam, 201);
    }
}
