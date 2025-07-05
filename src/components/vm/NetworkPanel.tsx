import React, { useState, useEffect, useCallback } from 'react';
import {
  Alert, Box, Button, CircularProgress, Drawer, FormControl, IconButton, InputLabel, LinearProgress, MenuItem,
  Select, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Toolbar,
  Typography, Stack, TextField, Chip, Paper, Skeleton
} from '@mui/material';
import {
  AddCircleOutline as AddIcon,
  DeleteOutline as DeleteIcon,
  EditOutlined as EditIcon,
  NetworkWifiOutlined as NetworkIcon,
  SpeedOutlined as SpeedIcon,
  ArrowUpwardOutlined as TxIcon,
  ArrowDownwardOutlined as RxIcon,
  SettingsEthernetOutlined as NicModelIcon,
  VpnKeyOutlined as MacIcon,
  LinkOutlined as BridgeIcon,
  DeveloperBoardOutlined as PciIcon,
  PowerSettingsNewOutlined as StatusActiveIcon,
  PowerOffOutlined as StatusInactiveIcon,
  HubOutlined as VlanIcon,
  ReportProblemOutlined as EmptyIcon
} from '@mui/icons-material';


interface NetworkPanelProps {
  vmId: string;
}

type NicModelType = 'virtio' | 'e1000' | 'rtl8139'; // Keep in sync with backend/frontend
type NicStatusType = 'active' | 'inactive' | 'unplugged';

interface VirtualNic {
  id: string; // Backend uses nic_{mac_no_colons}
  mac: string;
  bridge: string;
  model: NicModelType;
  pciAddress?: string; // Optional in backend response
  rx_rate_kbps: number; // rxRateKbps in old frontend, rx_rate_kbps in backend
  tx_rate_kbps: number; // txRateKbps in old frontend, tx_rate_kbps in backend
  status: NicStatusType;
  bandwidth_limit_mbps?: number; // bandwidthLimitMbps in old frontend
  vlan_tag?: number; // vlanTag in old frontend
}

// For form states, all fields are initially optional or have defaults
interface NicFormData {
  bridge?: string;
  model?: NicModelType;
  bandwidth_limit_mbps?: number;
  vlan_tag?: number;
}


const mockBridges = ['virbr0', 'br-lan', 'host-only-net']; // Could be fetched from API
const mockNicModels: NicModelType[] = ['virtio', 'e1000', 'rtl8139'];

export default function NetworkPanel({ vmId }: NetworkPanelProps) {
  const [vnics, setVnics] = useState<VirtualNic[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionInProgress, setActionInProgress] = useState(false);

  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
  const [editingNic, setEditingNic] = useState<VirtualNic | null>(null);
  const [editingNicData, setEditingNicData] = useState<NicFormData>({});


  const [attachDrawerOpen, setAttachDrawerOpen] = useState(false);
  const [newNicData, setNewNicData] = useState<NicFormData>({
    bridge: mockBridges[0],
    model: 'virtio',
  });

  const fetchVnics = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/vms/${vmId}/network/vnics`);
      if (!response.ok) throw new Error(`Failed to fetch vNICs: ${response.status}`);
      const data: VirtualNic[] = await response.json();
      setVnics(data);
    } catch (err: any) { setError(err.message); setVnics([]); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => {
    fetchVnics();
    const intervalId = setInterval(fetchVnics, 5000); // Refresh rates periodically
    return () => clearInterval(intervalId);
  }, [fetchVnics]);


  const handleApiCall = async (url: string, method: string, body?: any, successCallback?: () => void) => {
    setActionInProgress(true);
    setError(null);
    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!response.ok && response.status !== 204) {
        const errData = await response.json().catch(() => ({ detail: `Operation failed: ${response.status}` }));
        throw new Error(errData.detail || `HTTP error ${response.status}`);
      }
      if (successCallback) successCallback();
      await fetchVnics(); // Refetch vNICs list
    } catch (err: any) { setError(err.message); }
    finally { setActionInProgress(false); }
  };


  const handleOpenEditDrawer = (nic: VirtualNic) => {
    setEditingNic(nic);
    setEditingNicData({
        bridge: nic.bridge,
        model: nic.model,
        bandwidth_limit_mbps: nic.bandwidth_limit_mbps,
        vlan_tag: nic.vlan_tag
    });
    setEditDrawerOpen(true);
  };

  const handleSaveEditNic = () => {
    if (!editingNic) return;
    // Ensure required fields are present if backend expects them (mock backend is flexible)
    const payload = {
        bridge: editingNicData.bridge || editingNic.bridge, // Fallback to original if somehow empty
        model: editingNicData.model || editingNic.model, // Fallback
        bandwidth_limit_mbps: editingNicData.bandwidth_limit_mbps,
        vlan_tag: editingNicData.vlan_tag,
    };
    handleApiCall(`${API_BASE_URL}/vms/${vmId}/network/vnics/${editingNic.id}`, 'PUT', payload, () => {
      setEditDrawerOpen(false);
      setEditingNic(null);
    });
  };

  const handleOpenAttachDrawer = () => {
    setNewNicData({ bridge: mockBridges[0], model: 'virtio', vlan_tag: undefined, bandwidth_limit_mbps: undefined });
    setAttachDrawerOpen(true);
  };

  const handleAttachNic = () => {
    if (!newNicData.bridge || !newNicData.model) {
        setError("Bridge and Model are required for a new NIC.");
        return;
    }
    handleApiCall(`${API_BASE_URL}/vms/${vmId}/network/vnics`, 'POST', newNicData, () => {
      setAttachDrawerOpen(false);
    });
  };

  const handleDeleteNic = (nicId: string, nicMac?: string) => {
    if (!window.confirm(`Are you sure you want to delete vNIC ${nicMac || nicId}?`)) return;
    handleApiCall(`${API_BASE_URL}/vms/${vmId}/network/vnics/${nicId}`, 'DELETE');
  };

  const renderRateChip = (rateKbps: number, type: 'rx' | 'tx') => {
    const Icon = type === 'rx' ? RxIcon : TxIcon;
    let rateValue = rateKbps; let unit = 'Kbps';
    if (rateKbps >= 1000000) { rateValue = parseFloat((rateKbps / 1000000).toFixed(1)); unit = 'Gbps'; }
    else if (rateKbps >= 1000) { rateValue = parseFloat((rateKbps / 1000).toFixed(1)); unit = 'Mbps'; }

    return <Chip icon={<Icon />} label={`${rateValue} ${unit}`} variant="outlined" size="small" sx={{minWidth: 90}} />;
  };

  const NicFormFields: React.FC<{
    nicData: NicFormData;
    onChange: (field: keyof NicFormData, value: any) => void;
    disabled?: boolean;
  }> = ({ nicData, onChange, disabled}) => (
     <Stack spacing={2.5} sx={{mt:1, p:2}}>
        <FormControl fullWidth size="small">
          <InputLabel>Network Bridge</InputLabel>
          <Select label="Network Bridge" value={nicData.bridge || ''} onChange={(e) => onChange('bridge', e.target.value)} disabled={disabled}>
            {mockBridges.map(b => <MenuItem key={b} value={b}>{b}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl fullWidth size="small">
          <InputLabel>Model</InputLabel>
          <Select label="Model" value={nicData.model || ''} onChange={(e) => onChange('model', e.target.value as NicModelType)} disabled={disabled}>
            {mockNicModels.map(m => <MenuItem key={m} value={m}>{m}</MenuItem>)}
          </Select>
        </FormControl>
        <TextField label="VLAN Tag (Optional)" type="number" size="small" value={nicData.vlan_tag || ''}
                   onChange={(e) => onChange('vlan_tag', e.target.value ? parseInt(e.target.value, 10) : undefined)}
                   InputProps={{ inputProps: { min: 1, max: 4094 } }} disabled={disabled}/>
        <TextField label="Bandwidth Limit (Mbps, Optional)" type="number" size="small" value={nicData.bandwidth_limit_mbps || ''}
                   onChange={(e) => onChange('bandwidth_limit_mbps', e.target.value ? parseInt(e.target.value, 10) : undefined)}
                   InputProps={{ inputProps: { min: 1 } }} disabled={disabled}/>
     </Stack>
  );

  const renderTableRows = () => {
    if (isLoading) {
        return Array.from(new Array(2)).map((_, index) => (
            <TableRow key={`skel-nic-${index}`}>
                <TableCell colSpan={10}><Skeleton animation="wave" /></TableCell>
            </TableRow>
        ));
    }
    if (vnics.length === 0) {
        return <TableRow><TableCell colSpan={10} align="center" sx={{py:3}}><EmptyIcon sx={{fontSize: 30, color: 'grey.400', mb:0.5}}/><Typography color="text.secondary">No virtual network interfaces configured.</Typography></TableCell></TableRow>;
    }
    return vnics.map(nic => (
        <TableRow key={nic.id} hover>
          <TableCell><Chip icon={nic.status === 'active' ? <StatusActiveIcon/> : <StatusInactiveIcon/>} label={nic.status.charAt(0).toUpperCase() + nic.status.slice(1)} color={nic.status === 'active' ? 'success' : 'default'} size="small" variant="outlined"/></TableCell>
          <TableCell sx={{fontFamily: 'monospace'}}>{nic.mac}</TableCell><TableCell>{nic.bridge}</TableCell>
          <TableCell><Chip label={nic.model} size="small"/></TableCell><TableCell sx={{fontFamily: 'monospace'}}>{nic.pciAddress || 'N/A'}</TableCell>
          <TableCell>{nic.vlan_tag || 'N/A'}</TableCell><TableCell>{nic.bandwidth_limit_mbps ? `${nic.bandwidth_limit_mbps} Mbps` : 'Unlimited'}</TableCell>
          <TableCell align="center">{renderRateChip(nic.rx_rate_kbps, 'rx')}</TableCell><TableCell align="center">{renderRateChip(nic.tx_rate_kbps, 'tx')}</TableCell>
          <TableCell align="right">
            <IconButton size="small" title="编辑网卡" onClick={() => handleOpenEditDrawer(nic)} disabled={actionInProgress}><EditIcon fontSize="inherit" /></IconButton>
            <IconButton size="small" title="删除网卡" color="error" onClick={() => handleDeleteNic(nic.id, nic.mac)} disabled={actionInProgress}><DeleteIcon fontSize="inherit" /></IconButton>
          </TableCell>
        </TableRow>
      ));
  }

  return (
    <Paper variant="outlined">
      {actionInProgress && <LinearProgress sx={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10}} />}
      {error && <Alert severity="error" onClose={() => setError(null)} sx={{m:1}}>{error}</Alert>}

      <Toolbar disableGutters sx={{ px: 1.5, borderBottom: '1px solid #eee' }}>
        <NetworkIcon sx={{ mr: 1, color: 'text.secondary' }} />
        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>虚拟网络接口</Typography>
        <Button startIcon={<AddIcon />} onClick={handleOpenAttachDrawer} variant="outlined" size="small" disabled={actionInProgress}>添加网卡</Button>
      </Toolbar>
      <TableContainer>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell>状态</TableCell><TableCell><MacIcon fontSize="inherit" sx={{verticalAlign:'middle', mr:0.5}}/>MAC地址</TableCell>
              <TableCell><BridgeIcon fontSize="inherit" sx={{verticalAlign:'middle', mr:0.5}}/>桥接</TableCell><TableCell><NicModelIcon fontSize="inherit" sx={{verticalAlign:'middle', mr:0.5}}/>型号</TableCell>
              <TableCell><PciIcon fontSize="inherit" sx={{verticalAlign:'middle', mr:0.5}}/>PCI 地址</TableCell><TableCell><VlanIcon fontSize="inherit" sx={{verticalAlign:'middle', mr:0.5}}/>VLAN</TableCell>
              <TableCell><SpeedIcon fontSize="inherit" sx={{verticalAlign:'middle', mr:0.5}}/>带宽</TableCell><TableCell align="center">接收速率</TableCell>
              <TableCell align="center">发送速率</TableCell><TableCell align="right">操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {renderTableRows()}
          </TableBody>
        </Table>
      </TableContainer>

      <Drawer anchor="right" open={editDrawerOpen} onClose={() => setEditDrawerOpen(false)} PaperProps={{sx: {width: 360, display: 'flex', flexDirection: 'column'}}}>
        <Box sx={{p: 2, borderBottom: '1px solid #eee'}}><Typography variant="h6" gutterBottom sx={{mb:0}}>编辑网卡: {editingNic?.mac}</Typography></Box>
        <Box sx={{flexGrow:1, overflowY: 'auto'}}>
          {editingNic && (<NicFormFields nicData={editingNicData} onChange={(field, value) => setEditingNicData(prev => ({...prev, [field]: value}))} disabled={actionInProgress}/>)}
        </Box>
        <Box sx={{p:2, borderTop: '1px solid #eee', display: 'flex', justifyContent: 'flex-end'}}>
            <Button onClick={() => setEditDrawerOpen(false)} sx={{mr:1}} disabled={actionInProgress}>取消</Button>
            <Button onClick={handleSaveEditNic} variant="contained" disabled={actionInProgress}>
                {actionInProgress ? <CircularProgress size={20}/> : "保存"}
            </Button>
        </Box>
      </Drawer>

      <Drawer anchor="right" open={attachDrawerOpen} onClose={() => setAttachDrawerOpen(false)} PaperProps={{sx: {width: 360, display: 'flex', flexDirection: 'column'}}}>
        <Box sx={{p: 2, borderBottom: '1px solid #eee'}}><Typography variant="h6" gutterBottom sx={{mb:0}}>添加新网卡</Typography></Box>
        <Box sx={{flexGrow:1, overflowY: 'auto'}}>
            <NicFormFields nicData={newNicData} onChange={(field, value) => setNewNicData(prev => ({...prev, [field]: value}))} disabled={actionInProgress}/>
        </Box>
        <Box sx={{p:2, borderTop: '1px solid #eee', display: 'flex', justifyContent: 'flex-end'}}>
            <Button onClick={() => setAttachDrawerOpen(false)} sx={{mr:1}} disabled={actionInProgress}>取消</Button>
            <Button onClick={handleAttachNic} variant="contained" disabled={actionInProgress || !newNicData.bridge || !newNicData.model}>
                 {actionInProgress ? <CircularProgress size={20}/> : "添加"}
            </Button>
        </Box>
      </Drawer>
    </Paper>
  );
}
