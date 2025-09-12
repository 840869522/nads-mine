<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Redis;
use Throwable;
use App\Services\WorkermanService;

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

    protected WorkermanService $workermanService;

    public function __construct(WorkermanService $workermanService)
    {
        parent::__construct();
        $this->workermanService = $workermanService;
    }

    /**
     * Execute the console command.
     *
     * @return int
     */
    public function handle()
    {
        $this->info("开始订阅 Redis 消息...");

        while (true) {
            try {
                Redis::psubscribe(['flag_submissions_channel'], function ($message, $channel) {
                    try {
                        $this->info("收到 {$channel} 消息: {$message}");

                        // 转发给 Workerman
                        $data = [
                            'type'    => 'flag-log',
                            'message' => $message
                        ];

                        $this->workermanService->send($data);

                        logger()->info("消息处理成功", $data);
                    } catch (Throwable $e) {
                        logger()->error("处理消息失败: " . $e->getMessage(), [
                            'channel' => $channel,
                            'message' => $message,
                        ]);
                    }
                });
            } catch (Throwable $e) {
                logger()->warning("Redis订阅异常，3秒后重连", ['message' => $e->getMessage()]);
                sleep(3);
            }
        }

        return 0;
    }
}
