import React from 'react';
import { Box, Table, TableHead, TableRow, TableCell, TableBody, Typography, Paper } from '@mui/material';

const nics = [
  { mac: '52:54:00:aa:bb:cc', bridge: 'virbr0', model: 'virtio', pci: '0000:00:03.0' },
  { mac: '52:54:00:dd:ee:ff', bridge: 'virbr1', model: 'e1000', pci: '0000:00:04.0' }
];

export default function NetworkPanel() {
  return (
    <Box>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>网络接口</Typography>
      <Paper variant="outlined" sx={{ overflowX: 'auto' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>MAC</TableCell>
              <TableCell>Bridge</TableCell>
              <TableCell>Model</TableCell>
              <TableCell>PCI</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {nics.map(nic => (
              <TableRow key={nic.mac}>
                <TableCell>{nic.mac}</TableCell>
                <TableCell>{nic.bridge}</TableCell>
                <TableCell>{nic.model}</TableCell>
                <TableCell>{nic.pci}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
}
