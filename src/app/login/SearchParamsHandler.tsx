"use client";

import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useThemeMode } from '@/contexts/ThemeModeContext';

export default function SearchParamsHandler() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { logout } = useAuth();
  const { setThemeMode } = useThemeMode();

  useEffect(() => {
    const op = searchParams.get("op");
    if (op === "logout") {
      logout();
      setTimeout(() => {
        if (document.cookie.includes("_auth")) {
          setThemeMode(localStorage.getItem("themeMode") || "light");
          window.location.reload();
        }
      }, 500);
    } else {
      if (document.cookie.includes("_auth")) {
        router.push("/");
      }
    }
  }, []);

  return null;
}