
"use client";
import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { User, UserRole } from '../types';
import { apiClient } from '@/utils/axios';
import { deleteCookie, setCookie } from '@/utils/cookie';


interface AuthContextType {
  user: {user:{},role:[]} | null;
  login: (username: string, Np: string) => Promise<void>; // Np to avoid password keyword for simple demo
  logout: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<{user:{},role:[]} | null>(null);
  useEffect(() => {
    // Load any existing session from localStorage
    const storedUser = localStorage.getItem('droneSimUser');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  const login = async (username: string, Np: string) => {
    const res = await apiClient.post('/api/user/login', JSON.stringify({ username, password: Np }));
    const data = await res.data;
    if (data.code ===  200 ) {
      var loggedInUser = {user:data.data.user,role:data.data.role};
      if (data.data.role.includes(UserRole.ADMIN)){
        loggedInUser = {user:data.data.user,role:UserRole.ADMIN};
      }else if (data.data.role.includes(UserRole.STUDENT)){
        loggedInUser = {user:data.data.user,role:UserRole.STUDENT};
      }
      setUser(loggedInUser);
      localStorage.setItem('droneSimUser', JSON.stringify(loggedInUser));
      setCookie("_auth",data.data.token,{});
      setTimeout(()=>{
        window.location.href = "/";
      },200);
    }
    else
      throw new Error(data.message || 'Invalid credentials');
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('droneSimUser');
    deleteCookie("_auth");
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

