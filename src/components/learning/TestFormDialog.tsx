import React, { useState } from 'react';
import { 
  Dialog, DialogTitle, DialogContent, DialogActions, 
  Button, TextField, FormControl, InputLabel, 
  Select, MenuItem, Box, useTheme, Alert 
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterMoment } from '@mui/x-date-pickers/AdapterMoment';
import moment from 'moment';

// 定义测试数据接口类型，与后端字段对应
interface TestData {
  c_id?: string;
  c_name: string;
  c_description: string;
  c_test_type: string; // 理论测试/实践操作
  c_type: string; // 考试/练习
  c_paper_count: number;
  c_course_id: string;
  c_start: moment.Moment | null;
  c_end: moment.Moment | null;
  c_create_at?: string;
}

interface FixedSizeFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (testData: TestData) => Promise<boolean>;
  test: TestData | null;
}

const FixedSizeFormDialog: React.FC<FixedSizeFormDialogProps> = ({ open, onClose, onSave, test }) => {
  const theme = useTheme();
  const [error, setError] = useState<string | null>(null);

  // 初始化表单数据，严格匹配TestData接口
  const [formData, setFormData] = useState<TestData>({
    c_name: test?.c_name || '',
    c_description: test?.c_description || '',
    c_paper_count: test?.c_paper_count || 1,
    c_course_id: test?.c_course_id || '',
    c_start: test?.c_start || null,
    c_end: test?.c_end || null,
    c_test_type: test?.c_test_type || '理论测试', // 理论测试/实践操作
    c_type: test?.c_type || '考试' // 考试/练习
  });

  // 处理输入字段变化
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | { name?: string; value: unknown }>) => {
    const { name, value } = e.target;
    if (name) {
      setFormData(prev => ({ ...prev, [name]: value }));
      setError(null); // 清除错误提示
    }
  };

  // 处理试卷数量变化（手动输入处理）
  const handlePaperCountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // 只允许输入数字
    const value = e.target.value.replace(/[^0-9]/g, '');
    setFormData(prev => ({ 
      ...prev, 
      c_paper_count: value ? Number(value) : 0 
    }));
    setError(null);
  };

  // 处理日期变化
  const handleDateChange = (name: 'c_start' | 'c_end', date: moment.Moment | null) => {
    setFormData(prev => ({ ...prev, [name]: date }));
    setError(null);
  };

  // 处理测试类型变化（理论测试/实践操作）
  const handleTestTypeChange = (e: React.ChangeEvent<{ name?: string; value: unknown }>) => {
    const value = e.target.value as string;
    setFormData(prev => ({ 
      ...prev, 
      c_test_type: value,
      // 实践操作默认1张试卷且不可修改
      ...(value === '实践操作' && { c_paper_count: 1 })
    }));
    setError(null);
  };

  // 处理测试模式变化（考试/练习）
  const handleTestModeChange = (e: React.ChangeEvent<{ name?: string; value: unknown }>) => {
    const value = e.target.value as string;
    setFormData(prev => ({ ...prev, c_type: value }));
    setError(null);
  };

  // 表单验证
  const validateForm = (): boolean => {
    // 清除之前的错误
    setError(null);

    // 验证必填字段
    if (!formData.c_name.trim()) {
      setError('请输入测试名称');
      return false;
    }

    if (!formData.c_description.trim()) {
      setError('请输入测试描述');
      return false;
    }

    if (!formData.c_course_id.trim()) {
      setError('请输入课程ID');
      return false;
    }

    if (!formData.c_start) {
      setError('请选择开始时间');
      return false;
    }

    if (!formData.c_end) {
      setError('请选择结束时间');
      return false;
    }

    // 验证时间逻辑
    const now = moment();
    if (formData.c_start.isBefore(now, 'minute')) {
      setError('开始时间不能早于当前时间');
      return false;
    }

    if (formData.c_end.isBefore(formData.c_start, 'minute')) {
      setError('结束时间不能早于开始时间');
      return false;
    }

    // 理论测试验证试卷数量（手动输入验证）
    if (formData.c_test_type === '理论测试') {
      if (formData.c_paper_count < 1) {
        setError('试卷数量必须至少为1');
        return false;
      }
      if (formData.c_paper_count > 100) { // 增加上限限制，可根据需求调整
        setError('试卷数量不能超过100');
        return false;
      }
    }

    return true;
  };

  // 提交表单
  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    // 调用父组件的保存方法
    const success = await onSave(formData);
    if (success) {
      onClose();
    }
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
        maxHeight: '70vh',
        overflowY: 'auto'
      }}>
        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
        
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
            />
          </Box>

          {/* 测试类型选择（理论测试/实践操作） */}
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
                name="c_test_type"
                value={formData.c_test_type}
                onChange={handleTestTypeChange}
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
              >
                <MenuItem value="理论测试" sx={{ fontSize: '1.1rem' }}>理论测试</MenuItem>
                <MenuItem value="实践操作" sx={{ fontSize: '1.1rem' }}>实践操作</MenuItem>
              </Select>
            </FormControl>
          </Box>

          {/* 测试模式选择（考试/练习） */}
          <Box sx={{ width: '100%' }}>
            <InputLabel sx={{ 
              color: theme.palette.text.secondary,
              fontSize: '1.1rem',
              fontWeight: 500,
              mb: 1,
              pl: 1
            }}>
              测试模式 *
            </InputLabel>
            <FormControl fullWidth>
              <Select
                name="c_type"
                value={formData.c_type}
                onChange={handleTestModeChange}
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
              >
                <MenuItem value="考试" sx={{ fontSize: '1.1rem' }}>考试</MenuItem>
                <MenuItem value="练习" sx={{ fontSize: '1.1rem' }}>练习</MenuItem>
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
            />
          </Box>

          {/* 试卷数量和课程ID */}
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            width: '100%',
            gap: '40px',
            flexWrap: 'wrap'
          }}>
            {/* 试卷数量 - 手动输入框 */}
            {formData.c_test_type === '理论测试' && (
              <Box sx={{ flex: 1, minWidth: '250px' }}>
                <InputLabel sx={{ 
                  color: theme.palette.text.secondary,
                  fontSize: '1.1rem',
                  fontWeight: 500,
                  mb: 1,
                  pl: 1
                }}>
                  试卷数量 *
                  <span sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>
                    （1-100之间的整数）
                  </span>
                </InputLabel>
                <TextField
                  fullWidth
                  variant="outlined"
                  name="c_paper_count"
                  type="text" // 使用text类型配合输入过滤
                  value={formData.c_paper_count || ''}
                  onChange={handlePaperCountChange}
                  inputProps={{ 
                    style: { 
                      fontSize: '1.1rem',
                      padding: '16px 20px',
                      height: '20px',
                      color: theme.palette.text.primary
                    },
                    inputMode: 'numeric', // 移动端显示数字键盘
                    pattern: '[0-9]*' // HTML5数字验证
                  }}
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
                  placeholder="请输入试卷数量"
                />
              </Box>
            )}
            
            {/* 课程ID */}
            <Box sx={{ flex: 1, minWidth: '250px' }}>
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
              />
            </Box>
          </Box>

          {/* 开始和结束时间 */}
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            width: '100%',
            gap: '40px',
            flexWrap: 'wrap'
          }}>
            <LocalizationProvider dateAdapter={AdapterMoment}>
              {/* 开始时间 */}
              <Box sx={{ flex: 1, minWidth: '250px' }}>
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
                    />
                  )}
                  inputFormat="YYYY/MM/DD HH:mm"
                  minDate={moment().add(1, 'minute')} // 至少从当前时间1分钟后开始
                />
              </Box>
              
              {/* 结束时间 */}
              <Box sx={{ flex: 1, minWidth: '250px' }}>
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
                    />
                  )}
                  inputFormat="YYYY/MM/DD HH:mm"
                  minDate={formData.c_start ? formData.c_start.add(1, 'minute') : moment().add(2, 'minutes')}
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
