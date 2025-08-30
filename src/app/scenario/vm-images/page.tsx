"use client"

import React, { useState, useEffect, useMemo } from "react"
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
    CircularProgress,
} from "@mui/material"
import {
    Edit as EditIcon,
    Delete as DeleteIcon,
    PlayArrow as StartIcon,
    Search as SearchIcon,
    CloudUpload as CloudUploadIcon,
    FileDownload as FileDownloadIcon,
    Refresh as RefreshIcon,
} from "@mui/icons-material"
import { DataGrid, GridColDef } from "@mui/x-data-grid"
import dayjs from "dayjs"
import CreateVmModal from "@/components/vm/CreateVmModal"
import { customFetch } from "@/utils/fetch"

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
    const [osTypeOption, setOsTypeOption] = useState<string>("")
    const [customOsType, setCustomOsType] = useState("")
    const osOptions = ["ubuntu", "win7", "win10", "win7sp1", "win2003"]
    const [isLoading, setIsLoading] = useState(false)

    const fetchImages = () =>
        Promise.all([
            customFetch('/back/api/vms/images').then(res => res.json()).catch(() => []),
            fetch('/api/vm-image-overrides').then(res => res.json()).catch(() => ({})),
        ]).then(([imgData, overrideData]) => {
            setOverrides(overrideData)
            const merged = (imgData as VmImage[]).map(img => {
                const o = overrideData?.[img.name]
                return o ? { ...img, osType: o.osType, description: o.description } : img
            })
            setImages(merged)
        })

    useEffect(() => { fetchImages() }, [])

    const handleOpenDialog = (image: VmImage) => {
        setEditingImage(image)
        const os = image.osType || ""
        if (osOptions.includes(os)) {
            setOsTypeOption(os)
            setCustomOsType("")
        } else {
            setOsTypeOption("custom")
            setCustomOsType(os)
        }
        setFormData({
            name: image.name,
            osType: os,
            description: image.description || '',
        })
        setOpenDialog(true)
    }

    const handleCloseDialog = () => {
        setOpenDialog(false)
        setEditingImage(null)
    }

    const handleStart = (image: VmImage) => {
        setCreateModalImage(image.name)
    }

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        const form = new FormData()
        form.append('file', file)
        await fetch('/back/api/vms/images/import', { method: 'POST', body: form })
        e.target.value = ''
        fetchImages()
    }

    const handleExport = async (image: VmImage) => {
        const res = await fetch(`/back/api/vms/images/export?name=${encodeURIComponent(image.name)}`)
        const blob = await res.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = image.name
        document.body.appendChild(a)
        a.click()
        a.remove()
        window.URL.revokeObjectURL(url)
    }

    const handleRefresh = () => {
        setIsLoading(true)
        fetchImages().finally(() => setIsLoading(false))
    }

    const handleSave = async () => {
        if (editingImage) {
            await fetch('/api/vm-image-overrides', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: editingImage.name,
                    osType: formData.osType || undefined,
                    description: formData.description || undefined,
                }),
            })
            setOverrides(prev => ({
                ...prev,
                [editingImage.name]: { osType: formData.osType || undefined, description: formData.description || undefined },
            }))
            setImages(prev =>
                prev.map(img =>
                    img.id === editingImage.id
                        ? { ...img, osType: formData.osType || undefined, description: formData.description || undefined }
                        : img
                )
            )
        }
        handleCloseDialog()
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
            valueFormatter: params => {
                switch (params) {
                    case 'Linux':
                        return 'Linux'
                    case 'Windows':
                        return 'Windows'
                    case 'Other':
                        return '其他'
                    default:
                        return params || ''
                }
            },
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
            width: 180,
            renderCell: params => (
                <Box>
                    <Tooltip title="启动">
                        <IconButton size="small" onClick={() => handleStart(params.row)}>
                            <StartIcon color="success" />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="导出">
                        <IconButton size="small" onClick={() => handleExport(params.row)}>
                            <FileDownloadIcon color="primary" />
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
                    <Button
                        variant="contained"
                        component="label"
                        startIcon={<CloudUploadIcon />}
                        size="small"
                    >
                        导入
                        <input type="file" hidden onChange={handleImport} />
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
                            <InputLabel>操作系统类型</InputLabel>
                            <Select
                                value={osTypeOption}
                                label="操作系统类型"
                                onChange={(e) => {
                                    const value = e.target.value as string
                                    setOsTypeOption(value)
                                    if (value !== 'custom') {
                                        setFormData(prev => ({ ...prev, osType: value }))
                                    } else {
                                        setFormData(prev => ({ ...prev, osType: customOsType }))
                                    }
                                }}
                            >
                                {osOptions.map(opt => (
                                    <MenuItem key={opt} value={opt}>{opt}</MenuItem>
                                ))}
                                <MenuItem value="custom">自定义</MenuItem>
                            </Select>
                        </FormControl>
                        {osTypeOption === 'custom' && (
                            <TextField
                                label="自定义类别"
                                value={customOsType}
                                onChange={(e) => {
                                    setCustomOsType(e.target.value)
                                    setFormData(prev => ({ ...prev, osType: e.target.value }))
                                }}
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
