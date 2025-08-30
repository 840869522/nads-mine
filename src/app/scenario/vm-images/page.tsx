"use client"

import React, { useState, useEffect, useMemo, useRef } from "react"
import {
    Box,
    Typography,
    Paper,
    IconButton,
    Chip,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    InputAdornment,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Button,
    Tooltip,
    useTheme,
    LinearProgress,
} from "@mui/material"
import {
    Edit as EditIcon,
    Delete as DeleteIcon,
    PlayArrow as StartIcon,
    Search as SearchIcon,
    Download as DownloadIcon,
    CloudUpload as CloudUploadIcon,
} from "@mui/icons-material"
import { DataGrid, GridColDef } from "@mui/x-data-grid"
import dayjs from "dayjs"
import CreateVmModal from "@/components/vm/CreateVmModal"
import { customFetch } from "@/utils/fetch"
import axios from 'axios'

interface VmImage {
    id: string
    name: string
    osType?: string
    size: string
    description?: string
    modifiedDate?: string
    status?: "available" | "uploading" | "error"
}

const VmImageManagementPage: React.FC = () => {
    const [images, setImages] = useState<VmImage[]>([])
    const [overrides, setOverrides] = useState<Record<string, { osType?: string; description?: string }>>({})
    const [openDialog, setOpenDialog] = useState(false)
    const [editingImage, setEditingImage] = useState<VmImage | null>(null)
    const [createModalImage, setCreateModalImage] = useState<string | null>(null)
    const [formData, setFormData] = useState<{
        name: string
        osType: string
        description: string
    }>({
        name: "",
        osType: "",
        description: "",
    })
    const [customOs, setCustomOs] = useState("")
    const presetOs = ["ubuntu", "win7", "win10", "win7sp1", "win2003"]
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [uploadProgress, setUploadProgress] = useState<number | null>(null)
    const [downloadProgress, setDownloadProgress] = useState<number | null>(null)

    const fetchImages = async () => {
        const [imgData, overrideData] = await Promise.all([
            customFetch('/back/api/vms/images').then(res => res.json()).catch(() => []),
            fetch('/api/vm-image-overrides').then(res => res.json()).catch(() => ({})),
        ])
        setOverrides(overrideData)
        const merged = (imgData as VmImage[]).map(img => {
            const o = overrideData?.[img.name]
            return o ? { ...img, osType: o.osType, description: o.description } : img
        })
        setImages(merged)
    }

    useEffect(() => { fetchImages() }, [])

    const handleOpenDialog = (image: VmImage) => {
        setEditingImage(image)
        const isPreset = presetOs.includes(image.osType || "")
        setFormData({
            name: image.name,
            osType: isPreset ? image.osType || "" : "__custom",
            description: image.description || '',
        })
        setCustomOs(isPreset ? "" : image.osType || "")
        setOpenDialog(true)
    }

    const handleCloseDialog = () => {
        setOpenDialog(false)
        setEditingImage(null)
        setCustomOs("")
    }

    const handleStart = (image: VmImage) => {
        setCreateModalImage(image.name)
    }

    const handleSave = async () => {
        const osType = formData.osType === "__custom" ? customOs : formData.osType
        if (editingImage) {
            await fetch('/api/vm-image-overrides', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: editingImage.name,
                    osType: osType || undefined,
                    description: formData.description || undefined,
                }),
            })
            setOverrides(prev => ({
                ...prev,
                [editingImage.name]: { osType: osType || undefined, description: formData.description || undefined },
            }))
            setImages(prev =>
                prev.map(img =>
                    img.id === editingImage.id
                        ? { ...img, osType: osType || undefined, description: formData.description || undefined }
                        : img
                )
            )
        }
        handleCloseDialog()
    }

    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        const formData = new FormData()
        formData.append('file', file)
        setUploadProgress(0)
        axios.post('/api/vms/images/import', formData, {
            onUploadProgress: ev => {
                if (ev.total) setUploadProgress(Math.round((ev.loaded * 100) / ev.total))
            }
        }).then(() => {
            fetchImages()
        }).finally(() => {
            setUploadProgress(null)
            if (fileInputRef.current) fileInputRef.current.value = ''
        })
    }

    const handleExport = (image: VmImage) => {
        setDownloadProgress(0)
        axios.get(`/api/vms/images/export?name=${image.name}`, {
            responseType: 'blob',
            onDownloadProgress: ev => {
                if (ev.total) setDownloadProgress(Math.round((ev.loaded * 100) / ev.total))
            }
        }).then(res => {
            const url = window.URL.createObjectURL(new Blob([res.data]))
            const link = document.createElement('a')
            link.href = url
            link.setAttribute('download', image.name)
            document.body.appendChild(link)
            link.click()
            link.remove()
        }).finally(() => {
            setDownloadProgress(null)
        })
    }

    const theme = useTheme()
    const [search, setSearch] = useState('')
    const [page, setPage] = useState(0)
    const [rowsPerPage, setRowsPerPage] = useState(10)
    const filteredImages = images.filter(img =>
        img.name.toLowerCase().includes(search.toLowerCase()) ||
        img.description?.toLowerCase().includes(search.toLowerCase()) ||
        img.osType?.toLowerCase().includes(search.toLowerCase())
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
        {
            field: 'osType',
            headerName: '操作系统',
            width: 120,
            valueFormatter: (params) => params.value || '',
        },
        { field: 'description', headerName: '描述', flex: 1, minWidth: 200 },
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
            valueFormatter: (params) =>
                params
                    ? dayjs(params.value as string).format('YYYY年M月D日 HH:mm:ss')
                    : ''
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
                    <Tooltip title="导出">
                        <IconButton size="small" onClick={() => handleExport(params.row)}>
                            <DownloadIcon />
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
                <Box sx={{ display: 'flex', gap: 1 }}>
                    <input type="file" hidden ref={fileInputRef} onChange={handleImport} />
                    <Button variant="outlined" startIcon={<CloudUploadIcon />} onClick={() => fileInputRef.current?.click()}>
                        导入
                    </Button>
                </Box>
            </Box>
            {uploadProgress !== null && (
                <Box sx={{ my: 2 }}>
                    <Typography variant="body2">上传进度 {uploadProgress}%</Typography>
                    <LinearProgress variant="determinate" value={uploadProgress} />
                </Box>
            )}
            {downloadProgress !== null && (
                <Box sx={{ my: 2 }}>
                    <Typography variant="body2">下载进度 {downloadProgress}%</Typography>
                    <LinearProgress variant="determinate" value={downloadProgress} />
                </Box>
            )}

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
                            fullWidth
                            disabled
                        />
                        <FormControl fullWidth>
                            <InputLabel>类别</InputLabel>
                            <Select
                                value={formData.osType}
                                label="类别"
                                onChange={(e) =>
                                    setFormData((prev) => ({
                                        ...prev,
                                        osType: e.target.value as string,
                                    }))
                                }
                            >
                                {presetOs.map(os => (
                                    <MenuItem key={os} value={os}>{os}</MenuItem>
                                ))}
                                <MenuItem value="__custom">自定义</MenuItem>
                            </Select>
                        </FormControl>
                        {formData.osType === "__custom" && (
                            <TextField
                                label="自定义类别"
                                value={customOs}
                                onChange={(e) => setCustomOs(e.target.value)}
                                fullWidth
                            />
                        )}
                        <TextField
                            label="描述"
                            value={formData.description}
                            onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                            fullWidth
                            multiline
                            rows={3}
                        />
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseDialog}>取消</Button>
                    <Button onClick={handleSave} variant="contained">保存</Button>
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
