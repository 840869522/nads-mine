// src/hooks/useDebounce.ts
import { useState, useEffect } from 'react';

/**
 * 一个自定义 Hook，用于对值进行防抖处理。
 * @param value 需要防抖的值 (例如：搜索框的输入)
 * @param delay 防抖延迟时间 (毫秒)
 * @returns 返回延迟更新后的值
 */
export function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);

    useEffect(() => {
        // 设置一个计时器，在 delay 毫秒后更新 debouncedValue
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        // 清理函数：在下一次 effect 执行前或组件卸载时，清除上一个计时器
        // 这确保了只有在用户停止输入 delay 时间后，值才会被更新
        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]); // 仅当 value 或 delay 变化时，才重新设置计时器

    return debouncedValue;
}