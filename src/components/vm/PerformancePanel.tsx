import React, { useState } from 'react'
import { Box, Button, Stack, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material'

const charts = ['CPU 使用率', '内存 MB', '磁盘吞吐', '网络吞吐']

export default function PerformancePanel() {
  const [range, setRange] = useState('1h')

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
        <ToggleButtonGroup size="small" value={range} exclusive onChange={(_, v) => v && setRange(v)}>
          <ToggleButton value="1h">1小时</ToggleButton>
          <ToggleButton value="24h">24小时</ToggleButton>
          <ToggleButton value="7d">7天</ToggleButton>
        </ToggleButtonGroup>
        <Button size="small" variant="outlined">导出 CSV</Button>
      </Stack>
      <Stack spacing={2}>
        {charts.map(label => (
          <Box key={label} sx={{ height: 160, bgcolor: 'grey.100', borderRadius: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography color="text.secondary">{label} 图表</Typography>
          </Box>
        ))}
      </Stack>
    </Box>
  )
}
