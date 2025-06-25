<?php
namespace App\Services;

use Docker\Docker;
use Docker\DockerClientFactory;
use Docker\API\Model\ContainersCreatePostBody;

class DockerService
{
    private $docker;

    public function __construct()
    {
        $host = getenv('DOCKER_HOST');
        if (!$host) {
            $host = DIRECTORY_SEPARATOR === '\\'
                ? 'tcp://127.0.0.1:2375'
                : 'unix:///var/run/docker.sock';
        }

        if (str_starts_with($host, 'unix://') && !in_array('unix', stream_get_transports())) {
            $host = 'tcp://127.0.0.1:2375';
        }

        putenv('DOCKER_HOST=' . $host);

        $client = DockerClientFactory::createFromEnv();
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

    public function inspectContainer(string $id): array
    {
        return $this->docker->containerInspect($id);
    }

    public function listBindMounts(string $id): array
    {
        $info = $this->inspectContainer($id);
        return $info['Mounts'] ?? [];
    }

    public function pauseContainer(string $id)
    {
        $this->docker->containerPause($id);
    }

    public function unpauseContainer(string $id)
    {
        $this->docker->containerUnpause($id);
    }
}
