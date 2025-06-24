<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Image extends Model
{
    use HasFactory;

    public $incrementing = false;
    protected $keyType = 'string';
    protected $fillable = [
        'id', 'name', 'type', 'version', 'description', 'file_name', 'size', 'upload_date'
    ];
    public $timestamps = false;
    protected $table = 'images';
}
