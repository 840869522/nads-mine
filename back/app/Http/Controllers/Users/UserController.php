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

        public function listAllForSelection()
        {
            try {
                $users = UserModel::query()
                    ->select('c_username as u_id', 'c_name as u_name')

                    // =========================================================================
                    // ★★★★★★★★★★★★★★★★★★★ 核心修复点 ★★★★★★★★★★★★★★★★★★★
                    // =========================================================================
                    // 我们暂时移除了 ->where('c_is_login', 1) 这个条件。
                    // 原因是这个条件可能过于严格，导致查询结果为空。
                    // 移除后，此接口将返回数据库中所有的用户，确保前端下拉框能获取到数据。
                    // 如果后续需要过滤掉某些用户（如：已禁用的用户），
                    // 你需要先确认数据库中代表“激活”状态的字段和它的确切值，然后再把 where 条件加回来。
                    // 例如: ->where('status', 'active') 或者 ->whereNotNull('activated_at') 等。

                    ->get();

                return response()->json([
                    'status' => 'success',
                    'data'   => $users,
                ]);

            } catch (\Exception $e) {
                Log::error('获取用户列表失败: ' . $e->getMessage());
                return response()->json([
                    'status'  => 'error',
                    'message' => '无法获取用户列表，请联系管理员。'
                ], 500);
            }
        }
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
