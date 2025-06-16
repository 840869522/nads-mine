import React from 'react';
import {
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Button,
    Typography,
    Grid as MuiGrid, // Aliased import
    Box,
    Chip,
    Divider,
} from '@mui/material';
import InfoIcon from '@mui/icons-material/Info';
import ComputerIcon from '@mui/icons-material/Computer';
import ViewInArIcon from '@mui/icons-material/ViewInAr';
import LinkIcon from '@mui/icons-material/Link';
import RouterIcon from '@mui/icons-material/Router';
import DnsIcon from '@mui/icons-material/Dns';
import { RunningInstance, InstanceStatus } from '../../types';
import { STATUS_TRANSLATIONS } from '../../constants';

interface InstanceDetailsModalProps {
    open: boolean;
    onClose: () => void;
    instance: RunningInstance | null;
}

const DetailItem: React.FC<{ label: string; value?: string | React.ReactNode; fullWidth?: boolean }> = ({ label, value, fullWidth }) => (
    <MuiGrid item xs={12} sm={fullWidth ? 12 : 6}>
        <Typography variant="caption" color="text.secondary" display="block" gutterBottom sx={{ fontWeight: 'medium' }}>
            {label}
        </Typography>
        {typeof value === 'string' ? <Typography variant="body2">{value || '-'}</Typography> : value || <Typography variant="body2">-</Typography>}
    </MuiGrid>
);


const InstanceDetailsModal: React.FC<InstanceDetailsModalProps> = ({ open, onClose, instance }) => {
    if (!instance) return null;

    const getStatusChipColor = (status: InstanceStatus): "success" | "warning" | "error" | "info" | "default" => {
        switch (status) {
            case 'running': return 'success';
            case 'starting': case 'stopping': case 'deleting': return 'warning';
            case 'stopped': return 'default';
            case 'error': return 'error';
            default: return 'info';
        }
    };

    const getTypeIcon = (type: string) => {
        const iconProps = { sx: { verticalAlign: 'middle', mr: 1 }};
        switch (type) {
            case '虚拟机': return <ComputerIcon {...iconProps} />;
            case '容器': return <ViewInArIcon {...iconProps} />;
            case '交换机': return <DnsIcon {...iconProps} />;
            case '路由器': return <RouterIcon {...iconProps} />;
            case 'NAT网桥': return <LinkIcon {...iconProps} />;
            default: return <InfoIcon {...iconProps} />;
        }
    }

    const isComputeResource = instance.type === '虚拟机' || instance.type === '容器';

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth scroll="paper">
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', borderBottom: 1, borderColor: 'divider' }}>
                {getTypeIcon(instance.type)}
                <Typography variant="h6" component="span">
                    设备详情: {instance.name}
                </Typography>
            </DialogTitle>
            <DialogContent dividers>
                <Box sx={{ mb: 2 }}>
                    <Typography variant="h6" gutterBottom>基本信息</Typography>
                    <MuiGrid container spacing={2}>
                        <DetailItem label="设备 ID (来自拓扑)" value={instance.nodeId} />
                        <DetailItem label="设备名称" value={instance.name} />
                        <DetailItem label="类型" value={instance.type} />
                        <DetailItem
                            label="状态"
                            value={<Chip label={STATUS_TRANSLATIONS[instance.status] || instance.status} color={getStatusChipColor(instance.status)} size="small" />}
                        />
                        <DetailItem label="端口映射" value={instance.ports} />
                        <DetailItem label="镜像" value={instance.imageName} />
                        <DetailItem label="创建于" value={new Date(instance.createdAt).toLocaleString('zh-CN')} />
                    </MuiGrid>
                </Box>
                {isComputeResource && (
                    <>
                        <Divider sx={{my:2}}/>
                        <Box>
                            <Typography variant="h6" gutterBottom>资源使用情况 (模拟)</Typography>
                            <MuiGrid container spacing={2}>
                                <DetailItem label="CPU 使用率" value={instance.cpuUsage} />
                                <DetailItem label="内存使用" value={instance.memoryUsage} />
                                <DetailItem label="磁盘使用" value={instance.diskUsage} />
                                <DetailItem label="已运行时间" value={instance.uptime} />
                            </MuiGrid>
                        </Box>
                    </>
                )}
            </DialogContent>
            <DialogActions sx={{ px:3, py:2, borderTop: 1, borderColor: 'divider' }}>
                <Button onClick={onClose} variant="outlined">关闭</Button>
            </DialogActions>
        </Dialog>
    );
};

export default InstanceDetailsModal;