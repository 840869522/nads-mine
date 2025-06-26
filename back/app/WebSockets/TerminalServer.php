<?php
namespace App\WebSockets;

use Ratchet\MessageComponentInterface;
use Ratchet\ConnectionInterface;
use React\EventLoop\Loop;
use App\Services\DockerService;

class TerminalServer implements MessageComponentInterface
{
    protected $clients = [];

    public function onOpen(ConnectionInterface $conn)
    {
        parse_str($conn->httpRequest->getUri()->getQuery(), $query);
        $containerId = $query['id'] ?? null;
        if (!$containerId) {
            $conn->close();
            return;
        }
        $mode = $query['mode'] ?? 'terminal';
        $docker = new DockerService();
        $stream = $mode === 'logs'
            ? $docker->attachLogs($containerId)
            : $docker->attachTerminal($containerId);

        $timer = Loop::addPeriodicTimer(0.1, function() use ($conn, $stream) {
            $out = $stream->read(0, 200000);
            if ($out === null) {
                $conn->close();
                return;
            }
            if ($out !== false && $out !== '') {
                $conn->send($out);
            }
        });

        $this->clients[$conn->resourceId] = [$conn, $stream, $timer, $mode];
    }

    public function onMessage(ConnectionInterface $from, $msg)
    {
        [$conn, $stream, $timer, $mode] = $this->clients[$from->resourceId];
        if ($mode === 'terminal') {
            $data = json_decode($msg, true);
            if (isset($data['type']) && $data['type'] === 'input') {
                $stream->write($data['data']);
            }
        }
    }

    public function onClose(ConnectionInterface $conn)
    {
        [$c, $stream, $timer, $mode] = $this->clients[$conn->resourceId];
        Loop::cancelTimer($timer);
        unset($this->clients[$conn->resourceId]);
    }

    public function onError(ConnectionInterface $conn, \Exception $e)
    {
        $conn->close();
    }
}
