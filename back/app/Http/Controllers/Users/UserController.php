<?php

    namespace App\Http\Controllers\Users;

    use App\Http\Controllers\Controller;
    use Illuminate\Http\Request;
    use App\Models\Users\UserModel;
    use App\Models\Users\RoleModel;
    use App\Utils\GlobalResponse;
    use App\Utils\JWTControll;
    use Exception;
    use Illuminate\Support\Facades\Cache;
    use Illuminate\Support\Facades\Log;
    use Ramsey\Uuid\Uuid;
    use Illuminate\Support\Facades\Redis;

    class UserController extends Controller{
        public function getAllUser(Request $req){
            $reqData =  $req->json()->all();
            try {
                $page = $reqData["page"];
                $pagesize = $reqData["pagesize"];
            } catch (Exception $_) {
                $page = 1;
                $pagesize = 10;
            }
            $modelRes = UserModel::getAllUser($page, $pagesize);
            if ($modelRes['code'] == GlobalResponse::$DATABASE_SUCCESS_CODE)
                return response()->json([
                    "code" => GlobalResponse::$HTTP_STATUS_OK_CODE,
                    "message" => GlobalResponse::HTTP_STATUS_OK_MES,
                    "data" =>[
                        'data' =>$modelRes['data'],
                        'count'=> $modelRes['count']
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

        public function convert2Excel(Request $req) {
            $reqData = $req->json()->all();
            try {
                $page = $reqData['page'] ?? -1;
                $pagesize = $reqData['pagesize'] ?? 10;
            }catch(Exception $e) {
                $page = -1;
                $pagesize = 10;
            }
            $modelAllRes = UserModel::getAllUser($page,$pagesize);
            $modelRes = UserModel::getUser2Role( $page, $pagesize);
            if ($modelRes['code'] == GlobalResponse::$DATABASE_SUCCESS_CODE && $modelAllRes['code'] == GlobalResponse::$DATABASE_SUCCESS_CODE)
                return response()->json([
                    "code" => GlobalResponse::$HTTP_STATUS_OK_CODE,
                    "message" => GlobalResponse::HTTP_STATUS_OK_MES,
                    "data" => [
                        "all_user" => [
                            "data" =>$modelAllRes['data'],
                            "count"=> $modelAllRes["count"]
                        ],
                        "user_role"=> [
                            "count"=> $modelRes["count"],
                            "data" => $modelRes['data'],
                        ], 
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

        public function searchUser(Request $req){
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
            $modelRes = UserModel::searchUserByName($name, $page, $pagesize);
            if ($modelRes['code'] == GlobalResponse::$DATABASE_SUCCESS_CODE)
                return response()->json([
                    "code" => GlobalResponse::$HTTP_STATUS_OK_CODE,
                    "message" => GlobalResponse::HTTP_STATUS_OK_MES,
                    "data" => [
                        "data" =>$modelRes['data'],
                        "count"=>$modelRes["count"]
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


        public function getUserById(Request $req){
            $reqData =  $req->json()->all();
            try {
                $id = $reqData["id"];
            } catch (Exception $_) {
                return response()->json([
                    'code' => GlobalResponse::$HTTP_REQUEST_ERROR_CODE,
                    "message" => GlobalResponse::$HTTP_REQUEST_ERROR_MES
                ]);
            }
            $modelRes = UserModel::getUserById($id);
            $role = RoleModel::getUserRole($id);
            if ($modelRes['code'] == GlobalResponse::$DATABASE_SUCCESS_CODE && $role['code'] == GlobalResponse::$DATABASE_SUCCESS_CODE){
                $modelRes['data']->role = array_map(function ($item) {return $item->c_id;},$role["data"]);
                return response()->json([
                    "code" => GlobalResponse::$HTTP_STATUS_OK_CODE,
                    "message" => GlobalResponse::HTTP_STATUS_OK_MES,
                    "data" => $modelRes['data']
                ]);
            }
            else {
                return response()->json([
                    "code" => GlobalResponse::$HTTP_DATABASE_ERROR_CODE,
                    "message" => GlobalResponse::$DATABASE_ERROR_MES,
                    "data" => null
                ]);
            }
        }


        public function login(Request $req){
            $reqData = $req->json()->all();
            try {
                $username = $reqData["username"];
                $pwd = $reqData["password"];
            } catch (Exception $_) {
                return response()->json([
                    'code' => GlobalResponse::$HTTP_REQUEST_ERROR_CODE,
                    "message" => GlobalResponse::$HTTP_REQUEST_ERROR_MES
                ]);
            }
            $modelRes = UserModel::getUserByName($username);
            if ($modelRes["code"] == GlobalResponse::$DATABASE_ERROR_CODE) {
                return [
                    "code" => GlobalResponse::$HTTP_DATABASE_ERROR_CODE,
                    "message" => GlobalResponse::$DATABASE_ERROR_MES,
                ];
            }
            $user = $modelRes["data"];
            if ($user->c_password != $pwd) {
                return response()->json([
                    "code" => GlobalResponse::$USER_LOGIN_ERROR_CODE,
                    "message" => GlobalResponse::$USER_LOGIN_FAILED_MES,
                ]);
            }
            if ($user->c_is_login == 0) {
                return response()->json([
                    "code"=>GlobalResponse::$USER_IS_DEL_CODE,
                    "message"=>GlobalResponse::$USER_LOGIN_IS_DEL_MES
                ]);
            }
            $permissionRes = UserModel::getUserPrimissions($user->c_username);
            $role = RoleModel::getUserRole($user->c_username);
            if ($permissionRes['code'] == GlobalResponse::$DATABASE_ERROR_CODE) {
                return response()->json([
                    "code" => GlobalResponse::$USER_LOGIN_ERROR_CODE,
                    "message" => GlobalResponse::$USER_LOGIN_FAILED_MES,
                ]);
            }
            $user_login_key = Uuid::uuid4()->toString();
            Cache::put($user_login_key,$permissionRes["data"],now()->addHours(5));
            $permissions = array_map(function ($item) {
                return $item->c_id ;
            }, $permissionRes["data"]);
            $jwtRes = JWTControll::encodeJWT([
                "id" => $user->c_username,
                "permission" => $user_login_key
            ]);
            if ($jwtRes["err"] != null) {
                return response()->json([
                    "code" => GlobalResponse::$USER_LOGIN_ERROR_CODE,
                    "message" => GlobalResponse::$USER_LOGIN_FAILED_MES,
                ]);
            }
            UserModel::updateUserLastLogin($user->c_username);
            $new_user = [
                "c_username"=>$user->c_username,
                "c_email"=>$user->c_email
            ];
            return response()->json([
                "code" => GlobalResponse::$HTTP_STATUS_OK_CODE,
                "message" => GlobalResponse::$USER_LOGIN_SUCCESS_MES,
                "data" => [
                    "token" => $jwtRes['token'],
                    "user" => $new_user,
                    "role"=> array_map(function ($item) {return $item->c_id;},$role["data"]),
                    "permissions"=> $permissions
                ]
            ]);
        }


        public function insertNewUser(Request $req){
            $reqData = $req->json()->all();
            try {
                $data = $reqData["data"];
            } catch (Exception $_) {
                return response()->json([
                    'code' => GlobalResponse::$HTTP_REQUEST_ERROR_CODE,
                    "message" => GlobalResponse::$HTTP_REQUEST_ERROR_MES
                ]);
            }
            $modelRes = UserModel::insertNewUser($data);
            if ($modelRes['code'] == GlobalResponse::$DATABASE_SUCCESS_CODE)
                return response()->json([
                    "code" => GlobalResponse::$HTTP_STATUS_OK_CODE,
                    "message" => GlobalResponse::HTTP_STATUS_OK_MES
                ]);
            else {
                return response()->json([
                    "code" => GlobalResponse::$HTTP_DATABASE_ERROR_CODE,
                    "message" => GlobalResponse::$DATABASE_ERROR_MES
                ]);
            }
        }


        public function batchImportUsers(Request $req) {
            $reqData =  $req->json()->all();
            try {
                $users  = $reqData['users'];
                $modelRes = UserModel::batchAddUsers($users);
                if ($modelRes['code'] == GlobalResponse::$DATABASE_SUCCESS_CODE) {
                    return response()->json([
                        'code'=>GlobalResponse::$HTTP_STATUS_OK_CODE,
                        "message"=>GlobalResponse::HTTP_STATUS_OK_MES,
                        "data" => $modelRes['data']
                    ]);
                }else{
                    return response()->json([
                        "code" => GlobalResponse::$HTTP_DATABASE_ERROR_CODE,
                        "message" => GlobalResponse::$DATABASE_ERROR_MES
                    ]);
                }
            }catch(Exception $e) {
                return response()->json([
                    'code' => GlobalResponse::$HTTP_REQUEST_ERROR_CODE,
                    "message" => GlobalResponse::$HTTP_REQUEST_ERROR_MES
                ]);
            }
        }

        public function updateUserPassword(Request $req){
            $reqData = $req->json()->all();
            $token_data  = $req->input("token_data");
            try {
                $id = $reqData["id"];
                $data = $reqData["data"];
                $oldPassword = $data["oldPassword"];
                $newPassword = $data['newPassword'];
            } catch (Exception $e) {
                Log::info($e->getMessage());
                return response()->json([
                    'code' => GlobalResponse::$HTTP_REQUEST_ERROR_CODE,
                    "message" => GlobalResponse::$HTTP_REQUEST_ERROR_MES
                ]);
            }
            if ($token_data['id'] != $id && !in_array("support_user",$token_data["permission"])){
                return response()->json([
                    "code"=>GlobalResponse::$HTTP_STATUS_ERROR_CODE,
                    "message"=> GlobalResponse::$HTTP_USER_NOT_RIGHT_MES
                ]);
            }
            $user = UserModel::getUserById($id);
            if ($user["code"] == GlobalResponse::$DATABASE_ERROR_CODE) {
                return response()->json([
                    "code" => GlobalResponse::$HTTP_DATABASE_ERROR_CODE,
                    "message" => GlobalResponse::$DATABASE_ERROR_MES
                ]);
            }
            if ($user["data"]->c_password != $oldPassword) {
                return response()->json([
                    "code" => GlobalResponse::$HTTP_REQUEST_ERROR_CODE,
                    "message" => "旧密码错误"
                ]);
            }
            $modelRes = UserModel::updateUserPasswordById($id, $newPassword);
            if ($modelRes['code'] == GlobalResponse::$DATABASE_SUCCESS_CODE)
                return response()->json([
                    "code" => GlobalResponse::$HTTP_STATUS_OK_CODE,
                    "message" => GlobalResponse::HTTP_STATUS_OK_MES
                ]);
            else {
                return response()->json([
                    "code" => GlobalResponse::$HTTP_DATABASE_ERROR_CODE,
                    "message" => GlobalResponse::$DATABASE_ERROR_MES
                ]);
            }
        }

        public function updateCommonUser (Request $req) {
            $reqData = $req->json()->all();
            $token_data  = $req->input("token_data");
            try {
                $id = $reqData["id"];
                $data = $reqData["data"];
            } catch (Exception $_) {
                return response()->json([
                    'code' => GlobalResponse::$HTTP_REQUEST_ERROR_CODE,
                    "message" => GlobalResponse::$HTTP_REQUEST_ERROR_MES
                ]);
            }
            if ($id != $token_data['id']) {
                return response()->json([
                    "code" => GlobalResponse::$HTTP_DATABASE_ERROR_CODE,
                    "message" => GlobalResponse::$DATABASE_ERROR_MES
                ]);
            }
            $modelRes = UserModel::updateUserCommonById($id, $data);
            if ($modelRes['code'] == GlobalResponse::$DATABASE_SUCCESS_CODE)
                return response()->json([
                    "code" => GlobalResponse::$HTTP_STATUS_OK_CODE,
                    "message" => GlobalResponse::HTTP_STATUS_OK_MES
                ]);
            else {
                return response()->json([
                    "code" => GlobalResponse::$HTTP_DATABASE_ERROR_CODE,
                    "message" => GlobalResponse::$DATABASE_ERROR_MES
                ]);
            }
        }


        public function updateUserInfo(Request $req){
            $reqData = $req->json()->all();
            try {
                $id = $reqData["id"];
                $data = $reqData["data"];
            } catch (Exception $_) {
                return response()->json([
                    'code' => GlobalResponse::$HTTP_REQUEST_ERROR_CODE,
                    "message" => GlobalResponse::$HTTP_REQUEST_ERROR_MES
                ]);
            }
            $modelRes = UserModel::updateUserById($id, $data);
            if ($modelRes['code'] == GlobalResponse::$DATABASE_SUCCESS_CODE)
                return response()->json([
                    "code" => GlobalResponse::$HTTP_STATUS_OK_CODE,
                    "message" => GlobalResponse::HTTP_STATUS_OK_MES
                ]);
            else {
                return response()->json([
                    "code" => GlobalResponse::$HTTP_DATABASE_ERROR_CODE,
                    "message" => GlobalResponse::$DATABASE_ERROR_MES
                ]);
            }
        }


        public function deleteUser(Request $req){
            $reqData = $req->json()->all();
            try {
                $id = $reqData["id"];
            } catch (Exception $_) {
                return response()->json([
                    'code' => GlobalResponse::$HTTP_REQUEST_ERROR_CODE,
                    "message" => GlobalResponse::$HTTP_REQUEST_ERROR_MES
                ]);
            }
            $modelRes = UserModel::deleteUserById($id);
            if ($modelRes['code'] == GlobalResponse::$DATABASE_SUCCESS_CODE)
                return response()->json([
                    "code" => GlobalResponse::$HTTP_STATUS_OK_CODE,
                    "message" => GlobalResponse::HTTP_STATUS_OK_MES
                ]);
            else {
                return response()->json([
                    "code" => GlobalResponse::$HTTP_DATABASE_ERROR_CODE,
                    "message" => GlobalResponse::$DATABASE_ERROR_MES
                ]);
            }
        }
    }
?>
