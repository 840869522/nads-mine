import React, { useState } from 'react'
import {
  Box, Button, Dialog, DialogActions, DialogContent, DialogTitle,
  Grid, IconButton, LinearProgress, Paper, Table, TableBody,
  TableCell, TableHead, TableRow, TextField, Toolbar, Typography
} from '@mui/material'
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Expand as ExpandIcon
} from '@mui/icons-material'

interface Disk {
  target: string
  source: string
  format: string
  size: number
  alloc: number
}

const disks: Disk[] = [
  { target: 'vda', source: '/var/lib/libvirt/images/disk1.qcow2', format: 'qcow2', size: 20, alloc: 8 },
  { target: 'vdb', source: '/var/lib/libvirt/images/disk2.qcow2', format: 'qcow2', size: 40, alloc: 30 }
]

export default function StoragePanel() {
  const [addOpen, setAddOpen] = useState(false)

  return (
    <Box>
      <Toolbar disableGutters sx={{ mb: 1 }}>
        <Button startIcon={<AddIcon />} onClick={() => setAddOpen(true)}>新增磁盘</Button>
      </Toolbar>
      <Paper variant="outlined" sx={{ overflowX: 'auto' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Target</TableCell>
              <TableCell>Source</TableCell>
              <TableCell>Format</TableCell>
              <TableCell>Capacity</TableCell>
              <TableCell>Allocated</TableCell>
              <TableCell>Usage</TableCell>
              <TableCell align="right">操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {disks.map(d => (
              <TableRow key={d.target} hover>
                <TableCell>{d.target}</TableCell>
                <TableCell>{d.source}</TableCell>
                <TableCell>{d.format}</TableCell>
                <TableCell>{d.size}G</TableCell>
                <TableCell>{d.alloc}G</TableCell>
                <TableCell sx={{ minWidth: 120 }}>
                  <LinearProgress variant="determinate" value={d.alloc / d.size * 100} />
                </TableCell>
                <TableCell align="right">
                  <IconButton size="small"><ExpandIcon fontSize="small" /></IconButton>
                  <IconButton size="small" color="error"><DeleteIcon fontSize="small" /></IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={addOpen} onClose={() => setAddOpen(false)}>
        <DialogTitle>新增磁盘</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <TextField label="存储池" fullWidth size="small" />
          <TextField label="容量 (GB)" type="number" fullWidth size="small" />
          <TextField label="总线类型" fullWidth size="small" />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddOpen(false)}>取消</Button>
          <Button variant="contained">确定</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
