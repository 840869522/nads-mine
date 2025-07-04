import axios from "axios";
import { getCookie, deleteCookie } from "./cookie";

/**
 * 定义带有 token和拦截器的axios 请求客户端
 */
export const apiClientWithToken = axios.create({
    timeout: 6000,
    headers: {
        "Content-Type":"application/json"
    }
});
/**
 * 定义不带有 token和拦截器的 axios 请求客户端
 */
export const apiClient = axios.create({
    timeout: 6000,
    headers: {
        "Content-Type":"application/json"
    }
})

/**
 * 定义全局请求拦截器 添加请求头信息
 */
apiClientWithToken.interceptors.request.use(
    config=>{
        const token = getCookie("auth");
        if (token){
            config.headers['Authorization'] = token;
        }
        return config;
    },
    err=>{
        return Promise.reject(err)
    }
)

/**
 * 定义全局相应拦截器 处理token超时
 */
apiClientWithToken.interceptors.response.use(
    function (res) {
        if (res.data.code === 420){
            deleteCookie("auth");
            window.location.href = "/login"
        }
        return res
    }
    
)
