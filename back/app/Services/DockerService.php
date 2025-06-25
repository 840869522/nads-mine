<?php
namespace App\Services;

use Docker\Docker;
use Docker\DockerClientFactory;
use Docker\API\Model\ContainersCreatePostBody;
use Illuminate\Support\Str;

class DockerService
{
    private $docker;

    public function __construct()
    {
        $this->docker = $this->initDocker();
    }

    private function initDocker(): Docker
    {
        $candidates = [];
        if ($env = getenv('DOCKER_HOST')) {
            $candidates[] = $env;
        }

        if (DIRECTORY_SEPARATOR === '\\') {
            // Windows systems may expose Docker via named pipe or TCP
            $candidates[] = 'npipe:////./pipe/docker_engine';
            $candidates[] = 'tcp://127.0.0.1:2375';
        } else {
            $candidates[] = 'unix:///var/run/docker.sock';
            $candidates[] = 'tcp://127.0.0.1:2375';
        }

        foreach ($candidates as $host) {
            if (str_starts_with($host, 'unix://') && !in_array('unix', stream_get_transports())) {
                continue;
            }
            try {
                putenv('DOCKER_HOST=' . $host);
                $client = DockerClientFactory::createFromEnv();
                $docker = Docker::create($client);
                // simple request to verify connectivity
                $docker->systemPing();
                return $docker;
            } catch (\Throwable $e) {
                // try next candidate
            }
        }

        // last resort - still create a client with default config
        $client = DockerClientFactory::createFromEnv();
        return Docker::create($client);
    }

    private function arr(mixed $value): array
    {
        if (is_array($value)) return $value;
        return json_decode(json_encode($value), true) ?: [];
    }

    private function field(array $arr, array $keys, $default = null)
    {
        foreach ($keys as $k) {
            if (array_key_exists($k, $arr)) {
                return $arr[$k];
            }
            $lk = strtolower($k);
            foreach ($arr as $ak => $av) {
                if (strtolower($ak) === $lk) {
                    return $av;
                }
            }
        }
        return $default;
    }

    private function cliContainers(): array
    {
        $out = [];
        @exec('docker ps -a --format "{{json .}}"', $out);
        $result = [];
        foreach ($out as $line) {
            $data = json_decode($line, true);
            if (is_array($data)) {
                $result[] = $data;
            }
        }
        return $result;
    }

    private function cliImages(): array
    {
        $out = [];
        @exec('docker images --format "{{json .}}"', $out);
        $result = [];
        foreach ($out as $line) {
            $data = json_decode($line, true);
            if (is_array($data)) {
                $result[] = $data;
            }
        }
        return $result;
    }

    public function listContainers(): array
    {
        try {
            $raw = $this->docker->containerList(['all' => true]);
            return $this->arr($raw);
        } catch (\Throwable $e) {
            return $this->cliContainers();
        }
    }

    public function listImages(): array
    {
        try {
            $raw = $this->docker->imageList(['all' => true]);
            return $this->arr($raw);
        } catch (\Throwable $e) {
            return $this->cliImages();
        }
    }

    public function listContainersNormalized(): array
    {
        $containers = $this->listContainers();
        $result = [];
        foreach ($containers as $c) {
            $c = $this->arr($c);
            $portsInfo = $this->field($c, ['Ports', 'ports'], []);
            $ports = [];
            if (is_array($portsInfo)) {
                foreach ($portsInfo as $p) {
                    $p = $this->arr($p);
                    if (is_array($p)) {
                        $priv = $this->field($p, ['PrivatePort', 'privatePort']);
                        $pub  = $this->field($p, ['PublicPort', 'publicPort']);
                        if ($priv === null) continue;
                        $ports[] = $pub !== null ? "$priv->$pub" : (string)$priv;
                    } else {
                        $ports[] = (string)$p;
                    }
                }
            } elseif ($portsInfo) {
                $ports[] = (string)$portsInfo;
            }
            $state = (string)$this->field($c, ['State', 'state'], '');
            $status = match ($state) {
                'running' => 'running',
                'paused' => 'paused',
                'created', 'exited', 'dead' => 'stopped',
                default => 'error',
            };
            $cid = $this->field($c, ['Id', 'ID', 'id']);
            $names = (array)$this->field($c, ['Names', 'names'], []);
            $result[] = [
                'id' => $cid ? substr($cid, 0, 12) : Str::uuid()->toString(),
                'name' => ltrim($names[0] ?? ($cid ? substr($cid, 0, 12) : ''), '/'),
                'type' => 'container',
                'status' => $status,
                'ports' => implode(', ', $ports),
                'imageName' => (string)$this->field($c, ['Image', 'image', 'ImageName', 'imageName'], ''),
                'cpuUsage' => '-',
                'memoryUsage' => '-',
                'diskUsage' => '-',
                'uptime' => (string)$this->field($c, ['Status', 'status'], ''),
                'createdAt' => date('c', (int)$this->field($c, ['Created', 'created'], time())),
            ];
        }
        return $result;
    }

    public function listImagesNormalized(): array
    {
        $images = $this->listImages();
        $result = [];
        foreach ($images as $img) {
            $img = $this->arr($img);
            $tags = (array)$this->field($img, ['RepoTags', 'repoTags', 'RepoTag'], []);
            if (!$tags && isset($img['Repository'])) {
                $repo = $img['Repository'] ?: '<none>';
                $tagName = $img['Tag'] ?? 'latest';
                $tags[] = $repo . ':' . $tagName;
            }
            $tag = $tags[0] ?? '<none>:latest';
            [$name, $version] = array_pad(explode(':', $tag, 2), 2, 'latest');
            $labels = (array)$this->field($img, ['Labels', 'labels'], []);
            $description = $labels['description'] ?? '';
            $sizeStr = $this->field($img, ['Size', 'size'], 0);
            if (!is_numeric($sizeStr)) {
                $num = floatval($sizeStr);
                if (stripos($sizeStr, 'GB') !== false) {
                    $num *= 1024 * 1024 * 1024;
                } elseif (stripos($sizeStr, 'MB') !== false) {
                    $num *= 1024 * 1024;
                } elseif (stripos($sizeStr, 'kB') !== false) {
                    $num *= 1024;
                }
                $size = (int)$num;
            } else {
                $size = (int)$sizeStr;
            }
            $created = (int)$this->field($img, ['Created', 'created'], time());
            $id = $this->field($img, ['Id', 'ID', 'id', 'Digest']);
            $result[] = [
                'id' => $id ?: Str::uuid()->toString(),
                'name' => $name,
                'type' => 'docker',
                'version' => $version,
                'description' => $description,
                'fileName' => null,
                'size' => sprintf('%.2f MB', $size / 1024 / 1024),
                'uploadDate' => date('c', $created),
            ];
        }
        return $result;
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
