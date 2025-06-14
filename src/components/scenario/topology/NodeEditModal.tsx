
import React, { useState, useEffect } from 'react';
import Modal from '../../ui/Modal';
import Input from '../../ui/Input';
import Button from '../../ui/Button';
import { TopologyNode, NodeConfig } from '../../../types';

interface NodeEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  node: TopologyNode | null;
  onSave: (nodeId: string, newConfig: NodeConfig, newLabel: string) => void;
}

const NodeEditModal: React.FC<NodeEditModalProps> = ({ isOpen, onClose, node, onSave }) => {
  const [label, setLabel] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [dockerImage, setDockerImage] = useState('');
  const [portMappings, setPortMappings] = useState('');
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    if (node) {
      setLabel(node.label);
      setDeviceName(node.config.deviceName);
      setDockerImage(node.config.dockerImage);
      setPortMappings(node.config.portMappings);
      setErrors({});
    }
  }, [node]);

  const validate = (): boolean => {
    const newErrors: { [key: string]: string } = {};
    if (!label.trim()) newErrors.label = '节点名称不能为空';
    if (!deviceName.trim()) newErrors.deviceName = '设备名称不能为空';
    // Basic port mapping validation (e.g., "80:8080" or "80:8080,443:8443")
    // This is a simplified validation. A more robust one would check numbers and ranges.
    if (portMappings.trim() && !/^\d+:\d+(,\s*\d+:\d+)*$/.test(portMappings.trim())) {
      newErrors.portMappings = '端口映射格式无效 (例如: 80:8080 或 80:8080, 443:8443)';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!node || !validate()) return;
    const newConfig: NodeConfig = { deviceName, dockerImage, portMappings };
    onSave(node.id, newConfig, label);
    onClose();
  };

  if (!node) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`编辑节点: ${node?.label}`} size="lg">
      <div className="space-y-4">
        <Input
          label="节点名称 (标签)"
          id="nodeLabel"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          error={errors.label}
          required
        />
        <Input
          label="设备类型/名称"
          id="nodeDeviceName"
          value={deviceName}
          onChange={(e) => setDeviceName(e.target.value)}
          error={errors.deviceName}
          required
        />
        <Input
          label="Docker 镜像"
          id="nodeDockerImage"
          value={dockerImage}
          onChange={(e) => setDockerImage(e.target.value)}
          placeholder="例如: drone-controller:latest"
        />
        <Input
          label="端口映射"
          id="nodePortMappings"
          value={portMappings}
          onChange={(e) => setPortMappings(e.target.value)}
          error={errors.portMappings}
          placeholder="例如: 80:8080, 443:8443"
        />
      </div>
      <div className="mt-6 flex justify-end space-x-2">
        <Button variant="secondary" onClick={onClose}>取消</Button>
        <Button variant="primary" onClick={handleSave}>保存更改</Button>
      </div>
    </Modal>
  );
};

export default NodeEditModal;
