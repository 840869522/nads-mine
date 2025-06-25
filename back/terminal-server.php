<?php
require __DIR__.'/vendor/autoload.php';

use Ratchet\Server\IoServer;
use Ratchet\Http\HttpServer;
use Ratchet\WebSocket\WsServer;
use App\WebSockets\TerminalServer;

$server = IoServer::factory(
    new HttpServer(
        new WsServer(
            new TerminalServer()
        )
    ),
    8080
);

$server->run();
