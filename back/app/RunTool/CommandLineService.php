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
     * 通过执行 `docker run` 命令创建并启动一个容器。
     *
     * @param array $options 包含创建容器所需参数的关联数组。
     * @return string 返回新创建容器的完整ID。
     * @throws ProcessFailedException 如果命令执行失败。
     */
    public function createContainer(array $options): string
    {
        // 1. 构建 docker run 命令数组
        $command = ['docker', 'run', '-d', '--privileged']; // -d 后台运行, --privileged 给予更高权限，方便后续网络操作

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
        // 使用 Go 模板来精确提取 .State.Pid 字段
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

    // 在这里，我们未来会添加更多方法，例如：
    // public function createOvsBridge(string $bridgeName) { ... }
    // public function connectContainerToOvs(...) { ... }
    // public function removeContainer(string $containerId) { ... }
}
