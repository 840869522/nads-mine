<?php
namespace App\Services;

use Docker\Docker;
use Docker\DockerClientFactory;
use Docker\API\Model\ContainersCreatePostBody;
use Docker\API\Model\HostConfig;
use Docker\API\Model\PortBinding;
use Docker\API\Model\ContainerConfigExposedPortsItem;

class DockerService
{
    private $docker;

    public function __construct()
    {
        if (strtoupper(substr(PHP_OS, 0, 3)) === 'WIN') {
            $socket = getenv('DOCKER_HOST') ?: 'tcp://localhost:2375';
        } else {
            $socket = getenv('DOCKER_HOST') ?: 'unix:///var/run/docker.sock';
        }
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

        if (!empty($options['cmd']) && is_array($options['cmd'])) {
            $config->setCmd($options['cmd']);
        }

        if (!empty($options['env']) && is_array($options['env'])) {
            $envList = [];
            foreach ($options['env'] as $env) {
                if (isset($env['key'])) {
                    $value = $env['value'] ?? '';
                    $envList[] = $env['key'] . '=' . $value;
                }
            }
            if ($envList) {
                $config->setEnv($envList);
            }
        }

        $hostConfig = new HostConfig();

        if (!empty($options['volumes']) && is_array($options['volumes'])) {
            $binds = [];
            foreach ($options['volumes'] as $vol) {
                if (!empty($vol['hostPath']) && !empty($vol['containerPath'])) {
                    $binds[] = $vol['hostPath'] . ':' . $vol['containerPath'];
                }
            }
            if ($binds) {
                $hostConfig->setBinds($binds);
            }
        }

        $exposedPorts = new \ArrayObject();
        if (!empty($options['ports']) && is_array($options['ports'])) {
            $portBindings = new \ArrayObject();

            foreach ($options['ports'] as $port) {
                if (empty($port['containerPort'])) {
                    continue;
                }

                $cPort = (int) $port['containerPort'];
                if ($cPort <= 0 || $cPort > 65535) {
                    continue;
                }

                $protoPort = $cPort . '/tcp';
                $exposedPorts[$protoPort] = new \stdClass();

                $binding = new PortBinding();

                if (!empty($port['hostPort'])) {
                    $hPort = (int) $port['hostPort'];
                    if ($hPort > 0 && $hPort <= 65535) {
                        $binding->setHostPort((string) $hPort);
                    }
                }

                $binding->setHostIp('0.0.0.0');
                $portBindings[$protoPort] = [$binding];
            }

            if ($portBindings->count() > 0) {
                $hostConfig->setPortBindings($portBindings);
            }
        }

        if ($exposedPorts->count() > 0) {
            $config->setExposedPorts($exposedPorts);
        }

        if ($hostConfig->isInitialized('binds') || $hostConfig->isInitialized('portBindings')) {
            $config->setHostConfig($hostConfig);
        }

        $query = [];
        if (!empty($options['name'])) {
            $query['name'] = (string) $options['name'];
        }

        $container = $this->docker->containerCreate($config, $query);
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
