<?php
    namespace App\Http\Controllers\Users;

    use App\Http\Controllers\Controller;
    use App\Models\PrimissionModel;
    use App\Utils\GlobalResponse;
    use Exception;
    use Illuminate\Http\Request;

    class PrimissionController extends Controller {

        public function getAllPrimission() {
            $modelRes = PrimissionModel::getAllPrimission();
            if ($modelRes['code'] == GlobalResponse::$DATABASE_ERROR_CODE) {
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


        public function getPrimissionById(Request $res) {
            $reqData = $res->json()->all();
            try {
                $id = $reqData["id"];
                $modelRes = PrimissionModel::getPrimissionById($id);
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
    } 
?>