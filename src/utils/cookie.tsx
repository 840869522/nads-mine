
const getCookie = (name: string) => {
    const cookieString = document.cookie;
    const cookies = cookieString.split('; ');
    for (let i = 0; i < cookies.length; i++) {
        const cookie = cookies[i];
        const [key, value] = cookie.split('=');
        if (key === name) {
            return decodeURIComponent(value);
        }
    }
    return null;
};

const setCookie = (name: string, value: string, options: { expires?: number, path?: string, domain?: string, secure?: boolean, httpOnly?: boolean, sameSite?: string }) => {
    const encodedValue = encodeURIComponent(value);

    let cookieString = `${name}=${encodedValue}`;

    // 设置过期时间（以天为单位）
    if (options.expires) {
        const date = new Date();
        date.setTime(date.getTime() + options.expires * 24 * 60 * 60 * 1000);
        cookieString += `; expires=${date.toUTCString()}`;
    }

    // 设置路径
    if (options.path) {
        cookieString += `; path=${options.path}`;
    }

    // 设置域名
    if (options.domain) {
        cookieString += `; domain=${options.domain}`;
    }

    // 设置安全标志
    if (options.secure) {
        cookieString += '; secure';
    }
    if (options.httpOnly) {
        cookieString += '; HttpOnly';
    }
    if (options.sameSite) {
        cookieString += `; SameSite=${options.sameSite}`;
    }
    document.cookie = cookieString;
};

const deleteCookie = (name: string, options = {}) => {
    setCookie(name, '', { ...options, expires: -1 });
};


export {
    getCookie,
    setCookie,
    deleteCookie,
}