<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use App\Utils\GlobalResponse;
use App\Utils\JWTControll;

class JWTCheckMiddleware{
    /**
     * Handle an incoming request.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  \Closure(\Illuminate\Http\Request): (\Illuminate\Http\Response | \Illuminate\Http\RedirectResponse)  $next
     * @param  string $primission
     * @return \Illuminate\Http\Response | \Illuminate\Http\RedirectResponse
     */
    public function handle(Request $request, Closure $next, $primiision = null){
        $auth = $request->header("Authorization",null);
        $jwtRes =  JWTControll::decodeJWT($auth);
        if ($jwtRes["err"] != null) {
            return response()->json([
                "code"=> GlobalResponse::$HTTP_TOKEN_ERROR_CODE,
                "message"=>GlobalResponse::$HTTP_TOKEN_ERROR_MES
            ]);
        }
        $request->merge([
            "token_data"=>$jwtRes["data"]
        ]);
        if ($primiision){
            if (!in_array($primiision, $jwtRes["data"]["permission"])){
                return response()->json([
                    'code'=>GlobalResponse::$HTTP_NOT_AUTH_CODE,
                    "messaage"=>GlobalResponse::$HTTP_USER_NOT_RIGHT_MES
                ]);
            }
        }
        // $request->attributes->add([
        //     "user_permissions" =>$jwtRes["data"]["permission"],
        //     "user_roles" => $jwtRes['data']['role'],
        // ]);
        return $next($request);
    }
}
