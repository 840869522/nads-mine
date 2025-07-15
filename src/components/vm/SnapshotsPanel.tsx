import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Alert, Box, Button, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, Grid, Stack, TextField,
  Toolbar, Typography, Paper, Skeleton
} from '@mui/material';
import {
  Add as AddIcon,
  DeleteOutline as DeleteIcon,
  Restore as RestoreIcon,
  AccountTreeOutlined as TreeIcon,
  DescriptionOutlined as DescriptionIcon,
  CalendarTodayOutlined as CalendarIcon,
  SaveAltOutlined as SizeIcon,
  CodeOutlined as XmlIcon,
  ExpandMore as ExpandMoreIcon,
  ChevronRight as ChevronRightIcon,
  ReportProblemOutlined as EmptyIcon
} from '@mui/icons-material';
import { SimpleTreeView, TreeItem, TreeViewBasePayload } from '@mui/x-tree-view'; // Added TreeViewBasePayload

interface SnapshotsPanelProps {
  vmId: string;
}

interface Snapshot {
  id: string;
  name: string;
  description?: string;
  created: string; // Should be ISO string from backend
  parentId?: string | null;
  size_mb: number; // Changed from string to number
  xml?: string;
}

export default function SnapshotsPanel({ vmId }: SnapshotsPanelProps) {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newSnapshotName, setNewSnapshotName] = useState('');
  const [newSnapshotDescription, setNewSnapshotDescription] = useState('');

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionInProgress, setActionInProgress] = useState(false);


  const fetchSnapshots = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/back/api/vms/${vmId}/snapshots`);
      if (!response.ok) {
        throw new Error(`Failed to fetch snapshots: ${response.status} ${response.statusText}`);
      }
      const data: Snapshot[] = await response.json();
      setSnapshots(data);
      if (data.length > 0 && !selectedSnapshotId) {
         // Select the newest snapshot by default if nothing is selected
        const sortedSnaps = [...data].sort((a,b) => new Date(b.created).getTime() - new Date(a.created).getTime());
        setSelectedSnapshotId(sortedSnaps[0].id);
      } else if (data.length === 0) {
        setSelectedSnapshotId(null);
      }
    } catch (err: any) {
      setError(err.message || 'An unknown error occurred while fetching snapshots.');
      setSnapshots([]);
    } finally {
      setIsLoading(false);
    }
  }, [selectedSnapshotId]); // Add selectedSnapshotId to dependencies if it influences initial selection logic

  useEffect(() => {
    fetchSnapshots();
  }, [fetchSnapshots]);


  const selectedSnapshot = useMemo(() => {
    return snapshots.find(s => s.id === selectedSnapshotId) || null;
  }, [snapshots, selectedSnapshotId]);

  const handleCreateSnapshot = async () => {
    if (!newSnapshotName.trim()) {
      alert('Snapshot name cannot be empty.');
      return;
    }
    setActionInProgress(true);
    setError(null);
    try {
      const response = await fetch(`/back/api/vms/${vmId}/snapshots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newSnapshotName, description: newSnapshotDescription }),
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({detail: `Failed to create snapshot: ${response.status}`}));
        throw new Error(errData.detail || `HTTP error ${response.status}`);
      }
      // const newSnapshot: Snapshot = await response.json(); // Backend returns the created snapshot
      await fetchSnapshots(); // Refetch all snapshots to get the new one in the tree
      setNewSnapshotName('');
      setNewSnapshotDescription('');
      setCreateDialogOpen(false);
      // setSelectedSnapshotId(newSnapshot.id); // Let fetchSnapshots handle selection or select manually
    } catch (err: any) {
      setError(err.message || 'Failed to create snapshot.');
    } finally {
      setActionInProgress(false);
    }
  };

  const handleDeleteSnapshot = async () => {
    if (!selectedSnapshotId) return;
    setActionInProgress(true);
    setError(null);
    const snapNameToDelete = selectedSnapshot?.name;
    if (!window.confirm(`Are you sure you want to delete snapshot "${snapNameToDelete}"? This may also delete its children.`)) {
        setActionInProgress(false);
        return;
    }
    try {
      const response = await fetch(`/back/api/vms/${vmId}/snapshots/${selectedSnapshotId}`, {
        method: 'DELETE',
      });
      if (!response.ok && response.status !== 204) { // 204 is also a success (No Content)
        const errData = await response.json().catch(() => ({detail: `Failed to delete snapshot: ${response.status}`}));
        throw new Error(errData.detail || `HTTP error ${response.status}`);
      }
      setSelectedSnapshotId(null); // Deselect
      await fetchSnapshots(); // Refetch
    } catch (err: any) {
      setError(err.message || 'Failed to delete snapshot.');
    } finally {
      setActionInProgress(false);
    }
  };

  const handleRestoreSnapshot = async () => {
    if (!selectedSnapshot) return;
    setActionInProgress(true);
    setError(null);
    if (!window.confirm(`Are you sure you want to restore to snapshot "${selectedSnapshot.name}"? The VM will be rebooted.`)) {
        setActionInProgress(false);
        return;
    }
    try {
      const response = await fetch(`/back/api/vms/${vmId}/snapshots/${selectedSnapshot.id}/revert`, {
        method: 'POST',
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({detail: `Failed to revert snapshot: ${response.status}`}));
        throw new Error(errData.detail || `HTTP error ${response.status}`);
      }
      alert(`Restoring to snapshot: "${selectedSnapshot.name}" initiated. VM may reboot.`);
      // Optionally, you might want to refetch VM overview data or other relevant state
      await fetchSnapshots(); // Re-fetch snapshots, though they shouldn't change
    } catch (err: any) {
      setError(err.message || 'Failed to revert to snapshot.');
    } finally {
      setActionInProgress(false);
    }
  };


  const buildTree = useCallback((parentId: string | null = null): JSX.Element[] => {
    return snapshots
      .filter(snapshot => snapshot.parentId === parentId)
      .sort((a,b) => new Date(a.created).getTime() - new Date(b.created).getTime())
      .map(snapshot => (
        <TreeItem
          key={snapshot.id}
          itemId={snapshot.id}
          label={`${snapshot.name} (${new Date(snapshot.created).toLocaleDateString()})`}
        >
          {buildTree(snapshot.id)}
        </TreeItem>
      ));
  }, [snapshots]);

  const treeItems = useMemo(() => buildTree(null), [buildTree]);

  const handleSelectedItemsChange = (event: React.SyntheticEvent, itemId: string | string[] | null, payload: TreeViewBasePayload) => {
    if (typeof itemId === 'string') {
        setSelectedSnapshotId(itemId);
    } else if (Array.isArray(itemId) && itemId.length > 0) {
        setSelectedSnapshotId(itemId[0]); // If multiSelect is somehow enabled, take the first
    } else {
        setSelectedSnapshotId(null);
    }
  };


  return (
    <Stack spacing={2} sx={{ height: '100%' }}>
      <Toolbar disableGutters variant="dense">
        <Button startIcon={<AddIcon />} onClick={() => setCreateDialogOpen(true)} variant="outlined" size="small" disabled={actionInProgress}>创建快照</Button>
        <Button startIcon={<RestoreIcon />} onClick={handleRestoreSnapshot} disabled={!selectedSnapshot || actionInProgress} sx={{ ml: 1 }} variant="outlined" size="small">恢复</Button>
        <Button startIcon={<DeleteIcon />} onClick={handleDeleteSnapshot} disabled={!selectedSnapshot || actionInProgress} color="error" sx={{ ml: 1 }} variant="outlined" size="small">删除</Button>
        {actionInProgress && <CircularProgress size={24} sx={{ml: 2}} />}
      </Toolbar>

      {error && <Alert severity="error" onClose={() => setError(null)} sx={{mb:1}}>{error}</Alert>}

      <Grid container spacing={2} sx={{ flexGrow: 1 }}>
        <Grid item xs={12} md={4} sx={{ minHeight: 300, display:'flex', flexDirection:'column' }}>
          <Paper variant="outlined" sx={{ p: 1.5, flexGrow:1, display:'flex', flexDirection:'column',  overflowY: 'auto' }}>
            <Typography variant="subtitle1" gutterBottom sx={{ display: 'flex', alignItems: 'center', mb:1 }}><TreeIcon sx={{ mr: 1 }} /> 快照列表</Typography>
            {isLoading ? (
                <Stack spacing={1}><Skeleton variant="text" /><Skeleton variant="text" /><Skeleton variant="text" /></Stack>
            ) : snapshots.length > 0 ? (
                <SimpleTreeView
                  slots={{ collapseIcon: ExpandMoreIcon, expandIcon: ChevronRightIcon }}
                  selectedItems={selectedSnapshotId}
                  onSelectedItemsChange={handleSelectedItemsChange}
                  sx={{ flexGrow: 1 }}
                >
                {treeItems}
                </SimpleTreeView>
            ) : (
                <Stack alignItems="center" justifyContent="center" sx={{flexGrow:1, color: 'text.secondary', p:2}}>
                    <EmptyIcon sx={{fontSize: 30, mb:0.5}}/>
                    <Typography>暂无快照</Typography>
                    <Typography variant="caption">点击“创建快照”开始</Typography>
                </Stack>
            )}
          </Paper>
        </Grid>

        <Grid item xs={12} md={8}>
          {isLoading && !selectedSnapshot ? (
             <Paper variant="outlined" sx={{ p: 2, height: '100%' }}><Skeleton variant="rectangular" height="100%" /></Paper>
          ): selectedSnapshot ? (
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom sx={{ borderBottom: '1px solid #ddd', pb:1, mb:1.5 }}>{selectedSnapshot.name}</Typography>
              <Stack spacing={1}>
                <Typography variant="body2"><CalendarIcon fontSize="small" sx={{verticalAlign: 'middle', mr:0.5}}/><strong>Created:</strong> {new Date(selectedSnapshot.created).toLocaleString()}</Typography>
                <Typography variant="body2"><DescriptionIcon fontSize="small" sx={{verticalAlign: 'middle', mr:0.5}}/><strong>Description:</strong> {selectedSnapshot.description || 'N/A'}</Typography>
                <Typography variant="body2"><TreeIcon fontSize="small" sx={{verticalAlign: 'middle', mr:0.5}}/><strong>Parent:</strong> {snapshots.find(s => s.id === selectedSnapshot.parentId)?.name || 'None (Base)'}</Typography>
                <Typography variant="body2"><SizeIcon fontSize="small" sx={{verticalAlign: 'middle', mr:0.5}}/><strong>Size:</strong> {selectedSnapshot.size_mb} MB</Typography>
                {selectedSnapshot.xml && <>
                  <Typography variant="subtitle2" sx={{ mt: 2, pt:1, borderTop: '1px solid #eee' }}><XmlIcon fontSize="small" sx={{verticalAlign: 'middle', mr:0.5}}/> XML Configuration:</Typography>
                  <Box sx={{ fontSize: '0.75rem', bgcolor: 'grey.100', p: 1.5, borderRadius: 1, maxHeight: 200, overflowY: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                    {selectedSnapshot.xml}
                  </Box>
                </>}
              </Stack>
            </Paper>
          ) : (
            <Paper variant="outlined" sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', minHeight: 200 }}>
              <EmptyIcon sx={{fontSize: 40, color: 'grey.400', mb:1}}/>
              <Typography variant="h6" color="text.secondary">{snapshots.length > 0 ? "未选择快照" : "没有可用快照"}</Typography>
              <Typography color="text.secondary">{snapshots.length > 0 ? "从左侧列表选择一个快照查看详情。" : "点击上方按钮创建快照。"}</Typography>
            </Paper>
          )}
        </Grid>
      </Grid>

      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>创建新快照</DialogTitle>
        <DialogContent><Stack spacing={2} sx={{mt:1}}>
            <TextField autoFocus label="快照名称" fullWidth size="small" value={newSnapshotName} onChange={(e) => setNewSnapshotName(e.target.value)} disabled={actionInProgress}/>
            <TextField label="描述（可选）" fullWidth size="small" multiline rows={3} value={newSnapshotDescription} onChange={(e) => setNewSnapshotDescription(e.target.value)} disabled={actionInProgress}/>
        </Stack></DialogContent>
        <DialogActions>
            <Button onClick={() => setCreateDialogOpen(false)} disabled={actionInProgress}>取消</Button>
            <Button onClick={handleCreateSnapshot} variant="contained" disabled={actionInProgress || !newSnapshotName.trim()}>
                {actionInProgress ? <CircularProgress size={20}/> : "创建"}
            </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
