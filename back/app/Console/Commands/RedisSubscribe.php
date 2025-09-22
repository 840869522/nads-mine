<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Redis;
use Throwable;

class RedisSubscribe extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'redis:subscribe';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = '订阅 Redis 消息并转发到 Workerman';

    // protected WorkermanService $workermanService;

    public function __construct()
    {
        parent::__construct();
        // $this->workermanService = $workermanService;
    }

    /**
     * Execute the console command.
     *
     * @return int
     */
    public function handle()
    {
        $this->info("[" . now() . "] [INFO] 开始订阅 Redis 消息...");

        while (true) {
            try {
                Redis::psubscribe(['flag_submissions_channel'], function ($message, $channel) {
                    try {
                        $this->info("[" . now() . "] [INFO] 收到 {$channel} 消息: {$message}");

                        $redisData = json_decode($message, true);
                        // 转发给 Workerman
                        $data = [
                            'type' => 'flag-log',
                            'timer' => (string) (int)(microtime(true) * 1000),
                            'data' => $redisData
                        ];

                        // $this->workermanService->send($data);

                        $this->info("[" . now() . "] [INFO] 消息处理成功", $data);
                    } catch (Throwable $e) {
                        $this->error("[" . now() . "] [ERROR] 处理消息失败: " . $e->getMessage(), [
                            'channel' => $channel,
                            'message' => $message,
                        ]);
                    }
                });
            } catch (Throwable $e) {
                try {
                    Redis::connection()->ping();
                    // $this->info("[" . now() . "] [INFO] Redis 心跳 PING 成功");
                } catch (\Throwable $e) {
                    $this->error("[" . now() . "] [ERROR] Redis 心跳失败: " . $e->getMessage());
                }
            }
        }

        return 0;
    }
}
