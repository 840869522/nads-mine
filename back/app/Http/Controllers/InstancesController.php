<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Services\DockerService;

class InstancesController extends Controller
{
    private DockerService $docker;

    public function __construct(DockerService $docker)
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
