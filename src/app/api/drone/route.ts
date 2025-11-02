// src/app/api/ping-drone/route.ts

import { NextResponse } from 'next/server';
import axios, { AxiosError } from 'axios';

// 🚨 目标 URL：你的 Drone 服务的 /ping 接口
const PING_URL = 'http://10.100.0.9:3128/uav/state';

/**
 * Next.js API Route for GET /api/ping-drone
 * 目的：在服务端测试能否成功访问 http://127.0.0.1:3128/ping
 * @param request Request对象 (未使用)
 */
export async function GET(request: Request) {
    console.log(`[Ping Check] Attempting to connect to: ${PING_URL}`);

    // axios 配置：确保不使用任何代理，直接连接目标
    const axiosConfig = {
        timeout: 5000, // 5秒超时
        // 确保捕获所有 HTTP 状态码，进行手动处理
        validateStatus: () => true, 
        // 关键：这里没有 'proxy' 配置，避免被 Squid 拦截
    };

    try {
        // 使用 axios 发送 GET 请求到目标 URL
        const response = await axios.get(PING_URL, axiosConfig);

        // 检查请求是否成功（状态码 2xx）
        if (response.status >= 200 && response.status < 300) {
            // ✅ 成功访问
            console.log(`[Ping Check] Success. Status: ${response.status}`);
            return NextResponse.json({ 
                success: true, 
                message: "Successfully reached target /ping endpoint.",
                target: PING_URL,
                status: response.status,
                data: response.data, // 返回目标服务响应的数据
            }, { status: 200 });

        } else {
            // ❌ 服务器有响应，但状态码非 2xx (如 404, 500)
            console.error(`[Ping Check] Target responded with error status: ${response.status}`);
            return NextResponse.json({ 
                success: false, 
                message: `Connection successful, but target responded with HTTP error ${response.status}.`,
                target: PING_URL,
                status: response.status,
                error_detail: response.data,
            }, { status: 500 }); // 返回 500 表示服务端处理请求出错
        }
    } catch (error) {
        // ❌ 处理网络连接错误 (如目标服务未启动/连接被拒绝/超时)
        if (error instanceof AxiosError) {
            const errorMessage = error.code === 'ECONNREFUSED' 
                ? 'Connection Refused: Target service is likely not running at 127.0.0.1:3128.'
                : error.message;

            console.error(`[Ping Check] Network error: ${errorMessage}`);
            return NextResponse.json({ 
                success: false, 
                message: `Failed to connect to the target host: ${errorMessage}`,
                target: PING_URL,
                status: 503, // Service Unavailable
            }, { status: 503 });
        }

        // 其它未知错误
        console.error("[Ping Check] An unexpected error occurred:", error);
        return NextResponse.json({ error: "An unexpected internal error occurred" }, { status: 500 });
    }
}