<?php

namespace App\Models\Users;


use App\Utils\GlobalResponse;
use Exception;
use Illuminate\Support\Facades\DB as db;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Log as log;

class PermissionModel extends Model
{

    protected $table = "c_permissions";


    public static function getAllPermission(int $page = 1, int $pagesize = 10): array
    {
        $offset = ($page - 1) * $pagesize;
        $sql = "SELECT * FROM `c_permissions` LIMIT ? OFFSET ?";
        $sql_count = "SELECT COUNT(c_id) AS count FROM `c_permissions`";
        try {
            $res  = db::select($sql, [$pagesize, $offset]);
            $count = db::selectOne($sql_count);
            return [
                "code" => GlobalResponse::$DATABASE_SUCCESS_CODE,
                "data" => $res,
                "count" => $count->count
            ];
        } catch (QueryException $e) {
            log::info('[DATABASE]: HAAPENDE ERROR : ' . $e->getMessage());
            return [
                "code" => GlobalResponse::$DATABASE_ERROR_CODE
            ];
        }
    }


    public static function getPermissionById(?string $id)
    {
        try {
            $sql =  "SELECT * FROM `c_permissions` WHERE `c_id` = ?";
            $res = db::selectOne($sql, [$id]);
            return [
                "code" => GlobalResponse::$DATABASE_SUCCESS_CODE,
                "data" => $res
            ];
        } catch (QueryException $e) {
            log::info('[DATABASE]: HAAPENDE ERROR : ' . $e->getMessage());
            return [
                "code" => GlobalResponse::$DATABASE_ERROR_CODE
            ];
        }
    }

    public static function searchPermissionByName(string $name, int $page = 1, int $pagesize = 10): array
    {
        $sql = "SELECT * FROM `c_permissions` WHERE c_des LIKE ? OR c_id LIKE ? OR c_label LIKE ?  LIMIT ? OFFSET ?";
        $sql_count = "SELECT COUNT(c_id) AS count FROM `c_permissions` WHERE c_des LIKE ? OR c_id LIKE ? OR c_label LIKE ?";
        $offset = ($page - 1) * $pagesize;
        try {
            $user = db::select($sql, ['%' . $name . '%', '%' . $name . '%', '%' . $name . '%',$pagesize, $offset]);
            $count = db::select($sql_count, ['%' . $name . '%', '%' . $name . '%','%' . $name . '%']);
            return [
                "data" => $user,
                "code" => GlobalResponse::$DATABASE_SUCCESS_CODE,
                "count" => $count
            ];
        } catch (Exception $e) {
            Log::info('[DATABASE]: HAAPENDE ERROR : ' . $e->getMessage());
            return [
                "code" => GlobalResponse::$DATABASE_ERROR_CODE
            ];
        }
    }

    public static function getPermissionsByRoleId(string $role_id): array
    {
        $sql = "SELECT cper.* FROM `c_roles_permissions` AS crp JOIN `c_permissions` AS cper ON crp.c_permission_id = cper.c_id WHERE crp.`c_role_id` = ?";
        try {
            $res = db::select($sql, [$role_id]);
            return [
                "code" => GlobalResponse::$DATABASE_SUCCESS_CODE,
                "data" => $res
            ];
        } catch (Exception $e) {
            log::info('[DATABASE]: HAAPENDE ERROR : ' . $e->getMessage());
            return [
                "code" => GlobalResponse::$DATABASE_ERROR_CODE
            ];
        }
    }

    public static function grantPermission2Role(string $role_id, array $value): array
    {
        $sql = "DELETE FROM c_roles_permissions WHERE c_role_id = ?";
        db::beginTransaction();
        try {

            $res_delete = db::delete($sql, [$role_id]);
            if ($res_delete >= 0) {
                $res = db::table("c_roles_permissions")->insert($value);
            } else {
                db::rollBack();
                return [
                    "code" => GlobalResponse::$DATABASE_ERROR_CODE
                ];
            }
        } catch (Exception $e) {
            db::rollBack();
            log::info('[DATABASE]: HAAPENDE ERROR : ' . $e->getMessage());
            return [
                "code" => GlobalResponse::$DATABASE_ERROR_CODE
            ];
        }
        if ($res) {
            db::commit();
            return [
                "code" => GlobalResponse::$DATABASE_SUCCESS_CODE
            ];
        }
        db::rollBack();
        return [
            "code" => GlobalResponse::$DATABASE_ERROR_CODE
        ];
    }

    public static function revokePermissionFromRole(string $role_id, string $permission_id): array
    {
        $sql = "DELETE FROM c_roles_permissions WHERE c_role_id = ? and c_permission_id = ?";
        try {
            db::beginTransaction();
            $res = db::delete($sql, [$role_id, $permission_id]);
            if ($res) {
                db::commit();
                return [
                    "code" => GlobalResponse::$DATABASE_SUCCESS_CODE
                ];
            }
            db::rollBack();
            return [
                "code" => GlobalResponse::$DATABASE_ERROR_CODE
            ];
            return [];
        } catch (Exception $e) {
            db::rollBack();
            log::info('[DATABASE]: HAAPENDE ERROR : ' . $e->getMessage());
            return [
                "code" => GlobalResponse::$DATABASE_ERROR_CODE
            ];
        }
    }

    public static function insertNewPermission(array $data): array{
        try {
            db::beginTransaction();
            $value = [
                "c_id" => $data["id"],
                "c_des"=>$data['des'],
                "c_api_src"=>$data['api_src'],
                "c_pid"=>$data['pid'],
                "c_src"=>$data['src'],
                "c_is_menu"=> $data['is_menu'],
                "c_label"=>$data['label'],
                "c_icon"=>$data['icon'],
                "c_status"=> $data['status']
            ];
            $res = db::table("c_permissions")->insert($value);
            if ($res) {
                db::commit();
                return [
                    "code" => GlobalResponse::$DATABASE_SUCCESS_CODE
                ];
            }
            db::rollBack();
            return [
                "code" => GlobalResponse::$DATABASE_ERROR_CODE
            ];
        } catch (Exception $e) {
            db::rollBack();
            log::info('[DATABASE]: HAAPENDE ERROR : ' . $e->getMessage());
            return [
                "code" => GlobalResponse::$DATABASE_ERROR_CODE
            ];
        }
    }


    public static function updatePermission(string $id, array $data): array
    {
        $sql = "UPDATE `c_permissions` SET c_pid = ?,c_des= ?,c_label = ? ,c_api_src = ? ,c_src = ? ,c_is_menu = ?,c_status = ?,c_icon = ?  WHERE c_id = ?";
        try {
            db::beginTransaction();
            $res = db::update($sql, [$data["pid"], $data['des'], $data['label'], $data['api_src'], $data['src'], $data['is_menu'], $data['status'], $data['icon'], $id]);
            if ($res) {
                db::commit();
                return [
                    "code" => GlobalResponse::$DATABASE_SUCCESS_CODE
                ];
            }
            db::rollBack();
            return [
                "code" => GlobalResponse::$DATABASE_ERROR_CODE
            ];
        } catch (Exception $e) {
            db::rollBack();
            log::info('[DATABASE]: HAAPENDE ERROR : ' . $e->getMessage());
            return [
                "code" => GlobalResponse::$DATABASE_ERROR_CODE
            ];
        }
    }

    public static function deletePermission(string $id): array
    {
        $sql = "DELETE FROM  c_permissions WHERE c_id = ?";
        $sql_role_permissions = "DELETE FROM c_roles_permissions WHERE c_permission_id = ? ";
        try {
            db::beginTransaction();
            $res = db::delete($sql, [$id]);
            $res_roles_permissions = db::delete($sql_role_permissions, [$id]);
            if ($res && $res_roles_permissions >= 0) {
                db::commit();
                return [
                    "code" => GlobalResponse::$DATABASE_SUCCESS_CODE
                ];
            }
            db::rollBack();
            return [
                "code" => GlobalResponse::$DATABASE_ERROR_CODE
            ];
            return [
                "code" => GlobalResponse::$DATABASE_ERROR_CODE
            ];
        } catch (Exception $e) {
            db::rollBack();
            log::info('[DATABASE]: HAAPENDE ERROR : ' . $e->getMessage());
            return [
                "code" => GlobalResponse::$DATABASE_ERROR_CODE
            ];
        }
    }

    /**
     * 辅助函数 用以实现将权限数组数据转化为多级嵌套数据 通过添加children字段实现
     *
     * @param array $menus
     * @param string $pid
     * @param integer $depth
     * @return array
     */
    private static function buildTreeData(array $menus, int $isMenu = 0, string $pid = "0", int $depth = 0): array
    {
        if ($depth > 20) {
            Log::warning("菜单嵌套层级超过限制", ['depth' => $depth]);
            return [];
        }

        $branch = [];

        foreach ($menus as $menu) {
            if ($menu->c_pid === $pid) {
                $children = self::buildTreeData($menus, $isMenu, $menu->c_id, $depth + 1);
                // 添加子菜单（如果存在）
                if (!empty($children)) {
                    $menu->children = $children;
                }
                $newMenu = (array)$menu;
                unset($newMenu['c_pid']);
                unset($newMenu['c_is_menu']);
                if ($isMenu) {
                    $newMenu['requiredPermission'] = $newMenu['c_id'];
                    if (!trim($newMenu['to'])) {
                        unset($newMenu['to']);
                    }
                } else {
                    $newMenu['key'] = $newMenu['c_id'];
                    unset($newMenu['to']);
                }
                unset($newMenu['c_id']);
                unset($newMenu['sort']);
                $branch[] = $newMenu;
            }
        }

        return $branch;
    }

    /**
     * 用于得到前端需要的树状权限列表
     *
     * @param integer $menu 控制是否为菜单
     * @return array
     */
    public static function getSystemAllPermission(int $menu = 0): array
    {
        try {
            if ($menu) {
                $res = db::table("c_permissions")->select(['c_id', 'c_pid', 'c_label as label', 'c_is_menu', 'c_src as to', 'c_icon as icon','sort'])->where('c_is_menu', '=', $menu)->orderBy("sort")->get()->toArray();
            } else {
                $res = db::table("c_permissions")->select(['c_id', 'c_pid', 'c_label as label', 'c_is_menu', 'c_src as to','sort'])->orderBy("sort")->get()->toArray();
            }
            $menuData = self::buildTreeData($res, $menu);
            return [
                "code" => GlobalResponse::$DATABASE_SUCCESS_CODE,
                "data" => $menuData
            ];
        } catch (Exception $e) {
            log::info('[DATABASE]: HAAPENDE ERROR : ' . $e->getMessage());
            return [
                'code' => GlobalResponse::$DATABASE_ERROR_CODE
            ];
        }
    }

    /**
     * 返回权限的id和label 用于父项选择时返回数据
     */
    public static function getAllPermissionLabel(int $page = 1, int $pagesize = 10): array
    {
        $offset = ($page - 1) * $pagesize;
        $sql_count = "SELECT COUNT(c_id) AS count FROM `c_permissions`";
        try {
            $res  = db::table("c_permissions")->select(['c_id', 'c_label','sort'])->offset($offset)->limit($pagesize)->orderBy('sort')->get()->toArray();
            $count = db::selectOne($sql_count);
            return [
                "code" => GlobalResponse::$DATABASE_SUCCESS_CODE,
                "data" => $res,
                "count" => $count->count
            ];
        } catch (QueryException $e) {
            log::info('[DATABASE]: HAAPENDE ERROR : ' . $e->getMessage());
            return [
                "code" => GlobalResponse::$DATABASE_ERROR_CODE
            ];
        }
    }

    public static function getPermissionByApi($api){
        try {
            $res = db::table("c_permissions")->select(["c_id as id"])->where("c_api_src","=",$api)->limit(1)->get()->toArray();
            if (!empty($res)){
                return [
                    "code"=>GlobalResponse::$DATABASE_SUCCESS_CODE,
                    "data"=>[
                        "permission"=>$res[0]->id,
                        "needed"=>true
                    ]
                ];
            }else{
                return [
                    "code"=>GlobalResponse::$DATABASE_SUCCESS_CODE,
                    "data"=> [
                        "permission"=>"",
                        "needed"=>false
                    ]
                ];
            }
        }catch (Exception $e){
            log::info('[DATABASE]: HAAPENDE ERROR : '. $e->getMessage());
            return [
                "code" => GlobalResponse::$DATABASE_ERROR_CODE
            ];
        }
    }
}
?>
