<?php

    namespace App\Models;
    use Illuminate\Database\Eloquent\Model;
    use Illuminate\Database\QueryException;
    use Illuminate\Support\Facades\DB as db;
    use App\Utils\GlobalResponse;

    class UserModel extends Model{

        protected  $table = "platform_user";

        public static function getAllUser():array {
            try {
                $user = db::select('select * from user');
                return [
                    "data"=>$user,
                    "code"=>GlobalResponse::$DATABASE_SUCCESS_CODE
                ];
            }catch(QueryException $e) {
                return [
                    "data"=> $e->getMessage(),
                    "code"=>GlobalResponse::$DATABASE_SUCCESS_CODE
                ];
            }
        }

        public static function getUserByName(string $name) : ?array {
            try {
                $res = db::selectOne("select * from user where username = ?",[$name]);
                // $sql = 
                return [
                    "code" => GlobalResponse::$DATABASE_SUCCESS_CODE,
                    "data" => $res
                ];
            }catch (QueryException $e) {
                return [
                    "code" => GlobalResponse::$DATABASE_ERROR_CODE,
                    "data" => $e->getMessage()
                ];
            }
        }

        public static function getUserPrimissions (string $id) : ?array {
            try {
                db::beginTransaction();
                $sql = "SELECT p.name FROM user AS u LEFT JOIN role_has_permissions AS rp ON rp.role_id = u.role_id LEFT JOIN permissions AS p ON p.id = rp.permission_id WHERE u.id = ?";
                $res = db::select($sql,[$id]);
                db::commit();
                return [
                    "data"=> $res,
                    "code"=> GlobalResponse::$DATABASE_SUCCESS_CODE
                ];
            }catch (QueryException $e) {
                return [
                    "code" => GlobalResponse::$DATABASE_ERROR_CODE,
                    "data" => $e->getMessage()
                ];
            }
        }

        public static function getUserById() :?array {
            return null;
        }


        public static function updateUserById(string $id, ?array $data) :?array {
            return null;
        }

        public static function deleteLogicUserById(string $id) :?array{
            if (!$id) {
                return [
                    "code"=>GlobalResponse::$DATABASE_ERROR_CODE
                ];
            }
            return null;
        }

        public static function deleteUserById (string $id) :?array {
            if (!$id)
                return [
                    "code"=>GlobalResponse::$DATABASE_ERROR_CODE,
                ];
            db::beginTransaction();
            $res = db::delete("delete * from platoform_user where id = ?",[$id]);
            if ($res) {
                db::commit();
                return [
                    "code"=> GlobalResponse::$DATABASE_SUCCESS_CODE,
                ];
            }else{
                db::rollBack();
                return [
                    "code"=>GlobalResponse::$DATABASE_ERROR_CODE
                ];
            }
        }



    }

?>
