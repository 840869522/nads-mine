<?php
use Illuminate\Support\Facades\DB;

function udate($format = 'u', $utimestamp = null) {
    if (is_null($utimestamp))
        $utimestamp = microtime(true);

    $timestamp = floor($utimestamp);
    $milliseconds = round(($utimestamp - $timestamp) * 1000000);

    return date(preg_replace('`(?<!\\\\)u`', $milliseconds, $format), $timestamp);
}


/**
 * 写日志
 * @param $data : 数据
 * @param $level : 日志级别 notice、warning、error
 * @param $fileName : 写入哪个日志
 */
function DLOG($data = null, $level= null, $fileName = null){
    if(is_null($data) || is_null($fileName)){
        $out_arr['code'] = '400004';
        return $out_arr;
    }

    $path = storage_path('logs/'. $fileName);

    if(!is_dir($path)){
        $mkdir_re = mkdir($path,0777,TRUE);
        chmod($path, 0777);
        if(!$mkdir_re){
            DLOG($data,$fileName);
        }
    }

    $filePath = $path . "/" . date("Y-m-d",time()) . ".log";

    $time =udate('Y-m-d H:i:s.u');
    $re = file_put_contents($filePath, "[" . $level . "]"."[" . $time . "] ".$data."\n" , FILE_APPEND);

    try{
        chmod($filePath, 0777);
    }catch(\Exception $e){

    }

    if(!$re){
        $out_arr['code'] = '400001';
        return $out_arr;
    }else{
        $out_arr['code'] = '000000';
        return $out_arr;
    }
}


/**
 * 获取当前控制器名
 *
 * @return string
 */
function getCurrentControllerName()
{
    return getCurrentAction()['controller'];
}

/**
 * 获取当前方法名
 *
 * @return string
 */
function getCurrentMethodName()
{
    return getCurrentAction()['method'];
}

/**
 * 获取当前控制器与方法
 *
 * @return array
 */
function getCurrentAction()
{
    $action = \Route::current()->getActionName();
    list($class, $method) = explode('@', $action);

    return ['controller' => $class, 'method' => $method];
}

/**
 * PHP版本兼容性函数 - str_starts_with
 * PHP 8.0+ 原生函数的兼容实现
 */
if (!function_exists('str_starts_with')) {
    function str_starts_with($haystack, $needle) {
        return (string)$needle !== '' && strncmp($haystack, $needle, strlen($needle)) === 0;
    }
}

/**
 * PHP版本兼容性函数 - str_ends_with
 * PHP 8.0+ 原生函数的兼容实现
 */
if (!function_exists('str_ends_with')) {
    function str_ends_with($haystack, $needle) {
        return $needle !== '' && substr($haystack, -strlen($needle)) === (string)$needle;
    }
}

/**
 * PHP版本兼容性函数 - str_contains
 * PHP 8.0+ 原生函数的兼容实现
 */
if (!function_exists('str_contains')) {
    function str_contains($haystack, $needle) {
        return $needle !== '' && strpos($haystack, $needle) !== false;
    }
}


