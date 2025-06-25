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
        $imgs = $this->docker->listImages();
        $data = [];
        foreach ($imgs as $img) {
            if (is_object($img)) {
                $img = json_decode(json_encode($img), true);
            }
            $tag = $img['RepoTags'][0] ?? '<none>:latest';
            [$name, $version] = array_pad(explode(':', $tag, 2), 2, 'latest');
            $id = $img['Id'] ?? $img['id'] ?? null;
            if (!$id && isset($img['Digest'])) {
                $id = $img['Digest'];
            }
            $data[] = [
                'id' => $id ?: Str::uuid()->toString(),
                'name' => $name,
                'type' => 'docker',
                'version' => $version,
                'description' => $img['Labels']['description'] ?? '',
                'fileName' => null,
                'size' => sprintf('%.2f MB', ($img['Size'] ?? 0) / 1024 / 1024),
                'uploadDate' => date('c', $img['Created'] ?? time()),
            ];
        }
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
