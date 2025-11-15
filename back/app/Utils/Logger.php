<?php

namespace App\Utils;


use Illuminate\Support\Facades\Log;

class Logger
{

    public static function error( $message)
    {
        $trace = debug_backtrace();
        $caller = $trace[0] ?? [];
        $time = now()->format('Y-m-d H:i:s');
        $file = basename($caller['file'] ?? 'unknown');
        $level = 'ERROR';
        $messageStr = is_string($message) ? $message : json_encode($message);
        $logMessage = sprintf('[%s]::[%s]::[%s]::[%s]', $time, $file, $level, $messageStr);

        Log::error($logMessage);
    }

    public static function info( $message) {
        $trace = debug_backtrace();
        $caller = $trace[0] ?? [];
        $time = now()->format('Y-m-d H:i:s');
        $file = basename($caller['file'] ?? 'unknown');
        $level = 'INFO';
        $messageStr = is_string($message) ? $message : json_encode($message);
        $logMessage = sprintf('[%s]::[%s]::[%s]::[%s]', $time, $file, $level, $messageStr);

        Log::info($logMessage);
    }
    public static function warning( $message, $context) {
        $trace = debug_backtrace();
        $caller = $trace[0] ?? [];
        $time = now()->format('Y-m-d H:i:s');
        $file = basename($caller['file'] ?? 'unknown');
        $level = 'WARNING';
        $messageStr = is_string($message) ? $message : json_encode($message);
        $logMessage = sprintf('[%s]::[%s]::[%s]::[%s]', $time, $file, $level, $messageStr);

        Log::warning($logMessage, $context);
    }
}
