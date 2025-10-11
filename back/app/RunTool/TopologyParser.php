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

            $envs = self::parseEnvPairs($config['env'] ?? null);

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
                        'teamId'       => self::extractTeamId($config),
                    ];
                    break;

                case 'virtual_machine':
                    $vmsToCreate[] = [
                        'id'           => $node['id'],
                        'label'        => $node['label'],
                        'image'        => $imageName,
                        'portMappings' => $ports,
                        'env'          => $envs,
                        'isTarget'     => $config['isTarget'] ?? false,
                        'memory'       => self::normalizePositiveInt($config['memory'] ?? null),
                        'cpu'          => self::normalizePositiveInt($config['cpu'] ?? null),
                        'teamId'       => self::extractTeamId($config),
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

    /**
     * Convert a comma-separated env string into key/value pairs.
     */
    private static function parseEnvPairs(?string $envString): array
    {
        if (empty($envString)) {
            return [];
        }

        $pairs = [];
        foreach (explode(',', $envString) as $pair) {
            $segments = explode('=', $pair, 2);
            $key = trim($segments[0] ?? '');
            $value = trim($segments[1] ?? '');
            if ($key === '') {
                continue;
            }
            $pairs[] = ['key' => $key, 'value' => $value];
        }

        return $pairs;
    }

    /**
     * Normalize numeric resource values, returning positive integers only.
     */
    private static function normalizePositiveInt($value): ?int
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

    private static function extractTeamId(array $config): ?string
    {
        $teamId = $config['teamId'] ?? null;
        if (is_string($teamId) && trim($teamId) !== '') {
            return trim($teamId);
        }
        if (is_numeric($teamId)) {
            return (string) $teamId;
        }

        $legacyAssignment = $config['teamAssignment'] ?? null;
        if (is_array($legacyAssignment)) {
            $legacyId = $legacyAssignment['id']
                ?? $legacyAssignment['teamId']
                ?? $legacyAssignment['c_id']
                ?? null;
            if ($legacyId !== null && $legacyId !== '') {
                return (string) $legacyId;
            }
        } elseif (is_string($legacyAssignment) && trim($legacyAssignment) !== '') {
            return trim($legacyAssignment);
        }

        return null;
    }
}
