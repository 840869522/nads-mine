<?php

namespace App\RunTool;

class TopologyParser
{
    /**
     * 解析拓扑数据数组.
     *
     * @param array $topology 包含 'nodes' 和 'edges' 键的拓扑数据数组。
     * @return array 返回一个包含四个键的关联数组: 'containers', 'vms', 'switches', 'connections'。
     */
    public static function parse(array $topology): array
    {
        $nodesById = [];
        foreach ($topology['nodes'] ?? [] as $node) {
            $nodesById[$node['id']] = $node;
        }

        $containersToCreate = [];
        $vmsToCreate = [];
        $switchesToCreate = [];
        $connectionsToMake = [];

        // 第一次遍历：分离出所有需要创建的节点
        foreach ($topology['nodes'] ?? [] as $node) {
            $config = $node['config'] ?? [];
            
            $ports = [];
            if (!empty($config['portMappings'])) {
                $portPairs = explode(',', $config['portMappings']);
                foreach ($portPairs as $pair) {
                    $parts = explode(':', $pair);
                    if (count($parts) === 2 && trim($parts[0]) && trim($parts[1])) {
                        $ports[] = ['hostPort' => trim($parts[0]), 'containerPort' => trim($parts[1])];
                    }
                }
            }

            $envs = [];
            if (!empty($config['env'])) {
                $envPairs = explode(',', $config['env']);
                foreach ($envPairs as $pair) {
                    $parts = explode('=', $pair, 2);
                    if (count($parts) === 2 && trim($parts[0])) {
                        $envs[] = ['key' => trim($parts[0]), 'value' => trim($parts[1])];
                    }
                }
            }
            
            // 【关键逻辑】优先使用 'Image' 键，如果不存在则使用 'dockerImage' 作为备用
            $imageName = $config['Image'] ?? $config['dockerImage'] ?? null;

            switch ($node['type']) {
                case 'container':
                    $containersToCreate[] = [
                        'id'           => $node['id'],
                        'label'        => $node['label'],
                        'image'        => $imageName, // 使用修正后的镜像名
                        'portMappings' => $ports,
                        'env'          => $envs,
                        'isTarget'     => $config['isTarget'] ?? false,
                    ];
                    break;

                case 'virtual_machine':
                    $vmsToCreate[] = [
                        'id'           => $node['id'],
                        'label'        => $node['label'],
                        'image'        => $imageName, // 使用修正后的镜像名
                        'portMappings' => $ports,
                        'isTarget'     => $config['isTarget'] ?? false,
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
            'vms'        => $vmsToCreate,
            'switches'   => $switchesToCreate,
            'connections'=> $connectionsToMake,
        ];
    }
}
