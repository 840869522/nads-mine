
import React from 'react';
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Button,
} from '@mui/material';

interface ConfirmActionDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string | React.ReactNode;
}

const ConfirmActionDialog: React.FC<ConfirmActionDialogProps> = ({
  open,
  onClose,
  onConfirm,
  title,
  message,
}) => {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      aria-labelledby="confirm-action-dialog-title"
      aria-describedby="confirm-action-dialog-description"
    >
      <DialogTitle id="confirm-action-dialog-title">{title}</DialogTitle>
      <DialogContent>
        {typeof message === 'string' ? (
            <DialogContentText id="confirm-action-dialog-description">
            {message}
            </DialogContentText>
        ) : message }
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="secondary" variant="outlined">
          取消
        </Button>
        <Button onClick={onConfirm} color="primary" variant="contained" autoFocus>
          确认
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ConfirmActionDialog;
