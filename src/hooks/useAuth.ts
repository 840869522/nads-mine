import { useContext } from 'react';
// 假设你的 AuthProvider.tsx 文件位于 ../contexts/AuthContext.tsx
// 并且它导出了 AuthContext
import { AuthContext } from '../contexts/AuthContext';

/**
 * 自定义 Hook，用于在应用中方便地访问认证状态和方法。
 * 它会在原始的认证上下文基础上，额外解析并提供 userTeamId。
 */
export const useAuth = () => {
    // 1. 从 Context 中获取原始的认证上下文
    const context = useContext(AuthContext);

    // 2. 确保 Hook 在 AuthProvider 内部使用
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }

    // ★★★ 核心修复：从 context.user 对象中解析出 team_id ★★★
    // 根据你的 AuthProvider.tsx 代码，context.user 的结构是:
    // { user: {...}, role: [...], permission: [...], team_id: 'some_id' | null }
    // 所以我们直接访问 context.user.team_id 即可。
    const userTeamId = context.user ? context.user.team_id : null;

    // 4. 返回一个包含了所有原始上下文，并额外添加了 userTeamId 的新对象
    return {
        ...context, // 这包含了原始的 user, login, logout
        userTeamId, // 这是我们新添加的、方便使用的 team_id
    };
};