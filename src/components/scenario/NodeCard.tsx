import React from 'react';
import { DroneNode } from '../../types';
import Button from '../ui/Button';
import Card from '../ui/Card';
import { WifiIcon, MapPinIcon, CpuChipIcon } from '@heroicons/react/24/solid';
import { STATUS_TRANSLATIONS } from '../../constants';


interface NodeCardProps {
  node: DroneNode;
  onToggleStatus: (nodeId: string) => void;
}

const NodeCard: React.FC<NodeCardProps> = ({ node, onToggleStatus }) => {

  const getStatusColor = () => {
    switch (node.status) {
      case 'online': return 'text-green-500 dark:text-green-400';
      case 'offline': return 'text-red-500 dark:text-red-400';
      case 'compromised': return 'text-yellow-500 dark:text-yellow-400';
      case 'under-attack': return 'text-orange-500 dark:text-orange-400';
      default: return 'text-neutral-500 dark:text-neutral-400';
    }
  };

  const StatusIcon = WifiIcon; // Simplified, SignalSlashIcon could be used for offline if preferred
  const translatedStatus = STATUS_TRANSLATIONS[node.status];

  return (
    <Card className="flex flex-col h-full hover:shadow-xl transition-shadow duration-200">
      <div className="p-5 flex-grow">
        <div className="flex justify-between items-start mb-3">
          <h3 className="text-xl font-semibold text-neutral-800 dark:text-neutral-100">{node.name}</h3>
          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
            node.status === 'online' ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100' :
            node.status === 'offline' ? 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100' :
             node.status === 'compromised' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100' :
             node.status === 'under-attack' ? 'bg-orange-100 text-orange-800 dark:bg-orange-800 dark:text-orange-100' :
            'bg-neutral-100 text-neutral-800 dark:bg-neutral-700 dark:text-neutral-100'
          }`}>
            {translatedStatus}
          </span>
        </div>
        
        <div className="space-y-2 text-sm text-neutral-600 dark:text-neutral-300">
          <div className="flex items-center">
            <CpuChipIcon className="h-5 w-5 mr-2 text-neutral-400 dark:text-neutral-500" />
            <span>{`ID: ${node.id}`}</span>
          </div>
          <div className="flex items-center">
            <MapPinIcon className="h-5 w-5 mr-2 text-neutral-400 dark:text-neutral-500" />
            <span>{`IP: ${node.ipAddress} (模拟)`}</span>
          </div>
           <div className="flex items-center">
            <StatusIcon className={`h-5 w-5 mr-2 ${getStatusColor()}`} />
            <span className={getStatusColor()}>
              {node.status === 'online' ? "网络已连接" : "网络已断开"}
            </span>
          </div>
        </div>
      </div>
      <div className="p-4 bg-neutral-50 dark:bg-neutral-800/50 border-t dark:border-neutral-700 flex space-x-2">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => onToggleStatus(node.id)}
          className="w-full"
        >
          {node.status === 'online' ? "设为离线" : "设为在线"}
        </Button>
      </div>
    </Card>
  );
};

export default NodeCard;