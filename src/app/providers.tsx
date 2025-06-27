"use client";
import React from 'react';
import { AppThemeProvider } from '@/contexts/ThemeModeContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { ExecTerminalProvider } from '@/contexts/ExecTerminalContext';
import CssBaseline from '@mui/material/CssBaseline';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AppThemeProvider>
      <CssBaseline />
      <AuthProvider>
        <ExecTerminalProvider>{children}</ExecTerminalProvider>
      </AuthProvider>
    </AppThemeProvider>
  );
}
