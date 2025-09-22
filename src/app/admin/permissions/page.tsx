"use client";

import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Typography,
  Box,
  Paper,
  Button,
  TextField,
  InputAdornment,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TableSortLabel,
  IconButton,
  Chip,
  Tooltip,
  Stack,
} from '@mui/material';
import CircularProgress from '@mui/material/CircularProgress';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import SearchIcon from '@mui/icons-material/Search';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ConfirmActionDialog from '@/components/scenario/ConfirmActionDialog';
import { apiClientWithToken } from '@/utils/axios';
import PermissionFormModal, { PermissionFormData } from '@/components/admin/PermissionModal';
import { toast } from 'react-toastify';

// Mock User Data Type (ensure it matches what UserFormModal expects for initialUser)
import { PermissionDisplayItem } from '@/components/admin/PermissionModal';
import { userPermissionContext } from '@/contexts/PermissionAndMenuContext';
// excel 导入导出工具
import * as XLSX from "xlsx";
import { DownloadOutlined } from '@mui/icons-material';



type Order = 'asc' | 'desc';
type SortablePermissionsKeys = keyof Pick<PermissionDisplayItem, 'c_id' | 'c_name'>;


const PermissionManagementPage: React.FC = () => {
  const { updateData, id2nameMap } = userPermissionContext();
  const [firstFlag, setFirstFlag] = useState<boolean>(true);
  const [permissions, setPermissions] = useState<PermissionDisplayItem[]>([]);
  const [searchTerm, setSearchTerm] = useState({ data: '', flag: false });
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [order, setOrder] = useState<Order>('asc');
  const [orderBy, setOrderBy] = useState<SortablePermissionsKeys>('c_id');

  const [count, setDataCount] = useState<number>(0);
  const [isPermissionModalOpen, setIsPermissionModalOpen] = useState(false);
  const [editingPermission, setEditingPermission] = useState<PermissionDisplayItem | null>(null);

  const [tableLaoding, setTableLoading] = useState(true);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [permissionToDelete, setPermissionToDelete] = useState<PermissionDisplayItem | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);


  useEffect(() => {
    if (searchTerm.data.trim())
      getPerimissionDataSearch(page, rowsPerPage);
    else getPermissionData(page, rowsPerPage)
  }, [page, rowsPerPage]);

  const getPermissionData = (page: number, pagesize: number) => {
    setTableLoading(true);
    apiClientWithToken.post(`/back/api/support/permission/all`, JSON.stringify({ page: page, pagesize: pagesize })).then((res) => {
      if (res.data.code === 200) {
        setPermissions(res.data.data.data);
        setDataCount(res.data.data.count);
      }
    }).finally(() => {
      setTimeout(() => {
        setTableLoading(false);
      }, 600);

    });
  }

  const getPerimissionDataSearch = (page: number, pagesize: number) => {
    setTableLoading(true);
    apiClientWithToken.post(`/back/api/support/permission/search`, JSON.stringify({
      page: page,
      pagesize: pagesize,
      name: searchTerm.data
    })).then(res => {
      if (res.data.code === 200) {
        setPermissions(res.data.data.data);
        setDataCount(res.data.data.count);
      } else {
        setPermissions([]);
        toast.error(`搜索权限时发生错误 - ${searchTerm.data}`, {
          autoClose: 3000,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        });
      }
    }).finally(() => {
      setTableLoading(false);
    });
  }

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm({ data: event.target.value.toLowerCase(), flag: true });
    setPage(1);
  };

  const handleSearchSubmit = async () => {
    getPerimissionDataSearch(1, rowsPerPage);
    setPage(1);
  };

  const handleRequestSort = (property: SortablePermissionsKeys) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage + 1);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(1);
  };

  const handleAddPermissionClick = () => {
    setEditingPermission(null);
    setIsPermissionModalOpen(true);
  };

  const handleEditPermissionClick = (permision: PermissionDisplayItem) => {
    // apiClientWithToken.post(`/back/api/support/permission/id`, JSON.stringify({ id: permision.c_id })).then((res) => {
    //   if (res.data.code === 200) {
    //     setEditingPermission(res.data.data);
    //     setIsPermissionModalOpen(true);
    //   } else {
    //     toast.error(res.data.message, {
    //       autoClose: 3000,
    //       closeOnClick: true,
    //       pauseOnHover: true,
    //       draggable: true,
    //     });
    //   }
    // })
    setEditingPermission(permision);
    setIsPermissionModalOpen(true);
  };

  const handleSavePermission = async (formData: PermissionFormData, isNew: boolean) => {
    var permissionData = {
      ...formData,
      icon: formData.is_menu ? formData.icon : " "
    }
    if (isNew) {
      apiClientWithToken.post(`/back/api/support/permission/new`, JSON.stringify({ data: { ...permissionData } })).then((res) => {
        if (res.data.code === 200) {
          setPage(1);
          getPermissionData(1, rowsPerPage);
          toast.success(`权限 "${permissionData.id}" 添加成功。`, {
            autoClose: 3000,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
          });
          updateData(true);
        } else {
          toast.error(`权限 "${permissionData.id}" 添加失败。`, {
            autoClose: 3000,
            closeOnClick: true,
            draggable: true,
            pauseOnHover: true
          });
        }
      });
    } else if (editingPermission) {
      delete permissionData.id;
      const res = await apiClientWithToken.post(`/back/api/support/permission/update`, JSON.stringify({
        id: editingPermission.c_id,
        data: {
          ...permissionData
        }
      }));
      if (res.data.code === 200) {
        let updatePerm: PermissionDisplayItem = {
          c_id: permissionData.id || editingPermission.c_id,
          c_des: permissionData.des,
          c_label: permissionData.label,
          c_src: permissionData.src,
          c_api_src: permissionData.api_src,
          c_pid: permissionData.pid,
          c_status: permissionData.status,
          c_is_menu: permissionData.is_menu,
          c_icon: permissionData.icon
        }
        setPermissions(prev => prev.map(u =>
          u.c_id === editingPermission.c_id ? { ...u, ...updatePerm } : u
        ));
        toast.success(`权限 "${editingPermission.c_id}" 更新成功。`, {
          autoClose: 3000,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        });
        updateData(true, { ...permissionData, id: editingPermission.c_id });
      } else {
        toast.error(`权限 "${formData.id}" 更新失败。`, {
          autoClose: 3000,
          closeOnClick: true,
          draggable: true,
          pauseOnHover: true
        });
      }
    }
  };


  const handleDeletePermissionClick = (permision: PermissionDisplayItem) => {
    setPermissionToDelete(permision);
    setIsConfirmDeleteOpen(true);
  };

  const confirmDeletePermission = () => {
    if (permissionToDelete) {
      apiClientWithToken.post(`/back/api/support/permission/delete`, JSON.stringify({ id: permissionToDelete.c_id })).then((res) => {
        if (res.data.code === 200) {
          setPermissions(prev => prev.filter(u => u.c_id !== permissionToDelete.c_id));
          toast.success(`权限 "${permissionToDelete.c_id}" 已删除。`, {
            autoClose: 3000,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
          });
          updateData(true);
        } else
          toast.error(`权限 "${permissionToDelete.c_id}" 删除失败。`, {
            autoClose: 3000,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
          });
      });
    }
    setIsConfirmDeleteOpen(false);
    setPermissionToDelete(null);
  };

  const handleInputExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      // 1. 文件类型验证
      if (!file.name.match(/\.(xlsx|xls)$/)) {
        throw new Error("仅支持 .xlsx 或 .xls 格式");
      }

      // 2. 读取文件内容
      const reader = new FileReader();
      reader.onload = (event) => {
        const data = event.target?.result;
        if (!data) throw new Error("文件读取失败");

        // 3. 解析 Excel 数据
        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheet = workbook.SheetNames[0];
        const allPermissionWorksheet = workbook.Sheets[firstSheet];

        // 4. 转换为 JSON 数组（跳过空行）
        const allPermissionJsonData = XLSX.utils.sheet_to_json(allPermissionWorksheet, { header: 1 }).filter(
          row => Array.isArray(row) && row.some(cell => cell?.toString().trim())
        );

        // 5. 验证表头是否匹配
        const expectedHeaders = [
          '权限id', '名称', '描述', 'api接口', '前端地址', '所属菜单', '状态', '是否为菜单项', '图标', '序号'
        ];
        const allUserFileHeaders = allPermissionJsonData[0] as string[];
        if (!expectedHeaders.every((h, i) => h === allUserFileHeaders[i])) {
          throw new Error("Excel 表头格式不正确，请使用标准模板");
        }


        // 6. 转换数据格式
        const permissionsToImport = allPermissionJsonData.slice(1).map(row => ({
          id: row[0],
          label: row[1],
          des: row[2],
          api_src: row[3],
          src: row[4],
          pid: row[5] === "顶级权限" ? '0' : row[5],
          status: row[6] === "激活" ? 1 : 0,
          is_menu: row[7] === "是" ? 1 : 0,
          icon: row[8],
          sort: row[9]
        }));
        

        // 7. 调用 API 批量导入
        apiClientWithToken.post(`/back/api/support/permission/batch_add`, {
          permissions: permissionsToImport 
        }).then(res => {
          if (res.data.code === 200) {
            toast.success(`共${permissionsToImport.length}, 成功 : ${res.data.data.success_count} 失败: ${res.data.data.error_count} `, {
              autoClose: 3000,
              closeOnClick: true,
              pauseOnHover: true,
              draggable: true,
            });
            getPermissionData(1, rowsPerPage); // 刷新数据
          } else {
            throw new Error(res.data.message || "导入失败");
          }
        }).catch(error => {
          toast.error(`导入失败: ${error.message}`, {
            autoClose: 3000,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
          });
        });
      };

      reader.readAsBinaryString(file);
    } catch (error) {
      toast.error(`导入失败: ${error.message}`, {
        autoClose: 3000,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''; // 重置文件输入
    }
  };

  const handleOutputExcel = async () => {
    // 1. 定义表头和数据映射
    const headers = [
      '权限id', '名称', '描述', 'api接口', '前端地址', '所属菜单', '状态', '是否为菜单项', '图标', "序号"
    ];
    const res = await apiClientWithToken.post("/back/api/support/permission/all", JSON.stringify({ page: -1, pagesize: 10 }));
    if (res.data.code !== 200) {
      toast.error(`导出失败 - ${res.data.message}`, {
        autoClose: 3000,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      })
      return
    }
    // 2. 转换数据格式
    const worksheetData = [
      headers, // 表头行
      ...res.data.data.data.map(permission => [
        permission.c_id,
        permission.c_label,
        permission.c_des,
        permission.c_api_src,
        permission.c_src,
        permission.c_pid == "0" ? "顶级权限" : permission.c_pid,
        permission.c_status ? "激活" : "禁用",
        permission.c_is_menu ? "是" : "否",
        permission.c_icon,
        permission.sort
      ])
    ];

    // 3. 创建工作表和工作簿
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

    // 4. 自动调整列宽
    const columnWidths = worksheetData[0].map((_, colIndex) => {
      const maxLen = Math.max(
        ...worksheetData.map(row => row[colIndex]?.toString().length || 0)
      );
      return { wch: maxLen + 2 }; // 添加2个字符的边距
    });
    worksheet['!cols'] = columnWidths;

    // 5. 创建工作簿并导出
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "权限列表");

    // 6. 生成并下载文件
    XLSX.writeFile(workbook, `权限列表-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };


  const filteredAndSortedPermissions = useMemo(() => {
    let processedpermissions = [...permissions].sort((a, b) => {
      const valA = a[orderBy];
      const valB = b[orderBy];
      if (valB < valA) return order === 'asc' ? 1 : -1;
      if (valB > valA) return order === 'asc' ? -1 : 1;
      return 0;
    });
    return processedpermissions;
  }, [permissions, order, orderBy]);


  return (
    <Paper elevation={1} sx={{ p: { xs: 2, sm: 3 } }}>
      <Typography variant="h4" component="h1" gutterBottom>
        权限管理
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        此页面用于管理平台权限、查看权限活动。
      </Typography>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ display: "flex", alignItems: "center", mb: 3, gap: 2, flexWrap: "wrap" }}>
          <TextField
            variant="outlined"
            size="small"
            placeholder="搜索权限..."
            value={searchTerm.data}
            onChange={handleSearchChange}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleSearchSubmit();
              }
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
              endAdornment: tableLaoding ? (
                <CircularProgress size={20} />
              ) : null
            }}
            sx={{ minWidth: { sm: 300 } }}
          />
          <Button
            variant="contained"
            size="small"
            onClick={handleSearchSubmit}
            disabled={tableLaoding}
            sx={{ ml: 1, minWidth: 80 }}
          >
            搜索
          </Button>
        </Box>


        <Box sx={{ display: "flex", alignItems: "center", mb: 3, gap: 2, flexWrap: "wrap" }}>
          <Box>
            <Button
              variant="contained"
              startIcon={<AddCircleOutlineIcon />}
              onClick={() => fileInputRef.current?.click()}
            >
              导入数据
            </Button>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleInputExcel}
              ref={fileInputRef}
              style={{ display: 'none' }}
            />
          </Box>
          <Button
            variant='contained'
            startIcon={<DownloadOutlined />}
            onClick={handleOutputExcel}
          >
            导出数据
          </Button>
          <Button
            variant="contained"
            startIcon={<AddCircleOutlineIcon />}
            onClick={handleAddPermissionClick}
          >
            添加权限
          </Button>
        </Box>
      </Box>
      <TableContainer component={Paper} sx={{ boxShadow: 2 }}>
        <Table aria-label="权限列表">
          <TableHead sx={{ bgcolor: 'action.focus' }}>
            <TableRow>
              {[
                { id: 'c_id', label: '权限id' },
                { id: 'c_label', label: '名称' },
                { id: "c_des", label: "描述" },
                { id: "c_api_src", label: "api接口" },
                { id: "c_src", label: "前端地址" },
                { id: "c_pid", label: "所属菜单" },
                { id: "c_status", label: "状态" },
              ].map((headCell) => (
                <TableCell
                  key={headCell.id}
                >
                  {headCell.label}
                </TableCell>
              ))}
              <TableCell align="center">操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {
              tableLaoding ? (
                <TableRow>
                  <TableCell colSpan={7} align='center' sx={{ height: "40vh" }}>
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : filteredAndSortedPermissions.length > 0 ?
                filteredAndSortedPermissions.map((permission) => (
                  <TableRow key={permission.c_id} hover>
                    <TableCell sx={{ fontWeight: 'medium' }}>{permission.c_id}</TableCell>
                    <TableCell sx={{ fontWeight: 'medium' }}>{permission.c_label}</TableCell>
                    <TableCell sx={{ fontWeight: 'medium' }}>{permission.c_des.length > 10 ? permission.c_des.slice(0, 9) + "..." : permission.c_des}</TableCell>
                    <TableCell sx={{ fontWeight: 'medium' }}>{permission.c_api_src}</TableCell>
                    <TableCell sx={{ fontWeight: 'medium' }}>{permission.c_src.trim() || ""}</TableCell>
                    <TableCell sx={{ fontWeight: 'medium' }}>{id2nameMap[permission.c_pid]}</TableCell>
                    <TableCell sx={{ fontWeight: 'medium' }}>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                        {
                          permission.c_status ?
                            <Chip key={`c_status-${permission.c_status}`} label="激活" color='success' size="small" />
                            : <Chip key={`c_status-${permission.c_status}`} label="未激活" color='error' size="small" />
                        }
                      </Box>
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title="编辑权限">
                        <IconButton size="small" onClick={() => handleEditPermissionClick(permission)} color="primary">
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="删除权限">
                        <IconButton size="small" onClick={() => handleDeletePermissionClick(permission)} color="error" disabled={false}>
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
                : (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 3 }}>
                      <Typography color="text.secondary">没有找到匹配的权限。</Typography>
                    </TableCell>
                  </TableRow>
                )
            }
          </TableBody>
        </Table>
        <TablePagination
          rowsPerPageOptions={[10, 30, 50]}
          component="div"
          count={count}
          rowsPerPage={rowsPerPage}
          page={page - 1}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          labelRowsPerPage="每页行数:"
          labelDisplayedRows={({ from, to, count }) => `${from}-${to} 共 ${count !== -1 ? count : `超过 ${to}`}`}
        />
      </TableContainer>

      <PermissionFormModal
        open={isPermissionModalOpen}
        onClose={() => setIsPermissionModalOpen(false)}
        onSave={handleSavePermission}
        initialPermission={editingPermission}
      />

      {permissionToDelete && (
        <ConfirmActionDialog
          open={isConfirmDeleteOpen}
          onClose={() => setIsConfirmDeleteOpen(false)}
          title="确认删除权限"
          message={`您确定要删除权限 "${permissionToDelete?.c_id}" 吗？此操作无法撤销。`}
          onConfirm={confirmDeletePermission}
        />
      )}

      {/* <MuiAlert severity="info" sx={{ mt: 4 }}>
        <Typography variant="subtitle2" gutterBottom>系统安全提示</Typography>
        权限的密码将通过安全的哈希算法进行加密存储。所有权限操作均会记录审计日志，确保系统安全可追溯。请定期审查权限权限，遵循最小权限原则。
      </MuiAlert> */}
    </Paper>
  );
};
export default PermissionManagementPage;