import React from 'react';
import { Box, Table, TableHead, TableRow, TableCell, TableBody, Typography, Paper } from '@mui/material';

const events = [
  { time: '10:01:00', level: 'info', detail: 'VM started' },
  { time: '10:05:10', level: 'warning', detail: 'High CPU usage' },
  { time: '10:06:30', level: 'info', detail: 'Snapshot created' }
];

export default function EventsPanel() {
  return (
    <Box>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>事件日志</Typography>
      <Paper variant="outlined" sx={{ overflowX: 'auto' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Time</TableCell>
              <TableCell>Level</TableCell>
              <TableCell>Detail</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {events.map((e, idx) => (
              <TableRow key={idx}>
                <TableCell>{e.time}</TableCell>
                <TableCell>{e.level}</TableCell>
                <TableCell>{e.detail}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
}
