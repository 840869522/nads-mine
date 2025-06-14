import React from 'react';
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Button,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Box,
} from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { APP_PERMISSIONS, AppPermission } from '../../constants';

interface ViewRolePermissionsModalProps {
  open: boolean;
  onClose: () => void;
  roleName: string;
  permissionKeys: string[];
}

const ViewRolePermissionsModal: React.FC<ViewRolePermissionsModalProps> = ({
  open,
  onClose,
  roleName,
  permissionKeys,
}) => {
  const assignedPermissionsDetails = APP_PERMISSIONS.filter(p => permissionKeys.includes(p.key));

  const groupedPermissions = assignedPermissionsDetails.reduce((acc, permission) => {
    if (!acc[permission.category]) {
      acc[permission.category] = [];
    }
    acc[permission.category].push(permission);
    return acc;
  }, {} as Record<string, AppPermission[]>);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth scroll="paper">
      <DialogTitle>
        角色权限: {roleName} ({permissionKeys.length}项)
      </DialogTitle>
      <DialogContent dividers>
        {Object.entries(groupedPermissions).length === 0 ? (
          <Typography color="text.secondary" textAlign="center" sx={{py:3}}>
            此角色当前未分配任何权限。
          </Typography>
        ) : (
          Object.entries(groupedPermissions).map(([category, permissionsInCategory], index) => (
            <Box key={category} sx={{ mb: index < Object.keys(groupedPermissions).length - 1 ? 2 : 0 }}>
              <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'medium', mt: index > 0 ? 2 : 0 }}>
                {category}
              </Typography>
              <List dense disablePadding>
                {permissionsInCategory.map((permission) => (
                  <ListItem key={permission.key} sx={{ py: 0.5 }}>
                    <ListItemIcon sx={{ minWidth: 32 }}>
                      <CheckCircleOutlineIcon fontSize="small" color="success" />
                    </ListItemIcon>
                    <ListItemText primary={permission.label} primaryTypographyProps={{variant: 'body2'}} />
                  </ListItem>
                ))}
              </List>
              {index < Object.keys(groupedPermissions).length - 1 && <Divider sx={{ my: 1.5 }} />}
            </Box>
          ))
        )}
      </DialogContent>
      <DialogActions sx={{ px:3, py:2 }}>
        <Button onClick={onClose} variant="outlined">关闭</Button>
      </DialogActions>
    </Dialog>
  );
};

export default ViewRolePermissionsModal;