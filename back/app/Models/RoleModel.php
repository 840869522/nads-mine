<?php

    namespace App\Models;

    use Illuminate\Database\Eloquent\Model;
    use Illuminate\Support\Facades\DB as db;
    use Illuminate\Database\QueryException;

    use App\Utils\GlobalResponse;

    class RoleModel extends Model {
        protected $table = "role";

        public static function getAllRole() :?array {
            try {
                $sql = "SELECT * FROM `roles`";
                $res = db::select($sql);
                return [
                    "code"=>GlobalResponse::$DATABASE_SUCCESS_CODE,
                    "data"=>$res
                ];
            }catch (QueryException $e) {
                return [
                    "code"=>GlobalResponse::$DATABASE_ERROR_CODE,
                    "data"=>$e->getMessage()
                ];
            }
        }


        public static function getRoleById(?string $id) :?array {
            try {
                $sql = "SELECT * FROM  `role` WHERE `id` = ?";
                $res = db::selectOne($sql,[$id]);
                return [
                    "code"=>GlobalResponse::$DATABASE_SUCCESS_CODE,
                    "data"=>$res
                ];
            }catch (QueryException $e) {
                return [
                    "code" => GlobalResponse::$DATABASE_ERROR_CODE,
                    "data" => $e->getMessage()
                ];
            }
        }
    }

?>