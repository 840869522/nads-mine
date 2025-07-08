"use client";
import React, { useEffect } from 'react';
import Box from '@mui/material/Box';
import { usePathname, useRouter } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import PageWrapper from '@/components/layout/PageWrapper';
import { useAuth } from '@/hooks/useAuth';
import { GetUserRole, USER_ROLES_CONFIG } from '@/constants';
import { UserRole } from '@/types';
import { getCookie } from '@/utils/cookie';
import path from 'path';

const DRAWER_WIDTH = 250;

const ROUTE_PERMISSIONS = [
  { prefix: '/', key: 'databoard_view' },
  { prefix: '/learn/quiz', key: 'study_test' },
  { prefix: '/learn/cases', key: 'study_case' },
  { prefix: '/learn/docs', key: 'study_questions' },
  { prefix: "/learn/learn", key: "study_learn" },
  { prefix: '/scenario/envirments', key: 'SCENARIO_ENVIRONMENTS_CONFIG' },
  { prefix: '/scenario/manage', key: 'scene_setting' },
  { prefix: '/ad', key: 'ad_test' },
  { prefix: '/ad/team', key: 'ad' },
  { prefix: '/admin/users', key: 'support_user' },
  { prefix: '/admin/roles', key: 'support_role' },
  { prefix: '/scenario/images', key: 'support_images_manage' },
  { prefix: '/scenario/instances', key: 'support_instances_manage' },
  { prefix: '/scenario/vm-images', key: 'support_scenario_images_manage' },
  { prefix: '/scenario/vm-instances', key: 'support_scenario_instances_manage' },
];

export default function AppContent({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {;
    const permissionsData = user?.permission || [];
    const roleData = user?.role || [];
    const token = getCookie("_auth");
    if (!token) {
      if (pathname !== '/login') {
        router.replace('/login');
      }
    } else {
      const match = ROUTE_PERMISSIONS.find(r => pathname === r.prefix);
      if (match) {
        if (!roleData.includes(UserRole.ADMIN) )
          if (!permissionsData.includes(match.key)) {
            router.replace('/');
            return;
          }
      }
    }
  }, [user, pathname, router]);


  const showSidebar = Boolean(user) && pathname !== '/login';

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {showSidebar && <Sidebar drawerWidth={DRAWER_WIDTH} />}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: showSidebar ? `calc(100% - ${DRAWER_WIDTH}px)` : '100%',
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          overflow: 'hidden',
        }}
      >
        {showSidebar ? <PageWrapper>{children}</PageWrapper> : children}
      </Box>
    </Box>
  );
}
