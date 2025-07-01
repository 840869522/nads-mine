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
    Add as AddIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    Visibility as ViewIcon,
    CloudUpload as UploadIcon,
    Computer as ComputerIcon,
    Search as SearchIcon,
} from "@mui/icons-material"
import { DataGrid, GridColDef } from "@mui/x-data-grid"

interface VmImage {
    id: string
    name: string
    version: string
    osType: "Windows" | "Linux" | "Other"
    architecture: "x86_64" | "arm64"
    size: string
    description: string
    uploadDate: string
    status: "available" | "uploading" | "error"
    filePath?: string
}

const VmImageManagementPage: React.FC = () => {
    const [images, setImages] = useState<VmImage[]>([])
    const [openDialog, setOpenDialog] = useState(false)
    const [editingImage, setEditingImage] = useState<VmImage | null>(null)
    const [formData, setFormData] = useState({
        name: "",
        version: "",
        osType: "Linux" as const,
        architecture: "x86_64" as const,
        description: "",
    })
const [selectedFile, setSelectedFile] = useState<File | null>(null)

    // 模拟数据
    useEffect(() => {
        const mockImages: VmImage[] = [
            {
                id: "1",
                name: "Ubuntu Server",
                version: "22.04 LTS",
                osType: "Linux",
                architecture: "x86_64",
                size: "2.1 GB",
                description: "Ubuntu Server 22.04 LTS with basic tools",
                uploadDate: "2024-01-15T10:30:00Z",
                status: "available",
                filePath: "/images/ubuntu-22.04.qcow2",
            },
            {
                id: "2",
                name: "Windows Server",
                version: "2022",
                osType: "Windows",
                architecture: "x86_64",
                size: "4.8 GB",
                description: "Windows Server 2022 Standard Edition",
                uploadDate: "2024-01-10T14:20:00Z",
                status: "available",
                filePath: "/images/windows-server-2022.qcow2",
            },
            {
                id: "3",
                name: "Kali Linux",
                version: "2024.1",
                osType: "Linux",
                architecture: "x86_64",
                size: "3.2 GB",
                description: "Kali Linux penetration testing distribution",
                uploadDate: "2024-01-20T09:15:00Z",
                status: "available",
                filePath: "/images/kali-2024.1.qcow2",
            },
        ]
        setImages(mockImages)
    }, [])

    const handleOpenDialog = (image?: VmImage) => {
        if (image) {
            setEditingImage(image)
            setFormData({
                name: image.name,
                version: image.version,
                osType: image.osType,
                architecture: image.architecture,
                description: image.description,
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

    const handleSave = () => {
        if (editingImage) {
            // 编辑现有镜像
            setImages((prev) => prev.map((img) => (img.id === editingImage.id ? { ...img, ...formData } : img)))
        } else {
            // 添加新镜像
            const newImage: VmImage = {
                id: Date.now().toString(),
                ...formData,
                size: selectedFile ? `${(selectedFile.size / (1024 * 1024 * 1024)).toFixed(1)} GB` : "0 GB",
                uploadDate: new Date().toISOString(),
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
        img.version.toLowerCase().includes(search.toLowerCase()) ||
        img.description.toLowerCase().includes(search.toLowerCase())
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
        {
            field: 'name',
            headerName: '镜像名称',
            flex: 1,
            minWidth: 180,
            renderCell: params => (
                <Box>
                    <Typography variant="subtitle2">{params.row.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                        {params.row.description}
                    </Typography>
                </Box>
            ),
        },
        { field: 'version', headerName: '版本', width: 120 },
        { field: 'osType', headerName: '操作系统', width: 120 },
        { field: 'architecture', headerName: '架构', width: 120 },
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
            field: 'uploadDate',
            headerName: '上传时间',
            flex: 1,
            minWidth: 160,
            valueFormatter: params => new Date(params.value as string).toLocaleString('zh-CN'),
        },
        {
            field: 'actions',
            headerName: '操作',
            sortable: false,
            width: 140,
            renderCell: params => (
                <Box>
                    <Tooltip title="查看详情">
                        <IconButton size="small">
                            <ViewIcon />
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
                <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenDialog()}>
                    添加镜像
                </Button>
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
        </Box>
    )
}

export default VmImageManagementPage
