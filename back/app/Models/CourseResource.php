<?php 
    namespace App\Models;

    use Illuminate\Database\Eloquent\Model;

    class CourseResource extends Model
    {
        protected $table = 'c_COURSE_RESOURCES';
        protected $fillable = ['course_id', 'resource_name', 'resource_path', 'type', 'size'];

        public function course()
        {
            return $this->belongsTo(Course::class, 'course_id','course_id');
        }
    }
?>