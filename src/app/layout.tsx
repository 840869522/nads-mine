import '../globals.css';
import React from 'react';
import { Providers } from './providers';
import AppContent from './AppContent';
import { toast, ToastContainer } from "react-toastify";

export const metadata = {
  title: '无人机网络安全实验平台'
};


export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <Providers>
          <AppContent>{children}</AppContent>
        </Providers>
        <ToastContainer closeButton={true} position="top-right" />
      </body>
    </html>
  );
}

