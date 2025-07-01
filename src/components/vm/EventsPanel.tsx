import React, { useState } from 'react'
import {
  Box, Button, MenuItem, Select, Stack, Table, TableBody, TableCell,
  TableHead, TableRow, TextField, Toolbar, Typography
} from '@mui/material'

const events = [
  { time: '10:01:00', level: 'info', detail: 'VM started' },
  { time: '10:05:10', level: 'warning', detail: 'High CPU usage' },
  { time: '10:06:30', level: 'info', detail: 'Snapshot created' }
]

export default function EventsPanel() {
  const [level, setLevel] = useState('all')

  return (
    <Box>
      <Toolbar disableGutters sx={{ mb: 1 }}>
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
          <Select size="small" value={level} onChange={e => setLevel(e.target.value)}>
            <MenuItem value="all">全部</MenuItem>
            <MenuItem value="info">Info</MenuItem>
            <MenuItem value="warning">Warning</MenuItem>
            <MenuItem value="error">Error</MenuItem>
          </Select>
          <TextField size="small" placeholder="关键词" />
          <Button size="small" variant="outlined">导出 CSV</Button>
          <Button size="small" color="error">清空</Button>
        </Stack>
      </Toolbar>
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
    </Box>
  )
}
