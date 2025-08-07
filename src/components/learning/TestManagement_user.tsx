import React, { useState, useEffect } from 'react';
import { 
  Box, TextField, Typography, Paper, Table, TableBody, 
  TableCell, TableContainer, TableHead, TableRow, Chip, 
  LinearProgress, Pagination, Grid, Tooltip
} from '@mui/material';
import { 
  Search as SearchIcon,  // 新增这一行
  People as PeopleIcon, 
  Edit as EditIcon, 
  Delete as DeleteIcon 
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterMoment } from '@mui/x-date-pickers/AdapterMoment';
import moment from 'moment';
import '@/node_modules/moment/locale/zh-cn';
import { useTheme } from '@mui/material/styles';

// 应用中文本地化
moment.locale('zh-cn');

const TestManagement_user = () => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [startDate, setStartDate] = useState<moment.Moment | null>(null);
  const [endDate, setEndDate] = useState<moment.Moment | null>(null);
  const [page, setPage] = useState(1);
  const [rowsPerPage] = useState(10);

  // 动态颜色函数
  const getBgColor = () => isDarkMode ? '#121212' : '#f5f7fa';
  const getCardBgColor = () => isDarkMode ? '#1e1e1e' : '#ffffff';
  const getTableRowBgColor = (index: number) => 
    isDarkMode 
      ? (index % 2 === 0 ? '#252525' : '#1e1e1e') 
      : (index % 2 === 0 ? '#fafafa' : '#ffffff');
  const getTextColor = () => isDarkMode ? '#f5f5f5' : '#333';
  const getHeaderTextColor = () => isDarkMode ? '#fff' : '#000';
  const getSecondaryTextColor = () => isDarkMode ? '#bbb' : '#666';

  // 模拟API数据
  useEffect(() => {
    setLoading(true);
    
    // 模拟获取测试数据
    setTimeout(() => {
      const mockData = Array.from({ length: 50 }, (_, i) => ({
        c_id: `test-${i + 1}`,
        c_name: `测试 ${i + 1}`,
        c_description: `这是测试 ${i + 1} 的描述信息，用于评估学生相关知识掌握情况`,
        c_paper_count: Math.floor(Math.random() * 5) + 1,
        c_start: moment().subtract(Math.random() * 30, 'days').toDate(),
        c_end: moment().add(Math.random() * 30, 'days').toDate(),
        c_create_at: moment().subtract(Math.random() * 100, 'days').toDate(),
        c_course_id: `C${Math.floor(Math.random() * 1000).toString().padStart(4, '0')}`
      }));
      
      setTests(mockData);
      setLoading(false);
    }, 1000);
  }, []);

  const handleSearch = (e) => {
    setSearchText(e.target.value);
    setPage(1);
  };

  const getTestStatus = (test) => {
    const now = moment();
    const start = moment(test.c_start);
    const end = moment(test.c_end);
    
    if (now.isBefore(start)) {
      return { label: '未开始', color: 'primary' };
    } else if (now.isAfter(end)) {
      return { label: '已结束', color: 'error' };
    } else {
      return { label: '进行中', color: 'success' };
    }
  };

  const filteredTests = tests.filter(test => {
    const matchesSearch = test.c_name.toLowerCase().includes(searchText.toLowerCase()) || 
                          test.c_description.toLowerCase().includes(searchText.toLowerCase()) ||
                          test.c_course_id.toLowerCase().includes(searchText.toLowerCase());
    
    const matchesStartDate = !startDate || moment(test.c_start).isSameOrAfter(startDate, 'day');
    const matchesEndDate = !endDate || moment(test.c_end).isSameOrBefore(endDate, 'day');
    
    return matchesSearch && matchesStartDate && matchesEndDate;
  });

  const pageCount = Math.ceil(filteredTests.length / rowsPerPage);
  const paginatedTests = filteredTests.slice((page - 1) * rowsPerPage, page * rowsPerPage);

  return (
    <Paper sx={{ 
      p: 3, 
      borderRadius: 4, 
      position: 'relative',
      backgroundColor: getCardBgColor(),
      color: getTextColor(),
      boxShadow: isDarkMode ? '0 4px 12px rgba(0,0,0,0.2)' : '0 4px 12px rgba(0,0,0,0.08)'
    }}>
      <Box sx={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight="bold" color={getTextColor()}>
          测试管理
        </Typography>
      </Box>
      
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={12}>
          <TextField
            fullWidth
            placeholder="搜索测试名称、描述或课程ID"
            variant="outlined"
            size="small"
            value={searchText}
            onChange={handleSearch}
            InputProps={{
              startAdornment: <SearchIcon sx={{ color: 'action.active', mr: 1 }} />,
              style: { 
                color: getTextColor(),
                backgroundColor: isDarkMode ? '#252525' : '#fff'
              }
            }}
            InputLabelProps={{ style: { color: getTextColor() } }}
            sx={{
              width: { xs: '100%', md: 300 }, 
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
              }
            }}
          />
        </Grid>
        <Grid item xs={6} md={3}>
          <LocalizationProvider dateAdapter={AdapterMoment}>
            <DatePicker
              label="开始日期"
              value={startDate}
              onChange={(newValue) => setStartDate(newValue)}
              renderInput={(params) => (
                <TextField 
                  {...params} 
                  fullWidth 
                  size="small"
                  InputLabelProps={{ style: { color: getTextColor() } }}
                  InputProps={{ style: { color: getTextColor() } }}
                  sx={{ 
                    '& .MuiOutlinedInput-root': {
                      backgroundColor: isDarkMode ? '#252525' : '#fff'
                    }
                  }}
                />
              )}
              inputFormat="YYYY/MM/DD"
              displayFormat="YYYY/MM/DD"
            />
          </LocalizationProvider>
        </Grid>
        <Grid item xs={6} md={3}>
          <LocalizationProvider dateAdapter={AdapterMoment}>
            <DatePicker
              label="结束日期"
              value={endDate}
              onChange={(newValue) => setEndDate(newValue)}
              renderInput={(params) => (
                <TextField 
                  {...params} 
                  fullWidth 
                  size="small"
                  InputLabelProps={{ style: { color: getTextColor() } }}
                  InputProps={{ style: { color: getTextColor() } }}
                  sx={{ 
                    '& .MuiOutlinedInput-root': {
                      backgroundColor: isDarkMode ? '#252525' : '#fff'
                    }
                  }}
                />
              )}
              inputFormat="YYYY/MM/DD"
              displayFormat="YYYY/MM/DD"
            />
          </LocalizationProvider>
        </Grid>
      </Grid>
      
      {loading && <LinearProgress />}
      
      <TableContainer sx={{ borderRadius: 2, overflow: 'hidden', mb: 2 }}>
        <Table>
          <TableHead>
            <TableRow sx={{ backgroundColor: isDarkMode ? '#2a2a2a' : '#f5f5f5' }}>
              <TableCell sx={{ fontWeight: 600, color: getHeaderTextColor() }}>测试名称</TableCell>
              <TableCell sx={{ fontWeight: 600, color: getHeaderTextColor() }}>描述</TableCell>
              <TableCell align="center" sx={{ fontWeight: 600, color: getHeaderTextColor() }}>试卷数</TableCell>
              <TableCell align="center" sx={{ fontWeight: 600, color: getHeaderTextColor() }}>课程ID</TableCell>
              <TableCell sx={{ fontWeight: 600, color: getHeaderTextColor() }}>时间范围</TableCell>
              <TableCell align="center" sx={{ fontWeight: 600, color: getHeaderTextColor() }}>状态</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {paginatedTests.map((test, index) => (
              <TableRow 
                key={test.c_id} 
                hover
                sx={{ backgroundColor: getTableRowBgColor(index) }}
              >
                <TableCell sx={{ fontWeight: 500, color: getTextColor() }}>{test.c_name}</TableCell>
                <TableCell sx={{ maxWidth: 300, color: getTextColor() }}>{test.c_description}</TableCell>
                <TableCell align="center" sx={{ color: getTextColor() }}>{test.c_paper_count}</TableCell>
                <TableCell align="center" sx={{ color: getTextColor() }}>{test.c_course_id}</TableCell>
                <TableCell sx={{ color: getTextColor() }}>
                  <Box fontSize="0.875rem">
                    <div>开始: {moment(test.c_start).format('YYYY-MM-DD')}</div>
                    <div>结束: {moment(test.c_end).format('YYYY-MM-DD')}</div>
                  </Box>
                </TableCell>
                <TableCell align="center">
                  <Chip 
                    label={getTestStatus(test).label} 
                    color={getTestStatus(test).color} 
                    size="small"
                    sx={{ borderRadius: 1, fontWeight: 500 }}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      
      {filteredTests.length === 0 && !loading && (
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: 200,
          color: getTextColor()
        }}>
          没有找到匹配的测试
        </Box>
      )}
      
      {pageCount > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
          <Pagination 
            count={pageCount} 
            page={page} 
            onChange={(e, value) => setPage(value)}
            shape="rounded"
            color="primary"
            sx={{
              '& .MuiPaginationItem-root': {
                color: getTextColor(),
              },
              '& .MuiPaginationItem-page.Mui-selected': {
                backgroundColor: isDarkMode ? '#3f51b5' : '#3f51b5',
                color: '#fff',
              }
            }}
          />
        </Box>
      )}
    </Paper>
  );
};

export default TestManagement_user;
