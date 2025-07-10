"use client";

import React, { useState, useMemo, useEffect } from 'react';
import {
  Typography,
  Box,
  Paper,
  Button,
  TextField,
  InputAdornment,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TableSortLabel,
  IconButton,
  Chip,
  Tooltip,
  Alert as MuiAlert,
} from '@mui/material';
import CircularProgress from '@mui/material/CircularProgress';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import SearchIcon from '@mui/icons-material/Search';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import UserFormModal, { UserFormData } from '@/components/admin/UserFormModal';
import ConfirmActionDialog from '@/components/scenario/ConfirmActionDialog';
import { apiClientWithToken } from '@/utils/axios';
import PermissionFormModal, { PermissionFormData } from '@/components/admin/PermissionModal';

// Mock User Data Type (ensure it matches what UserFormModal expects for initialUser)
type PermissionDisplayItem = { c_id: string; c_name: string;  };



type Order = 'asc' | 'desc';
type SortablePermissionsKeys = keyof Pick<PermissionDisplayItem, 'c_id' | 'c_name' >;


const PermissionManagementPage: React.FC = () => {
  const [users, setUsers] = useState<PermissionDisplayItem[]>([]);
  const [searchTerm, setSearchTerm] = useState({ data: '', flag: false });
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [order, setOrder] = useState<Order>('asc');
  const [orderBy, setOrderBy] = useState<SortablePermissionsKeys>('c_id');

  const [count, setDataCount] = useState<number>(0);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingPermission, setEditingPermission] = useState<PermissionFormData | null>(null);

  const [tableLaoding, setTableLoading] = useState(true);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [permissionToDelete, setPermissionToDelete] = useState<PermissionDisplayItem | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    getUserData(page, rowsPerPage)
  }, [page, rowsPerPage]);

  const getUserData = (page: number, pagesize: number) => {
    setTableLoading(true);
    apiClientWithToken.post(`/back/api/support/permission/all`, JSON.stringify({ page: page, pagesize: pagesize })).then((res) => {
      if (res.data.code === 200) {
        setUsers(res.data.data.data);
        setDataCount(res.data.data.count);
      }
    }).finally(() => {
      setTimeout(() => {
        setTableLoading(false);
      }, 600);

    });
  }

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm({ data: event.target.value.toLowerCase(), flag: true });
    setPage(1);
  };

  const handleSearchSubmit = async () => {
    setTableLoading(true);
    try {
      const res = await apiClientWithToken.post(`/back/api/support/permission/search`, JSON.stringify({
        page: 1,
        pagesize: rowsPerPage,
        name: searchTerm.data
      }));

      if (res.data.code === 200) {
        setUsers(res.data.data.data);
        setDataCount(res.data.data.count);
        setPage(1);
      }else{
        setUsers([]);
        setFeedbackMessage({ type: 'error', text: '搜索权限时发生错误' });
      }
    }finally {
      setTableLoading(false);
    }
  };

  const handleRequestSort = (property : SortablePermissionsKeys) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage + 1);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(1);
  };

  const handleAddUserClick = () => {
    setEditingPermission(null);
    setIsUserModalOpen(true);
    setFeedbackMessage(null);
  };

  const handleEditUserClick = (permision:PermissionDisplayItem ) => {
    apiClientWithToken.post(`/back/api/support/permission/id`, JSON.stringify({ id: permision.c_id })).then((res) => {
      if (res.data.code === 200) {
        setEditingPermission({id:res.data.data.c_id, name: res.data.data.c_name});
        setIsUserModalOpen(true);
        setFeedbackMessage(null);
      } else {
        setFeedbackMessage({ type: "error", text: res.data.message });
      }
    })
  };

  const handleSaveUser = async (formData: PermissionFormData, isNew: boolean) => {
    var permissionData = {
      id: formData.id,
      name : formData.name
    }
    if (isNew) {
      apiClientWithToken.post(`/back/api/support/permission/new`, JSON.stringify({ data: { ...permissionData } })).then((res) => {
        if (res.data.code === 200) {
          setPage(1);;
          getUserData(1, rowsPerPage);
          setFeedbackMessage({ type: "success", text: `权限 "${permissionData.id}" 添加成功。` });
        } else {
          setFeedbackMessage({ type: "error", text: `权限 "${permissionData.id}" 添加失败。` })
        }
      });
    } else if (editingPermission) {
      const res = await apiClientWithToken.post(`/back/api/support/permission/update`, JSON.stringify({
        id: editingPermission.id,
        data: {
          ...permissionData
        }
      }));
      if (res.data.code === 200) {
        setUsers(prev => prev.map(u =>
          u.c_id === editingPermission.id ? { ...u, c_name: formData.name!,  } : u
        ));
        setFeedbackMessage({ type: 'success', text: `权限 "${formData.id}" 更新成功。` });
      } else {
        setFeedbackMessage({ type: 'error', text: `权限 "${formData.id}" 更新失败。` });
      }
    }
  };


  const handleDeleteUserClick = (permision: PermissionDisplayItem) => {
    setPermissionToDelete(permision);
    setIsConfirmDeleteOpen(true);
    setFeedbackMessage(null);
  };

  const confirmDeleteUser = () => {
    if (permissionToDelete) {
      apiClientWithToken.post(`/back/api/support/permission/delete`, JSON.stringify({ id: permissionToDelete.c_id })).then((res) => {
        if (res.data.code === 200) {
          setUsers(prev => prev.filter(u => u.c_id !== permissionToDelete.c_id));
          setFeedbackMessage({ type: 'success', text: `权限 "${permissionToDelete.c_id}" 已删除。` });
        } else
          setFeedbackMessage({ type: 'error', text: `权限 "${permissionToDelete.c_id}" 删除失败。` })
      });
    }
    setIsConfirmDeleteOpen(false);
    setPermissionToDelete(null);
  };


  const filteredAndSortedUsers = useMemo(() => {
    let processedUsers = [...users].sort((a, b) => {
      const valA = a[orderBy];
      const valB = b[orderBy];
      if (valB < valA) return order === 'asc' ? 1 : -1;
      if (valB > valA) return order === 'asc' ? -1 : 1;
      return 0;
    });
    return processedUsers;
  }, [users, order, orderBy]);


  return (
    <Paper elevation={1} sx={{ p: { xs: 2, sm: 3 } }}>
      <Typography variant="h4" component="h1" gutterBottom>
        权限管理
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        此页面用于管理平台权限、查看权限活动。
      </Typography>

      {feedbackMessage && (
        <MuiAlert severity={feedbackMessage.type} sx={{ mb: 2 }} onClose={() => setFeedbackMessage(null)}>
          {feedbackMessage.text}
        </MuiAlert>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ display: "flex", alignItems: "center", mb: 3, gap: 2, flexWrap: "wrap" }}>
          <TextField
            variant="outlined"
            size="small"
            placeholder="搜索权限..."
            value={searchTerm.data}
            onChange={handleSearchChange}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleSearchSubmit();
              }
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
              endAdornment: tableLaoding ? (
                <CircularProgress size={20} />
              ) : null
            }}
            sx={{ minWidth: { sm: 300 } }}
          />
          <Button
            variant="contained"
            size="small"
            onClick={handleSearchSubmit}
            disabled={tableLaoding}
            sx={{ ml: 1, minWidth: 80 }}
          >
            搜索
          </Button>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddCircleOutlineIcon />}
          onClick={handleAddUserClick}
        >
          添加权限
        </Button>
      </Box>
      <TableContainer component={Paper} sx={{ boxShadow: 2 }}>
        <Table aria-label="权限列表">
          <TableHead sx={{ bgcolor: 'action.focus' }}>
            <TableRow>
              {[
                { id: 'c_id', label: '权限id' },
                { id: 'c_name', label: '描述' },
              ].map((headCell) => (
                <TableCell
                  key={headCell.id}
                  sortDirection={orderBy === headCell.id ? order : false}
                >
                  <TableSortLabel
                    active={orderBy === headCell.id}
                    direction={orderBy === headCell.id ? order : 'asc'}
                    onClick={() => handleRequestSort(headCell.id as SortablePermissionsKeys)}
                  >
                    {headCell.label}
                  </TableSortLabel>
                </TableCell>
              ))}
              <TableCell align="center">操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {
              tableLaoding ? (
                <TableRow>
                  <TableCell colSpan={7} align='center' sx={{ height: "40vh" }}>
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : filteredAndSortedUsers.length > 0 ?
                filteredAndSortedUsers.map((permission) => (
                  <TableRow key={permission.c_id} hover>
                    <TableCell sx={{ fontWeight: 'medium' }}>{permission.c_id}</TableCell>
                    <TableCell>{permission.c_name}</TableCell>
                    <TableCell align="center">
                      <Tooltip title="编辑权限">
                        <IconButton size="small" onClick={() => handleEditUserClick(permission)} color="primary">
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="删除权限">
                        <IconButton size="small" onClick={() => handleDeleteUserClick(permission)} color="error" disabled={permission.c_id === 'admin' /* Prevent deleting main admin for demo */}>
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
                : (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 3 }}>
                      <Typography color="text.secondary">没有找到匹配的权限。</Typography>
                    </TableCell>
                  </TableRow>
                )
            }
          </TableBody>
        </Table>
        <TablePagination
          rowsPerPageOptions={[5, 10, 25]}
          component="div"
          count={count}
          rowsPerPage={rowsPerPage}
          page={page - 1}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          labelRowsPerPage="每页行数:"
          labelDisplayedRows={({ from, to, count }) => `${from}-${to} 共 ${count !== -1 ? count : `超过 ${to}`}`}
        />
      </TableContainer>

      <PermissionFormModal
        open={isUserModalOpen}
        onClose={() => setIsUserModalOpen(false)}
        onSave={handleSaveUser}
        initialPermission={editingPermission}
      />

      {permissionToDelete && (
        <ConfirmActionDialog
          open={isConfirmDeleteOpen}
          onClose={() => setIsConfirmDeleteOpen(false)}
          title="确认删除权限"
          message={`您确定要删除权限 "${permissionToDelete?.c_id}" 吗？此操作无法撤销。`}
          onConfirm={confirmDeleteUser}
        />
      )}

      {/* <MuiAlert severity="info" sx={{ mt: 4 }}>
        <Typography variant="subtitle2" gutterBottom>系统安全提示</Typography>
        权限的密码将通过安全的哈希算法进行加密存储。所有权限操作均会记录审计日志，确保系统安全可追溯。请定期审查权限权限，遵循最小权限原则。
      </MuiAlert> */}
    </Paper>
  );
};
export default PermissionManagementPage;