"use client";

import React, { useState, useMemo, useEffect, useRef } from 'react';
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
import CryptoJS from "crypto-js";
import { toast } from 'react-toastify';
import { DownloadOutlined } from '@mui/icons-material';
import * as XLSX from "xlsx";

// Mock User Data Type (ensure it matches what UserFormModal expects for initialUser)
type UserDisplayItem = { c_username: string; c_name: string, c_email: string; c_is_login: 1 | 0; c_create_at: string, c_update_at: string, c_last_login: string };


type Order = 'asc' | 'desc';
type SortableUserKeys = keyof Pick<UserDisplayItem, 'c_username' | 'c_name' | 'c_email' | 'c_is_login' | 'c_create_at' | 'c_update_at' | 'c_last_login'>;


const UserManagementPage: React.FC = () => {
  const [users, setUsers] = useState<UserDisplayItem[]>([]);
  const [searchTerm, setSearchTerm] = useState({ data: '', flag: false });
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [order, setOrder] = useState<Order>('asc');
  const [orderBy, setOrderBy] = useState<SortableUserKeys>('c_username');

  const [count, setDataCount] = useState<number>(0);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserDisplayItem & { c_password: string } | null>(null);

  const [tableLaoding, setTableLoading] = useState(true);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserDisplayItem | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchTerm.data.trim()) getUserDataSearch(page, rowsPerPage);
    else getUserData(page, rowsPerPage)
  }, [page, rowsPerPage]);

  const getUserData = (page: number, pagesize: number) => {
    setTableLoading(true);
    apiClientWithToken.post(`/back/api/support/user/all`, JSON.stringify({ page: page, pagesize: pagesize })).then((res) => {
      if (res.data.code === 200) {
        setUsers(res.data.data.data);
        setDataCount(res.data.data.count);
      }
    }).finally(() => {
      setTimeout(() => {
        setTableLoading(false);
      }, 600);

    });
  };


  const getUserDataSearch = async (page: number, pagesize: number) => {
    setTableLoading(true);
    try {
      const res = await apiClientWithToken.post(`/back/api/support/user/search`, JSON.stringify({
        page: page,
        pagesize: pagesize,
        name: searchTerm.data
      }));

      if (res.data.code === 200) {
        setUsers(res.data.data.data);
        setDataCount(res.data.data.count);
      } else {
        throw new Error(res.data.message);
      }
    } catch (error) {
      toast.error(`搜索用户时发生错误 - ${error.message}`, {
        autoClose: 3000,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
    } finally {
      setTableLoading(false);
    }
  }

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm({ data: event.target.value.toLowerCase(), flag: true });
    setPage(1);
  };

  const handleSearchSubmit = async () => {
    await getUserDataSearch(1, rowsPerPage);
    setPage(1);
  };

  const handleRequestSort = (property: SortableUserKeys) => {
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
    setEditingUser(null);
    setIsUserModalOpen(true);
  };

  const handleEditUserClick = (user: UserDisplayItem) => {
    apiClientWithToken.post(`/back/api/support/user/id`, JSON.stringify({ id: user.c_username })).then((res) => {
      if (res.data.code === 200) {
        setEditingUser(res.data.data);
        setIsUserModalOpen(true);
      } else {
        toast.error(`发生错误 - ${res.data.message}`, {
          autoClose: 3000,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        });
      }
    })
  };

  const handleSaveUser = async (formData: UserFormData, isNew: boolean) => {
    var userData = {
      username: formData.username,
      email: formData.email,
      password: "",
      is_login: formData.status == "active" ? 1 : 0,
      role: [...formData.role],
      name: formData.name
    }
    if (isNew) {
      userData.password = CryptoJS.SHA256(formData.password).toString()
      apiClientWithToken.post(`/back/api/support/user/new`, JSON.stringify({ data: { ...userData } })).then((res) => {
        if (res.data.code === 200) {
          setPage(1);;
          getUserData(1, rowsPerPage);
          toast.success(`用户 "${formData.username}" 添加成功。`, {
            autoClose: 3000,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
          });
        } else {
          toast.error(`用户 "${formData.username}" 添加失败。`, {
            autoClose: 3000,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
          });
        }
      });
    } else if (editingUser) {
      userData.password = formData.pwdedit ? CryptoJS.SHA256(formData.password).toString() : editingUser.c_password;
      const res = await apiClientWithToken.post(`/back/api/support/user/update`, JSON.stringify({
        id: editingUser.c_username,
        data: {
          ...userData
        }
      }));
      if (res.data.code === 200) {
        setUsers(prev => prev.map(u =>
          u.c_username === editingUser.c_username ? { ...u, c_name: formData.name, c_username: formData.username!, c_role: formData.role!, c_email: formData.email!, c_is_login: formData.status === 'active' ? 1 : 0 } : u
        ));
        toast.success(`用户 "${formData.username}" 更新成功。`, {
          autoClose: 3000,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        });
      } else {
        toast.error(`用户 "${formData.username}" 更新失败。`, {
          autoClose: 3000,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        });
      }
    }
  };


  const handleDeleteUserClick = (user: UserDisplayItem) => {
    setUserToDelete(user);
    setIsConfirmDeleteOpen(true);
  };

  const confirmDeleteUser = () => {
    if (userToDelete) {
      apiClientWithToken.post(`/back/api/support/user/delete`, JSON.stringify({ id: userToDelete.c_username })).then((res) => {
        if (res.data.code === 200) {
          setUsers(prev => prev.filter(u => u.c_username !== userToDelete.c_username));
          toast.success(`用户 "${userToDelete.c_username}" 已删除。`, {
            autoClose: 3000,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
          });
        } else
          toast.error(`用户 "${userToDelete.c_username}" 删除失败。`, {
            autoClose: 3000,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
          });
      });
    }
    setIsConfirmDeleteOpen(false);
    setUserToDelete(null);
  };


  const handleInputExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      // 1. 文件类型验证
      if (!file.name.match(/\.(xlsx|xls)$/)) {
        throw new Error("仅支持 .xlsx 或 .xls 格式");
      }

      // 2. 读取文件内容
      const reader = new FileReader();
      reader.onload = (event) => {
        const data = event.target?.result;
        if (!data) throw new Error("文件读取失败");

        // 3. 解析 Excel 数据
        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheet = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheet];

        // 4. 转换为 JSON 数组（跳过空行）
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }).filter(
          row => Array.isArray(row) && row.some(cell => cell?.toString().trim())
        );

        // 5. 验证表头是否匹配
        const expectedHeaders = [
          '用户名', '姓名', '邮箱', '状态', '创建日期', '更新日期', '最后登录日期'
        ];
        const fileHeaders = jsonData[0] as string[];
        if (!expectedHeaders.every((h, i) => h === fileHeaders[i])) {
          throw new Error("Excel 表头格式不正确，请使用标准模板");
        }

        // 6. 转换数据格式
        const usersToImport = jsonData.slice(1).map(row => ({
          username: row[0],
          name: row[1],
          email: row[2],
          status: row[3] === '已激活' ? 1 : 0,
          password: CryptoJS.SHA256("123456").toString() // 默认密码
        }));

        // 7. 调用 API 批量导入
        apiClientWithToken.post(`/back/api/support/user/batch`, {
          users: usersToImport
        }).then(res => {
          if (res.data.code === 200) {
            toast.success(`成功导入 ${usersToImport.length} 个用户`, {
              autoClose: 3000,
              closeOnClick: true,
              pauseOnHover: true,
              draggable: true,
            });
            getUserData(1, rowsPerPage); // 刷新数据
          } else {
            throw new Error(res.data.message || "导入失败");
          }
        }).catch(error => {
          toast.error(`导入失败: ${error.message}`, {
            autoClose: 3000,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
          });
        });
      };

      reader.readAsBinaryString(file);
    } catch (error) {
      toast.error(`导入失败: ${error.message}`, {
        autoClose: 3000,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''; // 重置文件输入
    }
  };

  const handleOutputExcel = async () => {
    // 1. 定义表头和数据映射
    const headers = [
      ['用户名', '姓名', '密码', '邮箱', '状态', '创建日期', '更新日期', '最后登录日期'],
      ['用户名', '角色名']
    ];
    const res = await apiClientWithToken.post("/back/api/support/user/2excel", JSON.stringify({ page: -1, pagesize: 10 }));
    if (res.data.code !== 200) {
      toast.error(`导出失败 - ${res.data.message}`, {
        autoClose: 3000,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      })
      return
    }
    // 2. 转换数据格式
    const worksheetData = [
      headers[0], 
      ...res.data.data.all_user.data.map(user => [
        user.c_username,
        user.c_name,
        user.c_password,
        user.c_email,
        user.c_is_login ? '已激活' : '已禁用',
        user.c_create_at,
        user.c_update_at,
        user.c_last_login
      ])
    ];

    const u2rWorkSheetData = [
      headers[1],
      ...res.data.data.user_role.data.map(u2r => [
        u2r.c_user_id,
        u2r.c_role_id
      ])
    ]

    // 3. 创建工作表和工作簿
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    const u2rWorkSheet = XLSX.utils.aoa_to_sheet(u2rWorkSheetData);

    const autoWidth = (ws, data) =>{
      const colWidths = data[0].map((_, colIndex) => {
        const maxLen = Math.max(...data.map(row => row[colIndex]?.toString().length || 0));
        return { wch: maxLen + 2 };
      });
      ws['!cols'] = colWidths;
    }
    autoWidth(u2rWorkSheet,u2rWorkSheetData);
    autoWidth(worksheet,worksheetData);

    // 5. 创建工作簿并导出
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "用户列表");
    XLSX.utils.book_append_sheet(workbook,u2rWorkSheet,"用户-角色列表");

    // 6. 生成并下载文件
    XLSX.writeFile(workbook, `用户列表-${new Date().toISOString().slice(0, 10)}.xlsx`);
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
        用户管理
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        此页面用于管理平台用户账户、分配角色以及查看用户活动。
      </Typography>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ display: "flex", alignItems: "center", mb: 3, gap: 2, flexWrap: "wrap" }}>
          <TextField
            variant="outlined"
            size="small"
            placeholder="搜索用户..."
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

        <Box sx={{ display: "flex", alignItems: "center", mb: 3, gap: 2, flexWrap: "wrap" }}>
          {/* <Box>
            <Button
              variant="contained"
              startIcon={<AddCircleOutlineIcon />}
              onClick={() => fileInputRef.current?.click()}
            >
              导入数据
            </Button>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleInputExcel}
              ref={fileInputRef}
              style={{ display: 'none' }}
            />
          </Box> */}
          <Button
            variant='contained'
            startIcon={<DownloadOutlined />}
            onClick={handleOutputExcel}
          >
            导出数据
          </Button>
          <Button
            variant="contained"
            startIcon={<AddCircleOutlineIcon />}
            onClick={handleAddUserClick}
          >
            添加用户
          </Button>
        </Box>
      </Box>
      <TableContainer component={Paper} sx={{ boxShadow: 2 }}>
        <Table aria-label="用户列表">
          <TableHead sx={{ bgcolor: 'action.focus' }}>
            <TableRow>
              {[
                { id: 'c_username', label: '用户名' },
                { id: 'c_name', label: "姓名" },
                { id: 'c_email', label: '邮箱' },
                { id: 'c_is_login', label: '状态' },
                { id: 'c_create_at', label: '创建日期' },
                { id: 'c_update_at', label: '更新日期' },
                { id: 'c_last_ogin', label: '最后登录日期' },
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
            {
              tableLaoding ? (
                <TableRow>
                  <TableCell colSpan={7} align='center' sx={{ height: "40vh" }}>
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : filteredAndSortedUsers.length > 0 ?
                filteredAndSortedUsers.map((user) => (
                  <TableRow key={user.c_username} hover>
                    <TableCell sx={{ fontWeight: 'medium' }}>{user.c_username}</TableCell>
                    <TableCell sx={{ fontWeight: "medium" }}>{user.c_name}</TableCell>
                    <TableCell>{user.c_email}</TableCell>
                    <TableCell>
                      <Chip
                        label={user.c_is_login ? '已激活' : '已禁用'}
                        color={user.c_is_login ? 'success' : 'error'}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>{user.c_create_at}</TableCell>
                    <TableCell>{user.c_update_at}</TableCell>
                    <TableCell>{user.c_last_login}</TableCell>
                    <TableCell align="center">
                      <Tooltip title="编辑用户">
                        <IconButton size="small" onClick={() => handleEditUserClick(user)} color="primary">
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="删除用户">
                        <IconButton size="small" onClick={() => handleDeleteUserClick(user)} color="error" disabled={user.c_username === 'admin' /* Prevent deleting main admin for demo */}>
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
                : (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 3 }}>
                      <Typography color="text.secondary">没有找到匹配的用户。</Typography>
                    </TableCell>
                  </TableRow>
                )
            }
          </TableBody>
        </Table>
        <TablePagination
          rowsPerPageOptions={[10, 30, 50]}
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
          message={`您确定要删除用户 "${userToDelete?.c_username}" 吗？此操作无法撤销。`}
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