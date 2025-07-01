import React, { useState } from 'react'
import {
  Box, Button, Drawer, FormControl, IconButton, InputLabel, MenuItem,
  Select, Table, TableBody, TableCell, TableHead, TableRow, Toolbar,
  Typography
} from '@mui/material'
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon
} from '@mui/icons-material'

interface Nic {
  mac: string
  bridge: string
  model: string
  pci: string
  rx: number
  tx: number
}

const nics: Nic[] = [
  { mac: '52:54:00:aa:bb:cc', bridge: 'virbr0', model: 'virtio', pci: '0000:00:03.0', rx: 12, tx: 3 },
  { mac: '52:54:00:dd:ee:ff', bridge: 'virbr1', model: 'e1000', pci: '0000:00:04.0', rx: 0, tx: 0 }
]

export default function NetworkPanel() {
  const [drawer, setDrawer] = useState(false)
  const [edit, setEdit] = useState<Nic | null>(null)

  return (
    <Box>
      <Toolbar disableGutters sx={{ mb: 1 }}>
        <Button startIcon={<AddIcon />}>Attach NIC</Button>
      </Toolbar>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>MAC</TableCell>
            <TableCell>Bridge</TableCell>
            <TableCell>Model</TableCell>
            <TableCell>PCI</TableCell>
            <TableCell>RX (KB/s)</TableCell>
            <TableCell>TX (KB/s)</TableCell>
            <TableCell align="right">操作</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {nics.map(nic => (
            <TableRow key={nic.mac} hover>
              <TableCell>{nic.mac}</TableCell>
              <TableCell>{nic.bridge}</TableCell>
              <TableCell>{nic.model}</TableCell>
              <TableCell>{nic.pci}</TableCell>
              <TableCell>{nic.rx}</TableCell>
              <TableCell>{nic.tx}</TableCell>
              <TableCell align="right">
                <IconButton size="small" onClick={() => { setEdit(nic); setDrawer(true) }}><EditIcon fontSize="small" /></IconButton>
                <IconButton size="small" color="error"><DeleteIcon fontSize="small" /></IconButton>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Drawer anchor="right" open={drawer} onClose={() => setDrawer(false)} sx={{ '& .MuiDrawer-paper': { width: 280, p: 2 } }}>
        <Typography variant="h6" gutterBottom>编辑 vNIC</Typography>
        <FormControl fullWidth size="small" sx={{ mt: 2 }}>
          <InputLabel>绑定网络</InputLabel>
          <Select defaultValue={edit?.bridge || ''} label="绑定网络">
            <MenuItem value="virbr0">virbr0</MenuItem>
            <MenuItem value="virbr1">virbr1</MenuItem>
          </Select>
        </FormControl>
        <FormControl fullWidth size="small" sx={{ mt: 2 }}>
          <InputLabel>模型</InputLabel>
          <Select defaultValue={edit?.model || ''} label="模型">
            <MenuItem value="virtio">virtio</MenuItem>
            <MenuItem value="e1000">e1000</MenuItem>
          </Select>
        </FormControl>
        <Button variant="contained" sx={{ mt: 3 }}>保存</Button>
      </Drawer>
    </Box>
  )
}
