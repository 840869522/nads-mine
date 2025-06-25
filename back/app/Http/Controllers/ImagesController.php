<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Services\DockerCliService;
use Illuminate\Support\Str;

class ImagesController extends Controller
{
    private DockerCliService $docker;

    public function __construct(DockerCliService $docker)
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
