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
  // 获取主题对象
  const theme = useTheme();
  
  // 表单状态管理
  const [formData, setFormData] = useState({
    c_name: test?.c_name || '',
    c_description: test?.c_description || '',
    c_paper_count: test?.c_paper_count || 1,
    c_course_id: test?.c_course_id || '',
    c_start: test ? moment(test.c_start) : null,
    c_end: test ? moment(test.c_end) : null,
  });

  // 手动设置输入框尺寸（仅保留尺寸相关，移除颜色硬编码）
  const inputStyles = {
    name: { width: '800px', height: '60px' },
    description: { width: '800px', height: '200px' },
    paperCount: { width: '380px', height: '60px' },
    courseId: { width: '380px', height: '60px' },
    datePicker: { width: '380px', height: '60px' },
  };

  // 表单处理函数
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

  const handleSubmit = () => {
    if (!formData.c_name || !formData.c_description || !formData.c_paper_count || 
        !formData.c_course_id || !formData.c_start || !formData.c_end) {
      alert('请填写所有必填字段');
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
          // 使用主题背景色（深浅模式自动切换）
          backgroundColor: theme.palette.background.paper,
          borderRadius: '12px',
          width: '900px',
          maxWidth: '90vw',
          // 阴影使用主题 elevation
          boxShadow: theme.shadows[5],
          overflow: 'hidden'
        }
      }}
    >
      <DialogTitle sx={{ 
        // 使用主题主色作为背景
        backgroundColor: theme.palette.primary.main,
        // 文本色使用主题主色对应的对比色（确保可读性）
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
        // 使用主题次要背景色
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
          // 卡片背景使用主题纸张色
          backgroundColor: theme.palette.background.paper,
          borderRadius: '10px',
          boxShadow: theme.shadows[3]
        }}>
          {/* 测试名称 */}
          <Box sx={{ width: '100%' }}>
            <InputLabel sx={{ 
              // 标签色使用主题文本次要色
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
                  // 边框色使用主题边框色
                  border: `2px solid ${theme.palette.divider}`,
                  transition: 'all 0.3s',
                  '&:hover': {
                    //  hover边框色使用主题主色
                    borderColor: theme.palette.primary.main,
                  },
                  '&.Mui-focused': {
                    borderColor: theme.palette.primary.main,
                    // 聚焦时阴影使用主色透明效果
                    boxShadow: `0 0 0 3px ${theme.palette.primary.light}`
                  }
                }
              }}
              inputProps={{ 
                style: { 
                  fontSize: '1.1rem',
                  padding: '16px 20px',
                  height: '20px',
                  // 输入文本色使用主题主要文本色
                  color: theme.palette.text.primary
                } 
              }}
              style={inputStyles.name}
            />
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

          {/* 试卷数量和课程ID */}
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            width: '100%',
            gap: '40px'
          }}>
            {/* 试卷数量 */}
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
                    // 选项文本色
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
            
            {/* 课程ID */}
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
            // 边框和文本色使用主题主色
            color: theme.palette.primary.main,
            borderColor: theme.palette.primary.main,
            borderWidth: '2px',
            minWidth: '120px',
            '&:hover': {
              // hover背景使用主色透明效果
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
            // 背景色使用主题主色
            backgroundColor: theme.palette.primary.main,
            // 文本色使用主色对比色
            color: theme.palette.primary.contrastText,
            minWidth: '120px',
            // 阴影使用主题主色阴影
            boxShadow: theme.shadows[4],
            '&:hover': {
              // hover背景使用主色深色
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