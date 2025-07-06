
import React, { useState, useEffect, ChangeEvent } from 'react';
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Button,
  Typography,
  FormGroup,
  FormControlLabel,
  Checkbox,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  Paper,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { UserRole } from '@/types';
import { APP_PERMISSIONS, APP_PERMISSIONS_CATEGORY, AppPermission } from '@/constants';

export interface RoleFormData {
  id?: string;
  nameDisplay: string;
  description: string;
  permissions: string[]; // Array of permission keys
}

interface MockRole {
    id: string;
    nameKey: UserRole;
    nameDisplay: string;
    description: string;
    permissions: string[];
    // permissionCount field removed as it's derived from permissions.length
}


interface RoleFormModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (role: RoleFormData, isNew: boolean) => void;
  initialRole: MockRole | null;
}

const RoleFormModal: React.FC<RoleFormModalProps> = ({ open, onClose, onSave, initialRole }) => {
  const theme      = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const [formData, setFormData] = useState<RoleFormData>({ nameDisplay: '', description: '', permissions: [] });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const isNewRole = !initialRole;

  useEffect(() => {
    if (open) {
      if (initialRole) {
        setFormData({
          id: initialRole.C_id,
          nameDisplay: initialRole.c_id,
          description: initialRole.c_name,
          permissions: [...initialRole.permissions], // Clone permissions array
        });
      } else {
        setFormData({
          nameDisplay: '',
          description: '',
          permissions: [],
        });
      }
      setErrors({});
    }
  }, [initialRole, open]);

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handlePermissionChange = (permissionKey: string) => {
    setFormData(prev => {
      const newPermissions = prev.permissions.includes(permissionKey)
        ? prev.permissions.filter(p => p !== permissionKey)
        : [...prev.permissions, permissionKey];
      return { ...prev, permissions: newPermissions };
    });
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.nameDisplay.trim()) newErrors.nameDisplay = '角色名称不能为空。';
    if (!formData.description.trim()) newErrors.description = '角色描述不能为空。';
    if (formData.permissions.length === 0) newErrors.permissions = '至少需要选择一个权限。';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validate()) {
      onSave(formData, isNewRole);
      onClose();
    }
  };

  const groupedPermissions = APP_PERMISSIONS.reduce((acc, permission) => {
    const group = permission.key.split("_")[0];
    if (!acc[group]) {
      acc[group] = [];
    }
    acc[group].push(permission);
    return acc;
  }, {} as Record<string, AppPermission[]>);


  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="md"
      fullScreen={fullScreen}
      PaperProps={{ sx: { borderRadius: 2 } }}
    >
      <DialogTitle>
        {isNewRole ? '添加新角色' : `编辑角色: ${initialRole?.nameDisplay}`}
      </DialogTitle>
      <DialogContent dividers>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" gutterBottom>角色信息</Typography>
            <TextField
              autoFocus
              name="nameDisplay"
              label="角色名称"
              fullWidth
              variant="outlined"
              value={formData.nameDisplay || ''}
              onChange={handleChange}
              error={!!errors.nameDisplay}
              helperText={errors.nameDisplay}
              required
              sx={{ mb: 2 }}
              disabled={!isNewRole}
            />
            <TextField
              name="description"
              label="角色描述"
              fullWidth
              multiline
              rows={3}
              variant="outlined"
              value={formData.description || ''}
              onChange={handleChange}
              error={!!errors.description}
              helperText={errors.description}
              required
            />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" gutterBottom>
              权限分配
              {errors.permissions && <Typography component="span" color="error.main" sx={{fontSize: '0.75rem', ml:1}}>{errors.permissions}</Typography>}
            </Typography>
            <Paper variant="outlined" sx={{ maxHeight: 400, overflowY: 'auto', p:0 }}>
              <List disablePadding>
              {Object.entries(groupedPermissions).map(([category, permissionsInCategory], index) => (
                <ListItem key={category} sx={{p:0, display:'block'}}>
                  <Accordion sx={{ boxShadow: 'none', '&:before': { display: 'none' }, borderBottom: index < Object.keys(groupedPermissions).length -1 ? '1px solid' : 'none', borderColor:'divider' }} disableGutters defaultExpanded>
                    <AccordionSummary
                      expandIcon={<ExpandMoreIcon />}
                      aria-controls={`permissions-category-${APP_PERMISSIONS_CATEGORY[category]}-content`}
                      id={`permissions-category-${APP_PERMISSIONS_CATEGORY[category]}-header`}
                      sx={{bgcolor: 'action.hover', minHeight: 48, '&.Mui-expanded': { minHeight: 48 }}}
                    >
                      <Typography variant="subtitle1" sx={{fontWeight:'medium'}}>{APP_PERMISSIONS_CATEGORY[category]}</Typography>
                    </AccordionSummary>
                    <AccordionDetails sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                      <FormGroup>
                        {permissionsInCategory.map(permission => (
                          <FormControlLabel
                            key={permission.key}
                            control={
                              <Checkbox
                                checked={formData.permissions.includes(permission.key)}
                                onChange={() => handlePermissionChange(permission.key)}
                                name={permission.key}
                                size="small"
                              />
                            }
                            label={permission.label}
                          />
                        ))}
                      </FormGroup>
                    </AccordionDetails>
                  </Accordion>
                </ListItem>
              ))}
              </List>
            </Paper>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose}>取消</Button>
        <Button variant="contained" onClick={handleSubmit}>
          {isNewRole ? '确认添加' : '保存更改'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default RoleFormModal;

