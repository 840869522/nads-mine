"use client";
import React, { useEffect } from 'react';
import Box from '@mui/material/Box';
import { usePathname, useRouter } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import PageWrapper from '@/components/layout/PageWrapper';
import { useAuth } from '@/hooks/useAuth';
import { USER_ROLES_CONFIG } from '@/constants';
import { UserRole } from '@/types';

const DRAWER_WIDTH = 250;

const ROUTE_PERMISSIONS = [
  { prefix: '/', key: 'DASHBOARD_VIEW' },
  { prefix: '/learn/quiz', key: 'LEARN_QUIZ_ACCESS' },
  { prefix: '/learn/cases', key: 'LEARN_CASES_ACCESS' },
  { prefix: '/learn/docs', key: 'LEARN_QUESTION_BANK_MANAGE' },
  { prefix: '/scenario/envirments', key: 'SCENARIO_ENVIRONMENTS_CONFIG' },
  { prefix: '/scenario/manage', key: 'SCENARIO_MANAGE' },
  { prefix: '/drill', key: 'DRILL_ACCESS' },
  { prefix: '/admin/users', key: 'ADMIN_USERS_MANAGE' },
  { prefix: '/admin/roles', key: 'ADMIN_ROLES_MANAGE' },
  { prefix: '/scenario/images', key: 'SCENARIO_IMAGES_MANAGE' },
  { prefix: '/scenario/instances', key: 'SCENARIO_INSTANCES_MANAGE' },
];

export default function AppContent({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!user) {
      if (pathname !== '/login') {
        router.replace('/login');
      }
    } else {
      const match = ROUTE_PERMISSIONS.find(r => pathname.startsWith(r.prefix));
      if (match) {
        const perms = USER_ROLES_CONFIG[user.role]?.permissions || [];
        if (user.role !== UserRole.ADMIN && !perms.includes(match.key)) {
          router.replace('/login');
          return;
        }
      }
      if (pathname === '/login') {
        router.replace('/');
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
