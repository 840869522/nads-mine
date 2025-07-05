<?php
    namespace App\Models\Users;


    use App\Utils\GlobalResponse;
    use Exception;
    use Illuminate\Support\Facades\DB as db;
    use Illuminate\Database\Eloquent\Model;
    use Illuminate\Database\QueryException;
    use Illuminate\Support\Facades\Log as log;

    class PermissionModel extends Model {

        protected $table = "c_permissions";


        public static function getAllPermission(int $page = 1,int $pagesize = 10):?array {
            $offset = ( $page - 1) *$pagesize;
            $sql = "SELECT * FROM `c_permissions` LIMIT ? OFFSET ?";
            $sql_count = "SELECT COUNT(id) AS count FROM `c_permissions`";
            try {
                $res  = db::select($sql,[$pagesize,$offset]);
                $count = db::selectOne($sql_count);
                return [
                    "code"=>GlobalResponse::$DATABASE_SUCCESS_CODE,
                    "data" => $res,
                    "count"=>$count->count
                ];
            }catch (QueryException $e) {
                log::info('[DATABASE]: HAAPENDE ERROR : '.$e->getMessage());
                return [
                    "code"=>GlobalResponse::$DATABASE_ERROR_CODE
                ];
            }
        }


        public static function getPermissionById(?string $id) {
            try {
                $sql =  "SELECT * FROM `c_permissions` WHERE `c_id` = ?";
                $res = db::selectOne($sql,[$id]);
                return [
                    "code"=>GlobalResponse::$DATABASE_SUCCESS_CODE,
                    "data" => $res
                ];
            }catch (QueryException $e) {
                log::info('[DATABASE]: HAAPENDE ERROR : '.$e->getMessage());
                return [
                    "code"=> GlobalResponse::$DATABASE_ERROR_CODE
                ];
            }
        }

        public static function searchPermissionByName(string $name, int $page = 1,int $pagesize=10) :array {
            $sql = "SELECT * FROM `c_permissions` WHERE c_name LIKE ? LIMIT ? OFFSET ?";
            $offset = ($page - 1) * $pagesize;
            try {
                $user = db::select($sql, ['%'.$name.'%','%'.$name.'%',$pagesize, $offset]);
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

        public static function getPermissionsByRoleId (string $role_id):array {
            $sql = "SELECT cper.* FROM `c_roles_permissions` AS crp JOIN `c_permissions` AS cper ON crp.c_permission_id = cper.c_id WHERE crp.`c_role_id` = ?";
            try {
                $res = db::select($sql,[$role_id]);
                return [
                    "code"=>GlobalResponse::$DATABASE_SUCCESS_CODE,
                    "data" => $res
                ];
            }catch (Exception $e) {
                log::info('[DATABASE]: HAAPENDE ERROR : '.$e->getMessage());
                return [
                    "code"=> GlobalResponse::$DATABASE_ERROR_CODE
                ];
            }
        }

        public static function grantPermission2Role (string $role_id,string $permission_id):array {
            $sql = "INSERT INTO c_roles_permissions VALUES(?,?)";
            try {
                db::beginTransaction();
                $res = db::insert($sql,[$role_id,$permission_id]);
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

        public static function revokePermissionFromRole(string $role_id,string $permission_id):array {
            $sql = "DELETE FROM c_roles_permissions WHERE c_role_id = ? and c_permission_id = ?";
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

        public static function insertNewPermission(array $data) : array {
            $sql = "INSERT INTO c_permissions VALUES(?,?)";
            try {
                db::beginTransaction();
                $res = db::insert($sql,[$data['id'],$data["name"]]);
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
                    "code"=> GlobalResponse::$DATABASE_ERROR_CODE
                ];
            }

        }

        
        public static function updatePermission(string $id,array $data):array {
            $sql = "UPDATE `c_permissions` SET c_name= ? WHERE c_id = ?";
            try {
                db::beginTransaction();
                $res = db::update($sql,[$data['name'],$id]);
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
            }catch (Exception $e) {
                log::info('[DATABASE]: HAAPENDE ERROR : '.$e->getMessage());
                return [
                    "code"=> GlobalResponse::$DATABASE_ERROR_CODE
                ];
            }
        }

        public static function deletePermission(string $id) :array {
            $sql = "DELETE * FROM  c_permissions WHERE c_id = ?";
            $sql_role_permissions = "DELETE * FROM c_ROLES_PERMISSIONS WHERE c_permission_id = ? ";
            try {
                db::beginTransaction();
                $res = db::delete($sql,[$id]);
                $res_roles_permissions = db::delete($sql_role_permissions,[$id]);
                if ($res && $res_roles_permissions >= 0) {
                    db::commit();
                    return [
                        "code"=>GlobalResponse::$DATABASE_SUCCESS_CODE
                    ];
                }
                db::rollBack();
                return [
                    "code"=>GlobalResponse::$DATABASE_ERROR_CODE
                ];
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