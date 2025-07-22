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
            if (empty($data['c_experiment_name']) || empty($data['c_config_id'])) {
                return [
                    'code' => 422,
                    'message' => 'Missing required fields: c_experiment_name or c_config_id.',
                ];
            }

            $course = DB::table('c_courses')->where('c_course_id', $courseId)->first();
            if (!$course) {
                return [
                    'code' => 422,
                    'message' => 'Invalid course_id: Course does not exist.',
                ];
            }

            if (!DB::table('c_scene_configs')->where('c_config_id', $data['c_config_id'])->exists()) {
                return [
                    'code' => 422,
                    'message' => 'Invalid c_config_id: Scene config does not exist.',
                ];
            }

            // 生成实验 ID：类别ID + 课程ID + 递增序号
            $categoryId = $course->c_category_id;
            $existingExperiments = DB::table('c_course_experiments')
                ->where('c_course_id', $courseId)
                ->count();
            $experimentNumber = $existingExperiments + 1; // 下一个序号
            $experimentId = sprintf('%s%s%02d', $categoryId, $courseId, $experimentNumber); // 例如：0100101

            // 确保实验 ID 唯一
            if (DB::table('c_course_experiments')->where('c_experiment_id', $experimentId)->exists()) {
                return [
                    'code' => 422,
                    'message' => 'Experiment ID already exists.',
                ];
            }

            // 创建实验文件夹，使用 local_resources 磁盘
            $experimentFolder = "courses/{$categoryId}/{$courseId}/Experiment/{$experimentId}";
            if (!Storage::disk('local_resources')->exists($experimentFolder)) {
                if (!Storage::disk('local_resources')->makeDirectory($experimentFolder, 0755, true)) {
                    return [
                        'code' => 500,
                        'message' => 'Failed to create experiment folder.',
                    ];
                }
            }

            // 记录文件夹路径以便调试
            Log::info('Creating experiment folder', [
                'experimentFolder' => $experimentFolder,
                'fullPath' => Storage::disk('local_resources')->path($experimentFolder),
            ]);

            DB::beginTransaction();
            $result = DB::insert(
                'INSERT INTO c_course_experiments (c_experiment_id, c_course_id, c_experiment_name, c_description, c_config_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NOW(), NOW())',
                [$experimentId, $courseId, $data['c_experiment_name'], $data['c_description'] ?? null, $data['c_config_id']]
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
            if (empty($data['c_experiment_name']) || empty($data['c_config_id'])) {
                return [
                    'code' => 422,
                    'message' => 'Missing required fields: c_experiment_name or c_config_id.',
                ];
            }

            if (!DB::table('c_courses')->where('c_course_id', $courseId)->exists()) {
                return [
                    'code' => 422,
                    'message' => 'Invalid course_id: Course does not exist.',
                ];
            }

            if (!DB::table('c_course_experiments')->where('c_experiment_id', $experimentId)->where('c_course_id', $courseId)->exists()) {
                return [
                    'code' => 422,
                    'message' => 'Invalid experiment_id: Experiment does not exist.',
                ];
            }

            if (!DB::table('c_scene_configs')->where('c_config_id', $data['c_config_id'])->exists()) {
                return [
                    'code' => 422,
                    'message' => 'Invalid c_config_id: Scene config does not exist.',
                ];
            }

            DB::beginTransaction();
            $result = DB::update(
                'UPDATE c_course_experiments SET c_experiment_name = ?, c_description = ?, c_config_id = ?, updated_at = NOW() WHERE c_experiment_id = ? AND c_course_id = ?',
                [$data['c_experiment_name'], $data['c_description'] ?? null, $data['c_config_id'], $experimentId, $courseId]
            );

            if (!$result) {
                DB::rollBack();
                return [
                    'code' => 500,
                    'message' => 'Failed to update experiment.',
                ];
            }

            DB::commit();
            return [
                'code' => 200,
                'message' => 'Experiment updated successfully.',
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
