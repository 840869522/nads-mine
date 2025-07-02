<?php

    namespace App\Models\Users;
    use Illuminate\Database\Eloquent\Model;
    use Illuminate\Database\QueryException;
    use Illuminate\Support\Facades\DB as db;
    use App\Utils\GlobalResponse;
    use Exception;
    use Illuminate\Support\Facades\Log;
    use Ramsey\Uuid\Uuid;

    class UserModel extends Model{

        protected  $table = "platform_user";

        public static function getAllUser(int $page = 1,int $pagesize = 10):array {
            $offset = ($page - 1 ) * $pagesize;
            $sql = "SELECT id,username,email,status,last_login,create_at,update_at FROM `c_users`  LIMIT ? OFFSET ?";
            $sql_count = "SELECT COUNT(id) AS count FROM `c_users`";
            try {
                $user = db::select($sql, [$pagesize, $offset]);
                $count = db::select($sql_count);
                return [
                    "data"=>$user,
                    "count" =>$count[0]->count,
                    "code"=>GlobalResponse::$DATABASE_SUCCESS_CODE
                ];
            }catch(QueryException $e) {
                Log::info('[DATABASE]: HAAPENDE ERROR : '.$e->getMessage());
                return [
                    "code"=>GlobalResponse::$DATABASE_ERROR_CODE
                ];
            }
        }

        public static function searchUserByName(string $name, int $page=1, int $pagesize=10):array {
            $sql = "SELECT id,username,email,status,last_login,create_at,update_at FROM `c_users` WHERE `user_name` LIKE ? LIMIT ? OFFSET ?";
            $offset = ($page - 1) * $pagesize;
            try {
                $user = db::select($sql, ['%'.$name.'%',$pagesize, $offset]);
                return [
                    "data"=>$user,
                    "code"=>GlobalResponse::$DATABASE_SUCCESS_CODE
                ];
            }catch (Exception $e) {
                Log::info('[DATABASE]: HAAPENDE ERROR : '.$e->getMessage());
                return [
                    "code"=>GlobalResponse::$DATABASE_ERROR_CODE
                ];
            } 
        }

        public static function getUserByName(string $name) : array {
            $sql = "SELECT * FROM `c_users` WHERE username = ?";
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
                $sql = "SELECT DISTINCT crp.permission_id FROM `c_users_roles` AS cur JOIN `c_roles_permissions` AS crp  ON cur.role_id = crp.role_id  WHERE cur.user_id = ?" ;
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
            $sql = "SELECT * FROM `c_users` WHERE username = ?";
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
                $sql = "INSERT INTO `c_users`(id,username, password,email,create_at,update_at) VALUES(?,?,?,?,NOW(),NOW())";
                db::beginTransaction();
                $res = db::insert($sql,[Uuid::uuid4()->toString(),$data['username'],$data['password'],$data["email"]]);
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
            $sql = "UPDATE `c_users` SET email = ?,password = ?, update_at = NOW() WHERE id = ?";
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
            $sql = "DELETE * FROM `c_users` WHERE username = ?";
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

        public static function updateUserLastLogin(string $id) {
            $sql = "UPDATE c_users SET last_login = NOW() WHERE id = ?";
            db::update($sql,[$id]);
        }

    }

?>
