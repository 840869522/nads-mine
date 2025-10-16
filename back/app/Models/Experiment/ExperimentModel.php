<?php
namespace App\Models\Experiment;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Storage;
class ExperimentModel
{
   public static function createExperiment(string $courseId, array $data): array
{
    DB::beginTransaction();
    try {
        Log::info('=== 开始创建实验调试 ===');
        Log::info('传入数据:', ['courseId' => $courseId, 'data' => $data]);

        // 1. 校验必填字段
        $requiredFields = ['c_experiment_name', 'c_config_id', 'c_start', 'c_end'];
        foreach ($requiredFields as $field) {
            if (empty($data[$field])) {
                Log::error('缺少必填字段', ['field' => $field, 'data' => $data]);
                return [
                    'code' => 422,
                    'message' => "Missing required field: {$field}",
                ];
            }
        }
        Log::info('必填字段校验通过');

        // 2. 时间格式校验
        $startTime = strtotime($data['c_start']);
        $endTime = strtotime($data['c_end']);
        if (!$startTime || !$endTime) {
            Log::error('时间格式无效', ['c_start' => $data['c_start'], 'c_end' => $data['c_end']]);
            return [
                'code' => 422,
                'message' => 'Invalid time format: c_start/c_end must be Y-m-d H:i:s',
            ];
        }
        Log::info('时间格式校验通过', ['start' => $data['c_start'], 'end' => $data['c_end']]);

        // 3. 校验课程是否存在
        $course = DB::table('c_courses')->where('c_course_id', $courseId)->first();
        if (!$course) {
            Log::error('课程不存在', ['courseId' => $courseId]);
            return [
                'code' => 422,
                'message' => 'Invalid course_id: Course does not exist.',
            ];
        }
        Log::info('课程存在', ['course' => $course]);

        // 4. 校验场景配置是否存在
        $sceneConfig = DB::table('c_scene_configs')->where('c_config_id', $data['c_config_id'])->first();
        if (!$sceneConfig) {
            Log::error('场景配置不存在', ['config_id' => $data['c_config_id']]);
            return [
                'code' => 422,
                'message' => 'Invalid c_config_id: Scene config does not exist.',
            ];
        }
        Log::info('场景配置存在', ['config_id' => $data['c_config_id']]);

        // 5. 生成唯一的实验ID
        $categoryId = $course->c_category_id;
        
        // 方法1：查找当前课程下最大的实验编号
        $maxExperiment = DB::table('c_course_experiments')
            ->where('c_course_id', $courseId)
            ->orderBy('c_experiment_id', 'desc')
            ->first();

        $experimentNumber = 1;
        if ($maxExperiment) {
            // 从现有最大ID中提取编号部分（假设ID格式为：010100101, 010100102 等）
            $maxId = $maxExperiment->c_experiment_id;
            $numberPart = substr($maxId, -2); // 获取最后2位
            $experimentNumber = intval($numberPart) + 1;
            
            Log::info('从最大ID提取编号', [
                'maxId' => $maxId,
                'numberPart' => $numberPart,
                'nextNumber' => $experimentNumber
            ]);
        }

        // 生成初始ID
        $experimentId = sprintf('%s%s%02d', $categoryId, $courseId, $experimentNumber);
        
        Log::info('初始实验ID', [
            'categoryId' => $categoryId,
            'courseId' => $courseId,
            'experimentNumber' => $experimentNumber,
            'experimentId' => $experimentId
        ]);

        // 6. 双重检查：确保新生成的ID确实不存在，如果存在则递增编号
        $retryCount = 0;
        $maxRetries = 20; // 最大重试次数，防止无限循环
        
        while (DB::table('c_course_experiments')->where('c_experiment_id', $experimentId)->exists()) {
            $retryCount++;
            $experimentNumber++;
            $experimentId = sprintf('%s%s%02d', $categoryId, $courseId, $experimentNumber);
            
            Log::warning('实验ID冲突，重新生成', [
                'newExperimentId' => $experimentId,
                'retryCount' => $retryCount,
                'newNumber' => $experimentNumber
            ]);
            
            if ($retryCount >= $maxRetries) {
                Log::error('实验ID生成多次冲突，达到最大重试次数', [
                    'courseId' => $courseId,
                    'maxRetries' => $maxRetries
                ]);
                return [
                    'code' => 500,
                    'message' => '无法生成唯一的实验ID，请联系管理员。',
                ];
            }
        }

        Log::info('最终确定的实验ID', [
            'experimentId' => $experimentId,
            'finalNumber' => $experimentNumber,
            'retryCount' => $retryCount
        ]);

        // 7. 创建实验文件夹
        $experimentFolder = "courses/{$categoryId}/{$courseId}/Experiment/{$experimentId}";
        Log::info('准备创建文件夹', ['folder' => $experimentFolder]);
        
        try {
            if (!Storage::disk('local_resources')->exists($experimentFolder)) {
                $created = Storage::disk('local_resources')->makeDirectory($experimentFolder, 0755, true);
                if (!$created) {
                    Log::error('文件夹创建失败', ['folder' => $experimentFolder]);
                    return [
                        'code' => 500,
                        'message' => 'Failed to create experiment folder.',
                    ];
                }
                Log::info('文件夹创建成功', ['folder' => $experimentFolder]);
            } else {
                Log::info('文件夹已存在', ['folder' => $experimentFolder]);
            }
        } catch (\Exception $e) {
            Log::error('文件夹创建异常', [
                'folder' => $experimentFolder,
                'error' => $e->getMessage()
            ]);
            throw $e;
        }

        // 8. 插入数据库
        Log::info('准备插入数据库', [
            'experimentId' => $experimentId,
            'data' => [
                'c_experiment_name' => $data['c_experiment_name'],
                'c_description' => $data['c_description'] ?? null,
                'c_config_id' => $data['c_config_id'],
                'c_start' => $data['c_start'],
                'c_end' => $data['c_end']
            ]
        ]);

        $result = DB::insert(
            'INSERT INTO c_course_experiments (
                c_experiment_id, c_course_id, c_experiment_name, c_description, 
                c_config_id, c_start, c_end, created_at, updated_at
             ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())',
            [
                $experimentId,
                $courseId,
                $data['c_experiment_name'],
                $data['c_description'] ?? null,
                $data['c_config_id'],
                $data['c_start'],
                $data['c_end'],
            ]
        );

        if (!$result) {
            Log::error('数据库插入失败', ['experimentId' => $experimentId]);
            DB::rollBack();
            return [
                'code' => 500,
                'message' => 'Failed to create experiment.',
            ];
        }

        Log::info('数据库插入成功', ['experimentId' => $experimentId]);
        DB::commit();
        
        Log::info('=== 实验创建完成 ===', ['experimentId' => $experimentId]);
        
        return [
            'code' => 201,
            'message' => 'Experiment created successfully.',
            'data' => ['c_experiment_id' => $experimentId],
        ];

    } catch (\Exception $e) {
        DB::rollBack();
        Log::error('创建实验异常: ' . $e->getMessage(), [
            'exception_class' => get_class($e),
            'exception_message' => $e->getMessage(),
            'exception_file' => $e->getFile(),
            'exception_line' => $e->getLine(),
            'stack_trace' => $e->getTraceAsString(),
            'input_data' => ['courseId' => $courseId, 'data' => $data]
        ]);
        return [
            'code' => 500,
            'message' => 'Unexpected error occurred: ' . $e->getMessage(),
        ];
    }
}

public static function updateExperiment(string $courseId, string $experimentId, array $data): array
{
    try {
        // 1. 新增：校验 c_start、c_end 必传
        $requiredFields = ['c_experiment_name', 'c_config_id', 'c_start', 'c_end'];
        foreach ($requiredFields as $field) {
            if (empty($data[$field])) {
                return [
                    'code' => 422,
                    'message' => "Missing required field: {$field}",
                ];
            }
        }

        // 2. 新增：校验时间格式和时长逻辑（与创建逻辑一致）
        $startTime = strtotime($data['c_start']);
        $endTime = strtotime($data['c_end']);
        if (!$startTime || !$endTime) {
            return [
                'code' => 422,
                'message' => 'Invalid time format: c_start/c_end must be Y-m-d H:i:s',
            ];
        }
        if ($startTime <= time()) {
            return [
                'code' => 422,
                'message' => 'c_start must be after current time',
            ];
        }
        if ($endTime <= $startTime) {
            return [
                'code' => 422,
                'message' => 'c_end must be after c_start',
            ];
        }

        // 原有逻辑：校验课程是否存在
        if (!DB::table('c_courses')->where('c_course_id', $courseId)->exists()) {
            return [
                'code' => 422,
                'message' => 'Invalid course_id: Course does not exist.',
            ];
        }

        // 原有逻辑：校验实验是否存在（归属当前课程）
        if (!DB::table('c_course_experiments')->where('c_experiment_id', $experimentId)->where('c_course_id', $courseId)->exists()) {
            return [
                'code' => 422,
                'message' => 'Invalid experiment_id: Experiment does not exist.',
            ];
        }

        // 原有逻辑：校验场景配置是否存在
        if (!DB::table('c_scene_configs')->where('c_config_id', $data['c_config_id'])->exists()) {
            return [
                'code' => 422,
                'message' => 'Invalid c_config_id: Scene config does not exist.',
            ];
        }

        // 3. 核心修改：UPDATE 语句添加 c_start、c_end 字段和参数
        DB::beginTransaction();
        $result = DB::update(
            'UPDATE c_course_experiments SET 
                c_experiment_name = ?, 
                c_description = ?, 
                c_config_id = ?, 
                c_start = ?,  -- 新增：更新开始时间
                c_end = ?,    -- 新增：更新结束时间
                updated_at = NOW() 
             WHERE c_experiment_id = ? AND c_course_id = ?',
            [
                $data['c_experiment_name'], // 1. c_experiment_name
                $data['c_description'] ?? null, // 2. c_description
                $data['c_config_id'], // 3. c_config_id
                $data['c_start'],     // 4. 新增：c_start
                $data['c_end'],       // 5. 新增：c_end
                $experimentId,        // 6. c_experiment_id（条件）
                $courseId             // 7. c_course_id（条件）
            ]
        );

        // 注意：result 为受影响行数，若数据未变化（如更新值与原值一致），result=0，需特殊处理
        if ($result === false) {
            DB::rollBack();
            return [
                'code' => 500,
                'message' => 'Failed to update experiment.',
            ];
        }

        DB::commit();
        // 区分"更新成功"和"无数据变化"的提示（更友好）
        $message = $result > 0 ? 'Experiment updated successfully.' : 'No changes to experiment data.';
        return [
            'code' => 200,
            'message' => $message,
            'data' => ['c_experiment_id' => $experimentId],
        ];
    } catch (\Exception $e) {
        DB::rollBack();
        Log::error('[GENERAL] updateExperiment: ' . $e->getMessage(), [
            'trace' => $e->getTraceAsString(),
        ]);
        return [
            'code' => 500,
            'message' => 'Unexpected error occurred: ' . $e->getMessage(),
        ];
    }
}
}
