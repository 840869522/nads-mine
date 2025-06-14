
import React, { useState, useMemo } from 'react';
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
} from '@mui/material';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import GppGoodIcon from '@mui/icons-material/GppGood';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { UserRole } from '../../types';
import { USER_ROLES_CONFIG } from '../../constants';
import RoleFormModal, { RoleFormData } from '../../components/admin/RoleFormModal';
import ConfirmActionDialog from '../../components/scenario/ConfirmActionDialog';
import ViewRolePermissionsModal from '../../components/admin/ViewRolePermissionsModal'; // New Import


interface MockRole {
    id: string;
    nameKey: UserRole;
    nameDisplay: string;
    description: string;
    permissions: string[];
}

const MOCK_ROLES_INITIAL: MockRole[] = Object.entries(USER_ROLES_CONFIG).map(([key, value], index) => ({
    id: `role_core_${key}_${index}`,
    nameKey: key as UserRole,
    nameDisplay: value.name,
    description: `管理${value.name}的相关权限和访问级别。这是系统核心角色。`,
    permissions: [...value.permissions],
}));


type Order = 'asc' | 'desc';
type SortableRoleKeys = keyof Pick<MockRole, 'nameDisplay' | 'description'> | 'permissionCount';


const RoleManagementPage: React.FC = () => {
    const [roles, setRoles] = useState<MockRole[]>(MOCK_ROLES_INITIAL);
    const [order, setOrder] = useState<Order>('asc');
    const [orderBy, setOrderBy] = useState<SortableRoleKeys>('nameDisplay');

    const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
    const [editingRole, setEditingRole] = useState<MockRole | null>(null);

    const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
    const [roleToDelete, setRoleToDelete] = useState<MockRole | null>(null);
    const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    // State for viewing permissions modal
    const [isViewPermsModalOpen, setIsViewPermsModalOpen] = useState(false);
    const [viewingRolePerms, setViewingRolePerms] = useState<{ nameDisplay: string; permissions: string[] } | null>(null);


    const handleAddRoleClick = () => {
        setEditingRole(null);
        setIsRoleModalOpen(true);
        setFeedbackMessage(null);
    };

    const handleEditRoleClick = (role: MockRole) => {
        setEditingRole(role);
        setIsRoleModalOpen(true);
        setFeedbackMessage(null);
    };

    const handleSaveRole = (formData: RoleFormData, isNew: boolean) => {
        if (isNew) {
            const newRole: MockRole = {
                id: `role_custom_${Date.now()}`,
                nameKey: ('custom_' + formData.nameDisplay.toLowerCase().replace(/\s+/g, '_')) as UserRole, // Simple key generation
                nameDisplay: formData.nameDisplay,
                description: formData.description,
                permissions: formData.permissions,
            };
            setRoles(prev => [newRole, ...prev]);
            setFeedbackMessage({ type: 'success', text: `角色 "${newRole.nameDisplay}" 添加成功。` });
        } else if (editingRole) {
            setRoles(prev => prev.map(r =>
                r.id === editingRole.id
                    ? { ...r, nameDisplay: formData.nameDisplay, description: formData.description, permissions: formData.permissions }
                    : r
            ));
            setFeedbackMessage({ type: 'success', text: `角色 "${formData.nameDisplay}" 更新成功。` });
        }
    };


    const handleDeleteRoleClick = (role: MockRole) => {
        if (role.nameKey === UserRole.ADMIN || role.nameKey === UserRole.STUDENT) {
            setFeedbackMessage({ type: 'error', text: `核心角色 "${role.nameDisplay}" 不能被删除。` });
            return;
        }
        setRoleToDelete(role);
        setIsConfirmDeleteOpen(true);
        setFeedbackMessage(null);
    };

    const confirmDeleteRole = () => {
        if (roleToDelete) {
            setRoles(prev => prev.filter(r => r.id !== roleToDelete.id));
            setFeedbackMessage({ type: 'success', text: `角色 "${roleToDelete.nameDisplay}" 已删除。` });
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
        setViewingRolePerms({ nameDisplay: role.nameDisplay, permissions: role.permissions });
        setIsViewPermsModalOpen(true);
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
                valA = a[orderBy as keyof Pick<MockRole, 'nameDisplay' | 'description'>];
                valB = b[orderBy as keyof Pick<MockRole, 'nameDisplay' | 'description'>];
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

            {feedbackMessage && (
                <MuiAlert severity={feedbackMessage.type} sx={{ mb: 2 }} onClose={() => setFeedbackMessage(null)}>
                    {feedbackMessage.text}
                </MuiAlert>
            )}

            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 3 }}>
                <Button
                    variant="contained"
                    startIcon={<AddCircleOutlineIcon />}
                    onClick={handleAddRoleClick}
                >
                    添加角色
                </Button>
            </Box>

            <TableContainer component={Paper} sx={{boxShadow: 2}}>
                <Table aria-label="角色列表">
                    <TableHead sx={{ bgcolor: 'action.focus' }}>
                        <TableRow>
                            <TableCell>
                                <TableSortLabel
                                    active={orderBy === 'nameDisplay'}
                                    direction={orderBy === 'nameDisplay' ? order : 'asc'}
                                    onClick={() => handleRequestSort('nameDisplay')}
                                >
                                    角色名称
                                </TableSortLabel>
                            </TableCell>
                            <TableCell>
                                <TableSortLabel
                                    active={orderBy === 'description'}
                                    direction={orderBy === 'description' ? order : 'asc'}
                                    onClick={() => handleRequestSort('description')}
                                >
                                    描述
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
                        {sortedRoles.map((role) => {
                            const isCoreRole = role.nameKey === UserRole.ADMIN || role.nameKey === UserRole.STUDENT;
                            return (
                                <TableRow key={role.id} hover>
                                    <TableCell sx={{fontWeight: 'medium'}}>{role.nameDisplay}</TableCell>
                                    <TableCell sx={{maxWidth: 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
                                        <Tooltip title={role.description} placement="top-start">
                                            <span>{role.description}</span>
                                        </Tooltip>
                                    </TableCell>
                                    <TableCell align="center">
                                        <Tooltip title={`查看 ${role.nameDisplay} 的权限`}>
                                            <Chip
                                                icon={<VisibilityIcon fontSize="small" />}
                                                label={role.permissions.length}
                                                size="small"
                                                variant="outlined"
                                                onClick={() => handleViewPermissions(role)}
                                                sx={{ cursor: 'pointer', '&:hover': { backgroundColor: 'action.hover' } }}
                                            />
                                        </Tooltip>
                                    </TableCell>
                                    <TableCell align="center">
                                        <Tooltip title={isCoreRole ? `编辑核心角色 "${role.nameDisplay}"` : `编辑角色 "${role.nameDisplay}"`}>
                                            <IconButton size="small" onClick={() => handleEditRoleClick(role)} color="primary">
                                                <EditIcon />
                                            </IconButton>
                                        </Tooltip>
                                        <Tooltip title={isCoreRole ? "核心角色不能删除" : `删除角色 "${role.nameDisplay}"`}>
                      <span> {/* Span needed for disabled IconButton tooltip */}
                          <IconButton size="small" onClick={() => handleDeleteRoleClick(role)} color="error" disabled={isCoreRole}>
                          <DeleteIcon />
                        </IconButton>
                      </span>
                                        </Tooltip>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                        {!sortedRoles.length && (
                            <TableRow>
                                <TableCell colSpan={4} align="center" sx={{py: 3}}>
                                    <Typography color="text.secondary">暂无角色数据。</Typography>
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
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
                    message={`您确定要删除角色 "${roleToDelete?.nameDisplay}" 吗？此操作无法撤销。`}
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