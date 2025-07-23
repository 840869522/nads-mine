import React, { useEffect, useState } from 'react';
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
  Stack,
} from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { APP_PERMISSIONS, AppPermission } from '@/constants';
import { PermScanWifi } from '@mui/icons-material';

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
  const collectPermissions = (permissions: AppPermission[], keys: string[]) => {
    return permissions.reduce((acc, perm) => {
      var newPerm: AppPermission = { ...perm, children: null };
      // 直接匹配当前权限
      if (keys.includes(perm.key)) {
        // 递归处理子权限
        if (perm.children?.length) {
          const childPerms = collectPermissions(perm.children, keys)
          newPerm.children = childPerms;
        } else {
          newPerm.children = [];
        }
        acc.push(newPerm);
      }

      return acc
    }, [] as AppPermission[])
  }


  const groupedPermissions = collectPermissions(APP_PERMISSIONS, permissionKeys);

  // const groupedPermissions = collectedPerms.reduce((acc, perm) => {
  //   const mainCategory = perm.path[0] // 取第一个路径作为主分组
  //   if (!acc[mainCategory]) acc[mainCategory] = []
  //   acc[mainCategory].push(perm)
  //   return acc
  // }, {} as Record<string, (AppPermission & { path: string[] })[]>)

  const renderList = (permission: AppPermission, leavel: number = 1) => {
    if (permission.children && permission.children.length > 0) {
      return (
        <Stack>
          <ListItem key={permission.key} sx={{ py: 0.8, pl: leavel * 3 }}>
            <ListItemIcon sx={{ minWidth: 32 }}>
              <CheckCircleOutlineIcon fontSize="small" color="success" />
            </ListItemIcon>
            <ListItemText primary={permission.label} primaryTypographyProps={{ variant: 'body2' }} />
          </ListItem>
          {
            permission.children.map(item => renderList(item, leavel + 1))
          }
        </Stack>
      )
    } else {
      return (
        <ListItem key={permission.key} sx={{ py: 0.8, pl: leavel * 3 }}>
          <ListItemIcon sx={{ minWidth: 32 }}>
            <CheckCircleOutlineIcon fontSize="small" color="success" />
          </ListItemIcon>
          <ListItemText primary={permission.label} primaryTypographyProps={{ variant: 'body2' }} />
        </ListItem>
      )
    }
  }


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
          Object.entries(groupedPermissions).map(([category, permission], index) => (
            <Box key={permission.key} sx={{ mb: index < Object.keys(groupedPermissions).length - 1 ? 2 : 0 }}>
              <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'medium', mt: index > 0 ? 2 : 0 }}>
                {permission.label}
              </Typography>
              <List dense disablePadding>
                {
                  permission.key === "databoard_view" ?
                    renderList(permission)
                    : permission.children?.map(item => renderList(item))
                }
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