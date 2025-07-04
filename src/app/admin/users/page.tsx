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
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import SearchIcon from '@mui/icons-material/Search';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { User, UserRole } from '@/types';
import { USER_ROLES_CONFIG } from '@/constants';
import UserFormModal, { UserFormData } from '@/components/admin/UserFormModal';
import ConfirmActionDialog from '@/components/scenario/ConfirmActionDialog';
import { apiClientWithToken } from '@/utils/axios';
import CryptoJS from "crypto-js";

// Mock User Data Type (ensure it matches what UserFormModal expects for initialUser)
type UserDisplayItem = User & { email: string; is_login: 1 | 0; create_at: string, update_at: string , last_login:string};


type Order = 'asc' | 'desc';
type SortableUserKeys = keyof Pick<UserDisplayItem, 'username' | 'role' | 'email' | 'is_login' | 'create_at'| 'update_at' | 'last_login'>;


const UserManagementPage: React.FC = () => {
  const [users, setUsers] = useState<UserDisplayItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [order, setOrder] = useState<Order>('asc');
  const [orderBy, setOrderBy] = useState<SortableUserKeys>('username');
  const [count, setDataCount] = useState<number>(0);

  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserDisplayItem | null>(null);

  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserDisplayItem | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    apiClientWithToken.post('/api/user/all', JSON.stringify({ page: page, pagesize: rowsPerPage })).then((res) => {
      if (res.data.code === 200) {
        setUsers(res.data.data.data);
        setDataCount(res.data.data.count);
      }
    });
  }, []);


  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value.toLowerCase());
    setPage(1);
  };

  const handleRequestSort = (property: SortableUserKeys) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(1);
  };

  const handleAddUserClick = () => {
    setEditingUser(null);
    setIsUserModalOpen(true);
    setFeedbackMessage(null);
  };

  const handleEditUserClick = (user: UserDisplayItem) => {
    setEditingUser(user);
    setIsUserModalOpen(true);
    setFeedbackMessage(null);
  };

  const handleSaveUser = async (formData: UserFormData, isNew: boolean) => {
    if (isNew) {
      const id = crypto.randomUUID();
      await apiClientWithToken.post('/api/user/new', JSON.stringify({
        id,
        username: formData.username,
        passwordHash: formData.password,
        roleId: formData.role,
        email: formData.email,
        status: formData.status
      })
      );
      setUsers(prev => [{ id, username: formData.username!, role: formData.role!, email: formData.email!, is_login: formData.status ==  'active' ? 1 :0  , createdAt: new Date().toISOString() }, ...prev]);
      setFeedbackMessage({ type: 'success', text: `用户 "${formData.username}" 添加成功。` });
    } else if (editingUser) {
      await apiClientWithToken.post('/api/user/update', JSON.stringify({
        id: editingUser.id,
        username: formData.username,
        passwordHash: formData.password,
        roleId: formData.role,
        email: formData.email,
        status: formData.status
      }));
      setUsers(prev => prev.map(u =>
        u.id === editingUser.id ? { ...u, username: formData.username!, role: formData.role!, email: formData.email!, status: formData.status as 'active' | 'disabled' } : u
      ));
      setFeedbackMessage({ type: 'success', text: `用户 "${formData.username}" 更新成功。` });
    }
  };


  const handleDeleteUserClick = (user: UserDisplayItem) => {
    setUserToDelete(user);
    setIsConfirmDeleteOpen(true);
    setFeedbackMessage(null);
  };

  const confirmDeleteUser = () => {
    if (userToDelete) {
      fetch(`/api/users?id=${userToDelete.id}`, { method: 'DELETE' }).then(() => {
        setUsers(prev => prev.filter(u => u.id !== userToDelete.id));
        setFeedbackMessage({ type: 'success', text: `用户 "${userToDelete.username}" 已删除。` });
      });
    }
    setIsConfirmDeleteOpen(false);
    setUserToDelete(null);
  };


  const filteredAndSortedUsers = useMemo(() => {
    let processedUsers = [...users].filter(user =>
      user.username.toLowerCase().includes(searchTerm) ||
      user.email.toLowerCase().includes(searchTerm) ||
      USER_ROLES_CONFIG[user.role].name.toLowerCase().includes(searchTerm)
    );

    processedUsers.sort((a, b) => {
      const valA = a[orderBy];
      const valB = b[orderBy];
      if (valB < valA) return order === 'asc' ? 1 : -1;
      if (valB > valA) return order === 'asc' ? -1 : 1;
      return 0;
    });
    return processedUsers;
  }, [users, searchTerm, order, orderBy]);

  return (
    <Paper elevation={1} sx={{ p: { xs: 2, sm: 3 } }}>
      <Typography variant="h4" component="h1" gutterBottom>
        用户管理
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        此页面用于管理平台用户账户、分配角色以及查看用户活动。
      </Typography>

      {feedbackMessage && (
        <MuiAlert severity={feedbackMessage.type} sx={{ mb: 2 }} onClose={() => setFeedbackMessage(null)}>
          {feedbackMessage.text}
        </MuiAlert>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <TextField
          variant="outlined"
          size="small"
          placeholder="搜索用户..."
          value={searchTerm}
          onChange={handleSearchChange}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
          sx={{ minWidth: { sm: 300 } }}
        />
        <Button
          variant="contained"
          startIcon={<AddCircleOutlineIcon />}
          onClick={handleAddUserClick}
        >
          添加用户
        </Button>
      </Box>

      <TableContainer component={Paper} sx={{ boxShadow: 2 }}>
        <Table aria-label="用户列表">
          <TableHead sx={{ bgcolor: 'action.focus' }}>
            <TableRow>
              {[
                { id: 'username', label: '用户名' },
                { id: 'email', label: '邮箱' },
                { id: 'is_login', label: '状态' },
                { id: 'create_at', label: '创建日期' },
                { id: 'update_at', label: '更新日期' },
                { id: 'last_ogin', label: '更新日期' },
              ].map((headCell) => (
                <TableCell
                  key={headCell.id}
                  sortDirection={orderBy === headCell.id ? order : false}
                >
                  <TableSortLabel
                    active={orderBy === headCell.id}
                    direction={orderBy === headCell.id ? order : 'asc'}
                    onClick={() => handleRequestSort(headCell.id as SortableUserKeys)}
                  >
                    {headCell.label}
                  </TableSortLabel>
                </TableCell>
              ))}
              <TableCell align="center">操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredAndSortedUsers.map((user) => (
              <TableRow key={user.id} hover>
                <TableCell sx={{ fontWeight: 'medium' }}>{user.username}</TableCell>
                {/* <TableCell>
                  <Chip
                    label={USER_ROLES_CONFIG[user.role].name}
                    size="small"
                    color={user.role === UserRole.ADMIN ? "secondary" : "default"}
                    sx={{
                      bgcolor: user.role === UserRole.ADMIN ? 'primary.dark' :
                        user.role === UserRole.ATTACKER ? 'error.light' :
                          user.role === UserRole.DEFENDER ? 'info.light' :
                            'default',
                      color: user.role === UserRole.ADMIN ? 'common.white' : 'text.primary'
                    }}
                  />
                </TableCell> */}
                <TableCell>{user.email}</TableCell>
                <TableCell>
                  <Chip
                    label={user.is_login ? '已激活' : '已禁用'}
                    color={user.is_login ? 'success' : 'error'}
                    size="small"
                    variant="outlined"
                  />
                </TableCell>
                <TableCell>{user.create_at}</TableCell>
                <TableCell>{user.update_at}</TableCell>
                <TableCell>{user.last_login}</TableCell>
                <TableCell align="center">
                  <Tooltip title="编辑用户">
                    <IconButton size="small" onClick={() => handleEditUserClick(user)} color="primary">
                      <EditIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="删除用户">
                    <IconButton size="small" onClick={() => handleDeleteUserClick(user)} color="error" disabled={user.username === 'admin_main' /* Prevent deleting main admin for demo */}>
                      <DeleteIcon />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
            {!filteredAndSortedUsers.length && (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 3 }}>
                  <Typography color="text.secondary">没有找到匹配的用户。</Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <TablePagination
          rowsPerPageOptions={[5, 10, 25]}
          component="div"
          count={count}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          labelRowsPerPage="每页行数:"
          labelDisplayedRows={({ from, to, count }) => `${from}-${to} 共 ${count !== -1 ? count : `超过 ${to}`}`}
        />
      </TableContainer>

      <UserFormModal
        open={isUserModalOpen}
        onClose={() => setIsUserModalOpen(false)}
        onSave={handleSaveUser}
        initialUser={editingUser}
      />

      {userToDelete && (
        <ConfirmActionDialog
          open={isConfirmDeleteOpen}
          onClose={() => setIsConfirmDeleteOpen(false)}
          title="确认删除用户"
          message={`您确定要删除用户 "${userToDelete?.username}" 吗？此操作无法撤销。`}
          onConfirm={confirmDeleteUser}
        />
      )}

      <MuiAlert severity="info" sx={{ mt: 4 }}>
        <Typography variant="subtitle2" gutterBottom>系统安全提示</Typography>
        用户的密码将通过安全的哈希算法进行加密存储。所有用户操作均会记录审计日志，确保系统安全可追溯。请定期审查用户权限，遵循最小权限原则。
      </MuiAlert>
    </Paper>
  );
};
export default UserManagementPage;
