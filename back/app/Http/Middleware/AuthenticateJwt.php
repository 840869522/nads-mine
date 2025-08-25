<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use App\Utils\JWTControll;
use App\Utils\GlobalResponse;
use App\Models\Users\UserModel; // 导入UserModel以获取用户信息

class AuthenticateJwt
{
    /**
     * 处理传入的请求。
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  \Closure(\Illuminate\Http\Request): (\Illuminate\Http\Response|\Illuminate\Http\RedirectResponse)  $next
     * @return \Illuminate\Http\Response|\Illuminate\Http\RedirectResponse
     */
    public function handle(Request $request, Closure $next)
    {
        // 1. 从请求头中获取 Authorization Token
        $token = $request->bearerToken(); // 获取 Bearer Token

        if (!$token) {
            return response()->json([
                'code' => GlobalResponse::$HTTP_TOKEN_ERROR_CODE,
                'message' => GlobalResponse::$HTTP_TOKEN_ERROR_MES
            ], 401); // 401 Unauthorized
        }

        // 2. 解码并验证 JWT Token
        $decodedToken = JWTControll::decodeJWT($token);

        if ($decodedToken['err'] !== null) {
            // Token 无效或过期
            return response()->json([
                'code' => GlobalResponse::$HTTP_TOKEN_ERROR_CODE,
                'message' => GlobalResponse::$HTTP_TOKEN_ERROR_MES // 或者更具体的错误消息 $decodedToken['err']
            ], 401); // 401 Unauthorized
        }

        $tokenData = $decodedToken['data'];

        // 3. 将解码后的用户信息（c_username 和 permissions）注入到请求中
        // 假设 tokenData['id'] 对应 c_username
        $request->attributes->set('token_data', $tokenData); // 使用 attributes 存储，便于后续控制器访问

        // 4. 可以选择性地验证用户是否存在于数据库（如果需要额外安全验证）
        // if (!UserModel::getUserById($tokenData['id'])) { // 假设 getUserById 接受 c_username
        //     return response()->json([
        //         'code' => GlobalResponse::$HTTP_NOT_AUTH_CODE,
        //         'message' => GlobalResponse::$HTTP_USER_NOT_RIGHT_MES
        //     ], 403); // 403 Forbidden
        // }

        // 继续处理请求
        return $next($request);
    }
}
