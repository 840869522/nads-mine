<?php

    namespace App\Models;

    use Illuminate\Database\Eloquent\Model;
    use Illuminate\Support\Facades\DB;
    use Illuminate\Database\QueryException;

    use App\Utils\GlobalResponse;
    
    class Role extends Model {
        protected string $table = "";

        public static function getAllRole() :?array {
            try {
                $sql = "SELECT * FROM `role`";
                $res = DB::select($sql);
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


        public static function getRoleById() :?array {
            try {
                return [
                    
                ];
            }catch (QueryException $e) {
                return [

                ];
            }
        }
    }

?>