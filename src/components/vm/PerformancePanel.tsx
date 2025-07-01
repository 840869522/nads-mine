import React from 'react';
import { Box, Typography } from '@mui/material';

export default function PerformancePanel() {
  return (
    <Box>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>性能历史 (示例)</Typography>
      <Box sx={{ height: 200, bgcolor: 'grey.100', border: '1px dashed grey', borderRadius: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography color="text.secondary">图表占位符</Typography>
      </Box>
    </Box>
  );
}
