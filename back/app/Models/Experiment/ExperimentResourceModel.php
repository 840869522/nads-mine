<?php
namespace App\Models\Experiment;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class ExperimentResourceModel
{
    public static function store(array $data): array
    {
        try {
            // 验证必要字段
            if (empty($data['c_course_id']) || empty($data['c_experiment_id']) || empty($data['c_resource_name']) || empty($data['c_resource_path']) || empty($data['c_type'])) {
                return [
                    'code' => 422,
                    'message' => 'Missing required fields: course_id, experiment_id, resource_name, resource_path, or type.',
                ];
            }

            // 验证课程是否存在
            if (!DB::table('c_courses')->where('c_course_id', $data['c_course_id'])->exists()) {
                return [
                    'code' => 422,
                    'message' => 'Invalid course_id: Course does not exist.',
                ];
            }

            // 验证实验是否存在
            if (!DB::table('c_course_experiments')->where('c_experiment_id', $data['c_experiment_id'])->where('c_course_id', $data['c_course_id'])->exists()) {
                return [
                    'code' => 422,
                    'message' => 'Invalid experiment_id: Experiment does not exist.',
                ];
            }

            // 验证资源名称是否重复
            if (DB::table('c_experiment_resources')->where('c_experiment_id', $data['c_experiment_id'])->where('c_resource_name', $data['c_resource_name'])->exists()) {
                return [
                    'code' => 422,
                    'message' => 'Resource name already exists for this experiment.',
                ];
            }

            // 确保文件名和路径使用 UTF-8 编码
            $data['c_resource_name'] = mb_convert_encoding($data['c_resource_name'], 'UTF-8', 'UTF-8');
            $data['c_resource_path'] = mb_convert_encoding($data['c_resource_path'], 'UTF-8', 'UTF-8');
            $data['c_type'] = mb_convert_encoding($data['c_type'], 'UTF-8', 'UTF-8');

            // 验证 c_type 长度（不超过 10 字符）
            if (strlen($data['c_type']) > 10) {
                return [
                    'code' => 422,
                    'message' => 'File extension too long, must be 10 characters or less.',
                ];
            }
            // 验证 c_size
            if (!is_numeric($data['c_size']) || $data['c_size'] <= 0) {
                return [
                    'code' => 422,
                    'message' => 'Invalid file size, must be a positive number.',
                ];
            }
            // 验证资源路径
            Log::info('Checking resource path in store', [
                'resourcePath' => $data['c_resource_path'],
                'fullPath' => Storage::disk('local_resources')->path($data['c_resource_path']),
                'exists' => Storage::disk('local_resources')->exists($data['c_resource_path']),
            ]);

            // 生成资源 ID：实验ID + 资源序号
            $existingResources = DB::table('c_experiment_resources')
                ->where('c_experiment_id', $data['c_experiment_id'])
                ->count();
            $resourceNumber = $existingResources + 1;
            $resourceId = sprintf('%s%02d', $data['c_experiment_id'], $resourceNumber); // 例如：04040030101

            // 确保资源 ID 唯一
            if (DB::table('c_experiment_resources')->where('c_resource_id', $resourceId)->exists()) {
                return [
                    'code' => 422,
                    'message' => 'Resource ID already exists.',
                ];
            }

            DB::beginTransaction();
            $result = DB::insert(
                "INSERT INTO c_experiment_resources (c_resource_id, c_course_id, c_experiment_id, c_resource_name, c_resource_path, c_type, c_size, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())",
                [
                    $resourceId,
                    $data['c_course_id'],
                    $data['c_experiment_id'],
                    $data['c_resource_name'],
                    $data['c_resource_path'],
                    $data['c_type'],
                    $data['c_size'] ?? null,
                ]
            );

            if (!$result) {
                DB::rollBack();
                return [
                    'code' => 500,
                    'message' => 'Failed to create resource.',
                ];
            }

            DB::commit();
            return [
                'code' => 201,
                'message' => 'Resource created successfully.',
                'data' => [
                    'c_resource_id' => $resourceId,
                    'c_resource_name' => $data['c_resource_name'],
                    'c_resource_path' => $data['c_resource_path'],
                    'c_type' => $data['c_type'],
                    'c_size' => $data['c_size'] ?? null,
                ],
            ];
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('[GENERAL] storeExperimentResource: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
            ]);
            return [
                'code' => 500,
                'message' => 'Unexpected error occurred: ' . $e->getMessage(),
            ];
        }
    }
}
