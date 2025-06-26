<?php
namespace App\Services;

use Sangezar\DockerClient\DockerClient;
use Sangezar\DockerClient\Config\ClientConfig;
use Sangezar\DockerClient\Config\ContainerConfig;

class DockerService
{
    private DockerClient $client;

    public function __construct()
    {
        if (strtoupper(substr(PHP_OS, 0, 3)) === 'WIN') {
            $host = getenv('DOCKER_HOST') ?: 'tcp://localhost:2375';
            $config = ClientConfig::forHttp($host);
        } else {
            $socket = getenv('DOCKER_HOST');
            if ($socket && str_starts_with($socket, 'tcp://')) {
                $config = ClientConfig::forHttp($socket);
            } else {
                $config = ClientConfig::forUnixSocket($socket ?: '/var/run/docker.sock');
            }
        }
        $this->client = DockerClient::create($config);
    }

    public function listContainers(): array
    {
        return $this->client->container()->list(['all' => true]);
    }

    public function listImages(): array
    {
        return $this->client->image()->list(['all' => true]);
    }

    public function createContainer(array $options): string
    {
        $config = ContainerConfig::create()->setImage($options['image']);

        if (!empty($options['name'])) {
            $config->setName($options['name']);
        }

        if (!empty($options['cmd']) && is_array($options['cmd'])) {
            $config->setCmd($options['cmd']);
        }

        if (!empty($options['env']) && is_array($options['env'])) {
            foreach ($options['env'] as $env) {
                if (!empty($env['key'])) {
                    $config->addEnv($env['key'], (string)($env['value'] ?? ''));
                }
            }
        }

        if (!empty($options['volumes']) && is_array($options['volumes'])) {
            foreach ($options['volumes'] as $vol) {
                if (!empty($vol['hostPath']) && !empty($vol['containerPath'])) {
                    $config->addVolume($vol['hostPath'], $vol['containerPath']);
                }
            }
        }

        if (!empty($options['ports']) && is_array($options['ports'])) {
            foreach ($options['ports'] as $p) {
                if (!empty($p['hostPort']) && !empty($p['containerPort'])) {
                    $config->addPort((int)$p['hostPort'], (int)$p['containerPort']);
                }
            }
        }

        $config->setTty(true);

        $result = $this->client->container()->create($config);
        $id = $result['Id'] ?? $result['id'] ?? '';
        if ($id) {
            $this->client->container()->start($id);
        }
        return $id;
    }

    public function startContainer(string $id): void
    {
        $this->client->container()->start($id);
    }

    public function stopContainer(string $id): void
    {
        $this->client->container()->stop($id);
    }

    public function pauseContainer(string $id): void
    {
        // pause/unpause not supported; no-op
    }

    public function unpauseContainer(string $id): void
    {
        // pause/unpause not supported; no-op
    }

    public function removeContainer(string $id): void
    {
        $this->client->container()->remove($id, true, true);
    }

    public function containerLogs(string $id, int $tail = 200): string
    {
        $logs = $this->client->container()->logs($id, ['stdout' => true, 'stderr' => true, 'tail' => (string)$tail]);
        return implode("\n", $logs);
    }

    public function containerStats(string $id): array
    {
        return $this->client->container()->stats($id, false);
    }

    public function containerInspect(string $id): array
    {
        return $this->client->container()->inspect($id);
    }

    public function listBindMounts(string $id): array
    {
        $info = $this->containerInspect($id);
        return $info['Mounts'] ?? [];
    }
}
