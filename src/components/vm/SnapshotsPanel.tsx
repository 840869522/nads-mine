import React, { useState } from 'react'
import {
  Box, Button, Card, CardContent, Dialog, DialogActions,
  DialogContent, DialogTitle, Grid, Stack, TextField,
  Toolbar, Typography
} from '@mui/material'
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Restore as RestoreIcon
} from '@mui/icons-material'
import { SimpleTreeView, TreeItem } from '@mui/x-tree-view'

interface Snapshot {
  id: string
  name: string
  created: string
  parent?: string
  size: string
  xml: string
}

const mock: Snapshot[] = [
  { id: '1', name: 'base', created: '2024-06-01', size: '500MB', xml: '<snap/>' },
  { id: '2', name: 'update', created: '2024-06-05', parent: '1', size: '200MB', xml: '<snap/>' },
  { id: '3', name: 'test', created: '2024-06-10', parent: '2', size: '150MB', xml: '<snap/>' }
]

export default function SnapshotsPanel() {
  const [open, setOpen] = useState(false)
  const [current, setCurrent] = useState<Snapshot | null>(mock[0])

  return (
    <Grid container spacing={2} sx={{ height: '100%' }}>
      <Grid item xs={12}>
        <Toolbar disableGutters sx={{ mb: 1 }}>
          <Button startIcon={<AddIcon />} onClick={() => setOpen(true)}>创建快照</Button>
          <Button startIcon={<RestoreIcon />} disabled sx={{ ml: 2 }}>还原</Button>
          <Button startIcon={<DeleteIcon />} disabled sx={{ ml: 2 }}>删除</Button>
        </Toolbar>
      </Grid>
      <Grid item xs={4} sx={{ height: 'calc(100% - 56px)' }}>
        <SimpleTreeView defaultCollapseIcon={<RestoreIcon />} defaultExpandIcon={<RestoreIcon />}>
          {mock.map(s => (
            <TreeItem itemId={s.id} key={s.id} label={`${s.name} (${s.created})`} onClick={() => setCurrent(s)} />
          ))}
        </SimpleTreeView>
      </Grid>
      <Grid item xs={8}>
        {current && (
          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle2" gutterBottom>{current.name}</Typography>
              <Stack spacing={0.5} sx={{ fontSize: 14 }}>
                <span>创建时间: {current.created}</span>
                <span>父级: {current.parent ?? '-'}</span>
                <span>大小: {current.size}</span>
              </Stack>
              <Box sx={{ mt: 2, fontSize: 12, bgcolor: 'grey.100', p: 1, borderRadius: 1 }}>
                <pre style={{ margin: 0 }}>{current.xml}</pre>
              </Box>
            </CardContent>
          </Card>
        )}
      </Grid>
      <Dialog open={open} onClose={() => setOpen(false)}>
        <DialogTitle>创建快照</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <TextField label="名称" fullWidth size="small" />
          <TextField label="描述" fullWidth size="small" multiline rows={3} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>取消</Button>
          <Button variant="contained">确定</Button>
        </DialogActions>
      </Dialog>
    </Grid>
  )
}
