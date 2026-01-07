import { customFetch } from "./fetch";
/**
 * 将 Base64 编码的字符串解码为 UTF-8 字符串（兼容性更好的版本）
 * @param str Base64 编码的字符串
 * @returns 解码后的 UTF-8 字符串
 */
const base64ToUTF8 = (str: string): string => {
    try {
        // 处理 URL 安全的 Base64 (将 - 和 _ 替换为 + 和 /)
        str = str.replace(/-/g, '+').replace(/_/g, '/');

        // 添加必要的填充
        while (str.length % 4) {
            str += '=';
        }

        // 使用 TextDecoder 解码
        const binaryString = atob(str);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return new TextDecoder('utf-8').decode(bytes);
    } catch (e) {
        console.error('Base64 解码错误:', e);
        // 降级到简单处理
        try {
            return decodeURIComponent(escape(atob(str)));
        } catch (e2) {
            // 如果都失败，返回原始字符串
            return str;
        }
    }
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
        let previousChunk = ''; // 保存上一个数据块用于检查连接处的字符

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            buffer += chunk;

            let lines = buffer.split('\n');
            buffer = lines.pop() || ''; // 保留未完成的行

            for (const line of lines) {
                if (line.trim().startsWith('data:')) {
                    let dataContent = line.substring(5).trim();
                    if (dataContent) {
                        try {
                            dataContent = base64ToUTF8(dataContent);
                            // const formattedContent = formatMarkdownContent(dataContent, previousChunk);
                            previousChunk = dataContent;
                            onMessage(dataContent);
                        } catch (decodeError) {
                            throw new Error("未知错误");
                        }
                    }
                }
            }
        }
        if (buffer && buffer.trim().startsWith('data:')) {
            let dataContent = buffer.substring(5).trim();
            if (dataContent) {
                try {
                    const decodedContent = base64ToUTF8(dataContent);
                    // const formattedContent = formatMarkdownContent(decodedContent, previousChunk);
		    onMessage(decodedContent);
                } catch (decodeError) {
                    console.warn('Base64 解码失败，使用原始数据:', decodeError);
                    onMessage(dataContent);
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
// /**
//  * 格式化 Markdown 内容，在检测到 | 或 - 且前面没有换行符时添加换行符
//  * @param content 当前内容块
//  * @param previousContent 上一个内容块
//  * @returns 格式化后的内容
//  */
// const formatMarkdownContent = (content: string, previousContent: string) => {
//     // 合并上一个内容块和当前内容块进行整体处理
//     let combinedContent = previousContent + content;

//     const pattern = /(^|[^\\n])([|])/g;

//     // 替换匹配项，在 | 或 - 前添加换行符
//     let formattedContent = combinedContent.replace(pattern, (match, prefix, symbol) => {
//         return prefix + '\n' + symbol;
//     });

//     // 返回当前内容块部分（去除之前已处理的部分）
//     return formattedContent.substring(previousContent.length);
// };
