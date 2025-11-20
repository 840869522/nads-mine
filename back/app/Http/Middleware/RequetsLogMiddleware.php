<?php 

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class RequetsLogMiddleware {
    public function handle(Request $request, Closure $next) {
        $time = now()->format('Y-m-d H:i:s');
        $logMessage = sprintf('[%s]::[%s]::[%s]', $time, "REQUEST INFO", "INFO");
        Log::info($logMessage, [
            'ip' => $request->ip(),
            "url" => $request->fullUrl(),
            "method" => $request->method(),
            'headers' => $request->headers->all()
        ]);
        return $next($request);
    }
}
?>