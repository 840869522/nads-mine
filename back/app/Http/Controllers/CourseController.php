namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Course;
use App\Models\CourseResource;
use Illuminate\Support\Facades\Storage;

class CourseController extends Controller
{
    public function index(Request $request)
    {
        $query = Course::with(['category', 'resources']);

        if ($request->has('category')) {
            $query->whereHas('category', function ($q) use ($request) {
                $q->where('category_name', $request->category);
            });
        }

        if ($request->has('keyword')) {
            $query->where('course_name', 'like', '%' . $request->keyword . '%');
        }

        return response()->json($query->paginate(10));
    }

    public functon update(Request $request,$id)
    {
        $course = Course::findOrFail($id);

        $requst->validate([
            'course_name' => 'required|string',
            'category_id' => 'required|exists:c_COURSE_CATEGORIES,category_id',
            'description' => 'nullable|string',
            'files.*' => 'file',    
        ]);

        $course->update([
           'course_name' => $requset->course_name,
           'description' => $requst->description,
           'category_id' => $request->category_id, 
        ]);

        $course->resources()->delete();

        if($request->hasFile('files')){
            foreach($request->file('files') as $file){
                $path = $fle->store('uploads','public');
                CourseResource::creat([
                    'course_id' => $course->course_id,
                    'resource_name' => $file->getClientOriginalName(),
                    'resource_path' => $path,
                    'type' => $file->getClientMimeType(),
                    'size' => $file->getSize(),    
                ]);
            }
        }
        return response()->json($course->load('resources'));
    }

    public function destory($id)
    {
        $course = Course::findOrFail($id);
        $course->resources()->delete();
        $course->delete();
        return response()->json(['message' => '删除成功'])；
    }
    public function store(Request $request)
    {
        $request->validate([
            'course_name' => 'required|string',
            'category_id' => 'required|exists:c_COURSE_CATEGORIES,category_id',
            'description' => 'nullable|string',
            'files.*' => 'file',
        ]);

        $course = Course::create([
            'course_name' => $request->course_name,
            'description' => $request->description,
            'category_id' => $request->category_id,
            'user_id' => auth()->id() ?? 1, // 临时默认用户ID
        ]);

        if ($request->hasFile('files')) {
            foreach ($request->file('files') as $file) {
                $path = $file->store('uploads', 'public');
                CourseResource::create([
                    'course_id' => $course->course_id,
                    'resource_name' => $file->getClientOriginalName(),
                    'resource_path' => $path,
                    'type' => $file->getClientMimeType(),
                    'size' => $file->getSize(),
                ]);
            }
        }

        return response()->json($course->load('resources'));
    }
    
}
