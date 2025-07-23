"use client";

import React, { ReactNode, useEffect, useState } from 'react';
import {
    Checkbox,
    FormControlLabel,
    List,
    ListItem,
    Typography,
    Box,
    Paper,
} from '@mui/material';
import { AppPermission } from '@/types';
import { userPermissionContext } from '@/contexts/PermissionAndMenuContext';

interface PermissionFormProps {
    permissions: AppPermission[],
    onPermissionChange: (permissions: string[]) => void,
    initialSelected?: string[],
    children: ReactNode
}

const PermissionForm: React.FC<PermissionFormProps> = ({
    onPermissionChange,
    initialSelected = [],
    children
}) => {
    const [selected, setSelected] = useState<string[]>(initialSelected);
    const { appAllPermission } = userPermissionContext();

    // 处理权限变更（勾选/取消勾选）
    const handlePermissionChange = (permissionKey: string, isChecked: boolean) => {
        var newSelected = [...selected];

        // 1. 查找目标权限及其父级
        const returnData = findPermissionByKey(appAllPermission, permissionKey);
        if (!returnData) return;
        const permission = returnData.node;
        const directParent = returnData.parent;
        if (!permission) return;

        if (permission.children) {
            // 2.1 处理父级权限
            if (isChecked) {
                // 勾选父级时添加所有子权限
                const allDescendants = getAllDescendantKeys(permission);
                newSelected.push(...allDescendants);
                let currentParent = directParent;
                while (currentParent) {
                    const allChildrenSelected = currentParent?.children?.every(child => {
                        const descendants = getAllDescendantKeys(child);
                        return descendants.every(desc => newSelected.includes(desc));
                    });
                    const someChildSelected = currentParent?.children?.some(child => {
                        const descendants = getAllDescendantKeys(child);
                        return descendants.every(desc => newSelected.includes(desc));
                    })

                    const parentKey = currentParent.key;

                    if (allChildrenSelected || someChildSelected) {
                        if (!newSelected.includes(parentKey)) {
                            newSelected.push(parentKey);
                        }
                    } else {
                        const idx = newSelected.indexOf(parentKey);
                        if (idx > -1) {
                            newSelected.splice(idx, 1);
                        }
                    }
                    // 继续向上查找父级
                    const parentResult = findPermissionByKey(appAllPermission, currentParent.key);
                    currentParent = parentResult?.parent || null;
                }
            } else {
                // 取消父级时移除所有子权限
                const allDescendants = getAllDescendantKeys(permission);
                newSelected = newSelected.filter(k => !allDescendants.includes(k) && k !== permissionKey);
            }
        } else {
            // 2.2 处理子级权限
            const updated = isChecked
                ? [...newSelected, permissionKey]
                : newSelected.filter(k => k !== permissionKey);

            newSelected.length = 0;
            newSelected.push(...updated);
            // 3. 向上更新所有父级权限的选中状态
            let currentParent = directParent;
            while (currentParent) {
                const allChildrenSelected = currentParent?.children?.every(child => {
                    const descendants = getAllDescendantKeys(child);
                    return descendants.every(desc => newSelected.includes(desc));
                });
                const someChildSelected = currentParent?.children?.some(child => {
                    const descendants = getAllDescendantKeys(child);
                    return descendants.every(desc => newSelected.includes(desc));
                })

                const parentKey = currentParent.key;

                if (allChildrenSelected || someChildSelected) {
                    if (!newSelected.includes(parentKey)) {
                        newSelected.push(parentKey);
                    }
                } else {
                    const idx = newSelected.indexOf(parentKey);
                    if (idx > -1) {
                        newSelected.splice(idx, 1);
                    }
                }
                // 继续向上查找父级
                const parentResult = findPermissionByKey(appAllPermission, currentParent.key);
                currentParent = parentResult?.parent || null;
            }
        }
        const uniqueSelected = [...new Set(newSelected)];
        setSelected(uniqueSelected);
        onPermissionChange(uniqueSelected);
    };

    // 递归查找权限
    const findPermissionByKey = (
        perms: AppPermission[],
        key: string,
        parent: AppPermission | null = null
    ): { node: AppPermission | null, parent: AppPermission | null } | null => {
        for (const perm of perms) {
            if (perm.key === key) return { node: perm, parent };
            if (perm.children) {
                const found = findPermissionByKey(perm.children, key, perm);
                if (found) return found;
            }
        }
        return null;
    };

    // 获取权限及其所有子权限的 key 列表（包括嵌套层级）
    function getAllDescendantKeys(permission: AppPermission): string[] {
        let keys: string[] = [permission.key];
        if (permission.children) {
            for (const child of permission.children) {
                keys = keys.concat(getAllDescendantKeys(child));
            }
        }
        return keys;
    }

    // 渲染权限树
    const renderPermissions = (perms: AppPermission[], level = 2) => {
        if (perms.length === 0)
            return null;
        return perms.map((perm) => {
            const isParent = !!perm.children || perm.key === "databoard_view";
            const allDescendants = getAllDescendantKeys(perm);

            // 检查所有后代是否都被选中
            const allChildrenSelected = isParent &&
                allDescendants.every(key => selected.includes(key));

            // 检查是否有任意后代被选中
            const someChildSelected = isParent &&
                allDescendants.some(key => selected.includes(key));

            // 基于完整后代状态计算半选状态
            const indeterminate = isParent &&
                someChildSelected &&
                !allChildrenSelected;

            return (
                <React.Fragment key={perm.key}>
                    {isParent ? (
                        // 父级权限：直接渲染标题 + 子项，不使用 Accordion
                        <React.Fragment>
                            <ListItem sx={{ p: 0 }}>
                                <FormControlLabel
                                    control={
                                        <Checkbox
                                            checked={selected.includes(perm.key) || allChildrenSelected}
                                            indeterminate={indeterminate}
                                            onChange={(e) => handlePermissionChange(perm.key, e.target.checked)}
                                            size="small"
                                        />
                                    }
                                    label={
                                        <Typography variant="body2">
                                            {perm.label}
                                        </Typography>
                                    }
                                    sx={{
                                        pl: level,
                                    }}
                                />
                            </ListItem>
                            {renderPermissions(perm?.children! || [], level + 2)}
                        </React.Fragment>
                    ) : (
                        <ListItem sx={{ p: 0 }}>
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={selected.includes(perm.key)}
                                        onChange={(e) => handlePermissionChange(perm.key, e.target.checked)}
                                        size="small"
                                    />
                                }
                                label={
                                    <Typography variant="body2">
                                        {perm.label}
                                    </Typography>
                                }
                                sx={{
                                    pl: level + 2,
                                }}
                            />
                        </ListItem>
                    )}
                </React.Fragment>
            );
        });
    };
    return (
        <Box sx={{ flex: 1 }}>
            <Typography variant="h6" gutterBottom>
                权限分配
                {children}
            </Typography>
            <Paper variant="outlined" sx={{ maxHeight: 400, overflowY: 'auto', p: 0 }}>
                <List disablePadding >
                    {renderPermissions(appAllPermission)}
                </List>
            </Paper>
        </Box>
    );
};

export default PermissionForm;