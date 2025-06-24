import React, { useEffect, useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, CircularProgress, List, ListItem, ListItemText } from '@mui/material';

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || '';

interface BindMountsModalProps {
  open: boolean;
  containerId: string | null;
  onClose: () => void;
}

const BindMountsModal: React.FC<BindMountsModalProps> = ({ open, containerId, onClose }) => {
  const [mounts, setMounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && containerId) {
      setLoading(true);
      fetch(`${API_BASE}/api/containers/${containerId}?action=binds`)
        .then(res => res.json())
        .then(setMounts)
        .finally(() => setLoading(false));
    }
  }, [open, containerId]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>绑定挂载</DialogTitle>
      <DialogContent dividers>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
            <CircularProgress />
          </Box>
        ) : (
          <List>
            {mounts.map((m, idx) => (
              <ListItem key={idx} divider>
                <ListItemText primary={m.Source} secondary={m.Destination} />
              </ListItem>
            ))}
            {mounts.length === 0 && <Box sx={{ p:2 }}>无挂载</Box>}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} variant="outlined">关闭</Button>
      </DialogActions>
    </Dialog>
  );
};

export default BindMountsModal;
