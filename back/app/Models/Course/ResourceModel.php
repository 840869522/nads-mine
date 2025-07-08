<?php

namespace App\Models\Course;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Database\QueryException;
use App\Utils\GlobalResponse;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Storage;

class ResourceModel extends Model
{
    protected $table = 'c_course_resources';
    protected $primaryKey = 'c_resource_id';
    protected $keyType = 'string';
    public $incrementing = false;

    /**
     * Get resources by course ID.
     *
     * @param string $courseId
     * @return array
     */
    public static function getResourcesByCourseId(string $courseId): array
    {
        try {
            $resources = DB::table('c_course_resources')->where('c_course_id', $courseId)->get()->toArray();
            return [
                'code' => GlobalResponse::$DATABASE_SUCCESS_CODE,
                'data' => $resources,
            ];
        } catch (QueryException $e) {
            Log::error('[DATABASE] getResourcesByCourseId: ' . $e->getMessage());
            return [
                'code' => GlobalResponse::$DATABASE_ERROR_CODE,
                'message' => 'Failed to retrieve resources.',
            ];
        }
    }

    /**
     * Insert a new resource.
     *
     * @param array $data
     * @return array
     */
    public static function insertResource(array $data): array
    {
        try {
            if (empty($data['course_id']) || empty($data['name']) || empty($data['path']) || empty($data['type'])) {
                return [
                    'code' => GlobalResponse::$DATABASE_ERROR_CODE,
                    'message' => 'Missing required fields: course_id, name, path, or type.',
                ];
            }

            if (!DB::table('c_courses')->where('c_course_id', $data['course_id'])->exists()) {
                return [
                    'code' => GlobalResponse::$DATABASE_ERROR_CODE,
                    'message' => 'Invalid course_id: Course does not exist.',
                ];
            }

            // Check for duplicate resource name within the course
            if (DB::table('c_course_resources')->where('c_course_id', $data['course_id'])->where('c_resource_name', $data['name'])->exists()) {
                return [
                    'code' => GlobalResponse::$DATABASE_ERROR_CODE,
                    'message' => 'Resource name already exists for this course.',
                    'errors' => ['name' => ['The resource name has already been taken.']],
                ];
            }

            // Validate file path exists
            if (!Storage::disk('public')->exists($data['path'])) {
                return [
                    'code' => GlobalResponse::$DATABASE_ERROR_CODE,
                    'message' => 'Invalid resource path: File does not exist.',
                ];
            }

            $resourceId = (string) Str::uuid();
            $result = DB::insert(
                "INSERT INTO c_course_resources (c_resource_id, c_course_id, c_resource_name, c_resource_path, c_type, c_size, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())",
                [$resourceId, $data['course_id'], $data['name'], $data['path'], $data['type'], $data['size'] ?? 0]
            );

            return [
                'code' => $result ? GlobalResponse::$DATABASE_SUCCESS_CODE : GlobalResponse::$DATABASE_ERROR_CODE,
                'data' => [
                    'c_resource_id' => $resourceId,
                    'c_resource_name' => $data['name'],
                    'c_resource_path' => $data['path'],
                    'c_type' => $data['type'],
                    'c_size' => $data['size'] ?? 0,
                ],
                'message' => $result ? 'Resource created successfully.' : 'Failed to create resource.',
            ];
        } catch (QueryException $e) {
            Log::error('[DATABASE] insertResource: ' . $e->getMessage());
            return [
                'code' => GlobalResponse::$DATABASE_ERROR_CODE,
                'message' => 'Failed to insert resource: ' . ($e->getCode() == 23000 ? 'Invalid course_id.' : $e->getMessage()),
            ];
        }
    }

    /**
     * Delete a resource by ID.
     *
     * @param string $id
     * @return array
     */
    public static function deleteResource(string $id): array
    {
        try {
            $result = DB::delete("DELETE FROM c_course_resources WHERE c_resource_id = ?", [$id]);
            return [
                'code' => $result ? GlobalResponse::$DATABASE_SUCCESS_CODE : GlobalResponse::$DATABASE_ERROR_CODE,
                'message' => $result ? 'Resource deleted successfully.' : 'Resource not found.',
            ];
        } catch (QueryException $e) {
            Log::error('[DATABASE] deleteResource: ' . $e->getMessage());
            return [
                'code' => GlobalResponse::$DATABASE_ERROR_CODE,
                'message' => 'Failed to delete resource.',
            ];
        }
    }
}