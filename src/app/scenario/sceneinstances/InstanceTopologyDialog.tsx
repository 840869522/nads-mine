"use client";
import React from 'react';
import { Dialog, DialogTitle, DialogContent, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import TopologyEditor from '@/components/scenario/topology/TopologyEditor';
import { TopologyData } from '@/types';

interface InstanceTopologyDialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  topology: TopologyData | null | undefined;
}

// 只做展示：复用 TopologyEditor，与 ScenarioEditDialog 一致的展示方式
const InstanceTopologyDialog: React.FC<InstanceTopologyDialogProps> = ({ open, onClose, title, topology }) => {
  const initialData = topology
    ? { id: 'instance-topology', name: title || '实例拓扑', description: '', topology_json: topology }
    : null;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xl" PaperProps={{ sx: { height: '90vh' } }}>
      <DialogTitle sx={{ m: 0, p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {title || '实例拓扑'}
        <IconButton aria-label="close" onClick={onClose} sx={{ color: (theme) => theme.palette.grey[500] }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ p: 0, overflow: 'hidden' }}>
        {/* 复用 TopologyEditor 进行渲染，回调传空实现，保持只读展示 */}
        <TopologyEditor
          initialData={initialData as any}
          onAddNode={() => {}}
          onDeleteNode={() => {}}
          onUpdateNode={() => {}}
          onSaveSuccess={() => {}}
          scenarioId={null}
        />
      </DialogContent>
    </Dialog>
  );
};

export default InstanceTopologyDialog;

