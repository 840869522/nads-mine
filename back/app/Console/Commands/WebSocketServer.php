<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Workerman\Worker;
use Workerman\Timer;

class WebSocketServer extends Command
{
    /**
     * 命令签名（支持启动/停止/重启操作）
     *
     * @var string
     */
    protected $signature = 'websocket:server {action : start|stop|restart}';

    /**
     * 命令描述
     *
     * @var string
     */
    protected $description = 'Start/stop/restart WebSocket server with Workerman';

    /**
     * WebSocket 服务实例
     *
     * @var Worker
     */
    private $ws;


    protected $uidConnections = [];
    protected $authenticatedUsers = [];

    /**
     * 执行命令
     *
     * @return int
     */
    public function handle()
    {
        $action = $this->argument('action');

        // 初始化WebSocket服务（监听8080端口）
        $this->ws = new Worker('websocket://0.0.0.0:8080');

        // 配置服务
        $this->configureServer();

        // 注册事件回调
        $this->registerEvents();

        // 根据操作执行对应命令
        Worker::$command = $action;
        Worker::runAll();

        return 0;
    }

    /**
     * 配置WebSocket服务
     */
    private function configureServer()
    {
        // 启动4个进程（根据CPU核心数调整）
        $this->ws->count = 4;

        // 服务名称（方便进程管理）
        $this->ws->name = 'LaravelWebSocket';

        // 允许的请求来源（可选，限制跨域）
        $this->ws->onWorkerStart = function () {
            header('Access-Control-Allow-Origin: *');
        };
    }

    /**
     * 注册WebSocket事件回调
     */
    private function registerEvents()
    {
        // 客户端连接时触发
        $this->ws->onConnect = function ($connection) {
            $this->info("Client [{$connection->id}] connected");
            $this->uidConnections[$connection->id] = $connection;
            $connection->send(json_encode([
                'type' => 'system',
                'message' => 'Welcome to WebSocket server!'
            ]));
        };

        // 收到客户端消息时触发
        $this->ws->onMessage = function ($connection, $data) {
            $this->info("Received from [{$connection->id}]: {$data}");
            $connection->lastMessageTime = time();

            // 解析JSON格式消息
            $message = json_decode($data, true);
            if (!$message || !isset($message['type'])) {
                $connection->send(json_encode([
                    'type' => 'error',
                    'message' => 'Invalid message format'
                ]));
                return;
            }

            // 处理不同类型的消息
            switch ($message['type']) {
                case 'auth':
                    $this->handleAuth($connection, $message);
                    break;
                case 'ping':
                    $connection->send(json_encode(['type' => 'pong', 'timestamp' => time()]));
                    break;
                default:
                    // 检查是否已认证
                    if (!isset($this->authenticatedUsers[$connection->id])) {
                        $connection->send(json_encode([
                            'type' => 'error',
                            'message' => 'Authentication required'
                        ]));
                        return;
                    }
                    break;
            }
        };

        // 客户端断开连接时触发
        $this->ws->onClose = function ($connection) {
            $this->info("Client [{$connection->id}] disconnected");
            unset($this->uidConnections[$connection->id]);
            unset($this->authenticatedUsers[$connection->id]);
        };

        // 发生错误时触发
        $this->ws->onError = function ($connection, $code, $msg) {
            $this->error("Error [{$code}]: {$msg}");
        };

        $this->ws->onWorkerStart = function ($worker) {
// 开启一个内部端口，方便内部系统推送数据，Text协议格式 文本+换行符
            $inner_text_worker = new Worker("text://0.0.0.0:2347");
            $inner_text_worker->onMessage = function ($connection, $buffer) {
                // $data数组格式，里面有uid，表示向那个uid的页面推送数据
                $data = json_decode($buffer, true);
                $this->broadcast($data);
            };
            $inner_text_worker->listen();
            Timer::add(10, function()use($worker){
                $time_now = time();
                foreach($worker->connections as $connection) {
                    // 有可能该connection还没收到过消息，则lastMessageTime设置为当前时间
                    if (empty($connection->lastMessageTime)) {
                        $connection->lastMessageTime = $time_now;
                        continue;
                    }
//                    if($this->connect[$connection->id]==""){
//                        if ($time_now - $connection->lastMessageTime > $this->verify_time) {
//                            $connection->close();
//                        }
//                    }
//                $diff_time = $time_now - $connection->lastMessageTime;
//                $msg = '距离上次通话已经过去'.$diff_time.'秒';
//                $connection->send($msg);
                    // 上次通讯时间间隔大于心跳间隔，则认为客户端已经下线，关闭连接
//                    if ($time_now - $connection->lastMessageTime > $this->HEARTBEAT_TIME) {
//                        $connection->close();
//                    }
                }


            });
        };
    }


    // 向所有验证的用户推送数据
    public function broadcast($message)
    {
        $jsonMessage = is_string($message) ? $message : json_encode($message);
        foreach($this->uidConnections as $connectionId => $connection) {
            // 只向已认证的用户发送消息
            if (isset($this->authenticatedUsers[$connectionId])) {
                $connection->send($jsonMessage);
            }
        }
    }

    // 处理用户认证
    private function handleAuth($connection, $message)
    {
        if (!isset($message['token'])) {
            $connection->send(json_encode([
                'type' => 'auth_response',
                'success' => false,
                'error' => 'Token required'
            ]));
            return;
        }

        // 简单的JWT解析（在实际中应该使用适当的JWT库）
        try {
            // 这里可以调用Laravel的JWT验证方法
            // 目前简化处理，只检查token是否存在
            $token = $message['token'];
            if (strlen($token) > 10) { // 简单验证
                $this->authenticatedUsers[$connection->id] = [
                    'token' => $token,
                    'auth_time' => time()
                ];
                
                $connection->send(json_encode([
                    'type' => 'auth_response',
                    'success' => true,
                    'message' => 'Authentication successful'
                ]));
                
                $this->info("Client [{$connection->id}] authenticated successfully");
            } else {
                $connection->send(json_encode([
                    'type' => 'auth_response',
                    'success' => false,
                    'error' => 'Invalid token'
                ]));
            }
        } catch (\Exception $e) {
            $connection->send(json_encode([
                'type' => 'auth_response',
                'success' => false,
                'error' => 'Authentication failed'
            ]));
        }
    }
}
