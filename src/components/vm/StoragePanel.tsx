import React, { useState } from 'react';
import {
  Box, Button, Dialog, DialogActions, DialogContent, DialogTitle,
  Grid, IconButton, LinearProgress, Paper, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, TextField, Toolbar, Typography, Stack,
  Select, MenuItem, FormControl, InputLabel, Chip
} from '@mui/material';
import {
  AddCircleOutline as AddIcon,
  DeleteOutline as DeleteIcon,
  EditOutlined as ResizeIcon,
  DiscFullOutlined as DiskIcon,
  IsoOutlined as IsoIcon,
  EjectOutlined as EjectIcon,
  FileUploadOutlined as MountIcon,
  StorageOutlined as StoragePoolIcon,
  SpeedOutlined as IopsIcon,
  ReportProblemOutlined as EmptyIcon
} from '@mui/icons-material';

interface Disk {
  id: string;
  target: string;
  source: string;
  format: 'qcow2' | 'raw';
  bus: 'virtio' | 'sata' | 'scsi' | 'ide';
  capacityGB: number;
  allocatedGB: number;
  iopsRW?: string;
}

interface CdRomDevice {
  id: string;
  target: string;
  sourceIso?: string;
  mounted: boolean;
}

const initialDisks: Disk[] = [
  { id: 'disk1', target: 'vda', source: '/var/lib/libvirt/images/vm1-disk1.qcow2', format: 'qcow2', bus: 'virtio', capacityGB: 50, allocatedGB: 25, iopsRW: '120/60' },
  { id: 'disk2', target: 'vdb', source: 'pool1/vm1-disk2.raw', format: 'raw', bus: 'sata', capacityGB: 100, allocatedGB: 80, iopsRW: '90/40' },
];

const initialCdRoms: CdRomDevice[] = [
  { id: 'cdrom1', target: 'sda', mounted: true, sourceIso: '/isos/ubuntu-22.04.iso' },
  { id: 'cdrom2', target: 'sdb', mounted: false },
];

const mockStoragePools = ['default', 'data_pool', 'ssd_pool'];
const mockBusTypes: Disk['bus'][] = ['virtio', 'sata', 'scsi', 'ide'];
const mockIsoImages = ['/isos/ubuntu-22.04.iso', '/isos/centos-stream-9.iso', '/isos/windows-11.iso', ''];


export default function StoragePanel() {
  const [disks, setDisks] = useState<Disk[]>(initialDisks);
  const [cdRoms, setCdRoms] = useState<CdRomDevice[]>(initialCdRoms);

  const [addDiskOpen, setAddDiskOpen] = useState(false);
  const [newDisk, setNewDisk] = useState<{pool: string; capacity: string; bus: Disk['bus']}>({ pool: mockStoragePools[0], capacity: '20', bus: 'virtio' });

  const [resizeDiskOpen, setResizeDiskOpen] = useState(false);
  const [diskToResize, setDiskToResize] = useState<Disk | null>(null);
  const [newDiskSize, setNewDiskSize] = useState('');

  const [mountIsoOpen, setMountIsoOpen] = useState(false);
  const [cdRomToMount, setCdRomToMount] = useState<CdRomDevice | null>(null);
  const [selectedIso, setSelectedIso] = useState<string>('');

  const handleAddDisk = () => {
    const capacityNum = parseInt(newDisk.capacity, 10);
    if (isNaN(capacityNum) || capacityNum <= 0) {
      alert('Invalid capacity.');
      return;
    }
    const newDiskEntry: Disk = {
      id: `disk${Date.now()}`,
      target: `vd${String.fromCharCode(97 + disks.length)}`,
      source: `${newDisk.pool}/new_disk_${Date.now()}.${newDisk.bus === 'virtio' ? 'qcow2' : 'raw'}`,
      format: newDisk.bus === 'virtio' ? 'qcow2' : 'raw',
      bus: newDisk.bus,
      capacityGB: capacityNum,
      allocatedGB: 0,
      iopsRW: '0/0',
    };
    setDisks(prev => [...prev, newDiskEntry]);
    setAddDiskOpen(false);
    setNewDisk({ pool: mockStoragePools[0], capacity: '20', bus: 'virtio' });
  };

  const handleDeleteDisk = (diskId: string) => {
    setDisks(prev => prev.filter(d => d.id !== diskId));
  };

  const openResizeDialog = (disk: Disk) => {
    setDiskToResize(disk);
    setNewDiskSize(disk.capacityGB.toString());
    setResizeDiskOpen(true);
  };

  const handleResizeDisk = () => {
    if (!diskToResize) return;
    const sizeNum = parseInt(newDiskSize, 10);
    if (isNaN(sizeNum) || sizeNum <= diskToResize.capacityGB) {
      alert('New size must be larger than current capacity.');
      return;
    }
    setDisks(prev => prev.map(d => d.id === diskToResize.id ? { ...d, capacityGB: sizeNum } : d));
    setResizeDiskOpen(false);
    setDiskToResize(null);
  };

  const openMountDialog = (cdRom: CdRomDevice) => {
    setCdRomToMount(cdRom);
    setSelectedIso(cdRom.sourceIso || '');
    setMountIsoOpen(true);
  };

  const handleMountIso = () => {
    if (!cdRomToMount) return;
    setCdRoms(prev => prev.map(cd => cd.id === cdRomToMount.id ? { ...cd, sourceIso: selectedIso, mounted: !!selectedIso } : cd));
    setMountIsoOpen(false);
  };

  const handleEjectIso = (cdRomId: string) => {
     setCdRoms(prev => prev.map(cd => cd.id === cdRomId ? { ...cd, sourceIso: undefined, mounted: false } : cd));
  };

  return (
    <Stack spacing={3}>
      <Paper variant="outlined">
        <Toolbar disableGutters sx={{ px: 1.5, borderBottom: '1px solid #eee' }}>
          <StoragePoolIcon sx={{ mr: 1, color: 'text.secondary' }} />
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>Disk Drives</Typography>
          <Button startIcon={<AddIcon />} onClick={() => setAddDiskOpen(true)} variant="outlined" size="small">Add Disk</Button>
        </Toolbar>
        <TableContainer>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>Target</TableCell><TableCell>Source</TableCell><TableCell>Format</TableCell><TableCell>Bus</TableCell>
                <TableCell>Capacity</TableCell><TableCell>Usage</TableCell><TableCell>R/W IOPS</TableCell><TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {disks.length > 0 ? disks.map(d => (
                <TableRow key={d.id} hover>
                  <TableCell sx={{fontWeight: 'medium'}}>{d.target}</TableCell>
                  <TableCell sx={{maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}} title={d.source}>{d.source}</TableCell>
                  <TableCell><Chip label={d.format} size="small" variant="outlined" /></TableCell>
                  <TableCell><Chip label={d.bus} size="small" /></TableCell>
                  <TableCell>{d.capacityGB} GB</TableCell>
                  <TableCell sx={{ minWidth: 120 }}>
                    <Box display="flex" alignItems="center">
                      <Box width="100%" mr={1}><LinearProgress variant="determinate" value={(d.allocatedGB / d.capacityGB) * 100} sx={{height: 8, borderRadius: 4}}/></Box>
                      <Box minWidth={55}><Typography variant="caption" color="textSecondary">{`${d.allocatedGB}/${d.capacityGB} GB`}</Typography></Box>
                    </Box>
                  </TableCell>
                  <TableCell><Stack direction="row" alignItems="center" spacing={0.5}><IopsIcon fontSize="small" color="action" /> <Typography variant="body2">{d.iopsRW || 'N/A'}</Typography></Stack></TableCell>
                  <TableCell align="right">
                    <IconButton size="small" title="Resize Disk" onClick={() => openResizeDialog(d)}><ResizeIcon fontSize="inherit" /></IconButton>
                    <IconButton size="small" title="Delete Disk" color="error" onClick={() => handleDeleteDisk(d.id)}><DeleteIcon fontSize="inherit" /></IconButton>
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow><TableCell colSpan={8} align="center" sx={{py:3}}><EmptyIcon sx={{fontSize: 30, color: 'grey.400', mb:0.5}}/><Typography color="text.secondary">No disks attached.</Typography></TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Paper variant="outlined">
        <Toolbar disableGutters sx={{ px: 1.5, borderBottom: '1px solid #eee' }}>
          <IsoIcon sx={{ mr: 1, color: 'text.secondary' }} /><Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>CD/DVD Drives</Typography>
        </Toolbar>
        <TableContainer>
          <Table size="small" stickyHeader>
            <TableHead><TableRow><TableCell>Target</TableCell><TableCell>Source ISO</TableCell><TableCell>Status</TableCell><TableCell align="right">Actions</TableCell></TableRow></TableHead>
            <TableBody>
              {cdRoms.length > 0 ? cdRoms.map(cd => (
                <TableRow key={cd.id} hover>
                  <TableCell sx={{fontWeight: 'medium'}}>{cd.target}</TableCell>
                  <TableCell sx={{maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}} title={cd.sourceIso}>{cd.sourceIso || 'Empty'}</TableCell>
                  <TableCell>{cd.mounted ? <Chip label="Mounted" color="success" size="small" variant="outlined" /> : <Chip label="Ejected" size="small" variant="outlined" />}</TableCell>
                  <TableCell align="right">{cd.mounted ? (<Button variant="outlined" size="small" startIcon={<EjectIcon />} onClick={() => handleEjectIso(cd.id)}>Eject</Button>) : (<Button variant="outlined" size="small" startIcon={<MountIcon />} onClick={() => openMountDialog(cd)}>Mount ISO</Button>)}</TableCell>
                </TableRow>
              )) : (
                <TableRow><TableCell colSpan={4} align="center" sx={{py:3}}><EmptyIcon sx={{fontSize: 30, color: 'grey.400', mb:0.5}}/><Typography color="text.secondary">No CD/DVD drives available.</Typography></TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Dialog open={addDiskOpen} onClose={() => setAddDiskOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Add New Disk</DialogTitle>
        <DialogContent><Stack spacing={2.5} sx={{mt:1}}>
            <FormControl fullWidth size="small"><InputLabel>Storage Pool</InputLabel><Select label="Storage Pool" value={newDisk.pool} onChange={(e) => setNewDisk(prev => ({...prev, pool: e.target.value}))}>{mockStoragePools.map(pool => <MenuItem key={pool} value={pool}>{pool}</MenuItem>)}</Select></FormControl>
            <TextField label="Capacity (GB)" type="number" fullWidth size="small" value={newDisk.capacity} onChange={(e) => setNewDisk(prev => ({...prev, capacity: e.target.value}))} InputProps={{ inputProps: { min: 1 } }}/>
            <FormControl fullWidth size="small"><InputLabel>Bus Type</InputLabel><Select label="Bus Type" value={newDisk.bus} onChange={(e) => setNewDisk(prev => ({...prev, bus: e.target.value as Disk['bus']}))}>{mockBusTypes.map(bus => <MenuItem key={bus} value={bus}>{bus}</MenuItem>)}</Select></FormControl>
        </Stack></DialogContent>
        <DialogActions><Button onClick={() => setAddDiskOpen(false)}>Cancel</Button><Button onClick={handleAddDisk} variant="contained">Add Disk</Button></DialogActions>
      </Dialog>

      {diskToResize && (<Dialog open={resizeDiskOpen} onClose={() => setResizeDiskOpen(false)} fullWidth maxWidth="xs">
          <DialogTitle>Resize Disk: {diskToResize.target}</DialogTitle>
          <DialogContent><Stack spacing={2.5} sx={{mt:1}}>
              <Typography variant="body2">Current Capacity: {diskToResize.capacityGB} GB</Typography>
              <TextField label="New Capacity (GB)" type="number" fullWidth size="small" value={newDiskSize} onChange={(e) => setNewDiskSize(e.target.value)} InputProps={{ inputProps: { min: diskToResize.capacityGB + 1 } }}/>
          </Stack></DialogContent>
          <DialogActions><Button onClick={() => setResizeDiskOpen(false)}>Cancel</Button><Button onClick={handleResizeDisk} variant="contained">Resize</Button></DialogActions>
      </Dialog>)}

      {cdRomToMount && (<Dialog open={mountIsoOpen} onClose={() => setMountIsoOpen(false)} fullWidth maxWidth="xs">
          <DialogTitle>Mount ISO to {cdRomToMount.target}</DialogTitle>
          <DialogContent><Stack spacing={2.5} sx={{mt:1}}>
              <FormControl fullWidth size="small"><InputLabel>Select ISO Image</InputLabel><Select label="Select ISO Image" value={selectedIso} onChange={(e) => setSelectedIso(e.target.value)}>
                  <MenuItem value=""><em>(Eject/None)</em></MenuItem>
                  {mockIsoImages.filter(iso => iso).map(isoPath => (<MenuItem key={isoPath} value={isoPath}>{isoPath.split('/').pop()}</MenuItem>))}
              </Select></FormControl>
          </Stack></DialogContent>
          <DialogActions><Button onClick={() => setMountIsoOpen(false)}>Cancel</Button><Button onClick={handleMountIso} variant="contained">Mount</Button></DialogActions>
      </Dialog>)}
    </Stack>
  );
}
