<?php

namespace App\Http\Controllers;

use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Foundation\Bus\DispatchesJobs;
use Illuminate\Foundation\Validation\ValidatesRequests;
use Illuminate\Routing\Controller as BaseController;

class Controller extends BaseController
{
    use AuthorizesRequests, DispatchesJobs, ValidatesRequests;

    /**
     * 统一返回值
     * @param $code int 响应编码
     * @param $messsage string 返回信息 success ...
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
}
