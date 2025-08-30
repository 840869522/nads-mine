<?php

namespace App\Http\Controllers\Docker;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Services\DockerService;
use App\Models\Docker\Image;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ImagesController extends Controller
{
    private DockerService $docker;

    public function __construct(DockerService $docker)
    {
        $this->docker = $docker;
    }

    public function index(Request $request)
    {
        $role = $request->query('role', 'student');
        $userId = $request->query('userId');
        $images = $this->docker->listImages();
        $result = [];
        foreach ($images as $img) {
            $labels = $img->getLabels() ?? [];
            if ($role !== 'admin' && ($labels['creatorId'] ?? null) !== $userId) {
                continue;
            }
            $tag = $img->getRepoTags()[0] ?? '<none>';
            [$name, $version] = array_pad(explode(':', $tag, 2), 2, 'latest');
            $result[] = [
                'id' => $img->getId(),
                'name' => $name,
                'type' => 'docker',
                'version' => $version,
                'description' => $labels['description'] ?? '',
                'fileName' => null,
                'size' => sprintf('%.2f MB', ($img->getSize() ?? 0) / 1024 / 1024),
                'uploadDate' => date('c', $img->getCreated() ?? time()),
            ];
        }
        return response()->json($result);
    }

    public function store(Request $request)
    {
        $data = $request->all();
        $data['id'] = Str::uuid()->toString();
        Image::create($data);
        return response()->json(['ok' => true, 'id' => $data['id']]);
    }

    public function update(Request $request)
    {
        $data = $request->all();
        $image = Image::findOrFail($data['id']);
        $image->fill($data);
        $image->save();
        return response()->json(['ok' => true]);
    }

    public function destroy(Request $request)
    {
        $id = $request->query('id');
        if ($id) {
            try {
                $this->docker->removeImage($id);
            } catch (\Throwable $e) {
                logger()->error('Failed to remove docker image', ['error' => $e->getMessage()]);
            }
            Image::where('id', $id)->delete();
        }
        return response()->json(['ok' => true]);
    }

    public function import(Request $request)
    {
        $file = $request->file('file');
        if (!$file) {
            return response()->json(['error' => 'no file'], 400);
        }
        $stream = fopen($file->getRealPath(), 'r');
        $this->docker->importImage($stream);
        fclose($stream);
        return response()->json(['ok' => true]);
    }

    public function export(Request $request)
    {
        $id = $request->query('id');
        if (!$id) {
            return response()->json(['error' => 'missing id'], 400);
        }
        $name = $request->query('name', $id);
        $stream = $this->docker->exportImage($id);
        return new StreamedResponse(function () use ($stream) {
            while (!$stream->eof()) {
                echo $stream->read(1024);
            }
        }, 200, [
            'Content-Type' => 'application/x-tar',
            'Content-Disposition' => 'attachment; filename="' . $name . '.tar"',
        ]);
    }
}
