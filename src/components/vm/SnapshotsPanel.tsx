import React from 'react';
import { Box, List, ListItem, ListItemText, Divider, Typography, Paper } from '@mui/material';

const snapshots = [
  { name: 'snap1', created: '2024-06-01 10:00', parent: '-' },
  { name: 'snap2', created: '2024-06-02 09:15', parent: 'snap1' },
  { name: 'snap3', created: '2024-06-03 14:30', parent: 'snap2' }
];

export default function SnapshotsPanel() {
  return (
    <Box>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>快照列表</Typography>
      <Paper variant="outlined">
        <List>
          {snapshots.map(s => (
            <React.Fragment key={s.name}>
              <ListItem>
                <ListItemText primary={s.name} secondary={`创建于 ${s.created} | 父级: ${s.parent}`} />
              </ListItem>
              <Divider component="li" />
            </React.Fragment>
          ))}
        </List>
      </Paper>
    </Box>
  );
}
