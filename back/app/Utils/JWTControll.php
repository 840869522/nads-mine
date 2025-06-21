<?php

    namespace App\Utils;

    use Firebase\JWT\JWT;
    use Firebase\JWT\Key;
    use Illuminate\Support\Facades\Log;

    /**
     * 定义JWT 生成和解析函数
     */
    class JWTControll{
        /**
         * 根据给出的data 数据和 exp_time 过期时间，生成 jwt token 返回值包含token以及错误代码
         *
         * @param [any] $data
         * @param [int] $exp_time 有效时间 默认为18000秒即为5小时
         * @return ["token"=>string,"err_code"=>int]
         */
        public static function encodeJWT(?array $data, int $exp_time = 18000, string $algo = "HS256"): array
        {
            $issuedAt = time();
            $secretKey = env("JWT-SECRET-KEY", "default-secret-key");
            $payload = array_merge([
                "iat" => $issuedAt,
                /** 签发时间 */
                "exp" => $exp_time,
                /** 有效时间 */
                'nbf' => $issuedAt
                /** 生效时间 */
            ], $data);

            $token = JWT::encode($payload, $secretKey, $algo);

            return [
                "token" => $token,
                "err" => null
            ];
        }

        /**
         * 验证 JWT
         *
         * @param string $token JWT令牌
         * @param string $secret 密钥
         * @param string $algo 加密算法，默认为 HS256
         * @return array
         */
        public static function decodeJWT(?string $token, string $algo = 'HS256'):?array {
            if( $token === null){
                return [
                    "data"=> null,
                    "err" => "Invalid JWT token"
                ];
            }
            $secretKey = env("JWT-SECRET-KEY", "default-secret-key");
            try {
                $data = JWT::decode($token, new Key($secretKey, $algo));
                return [
                    "data" => (array) $data,
                    "err" => null
                ];
            } catch (\Exception $e) {
                return [
                    "err" => $e->getMessage(),
                    "data" => null
                ];
            }
        }
    }
?>
