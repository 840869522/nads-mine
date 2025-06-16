"use client";
import React from 'react';
import { AppThemeProvider } from '@/contexts/ThemeModeContext';
import { AuthProvider } from '@/contexts/AuthContext';
import CssBaseline from '@mui/material/CssBaseline';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AppThemeProvider>
      <CssBaseline />
      <AuthProvider>{children}</AuthProvider>
    </AppThemeProvider>
  );
}
