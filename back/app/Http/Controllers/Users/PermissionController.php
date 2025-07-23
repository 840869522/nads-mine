<?php
    namespace App\Http\Controllers\Users;

    use App\Http\Controllers\Controller;
    use App\Models\Users\PermissionModel;
    use App\Utils\GlobalResponse;
    use Exception;
    use Illuminate\Http\Request;

    class PermissionController extends Controller {

        public function getAllPermission(Request $req) {
            $reqData = $req->json()->all();
            try {
                $page = $reqData["page"];
                $pagesize = $reqData['pagesize'];
            }catch (Exception $_) {
                $page = 1;
                $pagesize = 10;
            }
            $modelRes = PermissionModel::getAllPermission($page,$pagesize);
            if ($modelRes['code'] == GlobalResponse::$DATABASE_ERROR_CODE) {
                return response()->json([
                    "code"=>GlobalResponse::$HTTP_DATABASE_ERROR_CODE,
                    "message"=>GlobalResponse::$DATABASE_ERROR_MES
                ]);
            }
            return response()->json([
                "code"=>GlobalResponse::$HTTP_STATUS_OK_CODE,
                "message"=>GlobalResponse::HTTP_STATUS_OK_MES,
                "data"=>[ 
                    'data'=>$modelRes['data'],
                    'count'=>$modelRes['count']
                    ]
            ]);
        }


        public function getSystemAllMenu() {
            $model = new PermissionModel();
            $modelRes = $model::getSystemAllPermission(1);
            if ($modelRes['code'] == GlobalResponse::$DATABASE_ERROR_CODE){
                return response()->json([
                    "code"=>GlobalResponse::$HTTP_DATABASE_ERROR_CODE,
                    "message"=>GlobalResponse::$DATABASE_ERROR_MES
                ]);
            }else{
                return response()->json([
                    'code'=>GlobalResponse::$HTTP_STATUS_OK_CODE,
                    "message"=>GlobalResponse::HTTP_STATUS_OK_MES,
                    "data"=>$modelRes['data']
                ]);
            }
        }

        public function getSystemAllPermission() {
            $model = new PermissionModel();
            $modelRes = $model::getSystemAllPermission(0);
            if ($modelRes['code'] == GlobalResponse::$DATABASE_ERROR_CODE){
                return response()->json([
                    "code"=>GlobalResponse::$HTTP_DATABASE_ERROR_CODE,
                    "message"=>GlobalResponse::$DATABASE_ERROR_MES
                ]);
            }else{
                return response()->json([
                    'code'=>GlobalResponse::$HTTP_STATUS_OK_CODE,
                    "message"=>GlobalResponse::HTTP_STATUS_OK_MES,
                    "data"=>$modelRes['data']
                ]);
            }
        }


        public function getPermissionById(Request $req) {
            $reqData = $req->json()->all();
            try {
                $id = $reqData["id"];
                $modelRes = PermissionModel::getPermissionById($id);
                if ($modelRes["code"] == GlobalResponse::$DATABASE_ERROR_CODE) {
                    return response()->json([
                        "code"=>GlobalResponse::$HTTP_DATABASE_ERROR_CODE,
                        "message"=>GlobalResponse::$DATABASE_ERROR_MES
                    ]);
                }
                return response()->json([
                    "code"=>GlobalResponse::$HTTP_STATUS_OK_CODE,
                    "message"=>GlobalResponse::HTTP_STATUS_OK_MES,
                    "data"=>$modelRes["data"]
                ]);
            }catch(Exception $e) {
                return response()->json([
                    "code"=>GlobalResponse::$HTTP_REQUEST_ERROR_CODE,
                    "message"=>GlobalResponse::$HTTP_REQUEST_ERROR_MES
                ]);
            }
        }

        public function searchPermission(Request $req){
            $reqData =  $req->json()->all();
            try {
                $page = $reqData["page"];
                $pagesize = $reqData["pagesize"];
                $name = $reqData['name'] ?? "";
            } catch (Exception $_) {
                $page = 1;
                $pagesize = 10;
                $name = $reqData['name'] ?? "";
            }
            $modelRes = PermissionModel::searchPermissionByName($name, $page, $pagesize);
            if ($modelRes['code'] == GlobalResponse::$DATABASE_SUCCESS_CODE)
                return response()->json([
                    "code" => GlobalResponse::$HTTP_STATUS_OK_CODE,
                    "message" => GlobalResponse::HTTP_STATUS_OK_MES,
                    "data" => [
                        "data"=>$modelRes['data'],
                        "count"=>$modelRes['count'][0]->count
                    ]
                ]);
            else {
                return response()->json([
                    "code" => GlobalResponse::$HTTP_DATABASE_ERROR_CODE,
                    "message" => GlobalResponse::$DATABASE_ERROR_MES,
                    "data" => null
                ]);
            }
        }

        public function getPermissionsByRoleId(Request $req) {
            $reqData = $req->json()->all();
            try {
                $role_id = $reqData['role_id'];
            }catch (Exception $e) {
                return response()->json([
                    "code"=>GlobalResponse::$HTTP_REQUEST_ERROR_CODE,
                    "message"=>GlobalResponse::$HTTP_REQUEST_ERROR_MES
                ]);
            }
            $modelRes = PermissionModel::getPermissionsByRoleId($role_id);
            if ($modelRes['code'] == GlobalResponse::$DATABASE_ERROR_CODE) {
                return response()->json([
                    "code"=>GlobalResponse::$HTTP_DATABASE_ERROR_CODE,
                    "message"=>GlobalResponse::$DATABASE_ERROR_MES
                ]);
            }
            return response()->json([
                "code"=>GlobalResponse::$HTTP_STATUS_OK_CODE,
                "message"=>GlobalResponse::HTTP_STATUS_OK_MES,
                'data'=>$modelRes["data"]
            ]);
        }

        public function grantPermission2Role(Request $req){
            $reqData = $req->json()->all();
            try {
                $role_id = $reqData['role_id'];
                $permission_id = $reqData['permission_id'];
            }catch (Exception $_) {
                return response()->json([
                    "code"=>GlobalResponse::$HTTP_REQUEST_ERROR_CODE,
                    "message"=>GlobalResponse::$HTTP_REQUEST_ERROR_MES
                ]);
            }
            $value = ["c_role_id"=>$role_id,"c_permission_id"=>$permission_id];
            $modelRes = PermissionModel::grantPermission2Role($role_id,$value);
            if ($modelRes['code'] == GlobalResponse::$DATABASE_ERROR_CODE) {
                return response()->json([
                    "code"=>GlobalResponse::$HTTP_DATABASE_ERROR_CODE,
                    "message"=>GlobalResponse::$DATABASE_ERROR_MES
                ]);
            }
            return response()->json([
                "code"=>GlobalResponse::$HTTP_STATUS_OK_CODE,
                "message"=>GlobalResponse::HTTP_STATUS_OK_MES
            ]);
        }


        public function revokePermissionFromRole(Request $req){
            $reqData = $req->json()->all();
            try {
                $role_id = $reqData['role_id'];
                $permission_id = $reqData['permission_id'];
            }catch (Exception $_) {
                return response()->json([
                    "code"=>GlobalResponse::$HTTP_REQUEST_ERROR_CODE,
                    "message"=>GlobalResponse::$HTTP_REQUEST_ERROR_MES
                ]);
            }
            $modelRes = PermissionModel::revokePermissionFromRole($role_id,$permission_id);
            if ($modelRes['code'] == GlobalResponse::$DATABASE_ERROR_CODE) {
                return response()->json([
                    "code"=>GlobalResponse::$HTTP_DATABASE_ERROR_CODE,
                    "message"=>GlobalResponse::$DATABASE_ERROR_MES
                ]);
            }
            return response()->json([
                "code"=>GlobalResponse::$HTTP_STATUS_OK_CODE,
                "message"=>GlobalResponse::HTTP_STATUS_OK_MES
            ]);
        }

        public function newPermission(Request $req) {
            $reqData = $req->json()->all();
            try {
                $newModelData = $reqData["data"];
            }catch (Exception $_) {
                return response()->json([
                    "code"=>GlobalResponse::$HTTP_REQUEST_ERROR_CODE,
                    "message"=>GlobalResponse::$HTTP_REQUEST_ERROR_MES
                ]); 
            }
            $modelRes = PermissionModel::insertNewPermission($newModelData);
            if ($modelRes['code'] == GlobalResponse::$DATABASE_ERROR_CODE) {
                return response()->json([
                    "code"=>GlobalResponse::$HTTP_DATABASE_ERROR_CODE,
                    "message"=>GlobalResponse::$DATABASE_ERROR_MES
                ]);
            }
            return response()->json([
                "code"=>GlobalResponse::$HTTP_STATUS_OK_CODE,
                "message"=>GlobalResponse::HTTP_STATUS_OK_MES
            ]);
        }


        public function updatePermission(Request $req) {
            $reqData = $req->json()->all();
            try {
                $data = $reqData['data'];
                $id = $reqData['id'];
            }catch(Exception $e) {
                return response()->json([
                    "code"=>GlobalResponse::$HTTP_REQUEST_ERROR_CODE,
                    "message"=>GlobalResponse::$HTTP_REQUEST_ERROR_MES
                ]);
            }
            $modelRes = PermissionModel::updatePermission($id,$data);
            if ($modelRes['code'] == GlobalResponse::$DATABASE_ERROR_CODE) {
                return response()->json([
                    "code"=>GlobalResponse::$HTTP_DATABASE_ERROR_CODE,
                    "message"=>GlobalResponse::$DATABASE_ERROR_MES
                ]);
            }
            return response()->json([
                "code"=>GlobalResponse::$HTTP_STATUS_OK_CODE,
                "message"=>GlobalResponse::HTTP_STATUS_OK_MES
            ]);
        }


        public function deletePermission(Request $req) {
            $reqData = $req->json()->all();
            try {
                $id = $reqData["id"];
            }catch (Exception $e) {
                return response()->json([
                    "code"=>GlobalResponse::$HTTP_REQUEST_ERROR_CODE,
                    "message"=>GlobalResponse::$HTTP_REQUEST_ERROR_MES
                ]);
            }
            $modelRes = PermissionModel::deletePermission($id);
            if ($modelRes['code'] == GlobalResponse::$DATABASE_ERROR_CODE) {
                return response()->json([
                    "code"=>GlobalResponse::$HTTP_DATABASE_ERROR_CODE,
                    "message"=>GlobalResponse::$DATABASE_ERROR_MES
                ]);
            }
            return response()->json([
                "code"=>GlobalResponse::$HTTP_STATUS_OK_CODE,
                "message"=>GlobalResponse::HTTP_STATUS_OK_MES
            ]);
        } 
    } 
?>