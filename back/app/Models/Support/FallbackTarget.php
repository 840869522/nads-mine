<?php

namespace App\Models\Support;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class FallbackTarget extends Model
{
    use HasFactory;

    protected $table = 'c_servers';

    protected $fillable = [
        'name',
        'host',
        'port',
    ];
}
