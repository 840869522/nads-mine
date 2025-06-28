<?php 
    namespace App\Models;

    use Illuminate\Database\Eloquent\Model;

    class Course extends Model
    {
        protected $table = 'c_COURSES';
        protected $primaryKey = 'course_id';
        protected $fillable = ['course_name', 'description', 'category_id', 'user_id'];

        public function category()
        {
            return $this->belongsTo(CourseCategory::class, 'category_id','category_id');
        }

        public function resources()
        {
            return $this->hasMany(CourseResource::class, 'course_id','course_id');
        }
    }
?>