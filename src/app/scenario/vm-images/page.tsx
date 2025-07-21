"use client"

import React, { useState, useEffect, useMemo } from "react"
import {
    Box,
    Typography,
    Button,
    Paper,
    IconButton,
    Chip,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    InputAdornment,
    MenuItem,
    FormControl,
    InputLabel,
    Select,
    Alert,
    Tooltip,
    useTheme,
} from "@mui/material"
import {
    Edit as EditIcon,
    Delete as DeleteIcon,
    PlayArrow as StartIcon,
    CloudUpload as UploadIcon,
    Computer as ComputerIcon,
    Search as SearchIcon,
} from "@mui/icons-material"
import { DataGrid, GridColDef } from "@mui/x-data-grid"
import dayjs from "dayjs"
import CreateVmModal from "@/components/vm/CreateVmModal"

interface VmImage {
    id: string
    name: string
    version?: string
    osType?: "Windows" | "Linux" | "Other"
    architecture?: "x86_64" | "arm64"
    size: string
    description?: string
    modifiedDate?: string
    status?: "available" | "uploading" | "error"
    filePath?: string
}

const VmImageManagementPage: React.FC = () => {
    const [images, setImages] = useState<VmImage[]>([])
    const [openDialog, setOpenDialog] = useState(false)
    const [editingImage, setEditingImage] = useState<VmImage | null>(null)
    const [createModalImage, setCreateModalImage] = useState<string | null>(null)
    const [formData, setFormData] = useState({
        name: "",
        version: "",
        osType: "Linux" as const,
        architecture: "x86_64" as const,
        description: "",
    })
const [selectedFile, setSelectedFile] = useState<File | null>(null)

    // 从后端获取镜像列表
    useEffect(() => {
        fetch('/back/api/vms/images')
            .then(res => res.json())
            .then((data: VmImage[]) => setImages(data))
            .catch(() => {})
    }, [])

    const handleOpenDialog = (image?: VmImage) => {
        if (image) {
            setEditingImage(image)
            setFormData({
                name: image.name,
                version: image.version || '',
                osType: image.osType || 'Linux',
                architecture: image.architecture || 'x86_64',
                description: image.description || '',
            })
        } else {
            setEditingImage(null)
            setFormData({
                name: "",
                version: "",
                osType: "Linux",
                architecture: "x86_64",
                description: "",
            })
        }
        setSelectedFile(null)
        setOpenDialog(true)
    }

    const handleCloseDialog = () => {
        setOpenDialog(false)
        setEditingImage(null)
        setSelectedFile(null)
    }

    const handleStart = (image: VmImage) => {
        setCreateModalImage(image.name)
    }

    const handleSave = () => {
        if (editingImage) {
            // 编辑现有镜像
            setImages((prev) => prev.map((img) => (img.id === editingImage.id ? { ...img, ...formData } : img)))
        } else {
            // 添加新镜像
            const newImage: VmImage = {
                id: Date.now().toString(),
                ...formData,
                size: selectedFile ? `${(selectedFile.size / (1024 * 1024)).toFixed(1)} MB` : "0 MB",
                modifiedDate: new Date().toISOString(),
                status: "available",
                filePath: selectedFile ? `/images/${selectedFile.name}` : undefined,
            }
            setImages((prev) => [...prev, newImage])
        }
        handleCloseDialog()
    }

    const theme = useTheme()
    const [search, setSearch] = useState('')
    const [page, setPage] = useState(0)
    const [rowsPerPage, setRowsPerPage] = useState(10)
    const filteredImages = images.filter(img =>
        img.name.toLowerCase().includes(search.toLowerCase()) ||
        img.description?.toLowerCase().includes(search.toLowerCase())
    )

    const handleDelete = (id: string) => {
        if (confirm("确定要删除这个虚拟机镜像吗？")) {
            setImages((prev) => prev.filter((img) => img.id !== id))
        }
    }

    const getStatusColor = (status: VmImage["status"]) => {
        switch (status) {
            case "available":
                return "success"
            case "uploading":
                return "warning"
            case "error":
                return "error"
            default:
                return "default"
        }
    }

    const getStatusText = (status: VmImage["status"]) => {
        switch (status) {
            case "available":
                return "可用"
            case "uploading":
                return "上传中"
            case "error":
                return "错误"
            default:
                return status
        }
    }

    const columns = useMemo<GridColDef[]>(() => [
        { field: 'name', headerName: '名称', flex: 1, minWidth: 160 },
        //{ field: 'description', headerName: '描述', flex: 1, minWidth: 200 },
        { field: 'size', headerName: '大小', width: 120 },
        {
            field: 'status',
            headerName: '状态',
            width: 120,
            renderCell: params => (
                <Chip label={getStatusText(params.row.status)} color={getStatusColor(params.row.status)} size="small" />
            ),
        },
        {
            field: 'modifiedDate',
            headerName: '修改日期',
            flex: 1,
            minWidth: 160,
            // Align with container pages: parse ISO string and format as locale date
            valueFormatter: (params) => {
                return dayjs(params).format('YYYY年M月D日');
            }
        },
        {
            field: 'actions',
            headerName: '操作',
            sortable: false,
            width: 140,
            renderCell: params => (
                <Box>
                    <Tooltip title="启动">
                        <IconButton size="small" onClick={() => handleStart(params.row)}>
                            <StartIcon color="success" />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="编辑">
                        <IconButton size="small" onClick={() => handleOpenDialog(params.row)}>
                            <EditIcon />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="删除">
                        <IconButton size="small" onClick={() => handleDelete(params.row.id)}>
                            <DeleteIcon />
                        </IconButton>
                    </Tooltip>
                </Box>
            ),
        },
    ], [images])

    return (
        <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                    <Typography variant="h4" component="h1">虚拟机镜像管理</Typography>
                    <TextField
                        variant="outlined"
                        placeholder="搜索镜像..."
                        onChange={(e)=>setSearch(e.target.value)}
                        size="small"
                        InputProps={{ startAdornment: (
                            <InputAdornment position="start">
                                <SearchIcon />
                            </InputAdornment>
                        )}}
                        sx={{ width: { xs: '100%', sm: 260 } }}
                    />
                </Box>
            </Box>

            <Box component={Paper} sx={{ boxShadow: 3 }}>
                <DataGrid
                    autoHeight
                    rows={filteredImages}
                    columns={columns}
                    pageSizeOptions={[5, 10, 25]}
                    paginationModel={{ pageSize: rowsPerPage, page }}
                    onPaginationModelChange={(m) => { setRowsPerPage(m.pageSize); setPage(m.page); }}
                    sx={{ '& .MuiDataGrid-columnHeaders': { bgcolor: theme.palette.mode === 'dark' ? theme.palette.grey[800] : theme.palette.grey[200] } }}
                />
            </Box>

            {/* 添加/编辑镜像对话框 */}
            <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
                <DialogTitle>{editingImage ? "编辑虚拟机镜像" : "添加虚拟机镜像"}</DialogTitle>
                <DialogContent>
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
                        <TextField
                            label="镜像名称"
                            value={formData.name}
                            onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                            fullWidth
                            required
                        />
                        <TextField
                            label="版本"
                            value={formData.version}
                            onChange={(e) => setFormData((prev) => ({ ...prev, version: e.target.value }))}
                            fullWidth
                            required
                        />
                        <FormControl fullWidth>
                            <InputLabel>操作系统类型</InputLabel>
                            <Select
                                value={formData.osType}
                                label="操作系统类型"
                                onChange={(e) => setFormData((prev) => ({ ...prev, osType: e.target.value as any }))}
                            >
                                <MenuItem value="Linux">Linux</MenuItem>
                                <MenuItem value="Windows">Windows</MenuItem>
                                <MenuItem value="Other">其他</MenuItem>
                            </Select>
                        </FormControl>
                        <FormControl fullWidth>
                            <InputLabel>架构</InputLabel>
                            <Select
                                value={formData.architecture}
                                label="架构"
                                onChange={(e) => setFormData((prev) => ({ ...prev, architecture: e.target.value as any }))}
                            >
                                <MenuItem value="x86_64">x86_64</MenuItem>
                                <MenuItem value="arm64">ARM64</MenuItem>
                            </Select>
                        </FormControl>
                        <TextField
                            label="描述"
                            value={formData.description}
                            onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                            fullWidth
                            multiline
                            rows={3}
                        />
                        {!editingImage && (
                            <Box>
                                <Button variant="outlined" component="label" startIcon={<UploadIcon />} fullWidth>
                                    选择镜像文件
                                    <input
                                        type="file"
                                        hidden
                                        accept=".qcow2,.vmdk,.vdi,.img"
                                        onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                                    />
                                </Button>
                                {selectedFile && (
                                    <Alert severity="info" sx={{ mt: 1 }}>
                                        已选择文件: {selectedFile.name} ({(selectedFile.size / (1024 * 1024)).toFixed(1)} MB)
                                    </Alert>
                                )}
                            </Box>
                        )}
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseDialog}>取消</Button>
                    <Button onClick={handleSave} variant="contained">
                        {editingImage ? "保存" : "添加"}
                    </Button>
                </DialogActions>
            </Dialog>
            <CreateVmModal
                open={Boolean(createModalImage)}
                onClose={() => setCreateModalImage(null)}
                fixedImage={createModalImage || undefined}
            />
        </Box>
    )
}

export default VmImageManagementPage
