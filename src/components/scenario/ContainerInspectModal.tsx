import React, { useEffect, useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, CircularProgress } from '@mui/material';

interface ContainerInspectModalProps {
  open: boolean;
  containerId: string | null;
  onClose: () => void;
}

const ContainerInspectModal: React.FC<ContainerInspectModalProps> = ({ open, containerId, onClose }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && containerId) {
      setLoading(true);
      fetch(`/api/containers/${containerId}?action=inspect`)
        .then(res => res.json())
        .then(setData)
        .finally(() => setLoading(false));
    }
  }, [open, containerId]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>容器 Inspect</DialogTitle>
      <DialogContent dividers>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Box component="pre" sx={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
            {data ? JSON.stringify(data, null, 2) : '无数据'}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} variant="outlined">关闭</Button>
      </DialogActions>
    </Dialog>
  );
};

export default ContainerInspectModal;
