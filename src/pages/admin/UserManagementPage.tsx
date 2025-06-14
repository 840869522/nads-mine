
import React, { useState, useMemo } from 'react';
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
import { User, UserRole } from '../../types';
import { USER_ROLES_CONFIG } from '../../constants';
import UserFormModal, { UserFormData } from '../../components/admin/UserFormModal';
import ConfirmActionDialog from '../../components/scenario/ConfirmActionDialog';

// Mock User Data Type (ensure it matches what UserFormModal expects for initialUser)
type UserDisplayItem = User & { email: string; status: 'active' | 'disabled'; createdAt: string };

const createMockUser = (id: string, username: string, role: UserRole, email: string, status: 'active' | 'disabled', daysAgo: number): UserDisplayItem => ({
  id,
  username,
  role,
  email,
  status,
  createdAt: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString(),
});

const MOCK_USERS_INITIAL: UserDisplayItem[] = [
  createMockUser('usr_admin_01', 'admin_main', UserRole.ADMIN, 'admin@example.com', 'active', 2),
  createMockUser('usr_stud_01', 'student_alice', UserRole.STUDENT, 'alice@example.com', 'active', 5),
  createMockUser('usr_stud_02', 'student_bob', UserRole.STUDENT, 'bob@example.com', 'disabled', 10),
  createMockUser('usr_atk_01', 'attacker_eve', UserRole.ATTACKER, 'eve@example.com', 'active', 7),
  createMockUser('usr_def_01', 'defender_charlie', UserRole.DEFENDER, 'charlie@example.com', 'active', 3),
  createMockUser('usr_admin_02', 'sysop_jane', UserRole.ADMIN, 'jane.sys@example.com', 'active', 30),
  createMockUser('usr_stud_03', 'learner_dave', UserRole.STUDENT, 'dave.learn@example.com', 'active', 1),
];

type Order = 'asc' | 'desc';
type SortableUserKeys = keyof Pick<UserDisplayItem, 'username' | 'role' | 'email' | 'status' | 'createdAt'>;


const UserManagementPage: React.FC = () => {
  const [users, setUsers] = useState<UserDisplayItem[]>(MOCK_USERS_INITIAL);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [order, setOrder] = useState<Order>('asc');
  const [orderBy, setOrderBy] = useState<SortableUserKeys>('username');

  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserDisplayItem | null>(null);

  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserDisplayItem | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);


  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value.toLowerCase());
    setPage(0);
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
    setPage(0);
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

  const handleSaveUser = (formData: UserFormData, isNew: boolean) => {
    if (isNew) {
      const newUser: UserDisplayItem = {
        id: `usr_${Date.now()}`,
        username: formData.username!,
        role: formData.role!,
        email: formData.email!,
        status: formData.status as 'active' | 'disabled',
        createdAt: new Date().toISOString(),
      };
      // In a real app, formData.password would be sent to the backend.
      setUsers(prev => [newUser, ...prev]);
      setFeedbackMessage({ type: 'success', text: `用户 "${newUser.username}" 添加成功。` });
    } else {
      setUsers(prev => prev.map(u =>
          u.id === editingUser?.id
              ? { ...u, ...formData, password: undefined } // Don't store password in client state
              : u
      ));
      setFeedbackMessage({ type: 'success', text: `用户 "${formData.username}" 更新成功。` });
    }
    // Password handling: In a real app, if formData.password is set for an existing user,
    // it would trigger a password change API call. For this demo, we ignore it for client-side state.
  };


  const handleDeleteUserClick = (user: UserDisplayItem) => {
    setUserToDelete(user);
    setIsConfirmDeleteOpen(true);
    setFeedbackMessage(null);
  };

  const confirmDeleteUser = () => {
    if (userToDelete) {
      setUsers(prev => prev.filter(u => u.id !== userToDelete.id));
      setFeedbackMessage({ type: 'success', text: `用户 "${userToDelete.username}" 已删除。` });
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
              sx={{minWidth: { sm: 300 }}}
          />
          <Button
              variant="contained"
              startIcon={<AddCircleOutlineIcon />}
              onClick={handleAddUserClick}
          >
            添加用户
          </Button>
        </Box>

        <TableContainer component={Paper} sx={{boxShadow: 2}}>
          <Table aria-label="用户列表">
            <TableHead sx={{ bgcolor: 'action.focus' }}>
              <TableRow>
                {[
                  { id: 'username', label: '用户名' },
                  { id: 'role', label: '角色' },
                  { id: 'email', label: '邮箱' },
                  { id: 'status', label: '状态' },
                  { id: 'createdAt', label: '创建日期' },
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
              {filteredAndSortedUsers.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((user) => (
                  <TableRow key={user.id} hover>
                    <TableCell sx={{fontWeight: 'medium'}}>{user.username}</TableCell>
                    <TableCell>
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
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Chip
                          label={user.status === 'active' ? '已激活' : '已禁用'}
                          color={user.status === 'active' ? 'success' : 'error'}
                          size="small"
                          variant="outlined"
                      />
                    </TableCell>
                    <TableCell>{new Date(user.createdAt).toLocaleDateString('zh-CN')}</TableCell>
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
                    <TableCell colSpan={6} align="center" sx={{py: 3}}>
                      <Typography color="text.secondary">没有找到匹配的用户。</Typography>
                    </TableCell>
                  </TableRow>
              )}
            </TableBody>
          </Table>
          <TablePagination
              rowsPerPageOptions={[5, 10, 25]}
              component="div"
              count={filteredAndSortedUsers.length}
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