
import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../../hooks/useAuth';
import { APP_NAME, USER_ROLES_CONFIG } from '../../constants';
import { useThemeMode } from '../../contexts/ThemeModeContext.tsx';

import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Collapse from '@mui/material/Collapse';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Avatar from '@mui/material/Avatar';
import Divider from '@mui/material/Divider';

import ComputerDesktopIconHero from '@heroicons/react/24/outline/ComputerDesktopIcon';
import ChartPieIcon from '@heroicons/react/24/outline/ChartPieIcon';
import AcademicCapIcon from '@heroicons/react/24/outline/AcademicCapIcon';
import AdjustmentsHorizontalIcon from '@heroicons/react/24/outline/AdjustmentsHorizontalIcon';
import CubeTransparentIcon from '@heroicons/react/24/outline/CubeTransparentIcon'; // <-- 新增这个图标
import ShieldCheckIcon from '@heroicons/react/24/outline/ShieldCheckIcon';
import DocumentTextIcon from '@heroicons/react/24/outline/DocumentTextIcon';
import QuestionMarkCircleIcon from '@heroicons/react/24/outline/QuestionMarkCircleIcon';
import ArchiveBoxIconHero from '@heroicons/react/24/outline/ArchiveBoxIcon';
import FolderOpenIconHero from '@heroicons/react/24/outline/FolderOpenIcon';
import CommandLineIcon from '@heroicons/react/24/outline/CommandLineIcon';
import Cog6ToothIcon from '@heroicons/react/24/outline/Cog6ToothIcon';
import UserGroupIcon from '@heroicons/react/24/outline/UserGroupIcon';
import KeyIcon from '@heroicons/react/24/outline/KeyIcon';
import ArrowLeftEndOnRectangleIcon  from '@heroicons/react/24/outline/ArrowLeftEndOnRectangleIcon';



import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import LogoutIcon from '@mui/icons-material/Logout';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import { Chip } from '@mui/material';


interface NavItemType {
  to?: string;
  label: string;
  icon: React.ElementType;
  children?: NavItemType[];
  requiredPermission?: string; // New: specific permission key required
}

interface SidebarProps {
  drawerWidth: number;
}

const Sidebar: React.FC<SidebarProps> = ({ drawerWidth }) => {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { mode, toggleThemeMode } = useThemeMode();

  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>(() => {
    const currentPath = pathname;
    const initialOpenMenus: Record<string, boolean> = {};
    if (currentPath.startsWith('/learn')) initialOpenMenus["人员测试分系统"] = true;
    if (currentPath.startsWith('/scenario')) initialOpenMenus["环境构建分系统"] = true;
    if (currentPath.startsWith('/drill')) initialOpenMenus["安全实验分系统"] = true; // Updated key
    if (
        currentPath.startsWith('/admin') ||
        currentPath.startsWith('/scenario/images') ||
        currentPath.startsWith('/scenario/instances') ||
        currentPath.startsWith('/scenario/vm-images') ||
        currentPath.startsWith('/scenario/vm-instances')
    )
      initialOpenMenus["基础支撑分系统"] = true; // Updated to open if viewing moved items
    return initialOpenMenus;
  });

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const navItems: NavItemType[] = [
    { to: "/", label: "仪表盘", icon: ChartPieIcon, requiredPermission: 'databoard_view' },
    {
      label: "基础支撑分系统",
      icon: Cog6ToothIcon,
      requiredPermission: 'support',
      children: [
        { to: "/admin/users", label: "用户管理", icon: UserGroupIcon, requiredPermission: 'support_user' },
        { to: "/admin/roles", label: "角色管理", icon: KeyIcon, requiredPermission: 'support_role' },
        { to: "/admin/permissions", label: "权限管理", icon: ArrowLeftEndOnRectangleIcon, requiredPermission: 'support_permission' },
        { to: "/scenario/images", label: "容器镜像管理", icon: ArchiveBoxIconHero, requiredPermission: 'support_images_manage' }, // Moved here and renamed
        { to: "/scenario/instances", label: "容器实例管理", icon: CommandLineIcon, requiredPermission: 'support_instances_manage' }, // Moved here and renamed
        { to: "/scenario/vm-images", label: "虚拟机镜像管理", icon: ArchiveBoxIconHero, requiredPermission: 'support_scenario_images_manage' },
        { to: "/scenario/vm-instances", label: "虚拟机实例管理", icon: ComputerDesktopIconHero, requiredPermission: 'support_scenario_instances_manage' }
      ]
    },
    {
      label: "环境构建分系统",
      icon: AdjustmentsHorizontalIcon,
      children: [
        // { to: "/scenario/envirments", label: "环境配置", icon: AdjustmentsHorizontalIcon, requiredPermission: 'SCENARIO_ENVIRONMENTS_CONFIG' },
        // --- 新增的子菜单 ---
        // { to: "/scenario/manage", label: "场景管理", icon: CubeTransparentIcon, requiredPermission: 'SCENARIO_MANAGE' }
        { to: "/scenario/sceneinstances", label: "场景实例管理", icon: CubeTransparentIcon },
        { to: "/scenario/manage", label: "场景管理", icon: CubeTransparentIcon, requiredPermission: 'scene_setting' }
      ]
    },
    {
      label: "安全实验分系统", // Renamed from "安全使用分系统"
      icon: ShieldCheckIcon,
      children: [
        { to: "/ad", label: "攻防演练", icon: ShieldCheckIcon, requiredPermission: 'ad_test' }, // Renamed from "安全演练"
        { to: "/ad/team", label: "队伍管理", icon: ShieldCheckIcon, requiredPermission: 'ad' } // Renamed from "安全演练"
      ]
    },
    {
      label: "人员测试分系统",
      icon: AcademicCapIcon,
      children: [
        { to: "/learn/quiz", label: "在线测验", icon: QuestionMarkCircleIcon, requiredPermission: 'study_test' },
        { to: "/learn/cases", label: "课程案例", icon: FolderOpenIconHero, requiredPermission: 'study_case' },
        { to: "/learn/docs", label: "题库管理", icon: DocumentTextIcon, requiredPermission: 'study_questions' },
        { to: "/learn/learn", label: "课程学习", icon: DocumentTextIcon, requiredPermission: 'study_learn' },
      ]
    }
  ];

  const handleMenuClick = (label: string) => {
    setOpenMenus(prev => ({ ...prev, [label]: !prev[label] }));
  };

  const filteredNavItems = useMemo(() => {
    if (!user?.role) return [];
    const userPermissions = user.permission || [];

    const filterItems = (items: NavItemType[]): NavItemType[] => {
      return items.reduce((acc, item) => {
        const hasAccess = !item.requiredPermission || userPermissions.includes(item.requiredPermission);

        if (hasAccess) {
          if (item.children) {
            const filteredChildren = filterItems(item.children);
            if (filteredChildren.length > 0) {
              acc.push({ ...item, children: filteredChildren });
            } else if (!item.requiredPermission && item.children.length > 0) {
              // This logic path might need review based on specific needs, for now, if parent accessible & has children, show if children are visible.
            }
          } else {
            acc.push(item);
          }
        }
        return acc;
      }, [] as NavItemType[]);
    };
    return filterItems(navItems);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]); // navItems is stable, so not including it

  const renderNavList = (items: NavItemType[], isSubmenu: boolean = false) => {
    return items.map((item) => {
      const IconComponent = item.icon;
      if (item.children) {
        const isOpen = openMenus[item.label] || false;
        const isParentActive = item.children.some(child => child.to && pathname.startsWith(child.to));
        return (
            <React.Fragment key={item.label}>
              <ListItemButton
                  onClick={() => handleMenuClick(item.label)}
                  sx={{ pl: isSubmenu ? 4 : 2, bgcolor: isParentActive && !isOpen ? 'action.selected' : 'inherit' }}
              >
                <ListItemIcon sx={{ minWidth: 'auto', mr: 1.5 }}>
                  <IconComponent style={{ height: 20, width: 20, color: 'currentColor' }} />
                </ListItemIcon>
                <ListItemText primary={item.label} />
                {isOpen ? <ExpandLess /> : <ExpandMore />}
              </ListItemButton>
              <Collapse in={isOpen} timeout="auto" unmountOnExit>
                <List component="div" disablePadding>
                  {renderNavList(item.children, true)}
                </List>
              </Collapse>
            </React.Fragment>
        );
      }
      return (
          item.to ? (
              <ListItemButton
                  key={item.label}
                  component={Link}
                  href={item.to}
                  selected={pathname === item.to || (item.to !== "/" && pathname.startsWith(item.to))}
                  sx={{ pl: isSubmenu ? 4 : 2 }}
              >
                <ListItemIcon sx={{ minWidth: 'auto', mr: 1.5 }}>
                  <IconComponent style={{ height: 20, width: 20, color: 'currentColor' }} />
                </ListItemIcon>
                <ListItemText primary={item.label} />
              </ListItemButton>
          ) : null
      );
    });
  };


  return (
      <Drawer
          variant="permanent"
          sx={{
            width: drawerWidth,
            flexShrink: 0,
            [`& .MuiDrawer-paper`]: {
              width: drawerWidth,
              boxSizing: 'border-box',
              bgcolor: 'background.paper',
              borderRight: '1px solid',
              borderColor: 'divider'
            },
          }}
      >
        <Toolbar sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', px: [1] }}>
          <Link href="/" style={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center' }}>
            <ComputerDesktopIconHero style={{ height: 32, width: 32, marginRight: 8, color: 'primary.main' }} />
            <Typography variant="h6" noWrap component="div" color="primary" fontWeight="bold">
              {APP_NAME}
            </Typography>
          </Link>
        </Toolbar>
        <Divider />
        <List component="nav" sx={{ flexGrow: 1, overflowY: 'auto', overflowX: 'hidden' }}>
          {renderNavList(filteredNavItems)}
        </List>
        <Divider />
        <Box sx={{ p: 2 }}>
          {user && (
              <Box component={Link} href="/profile"  sx={{ display: 'flex', alignItems: 'center', mb: 2, p: 1, borderRadius: 1, bgcolor: 'action.hover' }}>
                <Avatar sx={{ mr: 1.5, bgcolor: 'primary.main' }}>
                  <AccountCircleIcon />
                </Avatar>
                <Box>
                  <Typography variant="body2" fontWeight="medium">{user.user.c_username}</Typography>
                  <Typography variant="caption" color="text.secondary">{
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {user.role.map((role) => (
                          <Chip key={role} label={role} />
                      ))}
                    </Box>
                  }</Typography>
                </Box>
              </Box>
          )}
          <ListItemButton onClick={handleLogout}>
            <ListItemIcon sx={{ minWidth: 'auto', mr: 1.5 }}>
              <LogoutIcon />
            </ListItemIcon>
            <ListItemText primary="登出" />
          </ListItemButton>
          <ListItemButton onClick={toggleThemeMode}>
            <ListItemIcon sx={{ minWidth: 'auto', mr: 1.5 }}>
              {mode === 'dark' ? <Brightness7Icon /> : <Brightness4Icon />}
            </ListItemIcon>
            <ListItemText primary={mode === 'dark' ? '浅色模式' : '深色模式'} />
          </ListItemButton>
        </Box>
      </Drawer>
  );
};

export default Sidebar;