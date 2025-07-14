<?php
namespace App\Http\Controllers\Experiment;

use App\Http\Controllers\Controller;
use App\Models\Experiment\ExperimentResourceModel;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;

class ExperimentResourceController extends Controller
{
    public function index($courseId, $experimentId)
    {
        try {
            if (!DB::table('c_courses')->where('c_course_id', $courseId)->exists()) {
                return response()->json([
                    'code' => 404,
                    'message' => 'Course not found.',
                ], 404);
            }

            if (!DB::table('c_course_experiments')->where('c_experiment_id', $experimentId)->where('c_course_id', $courseId)->exists()) {
                return response()->json([
                    'code' => 404,
                    'message' => 'Experiment not found.',
                ], 404);
            }

            $resources = DB::table('c_experiment_resources')
                ->where('c_experiment_id', $experimentId)
                ->select(
                    'c_resource_id',
                    'c_resource_name',
                    'c_resource_path',
                    'c_type',
                    'c_size'
                )
                ->get();

            return response()->json([
                'code' => 200,
                'message' => 'Resources retrieved successfully.',
                'data' => ['resources' => $resources],
            ], 200);
        } catch (\Exception $e) {
            Log::error('[GENERAL] getExperimentResources: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
            ]);
            return response()->json([
                'code' => 500,
                'message' => 'Unexpected error occurred: ' . $e->getMessage(),
            ], 500);
        }
    }

    public function upload(Request $request, $courseId, $experimentId)
    {
        $validator = Validator::make($request->all(), [
            'c_course_id' => 'required|string|exists:c_courses,c_course_id',
            'c_experiment_id' => 'required|string|exists:c_course_experiments,c_experiment_id',
            'file' => 'required|file|mimes:pdf,jpg,jpeg,png,doc,docx,mp4,avi|max:10240',
        ]);
        if ($validator->fails()) {
            return response()->json([
                'code' => 422,
                'message' => $validator->errors()->first(),
                'errors' => $validator->errors()->all(),
            ], 422);
        }

        try {
            $file = $request->file('file');
            $course = DB::table('c_courses')->where('c_course_id', $courseId)->first();
            $experiment = DB::table('c_course_experiments')->where('c_experiment_id', $experimentId)->where('c_course_id', $courseId)->first();
            if (!$course || !$experiment) {
                return response()->json([
                    'code' => 404,
                    'message' => 'Course or experiment not found.',
                ], 404);
            }

            $data = [
                'c_course_id' => $courseId,
                'c_experiment_id' => $experimentId,
                'c_resource_name' => $file->getClientOriginalName(),
                'c_resource_path' => Storage::disk('public')->putFile("web/{$course->c_category_id}/{$courseId}/experiments/{$experimentId}", $file),
                'c_type' => $file->getMimeType(),
                'c_size' => $file->getSize(),
            ];
            $modelRes = ExperimentResourceModel::store($data);
            if ($modelRes['code'] != 201) {
                return response()->json($modelRes, 500);
            }

            return response()->json([
                'code' => 201,
                'message' => 'Experiment resource uploaded successfully.',
                'data' => $modelRes['data'],
            ], 201);
        } catch (\Exception $e) {
            Log::error('[GENERAL] uploadExperimentResource: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
            ]);
            return response()->json([
                'code' => 500,
                'message' => 'Unexpected error occurred: ' . $e->getMessage(),
            ], 500);
        }
    }

    public function destroy($courseId, $experimentId, $resourceId)
    {
        try {
            if (!DB::table('c_courses')->where('c_course_id', $courseId)->exists()) {
                return response()->json([
                    'code' => 404,
                    'message' => 'Course not found.',
                ], 404);
            }

            if (!DB::table('c_course_experiments')->where('c_experiment_id', $experimentId)->where('c_course_id', $courseId)->exists()) {
                return response()->json([
                    'code' => 404,
                    'message' => 'Experiment not found.',
                ], 404);
            }

            $resource = DB::table('c_experiment_resources')
                ->where('c_resource_id', $resourceId)
                ->where('c_experiment_id', $experimentId)
                ->first();

            if (!$resource) {
                return response()->json([
                    'code' => 404,
                    'message' => 'Resource not found.',
                ], 404);
            }

            DB::beginTransaction();
            if (Storage::disk('public')->exists($resource->c_resource_path)) {
                Storage::disk('public')->delete($resource->c_resource_path);
            }

            $result = DB::table('c_experiment_resources')
                ->where('c_resource_id', $resourceId)
                ->where('c_experiment_id', $experimentId)
                ->delete();

            if (!$result) {
                DB::rollBack();
                return response()->json([
                    'code' => 500,
                    'message' => 'Failed to delete resource.',
                ], 500);
            }

            DB::commit();
            return response()->json([
                'code' => 200,
                'message' => 'Resource deleted successfully.',
            ], 200);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('[GENERAL] deleteExperimentResource: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
            ]);
            return response()->json([
                'code' => 500,
                'message' => 'Unexpected error occurred: ' . $e->getMessage(),
            ], 500);
        }
    }
}
