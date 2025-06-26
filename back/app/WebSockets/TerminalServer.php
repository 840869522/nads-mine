<?php
namespace App\WebSockets;

use Workerman\Connection\TcpConnection;
use Workerman\Lib\Timer;
use App\Services\DockerService;

class TerminalServer
{
    protected array $clients = [];

    public function onWebSocketConnect(TcpConnection $connection): void
    {
        $query = $_GET;
        $containerId = $query['id'] ?? null;
        if (!$containerId) {
            $connection->close();
            return;
        }
        $mode = $query['mode'] ?? 'terminal';
        $docker = new DockerService();
        $stream = $mode === 'logs'
            ? $docker->attachLogs($containerId)
            : $docker->attachTerminal($containerId);
        $timer = Timer::add(0.1, function() use ($connection, $stream) {
            $out = $stream->read(0, 200000);
            if ($out === null) {
                $connection->close();
                return;
            }
            if ($out !== false && $out !== '') {
                $connection->send($out);
            }
        });
        $this->clients[$connection->id] = [$stream, $timer, $mode];
    }

    public function onMessage(TcpConnection $connection, string $msg): void
    {
        [$stream, $_timer, $mode] = $this->clients[$connection->id] ?? [null, null, null];
        if ($mode === 'terminal' && $stream) {
            $data = json_decode($msg, true);
            if (isset($data['type']) && $data['type'] === 'input') {
                $stream->write($data['data']);
            }
        }
    }

    public function onClose(TcpConnection $connection): void
    {
        [$stream, $timer] = $this->clients[$connection->id] ?? [null, null];
        if ($timer) {
            Timer::del($timer);
        }
        unset($this->clients[$connection->id]);
    }

    public function onError(TcpConnection $connection, \Exception $e): void
    {
        $connection->close();
    }
}
