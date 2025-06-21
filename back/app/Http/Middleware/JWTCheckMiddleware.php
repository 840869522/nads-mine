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
     * @param  \Closure(\Illuminate\Http\Request): (\Illuminate\Http\Response|\Illuminate\Http\RedirectResponse)  $next
     * @return \Illuminate\Http\Response|\Illuminate\Http\RedirectResponse
     */
    public function handle(Request $request, Closure $next){
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
        return $next($request);
    }
}
