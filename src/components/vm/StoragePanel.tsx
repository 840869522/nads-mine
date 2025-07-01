import React from 'react';
import { Box, Table, TableHead, TableRow, TableCell, TableBody, Typography, Paper } from '@mui/material';

const disks = [
  { target: 'vda', source: '/var/lib/libvirt/images/disk1.qcow2', format: 'qcow2', size: '20G', usage: 40 },
  { target: 'vdb', source: '/var/lib/libvirt/images/disk2.qcow2', format: 'qcow2', size: '10G', usage: 10 }
];

export default function StoragePanel() {
  return (
    <Box>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>磁盘列表</Typography>
      <Paper variant="outlined" sx={{ overflowX: 'auto' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Target</TableCell>
              <TableCell>Source</TableCell>
              <TableCell>Format</TableCell>
              <TableCell>Size</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {disks.map(d => (
              <TableRow key={d.target}>
                <TableCell>{d.target}</TableCell>
                <TableCell>{d.source}</TableCell>
                <TableCell>{d.format}</TableCell>
                <TableCell>{d.size}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
}
