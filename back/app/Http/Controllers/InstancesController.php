<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Services\DockerCliService;

class InstancesController extends Controller
{
    private DockerCliService $docker;

    public function __construct(DockerCliService $docker)
    {
        $this->docker = $docker;
    }

    public function index()
    {
        $data = $this->docker->listContainersNormalized();
        return response()->json($data);
    }

    public function store(Request $request)
    {
        return response()->json(['ok' => true]);
    }

    public function update(Request $request)
    {
        return response()->json(['ok' => true]);
    }

    public function destroy(Request $request)
    {
        return response()->json(['ok' => true]);
    }
}
