<?php
namespace App\WebSockets;

use Ratchet\MessageComponentInterface;
use Ratchet\ConnectionInterface;
use Symfony\Component\Process\Process;
use React\EventLoop\Loop;

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
        $cmd = ['docker', 'exec', '-it', $containerId, '/bin/sh'];
        $process = new Process($cmd);
        if (DIRECTORY_SEPARATOR !== '\\') {
            $process->setPty(true);
        }
        $process->start();
        $timer = Loop::addPeriodicTimer(0.1, function() use ($conn, $process) {
            if (!$process->isRunning()) {
                return;
            }
            $out = $process->getIncrementalOutput() . $process->getIncrementalErrorOutput();
            if ($out !== '') {
                $conn->send($out);
            }
        });
        $this->clients[$conn->resourceId] = [$conn, $process, $timer];
    }

    public function onMessage(ConnectionInterface $from, $msg)
    {
        [$conn, $process, $timer] = $this->clients[$from->resourceId];
        if (!$process->isRunning()) {
            return;
        }
        $data = json_decode($msg, true);
        if (isset($data['type']) && $data['type'] === 'input') {
            $process->getInput()->write($data['data']);
        } elseif (isset($data['type']) && $data['type'] === 'resize') {
            // ignore for now
        } else {
            $process->getInput()->write($msg);
        }
    }

    public function onClose(ConnectionInterface $conn)
    {
        [$c, $process, $timer] = $this->clients[$conn->resourceId];
        Loop::cancelTimer($timer);
        if ($process->isRunning()) {
            $process->stop(0);
        }
        unset($this->clients[$conn->resourceId]);
    }

    public function onError(ConnectionInterface $conn, \Exception $e)
    {
        $conn->close();
    }
}
