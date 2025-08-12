<?php

namespace App\Models\ad;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB as db;
use Illuminate\Support\Facades\Log;
use App\Utils\GlobalResponse;
use Illuminate\Support\Str;

class SceneInstances extends Model
{
    protected $table = 'c_scene_instances';
    public $timestamps = false;
    protected $primaryKey = 'c_scene_instances_id';
    protected $casts = [
        'c_scene_instances_id' => 'string', // 指定ID为主键（如果是UUID）
    ];
    public $pageSize = 20;

    public function get_c_scene_instances_id($config_id)
    {

        $mod = new SceneInstances();
        $res = $mod->where('c_config_id',$config_id)->first();
        if(empty($res)){
            return false;
        }
        return $res->c_scene_instances_id;
    }

}

