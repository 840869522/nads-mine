<?php
namespace App\Services;

use Docker\API\Exception\ContainerCreateBadRequestException;
use Docker\Docker;
use Docker\DockerClientFactory;
use Docker\API\Model\ContainersCreatePostBody;
use Docker\API\Model\HostConfig;
use Docker\API\Model\PortBinding;
use Docker\API\Model\ContainerConfigExposedPortsItem;
use Symfony\Component\Serializer\Encoder\JsonEncoder;
use Symfony\Component\Serializer\Normalizer\ObjectNormalizer;
use Symfony\Component\Serializer\Serializer;
use Symfony\Component\Serializer\SerializerInterface;

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

    public function createContainer(array $options): string
    {
        // 0. 打印最初的 options
        logger()->debug('DOCKER: options', $options);

        $cfg = new ContainersCreatePostBody();
        $cfg->setImage($options['image']);
        $cfg->setTty(true);
        // allow attaching a terminal later
        $cfg->setOpenStdin(true);
        $cfg->setAttachStdin(true);
        $cfg->setAttachStdout(true);
        $cfg->setAttachStderr(true);

        // --- ENV & CMD ---
        if (!empty($options['cmd'])) {
            $cfg->setCmd($options['cmd']);
            logger()->debug('DOCKER: cmd', $options['cmd']);
        }

        if (!empty($options['env'])) {
            $envList = array_map(
                fn($e) => "{$e['key']}=" . ($e['value'] ?? ''),
                $options['env']
            );
            $cfg->setEnv($envList);
            logger()->debug('DOCKER: envList', $envList);
        }

        /* ---------- HostConfig / PortBindings ---------- */
        $hostCfg   = new HostConfig();
        $bindings  = [];

        foreach ($options['ports'] ?? [] as $p) {
            $cPort = (int)($p['containerPort'] ?? 0);
            $hPort = (int)($p['hostPort']     ?? 0);
            if ($cPort < 1 || $cPort > 65535 || $hPort < 1 || $hPort > 65535) {
                continue;                     // 跳过非法端口
            }
            $key = $cPort.'/tcp';

            $bind = new PortBinding();
            $bind->setHostPort((string)$hPort);
            $bind->setHostIp('0.0.0.0');             // 空串，避免序列化成 null
            $bindings[$key][] = $bind;
        }

        // 只要有映射，就写进 HostConfig
        if ($bindings) {
            $hostCfg->setPortBindings($bindings);
            $cfg->setHostConfig($hostCfg);
        }

        /* ---------- 创建并启动 ---------- */
        $container = $this->docker->containerCreate(
            $cfg,
            empty($options['name']) ? [] : ['name' => $options['name']]
        );
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
        // docker-php expects the tail option as string
        $stream = $this->docker->containerLogs($id, [
            'stdout' => true,
            'stderr' => true,
            'tail'   => (string) $tail,
        ]);
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

    public function attachTerminal(string $id)
    {
        return $this->docker->containerAttachWebsocket($id, [
            'stream' => true,
            'stdin'  => true,
            'stdout' => true,
            'stderr' => true,
        ]);
    }
}
