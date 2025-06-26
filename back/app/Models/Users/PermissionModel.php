<?php
    namespace App\Models\Users;


    use App\Utils\GlobalResponse;
    use Exception;
    use Illuminate\Support\Facades\DB as db;
    use Illuminate\Database\Eloquent\Model;
    use Illuminate\Database\QueryException;
    use Illuminate\Support\Facades\Log as log;

    class PermissionModel extends Model {

        protected $table = "permissions";


        public static function getAllPermission(int $page = 1,int $pagesize = 10):?array {
            try {
                $offset = ( $page - 1) *$pagesize;
                $sql = "SELECT * FROM `c_PERMISSIONS` LIMIT ? OFFSET ?";
                $res  = db::select($sql,[$pagesize,$offset]);
                return [
                    "code"=>GlobalResponse::$DATABASE_SUCCESS_CODE,
                    "data" => $res
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
                $sql =  "SELECT * FROM `c_PERMISSIONS` WHERE `id` = ?";
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

        public static function grantPermission2Role (string $role_id,string $permission_id):array {
            $sql = "INSERT INTO c_ROLES_PERMISSIONS VALUES(?,?)";
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
            $sql = "DELETE FROM c_ROLES_PERMISSIONS WHERE role_id = ? and permission_id = ?";
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
            $sql = "INSERT INTO c_PERMISSIONS VALUES(?,?,NOW(),NOW())";
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
            $sql = "UPDATE `c_PERMISSIONS` SET name= ?,update_at =NOW() WHERE id = ?";
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
            $sql = "DELETE * FROM  c_PERMISSIONS WHERE id = ?";
            $sql_role_permissions = "DELETE * FROM c_ROLES_PERMISSIONS WHERE permission_id = ? ";
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