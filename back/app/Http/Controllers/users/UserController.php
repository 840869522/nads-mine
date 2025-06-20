<?php

    namespace App\Http\Controllers\users;

    use App\Http\Controllers\Controller;
    use Illuminate\Http\Request;
    use Illuminate\Support\Facades\Validator;
    use App\Models\User;


    class UserController extends Controller{
        public function test() {
            $res = User::getAllUser();
            if ($res['code'] == 200)
                return response()->json([
                    "code" => 200,
                    "mes" => "success",
                    "data" => $res['data']
                ]);
            else{
                return response()->json([
                    "code" => 200,
                    "mes" => "success",
                    "data" => null
                ]);
            }
        }
        
        public function login(Request $req) {
            $reqData = $req->json()->all();

            return response()->json([
                "code"=>200,
                "message"=>"success",
                "data"=>$reqData
            ]);
        }

        public function updateUserPassword(Request $req) {
            
        }

        public function updateUserInfo(Request $req) {

        }

    }
?>
