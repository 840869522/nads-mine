import { apiClientWithToken } from "@/utils/axios";
import { customFetch } from "./fetch";

interface StreamResponse {
    chunk?: string;
    done?: boolean;
}

type MessageHandler = (chunk: string) => void;
type ErrorHandler = (error: Error) => void;

/**
 * 发送流式 POST 请求并处理响应
 * @param url 请求的 URL
 * @param data 请求的数据
 * @param onMessage 接收到数据块时的回调
 * @param onError 发生错误时的回调
 */
export const streamPostRequest = async (
    url: string,
    data: any,
    onMessage: MessageHandler,
    onError: ErrorHandler
): Promise<void> => {
    const controller = new AbortController();

    try {

        const response = await customFetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Stream-Mode': 'true',
            },
            body: JSON.stringify(data),
            signal: controller.signal,
        });
        // const response = await apiClientWithToken.post(url, JSON.stringify(data), {
        //   signal: controller.signal,
        //   headers: {
        //     'Content-Type': 'application/json',
        //     'X-Stream-Mode': 'true',
        //   },
        // //   responseType: 'stream',
        // });
        if (!response.body) {
            throw new Error('响应不支持流式数据');
        }
        if (!response.ok) {
            throw new Error("网络发生错误");
        }
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            buffer += chunk;

            let lines = buffer.split('\n');
            buffer = lines.pop() || ''; // 保留未完成的行

            for (const line of lines) {
                if (line.startsWith('data:')) {
                    const dataContent = line.replace('data:', '').trim();
                    if (dataContent) {
                        onMessage(dataContent); // 直接传递 data: 后的内容
                    }
                }
            }
        }
    } catch (error) {
        if (error.name !== 'AbortError') {
            onError(error instanceof Error ? error : new Error('未知错误'));
        }
    } finally {
        controller.abort();
    }
};