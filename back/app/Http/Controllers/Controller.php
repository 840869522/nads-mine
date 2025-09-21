<?php

namespace App\Http\Controllers;

use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Foundation\Bus\DispatchesJobs;
use Illuminate\Foundation\Validation\ValidatesRequests;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller as BaseController;
use App\Utils\JWTControll;
use App\Utils\GlobalResponse;
use Illuminate\Support\Facades\Route;
use App\Models\Users\PermissionModel;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class Controller extends BaseController
{
    use AuthorizesRequests, DispatchesJobs, ValidatesRequests;

    public function __construct(Request $request){
        $action = Route::current()->getActionName();
        list($controller,$method) = explode("@",$action);
        $controllerName = class_basename($controller);
        $controllerName = $controllerName.".".$method;
       Log::info($controllerName);

        $res = PermissionModel::getPermissionByApi($controllerName);

        Log::info($res);
        if ($res['code'] == GlobalResponse::$DATABASE_SUCCESS_CODE) {
            if ($res['data']['found']){
                $auth = $request->header("Authorization",null);
                $jwtRes =  JWTControll::decodeJWT($auth);
                if ($jwtRes["err"] != null) {
                    response()->json([
                        "code"=> GlobalResponse::$HTTP_TOKEN_ERROR_CODE,
                        "message"=>GlobalResponse::$HTTP_TOKEN_ERROR_MES
                    ])->send();
                    exit();
                }
                $permissions = Cache::get($jwtRes["data"]["permission"]);
                $permissions = array_map(function ($item){
                    return $item->c_id;
                },$permissions);
                $jwtRes["data"]['permission'] = $permissions;
                $request->merge([
                    "token_data"=>$jwtRes["data"]
                ]);
                if ($res['data']['status']){
                    if (!in_array($res['data']['permission'], $jwtRes["data"]["permission"])){
                        response()->json([
                            'code'=>GlobalResponse::$HTTP_NOT_AUTH_CODE,
                            "message"=>GlobalResponse::$HTTP_USER_NOT_RIGHT_MES
                        ])->send();
                        exit();
                    }
                }
            }else {
                if (!in_array($controller, ['UserController.login', "PermissionController.all_menu", 'PmerissionController.all_permission'])) {
                    response()->json([
                        'code'=>GlobalResponse::$HTTP_NOT_AUTH_CODE,
                        "message"=>GlobalResponse::$HTTP_PERMISSION_NOT_FOUND
                    ])->send();
                    exit();
                }
            }
        }else{
            $this->_response(GlobalResponse::$HTTP_DATABASE_ERROR_CODE,GlobalResponse::$DATABASE_ERROR_MES)->send();
            exit();
        }
    }

    /**
     * 统一返回值
     * @param $code int 响应编码
     * @param $messsage string 返回信息 SUCCESS FAILED ...
     * @param $data array 返回数据
     * @author
     *@Date AM
     */
    public function _response($code='', $message=0, $data=[])
    {
        $this->set_header();

        $res = [
            'code'=> $code,
            'message'=> $message,
            'data'=> $data
        ];

        return response()->json($res);
    }

    public function set_header()
    {
        header('Access-Control-Allow-Origin:*');
        // 响应类型
        header('Access-Control-Allow-Methods:POST,GET,OPTION');
        // 带 cookie 的跨域访问
        header('Access-Control-Allow-Credentials: true');
        // 响应头设置
        header('Access-Control-Allow-Headers:x-requested-with,Content-Type,X-CSRF-Token');
    }

    public function _get_global_directory() {
        $directory =  env("GLOBAL_DIRECTORY",'/home/ubuntu/web');
        if (file_exists($directory) && is_dir($directory))
            return $directory;
        else {
            if (mkdir($directory,0775, true)){
                return $directory;
            }
        }
    }
}
