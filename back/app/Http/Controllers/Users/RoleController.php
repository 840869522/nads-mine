<?php

    namespace App\Http\Controllers\Users;

    use App\Http\Controllers\Controller;
    use App\Models\Users\RoleModel;
    use App\Utils\GlobalResponse;
    use Illuminate\Http\Request;
    use Exception;

    class RoleController extends Controller {


        public function getAllRole(Request $req) {
            $reqData = $req->json()->all();
            try {
                $page = $reqData["page"];
                $pagesize = $reqData["pagesize"];
            }catch (Exception $_) {
                $page = 1;
                $pagesize = 10;
            }
            $modelRes = RoleModel::getAllRole($page,$pagesize);
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


        public function getRoleById (Request $req)  {
            $reqData = $req->json()->all();
            try {
                $id = $reqData['id'];
            }catch (Exception $_) {
                return response()->json([
                    "code"=>GlobalResponse::$HTTP_REQUEST_ERROR_CODE,
                    "message"=>GlobalResponse::$HTTP_REQUEST_ERROR_MES
                ]);
            }
            $modelRes = RoleModel::getRoleById($id);
            if ($modelRes['code']== GlobalResponse::$DATABASE_ERROR_CODE) {
                return response()->json([
                    "code"=>GlobalResponse::$HTTP_DATABASE_ERROR_CODE,
                    "message"=>GlobalResponse::$DATABASE_ERROR_MES
                ]);
            }
            return response()->json([
                "code"=>GlobalResponse::$HTTP_STATUS_OK_CODE,
                "message"=>GlobalResponse::HTTP_STATUS_OK_MES,
                "data"=>$modelRes['data']
            ]);
        }

        public function searchRole(Request $req){
            $reqData =  $req->json()->all();
            try {
                $page = $reqData["page"];
                $pagesize = $reqData["pagesize"];
                $name = $reqData['name'];
            } catch (Exception $_) {
                $page = 1;
                $pagesize = 10;
                $name = $reqData['name'] ?? "";
            }
            $modelRes = RoleModel::searchRoleByName($name, $page, $pagesize);
            if ($modelRes['code'] == GlobalResponse::$DATABASE_SUCCESS_CODE)
                return response()->json([
                    "code" => GlobalResponse::$HTTP_STATUS_OK_CODE,
                    "message" => GlobalResponse::HTTP_STATUS_OK_MES,
                    "data" => [
                        "data"=>$modelRes['data'], 
                        "count"=> $modelRes["count"]
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

        public function grantRoles2User(Request $req){
            $reqData = $req->json()->all();
            try {
                $role_id = $reqData['role_id'];
                $user_id = $reqData['user_id'];
            }catch (Exception $_) {
                return response()->json([
                    "code"=>GlobalResponse::$HTTP_REQUEST_ERROR_CODE,
                    "message"=>GlobalResponse::$HTTP_REQUEST_ERROR_MES
                ]);
            }
            $modelRes = RoleModel::grantRole2User($user_id,["c_user_id"=>$user_id,"c_role_id"=>$role_id]);
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


        public function revokeRoleFromUser(Request $req){
            $reqData = $req->json()->all();
            try {
                $role_id = $reqData['role_id'];
                $user_id = $reqData['user_id'];
            }catch (Exception $_) {
                return response()->json([
                    "code"=>GlobalResponse::$HTTP_REQUEST_ERROR_CODE,
                    "message"=>GlobalResponse::$HTTP_REQUEST_ERROR_MES
                ]);
            }
            $modelRes = RoleModel::revokeRoleFromUser($role_id,$user_id);
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

        public function newRole(Request $req) {
            $reqData = $req->json()->all();
            try {
                $newModelData = $reqData["data"];
            }catch (Exception $_) {
                return response()->json([
                    "code"=>GlobalResponse::$HTTP_REQUEST_ERROR_CODE,
                    "message"=>GlobalResponse::$HTTP_REQUEST_ERROR_MES
                ]); 
            }
            $modelRes = RoleModel::insertNewRole($newModelData);
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


        public function updateRole(Request $req) {
            $reqData = $req->json()->all();
            try {
                $data = $reqData["data"];
                $id = $reqData['id'];
            }catch (Exception $_) {
                return [
                    "code"=>GlobalResponse::$HTTP_REQUEST_ERROR_CODE,
                    "message"=>GlobalResponse::$HTTP_REQUEST_ERROR_MES
                ];
            }
            $modelRes = RoleModel::updateRoleById($id,$data);
            if ($modelRes['code']== GlobalResponse::$DATABASE_ERROR_CODE) {
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


        public function deleteRole(Request $req) {
            $reqData = $req->json()->all();
            try {
                $id = $reqData["id"];
            }catch (Exception $_) {
                return [
                    "code"=>GlobalResponse::$HTTP_REQUEST_ERROR_CODE,
                    "message"=>GlobalResponse::$HTTP_REQUEST_ERROR_MES
                ];
            }
            $modelRes = RoleModel::deleteRoleById($id);
            if ($modelRes['code']== GlobalResponse::$DATABASE_ERROR_CODE) {
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