// file: app/ad/team/InstanceDetailsDialog.tsx
"use client";

import React from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import ListSubheader from '@mui/material/ListSubheader';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import MemoryIcon from '@mui/icons-material/Memory'; // VM icon
import WysiwygIcon from '@mui/icons-material/Wysiwyg'; // Container icon
import HubIcon from '@mui/icons-material/Hub'; // Switch icon

// --- 定义组件接收的数据类型 ---
interface Resource {
    name?: string;
    id?: string;
    ip?: string | null;
    is_target?: boolean;
}

interface InstanceDetails {
    instance_id: string;
    scenario_name: string;
    status: string;
    resources: {
        vms: Resource[];
        containers: Resource[];
        switches: Resource[];
    };
}

interface InstanceDetailsDialogProps {
    open: boolean;
    onClose: () => void;
    isLoading: boolean;
    details: InstanceDetails | null;
    error: string | null;
}

const InstanceDetailsDialog: React.FC<InstanceDetailsDialogProps> = ({ open, onClose, isLoading, details, error }) => {

    const renderResourceList = (title: string, items: Resource[], icon: React.ReactNode) => {
        if (!items || items.length === 0) return null;

        return (
            <>
                <ListSubheader sx={{ bgcolor: 'rgba(255, 255, 255, 0.08)', display: 'flex', alignItems: 'center', gap: 1, my: 1, borderRadius: 1 }}>
                    {icon}
                    {title} ({items.length})
                </ListSubheader>
                {items.map((item, index) => (
                    <ListItem key={item.id || item.name || index} dense divider>
                        <ListItemText
                            primary={item.name || `容器ID: ${item.id}`}
                            secondary={item.ip || '无IP地址'}
                        />
                        {item.is_target && <Chip label="靶机" color="error" size="small" variant="outlined" />}
                    </ListItem>
                ))}
            </>
        );
    };

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
            <DialogTitle>演练实例资源详情</DialogTitle>
            <DialogContent dividers>
                {isLoading && (
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '250px' }}>
                        <CircularProgress />
                        <Typography sx={{ ml: 2 }}>正在加载资源...</Typography>
                    </Box>
                )}
                {error && (
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '250px' }}>
                        <Typography color="error" sx={{ textAlign: 'center', p: 3 }}>
                            加载失败: {error}
                        </Typography>
                    </Box>
                )}
                {!isLoading && !error && details && (
                    <Box>
                        <Typography variant="h6" gutterBottom>{details.scenario_name}</Typography>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                            实例ID: {details.instance_id}
                        </Typography>
                        <Divider sx={{ my: 2 }} />
                        <List sx={{ bgcolor: 'background.paper', maxHeight: 400, overflow: 'auto' }}>
                            {renderResourceList('虚拟机', details.resources.vms, <MemoryIcon fontSize="small" />)}
                            {renderResourceList('容器', details.resources.containers, <WysiwygIcon fontSize="small" />)}
                            {renderResourceList('交换机', details.resources.switches, <HubIcon fontSize="small" />)}
                        </List>
                        {
                            details.resources.vms.length === 0 &&
                            details.resources.containers.length === 0 &&
                            details.resources.switches.length === 0 &&
                            <Typography sx={{ textAlign: 'center', p: 3, minHeight: '150px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} color="text.secondary">
                                该实例下未找到任何已记录的资源。
                            </Typography>
                        }
                    </Box>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>关闭</Button>
            </DialogActions>
        </Dialog>
    );
};

export default InstanceDetailsDialog;