namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CourseCategory extends Model
{
    protected $table = 'c_COURSE_CATEGORIES';
    protected $primaryKey = 'categoty_id';
    protected $fillable = ['category_name'];

    public $timestamps = false;

    public function courses()
    {
        return $this->hasMany(Course::class, 'category_id','category_id');
    }
}
