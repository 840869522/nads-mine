import React, { useState } from 'react';
import { 
  Dialog, DialogTitle, DialogContent, DialogActions, 
  Button, TextField, FormControl, InputLabel, 
  Select, MenuItem, Box, useTheme 
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterMoment } from '@mui/x-date-pickers/AdapterMoment';
import moment from 'moment';

const FixedSizeFormDialog = ({ open, onClose, onSave, test }) => {
  const theme = useTheme();
  
  // 增加测试类型状态，默认为理论测试
  const [formData, setFormData] = useState({
    c_name: test?.c_name || '',
    c_description: test?.c_description || '',
    c_paper_count: test?.c_paper_count || 1,
    c_course_id: test?.c_course_id || '',
    c_start: test ? moment(test.c_start) : null,
    c_end: test ? moment(test.c_end) : null,
    // 新增测试类型字段
    c_type: test?.c_type || '理论测试', // 默认值设为理论测试
  });

  const inputStyles = {
    name: { width: '800px', height: '60px' },
    description: { width: '800px', height: '200px' },
    paperCount: { width: '380px', height: '60px' },
    courseId: { width: '380px', height: '60px' },
    datePicker: { width: '380px', height: '60px' },
    testType: { width: '800px', height: '60px' } // 新增测试类型的样式
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handlePaperCountChange = (e) => {
    setFormData({ ...formData, c_paper_count: parseInt(e.target.value, 10) });
  };

  const handleDateChange = (name, date) => {
    setFormData({ ...formData, [name]: date });
  };

  // 处理测试类型变化
  const handleTypeChange = (e) => {
    const type = e.target.value;
    setFormData({ 
      ...formData, 
      c_type: type,
      // 如果是实践操作，重置试卷数量为1
      ...(type === '实践操作' && { c_paper_count: 1 })
    });
  };

  const handleSubmit = () => {
    if (!formData.c_name || !formData.c_description || 
        !formData.c_course_id || !formData.c_start || !formData.c_end) {
      alert('请填写所有必填字段');
      return;
    }
    
    // 如果是理论测试，需要验证试卷数量
    if (formData.c_type === '理论测试' && !formData.c_paper_count) {
      alert('请填写试卷数量');
      return;
    }
    
    onSave({
      ...formData,
      c_start: formData.c_start.toDate(),
      c_end: formData.c_end.toDate(),
    });
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth={false}
      PaperProps={{
        style: {
          backgroundColor: theme.palette.background.paper,
          borderRadius: '12px',
          width: '900px',
          maxWidth: '90vw',
          boxShadow: theme.shadows[5],
          overflow: 'hidden'
        }
      }}
    >
      <DialogTitle sx={{ 
        backgroundColor: theme.palette.primary.main,
        color: theme.palette.primary.contrastText,
        fontSize: '1.6rem',
        fontWeight: 600,
        py: 1.5,
        textAlign: 'left',
        boxShadow: theme.shadows[2]
      }}>
        {test ? '编辑测试信息' : '创建新测试'}
      </DialogTitle>
      
      <DialogContent sx={{ 
        py: 4, 
        px: 4,
        backgroundColor: theme.palette.background.default,
      }}>
        <Box sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: '30px',
          alignItems: 'center',
          maxWidth: '840px',
          margin: '0 auto',
          padding: '20px',
          backgroundColor: theme.palette.background.paper,
          borderRadius: '10px',
          boxShadow: theme.shadows[3]
        }}>
          {/* 测试名称 */}
          <Box sx={{ width: '100%' }}>
            <InputLabel sx={{ 
              color: theme.palette.text.secondary,
              fontSize: '1.1rem',
              fontWeight: 500,
              mb: 1,
              pl: 1
            }}>
              测试名称 *
            </InputLabel>
            <TextField
              fullWidth
              variant="outlined"
              name="c_name"
              value={formData.c_name}
              onChange={handleChange}
              required
              sx={{ 
                '& .MuiOutlinedInput-root': {
                  borderRadius: '8px',
                  border: `2px solid ${theme.palette.divider}`,
                  transition: 'all 0.3s',
                  '&:hover': {
                    borderColor: theme.palette.primary.main,
                  },
                  '&.Mui-focused': {
                    borderColor: theme.palette.primary.main,
                    boxShadow: `0 0 0 3px ${theme.palette.primary.light}`
                  }
                }
              }}
              inputProps={{ 
                style: { 
                  fontSize: '1.1rem',
                  padding: '16px 20px',
                  height: '20px',
                  color: theme.palette.text.primary
                } 
              }}
              style={inputStyles.name}
            />
          </Box>

          {/* 新增：测试类型选择 */}
          <Box sx={{ width: '100%' }}>
            <InputLabel sx={{ 
              color: theme.palette.text.secondary,
              fontSize: '1.1rem',
              fontWeight: 500,
              mb: 1,
              pl: 1
            }}>
              测试类型 *
            </InputLabel>
            <FormControl fullWidth>
              <Select
                name="c_type"
                value={formData.c_type}
                onChange={handleTypeChange}
                required
                sx={{ 
                  borderRadius: '8px',
                  border: `2px solid ${theme.palette.divider}`,
                  transition: 'all 0.3s',
                  '&:hover': {
                    borderColor: theme.palette.primary.main,
                  },
                  '&.Mui-focused': {
                    borderColor: theme.palette.primary.main,
                    boxShadow: `0 0 0 3px ${theme.palette.primary.light}`
                  },
                  color: theme.palette.text.primary
                }}
                style={inputStyles.testType}
              >
                <MenuItem value="理论测试" sx={{ fontSize: '1.1rem' }}>理论测试</MenuItem>
                <MenuItem value="实践操作" sx={{ fontSize: '1.1rem' }}>实践操作</MenuItem>
              </Select>
            </FormControl>
          </Box>

          {/* 测试描述 */}
          <Box sx={{ width: '100%' }}>
            <InputLabel sx={{ 
              color: theme.palette.text.secondary,
              fontSize: '1.1rem',
              fontWeight: 500,
              mb: 1,
              pl: 1
            }}>
              测试描述 *
            </InputLabel>
            <TextField
              fullWidth
              variant="outlined"
              name="c_description"
              value={formData.c_description}
              onChange={handleChange}
              multiline
              rows={6}
              required
              sx={{ 
                '& .MuiOutlinedInput-root': {
                  borderRadius: '8px',
                  border: `2px solid ${theme.palette.divider}`,
                  transition: 'all 0.3s',
                  '&:hover': {
                    borderColor: theme.palette.primary.main,
                  },
                  '&.Mui-focused': {
                    borderColor: theme.palette.primary.main,
                    boxShadow: `0 0 0 3px ${theme.palette.primary.light}`
                  }
                }
              }}
              inputProps={{ 
                style: { 
                  fontSize: '1.1rem',
                  padding: '16px 5px',
                  color: theme.palette.text.primary
                } 
              }}
              style={inputStyles.description}
            />
          </Box>

          {/* 试卷数量和课程ID - 条件渲染试卷数量 */}
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            width: '100%',
            gap: '40px'
          }}>
            {/* 试卷数量 - 仅当选择理论测试时显示 */}
            {formData.c_type === '理论测试' && (
              <Box sx={{ flex: 1 }}>
                <InputLabel sx={{ 
                  color: theme.palette.text.secondary,
                  fontSize: '1.1rem',
                  fontWeight: 500,
                  mb: 1,
                  pl: 1
                }}>
                  试卷数量 *
                </InputLabel>
                <FormControl fullWidth>
                  <Select
                    name="c_paper_count"
                    value={formData.c_paper_count}
                    onChange={handlePaperCountChange}
                    required
                    sx={{ 
                      borderRadius: '8px',
                      border: `2px solid ${theme.palette.divider}`,
                      transition: 'all 0.3s',
                      '&:hover': {
                        borderColor: theme.palette.primary.main,
                      },
                      '&.Mui-focused': {
                        borderColor: theme.palette.primary.main,
                        boxShadow: `0 0 0 3px ${theme.palette.primary.light}`
                      },
                      color: theme.palette.text.primary
                    }}
                    style={inputStyles.paperCount}
                  >
                    {[1, 2, 3, 4, 5].map(num => (
                      <MenuItem key={num} value={num} sx={{ 
                        fontSize: '1.1rem',
                        color: theme.palette.text.primary
                      }}>
                        {num}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
            )}
            
            {/* 课程ID - 始终显示 */}
            <Box sx={{ flex: 1 }}>
              <InputLabel sx={{ 
                color: theme.palette.text.secondary,
                fontSize: '1.1rem',
                fontWeight: 500,
                mb: 1,
                pl: 1
              }}>
                课程ID *
              </InputLabel>
              <TextField
                fullWidth
                variant="outlined"
                name="c_course_id"
                value={formData.c_course_id}
                onChange={handleChange}
                required
                sx={{ 
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '8px',
                    border: `2px solid ${theme.palette.divider}`,
                    transition: 'all 0.3s',
                    '&:hover': {
                      borderColor: theme.palette.primary.main,
                    },
                    '&.Mui-focused': {
                      borderColor: theme.palette.primary.main,
                      boxShadow: `0 0 0 3px ${theme.palette.primary.light}`
                    }
                  }
                }}
                inputProps={{ 
                  style: { 
                    fontSize: '1.1rem',
                    padding: '16px 20px',
                    height: '20px',
                    color: theme.palette.text.primary
                  } 
                }}
                style={inputStyles.courseId}
              />
            </Box>
          </Box>

          {/* 开始和结束时间 */}
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            width: '100%',
            gap: '40px'
          }}>
            <LocalizationProvider dateAdapter={AdapterMoment}>
              {/* 开始时间 */}
              <Box sx={{ flex: 1 }}>
                <InputLabel sx={{ 
                  color: theme.palette.text.secondary,
                  fontSize: '1.1rem',
                  fontWeight: 500,
                  mb: 1,
                  pl: 1
                }}>
                  开始时间 *
                </InputLabel>
                <DatePicker
                  value={formData.c_start}
                  onChange={(date) => handleDateChange('c_start', date)}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      variant="outlined"
                      sx={{ 
                        '& .MuiOutlinedInput-root': {
                          borderRadius: '8px',
                          border: `2px solid ${theme.palette.divider}`,
                          transition: 'all 0.3s',
                          '&:hover': {
                            borderColor: theme.palette.primary.main,
                          },
                          '&.Mui-focused': {
                            borderColor: theme.palette.primary.main,
                            boxShadow: `0 0 0 3px ${theme.palette.primary.light}`
                          }
                        }
                      }}
                      inputProps={{ 
                        ...params.inputProps,
                        style: { 
                          fontSize: '1.1rem',
                          padding: '16px 20px',
                          height: '20px',
                          color: theme.palette.text.primary
                        } 
                      }}
                      style={inputStyles.datePicker}
                    />
                  )}
                  inputFormat="YYYY/MM/DD HH:mm"
                />
              </Box>
              
              {/* 结束时间 */}
              <Box sx={{ flex: 1 }}>
                <InputLabel sx={{ 
                  color: theme.palette.text.secondary,
                  fontSize: '1.1rem',
                  fontWeight: 500,
                  mb: 1,
                  pl: 1
                }}>
                  结束时间 *
                </InputLabel>
                <DatePicker
                  value={formData.c_end}
                  onChange={(date) => handleDateChange('c_end', date)}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      variant="outlined"
                      sx={{ 
                        '& .MuiOutlinedInput-root': {
                          borderRadius: '8px',
                          border: `2px solid ${theme.palette.divider}`,
                          transition: 'all 0.3s',
                          '&:hover': {
                            borderColor: theme.palette.primary.main,
                          },
                          '&.Mui-focused': {
                            borderColor: theme.palette.primary.main,
                            boxShadow: `0 0 0 3px ${theme.palette.primary.light}`
                          }
                        }
                      }}
                      inputProps={{ 
                        ...params.inputProps,
                        style: { 
                          fontSize: '1.1rem',
                          padding: '16px 20px',
                          height: '20px',
                          color: theme.palette.text.primary
                        } 
                      }}
                      style={inputStyles.datePicker}
                    />
                  )}
                  inputFormat="YYYY/MM/DD HH:mm"
                />
              </Box>
            </LocalizationProvider>
          </Box>
        </Box>
      </DialogContent>
      
      <DialogActions sx={{ 
        px: 4,
        py: 1.5,
        backgroundColor: theme.palette.background.default,
        borderTop: `1px solid ${theme.palette.divider}`
      }}>
        <Button 
          onClick={onClose} 
          variant="outlined" 
          sx={{ 
            borderRadius: '8px', 
            textTransform: 'none', 
            px: 6,
            py: 1,
            fontSize: '1.1rem',
            fontWeight: 500,
            color: theme.palette.primary.main,
            borderColor: theme.palette.primary.main,
            borderWidth: '2px',
            minWidth: '120px',
            '&:hover': {
              backgroundColor: theme.palette.primary.light,
              borderWidth: '2px'
            }
          }}
        >
          取消
        </Button>
        <Button 
          onClick={handleSubmit} 
          variant="contained"
          sx={{ 
            borderRadius: '8px', 
            textTransform: 'none', 
            px: 6,
            py: 1,
            fontSize: '1.1rem',
            fontWeight: 500,
            backgroundColor: theme.palette.primary.main,
            color: theme.palette.primary.contrastText,
            minWidth: '120px',
            boxShadow: theme.shadows[4],
            '&:hover': {
              backgroundColor: theme.palette.primary.dark,
              boxShadow: theme.shadows[6]
            }
          }}
        >
          保存测试
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default FixedSizeFormDialog;