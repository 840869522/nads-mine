// src/app/api/ping-drone/route.ts

import { NextResponse } from 'next/server';
import axios, { AxiosError, AxiosResponse } from 'axios';

// 定义一个结果结构体，用于存储每次 Ping 的状态
interface PingResult {
    url: string;
    // 'response' 表示收到了 HTTP 响应 (2xx, 4xx, 或 5xx)
    // 'network_error' 表示连接失败 (超时, ECONNREFUSED)
    type: 'response' | 'network_error'; 
    response?: AxiosResponse<any>; // 仅当 type 为 'response' 时存在
    error?: AxiosError;          // 仅当 type 为 'network_error' 时存在
}

// 定义一个函数来封装 Ping 逻辑和结果处理
async function executePing(url: string, config: any): Promise<PingResult> {
    try {
        const response = await axios.get(url, config);
        return { 
            url, 
            type: 'response', 
            response: response 
        };
    } catch (error) {
        // 捕获网络连接错误
        return { 
            url, 
            type: 'network_error', 
            error: error as AxiosError 
        };
    }
}


export async function GET(request: Request) {
    // 1. 设置和输入处理
    const { searchParams } = new URL(request.url);
    const ipsArray = searchParams.getAll('ip');
    
    const ip1 = ipsArray[0];
    const ip2 = ipsArray[1];
    
    if (!ip1) {
        return NextResponse.json({ success: false, message: "Missing required IP parameter." }, { status: 400 });
    }

    const PING_URL1 = `http://${ip1}:3128/get_control_signal`;
    const PING_URL2 = ip2 ? `http://${ip2}:3128/get_control_signal` : null;

    const axiosConfig = {
        timeout: 5000, 
        validateStatus: () => true, // 确保捕获所有 HTTP 状态码
    };

    let result1: PingResult;
    let result2: PingResult | null = null;

    // --- 2. 执行 PING_URL1 ---
    result1 = await executePing(PING_URL1, axiosConfig);
    
    // --- 3. 执行 PING_URL2 (如果存在) ---
    if (PING_URL2) {
        result2 = await executePing(PING_URL2, axiosConfig);
    }
    
    // --- 4. 确定最终返回结果 (实现用户逻辑) ---
    
    let finalResult = result1;
    let responseStatus = 500; // 默认失败状态
    
    const is1Success = result1.type === 'response' && result1.response!.status >= 200 && result1.response!.status < 300;
    const is2Success = result2 && result2.type === 'response' && result2.response!.status >= 200 && result2.response!.status < 300;

    if (is1Success) {
        // 规则 1: PING_URL1 成功，返回 PING_URL1 (优先)
        finalResult = result1;
        responseStatus = 200;
    } else if (is2Success) {
        // 规则 2: PING_URL1 失败，但 PING_URL2 成功，返回 PING_URL2
        finalResult = result2!;
        responseStatus = 200;
    } else if (result1.type === 'network_error' && result2?.type === 'network_error') {
        // 规则 3: 两个都失败（网络错误），返回第一个（result1）的错误信息
        finalResult = result1; 
        responseStatus = 503;
    } else if (result2?.type === 'response') {
        // 规则 4: PING_URL1 失败，但 PING_URL2 返回了非 2xx 响应（非网络错误），返回 PING_URL2
        finalResult = result2; 
        responseStatus = 500;
    } else {
        // 规则 5: PING_URL1 是非 2xx 响应，且 PING_URL2 不存在或失败，返回 PING_URL1
        finalResult = result1;
        responseStatus = 500;
    }
    
    // --- 5. 格式化并返回 NextResponse ---
    
    if (finalResult.type === 'response') {
        // 处理成功 (2xx) 或非 2xx 响应
        const response = finalResult.response!;
        const targetUrl = finalResult.url;

        if (response.status >= 200 && response.status < 300) {
            // ✅ 成功访问
            console.log(`[Ping Check] Success. Status: ${response.status} at ${targetUrl}`);
            return NextResponse.json({ 
                success: true, 
                message: "Successfully reached target /ping endpoint.",
                target: targetUrl,
                status: response.status,
                data: response.data,
            }, { status: 200 });

        } else {
            // ❌ 服务器有响应，但状态码非 2xx (如 404, 500)
            console.error(`[Ping Check] Target responded with error status: ${response.status} at ${targetUrl}`);
            return NextResponse.json({ 
                success: false, 
                message: `Connection successful, but target responded with HTTP error ${response.status}.`,
                target: targetUrl,
                status: response.status,
                error_detail: response.data,
            }, { status: 500 });
        }

    } else if (finalResult.type === 'network_error') {
        // 处理网络连接错误
        const error = finalResult.error!;
        const targetUrl = finalResult.url;
        
        // 动态获取目标 URL (使用 error.config?.url)
        const targetUrlFromError = error.config?.url || targetUrl; 
        
        const errorMessage = error.code === 'ECONNREFUSED' 
            ? `Connection Refused to ${targetUrlFromError}: Target service is likely not running.`
            : error.message;

        console.error(`[Ping Check] Network error: ${errorMessage}`);
        
        return NextResponse.json({ 
            success: false, 
            message: `Failed to connect to the target host (${targetUrlFromError}): ${errorMessage}`,
            target: targetUrlFromError,
            status: 503, // Service Unavailable
        }, { status: 503 });
    }
    
    // 默认未知错误
    console.error("[Ping Check] An unexpected error occurred: No final result determined.");
    return NextResponse.json({ error: "An unexpected internal error occurred" }, { status: 500 });
}