"use client";
import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { apiClient, apiClientWithToken } from '@/utils/axios';
import { deleteCookie, setCookie, getCookie } from '@/utils/cookie';

// ★ 1. 更新类型定义：为 user 对象添加 team_id 属性
interface UserAuthData {
    user: object;
    role: string[];
    permission: string[];
    team_id: string | null; // team_id 可以是字符串或 null
}

interface AuthContextType {
    user: UserAuthData | null;
    login: (username: string, Np: string) => Promise<void>;
    logout: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
    children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
    // ★ 2. 更新 useState 的类型
    const [user, setUser] = useState<UserAuthData | null>(null);

    useEffect(() => {
        const hydrateFromToken = async () => {
            try {
                const res = await apiClientWithToken.get("/back/api/support/user/me");
                const data = res.data;
                if (data?.code === 200 && data?.data) {
                    const hydrated: UserAuthData = {
                        user: data.data.user,
                        role: data.data.role,
                        permission: data.data.permissions,
                        team_id: data.data.team_id ?? null,
                    };
                    setUser(hydrated);
                    localStorage.setItem('droneSimUser', JSON.stringify(hydrated));
                }
            } catch {
                // ignore errors
            }
        };

        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            const tokenFromQuery = params.get('token');
            if (tokenFromQuery && !getCookie('_auth')) {
                setCookie('_auth', tokenFromQuery, {});
            }
        }

        const storedUser = localStorage.getItem('droneSimUser');
        if (storedUser) {
            setUser(JSON.parse(storedUser));
        }

        if (getCookie('_auth')) {
            hydrateFromToken();
        }
    }, []);

    const login = async (username: string, Np: string) => {
        const res = await apiClient.post(`/back/api/support/user/login`, JSON.stringify({ username, password: Np }));
        const data = await res.data;
        if (data.code === 200) {
            // ★★★ 3. 核心修复：在构建 loggedInUser 对象时，包含 team_id ★★★
            const loggedInUser: UserAuthData = {
                user: data.data.user,
                role: data.data.role,
                permission: data.data.permissions,
                team_id: data.data.team_id // 从 API 响应中获取 team_id
            };

            setUser(loggedInUser);
            localStorage.setItem('droneSimUser', JSON.stringify(loggedInUser));
            setCookie("_auth", data.data.token, {});
            setTimeout(()=>{
                window.location.href = "/";
            }, 200);
        }
        else {
            throw new Error(data.message || 'Invalid credentials');
        }
    };

    const logout = async () => {
        const res = await apiClientWithToken.post("/back/api/support/user/logout")
        deleteCookie("_auth");
        setUser(null);
        localStorage.removeItem('droneSimUser');
    };

    return (
        <AuthContext.Provider value={{ user, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};
