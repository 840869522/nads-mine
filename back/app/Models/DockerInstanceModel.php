<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB as db;
use Illuminate\Support\Facades\Log;
use App\Utils\GlobalResponse;

class DockerInstanceModel extends Model{
    protected $table = 'c_DOCKER_INSTANCE';
    public $timestamps = false;

    public static function insertInstance(array $data) : array {
        $sql = "INSERT INTO `c_DOCKER_INSTANCE`(instance_id,user_id,name,image,cmd,env,ports,create_at,update_at) VALUES(?,?,?,?,?,?,?,NOW(),NOW())";
        try {
            db::beginTransaction();
            $res = db::insert($sql,[
                $data['instance_id'],
                $data['user_id'],
                $data['name'] ?? null,
                $data['image'],
                $data['cmd'] ?? null,
                $data['env'] ?? null,
                $data['ports'] ?? null
            ]);
            if($res){
                db::commit();
                return ['code'=>GlobalResponse::$DATABASE_SUCCESS_CODE];
            }
            db::rollBack();
            return ['code'=>GlobalResponse::$DATABASE_ERROR_CODE];
        }catch(QueryException $e){
            Log::info('[DATABASE]: HAAPENDE ERROR : '.$e->getMessage());
            db::rollBack();
            return ['code'=>GlobalResponse::$DATABASE_ERROR_CODE];
        }
    }
}
?>
