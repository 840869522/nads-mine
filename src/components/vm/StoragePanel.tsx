import React, { useState, useEffect, useCallback } from 'react';
import {
  Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  IconButton, LinearProgress, Paper, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, TextField, Toolbar, Typography, Stack,
  Select, MenuItem, FormControl, InputLabel, Chip, Skeleton
} from '@mui/material';
import {
  AddCircleOutline as AddIcon,
  DeleteOutline as DeleteIcon,
  EditOutlined as ResizeIcon,
  // DiscFullOutlined as DiskIcon, // Not used directly in toolbar
  IsoOutlined as IsoIcon,
  EjectOutlined as EjectIcon,
  FileUploadOutlined as MountIcon,
  StorageOutlined as StoragePoolIcon,
  SpeedOutlined as IopsIcon,
  ReportProblemOutlined as EmptyIcon
} from '@mui/icons-material';


interface StoragePanelProps {
  vmId: string;
}

interface Disk {
  id: string;
  target: string;
  source: string;
  format: 'qcow2' | 'raw';
  bus: 'virtio' | 'sata' | 'scsi' | 'ide';
  capacity_gb: number;
  allocated_gb: number;
  iops_rw?: string;
}

interface CdRomDevice {
  id: string;
  target: string;
  source_iso?: string; // Corrected from sourceIso
  mounted: boolean;
}

// Mock data for dropdowns - in a real app, these might also come from an API
const mockStoragePools = ['default', 'data_pool', 'ssd_pool'];
const mockBusTypes: Disk['bus'][] = ['virtio', 'sata', 'scsi', 'ide'];
// Example ISO paths, assuming backend can list these or they are known
const mockIsoImages = ['/isos/ubuntu-22.04.iso', '/isos/centos-stream-9.iso', '/isos/windows-11.iso'];


export default function StoragePanel({ vmId }: StoragePanelProps) {
  const [disks, setDisks] = useState<Disk[]>([]);
  const [cdRoms, setCdRoms] = useState<CdRomDevice[]>([]);

  const [isLoadingDisks, setIsLoadingDisks] = useState(true);
  const [isLoadingCdRoms, setIsLoadingCdRoms] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionInProgress, setActionInProgress] = useState(false);

  const [addDiskOpen, setAddDiskOpen] = useState(false);
  const [newDisk, setNewDisk] = useState<{pool_name: string; capacity_gb: string; bus: Disk['bus']; format: 'qcow2' | 'raw'}>({ pool_name: mockStoragePools[0], capacity_gb: '20', bus: 'virtio', format: 'qcow2' });

  const [resizeDiskOpen, setResizeDiskOpen] = useState(false);
  const [diskToResize, setDiskToResize] = useState<Disk | null>(null);
  const [newDiskSize, setNewDiskSize] = useState('');

  const [mountIsoOpen, setMountIsoOpen] = useState(false);
  const [cdRomToMount, setCdRomToMount] = useState<CdRomDevice | null>(null);
  const [selectedIsoPath, setSelectedIsoPath] = useState<string>('');

  const fetchDisks = useCallback(async () => {
    setIsLoadingDisks(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/vm/${vmId}/storage/disks`);
      if (!response.ok) throw new Error(`Failed to fetch disks: ${response.status}`);
      const data: Disk[] = await response.json();
      setDisks(data);
    } catch (err: any) { setError(err.message); setDisks([]); }
    finally { setIsLoadingDisks(false); }
  }, []);

  const fetchCdRoms = useCallback(async () => {
    setIsLoadingCdRoms(true);
    setError(null);
    try {
      const response = await fetch(`/api/vm/${vmId}/storage/cdroms`);
      if (!response.ok) throw new Error(`Failed to fetch CD-ROMs: ${response.status}`);
      const data: CdRomDevice[] = await response.json();
      setCdRoms(data);
    } catch (err: any) { setError(err.message); setCdRoms([]); }
    finally { setIsLoadingCdRoms(false); }
  }, []);

  useEffect(() => {
    fetchDisks();
    fetchCdRoms();
  }, [fetchDisks, fetchCdRoms]);

  const handleApiCall = async (url: string, method: string, body?: any, successCallback?: () => void) => {
    setActionInProgress(true);
    setError(null);
    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!response.ok && response.status !== 204) { // 204 No Content is OK for DELETE
        const errData = await response.json().catch(() => ({ detail: `Operation failed: ${response.status}` }));
        throw new Error(errData.detail || `HTTP error ${response.status}`);
      }
      if (successCallback) successCallback();
      // Refetch relevant data
      if (url.includes('/disks')) await fetchDisks();
      if (url.includes('/cdroms')) await fetchCdRoms();
    } catch (err: any) {
      setError(err.message || 'An API error occurred.');
    } finally {
      setActionInProgress(false);
    }
  };

  const handleAddDisk = () => {
    const capacityNum = parseInt(newDisk.capacity_gb, 10);
    if (isNaN(capacityNum) || capacityNum <= 0) {
      setError('Invalid capacity for new disk.');
      return;
    }
    handleApiCall(`${API_BASE_URL}/vm/${vmId}/storage/disks`, 'POST', { ...newDisk, capacity_gb: capacityNum }, () => {
      setAddDiskOpen(false);
      setNewDisk({ pool_name: mockStoragePools[0], capacity_gb: '20', bus: 'virtio', format: 'qcow2' });
    });
  };

  const handleDeleteDisk = (diskId: string) => {
    if (!window.confirm(`Are you sure you want to delete disk ${disks.find(d=>d.id === diskId)?.target || diskId}?`)) return;
    handleApiCall(`${API_BASE_URL}/vm/${vmId}/storage/disks/${diskId}`, 'DELETE');
  };

  const openResizeDialog = (disk: Disk) => {
    setDiskToResize(disk);
    setNewDiskSize(disk.capacity_gb.toString());
    setResizeDiskOpen(true);
  };

  const handleResizeDisk = () => {
    if (!diskToResize) return;
    const sizeNum = parseInt(newDiskSize, 10);
    if (isNaN(sizeNum) || sizeNum <= diskToResize.capacity_gb) {
      setError('New size must be larger than current capacity.');
      return;
    }
    handleApiCall(`${API_BASE_URL}/vm/${vmId}/storage/disks/${diskToResize.id}/resize`, 'POST', { new_capacity_gb: sizeNum }, () => {
      setResizeDiskOpen(false);
      setDiskToResize(null);
    });
  };

  const openMountDialog = (cdRom: CdRomDevice) => {
    setCdRomToMount(cdRom);
    setSelectedIsoPath(cdRom.source_iso || '');
    setMountIsoOpen(true);
  };

  const handleMountIso = () => {
    if (!cdRomToMount) return;
    handleApiCall(`${API_BASE_URL}/vm/${vmId}/storage/cdroms/${cdRomToMount.id}/mount`, 'POST', { iso_path: selectedIsoPath }, () => {
      setMountIsoOpen(false);
    });
  };

  const handleEjectIso = (cdRomId: string) => {
    handleApiCall(`${API_BASE_URL}/vm/${vmId}/storage/cdroms/${cdRomId}/eject`, 'POST');
  };

  const renderDiskRows = () => {
    if (isLoadingDisks) {
        return Array.from(new Array(2)).map((_, index) => (
            <TableRow key={`skel-disk-${index}`}>
                <TableCell colSpan={8}><Skeleton animation="wave" /></TableCell>
            </TableRow>
        ));
    }
    if (disks.length === 0) {
        return <TableRow><TableCell colSpan={8} align="center" sx={{py:3}}><EmptyIcon sx={{fontSize: 30, color: 'grey.400', mb:0.5}}/><Typography color="text.secondary">No disks attached.</Typography></TableCell></TableRow>;
    }
    return disks.map(d => (
        <TableRow key={d.id} hover>
          <TableCell sx={{fontWeight: 'medium'}}>{d.target}</TableCell>
          <TableCell sx={{maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}} title={d.source}>{d.source}</TableCell>
          <TableCell><Chip label={d.format} size="small" variant="outlined" /></TableCell>
          <TableCell><Chip label={d.bus} size="small" /></TableCell>
          <TableCell>{d.capacity_gb} GB</TableCell>
          <TableCell sx={{ minWidth: 120 }}>
            <Box display="flex" alignItems="center">
              <Box width="100%" mr={1}><LinearProgress variant="determinate" value={(d.allocated_gb / d.capacity_gb) * 100} sx={{height: 8, borderRadius: 4}}/></Box>
              <Box minWidth={55}><Typography variant="caption" color="textSecondary">{`${d.allocated_gb}/${d.capacity_gb} GB`}</Typography></Box>
            </Box>
          </TableCell>
          <TableCell><Stack direction="row" alignItems="center" spacing={0.5}><IopsIcon fontSize="small" color="action" /> <Typography variant="body2">{d.iops_rw || 'N/A'}</Typography></Stack></TableCell>
          <TableCell align="right">
            <IconButton size="small" title="Resize Disk" onClick={() => openResizeDialog(d)} disabled={actionInProgress}><ResizeIcon fontSize="inherit" /></IconButton>
            <IconButton size="small" title="Delete Disk" color="error" onClick={() => handleDeleteDisk(d.id)} disabled={actionInProgress}><DeleteIcon fontSize="inherit" /></IconButton>
          </TableCell>
        </TableRow>
      ));
  };

  const renderCdRomRows = () => {
    if (isLoadingCdRoms) {
        return Array.from(new Array(1)).map((_, index) => (
            <TableRow key={`skel-cd-${index}`}>
                <TableCell colSpan={4}><Skeleton animation="wave" /></TableCell>
            </TableRow>
        ));
    }
    if (cdRoms.length === 0) {
        return <TableRow><TableCell colSpan={4} align="center" sx={{py:3}}><EmptyIcon sx={{fontSize: 30, color: 'grey.400', mb:0.5}}/><Typography color="text.secondary">No CD/DVD drives available.</Typography></TableCell></TableRow>;
    }
    return cdRoms.map(cd => (
        <TableRow key={cd.id} hover>
          <TableCell sx={{fontWeight: 'medium'}}>{cd.target}</TableCell>
          <TableCell sx={{maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}} title={cd.source_iso}>{cd.source_iso || 'Empty'}</TableCell>
          <TableCell>{cd.mounted ? <Chip label="Mounted" color="success" size="small" variant="outlined" /> : <Chip label="Ejected" size="small" variant="outlined" />}</TableCell>
          <TableCell align="right">
            {cd.mounted ?
                (<Button variant="outlined" size="small" startIcon={<EjectIcon />} onClick={() => handleEjectIso(cd.id)} disabled={actionInProgress}>Eject</Button>) :
                (<Button variant="outlined" size="small" startIcon={<MountIcon />} onClick={() => openMountDialog(cd)} disabled={actionInProgress}>Mount ISO</Button>)}
          </TableCell>
        </TableRow>
      ));
  };


  return (
    <Stack spacing={3}>
      {error && <Alert severity="error" onClose={() => setError(null)} sx={{my:1}}>{error}</Alert>}
      {actionInProgress && <LinearProgress sx={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10}} />}

      <Paper variant="outlined">
        <Toolbar disableGutters sx={{ px: 1.5, borderBottom: '1px solid #eee' }}>
          <StoragePoolIcon sx={{ mr: 1, color: 'text.secondary' }} />
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>Disk Drives</Typography>
          <Button startIcon={<AddIcon />} onClick={() => setAddDiskOpen(true)} variant="outlined" size="small" disabled={actionInProgress}>Add Disk</Button>
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
              {renderDiskRows()}
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
                {renderCdRomRows()}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Dialog open={addDiskOpen} onClose={() => setAddDiskOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Add New Disk</DialogTitle>
        <DialogContent><Stack spacing={2.5} sx={{mt:1}}>
            <FormControl fullWidth size="small">
                <InputLabel>Storage Pool</InputLabel>
                <Select label="Storage Pool" value={newDisk.pool_name} onChange={(e) => setNewDisk(prev => ({...prev, pool_name: e.target.value}))} disabled={actionInProgress}>
                    {mockStoragePools.map(pool => <MenuItem key={pool} value={pool}>{pool}</MenuItem>)}
                </Select>
            </FormControl>
            <TextField label="Capacity (GB)" type="number" fullWidth size="small" value={newDisk.capacity_gb} onChange={(e) => setNewDisk(prev => ({...prev, capacity_gb: e.target.value}))} InputProps={{ inputProps: { min: 1 } }} disabled={actionInProgress}/>
            <FormControl fullWidth size="small">
                <InputLabel>Format</InputLabel>
                <Select label="Format" value={newDisk.format} onChange={(e) => setNewDisk(prev => ({...prev, format: e.target.value as 'qcow2' | 'raw'}))} disabled={actionInProgress}>
                    <MenuItem value="qcow2">qcow2</MenuItem>
                    <MenuItem value="raw">raw</MenuItem>
                </Select>
            </FormControl>
            <FormControl fullWidth size="small">
                <InputLabel>Bus Type</InputLabel>
                <Select label="Bus Type" value={newDisk.bus} onChange={(e) => setNewDisk(prev => ({...prev, bus: e.target.value as Disk['bus']}))} disabled={actionInProgress}>
                    {mockBusTypes.map(bus => <MenuItem key={bus} value={bus}>{bus}</MenuItem>)}
                </Select>
            </FormControl>
        </Stack></DialogContent>
        <DialogActions>
            <Button onClick={() => setAddDiskOpen(false)} disabled={actionInProgress}>Cancel</Button>
            <Button onClick={handleAddDisk} variant="contained" disabled={actionInProgress || !newDisk.capacity_gb.trim() || parseInt(newDisk.capacity_gb) <=0}>
                 {actionInProgress ? <CircularProgress size={20}/> : "Add Disk"}
            </Button>
        </DialogActions>
      </Dialog>

      {diskToResize && (<Dialog open={resizeDiskOpen} onClose={() => setResizeDiskOpen(false)} fullWidth maxWidth="xs">
          <DialogTitle>Resize Disk: {diskToResize.target}</DialogTitle>
          <DialogContent><Stack spacing={2.5} sx={{mt:1}}>
              <Typography variant="body2">Current Capacity: {diskToResize.capacity_gb} GB</Typography>
              <TextField label="New Capacity (GB)" type="number" fullWidth size="small" value={newDiskSize} onChange={(e) => setNewDiskSize(e.target.value)} InputProps={{ inputProps: { min: diskToResize.capacity_gb + 1 } }} disabled={actionInProgress}/>
          </Stack></DialogContent>
          <DialogActions>
            <Button onClick={() => setResizeDiskOpen(false)} disabled={actionInProgress}>Cancel</Button>
            <Button onClick={handleResizeDisk} variant="contained" disabled={actionInProgress || !newDiskSize.trim() || parseInt(newDiskSize) <= diskToResize.capacity_gb}>
                 {actionInProgress ? <CircularProgress size={20}/> : "Resize"}
            </Button>
          </DialogActions>
      </Dialog>)}

      {cdRomToMount && (<Dialog open={mountIsoOpen} onClose={() => setMountIsoOpen(false)} fullWidth maxWidth="xs">
          <DialogTitle>Mount ISO to {cdRomToMount.target}</DialogTitle>
          <DialogContent><Stack spacing={2.5} sx={{mt:1}}>
              <FormControl fullWidth size="small">
                  <InputLabel>Select ISO Image</InputLabel>
                  <Select label="Select ISO Image" value={selectedIsoPath} onChange={(e) => setSelectedIsoPath(e.target.value)} disabled={actionInProgress}>
                      <MenuItem value=""><em>(Eject/None)</em></MenuItem>
                      {mockIsoImages.map(isoPath => (<MenuItem key={isoPath} value={isoPath}>{isoPath.split('/').pop() || isoPath}</MenuItem>))}
                  </Select>
              </FormControl>
          </Stack></DialogContent>
          <DialogActions>
            <Button onClick={() => setMountIsoOpen(false)} disabled={actionInProgress}>Cancel</Button>
            <Button onClick={handleMountIso} variant="contained" disabled={actionInProgress}>
                 {actionInProgress ? <CircularProgress size={20}/> : "Mount"}
            </Button>
          </DialogActions>
      </Dialog>)}
    </Stack>
  );
}
