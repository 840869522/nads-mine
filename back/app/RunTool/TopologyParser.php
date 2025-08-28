<?php

namespace App\RunTool;

class TopologyParser
{
    /**
     * Parse topology data array.
     *
     * @param array $topology The topology data array with 'nodes' and 'edges'.
     * @return array Returns an associative array with 'containers', 'vms', 'switches', 'connections', and 'iptablesRules'.
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
        $iptablesRules = []; // New array for iptables rules

        // First pass: separate all nodes to be created and find iptables rules
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

            $imageName = $config['Image'] ?? $config['dockerImage'] ?? null;

            switch ($node['type']) {
                case 'container':
                    $containersToCreate[] = [
                        'id'           => $node['id'],
                        'label'        => $node['label'],
                        'image'        => $imageName,
                        'portMappings' => $ports,
                        'env'          => $envs,
                        'isTarget'     => $config['isTarget'] ?? false,
                    ];
                    break;

                case 'virtual_machine':
                    $vmsToCreate[] = [
                        'id'           => $node['id'],
                        'label'        => $node['label'],
                        'image'        => $imageName,
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
                
                case 'nat_bridge':
                    if (!empty($config['iptablesRules']) && is_array($config['iptablesRules'])) {
                        $iptablesRules = $config['iptablesRules'];
                    }
                    break;
            }
        }

        // Second pass: parse all connections
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
            'containers'    => $containersToCreate,
            'vms'           => $vmsToCreate,
            'switches'      => $switchesToCreate,
            'connections'   => $connectionsToMake,
            'iptablesRules' => $iptablesRules, // Add parsed rules to the result
        ];
    }
}