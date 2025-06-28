namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\CourseCategory;

class CategoryController extends Controller
{
    public function index()
    {
        return response()->json(CourseCategory::all());
    }

    public function store(Request $request)
    {
        $request->validate(['category_name' => 'required|unique:c_COURSE_CATEGORIES,category_name']);
        $category = CourseCategory::create(['category_name' => $request->category_name]);
        return response()->json($category);
    }
}
