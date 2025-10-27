"use client";
import React, { useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import { usePathname, useRouter } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import PageWrapper from '@/components/layout/PageWrapper';
import { useAuth } from '@/hooks/useAuth';
import { GetUserRole, USER_ROLES_CONFIG } from '@/constants';
import { UserRole } from '@/types';
import { getCookie } from '@/utils/cookie';
import { AffixedFabWrapper } from '@/components/layout/AffixedFab';
import ChatPage from "@/components/chat/page";
import { userPermissionContext } from '@/contexts/PermissionAndMenuContext';
import LoadingPage from '@/components/layout/LoadingPage';

const DRAWER_WIDTH = 250;


export default function AppContent({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { routeAndPermission } = userPermissionContext();
  const router = useRouter();
  const pathname = usePathname();
  const [chatOpen, setChatOpen] = useState<boolean>(false);
  const [isCheckAuth , setIsAuthCheck] = useState<boolean>(true);

  useEffect(() => {
    const permissionsData = user?.permission || [];
    const roleData = user?.role || [];
    const token = getCookie("_auth");
    const isGuac = pathname.startsWith('/guac');
    if (!token) {
      if (pathname !== '/login' && !isGuac) {
        router.replace('/login');
        setTimeout(() => {
          setIsAuthCheck(false);
        }, 1500)
      }
    } else {
      const match = routeAndPermission.find(r => pathname === r.prefix);
      if (match) {
        if (!roleData.includes(UserRole.ADMIN))
          if (!permissionsData.includes(match.key) && !pathname.startsWith('/visualization')) {
            router.replace('/');
            return;
          }
      }
    }
  }, [user, pathname, router]);

  const aiChat = useMemo(() => {
    if (user)
      return (
        <Box>
          <AffixedFabWrapper onClick={() => { setChatOpen(true) }} />
          {
            chatOpen &&
            <ChatPage open={chatOpen} onClose={() => setChatOpen(false)} width='25vw' />
          }
        </Box>
      )
    else {
      return null;
    }
  }, [user, chatOpen]);

  const showSidebar = Boolean(user) && pathname !== '/login' && !pathname.startsWith('/guac') && !pathname.startsWith('/visualization');

  if (isCheckAuth) {
    return <LoadingPage />
  }
  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {showSidebar && <Sidebar drawerWidth={DRAWER_WIDTH} />}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: showSidebar ? `calc(100% - ${DRAWER_WIDTH}px -25vw)` : '100%',
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          overflow: 'hidden',
        }}
      >
        {showSidebar ? <PageWrapper sx={{ width: chatOpen ? `calc(100% - 25vw)` : "100%" }}>{children}</PageWrapper> : children}
      </Box>
      {aiChat}
    </Box>
  );
}
