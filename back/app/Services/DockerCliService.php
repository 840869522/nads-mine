<?php
namespace App\Services;

use Illuminate\Support\Str;

class DockerCliService
{
    private function run(string $cmd): array
    {
        $out = [];
        @exec($cmd, $out);
        return $out;
    }

    public function listContainersNormalized(): array
    {
        $lines = $this->run('docker ps -a --format "{{json .}}"');
        $result = [];
        foreach ($lines as $line) {
            $data = json_decode($line, true);
            if (!is_array($data)) {
                continue;
            }
            $state = strtolower($data['State'] ?? '');
            $status = match ($state) {
                'running' => 'running',
                'paused' => 'paused',
                'created', 'exited', 'dead' => 'stopped',
                default => 'error',
            };
            $result[] = [
                'id' => $data['ID'] ? substr($data['ID'], 0, 12) : Str::uuid()->toString(),
                'name' => ltrim($data['Names'] ?? '', '/'),
                'type' => 'container',
                'status' => $status,
                'ports' => $data['Ports'] ?? '',
                'imageName' => $data['Image'] ?? '',
                'cpuUsage' => '-',
                'memoryUsage' => '-',
                'diskUsage' => '-',
                'uptime' => $data['Status'] ?? '',
                'createdAt' => date('c', strtotime($data['CreatedAt'] ?? 'now')),
            ];
        }
        return $result;
    }

    public function listImagesNormalized(): array
    {
        $lines = $this->run('docker images --format "{{json .}}"');
        $result = [];
        foreach ($lines as $line) {
            $data = json_decode($line, true);
            if (!is_array($data)) {
                continue;
            }
            $tag = ($data['Repository'] ?? '<none>') . ':' . ($data['Tag'] ?? 'latest');
            [$name, $version] = array_pad(explode(':', $tag, 2), 2, 'latest');
            $result[] = [
                'id' => $data['ID'] ?? Str::uuid()->toString(),
                'name' => $name,
                'type' => 'docker',
                'version' => $version,
                'description' => '',
                'fileName' => null,
                'size' => $data['Size'] ?? '',
                'uploadDate' => date('c', strtotime($data['CreatedSince'] ?? 'now')),
            ];
        }
        return $result;
    }
}
