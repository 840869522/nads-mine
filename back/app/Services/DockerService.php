<?php
namespace App\Services;

use Docker\Docker;
use Docker\DockerClientFactory;
use Docker\API\Model\ContainersCreatePostBody;
use Docker\API\Client as DockerClient;

class DockerService
{
    private $docker;

    public function __construct()
    {
        $socket = strtoupper(substr(PHP_OS, 0, 3)) === 'WIN'
            ? 'npipe:////./pipe/docker_engine'
            : 'unix:///var/run/docker.sock';
        $client = DockerClientFactory::create(['remote_socket' => $socket]);
        $this->docker = Docker::create($client);
    }

    public function listContainers(): array
    {
        return $this->docker->containerList(['all' => true]);
    }

    public function listImages(): array
    {
        return $this->docker->imageList(['all' => true]);
    }

    public function createContainer(array $options)
    {
        $config = new ContainersCreatePostBody();
        $config->setImage($options['image']);
        if (isset($options['cmd'])) $config->setCmd($options['cmd']);
        if (isset($options['env'])) $config->setEnv($options['env']);
        $container = $this->docker->containerCreate($config, ['name' => $options['name'] ?? null]);
        $this->docker->containerStart($container->getId());
        return $container->getId();
    }

    public function startContainer(string $id)
    {
        $this->docker->containerStart($id);
    }

    public function stopContainer(string $id)
    {
        $this->docker->containerStop($id);
    }

    public function pauseContainer(string $id)
    {
        $this->docker->containerPause($id);
    }

    public function unpauseContainer(string $id)
    {
        $this->docker->containerUnpause($id);
    }

    public function removeContainer(string $id)
    {
        $this->docker->containerDelete($id, ['force' => true]);
    }

    public function containerLogs(string $id, int $tail = 200): string
    {
        $stream = $this->docker->containerLogs($id, ['stdout' => true, 'stderr' => true, 'tail' => $tail]);
        $output = '';
        foreach ($stream->getBody()->getIterator() as $chunk) {
            $output .= $chunk;
        }
        return $output;
    }

    public function containerStats(string $id)
    {
        return $this->docker->containerStats($id, ['stream' => false, 'one-shot' => true]);
    }

    public function containerInspect(string $id)
    {
        return $this->docker->containerInspect($id);
    }

    public function listBindMounts(string $id): array
    {
        $info = $this->containerInspect($id);
        return $info->getMounts() ?? [];
    }
}
