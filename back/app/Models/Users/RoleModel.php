<?php

    namespace App\Models\Users;

    use Illuminate\Database\Eloquent\Model;
    use Illuminate\Support\Facades\DB as db;
    use Illuminate\Database\QueryException;
    use Illuminate\Support\Facades\Log as log;

    use App\Utils\GlobalResponse;
    use Exception;

    class RoleModel extends Model {
        protected $table = "c_roles";

        public static function getAllRole(int $page = 1,int $pagesize = 10) :array {
            $offset = ($page - 1 ) * $pagesize;
            $sql = "SELECT * FROM `c_roles` LIMIT ? OFFSET ?";
            $sql_count = "SELECT COUNT(c_id) AS count FROM `c_roles`";
            try {  
                $res = db::select($sql,[$pagesize,$offset]);
                $count = db::select($sql_count);
                return [
                    "code"=>GlobalResponse::$DATABASE_SUCCESS_CODE,
                    "data"=>$res,
                    "count"=> $count[0]->count
                ];
            }catch (QueryException $e) {
                log::info('[DATABASE]: HAAPENDE ERROR : '.$e->getMessage());
                return [
                    "code"=>GlobalResponse::$DATABASE_ERROR_CODE
                ];
            }
        }


        public static function getUserRole(string $username):array {
            $sql = "SELECT DISTINCT cr.c_id FROM `c_users_roles` AS cur JOIN `c_roles` AS cr ON cur.c_role_id = cr.c_id  WHERE c_user_id = ?";
            try {
                $res = db::select($sql,[$username]);
                return [
                    "data" => $res,
                    "code"=> GlobalResponse::$DATABASE_SUCCESS_CODE
                ];
            }catch (Exception $e) {
                log::info('[DATABASE]: HAAPENDE ERROR : '.$e->getMessage());
                return [
                    "code" => GlobalResponse::$DATABASE_ERROR_CODE
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

        public static function searchRoleByName(string $name, int $page = 1,int $pagesize=10) :array {
            $sql = "SELECT * FROM `c_roles` WHERE c_name LIKE ? OR c_id LIKE ? LIMIT ? OFFSET ?";
            $offset = ($page - 1) * $pagesize;
            $sql_count  = "SELECT COUNT(c_id) AS count FROM `c_roles` WHERE c_name LIKE ? OR c_id LIKE ?";
            try {
                $role = db::select($sql, ['%'.$name.'%','%'.$name.'%',$pagesize, $offset]);
                $count = db::selectOne($sql_count,['%'.$name.'%','%'.$name.'%']);
                return [
                    "data"=>$role,
                    "count"=>$count->count,
                    "code"=>GlobalResponse::$DATABASE_SUCCESS_CODE
                ];
            }catch (Exception $e) {
                Log::info('[DATABASE]: HAAPENDE ERROR : '.$e->getMessage());
                return [
                    "code"=>GlobalResponse::$DATABASE_ERROR_CODE
                ];
            } 
        }

        public static function grantRole2User (string $user_id,array $values):array {
            try {
                db::beginTransaction();
                $res_delete = db::table("c_users_roles")->where("c_user_id",$user_id)->delete();
                $res = db::table("c_users_roles")->insert($values);
                if ($res_delete === false || $res === false) {
                    db::rollBack();
                    return [
                        "code" => GlobalResponse::$DATABASE_ERROR_CODE
                    ];
                }
                db::commit();
                return [
                    "code"=>GlobalResponse::$DATABASE_SUCCESS_CODE
                ];
            }catch (Exception $e) {
                db::rollBack();
                log::info('[DATABASE]: HAAPENDE ERROR : '.$e->getMessage());
                return [
                    "code"=> GlobalResponse::$DATABASE_ERROR_CODE
                ];
            }
        }

        public static function revokeRoleFromUser(string $role_id,string $permission_id):array {
            $sql = "DELETE FROM c_users_roles WHERE c_role_id = ? and c_user_id = ?";
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
                db::rollBack();
                log::info('[DATABASE]: HAAPENDE ERROR : '.$e->getMessage());
                return [
                    "code"=> GlobalResponse::$DATABASE_ERROR_CODE
                ];
            }
        }


        public static function insertNewRole(?array $data) :array {
            $sql = "INSERT INTO c_roles(c_id,c_name,c_create_at,c_update_at) VALUES(?,?,NOW(),NOW())";
            try {
                db::beginTransaction();
                $res = db::insert($sql,[$data['id'],$data['name']]);
                if ($res) {
                    db::commit();
                    $permissions = array_map(function($permissionId) use ($data) {
                        return [
                            'c_role_id' => $data['id'],
                            'c_permission_id' => $permissionId
                        ];
                    }, $data["permissions"]);
                    $permissionsModelRes = PermissionModel::grantPermission2Role($data["id"],$permissions);
                    if ($permissionsModelRes['code'] == GlobalResponse::$DATABASE_ERROR_CODE) {
                        $_ = RoleModel::deleteRoleById($data["id"]);
                        return [
                            "code" => GlobalResponse::$DATABASE_ERROR_CODE
                        ];
                    }
                    return [
                        "code"=>GlobalResponse::$DATABASE_SUCCESS_CODE,
                    ];
                }
                db::rollBack();
                return [
                    "code"=>GlobalResponse::$DATABASE_SUCCESS_CODE
                ];
            }catch(Exception $e) {
                db::rollBack();
                log::info('[DATABASE]: HAAPENDE ERROR : '.$e->getMessage());
                return [
                    "code" => GlobalResponse::$DATABASE_ERROR_CODE
                ];
            }
        }

        public static function updateRoleById(string $id,?array $data) :array {
            $sql = "UPDATE c_roles SET c_name = ?,c_update_at = NOW() WHERE c_id = ?";
            try {
                db::beginTransaction();
                $res = db::update($sql,[$data['name'],$id]);
                if ($res) {
                    db::commit();
                    $permissions = array_map(function($permissionId) use ($id) {
                        return [
                            'c_role_id' => $id,
                            'c_permission_id' => $permissionId
                        ];
                    }, $data["permissions"]);
                    PermissionModel::grantPermission2Role($id,$permissions);

                    return [
                        "code"=>GlobalResponse::$DATABASE_SUCCESS_CODE
                    ];
                }
                db::rollBack();
                return [
                    "code"=>GlobalResponse::$DATABASE_ERROR_CODE
                ];
            }catch (Exception $e) {
                db::rollBack();
                log::info('[DATABASE]: HAAPENDE ERROR : '.$e->getMessage());
                return [
                    'code'=>GlobalResponse::$DATABASE_ERROR_CODE
                ];
            }
        }

        public static function deleteRoleById(string $id):array {
            $sql = "DELETE FROM c_roles WHERE c_id = ?";
            try {
                db::beginTransaction();
                $sql_user_role = "DELETE FROM c_users_roles WHERE c_role_id = ?";
                $sql_role_permission = "DELETE FROM c_roles_permissions WHERE c_role_id = ?";
                $res_role_permission = db::delete($sql_role_permission,[$id]);
                $res_user_role = db::delete($sql_user_role,[$id]);
                $res = db::delete($sql,[$id]);
                if($res) {
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
                db::rollBack();
                log::info('[DATABASE]: HAAPENDE ERROR : '.$e->getMessage());
                return [
                    "code"=>GlobalResponse::$DATABASE_ERROR_CODE
                ];
            }

        }
    }

?>