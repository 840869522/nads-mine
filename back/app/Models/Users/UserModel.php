<?php

    namespace App\Models\Users;
    use Illuminate\Database\Eloquent\Model;
    use Illuminate\Database\QueryException;
    use Illuminate\Support\Facades\DB as db;
    use App\Utils\GlobalResponse;
    use Exception;
    use Illuminate\Support\Facades\Log;

class UserModel extends Model{

    protected  $table = "c_users";

    protected $primaryKey = 'c_username'; // 1. 明确告诉 Eloquent 主键是 'c_username'
    public $incrementing = false;         // 2. 告诉 Eloquent 主键不是一个自增的整数
    protected $keyType = 'string';        // 3. 告诉 Eloquent 主'c_username'键是字符串类型

    public static function getAllUser(int $page = 1,int $pagesize = 10):array {
        $offset = ($page - 1 ) * $pagesize;
        $sql = "SELECT c_username,c_email,c_is_login,c_last_login,c_create_at,c_update_at FROM `c_users`  LIMIT ? OFFSET ?";
        $sql_count = "SELECT COUNT(c_username) AS count FROM `c_users`";
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
        $sql = "SELECT c_username,c_email,c_is_login,c_last_login,c_create_at,c_update_at FROM `c_users` WHERE `c_username` LIKE ? LIMIT ? OFFSET ?";
        $sql_count = "SELECT COUNT(c_username) AS count FROM `c_users` WHERE `c_username` LIKE ?";
        $offset = ($page - 1) * $pagesize;
        try {
            $user = db::select($sql, ['%'.$name.'%',$pagesize, $offset]);
            $count = db::selectOne($sql_count,['%'.$name.'%']);
            return [
                "data"=>$user,
                "code"=>GlobalResponse::$DATABASE_SUCCESS_CODE,
                "count" => $count->count
            ];
        }catch (Exception $e) {
            Log::info('[DATABASE]: HAAPENDE ERROR : '.$e->getMessage());
            return [
                "code"=>GlobalResponse::$DATABASE_ERROR_CODE
            ];
        }
    }

    public static function getUserByName(string $name) : array {
        $sql = "SELECT * FROM `c_users` WHERE c_username = ?";
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
            $sql = "SELECT DISTINCT crp.c_permission_id FROM `c_users_roles` AS cur JOIN `c_roles_permissions` AS crp  ON cur.c_role_id = crp.c_role_id  WHERE cur.c_user_id = ?" ;
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
        $sql = "SELECT * FROM `c_users` WHERE c_username = ?";
        try {
            $res = db::selectOne($sql,[$id]);
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
                $sql = "INSERT INTO `c_users`(c_username,c_password,c_email,c_create_at,c_update_at) VALUES(?,?,?,NOW(),NOW())";
                db::beginTransaction();
                $res = db::insert($sql,[$data['username'],$data['password'],$data["email"]]);
                if ($res){
                    db::commit();
                    $roles = array_map(function($role_id) use ($data) {
                        return [
                            'c_user_id' => $data['username'],
                            'c_role_id' => $role_id
                        ];
                    }, $data["role"]);
                    $roleModelRes = RoleModel::grantRole2User($data['username'],$roles);
                    if ($roleModelRes["code"] == GlobalResponse::$DATABASE_ERROR_CODE){
                        UserModel::deleteUserById($data["username"]);
                        return [
                            "code"=>GlobalResponse::$DATABASE_ERROR_CODE,
                        ];
                    }
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
            $sql = "UPDATE `c_users` SET c_is_login = ?,c_email = ?,c_password = ?, c_update_at = NOW() WHERE c_username = ?";
            try {
                db::beginTransaction();
                $res = db::update($sql,[$data["is_login"],$data['email'],$data['password'],$id]);
                if ($res){
                    db::commit();
                    $roles = array_map(function($role_id) use ($id) {
                        return [
                            'c_user_id' => $id,
                            'c_role_id' => $role_id
                        ];
                    }, $data["role"]);
                    $roleModelRes = RoleModel::grantRole2User($id,$roles);
                    if ($roleModelRes["code"] == GlobalResponse::$DATABASE_ERROR_CODE){
                        return [
                            "code"=>GlobalResponse::$DATABASE_ERROR_CODE,
                        ];
                    }
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
        $sql = "DELETE * FROM `c_users` WHERE c_username = ?";
        $sql_user_role = "DELETE * FROM `c_roles_users WHERE c_user_id = ?";
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
        $sql = "UPDATE c_users SET c_last_login = NOW() WHERE c_username = ?";
        db::update($sql,[$id]);
    }

}

?>
