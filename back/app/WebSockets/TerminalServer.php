<?php
namespace App\WebSockets;

use Ratchet\MessageComponentInterface;
use Ratchet\ConnectionInterface;
use Symfony\Component\Process\Process;

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
        $this->clients[$conn->resourceId] = [$conn,$process];
    }

    public function onMessage(ConnectionInterface $from, $msg)
    {
        [$conn,$process] = $this->clients[$from->resourceId];
        if ($process->isRunning()) {
            $process->getInput()->write($msg);
            $output = $process->getIncrementalOutput() . $process->getIncrementalErrorOutput();
            if ($output !== '') {
                $conn->send($output);
            }
        }
    }

    public function onClose(ConnectionInterface $conn)
    {
        [$c,$process] = $this->clients[$conn->resourceId];
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
