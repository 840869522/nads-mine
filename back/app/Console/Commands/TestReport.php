<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;

class TestReport extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'command:test';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'test';

    /**
     * Execute the console command.
     *
     * @return int
     */
    public function handle()
    {
        $a = array(
            'a'=>1,
            'b'=>2,
            'c'=>3,
            'd'=>4,
        );
        $res = $this->socket_send_client($a);
        echo $res['errmsg'];
    }


    /**
     * socket内部传输
     * Notes:
     * User: zhangnan
     * DateTime: 2025/5/7 10:47
     * @param array $data
     * @return array
     */
    function socket_send_client($data = [])
    {
        $uri    = "tcp://127.0.0.1:" . "2347";
        $client = stream_socket_client($uri, $errno, $errmsg, 1);
        // 发送数据，Text协议需要在数据末尾加上换行符
        fwrite($client, json_encode($data) . "\n");
        $res = array(
            'errno'  => $errno,
            'errmsg' => $errmsg,
        );
        return $res;
    }
}
