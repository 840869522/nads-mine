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
            if (empty($data['c_course_id']) || empty($data['c_experiment_id']) || empty($data['c_resource_name']) || empty($data['c_resource_path']) || empty($data['c_type'])) {
                return [
                    'code' => 422,
                    'message' => 'Missing required fields: course_id, experiment_id, resource_name, resource_path, or type.',
                ];
            }

            if (!DB::table('c_courses')->where('c_course_id', $data['c_course_id'])->exists()) {
                return [
                    'code' => 422,
                    'message' => 'Invalid course_id: Course does not exist.',
                ];
            }

            if (!DB::table('c_course_experiments')->where('c_experiment_id', $data['c_experiment_id'])->where('c_course_id', $data['c_course_id'])->exists()) {
                return [
                    'code' => 422,
                    'message' => 'Invalid experiment_id: Experiment does not exist.',
                ];
            }

            if (DB::table('c_experiment_resources')->where('c_experiment_id', $data['c_experiment_id'])->where('c_resource_name', $data['c_resource_name'])->exists()) {
                return [
                    'code' => 422,
                    'message' => 'Resource name already exists for this experiment.',
                ];
            }

            if (!Storage::disk('public')->exists($data['c_resource_path'])) {
                return [
                    'code' => 422,
                    'message' => 'Invalid resource path: File does not exist.',
                ];
            }

            DB::beginTransaction();
            $resourceId = (string) Str::uuid();
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
