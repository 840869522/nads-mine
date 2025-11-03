"use client";
import React, { useEffect, useMemo, useRef, useState } from 'react';
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

const CHAT_CLOSED_SIZE = 60;
const CHAT_OPEN_WIDTH = '25vw';
const CHAT_OPEN_HEIGHT = 500;

export default function AppContent({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { routeAndPermission } = userPermissionContext();
  const router = useRouter();
  const pathname = usePathname();
  const [chatOpen, setChatOpen] = useState<boolean>(false);
  const [isCheckAuth, setIsAuthCheck] = useState<boolean>(true);
  const [chatPosition, setChatPosition] = useState({ x: 100, y: 100 });
  const [chatPos, setChatPos] = useState({ right: 40, bottom: 40 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef<{ clientX: number; clientY: number }>({ clientX: 0, clientY: 0 });
  const chatRef = useRef<HTMLDivElement>(null);

  /* ---------- 拖拽事件 ---------- */
  const handleMouseDown = (e: React.MouseEvent) => {
    // 防止 ChatPage 内部元素触发拖拽
    if ((e.target as HTMLElement).closest('[data-no-drag]')) return;

    const rect = chatRef.current?.getBoundingClientRect();
    if (!rect) return;

    setIsDragging(true);
    dragStart.current = { clientX: e.clientX, clientY: e.clientY };
    e.preventDefault();
  };
const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging || !chatRef.current) return;

    const deltaX = dragStart.current.clientX - e.clientX; // 向右为正
    const deltaY = dragStart.current.clientY - e.clientY; // 向下为正

    const curRect = chatRef.current.getBoundingClientRect();
    const chatWidth = chatOpen ? curRect.width : CHAT_CLOSED_SIZE;
    const chatHeight = chatOpen ? CHAT_OPEN_HEIGHT : CHAT_CLOSED_SIZE;

    const newRight = chatPos.right + deltaX;
    const newBottom = chatPos.bottom + deltaY;

    // 边界限制
    const maxRight = window.innerWidth - (chatOpen ? 0 : CHAT_CLOSED_SIZE); // 右侧留白
    const maxBottom = window.innerHeight - (chatOpen ? 0 : CHAT_CLOSED_SIZE);

    setChatPos({
      right: Math.min(Math.max(newRight, 0), maxRight),
      bottom: Math.min(Math.max(newBottom, 0), maxBottom),
    });

    // 重置起点，准备下一次 move
    dragStart.current = { clientX: e.clientX, clientY: e.clientY };
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = 'none';
    } else {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
    };
  }, [isDragging, chatPos, chatOpen]);

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setChatOpen(true);
  };
  


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
              <Box data-no-drag>
                <ChatPage open={chatOpen} onClose={() => setChatOpen(false)} width="25vw" />
              </Box> : <AffixedFabWrapper />
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
