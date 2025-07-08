<?php

namespace App\RunTool;

class TopologyParser
{
    /**
     * 解析拓扑数据数组.
     *
     * @param array $topology 包含 'nodes' 和 'edges' 键的拓扑数据数组。
     * @return array 返回一个包含三个键的关联数组。
     */
    public static function parse(array $topology): array
    {
        $nodesById = [];
        foreach ($topology['nodes'] ?? [] as $node) {
            $nodesById[$node['id']] = $node;
        }

        $containersToCreate = [];
        $switchesToCreate = [];
        $connectionsToMake = [];

        // 第一次遍历：分离出所有需要创建的节点
        foreach ($topology['nodes'] ?? [] as $node) {
            $config = $node['config'] ?? [];

            switch ($node['type']) {
                case 'container':
                case 'virtual_machine':
                    // --- 解析端口映射 ---
                    // 即使有多条（如 "80:80,3306:3306"），explode 也能正确处理
                    $ports = [];
                    if (!empty($config['portMappings'])) {
                        // 1. 使用逗号将字符串分割成多个端口映射对
                        $portPairs = explode(',', $config['portMappings']);
                        foreach ($portPairs as $pair) {
                            // 2. 使用冒号将每一对分割成主机端口和容器端口
                            $parts = explode(':', $pair);
                            if (count($parts) === 2 && trim($parts[0]) && trim($parts[1])) {
                                $ports[] = ['hostPort' => trim($parts[0]), 'containerPort' => trim($parts[1])];
                            }
                        }
                    }

                    // --- 解析环境变量 ---
                    // 这里的逻辑与端口映射完全相同，可以处理多条环境变量
                    $envs = [];
                    if (!empty($config['env'])) {
                        // 1. 使用逗号将字符串分割成多个环境变量对
                        $envPairs = explode(',', $config['env']);
                        foreach ($envPairs as $pair) {
                            // 2. 使用等号将每一对分割成键和值
                            $parts = explode('=', $pair, 2); // limit 为 2，确保值中的等号不会被分割
                            if (count($parts) === 2 && trim($parts[0])) {
                                $envs[] = ['key' => trim($parts[0]), 'value' => trim($parts[1])];
                            }
                        }
                    }

                    $containersToCreate[] = [
                        'id'           => $node['id'],
                        'label'        => $node['label'],
                        'image'        => $config['dockerImage'] ?? null,
                        'portMappings' => $ports, // 返回解析后的数组
                        'env'          => $envs,  // 返回解析后的数组
                    ];
                    break;
                
                case 'switch':
                    $switchesToCreate[] = [
                        'id' => $node['id'],
                        'label' => $node['label'],
                    ];
                    break;
            }
        }

        // 第二次遍历：解析所有连接关系（保持不变）
        foreach ($topology['edges'] ?? [] as $edge) {
            $sourceNode = $nodesById[$edge['source']] ?? null;
            $targetNode = $nodesById[$edge['target']] ?? null;
            $edgeConfig = $edge['config'] ?? [];

            if (!$sourceNode || !$targetNode) continue;

            $connectionsToMake[] = [
                'source' => [
                    'id' => $sourceNode['id'], 'type' => $sourceNode['type'], 'label' => $sourceNode['label'],
                    'ip' => $edgeConfig['sourceIp'] ?? null, 'interface' => $edgeConfig['sourceInterface'] ?? 'eth0',
                ],
                'target' => [
                    'id' => $targetNode['id'], 'type' => $targetNode['type'], 'label' => $targetNode['label'],
                    'ip' => $edgeConfig['targetIp'] ?? null, 'interface' => $edgeConfig['targetInterface'] ?? 'eth0',
                ],
            ];
        }

        return [
            'containers' => $containersToCreate,
            'switches' => $switchesToCreate,
            'connections' => $connectionsToMake,
        ];
    }
}
