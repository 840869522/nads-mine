
import React, { useState, useCallback } from 'react';
import {
  Box,
  Button,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Tooltip,
} from '@mui/material';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { ManagedImage } from '../types';
import { INITIAL_MANAGED_IMAGES } from '../constants';
import ImageFormModal from '../components/imagemanagement/ImageFormModal';

const ImageManagementPage: React.FC = () => {
  const [images, setImages] = useState<ManagedImage[]>(INITIAL_MANAGED_IMAGES);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingImage, setEditingImage] = useState<ManagedImage | null>(null);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [imageToDelete, setImageToDelete] = useState<ManagedImage | null>(null);

  const handleOpenModal = (image?: ManagedImage) => {
    setEditingImage(image || null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingImage(null);
  };

  const handleSaveImage = (image: ManagedImage) => {
    if (editingImage) {
      setImages(prevImages => prevImages.map(img => (img.id === image.id ? image : img)));
    } else {
      setImages(prevImages => [...prevImages, { ...image, id: `img-${Date.now()}` }]);
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
    if (imageToDelete) {
      setImages(prevImages => prevImages.filter(img => img.id !== imageToDelete.id));
    }
    handleCloseConfirmDialog();
  };
  
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          镜像管理
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddCircleOutlineIcon />}
          onClick={() => handleOpenModal()}
          aria-label="添加新镜像"
        >
          添加镜像
        </Button>
      </Box>

      <TableContainer component={Paper} sx={{ boxShadow: 3 }}>
        <Table aria-label="镜像列表">
          <TableHead sx={{ bgcolor: 'primary.main' }}>
            <TableRow>
              <TableCell sx={{ color: 'common.white', fontWeight: 'bold' }}>名称</TableCell>
              <TableCell sx={{ color: 'common.white', fontWeight: 'bold' }}>类型</TableCell>
              <TableCell sx={{ color: 'common.white', fontWeight: 'bold' }}>版本</TableCell>
              <TableCell sx={{ color: 'common.white', fontWeight: 'bold' }}>描述</TableCell>
              <TableCell sx={{ color: 'common.white', fontWeight: 'bold' }}>文件名</TableCell>
              <TableCell sx={{ color: 'common.white', fontWeight: 'bold' }}>大小</TableCell>
              <TableCell sx={{ color: 'common.white', fontWeight: 'bold' }}>上传日期</TableCell>
              <TableCell sx={{ color: 'common.white', fontWeight: 'bold', textAlign: 'center' }}>操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {images.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 3 }}>
                  <Typography variant="subtitle1" color="text.secondary">
                    当前没有镜像。请点击“添加镜像”开始。
                  </Typography>
                </TableCell>
              </TableRow>
            )}
            {images.map((image) => (
              <TableRow 
                key={image.id} 
                hover 
                sx={{ '&:nth-of-type(odd)': { backgroundColor: 'action.hover' } }}
              >
                <TableCell>{image.name}</TableCell>
                <TableCell>{image.type === 'docker' ? 'Docker' : '虚拟机 (VM)'}</TableCell>
                <TableCell>{image.version}</TableCell>
                <TableCell sx={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <Tooltip title={image.description} placement="top-start">
                        <span>{image.description}</span>
                    </Tooltip>
                </TableCell>
                <TableCell>{image.fileName || '-'}</TableCell>
                <TableCell>{image.size || '-'}</TableCell>
                <TableCell>{formatDate(image.uploadDate)}</TableCell>
                <TableCell align="center">
                  <Tooltip title="编辑镜像">
                    <IconButton onClick={() => handleOpenModal(image)} color="primary" aria-label={`编辑镜像 ${image.name}`}>
                      <EditIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="删除镜像">
                    <IconButton onClick={() => handleOpenConfirmDialog(image)} color="error" aria-label={`删除镜像 ${image.name}`}>
                      <DeleteIcon />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <ImageFormModal
        open={isModalOpen}
        onClose={handleCloseModal}
        onSave={handleSaveImage}
        image={editingImage}
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
