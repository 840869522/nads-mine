import React, { useState, useEffect } from 'react';
import { 
  Dialog, DialogTitle, DialogContent, DialogActions, 
  Button, TextField, FormControl, InputLabel, 
  Select, MenuItem, Box, useTheme, Alert,
  FormHelperText, InputAdornment, Chip,
  IconButton, Typography
} from '@mui/material';
import { Autocomplete } from '@mui/material';
import { 
  Close as CloseIcon,
  CloudUpload as CloudUploadIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterMoment } from '@mui/x-date-pickers/AdapterMoment';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import moment from 'moment';
import { apiClientWithToken } from "@/utils/axios";

// 定义测试数据接口类型
interface TestData {
  c_id?: string; 
  c_name: string;
  c_description: string;
  c_test_type: string; // 理论测试/实验
  c_type: string; // 考试/练习
  c_paper_count: number;
  c_course_id: string;
  c_start: string | null; // 存储字符串格式
  c_end: string | null;   // 存储字符串格式
  c_duration?: number; // 测试时长（分钟）
  c_create_at?: string;
  c_scene_config_id?: number;
  c_scene_name?: string;
}

interface SceneConfig {
  c_config_id: number;
  c_name: string;
  c_description?: string;
}

interface Course {
  c_course_id: string;
  c_course_name: string;
}

interface UploadedFile {
  id: string;
  name: string;
  size: string;
  type: string;
  file: File;
}

interface TestFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (testData: TestData, files?: File[]) => Promise<boolean>;
  test: TestData | null;
  sceneConfigs: SceneConfig[];
}

const TestFormDialog: React.FC<TestFormDialogProps> = ({ open, onClose, onSave, test, sceneConfigs }) => {
  const theme = useTheme();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [courses, setCourses] = useState<Course[]>([]); // 初始化为空数组
  
  // 专门用于前端展示和处理的Moment对象
  const [startDate, setStartDate] = useState<moment.Moment | null>(null);
  const [endDate, setEndDate] = useState<moment.Moment | null>(null);

  // 表单数据，日期存储为字符串
  const [formData, setFormData] = useState<TestData>({
    c_name: '',
    c_description: '',
    c_paper_count: 1,
    c_course_id: '',
    c_start: null,
    c_end: null,
    c_test_type: '理论测试',
    c_type: '考试',
    c_duration: 60,
    c_scene_config_id: undefined
  });

 // 获取课程列表
  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const response = await apiClientWithToken.get('/back/api/study/test/getCourses');
        if (response.data.code === 200) {
          // 确保设置为数组，即使后端返回空数据
          setCourses(Array.isArray(response.data.data) ? response.data.data : []);
        } else {
          setCourses([]); // 后端返回非200时设置为空数组
          setError('获取课程列表失败');
        }
      } catch (error) {
        setCourses([]); // 错误时设置为空数组
        setError('获取课程列表失败');
      }
    };
    if (open) {
      fetchCourses();
    }
  }, [open]);

  // 处理基础输入变化
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | { name?: string; value: unknown }>) => {
    const { name, value } = e.target;
    if (name) {
      setFormData(prev => ({ ...prev, [name]: value }));
      setError(null);
    }
  };

  // 处理试卷数量变化
  const handlePaperCountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9]/g, '');
    setFormData(prev => ({ 
      ...prev, 
      c_paper_count: value ? Number(value) : 0 
    }));
    setError(null);
  };

  // 处理测试时长变化
  const handleDurationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9]/g, '');
    setFormData(prev => ({ 
      ...prev, 
      c_duration: value ? Number(value) : 0 
    }));
    setError(null);
  };

  // 处理测试类型变化
  const handleTestTypeChange = (e: React.ChangeEvent<{ name?: string; value: unknown }>) => {
    const value = e.target.value as string;
    setFormData(prev => ({ 
      ...prev, 
      c_test_type: value,
      ...(value === '实验' && { c_paper_count: 1, c_type: '' }),
      ...(value !== '实验' && !prev.c_type && { c_type: '考试' })
    }));
    setError(null);
  };

  // 处理测试模式变化
  const handleTestModeChange = (e: React.ChangeEvent<{ name?: string; value: unknown }>) => {
    const value = e.target.value as string;
    setFormData(prev => ({ ...prev, c_type: value }));
    setError(null);
  };

  // 处理场景配置变化
  const handleSceneConfigChange = (e: React.ChangeEvent<{ name?: string; value: unknown }>) => {
    const value = e.target.value as number;
    setFormData(prev => ({ 
      ...prev, 
      c_scene_config_id: value
    }));
    setError(null);
  };

  // 处理课程变化
  const handleCourseChange = (event: React.SyntheticEvent, newValue: Course | null) => {
    setFormData(prev => ({
      ...prev,
      c_course_id: newValue ? newValue.c_course_id : ''
    }));
    setError(null);
  };

  // 处理文件批量上传
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;
    
    const newFiles = Array.from(files).map(file => ({
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      file,
      name: file.name,
      size: `${(file.size / (1024 * 1024)).toFixed(2)} MB`
    }));
    
    setUploadedFiles(prev => [...prev, ...newFiles]);
    event.target.value = ''; // 重置文件输入
  };

  // 处理文件删除
  const handleFileDelete = (id: string) => {
    setUploadedFiles(prev => prev.filter(file => file.id !== id));
  };

  // 处理开始日期变化
const handleStartDateChange = (date: moment.Moment | null) => {
  setStartDate(date);
  // 同时更新表单数据为字符串格式
  setFormData(prev => ({
    ...prev,
    c_start: date ? date.format('YYYY-MM-DD HH:mm:ss') : null
  }));
  
  // 如果选择了新的开始日期且结束日期早于开始日期，则自动调整结束日期
  if (date && endDate && endDate.isBefore(date)) {
    const newEndDate = date.clone().add(1, 'hour');
    setEndDate(newEndDate);
    setFormData(prev => ({
      ...prev,
      c_end: newEndDate.format('YYYY-MM-DD HH:mm:ss')
    }));
  }
  setError(null);
};

// 处理结束日期变化
const handleEndDateChange = (date: moment.Moment | null) => {
  setEndDate(date);
  // 同时更新表单数据为字符串格式
  setFormData(prev => ({
    ...prev,
    c_end: date ? date.format('YYYY-MM-DD HH:mm:ss') : null
  }));
  setError(null);
};

  // 表单验证
  const validateForm = (): boolean => {
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
      setError('请选择课程');
      return false;
    }

    // 非实验类型才需要验证测试模式
    if (formData.c_test_type !== '实验' && !formData.c_type) {
      setError('请选择测试模式');
      return false;
    }

    if (!startDate) {
      setError('请选择开始时间');
      return false;
    }

    if (!endDate) {
      setError('请选择结束时间');
      return false;
    }

    // 时间逻辑验证 - 只保留结束时间不能早于开始时间的检查
      if (endDate.isBefore(startDate, 'minute')) {
        setError('结束时间不能早于开始时间');
        return false;
      }

    // 考试类型必须填写时长
    if (formData.c_test_type === '理论测试' && formData.c_type === '考试') {
      if (formData.c_duration === undefined || formData.c_duration <= 0) {
        setError('请输入有效的测试时长（大于0的整数）');
        return false;
      }
      
      if (formData.c_duration > 300) {
        setError('测试时长不能超过300分钟');
        return false;
      }
    }

      // 考试类型必须填写时长
  if (formData.c_test_type === '理论测试' && formData.c_type === '考试') {
    // 安全检查：确保 c_duration 存在且是有效数字
    const duration = formData.c_duration || 0;
    
    if (duration <= 0) {
      setError('请输入有效的测试时长（大于0的整数）');
      return false;
    }
    
    if (duration > 300) {
      setError('测试时长不能超过300分钟');
      return false;
    }

    // 新增：验证测试时长是否小于等于实际可用时间
    if (startDate && endDate) {
      const availableMinutes = endDate.diff(startDate, 'minutes');
      if (duration > availableMinutes) {
        setError(`测试时长不能超过实际可用时间。实际可用时间：${availableMinutes}分钟`);
        return false;
      }
    }
  }

    // 实验类型验证场景配置
    if (formData.c_test_type === '实验') {
      if (!formData.c_scene_config_id || formData.c_scene_config_id <= 0) {
        setError('请选择场景配置');
        return false;
      }
    }

    // 理论测试验证试卷数量
    if (formData.c_test_type === '理论测试') {
      if (formData.c_paper_count < 1) {
        setError('试卷数量必须至少为1');
        return false;
      }
      if (formData.c_paper_count > 100) {
        setError('试卷数量不能超过100');
        return false;
      }
    }

    return true;
  };

  // 提交表单
  const handleSubmit = async () => {
    if (submitting) return; // 防止重复提交
    if (!validateForm()) return;

    try {
      setSubmitting(true);
      // 准备提交数据 - 此时c_start和c_end已经是正确格式的字符串
      const submitData: TestData = { ...formData };
      
      
      // 如果是新增测试，移除c_id字段
      if (!test) {
        delete submitData.c_id;
      };
      

      // 提取文件对象
      const files = uploadedFiles.map(file => file.file);
      
      const success = await onSave(submitData, files.length > 0 ? files : undefined);
      if (success) {
        onClose();
      } else {
        setError('更新测试失败：服务器返回未知错误');
      }
    } catch (err) {

      setError(`更新测试失败: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSubmitting(false);
    }
  };

  // 初始化表单数据
  useEffect(() => {
    
    if (open && test) {
      // 初始化日期 - 确保转换为Moment对象
      const initStartDate = test.c_start ? moment(test.c_start) : null;
      const initEndDate = test.c_end ? moment(test.c_end) : null;
      
      setStartDate(initStartDate);
      setEndDate(initEndDate);
      
      // 初始化表单数据
      const initialFormData = {
        c_id: test.c_id || undefined, // 新增测试时不包含c_id
        c_name: test.c_name || '',
        c_description: test.c_description || '',
        c_paper_count: test.c_paper_count || 1,
        c_course_id: test.c_course_id || '',
        c_start: test.c_start || null,
        c_end: test.c_end || null,
        c_test_type: test.c_test_type || '理论测试',
        c_type: test.c_test_type === '实验' ? '' : (test.c_type || '考试'),
        c_duration: test.c_test_type === '实验' ? undefined : (test.c_duration || 60),
        c_scene_config_id: test.c_scene_config_id
      };
      
      setFormData(initialFormData);
      
      // 如果有测试ID，获取已上传的文件
      if (test.c_id) {
        fetchUploadedFiles(test.c_id);
      }
    } else if (open) {
      // 新增测试时的初始化
      setStartDate(null);
      setEndDate(null);
      setUploadedFiles([]);
      setFormData({
        c_name: '',
        c_description: '',
        c_paper_count: 1,
        c_course_id: '',
        c_start: null,
        c_end: null,
        c_test_type: '理论测试',
        c_type: '考试',
        c_duration: undefined,
        c_scene_config_id: undefined
      });
    }
    setError(null);
    setSubmitting(false);
  }, [open, test]);

  // 获取已上传的文件
  const fetchUploadedFiles = async (testId: string) => {
    try {
      const response = await apiClientWithToken.get(`/back/api/study/test/${testId}/resources`);
      if (response.data.code === 200) {
        const files = response.data.data.map((file: any) => ({
          id: file.id,
          name: file.name,
          size: file.size,
          type: file.type,
          file: null as unknown as File // 后端返回的文件信息，不是真正的File对象
        }));
        setUploadedFiles(files);
      }
    } catch (error) {
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
      disabled={submitting}
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
        <IconButton
          aria-label="close"
          onClick={onClose}
          sx={{
            position: 'absolute',
            right: 8,
            top: 8,
            color: theme.palette.primary.contrastText,
          }}
        >
          <CloseIcon />
        </IconButton>
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
              disabled={submitting}
              sx={{ 
                '& .MuiOutlinedInput-root': {
                  borderRadius: '8px',
                  border: `2px solid ${theme.palette.divider}`,
                }
              }}
              inputProps={{ 
                style: { 
                  fontSize: '1.1rem',
                  padding: '16px 20px',
                  height: '20px'
                } 
              }}
            />
          </Box>

          {/* 测试类型选择 */}
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
                disabled={submitting}
                sx={{ 
                  borderRadius: '8px',
                  border: `2px solid ${theme.palette.divider}`,
                }}
              >
                <MenuItem value="理论测试" sx={{ fontSize: '1.1rem' }}>理论测试</MenuItem>
                <MenuItem value="实验" sx={{ fontSize: '1.1rem' }}>实验</MenuItem>
              </Select>
            </FormControl>
          </Box>

          {/* 测试模式选择 - 仅在非实验类型显示 */}
          {formData.c_test_type !== '实验' && (
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
                  disabled={submitting}
                  sx={{ 
                    borderRadius: '8px',
                    border: `2px solid ${theme.palette.divider}`,
                  }}
                >
                  <MenuItem value="考试" sx={{ fontSize: '1.1rem' }}>考试</MenuItem>
                  <MenuItem value="练习" sx={{ fontSize: '1.1rem' }}>练习</MenuItem>
                </Select>
              </FormControl>
            </Box>
          )}

          {/* 场景配置选择 - 仅在实验类型显示 */}
          {formData.c_test_type === '实验' && (
            <Box sx={{ width: '100%' }}>
              <InputLabel sx={{ 
                color: theme.palette.text.secondary,
                fontSize: '1.1rem',
                fontWeight: 500,
                mb: 1,
                pl: 1
              }}>
                场景配置 *
              </InputLabel>
              <Autocomplete
                options={sceneConfigs}
                getOptionLabel={(option) => option.c_name}
                getOptionKey={(option) => option.c_config_id}
                value={sceneConfigs.find(config => config.c_config_id === formData.c_scene_config_id) || null}
                onChange={(event, newValue) => {
                  handleSceneConfigChange({
                    target: {
                      name: 'c_scene_config_id',
                      value: newValue ? newValue.c_config_id : ''
                    }
                  });
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    placeholder="搜索或选择场景配置"
                    variant="outlined"
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: '8px',
                        border: `2px solid ${theme.palette.divider}`,
                      }
                    }}
                  />
                )}
                renderOption={(props, option) => (
                  <li {...props} style={{ padding: '12px 16px' }}>
                    <div style={{ width: '100%' }}>
                      <div style={{ 
                        fontSize: '1.1rem', 
                        fontWeight: 500,
                        color: theme.palette.text.primary 
                      }}>
                        {option.c_name}
                      </div>
                      {option.c_description && (
                        <div style={{ 
                          fontSize: '0.9rem', 
                          color: theme.palette.text.secondary,
                          marginTop: '4px'
                        }}>
                          {option.c_description}
                        </div>
                      )}
                    </div>
                  </li>
                )}
                disabled={submitting}
                noOptionsText="未找到匹配的场景配置"
                loading={!sceneConfigs.length}
                loadingText="加载中..."
                sx={{ width: '100%' }}
              />
            </Box>
          )}

          {/* 测试时长 - 只在考试模式的理论测试下显示，实验类型不显示 */}
              {formData.c_test_type === '理论测试' && formData.c_type === '考试' && (
                <Box sx={{ width: '100%' }}>
                  <InputLabel sx={{ 
                    color: theme.palette.text.secondary,
                    fontSize: '1.1rem',
                    fontWeight: 500,
                    mb: 1,
                    pl: 1
                  }}>
                    测试时长（分钟） *
                    <span style={{ fontSize: '0.8rem', color: theme.palette.text.secondary }}>
                      （1-300之间的整数）
                    </span>
                  </InputLabel>
                  <TextField
                    fullWidth
                    variant="outlined"
                    name="c_duration"
                    type="text"
                    value={formData.c_duration || ''}
                    onChange={handleDurationChange}
                    disabled={submitting}
                    inputProps={{ 
                      style: { 
                        fontSize: '1.1rem',
                        padding: '16px 20px',
                        height: '20px'
                      },
                      inputMode: 'numeric'
                    }}
                    sx={{ 
                      '& .MuiOutlinedInput-root': {
                        borderRadius: '8px',
                        border: `2px solid ${theme.palette.divider}`,
                      }
                    }}
                    placeholder="请输入测试时长（分钟）"
                  />
                </Box>
              )}

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
              disabled={submitting}
              multiline
              rows={4}
              sx={{ 
                '& .MuiOutlinedInput-root': {
                  borderRadius: '8px',
                  border: `2px solid ${theme.palette.divider}`,
                }
              }}
            />
          </Box>

          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            width: '100%',
            gap: '40px',
            flexWrap: 'wrap'
          }}>
            {/* 试卷数量 - 仅在理论测试显示 */}
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
                </InputLabel>
                <TextField
                  fullWidth
                  variant="outlined"
                  name="c_paper_count"
                  type="text"
                  value={formData.c_paper_count || ''}
                  onChange={handlePaperCountChange}
                  disabled={submitting}
                  inputProps={{ 
                    style: { 
                      fontSize: '1.1rem',
                      padding: '16px 20px',
                      height: '20px'
                    },
                    inputMode: 'numeric'
                  }}
                  sx={{ 
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '8px',
                      border: `2px solid ${theme.palette.divider}`,
                    }
                  }}
                />
              </Box>
            )}
            
            <Box sx={{ flex: 1, minWidth: '250px' }}>
              <InputLabel sx={{ 
                color: theme.palette.text.secondary,
                fontSize: '1.1rem',
                fontWeight: 500,
                mb: 1,
                pl: 1
              }}>
                课程名称 *
              </InputLabel>
              <Autocomplete
                options={courses}
                getOptionLabel={(option) => option.c_course_name}
                getOptionKey={(option) => option.c_course_id}
                value={courses.find(course => course.c_course_id === formData.c_course_id) || null}
                onChange={handleCourseChange}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    placeholder="搜索或选择课程"
                    variant="outlined"
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: '8px',
                        border: `2px solid ${theme.palette.divider}`,
                      }
                    }}
                  />
                )}
                renderOption={({ key, ...restProps }, option) => (
                  <li key={key} {...restProps} style={{ padding: '12px 16px' }}>
                    <div style={{ width: '100%' }}>
                      <div style={{ 
                        fontSize: '1.1rem', 
                        fontWeight: 500,
                        color: theme.palette.text.primary 
                      }}>
                        {option.c_course_name}
                      </div>
                    </div>
                  </li>
                )}
                disabled={submitting}
                noOptionsText="未找到匹配的课程"
                loading={!courses.length}
                loadingText="加载中..."
                sx={{ width: '100%' }}
              />
            </Box>
          </Box>

            <Box sx={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                width: '100%',
                gap: '40px',
                flexWrap: 'wrap'
              }}>
                <LocalizationProvider dateAdapter={AdapterMoment}>
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
                    <DateTimePicker
                      value={startDate}
                      onChange={handleStartDateChange}
                      disabled={submitting}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          variant="outlined"
                          sx={{ 
                            '& .MuiOutlinedInput-root': {
                              borderRadius: '8px',
                              border: `2px solid ${theme.palette.divider}`,
                            }
                          }}
                        />
                      )}
                      inputFormat="YYYY/MM/DD HH:mm"
                    />
                  </Box>
                  
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
                    <DateTimePicker
                      value={endDate}
                      onChange={handleEndDateChange}
                      disabled={submitting}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          variant="outlined"
                          sx={{ 
                            '& .MuiOutlinedInput-root': {
                              borderRadius: '8px',
                              border: `2px solid ${theme.palette.divider}`,
                            }
                          }}
                        />
                      )}
                      inputFormat="YYYY/MM/DD HH:mm"
                      minDate={startDate ? startDate.clone().add(1, 'minute') : moment().add(2, 'minutes')}
                    />
                  </Box>
                </LocalizationProvider>
              </Box>

          {/* 资源上传 - 仅在实验类型显示 */}
          {formData.c_test_type === '实验' && (
            <Box sx={{ width: '100%' }}>
              <InputLabel sx={{ 
                color: theme.palette.text.secondary,
                fontSize: '1.1rem',
                fontWeight: 500,
                mb: 1,
                pl: 1
              }}>
                实验资源（可选）
              </InputLabel>
              <Box sx={{ 
                border: `2px dashed ${theme.palette.divider}`,
                borderRadius: '8px',
                p: 2,
                textAlign: 'center'
              }}>
                <Button
                  variant="outlined"
                  component="label"
                  startIcon={<CloudUploadIcon />}
                  disabled={submitting}
                >
                  选择文件上传
                  <input
                    type="file"
                    hidden
                    multiple
                    onChange={handleFileUpload}
                  />
                </Button>
                
                {uploadedFiles.length > 0 && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      已选择文件:
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                      {uploadedFiles.map((file) => (
                        <Chip
                          key={file.id}
                          label={`${file.name} (${file.size})`}
                          onDelete={() => handleFileDelete(file.id)}
                          variant="outlined"
                        />
                      ))}
                    </Box>
                  </Box>
                )}
              </Box>
            </Box>
          )}
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
          disabled={submitting}
          sx={{ 
            borderRadius: '8px', 
            textTransform: 'none', 
            px: 6,
            py: 1,
          }}
        >
          取消
        </Button>
        <Button 
          onClick={handleSubmit} 
          variant="contained"
          disabled={submitting}
          sx={{ 
            borderRadius: '8px', 
            textTransform: 'none', 
            px: 6,
            py: 1,
          }}
        >
          {submitting ? '保存中...' : '保存测试'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default TestFormDialog;