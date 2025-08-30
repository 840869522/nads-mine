"use client";

import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Button,
  Typography,
  Paper,
  IconButton,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Tooltip,
  Alert as MuiAlert,
  TextField,
  InputAdornment,
  useTheme,
  Checkbox,
  Switch,
  FormControlLabel,
  Menu,
  MenuItem,
  CircularProgress,
  LinearProgress,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import DeleteIcon from '@mui/icons-material/Delete';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import RefreshIcon from '@mui/icons-material/Refresh';
import ViewColumnIcon from '@mui/icons-material/ViewColumn';
import SearchIcon from '@mui/icons-material/Search';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DownloadIcon from '@mui/icons-material/Download';
import CloseIcon from '@mui/icons-material/Close';
import { ManagedImage } from '@/types';
import ImageFormModal from '@/components/imagemanagement/ImageFormModal';
import CreateContainerModal from '@/components/scenario/CreateContainerModal';
import { useAuth } from '@/hooks/useAuth';
import dayjs from 'dayjs';
import { customFetch } from '@/utils/fetch';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

const API_BASE = '/back/api';

const ImageManagementPage: React.FC = () => {
  const { user } = useAuth();
  const theme = useTheme();
  const [images, setImages] = useState<ManagedImage[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingImage, setEditingImage] = useState<ManagedImage | null>(null);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [imageToDelete, setImageToDelete] = useState<ManagedImage | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [createModalImage, setCreateModalImage] = useState<string | null>(null);

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [showColumns, setShowColumns] = useState({ size: true, uploadDate: true });
  const [columnAnchorEl, setColumnAnchorEl] = useState<null | HTMLElement>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  interface TransferTask {
    id: string;
    name: string;
    progress: number;
    controller: AbortController;
  }
  const [uploadTasks, setUploadTasks] = useState<TransferTask[]>([]);
  const [downloadTasks, setDownloadTasks] = useState<TransferTask[]>([]);

  const fetchImages = async () => {
    if (!user) return;
    try {
      const res = await customFetch(`${API_BASE}/images`);
      if (!res.ok) throw new Error('fetch failed');
      const data = await res.json();
      setImages(data);
      setFetchError(null);
    } catch {
      setImages([]);
      setFetchError('无法连接到Docker后端。');
    }
  };

  useEffect(() => { fetchImages(); }, [user]);

  const handleOpenModal = () => {
    setEditingImage(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingImage(null);
  };

  const handleSaveImage = (image: ManagedImage) => {
    if (!user) return;
    if (editingImage) {
      customFetch(`${API_BASE}/images`, { method: 'PUT', body: JSON.stringify(image) }).then(() => {
        setImages(prevImages => prevImages.map(img => (img.id === image.id ? image : img)));
      });
    } else {
      customFetch(`${API_BASE}/images`, { method: 'POST', body: JSON.stringify(image) })
          .then(res => res.json())
          .then(data => setImages(prevImages => [...prevImages, { ...image, id: data.id }]));
    }
    handleCloseModal();
  };

  const handleOpenConfirmDialog = (image: ManagedImage) => {
    setImageToDelete(image);
    setIsConfirmDialogOpen(true);
  };

  const handleCloseConfirmDialog = () => {
    setImageToDelete(null);
    setIsConfirmDialogOpen(false);
  };

  const handleDeleteImage = async () => {
    if (!user || !imageToDelete) return;
    const id = imageToDelete.id;
    const q = `?id=${id}`;
    await customFetch(`${API_BASE}/images${q}`, { method: 'DELETE' });
    await fetchImages();
    handleCloseConfirmDialog();
  };

  const handleStart = (image: ManagedImage) => {
    setCreateModalImage(`${image.name}:${image.version}`);
  };

  const handleRefresh = () => {
    setIsLoading(true);
    fetchImages().finally(() => setIsLoading(false));
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value.toLowerCase());
    setPage(0);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      const formData = new FormData();
      formData.append('file', file);
      const controller = new AbortController();
      const id = uuidv4();
      setUploadTasks(prev => [...prev, { id, name: file.name, progress: 0, controller }]);
      axios.post('/api/images/import', formData, {
        signal: controller.signal,
        onUploadProgress: ev => {
          if (ev.total) {
            setUploadTasks(prev => prev.map(t => t.id === id ? { ...t, progress: Math.round((ev.loaded * 100) / ev.total) } : t));
          }
        }
      }).then(() => {
        fetchImages();
      }).catch(() => {
        /* ignore errors */
      }).finally(() => {
        setUploadTasks(prev => prev.filter(t => t.id !== id));
      });
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const cancelUpload = (id: string) => {
    setUploadTasks(prev => {
      const task = prev.find(t => t.id === id);
      if (task) task.controller.abort();
      return prev.filter(t => t.id !== id);
    });
  };

  const handleExport = (image: ManagedImage) => {
    const controller = new AbortController();
    const id = uuidv4();
    const filename = `${image.name}-${image.version}.tar`;
    setDownloadTasks(prev => [...prev, { id, name: filename, progress: 0, controller }]);
    axios.get(`/api/images/export?name=${image.name}:${image.version}`, {
      responseType: 'blob',
      signal: controller.signal,
      onDownloadProgress: ev => {
        if (ev.total) {
          setDownloadTasks(prev => prev.map(t => t.id === id ? { ...t, progress: Math.round((ev.loaded * 100) / ev.total) } : t));
        }
      }
    }).then(res => {
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
    }).catch(() => {
      /* ignore errors */
    }).finally(() => {
      setDownloadTasks(prev => prev.filter(t => t.id !== id));
    });
  };

  const cancelDownload = (id: string) => {
    setDownloadTasks(prev => {
      const task = prev.find(t => t.id === id);
      if (task) task.controller.abort();
      return prev.filter(t => t.id !== id);
    });
  };

  const columns: GridColDef[] = React.useMemo(() => [
    { field: 'name', headerName: '名称', flex: 1 },
    { field: 'type', headerName: '类型', flex: 1, renderCell: (params) => params.row.type === 'docker' ? 'Docker' : '虚拟机 (VM)' },
    { field: 'version', headerName: '版本', flex: 1 },
    { field: 'description', headerName: '描述', flex: 1 },
    { field: 'size', headerName: '大小', flex: 1, hide: !showColumns.size },
    { field: 'uploadDate', headerName: '上传日期', flex: 1, hide: !showColumns.uploadDate,
      valueFormatter: (params) => {
        return dayjs(params).format('YYYY年M月D日 HH:mm:ss');
      }
    },
    {
      field: 'actions',
      headerName: '操作',
      sortable: false,
      flex: 1,
      renderCell: (params) => {
        const image = params.row as ManagedImage;
        return (
            <Box sx={{
              display: 'flex',
              justifyContent: 'center',   // 水平居中
              alignItems: 'center',       // 垂直居中
              width: '90%',
              height: '100%',             // 撑满单元格
            }}>
              <Tooltip title="启动">
                <IconButton onClick={() => handleStart(image)} size="small">
                  <PlayArrowIcon fontSize="small" color="success" />
                </IconButton>
              </Tooltip>
              <Tooltip title="导出镜像">
                <IconButton onClick={() => handleExport(image)} size="small">
                  <DownloadIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="删除镜像">
                <IconButton onClick={() => handleOpenConfirmDialog(image)} color="error" size="small">
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
        );
      }
    }
  ], [showColumns]);

  const filteredImages = React.useMemo(() => {
    return images.filter(img =>
        img.name.toLowerCase().includes(searchTerm) ||
        img.version.toLowerCase().includes(searchTerm) ||
        img.description.toLowerCase().includes(searchTerm)
    );
  }, [images, searchTerm]);

  return (
      <Box sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            <Typography variant="h4" component="h1">容器镜像管理</Typography>
            <TextField
                variant="outlined"
                placeholder="搜索镜像..."
                onChange={handleSearchChange}
                size="small"
                InputProps={{ startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon />
                      </InputAdornment>
                  )}}
                sx={{ width: { xs: '100%', sm: 260 } }}
            />
            <Button startIcon={<ViewColumnIcon />} onClick={(e)=>setColumnAnchorEl(e.currentTarget)} variant="outlined" size="small">显示列</Button>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <input type="file" hidden multiple ref={fileInputRef} onChange={handleImport} />
            <Button
                variant="outlined"
                startIcon={<CloudUploadIcon />}
                onClick={() => fileInputRef.current?.click()}
            >
              导入
            </Button>
            <Button
                variant="outlined"
                startIcon={isLoading ? <CircularProgress size={20} color="inherit" /> : <RefreshIcon />}
                onClick={handleRefresh}
                disabled={isLoading}
            >
              刷新
            </Button>
          </Box>
        </Box>

        {uploadTasks.map(task => (
          <Box key={task.id} sx={{ my: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" sx={{ minWidth: 80 }}>{task.name} {task.progress}%</Typography>
            <Box sx={{ flexGrow: 1 }}>
              <LinearProgress variant="determinate" value={task.progress} />
            </Box>
            <IconButton size="small" onClick={() => cancelUpload(task.id)}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
        ))}
        {downloadTasks.map(task => (
          <Box key={task.id} sx={{ my: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" sx={{ minWidth: 80 }}>{task.name} {task.progress}%</Typography>
            <Box sx={{ flexGrow: 1 }}>
              <LinearProgress variant="determinate" value={task.progress} />
            </Box>
            <IconButton size="small" onClick={() => cancelDownload(task.id)}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
        ))}

        {fetchError ? (
            <MuiAlert severity="error" sx={{ mb: 2, fontSize: '1.2rem' }}>
              {fetchError}
            </MuiAlert>
        ) : (
            <Box component={Paper} sx={{ boxShadow: 3 }}>
              <DataGrid
                  autoHeight
                  rows={filteredImages}
                  columns={columns}
                  pageSizeOptions={[5, 10, 25]}
                  paginationModel={{ pageSize: rowsPerPage, page }}
                  onPaginationModelChange={(m) => { setRowsPerPage(m.pageSize); setPage(m.page); }}
                  columnVisibilityModel={showColumns}
                  onColumnVisibilityModelChange={(m) => setShowColumns(m as any)}
                  sx={{ '& .MuiDataGrid-columnHeaders': { bgcolor: theme.palette.mode === 'dark' ? theme.palette.grey[800] : theme.palette.grey[200] } }}
              />
            </Box>
        )}

        <Menu anchorEl={columnAnchorEl} open={Boolean(columnAnchorEl)} onClose={() => setColumnAnchorEl(null)}>
          {Object.entries(showColumns).map(([key, val]) => (
              <MenuItem key={key}>
                <FormControlLabel
                    control={<Switch checked={val} onChange={(e)=>setShowColumns(prev=>({...prev,[key]:e.target.checked}))} color="primary" />}
                    label={key === 'size' ? '大小' : '上传日期'}
                />
              </MenuItem>
          ))}
        </Menu>

        <ImageFormModal
            open={isModalOpen}
            onClose={handleCloseModal}
            onSave={handleSaveImage}
            image={editingImage}
        />

        <CreateContainerModal
            open={Boolean(createModalImage)}
            onClose={() => setCreateModalImage(null)}
            onCreated={fetchImages}
            fixedImage={createModalImage || undefined}
        />

        <Dialog
            open={isConfirmDialogOpen}
            onClose={handleCloseConfirmDialog}
            aria-labelledby="confirm-delete-dialog-title"
            aria-describedby="confirm-delete-dialog-description"
        >
          <DialogTitle id="confirm-delete-dialog-title">确认删除镜像</DialogTitle>
          <DialogContent>
            <DialogContentText id="confirm-delete-dialog-description">
              您确定要删除镜像 "{imageToDelete?.name}" 吗？此操作无法撤销。
            </DialogContentText>
          </DialogContent>
          <DialogActions sx={{ px:3, pb:2}}>
            <Button onClick={handleCloseConfirmDialog} color="secondary" variant="outlined">
              取消
            </Button>
            <Button onClick={handleDeleteImage} color="error" variant="contained" autoFocus>
              删除
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
  );
};

export default ImageManagementPage;
