import React, { useState, useMemo } from 'react';
import {
  Box, Button, Card, CardContent, Dialog, DialogActions,
  DialogContent, DialogTitle, Grid, Stack, TextField,
  Toolbar, Typography, IconButton, Paper
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
import { SimpleTreeView, TreeItem } from '@mui/x-tree-view';

interface Snapshot {
  id: string;
  name: string;
  description?: string;
  created: string;
  parentId?: string | null;
  size: string;
  xml: string;
}

const initialSnapshots: Snapshot[] = [
  { id: 'snap1', name: 'Base Installation', created: '2024-06-01 10:00', parentId: null, size: '500MB', xml: '<snapshot><name>Base Installation</name></snapshot>' },
  { id: 'snap2', name: 'Updated System', created: '2024-06-05 14:30', parentId: 'snap1', size: '200MB', xml: '<snapshot><name>Updated System</name></snapshot>' },
  { id: 'snap3', name: 'Testing Build #123', created: '2024-06-10 09:15', parentId: 'snap2', size: '150MB', xml: '<snapshot><name>Testing Build #123</name></snapshot>' },
  { id: 'snap4', name: 'Pre-Upgrade State', created: '2024-06-08 11:00', parentId: 'snap1', size: '180MB', xml: '<snapshot><name>Pre-Upgrade State</name></snapshot>' },
];

export default function SnapshotsPanel() {
  const [snapshots, setSnapshots] = useState<Snapshot[]>(initialSnapshots);
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string | null>(initialSnapshots.length > 0 ? initialSnapshots[0].id : null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newSnapshotName, setNewSnapshotName] = useState('');
  const [newSnapshotDescription, setNewSnapshotDescription] = useState('');

  const selectedSnapshot = useMemo(() => {
    return snapshots.find(s => s.id === selectedSnapshotId) || null;
  }, [snapshots, selectedSnapshotId]);

  const handleCreateSnapshot = () => {
    if (!newSnapshotName.trim()) {
      alert('Snapshot name cannot be empty.');
      return;
    }
    const newSnapshot: Snapshot = {
      id: `snap${Date.now()}`, name: newSnapshotName, description: newSnapshotDescription,
      created: new Date().toISOString().slice(0, 16).replace('T', ' '),
      parentId: selectedSnapshotId,
      size: `${Math.floor(Math.random() * 300) + 50}MB`,
      xml: `<snapshot><name>${newSnapshotName}</name><description>${newSnapshotDescription}</description></snapshot>`,
    };
    setSnapshots(prev => [...prev, newSnapshot]);
    setNewSnapshotName(''); setNewSnapshotDescription('');
    setCreateDialogOpen(false); setSelectedSnapshotId(newSnapshot.id);
  };

  const handleDeleteSnapshot = () => {
    if (!selectedSnapshotId) return;
    setSnapshots(prev => prev.filter(s => s.id !== selectedSnapshotId));
    // Logic to also delete children or re-parent would be needed in a real app
    const childrenOfSelected = snapshots.filter(s => s.parentId === selectedSnapshotId);
    if (childrenOfSelected.length > 0) {
        alert(`Snapshot "${selectedSnapshot?.name}" has children. Deleting them as well (mock behavior). A real app might offer re-parenting or prevent deletion.`);
        const idsToDelete = [selectedSnapshotId, ...childrenOfSelected.map(c => c.id)]; // Simple cascade mock
        setSnapshots(prev => prev.filter(s => !idsToDelete.includes(s.id)));
    } else {
        setSnapshots(prev => prev.filter(s => s.id !== selectedSnapshotId));
    }
    setSelectedSnapshotId(null);
  };

  const handleRestoreSnapshot = () => {
    if (!selectedSnapshot) return;
    alert(`Restoring to snapshot: "${selectedSnapshot.name}" (mock action)`);
  };

  const buildTree = (parentId: string | null = null): JSX.Element[] => {
    return snapshots
      .filter(snapshot => snapshot.parentId === parentId)
      .sort((a,b) => new Date(a.created).getTime() - new Date(b.created).getTime()) // Sort by creation time
      .map(snapshot => (
        <TreeItem
          key={snapshot.id}
          itemId={snapshot.id}
          label={`${snapshot.name} (${new Date(snapshot.created).toLocaleDateString()})`} // Simpler date
          onClick={() => setSelectedSnapshotId(snapshot.id)}
        >
          {buildTree(snapshot.id)}
        </TreeItem>
      ));
  };

  const treeItems = useMemo(() => buildTree(null), [snapshots]); // Memoize tree items

  return (
    <Stack spacing={2} sx={{ height: '100%' }}>
      <Toolbar disableGutters variant="dense">
        <Button startIcon={<AddIcon />} onClick={() => setCreateDialogOpen(true)} variant="outlined" size="small">Create Snapshot</Button>
        <Button startIcon={<RestoreIcon />} onClick={handleRestoreSnapshot} disabled={!selectedSnapshot} sx={{ ml: 1 }} variant="outlined" size="small">Restore</Button>
        <Button startIcon={<DeleteIcon />} onClick={handleDeleteSnapshot} disabled={!selectedSnapshot} color="error" sx={{ ml: 1 }} variant="outlined" size="small">Delete</Button>
      </Toolbar>

      <Grid container spacing={2} sx={{ flexGrow: 1 }}>
        <Grid item xs={12} md={4} sx={{ height: 'calc(100% - 40px)', display:'flex', flexDirection:'column' }}> {/* Adjusted height */}
          <Paper variant="outlined" sx={{ p: 1.5, flexGrow:1, display:'flex', flexDirection:'column',  overflowY: 'auto' }}>
            <Typography variant="subtitle1" gutterBottom sx={{ display: 'flex', alignItems: 'center', mb:1 }}><TreeIcon sx={{ mr: 1 }} /> Snapshots</Typography>
            {snapshots.length > 0 ? (
                <SimpleTreeView defaultCollapseIcon={<ExpandMoreIcon />} defaultExpandIcon={<ChevronRightIcon />} selectedItems={selectedSnapshotId} onSelectedItemsChange={(_, itemId) => setSelectedSnapshotId(itemId as string | null)} sx={{ flexGrow: 1 }}>
                {treeItems}
                </SimpleTreeView>
            ) : (
                <Stack alignItems="center" justifyContent="center" sx={{flexGrow:1, color: 'text.secondary', p:2}}>
                    <EmptyIcon sx={{fontSize: 30, mb:0.5}}/>
                    <Typography>No snapshots available.</Typography>
                    <Typography variant="caption">Click "Create Snapshot" to begin.</Typography>
                </Stack>
            )}
          </Paper>
        </Grid>

        <Grid item xs={12} md={8}>
          {selectedSnapshot ? (
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom sx={{ borderBottom: '1px solid #ddd', pb:1, mb:1.5 }}>{selectedSnapshot.name}</Typography>
              <Stack spacing={1}>
                <Typography variant="body2"><CalendarIcon fontSize="small" sx={{verticalAlign: 'middle', mr:0.5}}/><strong>Created:</strong> {new Date(selectedSnapshot.created).toLocaleString()}</Typography>
                <Typography variant="body2"><DescriptionIcon fontSize="small" sx={{verticalAlign: 'middle', mr:0.5}}/><strong>Description:</strong> {selectedSnapshot.description || 'N/A'}</Typography>
                <Typography variant="body2"><TreeIcon fontSize="small" sx={{verticalAlign: 'middle', mr:0.5}}/><strong>Parent:</strong> {snapshots.find(s => s.id === selectedSnapshot.parentId)?.name || 'None (Base)'}</Typography>
                <Typography variant="body2"><SizeIcon fontSize="small" sx={{verticalAlign: 'middle', mr:0.5}}/><strong>Size:</strong> {selectedSnapshot.size}</Typography>
                <Typography variant="subtitle2" sx={{ mt: 2, pt:1, borderTop: '1px solid #eee' }}><XmlIcon fontSize="small" sx={{verticalAlign: 'middle', mr:0.5}}/> XML Configuration:</Typography>
                <Box sx={{ fontSize: '0.75rem', bgcolor: 'grey.100', p: 1.5, borderRadius: 1, maxHeight: 200, overflowY: 'auto' }}><pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{selectedSnapshot.xml}</pre></Box>
              </Stack>
            </Paper>
          ) : (
            <Paper variant="outlined" sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column' }}>
              <EmptyIcon sx={{fontSize: 40, color: 'grey.400', mb:1}}/>
              <Typography variant="h6" color="text.secondary">No Snapshot Selected</Typography>
              <Typography color="text.secondary">Select a snapshot from the tree to view its details.</Typography>
            </Paper>
          )}
        </Grid>
      </Grid>

      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Create New Snapshot</DialogTitle>
        <DialogContent><Stack spacing={2} sx={{mt:1}}>
            <TextField autoFocus label="Snapshot Name" fullWidth size="small" value={newSnapshotName} onChange={(e) => setNewSnapshotName(e.target.value)}/>
            <TextField label="Description (Optional)" fullWidth size="small" multiline rows={3} value={newSnapshotDescription} onChange={(e) => setNewSnapshotDescription(e.target.value)}/>
        </Stack></DialogContent>
        <DialogActions><Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button><Button onClick={handleCreateSnapshot} variant="contained">Create</Button></DialogActions>
      </Dialog>
    </Stack>
  );
}
