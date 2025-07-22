import axios from "axios";
import { getCookie, deleteCookie } from "./cookie";
import {toast} from "react-toastify"
import { BACK_IP_PORT } from "@/constants";


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
        const token = getCookie("_auth");
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
            toast.error(res.data.message,{
                autoClose: 3000,
                closeOnClick: true,
                pauseOnHover: true,
                draggable: true,
                position:"top-center"
            });
            deleteCookie("_auth");
            localStorage.removeItem('droneSimUser');
            setTimeout(()=>{},200);
            window.location.href = "/login"
        }
        if (res.data.code == 405){
            toast.error(res.data.message,{
                autoClose: 3000,
                closeOnClick: true,
                pauseOnHover: true,
                draggable: true,
                position:"top-center"
            });
             setTimeout(()=>{},200);
            window.location.href = "/";
        }
        return res
    }
    
)
