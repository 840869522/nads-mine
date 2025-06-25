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

            $get = function(array $arr, array $keys, $default = null) {
                foreach ($keys as $k) {
                    if (isset($arr[$k])) return $arr[$k];
                    $lk = strtolower($k);
                    foreach ($arr as $ak => $av) {
                        if (strtolower($ak) === $lk) return $av;
                    }
                }
                return $default;
            };

            $tags = (array)$get($img, ['RepoTags', 'repoTags', 'RepoTag'], []);
            $tag = $tags[0] ?? '<none>:latest';
            [$name, $version] = array_pad(explode(':', $tag, 2), 2, 'latest');
            $id = $get($img, ['Id', 'ID', 'id', 'Digest']);

            $data[] = [
                'id' => $id ?: Str::uuid()->toString(),
                'name' => $name,
                'type' => 'docker',
                'version' => $version,
                'description' => (string)$get($img, ['Labels', 'labels'], [])['description'] ?? '',
                'fileName' => null,
                'size' => sprintf('%.2f MB', ((int)$get($img, ['Size', 'size'], 0)) / 1024 / 1024),
                'uploadDate' => date('c', (int)$get($img, ['Created', 'created'], time())),
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
