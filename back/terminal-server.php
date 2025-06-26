<?php
require __DIR__.'/vendor/autoload.php';

use Workerman\Worker;
use App\WebSockets\TerminalServer;

$terminal = new TerminalServer();

$worker = new Worker('websocket://0.0.0.0:8080');

$worker->onWebSocketConnect = [$terminal, 'onWebSocketConnect'];
$worker->onMessage           = [$terminal, 'onMessage'];
$worker->onClose             = [$terminal, 'onClose'];
$worker->onError             = [$terminal, 'onError'];

Worker::runAll();
