<?php

namespace App\RunTool;

use Symfony\Component\Process\Process;
use Symfony\Component\Process\Exception\ProcessFailedException;

/**
 * 命令行执行服务
 *
 * 封装所有通过命令行与系统（如 Docker, OVS）交互的逻辑。
 */
class CommandLineService
{
    /**
     * 【新增】创建一个 OVS (Open vSwitch) 网桥。
     *
     * @param string      $switchName 要创建的交换机的名称。
     * @param string|null $controller 可选，外部 SDN 控制器的 "ip:port"。
     * @param bool        $stp        可选，是否为该网桥开启 STP (生成树协议)。
     * @return void
     * @throws ProcessFailedException 如果命令执行失败。
     */
    public function createSwitch(string $switchName, ?string $controller = null, bool $stp = false): void
    {
        // 1. 构建基础的 'ovs-vsctl add-br' 命令
        $command = ['ovs-vsctl', 'add-br', $switchName];

        // 2. 如果需要，添加用于配置 STP 和 Controller 的参数
        // 注意: '--' 用于明确告诉 ovs-vsctl 'add-br' 命令的选项结束了，后面是 'set' 命令。
        if ($stp || $controller) {
            $command[] = '--';

            // 3. 添加 STP 配置
            if ($stp) {
                $command[] = 'set';
                $command[] = 'bridge';
                $command[] = $switchName;
                $command[] = 'stp_enable=true';
            }

            // 4. 添加 Controller 配置
            if ($controller) {
                $command[] = 'set-controller';
                $command[] = $switchName;
                $command[] = 'tcp:' . $controller;
            }
        }

        \Log::info('Executing OVS command: ' . implode(' ', $command));

        // 5. 执行命令
        $process = new Process($command);
        $process->run();

        // 6. 检查是否成功
        if (!$process->isSuccessful()) {
            throw new ProcessFailedException($process);
        }
    }

    /**
     * 通过执行 `docker run` 命令创建并启动一个容器。
     *
     * @param array $options 包含创建容器所需参数的关联数组。
     * @return string 返回新创建容器的完整ID。
     * @throws ProcessFailedException 如果命令执行失败。
     */
    public function createContainer(array $options): string
    {
        // 1. 构建 docker run 命令数组
        $command = ['docker', 'run', '-d', '--privileged', '--cap-add=NET_RAW']; // -d 后台运行, --privileged 给予更高权限，方便后续网络操作

        // a. 添加容器名称
        if (!empty($options['name'])) {
            $command[] = '--name';
            $command[] = $options['name'];
        }

        // b. 添加环境变量
        foreach ($options['env'] ?? [] as $env) {
            $command[] = '-e';
            $command[] = "{$env['key']}={$env['value']}";
        }

        // c. 添加端口映射
        foreach ($options['ports'] ?? [] as $port) {
            $command[] = '-p';
            $command[] = "{$port['hostPort']}:{$port['containerPort']}";
        }
        
        // d. 设置网络模式为 none，这是后续手动连接的关键
        $command[] = '--network=none';

        // e. 添加镜像名称（必须是命令的最后一部分）
        if (empty($options['image'])) {
            throw new \Exception('镜像名称不能为空。');
        }
        $command[] = $options['image'];

        \Log::info('Executing Docker command: ' . implode(' ', $command));

        // 2. 执行命令
        $process = new Process($command);
        $process->run();

        // 3. 检查是否成功
        if (!$process->isSuccessful()) {
            throw new ProcessFailedException($process);
        }

        // 4. 返回容器ID
        $containerId = trim($process->getOutput());
        if (empty($containerId)) {
             throw new \Exception('无法从 docker run 命令的输出中获取有效的容器ID。');
        }
        return $containerId;
    }

    /**
     * 获取一个正在运行的容器的进程ID (PID)。
     *
     * @param string $containerId 容器的ID或名称。
     * @return int 返回容器的PID。
     * @throws ProcessFailedException
     */
    public function getContainerPid(string $containerId): int
    {
        
        $command = ['docker', 'inspect', '-f', '{{.State.Pid}}', $containerId];
        $process = new Process($command);
        $process->run();

        if (!$process->isSuccessful()) {
            throw new ProcessFailedException($process);
        }

        $pid = (int)trim($process->getOutput());
        if ($pid <= 0) {
            throw new \Exception("无法获取容器 {$containerId} 的有效 PID。");
        }
        return $pid;
    }
    /**
     * 
     * 列出系统上所有的 OVS 网桥。
     *
     * @return array 返回一个包含所有网桥名称的数组。
     * @throws ProcessFailedException 如果命令执行失败。
     */
    public function listSwitches(): array
    {
        $command = ['ovs-vsctl', 'list-br'];
        $process = new Process($command);
        $process->run();

        if (!$process->isSuccessful()) {
            throw new ProcessFailedException($process);
        }

        // 将输出的字符串按行分割，并过滤掉空行
        $output = trim($process->getOutput());
        return empty($output) ? [] : explode("\n", $output);
    }
}

// // ```json
// {
//   "edges": [
//     {
//       "id": "edge-1751875313932-v6hq4",
//       "config": {
//         "sourceIp": "10.0.6.1/24",
//         "targetIp": "10.0.6.2/24",
//         "sourceInterface": "eth0",
//         "targetInterface": "eth0"
//       },
//       "source": "container-1751875299803-ueiff",
//       "target": "switch-1751875302955-gawdf"
//     },
//     {
//       "id": "edge-1751875315292-yoiwe",
//       "config": {
//         "sourceIp": "10.0.7.1/24",
//         "targetIp": "10.0.7.2/24",
//         "sourceInterface": "eth0",
//         "targetInterface": "eth0"
//       },
//       "source": "container-1751875300573-bbb2r",
//       "target": "switch-1751875302955-gawdf"
//     },
//     {
//       "id": "edge-1751875316471-prrdn",
//       "config": {
//         "sourceIp": "10.0.8.1/24",
//         "targetIp": "10.0.8.2/24",
//         "sourceInterface": "eth0",
//         "targetInterface": "eth0"
//       },
//       "source": "container-1751875300573-bbb2r",
//       "target": "switch-1751875304435-pptzs"
//     },
//     {
//       "id": "edge-1751875317613-obzw1",
//       "config": {
//         "sourceIp": "10.0.9.1/24",
//         "targetIp": "10.0.9.2/24",
//         "sourceInterface": "eth0",
//         "targetInterface": "eth0"
//       },
//       "source": "container-1751875302012-jh1zr",
//       "target": "switch-1751875304435-pptzs"
//     }
//   ],
//   "nodes": [
//     {
//       "x": 152.36932373046875,
//       "y": 345.1477355957031,
//       "id": "container-1751875299803-ueiff",
//       "type": "container",
//       "label": "Container-1",
//       "config": {
//         "env": null,
//         "deviceName": "容器",
//         "dockerImage": "mysql:latest",
//         "portMappings": "80:80"
//       }
//     },
//     {
//       "x": 753.3693237304688,
//       "y": 342.1477355957031,
//       "id": "container-1751875300573-bbb2r",
//       "type": "container",
//       "label": "Container-2",
//       "config": {
//         "env": null,
//         "deviceName": "容器",
//         "dockerImage": "mysql:latest",
//         "portMappings": "80:80"
//       }
//     },
//     {
//       "x": 1347.369384765625,
//       "y": 343.1477355957031,
//       "id": "container-1751875302012-jh1zr",
//       "type": "container",
//       "label": "Container-3",
//       "config": {
//         "env": null,
//         "deviceName": "容器",
//         "dockerImage": "mysql:latest",
//         "portMappings": "80:80"
//       }
//     },
//     {
//       "x": 454.3693237304687,
//       "y": 151.14773559570312,
//       "id": "switch-1751875302955-gawdf",
//       "type": "switch",
//       "label": "Switch-1",
//       "config": {
//         "deviceName": "交换机",
//         "dockerImage": "switch-os:latest",
//         "portMappings": null
//       }
//     },
//     {
//       "x": 1045.3693237304688,
//       "y": 145.14773559570312,
//       "id": "switch-1751875304435-pptzs",
//       "type": "switch",
//       "label": "Switch-2",
//       "config": {
//         "deviceName": "交换机",
//         "dockerImage": "switch-os:latest",
//         "portMappings": null
//       }
//     }
//   ]
// }
// ```
// [
//     // 1. 需要创建的容器列表
//     'containers' => [
//         ['id' => 'container-1751975196074-gi2o2', 'label' => 'Container-1', 'image' => 'mysql:latest', 'portMappings' => [['hostPort' => '80', 'containerPort' => '80']], 'env' => []],
//         ['id' => 'container-1751975196797-h69nc', 'label' => 'Container-2', 'image' => 'mysql:latest', 'portMappings' => [['hostPort' => '80', 'containerPort' => '80']], 'env' => []],
//         ['id' => 'container-1751975204415-99uz5', 'label' => 'Container-3', 'image' => 'mysql:latest', 'portMappings' => [['hostPort' => '80', 'containerPort' => '80']], 'env' => []],
//         ['id' => 'container-1751975206352-hh2hw', 'label' => 'Container-4', 'image' => 'mysql:latest', 'portMappings' => [['hostPort' => '80', 'containerPort' => '80']], 'env' => []]
//     ],

//     // 2. 需要创建的交换机列表
//     'switches' => [
//         ['id' => 'switch-1751975197803-a4pb5', 'label' => 'Switch-1'],
//         ['id' => 'switch-1751975209125-2e2xg', 'label' => 'Switch-2']
//     ],

//     // 3. 需要建立的网络连接列表
//     'connections' => [
//         // ... 这里会包含5条详细的连接信息 ...
//         [
//             'source' => ['id' => 'switch-1751975197803-a4pb5', 'type' => 'switch', 'label' => 'Switch-1', 'ip' => '10.0.4.1/24', 'interface' => 'eth0'],
//             'target' => ['id' => 'container-1751975196074-gi2o2', 'type' => 'container', 'label' => 'Container-1', 'ip' => '10.0.4.2/24', 'interface' => 'eth0']
//         ],
//         // ... 其他4条连接
//     ]
// ]