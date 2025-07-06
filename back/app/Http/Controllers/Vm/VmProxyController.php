<?php
namespace App\Http\Controllers\Vm;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

class VmProxyController extends Controller
{
    private string $baseUrl;

    public function __construct()
    {
        $host = env('PYTHON_API_HOST', '127.0.0.1');
        $port = env('PYTHON_API_PORT', 3010);
        $this->baseUrl = "http://{$host}:{$port}/api/vms";
    }

    public function handle(Request $request, string $path = '')
    {
        $url = rtrim($this->baseUrl . ($path ? "/{$path}" : ''), '/');
        $method = $request->method();

        $headers = collect($request->headers->all())->map(function ($v) {
            return is_array($v) ? $v[0] : $v;
        })->toArray();

        $resp = Http::withHeaders($headers)->send($method, $url, [
            'query' => $request->query(),
            'body'  => $request->getContent(),
        ]);

        return response($resp->body(), $resp->status())
            ->withHeaders($resp->headers());
    }
}
