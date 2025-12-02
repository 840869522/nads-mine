<?php
    namespace App\Utils;

    /**
     * 全局状态码和响应信息定义
     */
    class GlobalResponse {
        /**
         * 全局响应状态码
         */
        public static int $HTTP_STATUS_OK_CODE  = 200;
        public static int $HTTP_STATUS_ERROR_CODE = 400;
        public static int $HTTP_REQUEST_ERROR_CODE  = 401;
        public static int $HTTP_DATABASE_ERROR_CODE  = 402;
        public static int $HTTP_STATUS_RE_CODE  = 403;
        public static int $HTTP_STATUS_NOTFOUND_CODE  = 404;
        public static int $HTTP_NOT_AUTH_CODE = 405;
        public static int $USER_IS_DEL_CODE  = 410;
        public static int $HTTP_TOKEN_ERROR_CODE  = 420;

        public static int $HTTP_SERVER_ERROR_CODE  = 500;

        public static int $DATABASE_ERROR_CODE  = 901;
        public static int $DATABASE_SUCCESS_CODE  = 900;

        public static int $USER_LOGIN_ERROR_CODE  = 844;

        /**
         * 全局响应信息
         */
        public const HTTP_STATUS_ERROR_MES  = "失败";
        public const HTTP_STATUS_OK_MES  = "成功";

        public static string $HTTP_TOKEN_ERROR_MES  = "token失效，请重新登录";
        public static string $HTTP_USER_NOT_RIGHT_MES  = "你没有相关操作的权限";
        public static string $HTTP_REQUEST_ERROR_MES  = "请求参数出错";
        public static string $DATABASE_ERROR_MES  = "数据库操作出错";
        public static string $USER_LOGIN_SUCCESS_MES  = self::HTTP_STATUS_OK_MES;
        public static string $USER_LOGIN_IS_DEL_MES  = "账户被限制，请联系系统管理员";
        public static string $USER_LOGIN_FAILED_MES  = self::HTTP_STATUS_ERROR_MES;
        public static string $HTTP_ROUTER_NOT_FOUND_MES  = "请求地址错误";
        public static string $HTTP_PERMISSION_NOT_FOUND = "权限未被添加";
    }
?>
