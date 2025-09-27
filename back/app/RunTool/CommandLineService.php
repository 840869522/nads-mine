<?php

namespace App\RunTool;

use Symfony\Component\Process\Process;
use Symfony\Component\Process\Exception\ProcessFailedException;
use Illuminate\Support\Facades\Log;

/**
 * 命令行执行服务
 *
 * 封装所有通过命令行与系统（如 Docker, OVS）交互的逻辑。
 */
class CommandLineService
{
    /**
     * Build environment variables for VM creation scripts based on provided options.
     */
    private function buildVmProcessEnv(array $options): array
    {
        $env = [];

        $memory = $this->normalizePositiveInt($options['memory'] ?? null);
        if ($memory !== null) {
            $env['NADS_VM_MEMORY'] = (string) $memory;
        }

        $cpu = $this->normalizePositiveInt($options['cpu'] ?? null);
        if ($cpu !== null) {
            $env['NADS_VM_CPU'] = (string) $cpu;
        }

        return $env;
    }

    /**
     * Ensure user-provided numeric values are positive integers.
     */
    private function normalizePositiveInt($value): ?int
    {
        if ($value === null) {
            return null;
        }

        if (is_int($value)) {
            return $value > 0 ? $value : null;
        }

        if (is_numeric($value)) {
            $intValue = (int) $value;
            return $intValue > 0 ? $intValue : null;
        }

        if (is_string($value)) {
            $filtered = preg_replace('/[^0-9]/', '', $value);
            if ($filtered === '') {
                return null;
            }
            $intValue = (int) $filtered;
            return $intValue > 0 ? $intValue : null;
        }

        return null;
    }

       /**
     * Applies DNAT rules for port forwarding using iptables.
     *
     * @param array $rules Array of iptables rules to apply.
     * @param array $createdItemsInfo Mapping of node labels to their actual IP addresses.
     * @param array $connections Array of network connections.
     * @return void
     */
    public function applyIptablesRules(array $rules, array $createdItemsInfo, array $connections): void
    {
        $instanceIps = [];
        foreach ($connections as $conn) {
            if (!empty($conn['source']['ip'])) {
                $instanceIps[$conn['source']['label']] = explode('/', $conn['source']['ip'])[0];
            }
            if (!empty($conn['target']['ip'])) {
                $instanceIps[$conn['target']['label']] = explode('/', $conn['target']['ip'])[0];
            }
        }

        foreach ($rules as $rule) {
            $hostPort = $rule['hostPort'] ?? null;
            $instanceName = $rule['instanceName'] ?? null;
            $instancePort = $rule['instancePort'] ?? null;
            $instanceIp = $instanceIps[$instanceName] ?? null;

            if ($hostPort && $instanceName && $instancePort && $instanceIp) {
                $command = [
                    'sudo', 'iptables', '-t', 'nat', '-A', 'PREROUTING',
                    '-p', 'tcp', '--dport', $hostPort,
                    '-j', 'DNAT', '--to-destination', "{$instanceIp}:{$instancePort}"
                ];
                Log::info('Executing [iptables]: ' . implode(' ', $command));
                (new Process($command))->mustRun();
            } else {
                Log::warning('[iptables] Skipping invalid rule', ['rule' => $rule, 'found_ip' => $instanceIp]);
            }
        }
    }

    /**
     * Remove DNAT rules by hostPort from nat table for a scene instance.
     * It parses `iptables-save -t nat` to reconstruct exact rule specs and deletes them.
     *
     * @param array       $rules           Array like [['hostPort'=>8080, 'instanceName'=>'X', 'instancePort'=>80], ...]
     * @param string|null $sceneInstanceId Optional, used if you maintain per-instance chains in future; for now we always look into PREROUTING.
     */
    public function removeIptablesRulesByHostPorts(array $rules, ?string $sceneInstanceId = null): void
    {
        // 1) Collect unique host ports from rules
        $hostPorts = [];
        foreach ($rules as $r) {
            $hp = $r['hostPort'] ?? null;
            if ($hp !== null && $hp !== '') {
                $hostPorts[(string)$hp] = true;
            }
        }
        if (empty($hostPorts)) {
            Log::info('[iptables] No hostPorts to remove');
            return;
        }

        // 2) Determine chains to inspect: per-instance chain (optional) and PREROUTING as fallback
        $chains = [];
        if (!empty($sceneInstanceId)) {
            $chains[] = $this->getNatChainName($sceneInstanceId);
        }
        $chains[] = 'PREROUTING';

        // 3) Dump NAT table and collect matching rules
        $dumpCmd = ['sudo', 'iptables-save', '-t', 'nat'];
        $proc = new Process($dumpCmd);
        $proc->run();
        if (!$proc->isSuccessful()) {
            Log::error('[iptables] Failed to run iptables-save for cleanup', ['error' => $proc->getErrorOutput()]);
            return; // fail-soft
        }

        $lines = preg_split('/\r?\n/', $proc->getOutput());
        $toDelete = [];
        foreach ($lines as $line) {
            $line = trim($line);
            if ($line === '' || !str_starts_with($line, '-A ')) continue;

            // Example line: -A PREROUTING -p tcp -m tcp --dport 8080 -j DNAT --to-destination 10.100.0.2:80
            $parts = preg_split('/\s+/', $line);
            if (count($parts) < 4) continue;
            $chain = $parts[1] ?? '';
            if (!in_array($chain, $chains, true)) continue;

            // Quick filters
            if (strpos($line, '-j DNAT') === false) continue;
            if (strpos($line, '--dport') === false) continue;

            // Find hostPort in line
            foreach (array_keys($hostPorts) as $hp) {
                if (preg_match('/--dport\s+' . preg_quote($hp, '/') . '(\s|$)/', $line)) {
                    // collect args excluding "-A <CHAIN>"
                    $args = array_slice($parts, 2);
                    $toDelete[] = ['chain' => $chain, 'args' => $args, 'raw' => $line];
                    break;
                }
            }
        }

        // 4) Delete collected rules (dedupe identical specs)
        $seen = [];
        foreach ($toDelete as $item) {
            $key = $item['chain'] . '|' . implode(' ', $item['args']);
            if (isset($seen[$key])) continue; // avoid double delete
            $seen[$key] = true;

            $cmd = array_merge(['sudo', 'iptables', '-t', 'nat', '-D', $item['chain']], $item['args']);
            Log::info('[iptables] Deleting rule: ' . implode(' ', $cmd));
            $p = new Process($cmd);
            $p->run();
            if (!$p->isSuccessful()) {
                Log::warning('[iptables] Failed to delete rule (may be already gone)', [
                    'raw' => $item['raw'],
                    'error' => $p->getErrorOutput(),
                ]);
            }
        }
    }

    /**
     * Build per-scene NAT chain name.
     */
    private function getNatChainName(string $sceneInstanceId): string
    {
        $clean = preg_replace('/[^A-Za-z0-9]/', '', $sceneInstanceId) ?? '';
        $suffix = substr($clean, -8) ?: $clean;
        return 'NADS_' . $suffix;
    }
     /**
     * 为网桥配置IP地址，并为容器设置默认路由。
     *
     * @param string $bridgeName      要配置的网桥名称 (e.g., 'br0')
     * @param string $gatewayIp       要分配给网桥的网关IP地址 (e.g., '10.100.0.254/16')
     * @param array  $containers      需要配置路由的容器列表，格式: [['name' => 'C1_xxx', 'ip' => '10.100.0.9/16'], ...]
     * @return void
     */
    public function configureBridgeAndRoutes(string $bridgeName, string $gatewayIp, array $containers): void
    {
        // 1. 为 Linux Bridge 配置 IP 地址
        $gatewayIpOnly = explode('/', $gatewayIp)[0];
        $networkCidr = explode('/', $gatewayIp)[1] ?? '16';
        $networkBase = substr($gatewayIpOnly, 0, strrpos($gatewayIpOnly, '.'));
        $networkCidrFull = $networkBase . '.0/' . $networkCidr;
        
        // $commandConfigBridge = ['sudo', 'ip', 'addr', 'add', $gatewayIp, 'dev', $bridgeName];
        // Log::info("Executing [IP-Config]: Configuring gateway IP for {$bridgeName}: " . implode(' ', $commandConfigBridge));

        // $processConfigBridge = new Process($commandConfigBridge);
        // $processConfigBridge->run();
        // // 如果IP已存在，忽略错误，否则抛出异常
        // if (!$processConfigBridge->isSuccessful() && !str_contains($processConfigBridge->getErrorOutput(), 'File exists')) {
        //     throw new ProcessFailedException($processConfigBridge);
        // }

        // 2. 配置NAT转发规则，让容器能够访问外网
        $this->configureNatRules($networkCidrFull, $bridgeName);

        // 3. 循环为每个容器配置默认路由（使用 replace 避免 File exists 错误，保证幂等）
        foreach ($containers as $container) {
            $containerName = $container['name'];
            // 使用 ip route replace，若不存在则新增，存在则覆盖，避免重复添加报错
            $commandReplaceRoute = ['sudo', 'docker', 'exec', $containerName, 'ip', 'route', 'replace', 'default', 'via', $gatewayIpOnly];
            Log::info("Executing [IP-Config]: Replacing default route for container {$containerName} via {$gatewayIpOnly}");
            (new Process($commandReplaceRoute))->mustRun();
        }
    }

    /**
     * 配置NAT转发规则，让指定网段的容器能够访问外网
     *
     * @param string $networkCidr 网络CIDR (e.g., '10.100.0.0/16')
     * @param string $bridgeName 网桥名称 (e.g., 'br0')
     * @return void
     */
    private function configureNatRules(string $networkCidr, string $bridgeName): void
    {
        try {
            // 检查规则是否已存在，避免重复添加
            if ($this->isNatRuleExists($networkCidr, $bridgeName)) {
                Log::info("NAT rules for {$networkCidr} already exist, skipping configuration");
                return;
            }

            // 1. 添加MASQUERADE规则，让容器网段的流量能够通过NAT访问外网
            $masqueradeCommand = [
                'sudo', 'iptables', '-t', 'nat', '-A', 'POSTROUTING',
                '-s', $networkCidr,
                '-o', $bridgeName,
                '-j', 'MASQUERADE'
            ];
            
            Log::info("Executing [NAT-Config]: Adding MASQUERADE rule for {$networkCidr} via {$bridgeName}: " . implode(' ', $masqueradeCommand));
            
            $process = new Process($masqueradeCommand);
            $process->run();
            
            if (!$process->isSuccessful()) {
                Log::warning("Failed to add MASQUERADE rule: " . $process->getErrorOutput());
            } else {
                Log::info("Successfully added MASQUERADE rule for {$networkCidr}");
            }

            // 2. 确保FORWARD链允许转发
            $forwardCommand = [
                'sudo', 'iptables', '-A', 'FORWARD',
                '-s', $networkCidr,
                '-j', 'ACCEPT'
            ];
            
            Log::info("Executing [NAT-Config]: Adding FORWARD rule for {$networkCidr}: " . implode(' ', $forwardCommand));
            
            $process = new Process($forwardCommand);
            $process->run();
            
            if (!$process->isSuccessful()) {
                Log::warning("Failed to add FORWARD rule: " . $process->getErrorOutput());
            } else {
                Log::info("Successfully added FORWARD rule for {$networkCidr}");
            }

            // 3. 允许返回流量
            $returnCommand = [
                'sudo', 'iptables', '-A', 'FORWARD',
                '-d', $networkCidr,
                '-j', 'ACCEPT'
            ];
            
            Log::info("Executing [NAT-Config]: Adding return FORWARD rule for {$networkCidr}: " . implode(' ', $returnCommand));
            
            $process = new Process($returnCommand);
            $process->run();
            
            if (!$process->isSuccessful()) {
                Log::warning("Failed to add return FORWARD rule: " . $process->getErrorOutput());
            } else {
                Log::info("Successfully added return FORWARD rule for {$networkCidr}");
            }

        } catch (\Exception $e) {
            Log::error("Failed to configure NAT rules: " . $e->getMessage());
            throw $e;
        }
    }

    /**
     * 检查NAT规则是否已存在
     *
     * @param string $networkCidr 网络CIDR (e.g., '10.100.0.0/16')
     * @param string $bridgeName 网桥名称 (e.g., 'br0')
     * @return bool
     */
    private function isNatRuleExists(string $networkCidr, string $bridgeName): bool
    {
        try {
            // 检查MASQUERADE规则是否存在
            $checkCommand = [
                'sudo', 'iptables', '-t', 'nat', '-C', 'POSTROUTING',
                '-s', $networkCidr,
                '-o', $bridgeName,
                '-j', 'MASQUERADE'
            ];
            
            $process = new Process($checkCommand);
            $process->run();
            
            // 如果命令成功执行（退出码0），说明规则已存在
            return $process->isSuccessful();
            
        } catch (\Exception $e) {
            Log::warning("Failed to check NAT rule existence: " . $e->getMessage());
            return false; // 如果检查失败，假设规则不存在，继续添加
        }
    }
    //交换机和br0连接
    public function connectSwitchToBr0(string $ovsSwitchName, string $linuxBridgeName): void
    {
        // 1. 根据OVS交换机和Linux Bridge的名称，生成veth pair的端口名
        // 使用哈希值确保名称的唯一性和规范性
        $ovsHash = substr(md5($ovsSwitchName), 0, 4);
        $brHash = substr(md5($linuxBridgeName), 0, 4);
        $portForOvs = "veth-{$ovsHash}-{$brHash}";
        $portForBridge = "veth-{$brHash}-{$ovsHash}";

        // 2. 创建veth pair ("虚拟网线")
        $commandCreateVeth = ['sudo', 'ip', 'link', 'add', $portForOvs, 'type', 'veth', 'peer', 'name', $portForBridge];
        Log::info("Executing [OVS-to-Bridge]: " . implode(' ', $commandCreateVeth));
        try {
            (new Process($commandCreateVeth))->mustRun();
        } catch (ProcessFailedException $e) {
            // 如果接口已存在，这可能不是一个致命错误，记录警告后继续
            if (str_contains($e->getProcess()->getErrorOutput(), 'File exists')) {
                Log::warning("Could not create veth pair {$portForOvs}<->{$portForBridge}. It already exists. Continuing...");
            } else {
                throw $e; // 其他错误则抛出
            }
        }

        // 3. 将veth pair的一端添加到OVS交换机
        $commandAddPortOvs = ['sudo', 'ovs-vsctl', 'add-port', $ovsSwitchName, $portForOvs];
        Log::info("Executing [OVS-to-Bridge]: " . implode(' ', $commandAddPortOvs));
        (new Process($commandAddPortOvs))->mustRun();

        // 4. 【关键区别】将veth pair的另一端添加到Linux Bridge
        $commandAddPortBridge = ['sudo', 'brctl', 'addif', $linuxBridgeName, $portForBridge];
        Log::info("Executing [OVS-to-Bridge]: " . implode(' ', $commandAddPortBridge));
        (new Process($commandAddPortBridge))->mustRun();

        // 5. 启动这两个新创建的端口
        $commandLinkUpOvs = ['sudo', 'ip', 'link', 'set', $portForOvs, 'up'];
        Log::info("Executing [OVS-to-Bridge]: " . implode(' ', $commandLinkUpOvs));
        (new Process($commandLinkUpOvs))->mustRun();

        $commandLinkUpBridge = ['sudo', 'ip', 'link', 'set', $portForBridge, 'up'];
        Log::info("Executing [OVS-to-Bridge]: " . implode(' ', $commandLinkUpBridge));
        (new Process($commandLinkUpBridge))->mustRun();
    }

    /**
     * 需要定义脚本位置全局
     * 通过调用外部Shell脚本创建虚拟机并将其连接到指定的交换机。
     *
     * @param array $options 包含创建虚拟机所需参数的关联数组。
     * - 'id': 数据库自增ID (用于脚本的num参数)
     * - 'image': 镜像名称
     * - 'ip': 虚拟机的IP地址
     * - 'scene_instance_id': 场景实例ID
     * - 'flag': 靶机flag, 或 "NULL" 字符串
     * - 'switch_name': 要连接的OVS交换机的名称
     * - 'vm_name': 虚拟机名称
     * - 'image_dir': 基础镜像的存放目录
     * - 'instance_base_dir': 虚拟机实例的存放根目录
     * @return void
     * @throws ProcessFailedException 如果命令执行失败。
     */
    public function createVm(array $options): void
    {
        // 1. 使用 app_path() 生成脚本的绝对路径
        $scriptPath = app_path('RunTool/vmscript/newvm_switch.sh');

        // 2. 准备9个命令行参数
        $args = [
            $options['id'],
            $options['image'],
            $options['ip'],
            $options['scene_instance_id'],
            $options['flag'] ?? 'NULL',
            $options['switch_name'],
            $options['vm_name'],
            $options['image_dir'],
            $options['instance_base_dir'],
        ];

        // 3. 准备并执行命令
        $command = array_merge([$scriptPath], $args);
        Log::info('Executing VM creation shell script (9-param version): ' . implode(' ', $command));

        $env = $this->buildVmProcessEnv($options);
        if (!empty($env)) {
            Log::info('Applying VM resource overrides', ['vm' => $options['vm_name'] ?? $options['id'] ?? null, 'overrides' => $env]);
        }

        $process = new Process($command, null, empty($env) ? null : $env);
        $process->setTimeout(360);
        $process->run();

        if (!$process->isSuccessful()) {
            $errorOutput = $process->getErrorOutput() ?: $process->getOutput();
            Log::error("Failed to execute VM creation script for vm '{$options['id']}'", [
                'error' => $errorOutput,
            ]);
            throw new ProcessFailedException($process);
        }

        Log::info("VM creation script for vm '{$options['id']}' executed successfully.", [
            'output' => $process->getOutput()
        ]);
    }




    /**
     *
     * 使用veth pair连接两个OVS交换机。
     *
     * @param string $switch1Name 第一个交换机的名称
     * @param string $switch2Name 第二个交换机的名称
     * @return void
     * @throws ProcessFailedException
     */
    public function connectSwitchToSwitch(string $switch1Name, string $switch2Name): void
    {
        // 1. 根据两个交换机的名称，生成veth pair的端口名
        // 为了确保名称符合Linux接口规范且唯一，我们使用简化的名称加哈希值
        $s1Hash = substr(md5($switch1Name), 0, 4);
        $s2Hash = substr(md5($switch2Name), 0, 4);
        $port1 = "veth-{$s1Hash}-{$s2Hash}";
        $port2 = "veth-{$s2Hash}-{$s1Hash}";

        // 2. 创建veth pair
        $commandCreateVeth = ['sudo', 'ip', 'link', 'add', $port1, 'type', 'veth', 'peer', 'name', $port2];
        Log::info('Executing [Switch-to-Switch]: ' . implode(' ', $commandCreateVeth));
        $processCreateVeth = new Process($commandCreateVeth);
        $processCreateVeth->run();
        if (!$processCreateVeth->isSuccessful()) {
            // 如果接口已存在，这可能不是一个致命错误，先记录日志
            Log::warning("Could not create veth pair {$port1}<->{$port2}. Maybe it already exists?", [
                'error' => $processCreateVeth->getErrorOutput()
            ]);
        }

        // 3. 将veth pair的两端分别添加到两个交换机中
        $commandAddPort1 = ['sudo', 'ovs-vsctl', 'add-port', $switch1Name, $port1];
        Log::info('Executing [Switch-to-Switch]: ' . implode(' ', $commandAddPort1));
        (new Process($commandAddPort1))->mustRun();

        $commandAddPort2 = ['sudo', 'ovs-vsctl', 'add-port', $switch2Name, $port2];
        Log::info('Executing [Switch-to-Switch]: ' . implode(' ', $commandAddPort2));
        (new Process($commandAddPort2))->mustRun();


        // 4. 启动这两个新创建的端口
        $commandLinkUp1 = ['sudo', 'ip', 'link', 'set', $port1, 'up'];
        Log::info('Executing [Switch-to-Switch]: ' . implode(' ', $commandLinkUp1));
        (new Process($commandLinkUp1))->mustRun();

        $commandLinkUp2 = ['sudo', 'ip', 'link', 'set', $port2, 'up'];
        Log::info('Executing [Switch-to-Switch]: ' . implode(' ', $commandLinkUp2));
        (new Process($commandLinkUp2))->mustRun();
    }

    /**
     * 断开两个OVS交换机之间的连接。
     * 仿照Python版本的disconnectS2S方法实现。
     *
     * @param string $switch1Name 第一个交换机的名称
     * @param string $switch2Name 第二个交换机的名称
     * @return void
     * @throws ProcessFailedException
     */
    public function disconnectSwitchToSwitch(string $switch1Name, string $switch2Name): void
    {
        // 1. 根据两个交换机的名称，生成veth pair的端口名（与连接时保持一致）
        $s1Hash = substr(md5($switch1Name), 0, 4);
        $s2Hash = substr(md5($switch2Name), 0, 4);
        $port1 = "veth-{$s1Hash}-{$s2Hash}";
        $port2 = "veth-{$s2Hash}-{$s1Hash}";

        Log::info("开始断开交换机连接: {$switch1Name} <-> {$switch2Name}", [
            'port1' => $port1,
            'port2' => $port2
        ]);

        // 2. 删除veth pair的端口（从OVS中移除）
        $commandDelPort = ['sudo', 'ovs-vsctl', 'del-port', $port1, '--', 'del-port', $port2];
        Log::info('Executing [Disconnect Switch-to-Switch]: ' . implode(' ', $commandDelPort));
        $processDelPort = new Process($commandDelPort);
        $processDelPort->run();
        
        if (!$processDelPort->isSuccessful()) {
            $errorOutput = $processDelPort->getErrorOutput();
            // 如果端口不存在，记录警告但不抛出异常
            if (str_contains($errorOutput, 'no port named') || str_contains($errorOutput, 'no bridge named')) {
                Log::warning("尝试删除不存在的端口或网桥: {$port1}, {$port2}");
            } else {
                Log::warning("删除OVS端口时出现错误: " . $errorOutput);
            }
        }

        // 3. 删除网络接口
        $commandDelLink1 = ['sudo', 'ip', 'link', 'del', $port1];
        Log::info('Executing [Disconnect Switch-to-Switch]: ' . implode(' ', $commandDelLink1));
        $processDelLink1 = new Process($commandDelLink1);
        $processDelLink1->run();
        
        if (!$processDelLink1->isSuccessful()) {
            $errorOutput = $processDelLink1->getErrorOutput();
            // 如果接口不存在，记录警告但不抛出异常
            if (str_contains($errorOutput, 'Cannot find device') || str_contains($errorOutput, 'No such device')) {
                Log::warning("尝试删除不存在的网络接口: {$port1}");
            } else {
                Log::warning("删除网络接口时出现错误: " . $errorOutput);
            }
        }

        Log::info("成功断开交换机连接: {$switch1Name} <-> {$switch2Name}");
    }

    /**
     *
     * 将一个容器连接到一个OVS交换机上，严格最新的命名规则。
     *
     * @param string      $switchName      参数1: 交换机的名称
     * @param string      $containerName   参数3: 容器的名称
     * @param string|null $ipAddress       参数4: 分配给容器的IP地址
     *
     * @return void
     * @throws ProcessFailedException 如果命令执行失败。
     */
    public function connectContainerToSwitch(string $switchName, string $containerName, ?string $ipAddress = null): void
    {
        // === 生成参数2：新生成的pair名称 ===

        // 1. 处理交换机名称部分
        $baseSwitchName = explode('_', $switchName)[0];
        $switchPrefix = substr($baseSwitchName, 0, 2); // 交换机前两个字符
        $switchSuffix = substr($baseSwitchName, -2);   // 交换机最后一个字符
        $switchPart = $switchPrefix . $switchSuffix;

        // 2. 处理容器名称部分
        $baseContainerName = explode('_', $containerName)[0];
        $containerPrefix = substr($baseContainerName, 0, 2); // 容器前两个字符
        $containerSuffix = substr($baseContainerName, -2);   // 容器最后一个字符
        $containerPart = $containerPrefix . $containerSuffix;

        // 3. 交换机唯一哈希部分
        $switchHash = substr(explode('_', $switchName)[1] ?? '', -4);

        // 4. 拼接成最终的配对名称 (e.g., "SwhCo1da10")
        $pairName = $switchPart . $containerPart . $switchHash;

        // === 构建严格的四参数命令 ===
        $command = [
            'sudo',
            'ovs-docker',
            'add-port',
            $switchName,      // 参数1: 交换机名称
            $pairName,        // 参数2: 新生成的pair名称
            $containerName,   // 参数3: 容器名称
        ];

        // 添加可选的IP地址参数
        if ($ipAddress) {
            $command[] = '--ipaddress=' . $ipAddress; // 参数4
        }

        Log::info('Executing OVS network connection command (V4 Rule): ' . implode(' ', $command));

        $process = new Process($command);
        $process->run();

        if (!$process->isSuccessful()) {
            Log::error("Failed to connect container '{$containerName}' to switch '{$switchName}'", [
                'error' => $process->getErrorOutput(),
                'output' => $process->getOutput(),
            ]);
            throw new ProcessFailedException($process);
        }
    }


    /**
     *
     * 删除一个 OVS 网桥。
     *
     * @param string $switchName 要删除的网桥的名称。
     * @return void
     * @throws ProcessFailedException 如果命令执行失败（且不是因为网桥本就不存在）。
     */
    public function deleteSwitch(string $switchName): void
    {
        $command = ['sudo', 'ovs-vsctl', 'del-br', $switchName];
        Log::info('Executing OVS command: ' . implode(' ', $command));
        $process = new Process($command);
        $process->run();

        if (!$process->isSuccessful()) {
            // 如果错误是因为网桥已经不存在，我们不认为这是一个致命错误，
            // 只记录一个警告即可。对于其他错误，则抛出异常。
            $errorOutput = $process->getErrorOutput();
            if (str_contains($errorOutput, 'no bridge named')) {
                Log::warning("尝试删除一个不存在的 OVS 网桥: {$switchName}");
            } else {
                 throw new ProcessFailedException($process);
            }
        }
    }
    /**
     * 创建一个 OVS (Open vSwitch) 网桥。
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
        $command = ['sudo', 'ovs-vsctl', 'add-br', $switchName];

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

        Log::info('Executing OVS command: ' . implode(' ', $command));

        // 5. 执行命令
        $process = new Process($command);
        $process->run();

        // 6. 检查是否成功
        if (!$process->isSuccessful()) {
            throw new ProcessFailedException($process);
        }
        // 2. 为新的 OVS 网桥定义一个 libvirt 网络
        $networkXmlPath = "/tmp/{$switchName}-net.xml";
        $networkXmlContent = <<<XML
<network>
  <name>{$switchName}</name>
  <forward mode='bridge'/>
  <bridge name='{$switchName}'/>
  <virtualport type='openvswitch'/>
</network>
XML;

        // 写入临时的 XML 配置文件
        file_put_contents($networkXmlPath, $networkXmlContent);

        // 3. 使用 virsh 命令定义、自启动并启动网络
        // 定义网络，如果网络已存在则忽略错误
        $netDefineCmd = ['sudo', 'virsh', 'net-define', $networkXmlPath];
        Log::info('Executing libvirt command: ' . implode(' ', $netDefineCmd));
        $netDefineProcess = new Process($netDefineCmd);
        $netDefineProcess->run();
        if (!$netDefineProcess->isSuccessful() && !str_contains($netDefineProcess->getErrorOutput(), 'already exists')) {
            throw new ProcessFailedException($netDefineProcess);
        }

        // 设置网络为自启动，如果已配置则忽略错误
        $netAutostartCmd = ['sudo', 'virsh', 'net-autostart', $switchName];
        Log::info('Executing libvirt command: ' . implode(' ', $netAutostartCmd));
        $netAutostartProcess = new Process($netAutostartCmd);
        $netAutostartProcess->run();
        if (!$netAutostartProcess->isSuccessful() && !str_contains($netAutostartProcess->getErrorOutput(), 'already configured')) {
            throw new ProcessFailedException($netAutostartProcess);
        }

        // 启动网络，如果已激活则忽略错误
        $netStartCmd = ['sudo', 'virsh', 'net-start', $switchName];
        Log::info('Executing libvirt command: ' . implode(' ', $netStartCmd));
        $netStartProcess = new Process($netStartCmd);
        $netStartProcess->run();
        if (!$netStartProcess->isSuccessful() && !str_contains($netStartProcess->getErrorOutput(), 'already active')) {
            throw new ProcessFailedException($netStartProcess);
        }

        // 4. 清理临时的 XML 文件
        unlink($networkXmlPath);
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
        $command = ['sudo', 'docker', 'run', '-itd', '--privileged', '--cap-add=NET_RAW']; // -d 后台运行, --privileged 给予更高权限，方便后续网络操作

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
    // 检查是否存在场景实例ID，如果存在，则将其与容器名拼接后添加为环境变量
    if (!empty($options['scene_instance_id']) && !empty($options['name'])) {
        $command[] = '-e';
        // 将环境变量 SCENE_ID 的值设置为 "容器名_场景实例ID" 的格式
        $command[] = "SCENE_ID={$options['scene_instance_id']}_{$options['name']}";
    }

        // c. 添加端口映射
        foreach ($options['ports'] ?? [] as $port) {
            $command[] = '-p';
            $command[] = "{$port['hostPort']}:{$port['containerPort']}";
        }

        // d. 设置网络模式为 none，这是后续手动连接的关键
        // 检查镜像名称，如果是特定的数据库镜像则不设置网络模式
        $skipNetworkImages = [
            'd_tar_oralcercedb35:v3',
            'd_tar_oralcepasswd10:v1',
            'd_tar_oraclepasswd10:v1',
            'd_att_oraclerce15',
            'd_tar_oraclerce24:v2',
            'd_tar_oraclerce15:v1',
            'px4-image:latest',
            'px4pro2-image:latest',
            'px4pro-image:latest',
            'px4-image1:latest',
            'px4-image1:v1',
        ];
        if (!in_array($options['image'], $skipNetworkImages)) {
            $command[] = '--network=none';
        }

        // e. 添加镜像名称（必须是命令的最后一部分）
        if (empty($options['image'])) {
            throw new \Exception('镜像名称不能为空。');
        }
        $command[] = $options['image'];

        Log::info('Executing Docker command: ' . implode(' ', $command));

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

        $command = ['sudo', 'docker', 'inspect', '-f', '{{.State.Pid}}', $containerId];
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
        $command = ['sudo', 'ovs-vsctl', 'list-br'];
        $process = new Process($command);
        $process->run();

        if (!$process->isSuccessful()) {
            throw new ProcessFailedException($process);
        }

        // 将输出的字符串按行分割，并过滤掉空行
        $output = trim($process->getOutput());
        return empty($output) ? [] : explode("\n", $output);
    }
    public function createVmWin7(array $options): void
{
    // 指向新的 win7 脚本
    $scriptPath = app_path('RunTool/vmscript/newvm_win7.sh');

    $args = [
        $options['id'],
        $options['image'],
        $options['ip'],
        $options['scene_instance_id'],
        $options['flag'] ?? 'NULL',
        $options['switch_name'],
        $options['vm_name'],
        $options['image_dir'],
        $options['instance_base_dir'],
    ];

    $command = array_merge([$scriptPath], $args);
    Log::info('Executing Windows VM creation shell script: ' . implode(' ', $command));

    $env = $this->buildVmProcessEnv($options);
    if (!empty($env)) {
        Log::info('Applying VM resource overrides', ['vm' => $options['vm_name'] ?? $options['id'] ?? null, 'overrides' => $env]);
    }

    $process = new Process($command, null, empty($env) ? null : $env);
    $process->setTimeout(360); // Windows启动可能较慢，设置更长的超时
    $process->mustRun(); // 如果失败则抛出异常

    Log::info("Windows VM creation script for vm '{$options['vm_name']}' executed successfully.", [
        'output' => $process->getOutput()
    ]);
}

    public function createVmWin7_1(array $options): void
{
    // 指向新的 win7_1 脚本
    $scriptPath = app_path('RunTool/vmscript/newvm_win7_1.sh');

    $args = [
        $options['id'],
        $options['image'],
        $options['switch_name'],
        $options['vm_name'],
        $options['image_dir'],
        $options['instance_base_dir'],
    ];

    $command = array_merge([$scriptPath], $args);
    Log::info('Executing Windows VM creation shell script (win7_1): ' . implode(' ', $command));

    $env = $this->buildVmProcessEnv($options);
    if (!empty($env)) {
        Log::info('Applying VM resource overrides', ['vm' => $options['vm_name'] ?? $options['id'] ?? null, 'overrides' => $env]);
    }

    $process = new Process($command, null, empty($env) ? null : $env);
    $process->setTimeout(360); // Windows启动可能较慢，设置更长的超时
    $process->mustRun(); // 如果失败则抛出异常

    Log::info("Windows VM creation script (win7_1) for vm '{$options['vm_name']}' executed successfully.", [
        'output' => $process->getOutput()
    ]);
}

    public function createVmWin2003(array $options): void
{
    // 指向新的 win2003 脚本
    $scriptPath = app_path('RunTool/vmscript/newvm_win_2003.sh');

    $args = [
        $options['id'],
        $options['image'],
        $options['switch_name'],
        $options['vm_name'],
        $options['image_dir'],
        $options['instance_base_dir'],
    ];

    $command = array_merge([$scriptPath], $args);
    Log::info('Executing Windows VM creation shell script (win2003): ' . implode(' ', $command));

    $env = $this->buildVmProcessEnv($options);
    if (!empty($env)) {
        Log::info('Applying VM resource overrides', ['vm' => $options['vm_name'] ?? $options['id'] ?? null, 'overrides' => $env]);
    }

    $process = new Process($command, null, empty($env) ? null : $env);
    $process->setTimeout(360); // Windows启动可能较慢，设置更长的超时
    $process->mustRun(); // 如果失败则抛出异常

    Log::info("Windows VM creation script (win2003) for vm '{$options['vm_name']}' executed successfully.", [
        'output' => $process->getOutput()
    ]);
}

    public function createVmWin10(array $options): void
{
    // 指向新的 win10 脚本
    $scriptPath = app_path('RunTool/vmscript/newvm_win10.sh');

    $args = [
        $options['id'],
        $options['image'],
        $options['switch_name'],
        $options['vm_name'],
        $options['image_dir'],
        $options['instance_base_dir'],
    ];

    $command = array_merge([$scriptPath], $args);
    Log::info('Executing Windows VM creation shell script (win10): ' . implode(' ', $command));

    $env = $this->buildVmProcessEnv($options);
    if (!empty($env)) {
        Log::info('Applying VM resource overrides', ['vm' => $options['vm_name'] ?? $options['id'] ?? null, 'overrides' => $env]);
    }

    $process = new Process($command, null, empty($env) ? null : $env);
    $process->setTimeout(360); // Windows启动可能较慢，设置更长的超时
    $process->mustRun(); // 如果失败则抛出异常

    Log::info("Windows VM creation script (win10) for vm '{$options['vm_name']}' executed successfully.", [
        'output' => $process->getOutput()
    ]);
    }

    public function createVmKylin(array $options): void
    {
    // 指向麒麟脚本（与 win7_1 一致的6参数顺序）
    $scriptPath = app_path('RunTool/vmscript/newvm_ql');

    $args = [
        $options['id'],
        $options['image'],
        $options['switch_name'],
        $options['vm_name'],
        $options['image_dir'],
        $options['instance_base_dir'],
    ];

    $command = array_merge([$scriptPath], $args);
    Log::info('Executing Kylin VM creation shell script: ' . implode(' ', $command));

    $env = $this->buildVmProcessEnv($options);
    if (!empty($env)) {
        Log::info('Applying VM resource overrides', ['vm' => $options['vm_name'] ?? $options['id'] ?? null, 'overrides' => $env]);
    }

    $process = new Process($command, null, empty($env) ? null : $env);
    $process->setTimeout(360);
    $process->mustRun();

    Log::info("Kylin VM creation script for vm '{$options['vm_name']}' executed successfully.", [
        'output' => $process->getOutput()
    ]);
    }

    public function createVmKali(array $options): void
    {
    // 指向 Kali Linux 脚本（使用 newvm_kali.sh）
    $scriptPath = app_path('RunTool/vmscript/newvm_kali.sh');

    $args = [
        $options['id'],
        $options['image'],
        $options['ip'],
        $options['scene_instance_id'],
        $options['flag'] ?? 'NULL',
        $options['switch_name'],
        $options['vm_name'],
        $options['image_dir'],
        $options['instance_base_dir'],
    ];

    $command = array_merge([$scriptPath], $args);
    Log::info('Executing Kali Linux VM creation shell script: ' . implode(' ', $command));

    $env = $this->buildVmProcessEnv($options);
    if (!empty($env)) {
        Log::info('Applying VM resource overrides', ['vm' => $options['vm_name'] ?? $options['id'] ?? null, 'overrides' => $env]);
    }

    $process = new Process($command, null, empty($env) ? null : $env);
    $process->setTimeout(360);
    $process->mustRun();

    Log::info("Kali Linux VM creation script for vm '{$options['vm_name']}' executed successfully.", [
        'output' => $process->getOutput()
    ]);
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
