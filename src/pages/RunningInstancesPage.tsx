import React, { useState, useEffect, useCallback } from 'react';
import {
    Box,
    Button,
    Typography,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    IconButton,
    Chip,
    Tooltip,
    CircularProgress,
    Alert as MuiAlert,
    TableSortLabel,
    TablePagination,
    TextField,
    InputAdornment,
    useTheme,
} from '@mui/material';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import RefreshIcon from '@mui/icons-material/Refresh';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import DeleteIcon from '@mui/icons-material/Delete';
import InfoIcon from '@mui/icons-material/Info';
import ComputerIcon from '@mui/icons-material/Computer'; // For VMs
import ViewInArIcon from '@mui/icons-material/ViewInAr'; // For Containers
import SearchIcon from '@mui/icons-material/Search';
import LinkIcon from '@mui/icons-material/Link';
import RouterIcon from '@mui/icons-material/Router';
import DnsIcon from '@mui/icons-material/Dns'; // Using Dns as a proxy for Switch


import { RunningInstance, InstanceStatus } from '../types';
import { INITIAL_RUNNING_INSTANCES, STATUS_TRANSLATIONS } from '../constants';
import InstanceDetailsModal from '../components/scenario/InstanceDetailsModal';
import ConfirmActionDialog from '../components/scenario/ConfirmActionDialog';

type Order = 'asc' | 'desc';
type SortableInstanceKeys = keyof Pick<RunningInstance, 'name' | 'type' | 'status' | 'imageName' | 'createdAt' | 'uptime'>;

const RunningInstancesPage: React.FC = () => {
    const theme = useTheme();
    const [instances, setInstances] = useState<RunningInstance[]>(INITIAL_RUNNING_INSTANCES);
    const [isLoading, setIsLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedInstance, setSelectedInstance] = useState<RunningInstance | null>(null);

    const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
    const [confirmActionProps, setConfirmActionProps] = useState<{
        title: string;
        message: string;
        onConfirm: () => void;
        instanceName?: string;
    } | null>(null);

    const [order, setOrder] = useState<Order>('asc');
    const [orderBy, setOrderBy] = useState<SortableInstanceKeys>('name');
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(5);
    const [searchTerm, setSearchTerm] = useState('');

    const handleRequestSort = (property: SortableInstanceKeys) => {
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

    const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(event.target.value.toLowerCase());
        setPage(0);
    };

    const getStatusChipColor = (status: InstanceStatus): "success" | "warning" | "error" | "info" | "default" => {
        switch (status) {
            case 'running': return 'success';
            case 'starting':
            case 'stopping':
            case 'deleting':
                return 'warning';
            case 'stopped': return 'default';
            case 'error': return 'error';
            default: return 'info';
        }
    };

    // --- FIX START ---
    // The getTypeIcon function is updated to handle string type and more device cases.
    const getTypeIcon = (type: string) => {
        const iconProps = { sx: { verticalAlign: 'middle', mr: 0.5 }, fontSize: "small" as "small" };
        switch (type) {
            case 'vm': return <ComputerIcon  {...iconProps} />;
            case 'container': return <ViewInArIcon {...iconProps} />;
            case '交换机': return <DnsIcon {...iconProps} />;
            case '路由器': return <RouterIcon {...iconProps} />;
            case 'NAT网桥': return <LinkIcon {...iconProps} />;
            default: return null;
        }
    };
    // --- FIX END ---

    const handleRefresh = () => {
        setIsLoading(true);
        setTimeout(() => {
            setInstances([...INITIAL_RUNNING_INSTANCES].sort(() => Math.random() - 0.5));
            setIsLoading(false);
        }, 1000);
    };

    const handleOpenDetailsModal = (instance: RunningInstance) => {
        setSelectedInstance(instance);
        setIsModalOpen(true);
    };

    const handleCloseDetailsModal = () => {
        setIsModalOpen(false);
        setSelectedInstance(null);
    };

    const simulateAction = (instanceId: string, targetStatus: InstanceStatus, intermediateStatus?: InstanceStatus, delay: number = 1500) => {
        if (intermediateStatus) {
            setInstances(prev => prev.map(inst => inst.id === instanceId ? { ...inst, status: intermediateStatus } : inst));
        }
        setTimeout(() => {
            setInstances(prev => prev.map(inst => inst.id === instanceId ? { ...inst, status: targetStatus } : inst));
        }, intermediateStatus ? delay : 0);
    };

    const handleStartInstance = (instance: RunningInstance) => {
        setConfirmActionProps({
            title: `启动实例: ${instance.name}`,
            message: `您确定要启动实例 "${instance.name}" 吗？`,
            onConfirm: () => simulateAction(instance.id, 'running', 'starting'),
            instanceName: instance.name
        });
        setIsConfirmDialogOpen(true);
    };

    const handleStopInstance = (instance: RunningInstance) => {
        setConfirmActionProps({
            title: `停止实例: ${instance.name}`,
            message: `您确定要停止实例 "${instance.name}" 吗？`,
            onConfirm: () => simulateAction(instance.id, 'stopped', 'stopping'),
            instanceName: instance.name
        });
        setIsConfirmDialogOpen(true);
    };

    const handleRestartInstance = (instance: RunningInstance) => {
        setConfirmActionProps({
            title: `重启实例: ${instance.name}`,
            message: `您确定要重启实例 "${instance.name}" 吗？该操作会先停止再启动实例。`,
            onConfirm: () => {
                simulateAction(instance.id, 'starting', 'stopping', 1500);
                setTimeout(() => simulateAction(instance.id, 'running'), 3000);
            },
            instanceName: instance.name
        });
        setIsConfirmDialogOpen(true);
    };

    const handleDeleteInstance = (instance: RunningInstance) => {
        setConfirmActionProps({
            title: `删除实例: ${instance.name}`,
            message: `您确定要永久删除实例 "${instance.name}" 吗？此操作无法撤销。`,
            onConfirm: () => {
                simulateAction(instance.id, 'deleting');
                setTimeout(() => {
                    setInstances(prev => prev.filter(inst => inst.id !== instance.id));
                }, 1500);
            },
            instanceName: instance.name
        });
        setIsConfirmDialogOpen(true);
    };

    const handleCreateInstance = () => {
        alert("创建新实例功能暂未实现。");
    };

    const sortedAndFilteredInstances = React.useMemo(() => {
        let processedInstances = [...instances].filter(instance =>
            instance.name.toLowerCase().includes(searchTerm) ||
            instance.imageName.toLowerCase().includes(searchTerm) ||
            (instance.ipAddress && instance.ipAddress.includes(searchTerm))
        );

        processedInstances.sort((a, b) => {
            let valA: string | number = a[orderBy];
            let valB: string | number = b[orderBy];

            if (orderBy === 'uptime') {
                valA = String(valA).length;
                valB = String(valB).length;
            }

            if (valB < valA) return order === 'asc' ? 1 : -1;
            if (valB > valA) return order === 'asc' ? -1 : 1;
            return 0;
        });
        return processedInstances;
    }, [instances, order, orderBy, searchTerm]);

    return (
        <Box sx={{ p: { xs: 2, sm: 3 } }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
                <Typography variant="h4" component="h1">
                    实例管理
                </Typography>
                <Box sx={{ display: 'flex', gap: 1}}>
                    <Button
                        variant="outlined"
                        startIcon={isLoading ? <CircularProgress size={20} color="inherit" /> : <RefreshIcon />}
                        onClick={handleRefresh}
                        disabled={isLoading}
                        aria-label="刷新实例列表"
                    >
                        刷新
                    </Button>
                    <Button
                        variant="contained"
                        startIcon={<AddCircleOutlineIcon />}
                        onClick={handleCreateInstance}
                        aria-label="创建新实例"
                    >
                        创建实例
                    </Button>
                </Box>
            </Box>

            <TextField
                fullWidth
                variant="outlined"
                placeholder="搜索实例 (名称, 镜像, IP)..."
                onChange={handleSearchChange}
                InputProps={{
                    startAdornment: (
                        <InputAdornment position="start">
                            <SearchIcon />
                        </InputAdornment>
                    ),
                }}
                sx={{ mb: 2 }}
            />

            <TableContainer component={Paper} sx={{ boxShadow: 2 }}>
                <Table aria-label="运行中实例列表">
                    <TableHead
                        sx={{
                            bgcolor: theme.palette.mode === 'dark' ? theme.palette.grey[800] : theme.palette.grey[200],
                            '& .MuiTableCell-head': {
                                fontWeight: 'bold',
                                color: theme.palette.mode === 'dark' ? theme.palette.getContrastText(theme.palette.grey[800]) : theme.palette.getContrastText(theme.palette.grey[200]),
                            },
                            '& .MuiTableSortLabel-root': {
                                color: theme.palette.mode === 'dark' ? `${theme.palette.getContrastText(theme.palette.grey[800])} !important` : `${theme.palette.getContrastText(theme.palette.grey[200])} !important`,
                            },
                            '& .MuiTableSortLabel-icon': {
                                color: theme.palette.mode === 'dark' ? `${theme.palette.getContrastText(theme.palette.grey[800])} !important` : `${theme.palette.getContrastText(theme.palette.grey[200])} !important`,
                            }
                        }}
                    >
                        <TableRow>
                            <TableCell>
                                <TableSortLabel active={orderBy === 'name'} direction={orderBy === 'name' ? order : 'asc'} onClick={() => handleRequestSort('name')}>名称</TableSortLabel>
                            </TableCell>
                            <TableCell>
                                <TableSortLabel active={orderBy === 'type'} direction={orderBy === 'type' ? order : 'asc'} onClick={() => handleRequestSort('type')}>类型</TableSortLabel>
                            </TableCell>
                            <TableCell>
                                <TableSortLabel active={orderBy === 'status'} direction={orderBy === 'status' ? order : 'asc'} onClick={() => handleRequestSort('status')}>状态</TableSortLabel>
                            </TableCell>
                            <TableCell>IP地址</TableCell>
                            <TableCell>
                                <TableSortLabel active={orderBy === 'imageName'} direction={orderBy === 'imageName' ? order : 'asc'} onClick={() => handleRequestSort('imageName')}>镜像</TableSortLabel>
                            </TableCell>
                            <TableCell>CPU</TableCell>
                            <TableCell>内存</TableCell>
                            <TableCell>
                                <TableSortLabel active={orderBy === 'uptime'} direction={orderBy === 'uptime' ? order : 'asc'} onClick={() => handleRequestSort('uptime')}>运行时间</TableSortLabel>
                            </TableCell>
                            <TableCell>
                                <TableSortLabel active={orderBy === 'createdAt'} direction={orderBy === 'createdAt' ? order : 'asc'} onClick={() => handleRequestSort('createdAt')}>创建于</TableSortLabel>
                            </TableCell>
                            <TableCell align="center">操作</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {isLoading && (
                            <TableRow>
                                <TableCell colSpan={10} align="center" sx={{ py: 3 }}>
                                    <CircularProgress />
                                    <Typography>正在加载实例...</Typography>
                                </TableCell>
                            </TableRow>
                        )}
                        {!isLoading && sortedAndFilteredInstances.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={10} align="center" sx={{ py: 3 }}>
                                    <MuiAlert severity="info" sx={{ justifyContent: 'center' }}>没有找到符合条件的实例，或当前没有运行中的实例。</MuiAlert>
                                </TableCell>
                            </TableRow>
                        )}
                        {!isLoading && sortedAndFilteredInstances.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((instance) => {
                            const isActionable = !['starting', 'stopping', 'deleting'].includes(instance.status);
                            return (
                                <TableRow key={instance.id} hover sx={{ '&:nth-of-type(odd)': { backgroundColor: 'action.hover' } }}>
                                    <TableCell component="th" scope="row" sx={{fontWeight:'medium'}}>{instance.name}</TableCell>
                                    {/* --- FIX START --- */}
                                    <TableCell>
                                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                            {getTypeIcon(instance.type)}
                                            {/* Display the correct Chinese name based on the type string */}
                                            {instance.type === 'vm' ? '虚拟机' : '容器'}
                                        </Box>
                                    </TableCell>
                                    {/* --- FIX END --- */}
                                    <TableCell>
                                        <Chip label={STATUS_TRANSLATIONS[instance.status]} color={getStatusChipColor(instance.status)} size="small" />
                                    </TableCell>
                                    <TableCell>{instance.ipAddress || '-'}</TableCell>
                                    <TableCell>{instance.imageName}</TableCell>
                                    <TableCell>{instance.cpuUsage}</TableCell>
                                    <TableCell>{instance.memoryUsage}</TableCell>
                                    <TableCell>{instance.uptime}</TableCell>
                                    <TableCell>{new Date(instance.createdAt).toLocaleDateString('zh-CN')}</TableCell>
                                    <TableCell align="center">
                                        <Tooltip title="详情">
                                            <IconButton onClick={() => handleOpenDetailsModal(instance)} size="small" aria-label={`查看实例 ${instance.name} 详情`}>
                                                <InfoIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                        {instance.status === 'running' && (
                                            <Tooltip title="停止">
                        <span>
                          <IconButton onClick={() => handleStopInstance(instance)} size="small" disabled={!isActionable} aria-label={`停止实例 ${instance.name}`}>
                            <StopIcon fontSize="small" color={isActionable ? "error" : "disabled"}/>
                          </IconButton>
                        </span>
                                            </Tooltip>
                                        )}
                                        {instance.status === 'stopped' && (
                                            <Tooltip title="启动">
                         <span>
                          <IconButton onClick={() => handleStartInstance(instance)} size="small" disabled={!isActionable} aria-label={`启动实例 ${instance.name}`}>
                            <PlayArrowIcon fontSize="small" color={isActionable ? "success" : "disabled"} />
                          </IconButton>
                        </span>
                                            </Tooltip>
                                        )}
                                        {(instance.status === 'running' || instance.status === 'error') && (
                                            <Tooltip title="重启">
                         <span>
                          <IconButton onClick={() => handleRestartInstance(instance)} size="small" disabled={!isActionable} aria-label={`重启实例 ${instance.name}`}>
                            <RestartAltIcon fontSize="small" color={isActionable ? "primary" : "disabled"} />
                          </IconButton>
                        </span>
                                            </Tooltip>
                                        )}
                                        {(instance.status === 'stopped' || instance.status === 'error') && (
                                            <Tooltip title="删除">
                        <span>
                          <IconButton onClick={() => handleDeleteInstance(instance)} size="small" disabled={!isActionable} aria-label={`删除实例 ${instance.name}`}>
                            <DeleteIcon fontSize="small" color={isActionable ? "error" : "disabled"} />
                          </IconButton>
                        </span>
                                            </Tooltip>
                                        )}
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
                <TablePagination
                    rowsPerPageOptions={[5, 10, 25]}
                    component="div"
                    count={sortedAndFilteredInstances.length}
                    rowsPerPage={rowsPerPage}
                    page={page}
                    onPageChange={handleChangePage}
                    onRowsPerPageChange={handleChangeRowsPerPage}
                    labelRowsPerPage="每页行数:"
                    labelDisplayedRows={({ from, to, count }) => `${from}-${to} 共 ${count !== -1 ? count : `超过 ${to}`}`}
                />
            </TableContainer>

            {selectedInstance && (
                <InstanceDetailsModal
                    open={isModalOpen}
                    onClose={handleCloseDetailsModal}
                    instance={selectedInstance}
                />
            )}

            {confirmActionProps && (
                <ConfirmActionDialog
                    open={isConfirmDialogOpen}
                    onClose={() => setIsConfirmDialogOpen(false)}
                    title={confirmActionProps.title}
                    message={confirmActionProps.message}
                    onConfirm={() => {
                        confirmActionProps.onConfirm();
                        setIsConfirmDialogOpen(false);
                    }}
                />
            )}
        </Box>
    );
};

export default RunningInstancesPage;