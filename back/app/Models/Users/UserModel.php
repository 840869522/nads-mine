<?php

    namespace App\Models\Users;
    use Illuminate\Database\Eloquent\Model;
    use Illuminate\Database\QueryException;
    use Illuminate\Support\Facades\DB as db;
    use App\Utils\GlobalResponse;
    use Exception;
    use Illuminate\Support\Facades\Log;

    class UserModel extends Model{

        protected  $table = "platform_user";

        public static function getAllUser(int $page = 1,int $pagesize = 10):array {
            try {
                $offset = ($page - 1 ) * $pagesize;
                $sql = "SELECT user_id,user_name,email FROM `c_users`  LIMIT ? OFFSET ?";
                $user = db::select($sql, [$pagesize, $offset]);
                return [
                    "data"=>$user,
                    "code"=>GlobalResponse::$DATABASE_SUCCESS_CODE
                ];
            }catch(QueryException $e) {
                Log::info('[DATABASE]: HAAPENDE ERROR : '.$e->getMessage());
                return [
                    "code"=>GlobalResponse::$DATABASE_ERROR_CODE
                ];
            }
        }

        public static function getUserByName(string $name) : array {
            $sql = "SELECT * FROM `c_users` WHERE user_name = ?";
            try {
                $res = db::selectOne($sql,[$name]);
                return [
                    "code" => GlobalResponse::$DATABASE_SUCCESS_CODE,
                    "data" => $res
                ];
            }catch (QueryException $e) {
                Log::info('[DATAABSE]: HAAPENDE ERROR : '.$e->getMessage());
                return [
                    "code" => GlobalResponse::$DATABASE_ERROR_CODE
                ];
            }
        }

        public static function getUserPrimissions (string $id) : array {
            try {
                db::beginTransaction();
                $sql = "SELECT DISTINCT  cper.label FROM `c_users_roles` AS cur JOIN `c_roles_permissions` AS crp  ON cur.role_id = crp.role_id JOIN `c_permisssions` AS cper ON crp.permission_id = cper.id WHERE cur.user_id = ?" ;
                $res = db::select($sql,[$id]);
                db::commit();
                return [
                    "data"=> $res,
                    "code"=> GlobalResponse::$DATABASE_SUCCESS_CODE
                ];
            }catch (QueryException $e) {
                Log::info('[DATABASE]: HAAPENDE ERROR : '.$e->getMessage());
                return [
                    "code" => GlobalResponse::$DATABASE_ERROR_CODE
                ];
            }
        }

        public static function getUserById(string $id) :array {
            $sql = "SELECT * FROM `c_users` WHERE user_id = ? OR user_name = ?";
            try {
                $res = db::selectOne($sql,[$id,$id]);
                return [
                    "code" => GlobalResponse::$DATABASE_SUCCESS_CODE,
                    "data" => $res,
                ];
            }catch (Exception $e) {
                Log::info('[DATABASE]: HAAPENDE ERROR : '.$e->getMessage());
                return [
                    "code"=> GlobalResponse::$DATABASE_ERROR_CODE
                ];
            }
        }

        public static function insertNewUser(array $data) :array {
            try {
                $sql = "INSERT INTO `c_users`(user_name, password,email,create_at,update_at) VALUES(?,?,?,NOW(),NOW())";
                db::beginTransaction();
                $res = db::insert($sql,[$data['username'],$data['password'],$data["email"]]);
                if ($res){
                    db::commit();
                    return [
                        'code' => GlobalResponse::$DATABASE_SUCCESS_CODE,
                    ];
                }
                db::rollBack();
                return [
                    "code"=>GlobalResponse::$DATABASE_ERROR_CODE
                ];
            }catch(Exception $e) {
                Log::info('[DATABASE]: HAAPENDE ERROR : '.$e->getMessage());
                return [
                    "code"=>GlobalResponse::$DATABASE_ERROR_CODE,
                ];
            }
        }


        public static function updateUserById(string $id, array $data) :array {
            $sql = "UPDATE `c_users` SET email = ?,password = ?, update_at = NOW() WHERE user_id = ?";
            try {
                db::beginTransaction();
                $res = db::update($sql,[$data['email'],$data['password'],$id]);
                if ($res){
                    db::commit();
                    return [
                        'code' => GlobalResponse::$DATABASE_SUCCESS_CODE,
                    ];
                }
                db::rollBack();
                return [
                    "code"=>GlobalResponse::$DATABASE_ERROR_CODE
                ];
            }catch(Exception $e) {
                Log::info('[DATABASE]: HAAPENDE ERROR : '.$e->getMessage());
                return [
                    "code" => GlobalResponse::$DATABASE_ERROR_CODE
                ];
            }
        }


        public static function deleteUserById (string $id) :array {
            $sql = "DELETE * FROM `c_users` WHERE id = ?";
            $sql_user_role = "DELETE * FROM `c_USERS_ROLES WHERE user_id = ?";
            try {
                if (!$id)
                    return [
                        "code"=>GlobalResponse::$DATABASE_ERROR_CODE,
                    ];
                db::beginTransaction();
                $res = db::delete($sql,[$id]);
                $res_user_role = db::delete($sql_user_role, [$id]);
                if ($res && $res_user_role) {
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
            }catch(Exception $e) {
                Log::info('[DATABASE]: HAAPENDE ERROR : '.$e->getMessage());
                return [
                    "code"=>GlobalResponse::$DATABASE_ERROR_CODE
                ];
            }
        }

    }

?>
