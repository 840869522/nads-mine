"use client";

import React, { useState } from 'react';
import {
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Checkbox,
    FormControlLabel,
    List,
    ListItem,
    Typography,
    Box,
    Paper,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { APP_PERMISSIONS, AppPermission } from '@/constants';
import { Leaderboard } from '@mui/icons-material';

interface PermissionFormProps {
    permissions: AppPermission[];
    onPermissionChange: (permissions: string[]) => void;
    initialSelected?: string[];
}

const PermissionForm: React.FC<PermissionFormProps> = ({
    permissions = APP_PERMISSIONS,
    onPermissionChange,
    initialSelected = [],
    children
}) => {
    const [selected, setSelected] = useState<string[]>(initialSelected);

    // 处理权限变更（勾选/取消勾选）
    const handlePermissionChange = (permissionKey: string, isChecked: boolean) => {
        var newSelected = [...selected];

        // 查找权限对象
        const permission = findPermissionByKey(permissions, permissionKey);
        if (!permission) return;

        if (permission.children) {
            // 父级权限
            if (isChecked) {
                // 勾选父级时添加所有子权限
                newSelected.push(...[
                    permissionKey,
                    ...permission.children.map(c => c.key)
                ]);
            } else {
                // 取消父级时移除所有子权限
                newSelected = newSelected.filter(
                    key =>
                        !permission.children.some(c => key === c.key || key === permissionKey)
                );
            }
        } else {
            // 子级权限
            const parentKey = permissionKey.split('.')[0]; // 例如 "study_test" -> "study"
            const parent = findPermissionByKey(permissions, parentKey);
            if (parent?.children) {
                const allChildrenKeys = [parentKey, ...parent.children.map(c => c.key)];

                const updated = isChecked
                    ? [...newSelected, permissionKey]
                    : newSelected.filter(k => k !== permissionKey);

                // 检查是否所有子权限都被选中
                const allChildrenSelected = parent.children.every(c =>
                    updated.includes(c.key)
                );

                if (allChildrenSelected) {
                    // 自动选中父级权限
                    updated.push(parentKey);
                } else {
                    // 移除父级权限
                    updated.filter(k => k !== parentKey);
                }

                newSelected.length = 0;
                newSelected.push(...updated);
            } else {
                // 非父子关系的权限直接处理
                const idx = newSelected.indexOf(permissionKey);
                if (idx > -1) {
                    newSelected.splice(idx, 1);
                } else {
                    newSelected.push(permissionKey);
                }
            }
        }

        const uniqueSelected = [...new Set(newSelected)];
        setSelected(uniqueSelected);
        onPermissionChange(uniqueSelected);
    };

    // 递归查找权限
    const findPermissionByKey = (
        perms: AppPermission[],
        key: string
    ): AppPermission | undefined => {
        for (const perm of perms) {
            if (perm.key === key) return perm;
            if (perm.children) {
                const found = findPermissionByKey(perm.children, key);
                if (found) return found;
            }
        }
        return undefined;
    };

    // 渲染权限树
    const renderPermissions = (perms: AppPermission[], level = 0) => {
        if (perms.length === 0)
            return null;
        return perms.map((perm) => {
            const isParent = !!perm.children || perm.key === "databoard_view";
            const parentKey = perm.key;
            const allChildrenSelected =
                isParent &&
                perm.children?.every(c => selected.includes(c.key)) || false;
            const indeterminate =
                isParent &&
                perm.children?.some(c => selected.includes(c.key)) &&
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
                                            checked={selected.includes(parentKey) || allChildrenSelected}
                                            indeterminate={indeterminate}
                                            onChange={(e) => handlePermissionChange(parentKey, e.target.checked)}
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
                                        checked={selected.includes(parentKey)}
                                        onChange={(e) => handlePermissionChange(parentKey, e.target.checked)}
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
        <Box sx={{flex:1}}>
            <Typography variant="h6" gutterBottom>
                权限分配
                {children}
            </Typography>
            <Paper variant="outlined" sx={{ maxHeight: 400, overflowY: 'auto', p:0 }}>
                <List disablePadding >
                {renderPermissions(permissions)}
            </List>
            </Paper>
        </Box>
    );
};

export default PermissionForm;