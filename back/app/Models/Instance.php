<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Instance extends Model
{
    use HasFactory;

    public $incrementing = false;
    protected $keyType = 'string';
    protected $fillable = [
        'id','name','type','status','ip_address','image_name','cpu_usage','memory_usage','disk_usage','uptime','node_id','created_at'
    ];
    public $timestamps = false;
    protected $table = 'instances';
}
