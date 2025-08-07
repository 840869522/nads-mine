"use client";

import React, { useState, useMemo, useEffect } from 'react';
import {
    Typography,
    Box,
    Paper,
    Button,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    IconButton,
    Chip,
    Tooltip,
    Alert as MuiAlert,
    TableSortLabel,
    CircularProgress,
    TablePagination,
    InputAdornment,
    TextField,
} from '@mui/material';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { UserRole } from '@/types';
import RoleFormModal, { RoleFormData } from '@/components/admin/RoleFormModal';
import ConfirmActionDialog from '@/components/scenario/ConfirmActionDialog';
import ViewRolePermissionsModal from '@/components/admin/ViewRolePermissionsModal'; // New Import
import { apiClientWithToken } from '@/utils/axios';
import SearchIcon from '@mui/icons-material/Search';
import { toast } from 'react-toastify';
import { red } from '@mui/material/colors';


interface MockRole {
    c_id: string;
    c_name: string;
    c_create_at: string,
    c_update_at: string,
    permissions: string[];
}



type Order = 'asc' | 'desc';
type SortableRoleKeys = keyof Pick<MockRole, 'c_id' | "c_name" | "c_create_at" | 'c_update_at'> | 'permissionCount';


const RoleManagementPage: React.FC = () => {
    const [roles, setRoles] = useState<MockRole[]>([]);
    const [count, setCount] = useState<number>(0);
    const [order, setOrder] = useState<Order>('asc');
    const [orderBy, setOrderBy] = useState<SortableRoleKeys>('c_id');
    const [page, setPage] = useState<number>(1);
    const [rowsPerPage, setRowsPerPage] = useState<number>(10);
    const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
    const [editingRole, setEditingRole] = useState<MockRole | null>(null);
    const [tableLaoding, setTableLoading] = useState(true);


    const [searchTerm, setSearchTerm] = useState({ data: '', flag: false });
    const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
    const [roleToDelete, setRoleToDelete] = useState<MockRole | null>(null);

    // State for viewing permissions modal
    const [isViewPermsModalOpen, setIsViewPermsModalOpen] = useState(false);
    const [viewingRolePerms, setViewingRolePerms] = useState<{ nameDisplay: string; permissions: string[] } | null>(null);

    useEffect(() => {
        getRoleData(page, rowsPerPage);
    }, [page, rowsPerPage]);


    const handleAddRoleClick = () => {
        setEditingRole(null);
        setIsRoleModalOpen(true);
    };

    const handleChangePage = (event: unknown, newPage: number) => {
        setPage(newPage + 1);
    };

    const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(1);
    };


    const getRoleData = (page: number, pagesize: number) => {
        setTableLoading(true);
        apiClientWithToken.post(`/back/api/support/role/all`, JSON.stringify({ page: page, pagesize: pagesize }))
            .then((res) => {
                if (res.data.code === 200) {
                    setRoles(res.data.data.data);
                    setCount(res.data.data.count);
                }
                else {
                    toast.error(res.data.message , {
                        autoClose: 3000,
                        closeOnClick: true,
                        pauseOnHover: true,
                        draggable: true,
                      });
                }
            }).finally(() => {
                setTableLoading(false);
            });
    }

    const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm({ data: event.target.value.toLowerCase(), flag: true });
        setPage(1);
    };

    const handleSearchSubmit = async () => {
        setTableLoading(true);
        try {
            const res = await apiClientWithToken.post(`/back/api/support/role/search`, JSON.stringify({
                page: 1,
                pagesize: rowsPerPage,
                name: searchTerm.data
            }));

            if (res.data.code === 200) {
                setRoles(res.data.data.data);
                setCount(res.data.data.count);
                setPage(1);
            }else {
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
    };

    const handleEditRoleClick = (role: MockRole) => {
        apiClientWithToken.post(`/back/api/support/permission/role`, JSON.stringify({ role_id: role.c_id })).then((res) => {
            if (res.data.code === 200) {
                const permision = res.data.data.map(p => p.c_id);
                setEditingRole({ ...role, permissions: permision });
                setIsRoleModalOpen(true);
            } else {
               toast.error(res.data.message,{
                autoClose: 3000,
                closeOnClick: true,
                pauseOnHover: true,
                draggable: true,
              });
            }
        });
    };

    const handleSaveRole = async (formData: RoleFormData, isNew: boolean) => {
        if (isNew) {
            const res = await apiClientWithToken.post(`/back/api/support/role/new`, JSON.stringify({
                data: {
                    id: formData.nameDisplay,
                    name: formData.description,
                    permissions: formData.permissions
                }
            })
            );
            const data = await res.data;
            if (data.code === 200) {
                setPage(1);
                getRoleData(1, rowsPerPage);
                toast.success(`角色 "${formData.nameDisplay}" 添加成功。` , {
                    autoClose: 3000,
                    closeOnClick: true,
                    pauseOnHover: true,
                    draggable: true,
                  });
            } else {
                toast.error(`角色 "${formData.nameDisplay}" 添加失败。` , {
                    autoClose: 3000,
                    closeOnClick: true,
                    pauseOnHover: true,
                    draggable: true,
                  });
            }
        } else if (editingRole) {
            const res = await apiClientWithToken.post(`/back/api/support/role/update`, JSON.stringify({
                id: editingRole.c_id,
                data: {
                    name: formData.description,
                    permissions: formData.permissions
                }
            })
            );
            if (res.data.code === 200) {
                setRoles(prev => prev.map(r =>
                    r.c_id === editingRole.c_id
                        ? { ...r, nameDisplay: formData.nameDisplay, description: formData.description }
                        : r
                ));
                toast.success(`角色 "${formData.nameDisplay}" 更新成功。`, {
                    autoClose: 3000,
                    closeOnClick: true,
                    pauseOnHover: true,
                    draggable: true,
                  });
            } else if (res.data.code !== 405 && res.data.code !== 420 ){
                toast.error(`角色 "${formData.nameDisplay}" ${res.data.message}` , {
                    autoClose: 3000,
                    closeOnClick: true,
                    pauseOnHover: true,
                    draggable: true,
                  });
            }
        }
    };


    const handleDeleteRoleClick = (role: MockRole) => {
        if (role.c_id === UserRole.ADMIN || role.c_id === UserRole.STUDENT) {
            toast.error( `核心角色 "${role.c_id}" 不能被删除。`, {
                autoClose: 3000,
                closeOnClick: true,
                pauseOnHover: true,
                draggable: true,
              });
            return;
        }
        setRoleToDelete(role);
        setIsConfirmDeleteOpen(true);
    };

    /**
     * 待优化
     */
    const confirmDeleteRole = async () => {
        if (roleToDelete) {
            const res = await apiClientWithToken.post(`/back/api/support/role/delete`, JSON.stringify({ id: roleToDelete.c_id }));
            if (res.data.code === 200){
                toast.success(`角色 "${roleToDelete.c_name}" 已删除。`, {
                    autoClose: 3000,
                    closeOnClick: true,
                    pauseOnHover: true,
                    draggable: true,
                  });
                  getRoleData(1, rowsPerPage);
            }else {
                toast.error(`角色 "${roleToDelete.c_name}" 删除失败 - ${res.data.message}。`, {
                    autoClose: 3000,
                    closeOnClick: true,
                    pauseOnHover: true,
                    draggable: true,
                  });
            }
        }
        setIsConfirmDeleteOpen(false);
        setRoleToDelete(null);
    };


    const handleRequestSort = (property: SortableRoleKeys) => {
        const isAsc = orderBy === property && order === 'asc';
        setOrder(isAsc ? 'desc' : 'asc');
        setOrderBy(property);
    };

    const handleViewPermissions = (role: MockRole) => {
        apiClientWithToken.post(`/back/api/support/permission/role`, JSON.stringify({ role_id: role.c_id })).then((res) => {
            if (res.data.code === 200) {
                const permision = res.data.data.map(p => p.c_id);
                setViewingRolePerms({ nameDisplay: role.c_id, permissions: permision });
                setIsViewPermsModalOpen(true);
            }
        });
    };

    const sortedRoles = useMemo(() => {
        let processedRoles = [...roles];
        processedRoles.sort((a, b) => {
            let valA: string | number;
            let valB: string | number;

            if (orderBy === 'permissionCount') {
                valA = a.permissions.length;
                valB = b.permissions.length;
            } else {
                valA = a[orderBy as keyof Pick<MockRole, 'c_id' | 'c_name'>];
                valB = b[orderBy as keyof Pick<MockRole, 'c_id' | 'c_name'>];
            }

            if (typeof valA === 'number' && typeof valB === 'number') {
                return order === 'asc' ? valA - valB : valB - valA;
            }
            // Ensure consistent string comparison
            const strA = String(valA).toLowerCase();
            const strB = String(valB).toLowerCase();
            if (strB < strA) return order === 'asc' ? 1 : -1;
            if (strB > strA) return order === 'asc' ? -1 : 1;
            return 0;
        });
        return processedRoles;
    }, [roles, order, orderBy]);


    return (
        <Paper elevation={1} sx={{ p: { xs: 2, sm: 3 } }}>
            <Typography variant="h4" component="h1" gutterBottom>
                角色管理
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                此页面用于定义和管理平台中的用户角色及其对应的权限。当前页面的访问已通过路由和侧边栏链接限制为管理员。
            </Typography>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
                <Box sx={{ display: "flex", alignItems: "center", mb: 3, gap: 2, flexWrap: "wrap" }}>
                    <TextField
                        variant="outlined"
                        size="small"
                        placeholder="搜索角色..."
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
                    onClick={handleAddRoleClick}
                >
                    添加角色
                </Button>
            </Box>

            <TableContainer component={Paper} sx={{ boxShadow: 2 }}>
                <Table aria-label="角色列表">
                    <TableHead sx={{ bgcolor: 'action.focus' }}>
                        <TableRow>
                            <TableCell>
                                <TableSortLabel
                                    active={orderBy === 'c_id'}
                                    direction={orderBy === 'c_id' ? order : 'asc'}
                                    onClick={() => handleRequestSort('c_id')}
                                >
                                    角色名称
                                </TableSortLabel>
                            </TableCell>
                            <TableCell>
                                <TableSortLabel
                                    active={orderBy === 'c_name'}
                                    direction={orderBy === 'c_name' ? order : 'asc'}
                                    onClick={() => handleRequestSort('c_name')}
                                >
                                    描述
                                </TableSortLabel>
                            </TableCell>
                            <TableCell align="center">
                                <TableSortLabel
                                    active={orderBy === 'c_create_at'}
                                    direction={orderBy === 'c_create_at' ? order : 'asc'}
                                    onClick={() => handleRequestSort('c_create_at')}
                                >
                                    创建时间
                                </TableSortLabel>
                            </TableCell>
                            <TableCell align="center">
                                <TableSortLabel
                                    active={orderBy === 'c_update_at'}
                                    direction={orderBy === 'c_update_at' ? order : 'asc'}
                                    onClick={() => handleRequestSort('c_update_at')}
                                >
                                    最后更新时间
                                </TableSortLabel>
                            </TableCell>
                            <TableCell align="center">
                                <TableSortLabel
                                    active={orderBy === 'permissionCount'}
                                    direction={orderBy === 'permissionCount' ? order : 'asc'}
                                    onClick={() => handleRequestSort('permissionCount')}
                                >
                                    权限数量
                                </TableSortLabel>
                            </TableCell>
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
                            ) : sortedRoles.length > 0 ? sortedRoles.map((role) => {
                                const isCoreRole = role.c_id === UserRole.ADMIN || role.c_id === UserRole.STUDENT;
                                return (
                                    <TableRow key={role.c_id} hover>
                                        <TableCell sx={{ fontWeight: 'medium' }}>{role.c_id}</TableCell>
                                        <TableCell sx={{ maxWidth: 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            <Tooltip title={role.c_id} placement="top-start">
                                                <span>{role.c_name}</span>
                                            </Tooltip>
                                        </TableCell>
                                        <TableCell align='center' sx={{ fontWeight: 'medium' }}>{role.c_create_at}</TableCell>
                                        <TableCell align='center' sx={{ fontWeight: 'medium' }}>{role.c_update_at}</TableCell>
                                        <TableCell align="center">
                                            <Tooltip title={`查看 ${role.c_id} 的权限`}>
                                                <Chip
                                                    icon={<VisibilityIcon fontSize="small" />}
                                                    label={role.c_id}
                                                    size="small"
                                                    variant="outlined"
                                                    onClick={() => handleViewPermissions(role)}
                                                    sx={{ cursor: 'pointer', '&:hover': { backgroundColor: 'action.hover' } }}
                                                />
                                            </Tooltip>
                                        </TableCell>

                                        <TableCell align="center">
                                            <Tooltip title={isCoreRole ? `编辑核心角色 "${role.c_id}"` : `编辑角色 "${role.c_id}"`}>
                                                <IconButton size="small" onClick={() => handleEditRoleClick(role)} color="primary">
                                                    <EditIcon />
                                                </IconButton>
                                            </Tooltip>
                                            <Tooltip title={isCoreRole ? "核心角色不能删除" : `删除角色 "${role.c_id}"`}>
                                                <span> {/* Span needed for disabled IconButton tooltip */}
                                                    <IconButton size="small" onClick={() => handleDeleteRoleClick(role)} color="error" disabled={isCoreRole}>
                                                        <DeleteIcon />
                                                    </IconButton>
                                                </span>
                                            </Tooltip>
                                        </TableCell>
                                    </TableRow>
                                );
                            }) : (
                                <TableRow>
                                    <TableCell colSpan={4} align="center" sx={{ py: 3 }}>
                                        <Typography color="text.secondary">暂无角色数据。</Typography>
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

            <RoleFormModal
                open={isRoleModalOpen}
                onClose={() => setIsRoleModalOpen(false)}
                onSave={handleSaveRole}
                initialRole={editingRole}
            />

            {roleToDelete && (
                <ConfirmActionDialog
                    open={isConfirmDeleteOpen}
                    onClose={() => setIsConfirmDeleteOpen(false)}
                    title="确认删除角色"
                    message={`您确定要删除角色 "${roleToDelete?.c_id}" 吗？此操作无法撤销。`}
                    onConfirm={confirmDeleteRole}
                />
            )}

            {viewingRolePerms && (
                <ViewRolePermissionsModal
                    open={isViewPermsModalOpen}
                    onClose={() => setIsViewPermsModalOpen(false)}
                    roleName={viewingRolePerms.nameDisplay}
                    permissionKeys={viewingRolePerms.permissions}
                />
            )}

            <MuiAlert severity="info" sx={{ mt: 4 }}>
                <Typography variant="subtitle2" gutterBottom>角色与权限配置</Typography>
                此处定义的角色及其权限将实时同步至后端系统，并应用于整个平台的功能访问控制。请谨慎配置，确保权限分配合理，符合安全策略。核心系统角色的权限已预设，以保障基础功能稳定运行。
            </MuiAlert>
        </Paper>
    );
};
export default RoleManagementPage;
