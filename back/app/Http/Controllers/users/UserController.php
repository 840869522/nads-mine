<?php

    namespace App\Http\Controllers\users;

    use App\Http\Controllers\Controller;
    use Illuminate\Http\Request;
    use Illuminate\Support\Facades\Validator;
    use App\Models\User;
    use App\Utils\GlobalResponse;


    class UserController extends Controller{
        public function test() {
            $res = User::getAllUser();
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

            return response()->json([
                "code"=>GlobalResponse::$HTTP_STATUS_OK_CODE,
                "message"=>GlobalResponse::HTTP_STATUS_OK_MES,
                "data"=>$reqData
            ]);
        }

        public function updateUserPassword(Request $req) {
            
        }

        public function updateUserInfo(Request $req) {

        }

    }
?>
