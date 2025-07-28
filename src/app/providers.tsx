"use client";
import React from 'react';
import { AppThemeProvider } from '@/contexts/ThemeModeContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { ExecTerminalProvider } from '@/contexts/ExecTerminalContext';
import CssBaseline from '@mui/material/CssBaseline';
import { PermissionAndMenuContextProvider } from '@/contexts/PermissionAndMenuContext';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AppThemeProvider>
      <CssBaseline />
      <AuthProvider>
        <PermissionAndMenuContextProvider>
          <ExecTerminalProvider>{children}</ExecTerminalProvider>
        </PermissionAndMenuContextProvider>
      </AuthProvider>
    </AppThemeProvider>
  );
}
