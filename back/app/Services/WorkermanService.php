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

        Log::info("尝试发送消息到Workerman", [
            'port' => self::WORKERMAN_PORT,
            'data_type' => $data['type'] ?? 'unknown',
            'message_size' => strlen($message),
            'data_preview' => substr($message, 0, 200) . (strlen($message) > 200 ? '...' : '')
        ]);

        try {
            // 创建一个TCP连接到Workerman的内部端口
            $client = stream_socket_client('tcp://127.0.0.1:' . self::WORKERMAN_PORT, $errno, $errmsg, 3);

            if (!$client) {
                Log::error("Workerman连接失败: {$errmsg} ({$errno})", [
                    'port' => self::WORKERMAN_PORT,
                    'errno' => $errno,
                    'errmsg' => $errmsg
                ]);
                return false;
            }

            Log::info("Workerman连接成功，准备写入数据");

            // 将JSON数据写入连接
            $result = fwrite($client, $message);
            fclose($client);

            if ($result === false) {
                Log::error("Workerman数据写入失败");
                return false;
            }

            Log::info("Workerman消息发送成功", [
                'bytes_written' => $result,
                'message_type' => $data['type'] ?? 'unknown'
            ]);

            return true;

        } catch (Exception $e) {
            Log::error("Workerman通信异常: " . $e->getMessage(), [
                'exception_class' => get_class($e),
                'stack_trace' => $e->getTraceAsString()
            ]);
            return false;
        }
    }
}
