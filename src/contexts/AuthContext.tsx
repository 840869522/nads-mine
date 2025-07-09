
"use client";
import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { User, UserRole } from '../types';
import { apiClient } from '@/utils/axios';
import { deleteCookie, setCookie } from '@/utils/cookie';
import { getCookie } from '@/utils/cookie';
import { BACK_IP_PORT } from '@/constants';


interface AuthContextType {
  user: { user: {}, role: [] } | null;
  login: (username: string, Np: string) => Promise<void>; // Np to avoid password keyword for simple demo
  logout: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<{ user: {}; role: []; permission: [] } | null>(null);
  useEffect(() => {
    // Load any existing session from localStorage
    const storedUser = localStorage.getItem('droneSimUser');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  const login = async (username: string, Np: string) => {
    const res = await apiClient.post(`/api/php/support/user/login`, JSON.stringify({ username, password: Np }));
    const data = await res.data;
    if (data.code === 200) {
      var loggedInUser = { user: data.data.user, role: data.data.role, permission: data.data.permissions };
      
      setUser(loggedInUser);
      localStorage.setItem('droneSimUser', JSON.stringify(loggedInUser));
      setCookie("_auth", data.data.token, {});
      setTimeout(()=>{
        window.location.href = "/";
      },200)
    }
    else
      throw new Error(data.message || 'Invalid credentials');
  };

  const logout = () => {
    deleteCookie("_auth");
    setTimeout(() => { }, 200);
    setUser(null);
    localStorage.removeItem('droneSimUser');

  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

