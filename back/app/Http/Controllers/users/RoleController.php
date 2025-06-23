<?php

    namespace App\Http\Controllers\Users;

    use App\Http\Controllers\Controller;
    use App\Models\RoleModel;
use App\Utils\GlobalResponse;

    class RoleController extends Controller {

        public function getAllRole() {
            $modelRes = RoleModel::getAllRole();
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
    }


?>