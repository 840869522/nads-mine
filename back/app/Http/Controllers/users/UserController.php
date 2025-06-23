<?php

    namespace App\Http\Controllers\Users;

    use App\Http\Controllers\Controller;
    use Illuminate\Http\Request;
    use App\Models\UserModel;
    use App\Utils\GlobalResponse;
    use App\Utils\JWTControll;
    use Exception;

    class UserController extends Controller{

        public function getAllUser() {
            $res = UserModel::getAllUser();
            if ($res['code'] == GlobalResponse::$DATABASE_SUCCESS_CODE)
                return response()->json([
                    "code" => GlobalResponse::$HTTP_STATUS_OK_CODE,
                    "mes" => GlobalResponse::HTTP_STATUS_OK_MES,
                    "data" => $res['data'] 
                ]);
            else{
                return response()->json([
                    "code" => GlobalResponse::$HTTP_DATABASE_ERROR_CODE,
                    "mes" => GlobalResponse::$DATABASE_ERROR_MES,
                    "data" => null
                ]);
            }
        }
        
        public function login(Request $req) {
            $reqData = $req->json()->all();
            try {
                $username = $reqData["username"];
                $pwd = $reqData["password"];
            }catch(Exception $e) {
                return response()->json([
                    'code'=>GlobalResponse::$HTTP_REQUEST_ERROR_CODE,
                    "message"=>GlobalResponse::$HTTP_REQUEST_ERROR_MES
                ]);
            }
            $modelRes = UserModel::getUserByName($reqData['username']);
            if ($modelRes["code"] == GlobalResponse::$DATABASE_ERROR_CODE) {
                return [
                    "code"=>GlobalResponse::$HTTP_DATABASE_ERROR_CODE,
                    "message"=>GlobalResponse::$DATABASE_ERROR_MES,
                ];
            }
            $user = $modelRes["data"];
            if ($user->password != $reqData["password"]){
                return response()->json([
                    "code"=>GlobalResponse::$USER_LOGIN_ERROR_CODE,
                    "message"=>GlobalResponse::$USER_LOGIN_FAILED_MES,
                ]);
            }
            $primissions = UserModel::getUserPrimissions($user->id);
            $jwtRes = JWTControll::encodeJWT([
                "id" => $user->id,
                "role" => $user->role_id,
                "permission" => array_map(function($item){return $item->name;},$primissions["data"])
            ]);
            if ($jwtRes["err"] != null) {
                return response()->json([
                    "code"=>GlobalResponse::$USER_LOGIN_ERROR_CODE,
                    "message"=>GlobalResponse::$USER_LOGIN_FAILED_MES,
                ]);
            }
            return response()->json([
                "code"=>GlobalResponse::$HTTP_STATUS_OK_CODE,
                "message"=>GlobalResponse::$USER_LOGIN_SUCCESS_MES,
                "data"=>[
                    "token"=>$jwtRes['token'],
                    "id"=> $user->id
                ]
            ]);
        }

        public function updateUserPassword(Request $req) {
            
        }

        public function updateUserInfo(Request $req) {

        }

    }
?>
