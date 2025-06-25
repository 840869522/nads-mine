<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Services\DockerService;
use Illuminate\Support\Str;

class ImagesController extends Controller
{
    private DockerService $docker;

    public function __construct(DockerService $docker)
    {
        $this->docker = $docker;
    }

    public function index()
    {
        $data = $this->docker->listImagesNormalized();
        return response()->json($data);
    }

    public function store(Request $request)
    {
        return response()->json(['ok' => true, 'id' => Str::uuid()->toString()]);
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
