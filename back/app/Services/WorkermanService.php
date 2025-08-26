<?php

namespace App\Services;

use Exception;
use Illuminate\Support\Facades\Log;

class WorkermanService
{
    /**
     * Workerman内部Text协议端口
     */
    protected const WORKERMAN_PORT = 2347;

    /**
     * 向Workerman服务发送数据
     *
     * @param array $data 要发送的数据，将被序列化为JSON
     * @return bool
     */
    public function send(array $data): bool
    {
        // 序列化为JSON字符串并添加Text协议所需的分隔符
        $message = json_encode($data) . "\n";

        try {
            // 创建一个TCP连接到Workerman的内部端口
            $client = stream_socket_client('tcp://0.0.0.0:' . self::WORKERMAN_PORT, $errno, $errmsg, 1);

            if (!$client) {
                Log::error("Workerman连接失败: {$errmsg} ({$errno})");
                return false;
            }

            // 将JSON数据写入连接
            $result = fwrite($client, $message);
            fclose($client);

            if ($result === false) {
                Log::error("Workerman数据写入失败");
                return false;
            }

            return true;

        } catch (Exception $e) {
            Log::error("Workerman通信异常: " . $e->getMessage());
            return false;
        }
    }
}
