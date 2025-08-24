

import React, { useState, useEffect, ChangeEvent } from 'react';
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Button,
  Typography,
  useMediaQuery,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  FormHelperText,
  SelectChangeEvent,
  Chip,
  Alert as MuiAlert,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import { apiClientWithToken } from '@/utils/axios';



// ------ 图标导入开始 ------

import ComputerDesktopIconHero from '@heroicons/react/24/outline/ComputerDesktopIcon';
import ChartPieIcon from '@heroicons/react/24/outline/ChartPieIcon';
import AcademicCapIcon from '@heroicons/react/24/outline/AcademicCapIcon';
import AdjustmentsHorizontalIcon from '@heroicons/react/24/outline/AdjustmentsHorizontalIcon';
import CubeTransparentIcon from '@heroicons/react/24/outline/CubeTransparentIcon'; // <-- 新增这个图标
import ShieldCheckIcon from '@heroicons/react/24/outline/ShieldCheckIcon';
import DocumentTextIcon from '@heroicons/react/24/outline/DocumentTextIcon';
import QuestionMarkCircleIcon from '@heroicons/react/24/outline/QuestionMarkCircleIcon';
import ArchiveBoxIconHero from '@heroicons/react/24/outline/ArchiveBoxIcon';
import FolderOpenIconHero from '@heroicons/react/24/outline/FolderOpenIcon';
import CommandLineIcon from '@heroicons/react/24/outline/CommandLineIcon';
import Cog6ToothIcon from '@heroicons/react/24/outline/Cog6ToothIcon';
import UserGroupIcon from '@heroicons/react/24/outline/UserGroupIcon';
import KeyIcon from '@heroicons/react/24/outline/KeyIcon';
import ArrowLeftEndOnRectangleIcon from '@heroicons/react/24/outline/ArrowLeftEndOnRectangleIcon';
import MenuIcon from '@mui/icons-material/Menu'; // 设置通用图标
import { common } from '@mui/material/colors';
import { userPermissionContext } from '@/contexts/PermissionAndMenuContext';

// ------ 图标导入结束 ------


// ------ 图标Map开始 ------

const iconMap = {
  "ChartPieIcon": ChartPieIcon,
  "Cog6ToothIcon": Cog6ToothIcon,
  "UserGroupIcon": UserGroupIcon,
  "KeyIcon": KeyIcon,
  "ArrowLeftEndOnRectangleIcon": ArrowLeftEndOnRectangleIcon,
  "ArchiveBoxIconHero": ArchiveBoxIconHero,
  "CommandLineIcon": CommandLineIcon,
  "ComputerDesktopIconHero": ComputerDesktopIconHero,
  "AdjustmentsHorizontalIcon": AdjustmentsHorizontalIcon,
  "CubeTransparentIcon": CubeTransparentIcon,
  "ShieldCheckIcon": ShieldCheckIcon,
  "AcademicCapIcon": AcademicCapIcon,
  "QuestionMarkCircleIcon": QuestionMarkCircleIcon,
  "FolderOpenIconHero": FolderOpenIconHero,
  "DocumentTextIcon": DocumentTextIcon,
  "MenuIcon": MenuIcon
}

// ------ 图标Map结束 ------

export interface PermissionFormData {
  id?: string,
  des: string,
  label: string,
  pid: string,
  api_src: string,
  src: string,
  icon: string,
  is_menu: number,
  status: number
}

export type PermissionDisplayItem = {
  c_id: string,
  c_label: string,
  c_pid: string,
  c_des: string,
  c_api_src: string,
  c_src: string,
  c_icon: string,
  c_is_menu: number,
  c_status: number
};

const defaultData: PermissionFormData = { id: '', des: '', label: "", pid: "", api_src: "", src: "", status: 1, is_menu: 0, icon: "MenuIcon" };

interface PermissionFormModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (role: PermissionFormData, isNew: boolean) => void;
  initialPermission: PermissionDisplayItem | null;
}

const PermissionFormModal: React.FC<PermissionFormModalProps> = ({ open, onClose, onSave, initialPermission }) => {
  const {id2nameMap} = userPermissionContext();
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const [formData, setFormData] = useState<PermissionFormData>({ ...defaultData });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const isNewRole = !initialPermission;

  /**
   * 父项选择数据 开始
   */
  const [pids, setPids] = useState<{ c_id: string, c_label: string }[]>([{ c_id: "0", c_label: "顶层权限" }]);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isRoleMenuOpen, setIsRoleMenuOpen] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [pidCount, setPidCount] = useState<number>(0);

  // 父项选择数据 结束

  useEffect(() => {
    if (open) {
      if (initialPermission) {
        setFormData({
          id: initialPermission.c_id,
          des: initialPermission.c_des,
          label: initialPermission.c_label,
          pid: initialPermission.c_pid,
          api_src: initialPermission.c_api_src,
          src: initialPermission.c_src,
          status: initialPermission.c_status,
          is_menu: initialPermission.c_is_menu,
          icon: initialPermission.c_icon,
        });
      } else {
        setFormData({ ...defaultData });
      }
      setErrors({});
    }
  }, [initialPermission, open]);



  // ----- 父项选择处理开始 ---- 

  useEffect(() => {
    if (isRoleMenuOpen && currentPage >= 1 && hasMore) {
      const loadNextPage = async () => {
        apiClientWithToken.post(`/back/api/support/permission/all_label`, JSON.stringify({ page: currentPage, pagesize: 10 })).then(res => {
          if (res.data.code === 200) {
            if (currentPage * 10 > res.data.data.count) {
              setHasMore(false);
            }
            setPidCount(res.data.data.count);
            setPids((prev) => [...prev, ...res.data.data.data].filter(Boolean));
          }
          else
            setHasMore(false);
        }).finally(() => {
          setIsLoadingMore(false);
        })
      };
      loadNextPage();
    }
  }, [currentPage, isRoleMenuOpen, hasMore]);

  const handleSelectChange = (event: SelectChangeEvent<string[]>) => {
    const values = event.target.value as string;
    const { name } = event.target;
    setFormData({
      ...formData,
      [name]: values,
    });
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
  };


  const handleScroll = (e: React.UIEvent<HTMLUListElement>) => {
    const target = e.target as HTMLUListElement;
    const isBottom = target.scrollTop + target.clientHeight >= target.scrollHeight - 10;

    if (isBottom && hasMore && !isLoadingMore) {
      setIsLoadingMore(true);
      setCurrentPage((prev) => prev + 1);
    }
  };
  // ------ 父项选择处理结束 ------

  // ------ 表单输入处理 ------
  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  // ------ 表单输入处理结束 ------

  const handleStatusChange = (event: SelectChangeEvent<string>) => {
    const newValue = event.target.value === 'active' ? 1 : 0;

    setFormData(prev => ({
      ...prev,
      status: newValue
    }));
    const { name } = event.target;
    // 实时清除验证错误
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleIsMenuChange = (event: SelectChangeEvent<string>) => {
    const newValue = parseInt(event.target.value as string);

    setFormData(prev => ({
      ...prev,
      is_menu: newValue
    }));
    const { name } = event.target;
    // 实时清除验证错误
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };


  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.id.trim()) newErrors.id = '权限id不能为空。';
    if (!formData.des.trim()) newErrors.des = '权限描述不能为空。';
    if (!formData.label.trim()) newErrors.label = "权限名称不能为空";
    if (!formData.is_menu && !formData.api_src.trim()) { newErrors.api_src = "api接口地址不能为空"; }
    if (formData.is_menu && !formData.src.trim()) newErrors.src = "前端地址不能为空";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validate()) {
      if (formData.is_menu && (formData.api_src.trim() || formData.api_src === ""))
        formData.api_src = " ";
      if (!formData.is_menu && !formData.src.trim())
        formData.src = " ";
      onSave(formData, isNewRole);
      onClose();
    }
  };

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
        {isNewRole ? '添加新权限' : `编辑权限: ${formData.label}`}
      </DialogTitle>
      <DialogContent dividers>
        <MuiAlert severity="warning" sx={{ mt: 1 }}>
          <Typography variant="subtitle2" gutterBottom>系统提示</Typography>
          如果权限状态选择“禁用”，那么所有用户默认具有此权限，并且不会再角色管理处显示。
        </MuiAlert>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" gutterBottom>权限信息</Typography>
            <TextField
              autoFocus
              name="id"
              label="权限id"
              fullWidth
              variant="outlined"
              value={formData.id || ''}
              onChange={handleChange}
              error={!!errors.id}
              helperText={errors.id}
              required
              sx={{ mb: 2 }}
              disabled={!isNewRole}
            />
            <TextField
              name='label'
              label="名称"
              fullWidth
              variant='outlined'
              value={formData.label || ""}
              onChange={handleChange}
              error={!!errors.label}
              helperText={errors.label}
              required
              sx={{ mb: 2 }}
            />
            <TextField
              name="des"
              label="权限描述"
              fullWidth
              multiline
              rows={3}
              variant="outlined"
              value={formData.des || ''}
              onChange={handleChange}
              error={!!errors.des}
              helperText={errors.des}
              required
            />

            <FormControl fullWidth margin="dense" error={!!errors.pid} required>
              <InputLabel id="perm-pid-label">所属父项</InputLabel>
              <Select
                labelId="perm-pid-label"
                name="pid"
                label="所属父项"
                value={formData.pid || ""}
                onChange={handleSelectChange}
                onOpen={() => setIsRoleMenuOpen(true)}
                onClose={() => setIsRoleMenuOpen(false)}
                MenuProps={{
                  PaperProps: {
                    sx: {
                      maxHeight: 300,
                    },
                    onScroll: handleScroll,
                  },
                }}
                renderValue={(selected) => (
                  <Chip key={selected} label={id2nameMap[selected]} />
                )}
              >
                {
                  pids.length > 0 ? (
                    [
                      ...pids.map(r => (
                        <MenuItem key={r.c_id} value={r.c_id.toString()}>
                          {r.c_label}
                        </MenuItem>
                      )),
                      isLoadingMore && (
                        <MenuItem disabled>
                          正在加载更多...
                        </MenuItem>
                      ),
                      !hasMore && (
                        <MenuItem disabled>
                          没有更多权限了
                        </MenuItem>
                      ),
                    ].filter(Boolean)
                  ) : (
                    <MenuItem disabled>
                      {isRoleMenuOpen ? '正在加载权限...' : ''}
                    </MenuItem>
                  )
                }
              </Select>
              {errors.pid && <FormHelperText>{errors.pid}</FormHelperText>}
            </FormControl>
            <TextField
              name="src"
              label="前端地址"
              fullWidth
              variant="outlined"
              value={formData.src || ''}
              onChange={handleChange}
              error={!!errors.src}
              helperText={errors.src}
              required={formData.is_menu ? true: false}
            />
            <TextField
              name="api_src"
              label="api接口"
              fullWidth
              variant="outlined"
              value={formData.api_src || ''}
              onChange={handleChange}
              error={!!errors.api_src}
              helperText={errors.api_src}
              required={formData.is_menu ? false: true}
            />

            <FormControl fullWidth margin="dense" error={!!errors.status}>
              <InputLabel id="menu-label">是否菜单项</InputLabel>
              <Select
                labelId="menu-label"
                name="is_menu"
                label="是否菜单项"
                value={formData.is_menu}
                onChange={handleIsMenuChange}
              >
                <MenuItem value="1">是</MenuItem>
                <MenuItem value="0">否</MenuItem>
              </Select>
              {errors.is_menu && <FormHelperText>{errors.is_menu}</FormHelperText>}
            </FormControl>

            {
              formData.is_menu == 1 && (
                <FormControl fullWidth margin="dense" error={!!errors.icon}>
                  <InputLabel id="icon-label">菜单图标</InputLabel>
                  <Select
                    labelId="icon-label"
                    name="icon"
                    label="菜单图标"
                    value={formData.icon}
                    onChange={handleSelectChange}
                    renderValue={(selected) => {
                      const IconComponet = iconMap[selected] || MenuIcon;
                      return <IconComponet style={{ height: 20, width: 20, color: 'currentColor' }} />
                    }}
                  >
                    {
                      Object.entries(iconMap).map(([iconStr, IconComponent]) => {
                        return (
                          <MenuItem value={iconStr}>
                            <IconComponent style={{ height: 20, width: 20, color: 'currentColor' }} />
                          </MenuItem>
                        )
                      })
                    }
                  </Select>
                  {errors.icon && <FormHelperText>{errors.icon}</FormHelperText>}
                </FormControl>
              )
            }

            <FormControl fullWidth margin="dense" error={!!errors.status}>
              <InputLabel id="status-label">状态</InputLabel>
              <Select
                labelId="status-label"
                name="status"
                label="状态"
                value={formData.status == 1 ? "active" : "disabled"}
                onChange={handleStatusChange}
              >
                <MenuItem value="active">激活</MenuItem>
                <MenuItem value="disabled">禁用</MenuItem>
              </Select>
              {errors.status && <FormHelperText>{errors.status}</FormHelperText>}
            </FormControl>
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

export default PermissionFormModal;

