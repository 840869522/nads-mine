<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Services\DockerService;
use App\Models\Image;
use Illuminate\Support\Str;

class ImagesController extends Controller
{
    private DockerService $docker;

    public function __construct(DockerService $docker)
    {
        $this->docker = $docker;
    }

    /**
     * List Docker images
     */
    public function index(Request $request)
    {
        $role = $request->query('role', 'student');
        $userId = $request->query('userId');
        $images = $this->docker->listImages();
        $result = [];
        foreach ($images as $img) {
            $labels = $img['Labels'] ?? [];
            if ($role !== 'admin' && ($labels['creatorId'] ?? null) !== $userId) {
                continue;
            }
            $tag = $img['RepoTags'][0] ?? '<none>';
            [$name, $version] = array_pad(explode(':', $tag, 2), 2, 'latest');
            $result[] = [
                'id' => $img['Id'] ?? '',
                'name' => $name,
                'type' => 'docker',
                'version' => $version,
                'description' => $labels['description'] ?? '',
                'fileName' => null,
                'size' => sprintf('%.2f MB', ($img['Size'] ?? 0) / 1024 / 1024),
                'uploadDate' => isset($img['Created']) ? date('c', $img['Created']) : date('c'),
            ];
        }

        return response()->json($result);
    }

    /**
     * Create a new image record
     */
    public function store(Request $request)
    {
        $data = $request->all();
        $data['id'] = Str::uuid()->toString();
        Image::create($data);
        return response()->json(['ok' => true, 'id' => $data['id']]);
    }

    /**
     * Update image metadata
     */
    public function update(Request $request)
    {
        $data = $request->all();
        $image = Image::findOrFail($data['id']);
        $image->fill($data);
        $image->save();
        return response()->json(['ok' => true]);
    }

    /**
     * Delete an image record
     */
    public function destroy(Request $request)
    {
        $id = $request->query('id');
        if ($id) {
            Image::where('id', $id)->delete();
        }

        return response()->json(['ok' => true]);
    }
}
