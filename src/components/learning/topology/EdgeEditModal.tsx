
import React, { useState, useEffect } from 'react';
import Modal from '../../ui/Modal';
import Input from '../../ui/Input';
import Button from '../../ui/Button';
import { TopologyEdge, EdgeConfig, TopologyNode } from '../../../types';

interface EdgeEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  edge: TopologyEdge | null;
  sourceNode: TopologyNode | undefined;
  targetNode: TopologyNode | undefined;
  onSave: (edgeId: string, newConfig: EdgeConfig) => void;
}

const EdgeEditModal: React.FC<EdgeEditModalProps> = ({ isOpen, onClose, edge, sourceNode, targetNode, onSave }) => {
  const [sourceInterface, setSourceInterface] = useState('');
  const [sourceIp, setSourceIp] = useState('');
  const [targetInterface, setTargetInterface] = useState('');
  const [targetIp, setTargetIp] = useState('');
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    if (edge) {
      setSourceInterface(edge.config.sourceInterface || ''); // 使用 || '' 来处理 null
      setSourceIp(edge.config.sourceIp || '');
      setTargetInterface(edge.config.targetInterface || '');
      setTargetIp(edge.config.targetIp || '');
      setErrors({});
    }
  }, [edge]);

  const validateIp = (ip: string): boolean => {
    // Basic IP validation (IPv4 with optional CIDR)
    // This is a simplified validation
    return /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}(\/(?:[0-9]|[1-2][0-9]|3[0-2]))?$/.test(ip.trim());
  };
  
  const validateInterface = (iface: string): boolean => {
    return /^[a-zA-Z0-9]+$/.test(iface.trim());
  }

  const validate = (): boolean => {
    const newErrors: { [key: string]: string } = {};
    if (!sourceInterface.trim()) newErrors.sourceInterface = '源接口名不能为空';
    else if(!validateInterface(sourceInterface)) newErrors.sourceInterface = '源接口名格式无效';

    if (!sourceIp.trim()) newErrors.sourceIp = '源IP地址不能为空';
    else if (!validateIp(sourceIp)) newErrors.sourceIp = '源IP地址格式无效';
    
    if (!targetInterface.trim()) newErrors.targetInterface = '目标接口名不能为空';
    else if(!validateInterface(targetInterface)) newErrors.targetInterface = '目标接口名格式无效';

    if (!targetIp.trim()) newErrors.targetIp = '目标IP地址不能为空';
    else if (!validateIp(targetIp)) newErrors.targetIp = '目标IP地址格式无效';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!edge || !validate()) return;
    const newConfig: EdgeConfig = { sourceInterface, sourceIp, targetInterface, targetIp };
    onSave(edge.id, newConfig);
    onClose();
  };

  if (!edge) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`编辑连接: ${sourceNode?.label || '源'} ↔ ${targetNode?.label || '目标'}`} size="lg">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h4 className="font-semibold mb-2 text-neutral-700 dark:text-neutral-200">源: {sourceNode?.label} ({sourceNode?.type})</h4>
          <Input
            label="接口名"
            id="sourceInterface"
            value={sourceInterface}
            onChange={(e) => setSourceInterface(e.target.value)}
            error={errors.sourceInterface}
            required
            placeholder="例如: eth0"
          />
          <Input
            label="IP 地址"
            id="sourceIp"
            value={sourceIp}
            onChange={(e) => setSourceIp(e.target.value)}
            error={errors.sourceIp}
            required
            placeholder="例如: 10.0.0.1/24"
          />
        </div>
        <div>
          <h4 className="font-semibold mb-2 text-neutral-700 dark:text-neutral-200">目标: {targetNode?.label} ({targetNode?.type})</h4>
          <Input
            label="接口名"
            id="targetInterface"
            value={targetInterface}
            onChange={(e) => setTargetInterface(e.target.value)}
            error={errors.targetInterface}
            required
            placeholder="例如: eth1"
          />
          <Input
            label="IP 地址"
            id="targetIp"
            value={targetIp}
            onChange={(e) => setTargetIp(e.target.value)}
            error={errors.targetIp}
            required
            placeholder="例如: 10.0.0.2/24"
          />
        </div>
      </div>
      <div className="mt-6 flex justify-end space-x-2">
        <Button variant="secondary" onClick={onClose}>取消</Button>
        <Button variant="primary" onClick={handleSave}>保存更改</Button>
      </div>
    </Modal>
  );
};

export default EdgeEditModal;
