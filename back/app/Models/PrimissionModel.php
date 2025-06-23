<?php
    namespace App\Models;


    use App\Utils\GlobalResponse;
    
    use Illuminate\Support\Facades\DB as db;
    use Illuminate\Database\Eloquent\Model;
    use Illuminate\Database\QueryException;

    class PrimissionModel extends Model {

        protected $table = "permissions";


        public static function getAllPrimission():?array {
            try {
                $sql = "SELECT * FROM `permissions`";
                $res  = db::select($sql);
                return [
                    "code"=>GlobalResponse::$DATABASE_SUCCESS_CODE,
                    "data" => $res
                ];
            }catch (QueryException $e) {
                return [
                    "code"=>GlobalResponse::$DATABASE_ERROR_CODE,
                    "data"=>$e->getMessage()
                ];
            }
        }


        public static function getPrimissionById(?string $id) {
            try {
                $sql =  "SELECT * FROM `permissions` WHERE `id` = ?";
                $res = db::selectOne($sql,[$id]);
                return [
                    "code"=>GlobalResponse::$DATABASE_SUCCESS_CODE,
                    "data" => $res
                ];
            }catch (QueryException $e) {
                return [
                    "code"=> GlobalResponse::$DATABASE_ERROR_CODE,
                    "data" => $e->getMessage()
                ];
            }
        }

    }


?>