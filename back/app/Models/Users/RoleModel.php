<?php

    namespace App\Models\Users;

    use Illuminate\Database\Eloquent\Model;
    use Illuminate\Support\Facades\DB as db;
    use Illuminate\Database\QueryException;
    use Illuminate\Support\Facades\Log as log;

    use App\Utils\GlobalResponse;
    use Exception;

    class RoleModel extends Model {
        protected $table = "role";

        public static function getAllRole(int $page = 1,int $pagesize = 10) :array {
            $offset = ($page - 1 ) * $pagesize;
            $sql = "SELECT * FROM `c_roles` LIMIT ? OFFSET ?";
            try {  
                $res = db::select($sql,[$pagesize,$offset]);
                return [
                    "code"=>GlobalResponse::$DATABASE_SUCCESS_CODE,
                    "data"=>$res
                ];
            }catch (QueryException $e) {
                log::info('[DATABASE]: HAAPENDE ERROR : '.$e->getMessage());
                return [
                    "code"=>GlobalResponse::$DATABASE_ERROR_CODE
                ];
            }
        }


        public static function getRoleById(?string $id) :array {
            try {
                $sql = "SELECT * FROM  `c_roles` WHERE `id` = ?";
                $res = db::selectOne($sql,[$id]);
                return [
                    "code"=>GlobalResponse::$DATABASE_SUCCESS_CODE,
                    "data"=>$res
                ];
            }catch (QueryException $e) {
                log::info('[DATABASE]: HAAPENDE ERROR : '.$e->getMessage());
                return [
                    "code" => GlobalResponse::$DATABASE_ERROR_CODE
                ];
            }
        }

        public static function grantRole2User (string $role_id,string $user_id):array {
            $sql = "INSERT INTO c_users_roles VALUES(?,?)";
            try {
                db::beginTransaction();
                $res = db::insert($sql,[$user_id,$role_id]);
                if($res) {
                    db::commit();
                    return [
                        "code"=>GlobalResponse::$DATABASE_SUCCESS_CODE
                    ];
                }
                db::rollBack();
                return [
                    "code"=>GlobalResponse::$DATABASE_ERROR_CODE
                ];
                return [];
            }catch (Exception $e) {
                log::info('[DATABASE]: HAAPENDE ERROR : '.$e->getMessage());
                return [
                    "code"=> GlobalResponse::$DATABASE_ERROR_CODE
                ];
            }
        }

        public static function revokeRoleFromUser(string $role_id,string $permission_id):array {
            $sql = "DELETE FROM c_users_roles WHERE role_id = ? and user_id = ?";
            try {
                db::beginTransaction();
                $res = db::delete($sql,[$role_id,$permission_id]);
                if($res) {
                    db::commit();
                    return [
                        "code"=>GlobalResponse::$DATABASE_SUCCESS_CODE
                    ];
                }
                db::rollBack();
                return [
                    "code"=>GlobalResponse::$DATABASE_ERROR_CODE
                ];
                return [];
            }catch (Exception $e) {
                log::info('[DATABASE]: HAAPENDE ERROR : '.$e->getMessage());
                return [
                    "code"=> GlobalResponse::$DATABASE_ERROR_CODE
                ];
            }
        }


        public static function insertNewRole(?array $data) :array {
            $sql = "INSERT INTO c_roles(id,name,create_at,update_at) VALUES(?,?,NOW(),NOW())";
            try {
                db::beginTransaction();
                $res = db::insert($sql,[$data['id'],$data['name']]);
                if ($res) {
                    db::commit();
                    return [
                        "code"=>GlobalResponse::$DATABASE_SUCCESS_CODE,
                    ];
                }
                db::rollBack();
                return [
                    "code"=>GlobalResponse::$DATABASE_ERROR_CODE
                ];
            }catch(Exception $e) {
                log::info('[DATABASE]: HAAPENDE ERROR : '.$e->getMessage());
                return [
                    "code" => GlobalResponse::$DATABASE_ERROR_CODE
                ];
            }
        }

        public static function updateRoleById(string $id,?array $data) :array {
            $sql = "UPDATE c_roles SET name = ?,update_at = NOW() WHERE id = ?";
            try {
                db::beginTransaction();
                $res = db::update($sql,[$data['name'],$id]);
                if ($res) {
                    db::commit();
                    return [
                        "code"=>GlobalResponse::$DATABASE_SUCCESS_CODE
                    ];
                }
                db::rollBack();
                return [
                    "code"=>GlobalResponse::$DATABASE_ERROR_CODE
                ];
            }catch (Exception $e) {
                log::info('[DATABASE]: HAAPENDE ERROR : '.$e->getMessage());
                return [
                    'code'=>GlobalResponse::$DATABASE_ERROR_CODE
                ];
            }
        }

        public static function deleteRoleById(string $id):array {
            $sql = "DELETE FROM c_roles WHERE id = ?";
            try {
                db::beginTransaction();
                $res = db::delete($sql,[$id]);
                if($res) {
                    $sql_user_role = "DELETE FROM c_USERS_ROLES WHERE role_id = ?";
                    $sql_role_permission = "DELETE FROM c_ROLES_PERMISSIONS WHERE role_id = ?";
                    $res_role_permission = db::delete($sql_role_permission,[$id]);
                    $res_user_role = db::delete($sql_user_role,[$id]);
                    log::info("res_role_permission:".$res_role_permission."res_user_role".$res_user_role);
                    if ($res_user_role >=0 && $res_role_permission >=0) {
                        db::commit();
                        return [
                            'code'=>GlobalResponse::$DATABASE_SUCCESS_CODE
                        ];
                    }else {
                        db::rollBack();
                        return [
                            "code" => GlobalResponse::$DATABASE_ERROR_CODE
                        ];
                    }
                }
                db::rollBack();
                return [
                    "code"=>GlobalResponse::$DATABASE_ERROR_CODE
                ];
            }catch (Exception $e) {
                log::info('[DATABASE]: HAAPENDE ERROR : '.$e->getMessage());
                return [
                    "code"=>GlobalResponse::$DATABASE_ERROR_CODE
                ];
            }

        }
    }

?>