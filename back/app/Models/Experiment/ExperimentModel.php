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

        // 2. 新增：校验时间格式和时长逻辑（与控制器校验一致，双重保障）
        $startTime = strtotime($data['c_start']);
        $endTime = strtotime($data['c_end']);
        // 校验时间格式（strtotime返回false表示格式无效）
        if (!$startTime || !$endTime) {
            return [
                'code' => 422,
                'message' => 'Invalid time format: c_start/c_end must be Y-m-d H:i:s',
            ];
        }
        // 校验开始时间晚于当前、结束时间晚于开始时间
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
        $course = DB::table('c_courses')->where('c_course_id', $courseId)->first();
        if (!$course) {
            return [
                'code' => 422,
                'message' => 'Invalid course_id: Course does not exist.',
            ];
        }

        // 原有逻辑：校验场景配置是否存在
        if (!DB::table('c_scene_configs')->where('c_config_id', $data['c_config_id'])->exists()) {
            return [
                'code' => 422,
                'message' => 'Invalid c_config_id: Scene config does not exist.',
            ];
        }

        // 原有逻辑：生成实验ID（类别ID+课程ID+递增序号）
        $categoryId = $course->c_category_id;
        $existingExperiments = DB::table('c_course_experiments')
            ->where('c_course_id', $courseId)
            ->count();
        $experimentNumber = $existingExperiments + 1;
        $experimentId = sprintf('%s%s%02d', $categoryId, $courseId, $experimentNumber); // 示例：0100101

        // 原有逻辑：确保实验ID唯一
        if (DB::table('c_course_experiments')->where('c_experiment_id', $experimentId)->exists()) {
            return [
                'code' => 422,
                'message' => 'Experiment ID already exists.',
            ];
        }

        // 原有逻辑：创建实验文件夹
        $experimentFolder = "courses/{$categoryId}/{$courseId}/Experiment/{$experimentId}";
        if (!Storage::disk('local_resources')->exists($experimentFolder)) {
            if (!Storage::disk('local_resources')->makeDirectory($experimentFolder, 0755, true)) {
                return [
                    'code' => 500,
                    'message' => 'Failed to create experiment folder.',
                ];
            }
        }
        Log::info('Creating experiment folder', [
            'experimentFolder' => $experimentFolder,
            'fullPath' => Storage::disk('local_resources')->path($experimentFolder),
        ]);

        // 3. 核心修改：INSERT 语句添加 c_start、c_end字段和参数
        DB::beginTransaction();
        $result = DB::insert(
            'INSERT INTO c_course_experiments (
                c_experiment_id, c_course_id, c_experiment_name, c_description, 
                c_config_id, c_start, c_end, created_at, updated_at
             ) VALUES (?, ?, ?, ?, ?, ?, ?,  NOW(), NOW())',
            [
                $experimentId,        // 1. c_experiment_id
                $courseId,            // 2. c_course_id
                $data['c_experiment_name'], // 3. c_experiment_name
                $data['c_description'] ?? null, // 4. c_description
                $data['c_config_id'], // 5. c_config_id
                $data['c_start'],     // 6. 新增：c_start
                $data['c_end'],       // 7. 新增：c_end
            ]
        );

        if (!$result) {
            DB::rollBack();
            return [
                'code' => 500,
                'message' => 'Failed to create experiment.',
            ];
        }

        DB::commit();
        return [
            'code' => 201,
            'message' => 'Experiment created successfully.',
            'data' => ['c_experiment_id' => $experimentId],
        ];
    } catch (\Exception $e) {
        DB::rollBack();
        Log::error('[GENERAL] createExperiment: ' . $e->getMessage(), [
            'trace' => $e->getTraceAsString(),
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
