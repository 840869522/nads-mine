import React, { useState } from 'react';
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
  useScrollTrigger,
  Stack,
} from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { APP_PERMISSIONS, APP_PERMISSIONS_CATEGORY, AppPermission } from '@/constants';

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
  const collectPermissions = (permissions: AppPermission[], keys: string[], path: string[] = []) => {
    return permissions.reduce((acc, perm) => {
      const currentPath = [...path, perm.label]

      // 直接匹配当前权限
      if (keys.includes(perm.key)) {
        acc.push({ ...perm, path: currentPath })
      }

      // 递归处理子权限
      if (perm.children?.length) {
        const childPerms = collectPermissions(perm.children, keys, currentPath)
        acc.push(...childPerms)
      }

      return acc
    }, [] as (AppPermission & { path: string[] })[])
  }


  const collectedPerms = collectPermissions(APP_PERMISSIONS, permissionKeys);

  const groupedPermissions = collectedPerms.reduce((acc, perm) => {
    const mainCategory = perm.path[0] // 取第一个路径作为主分组
    if (!acc[mainCategory]) acc[mainCategory] = []
    acc[mainCategory].push(perm)
    return acc
  }, {} as Record<string, (AppPermission & { path: string[] })[]>)

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth scroll="paper">
      <DialogTitle>
        角色权限: {roleName} ({permissionKeys.length}项)
      </DialogTitle>
      <DialogContent dividers>
        {Object.entries(groupedPermissions).length === 0 ? (
          <Typography color="text.secondary" textAlign="center" sx={{ py: 3 }}>
            此角色当前未分配任何权限。
          </Typography>
        ) : (
          Object.entries(groupedPermissions).map(([category, permissionsInCategory], index) => (
            <Box key={category} sx={{ mb: index < Object.keys(groupedPermissions).length - 1 ? 2 : 0 }}>
              <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'medium', mt: index > 0 ? 2 : 0 }}>
                {APP_PERMISSIONS_CATEGORY[category] || category}
              </Typography>
              <List dense disablePadding>
                {permissionsInCategory.map((permission) => (

                  <Stack>
                    {
                      permission.path.length > 1 || permission.key === "databoard_view" ? (
                        <ListItem key={permission.key} sx={{ py: 0.8, pl: permission.path.length * 3 }}>
                          <ListItemIcon sx={{ minWidth: 32 }}>
                            <CheckCircleOutlineIcon fontSize="small" color="success" />
                          </ListItemIcon>
                          <ListItemText primary={permission.label} primaryTypographyProps={{ variant: 'body2' }} /> 
                        </ListItem>
                      ) : null
                    }
                  </Stack>
                ))}
              </List>
              {index < Object.keys(groupedPermissions).length - 1 && <Divider sx={{ my: 1.5 }} />}
            </Box>
          ))
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} variant="outlined">关闭</Button>
      </DialogActions>
    </Dialog>
  );
};

export default ViewRolePermissionsModal;