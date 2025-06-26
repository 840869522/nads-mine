"use client";

import React, { useState, useEffect } from 'react';
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
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import DeleteIcon from '@mui/icons-material/Delete';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import RefreshIcon from '@mui/icons-material/Refresh';
import ViewColumnIcon from '@mui/icons-material/ViewColumn';
import SearchIcon from '@mui/icons-material/Search';
import { ManagedImage } from '@/types';
import ImageFormModal from '@/components/imagemanagement/ImageFormModal';
import CreateContainerModal from '@/components/scenario/CreateContainerModal';
import { useAuth } from '@/hooks/useAuth';
import dayjs from 'dayjs';
const API_BASE = "http://localhost:8000";

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

  const fetchImages = async () => {
    if (!user) return;
    const q = `?userId=${user.id}&role=${user.role}`;
    try {
      const res = await fetch(`${API_BASE}/api/images${q}`);
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
    const q = `?userId=${user.id}&role=${user.role}`;
    if (editingImage) {
      fetch(`${API_BASE}/api/images${q}`, { method: 'PUT', body: JSON.stringify(image) }).then(() => {
        setImages(prevImages => prevImages.map(img => (img.id === image.id ? image : img)));
      });
    } else {
      fetch(`${API_BASE}/api/images${q}`, { method: 'POST', body: JSON.stringify(image) })
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

  const handleDeleteImage = () => {
    if (!user) return;
    if (imageToDelete) {
      const q = `?userId=${user.id}&role=${user.role}&id=${imageToDelete.id}`;
      fetch(`${API_BASE}/api/images${q}`, { method: 'DELETE' }).then(() => {
        setImages(prevImages => prevImages.filter(img => img.id !== imageToDelete.id));
      });
    }
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

  const columns: GridColDef[] = React.useMemo(() => [
    { field: 'name', headerName: '名称', flex: 1 },
    { field: 'type', headerName: '类型', flex: 1, renderCell: (params) => params.row.type === 'docker' ? 'Docker' : '虚拟机 (VM)' },
    { field: 'version', headerName: '版本', flex: 1 },
    { field: 'description', headerName: '描述', flex: 1 },
    { field: 'size', headerName: '大小', flex: 1, hide: !showColumns.size },
    { field: 'uploadDate', headerName: '上传日期', flex: 1, hide: !showColumns.uploadDate,
      valueFormatter: (params) => {
        console.log('value =>', params);     // 会是 undefined 吗？
        return dayjs(params).format('YYYY年M月D日');
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
          <Typography variant="h4" component="h1">镜像管理</Typography>
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
          <Button
            variant="outlined"
            startIcon={isLoading ? <CircularProgress size={20} color="inherit" /> : <RefreshIcon />}
            onClick={handleRefresh}
            disabled={isLoading}
          >
            刷新
          </Button>
          <Button
            variant="contained"
            startIcon={<AddCircleOutlineIcon />}
            onClick={handleOpenModal}
          >
            添加镜像
          </Button>
        </Box>
      </Box>

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
