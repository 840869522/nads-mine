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
  const [isCheckAuth, setIsAuthCheck] = useState<boolean>(true);
  const [chatPosition, setChatPosition] = useState({ x: 100, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - chatPosition.x,
      y: e.clientY - chatPosition.y
    });
    e.preventDefault();
    e.stopPropagation();
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      setChatPosition({
        x: window.innerWidth - (e.clientX - dragOffset.x),
      y: window.innerHeight - (e.clientY - dragOffset.y)
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    } else {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset]);


  useEffect(() => {
    const permissionsData = user?.permission || [];
    const roleData = user?.role || [];
    const token = getCookie("_auth");
    const isGuac = pathname.startsWith('/guac');
    if (!token) {
      if (pathname !== '/login' && !isGuac) {
        router.replace('/login');
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
    setTimeout(() => {
      setIsAuthCheck(false);
    }, 1500)
  }, [user, pathname, router]);

  const aiChat = useMemo(() => {
    if (user)
      return (
        <Box
          style={{
            position: 'fixed',
            right: `${chatPosition.x}px`,
            bottom: `${chatPosition.y}px`,
            cursor: isDragging ? 'grabbing' : 'grab',
            zIndex: 1000
          }}
          onMouseDown={handleMouseDown}
          onDoubleClick={() => { setChatOpen(true) }}
        >
          {
            chatOpen ?
              <ChatPage open={chatOpen} onClose={() => setChatOpen(false)} width='25vw' /> : <AffixedFabWrapper />
          }
        </Box>
      )
    else {
      return null;
    }
  }, [user, chatOpen, chatPosition, isDragging]);

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
