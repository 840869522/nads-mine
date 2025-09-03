import { getCookie, deleteCookie } from "./cookie";
import { toast } from "react-toastify"

// 响应拦截处理
const handleResponse = async (response: Response): Promise<Response> => {
    const responseClone = response.clone();
    const contentType = response.headers.get('Content-Type') || '';
    if (contentType.includes('text/event-stream')) {
        return response;
    }
    if (response.ok) {
        const data = await responseClone.json();
        if (data?.code === 420) {
            toast.error(data.message, {
                autoClose: 3000,
                closeOnClick: true,
                pauseOnHover: true,
                draggable: true,
                position: "top-center"
            });
            deleteCookie("_auth");
            localStorage.removeItem('droneSimUser');
            setTimeout(() => { }, 200);
            window.location.href = "/login"
        }
        if (data?.code == 405) {
            toast.error(data.message, {
                autoClose: 3000,
                closeOnClick: true,
                pauseOnHover: true,
                draggable: true,
            });
        }
    }
    return response;
};

// 封装统一的 fetch 函数
const customFetch = async (
    url: string,
    options: RequestInit = {}
): Promise<Response> => {
    const token = getCookie("_auth");
    const headers = new Headers(options.headers);
    headers.set('Authorization', `${token}`);
    const response = await fetch(url, {
        ...options,
        headers,
    });
    return handleResponse(response);
};

export { customFetch };