import React, { useState } from 'react';
import {
  Box, Button, Drawer, FormControl, IconButton, InputLabel, MenuItem,
  Select, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Toolbar,
  Typography, Stack, TextField, Chip, Paper
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
  HubOutlined as VlanIcon, // Corrected: Replaced placeholder VlanIcon with HubOutlined
  ReportProblemOutlined as EmptyIcon
} from '@mui/icons-material';

interface VirtualNic {
  id: string;
  mac: string;
  bridge: string;
  model: 'virtio' | 'e1000' | 'rtl8139';
  pciAddress: string;
  rxRateKbps: number;
  txRateKbps: number;
  status: 'active' | 'inactive' | 'unplugged';
  bandwidthLimitMbps?: number;
  vlanTag?: number;
}

const initialNics: VirtualNic[] = [
  { id: 'nic1', mac: '52:54:00:AA:BB:CC', bridge: 'virbr0', model: 'virtio', pciAddress: '0000:01:00.0', rxRateKbps: 1205, txRateKbps: 350, status: 'active', bandwidthLimitMbps: 100, vlanTag: 10 },
  { id: 'nic2', mac: '52:54:00:DD:EE:FF', bridge: 'br-lan', model: 'e1000', pciAddress: '0000:02:00.0', rxRateKbps: 0, txRateKbps: 0, status: 'inactive' },
  { id: 'nic3', mac: '52:54:00:11:22:33', bridge: 'virbr0', model: 'rtl8139', pciAddress: '0000:03:00.0', rxRateKbps: 800, txRateKbps: 120, status: 'active', vlanTag: 20},
];

const mockBridges = ['virbr0', 'br-lan', 'host-only-net'];
const mockNicModels: VirtualNic['model'][] = ['virtio', 'e1000', 'rtl8139'];

export default function NetworkPanel() {
  const [vnics, setVnics] = useState<VirtualNic[]>(initialNics);

  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
  const [editingNic, setEditingNic] = useState<VirtualNic | null>(null);

  const [attachDrawerOpen, setAttachDrawerOpen] = useState(false);
  const [newNic, setNewNic] = useState<Partial<VirtualNic>>({
    bridge: mockBridges[0],
    model: 'virtio',
    status: 'active',
  });

  const handleOpenEditDrawer = (nic: VirtualNic) => {
    setEditingNic(JSON.parse(JSON.stringify(nic)));
    setEditDrawerOpen(true);
  };

  const handleSaveEditNic = () => {
    if (!editingNic) return;
    setVnics(prev => prev.map(n => n.id === editingNic.id ? editingNic : n));
    setEditDrawerOpen(false);
    setEditingNic(null);
  };

  const handleOpenAttachDrawer = () => {
    setNewNic({ bridge: mockBridges[0], model: 'virtio', status: 'active' });
    setAttachDrawerOpen(true);
  };

  const handleAttachNic = () => {
    const macParts = [ '52:54:00', Math.floor(Math.random() * 256).toString(16).padStart(2, '0'), Math.floor(Math.random() * 256).toString(16).padStart(2, '0'), Math.floor(Math.random() * 256).toString(16).padStart(2, '0')];
    const completeNewNic: VirtualNic = {
      id: `nic${Date.now()}`,
      mac: macParts.join(':').toUpperCase(),
      pciAddress: `0000:0${vnics.length+1}:00.0`,
      rxRateKbps: 0, txRateKbps: 0, ...newNic,
      bridge: newNic.bridge || mockBridges[0], model: newNic.model || 'virtio', status: newNic.status || 'active',
    };
    setVnics(prev => [...prev, completeNewNic]);
    setAttachDrawerOpen(false);
  };

  const handleDeleteNic = (nicId: string) => {
    setVnics(prev => prev.filter(n => n.id !== nicId));
  };

  const renderRateChip = (rateKbps: number, type: 'rx' | 'tx') => {
    const Icon = type === 'rx' ? RxIcon : TxIcon;
    let rateValue = rateKbps; let unit = 'Kbps';
    if (rateKbps >= 1000) { rateValue = parseFloat((rateKbps / 1000).toFixed(1)); unit = 'Mbps'; }
    if (rateKbps >= 1000000) { rateValue = parseFloat((rateKbps / 1000000).toFixed(1)); unit = 'Gbps'; }
    return <Chip icon={<Icon />} label={`${rateValue} ${unit}`} variant="outlined" size="small" sx={{minWidth: 90}} />;
  };

  const NicFormFields: React.FC<{nicData: Partial<VirtualNic>, onChange: (field: keyof VirtualNic, value: any) => void}> = ({ nicData, onChange}) => (
     <Stack spacing={2.5} sx={{mt:1, p:2}}>
        <FormControl fullWidth size="small">
          <InputLabel>Network Bridge</InputLabel>
          <Select label="Network Bridge" value={nicData.bridge || ''} onChange={(e) => onChange('bridge', e.target.value)}>
            {mockBridges.map(b => <MenuItem key={b} value={b}>{b}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl fullWidth size="small">
          <InputLabel>Model</InputLabel>
          <Select label="Model" value={nicData.model || ''} onChange={(e) => onChange('model', e.target.value as VirtualNic['model'])}>
            {mockNicModels.map(m => <MenuItem key={m} value={m}>{m}</MenuItem>)}
          </Select>
        </FormControl>
        <TextField label="VLAN Tag (Optional)" type="number" size="small" value={nicData.vlanTag || ''} onChange={(e) => onChange('vlanTag', e.target.value ? parseInt(e.target.value, 10) : undefined)} InputProps={{ inputProps: { min: 1, max: 4094 } }}/>
        <TextField label="Bandwidth Limit (Mbps, Optional)" type="number" size="small" value={nicData.bandwidthLimitMbps || ''} onChange={(e) => onChange('bandwidthLimitMbps', e.target.value ? parseInt(e.target.value, 10) : undefined)} InputProps={{ inputProps: { min: 1 } }}/>
     </Stack>
  );

  return (
    <Paper variant="outlined">
      <Toolbar disableGutters sx={{ px: 1.5, borderBottom: '1px solid #eee' }}>
        <NetworkIcon sx={{ mr: 1, color: 'text.secondary' }} />
        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>Virtual Network Interfaces</Typography>
        <Button startIcon={<AddIcon />} onClick={handleOpenAttachDrawer} variant="outlined" size="small">Attach NIC</Button>
      </Toolbar>
      <TableContainer>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell>Status</TableCell><TableCell><MacIcon fontSize="inherit" sx={{verticalAlign:'middle', mr:0.5}}/>MAC Address</TableCell>
              <TableCell><BridgeIcon fontSize="inherit" sx={{verticalAlign:'middle', mr:0.5}}/>Bridge</TableCell><TableCell><NicModelIcon fontSize="inherit" sx={{verticalAlign:'middle', mr:0.5}}/>Model</TableCell>
              <TableCell><PciIcon fontSize="inherit" sx={{verticalAlign:'middle', mr:0.5}}/>PCI Address</TableCell><TableCell><VlanIcon fontSize="inherit" sx={{verticalAlign:'middle', mr:0.5}}/>VLAN</TableCell>
              <TableCell><SpeedIcon fontSize="inherit" sx={{verticalAlign:'middle', mr:0.5}}/>Bandwidth</TableCell><TableCell align="center">RX Rate</TableCell>
              <TableCell align="center">TX Rate</TableCell><TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {vnics.length > 0 ? vnics.map(nic => (
              <TableRow key={nic.id} hover>
                <TableCell><Chip icon={nic.status === 'active' ? <StatusActiveIcon/> : <StatusInactiveIcon/>} label={nic.status.charAt(0).toUpperCase() + nic.status.slice(1)} color={nic.status === 'active' ? 'success' : 'default'} size="small" variant="outlined"/></TableCell>
                <TableCell sx={{fontFamily: 'monospace'}}>{nic.mac}</TableCell><TableCell>{nic.bridge}</TableCell>
                <TableCell><Chip label={nic.model} size="small"/></TableCell><TableCell sx={{fontFamily: 'monospace'}}>{nic.pciAddress}</TableCell>
                <TableCell>{nic.vlanTag || 'N/A'}</TableCell><TableCell>{nic.bandwidthLimitMbps ? `${nic.bandwidthLimitMbps} Mbps` : 'Unlimited'}</TableCell>
                <TableCell align="center">{renderRateChip(nic.rxRateKbps, 'rx')}</TableCell><TableCell align="center">{renderRateChip(nic.txRateKbps, 'tx')}</TableCell>
                <TableCell align="right">
                  <IconButton size="small" title="Edit NIC" onClick={() => handleOpenEditDrawer(nic)}><EditIcon fontSize="inherit" /></IconButton>
                  <IconButton size="small" title="Delete NIC" color="error" onClick={() => handleDeleteNic(nic.id)}><DeleteIcon fontSize="inherit" /></IconButton>
                </TableCell>
              </TableRow>
            )) : (
              <TableRow><TableCell colSpan={10} align="center" sx={{py:3}}><EmptyIcon sx={{fontSize: 30, color: 'grey.400', mb:0.5}}/><Typography color="text.secondary">No virtual network interfaces configured.</Typography></TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Drawer anchor="right" open={editDrawerOpen} onClose={() => setEditDrawerOpen(false)} PaperProps={{sx: {width: 360, display: 'flex', flexDirection: 'column'}}}>
        <Box sx={{p: 2, borderBottom: '1px solid #eee'}}><Typography variant="h6" gutterBottom sx={{mb:0}}>Edit vNIC: {editingNic?.mac}</Typography></Box>
        <Box sx={{flexGrow:1, overflowY: 'auto'}}>
          {editingNic && (<NicFormFields nicData={editingNic} onChange={(field, value) => setEditingNic(prev => prev ? {...prev, [field]: value} : null)}/>)}
        </Box>
        <Box sx={{p:2, borderTop: '1px solid #eee', display: 'flex', justifyContent: 'flex-end'}}>
            <Button onClick={() => setEditDrawerOpen(false)} sx={{mr:1}}>Cancel</Button><Button onClick={handleSaveEditNic} variant="contained">Save Changes</Button>
        </Box>
      </Drawer>

      <Drawer anchor="right" open={attachDrawerOpen} onClose={() => setAttachDrawerOpen(false)} PaperProps={{sx: {width: 360, display: 'flex', flexDirection: 'column'}}}>
        <Box sx={{p: 2, borderBottom: '1px solid #eee'}}><Typography variant="h6" gutterBottom sx={{mb:0}}>Attach New vNIC</Typography></Box>
        <Box sx={{flexGrow:1, overflowY: 'auto'}}>
            <NicFormFields nicData={newNic} onChange={(field, value) => setNewNic(prev => ({...prev, [field]: value}))}/>
        </Box>
        <Box sx={{p:2, borderTop: '1px solid #eee', display: 'flex', justifyContent: 'flex-end'}}>
            <Button onClick={() => setAttachDrawerOpen(false)} sx={{mr:1}}>Cancel</Button><Button onClick={handleAttachNic} variant="contained">Attach NIC</Button>
        </Box>
      </Drawer>
    </Paper>
  );
}
