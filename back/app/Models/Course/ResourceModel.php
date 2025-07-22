<?php
namespace App\Models\Course;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Database\QueryException;
use App\Utils\GlobalResponse;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Storage;

class ResourceModel
{
    protected $table = 'c_course_resources';
    protected $primaryKey = 'c_resource_id';
    protected $keyType = 'string';
    public $incrementing = false;

    public static function getResourcesByCourseId(string $courseId, int $page = 1, int $pageSize = 10): array
    {
        try {
            DB::connection()->getPdo();
            $courseExists = DB::table('c_courses')->where('c_course_id', $courseId)->exists();
            Log::info('Checking course existence', [
                'courseId' => $courseId,
                'exists' => $courseExists,
                'rawQuery' => DB::table('c_courses')->where('c_course_id', $courseId)->toSql(),
                'bindings' => [$courseId]
            ]);
            if (!$courseExists) {
                return [
                    'code' => 422,
                    'message' => "Invalid course_id: Course does not exist (course_id: {$courseId}).",
                ];
            }

            $offset = ($page - 1) * $pageSize;
            $query = DB::table('c_course_resources')->where('c_course_id', $courseId);
            $countQuery = DB::table('c_course_resources')->where('c_course_id', $courseId);
            $resources = $query->limit($pageSize)->offset($offset)->get()->toArray();
            $total = $countQuery->count();

            Log::info('getResourcesByCourseId', [
                'courseId' => $courseId,
                'page' => $page,
                'pageSize' => $pageSize,
                'resources' => $resources,
                'total' => $total
            ]);

            $resources = array_map(function ($resource) {
                $resource->c_resource_name = mb_convert_encoding($resource->c_resource_name, 'UTF-8', 'UTF-8');
                $resource->c_resource_path = mb_convert_encoding($resource->c_resource_path, 'UTF-8', 'UTF-8');
                $resource->c_type = mb_convert_encoding($resource->c_type, 'UTF-8', 'UTF-8');
                return $resource;
            }, $resources);

            return [
                'code' => 200,
                'message' => 'Resources retrieved successfully.',
                'data' => [
                    'resources' => $resources,
                    'total' => $total,
                    'page' => $page,
                    'pageSize' => $pageSize,
                ],
            ];
        } catch (QueryException $e) {
            Log::error('[DATABASE] getResourcesByCourseId: ' . $e->getMessage(), [
                'courseId' => $courseId,
                'trace' => $e->getTraceAsString(),
            ]);
            return [
                'code' => 500,
                'message' => 'Failed to retrieve resources: ' . $e->getMessage(),
                'error_details' => [
                    'sql_error' => $e->getMessage(),
                    'sql_code' => $e->getCode(),
                ],
            ];
        }
    }

    public static function store(array $data): array
    {
        try {
            if (empty($data['c_course_id']) || empty($data['c_resource_name']) || empty($data['c_resource_path']) || empty($data['c_type'])) {
                return [
                    'code' => 422,
                    'message' => 'Missing required fields: c_course_id, c_resource_name, c_resource_path, or c_type.',
                ];
            }

            if (!DB::table('c_courses')->where('c_course_id', $data['c_course_id'])->exists()) {
                return [
                    'code' => 422,
                    'message' => 'Invalid course_id: Course does not exist.',
                ];
            }

            if (DB::table('c_course_resources')->where('c_course_id', $data['c_course_id'])->where('c_resource_name', $data['c_resource_name'])->exists()) {
                return [
                    'code' => 422,
                    'message' => 'Resource name already exists for this course.',
                    'errors' => ['name' => ['The resource name has already been taken.']],
                ];
            }

            if (!Storage::disk('local_resources')->exists($data['c_resource_path'])) {
                return [
                    'code' => 422,
                    'message' => 'Invalid resource path: File does not exist.',
                ];
            }

            DB::beginTransaction();
            $resourceId = (string) Str::uuid();
            $result = DB::insert(
                "INSERT INTO c_course_resources (c_resource_id, c_course_id, c_resource_name, c_resource_path, c_type, c_size, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())",
                [
                    $resourceId,
                    $data['c_course_id'],
                    mb_convert_encoding($data['c_resource_name'], 'UTF-8', 'UTF-8'),
                    mb_convert_encoding($data['c_resource_path'], 'UTF-8', 'UTF-8'),
                    mb_convert_encoding($data['c_type'], 'UTF-8', 'UTF-8'),
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
        } catch (QueryException $e) {
            DB::rollBack();
            Log::error('[DATABASE] store: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
            ]);
            return [
                'code' => 500,
                'message' => 'Failed to store resource: ' . ($e->getCode() == 23000 ? 'Invalid c_course_id.' : $e->getMessage()),
            ];
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('[GENERAL] store: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
            ]);
            return [
                'code' => 500,
                'message' => 'Unexpected error occurred: ' . $e->getMessage(),
            ];
        }
    }

    public static function deleteResource(string $id): array
    {
        try {
            if (!Str::isUuid($id)) {
                return [
                    'code' => 422,
                    'message' => 'Invalid resource_id: Must be a valid UUID.',
                ];
            }

            $resource = DB::table('c_course_resources')->where('c_resource_id', $id)->first();
            if (!$resource) {
                return [
                    'code' => 404,
                    'message' => 'Resource not found.',
                ];
            }

            DB::beginTransaction();
            $result = DB::delete("DELETE FROM c_course_resources WHERE c_resource_id = ?", [$id]);
            if (!$result) {
                DB::rollBack();
                return [
                    'code' => 404,
                    'message' => 'Resource not found.',
                ];
            }

            DB::commit();
            if (Storage::disk('local_resources')->exists($resource->c_resource_path)) {
                Storage::disk('local_resources')->delete($resource->c_resource_path);
            }

            return [
                'code' => 200,
                'message' => 'Resource deleted successfully.',
            ];
        } catch (QueryException $e) {
            DB::rollBack();
            Log::error('[DATABASE] deleteResource: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
            ]);
            return [
                'code' => 500,
                'message' => 'Failed to delete resource: ' . $e->getMessage(),
            ];
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('[GENERAL] deleteResource: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
            ]);
            return [
                'code' => 500,
                'message' => 'Unexpected error occurred: ' . $e->getMessage(),
            ];
        }
    }

    public static function getResourceById(string $id): array
    {
        try {
            if (!Str::isUuid($id)) {
                return [
                    'code' => 422,
                    'message' => 'Invalid resource_id: Must be a valid UUID.',
                ];
            }

            $resource = DB::table('c_course_resources')->where('c_resource_id', $id)->first();
            if (!$resource) {
                return [
                    'code' => 404,
                    'message' => 'Resource not found.',
                ];
            }

            // 添加日志以便调试
            Log::info('getResourceById', [
                'c_resource_id' => $id,
                'resource' => [
                    'c_resource_id' => $resource->c_resource_id,
                    'c_resource_name' => $resource->c_resource_name,
                    'c_resource_path' => $resource->c_resource_path,
                    'c_type' => $resource->c_type,
                    'c_size' => $resource->c_size,
                ],
            ]);

            return [
                'code' => 200,
                'message' => 'Resource retrieved successfully.',
                'data' => [
                    'c_resource_id' => $resource->c_resource_id,
                    'c_resource_name' => mb_convert_encoding($resource->c_resource_name, 'UTF-8', 'UTF-8'),
                    'c_resource_path' => mb_convert_encoding($resource->c_resource_path, 'UTF-8', 'UTF-8'),
                    'c_type' => mb_convert_encoding($resource->c_type, 'UTF-8', 'UTF-8'),
                    'c_size' => $resource->c_size,
                ],
            ];
        } catch (QueryException $e) {
            Log::error('[DATABASE] getResourceById: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
            ]);
            return [
                'code' => 500,
                'message' => 'Failed to retrieve resource: ' . $e->getMessage(),
            ];
        } catch (\Exception $e) {
            Log::error('[GENERAL] getResourceById: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
            ]);
            return [
                'code' => 500,
                'message' => 'Unexpected error occurred: ' . $e->getMessage(),
            ];
        }
    }
}
