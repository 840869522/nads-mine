import {useEffect, useState} from "react";

// 计算当前时间字符串
function getCurrentTime() {
    return new Date().toLocaleTimeString('zh-CN', { hour12: false });
}

/**
 * 计算到今天12点（或明天12点）的倒计时字符串
 */
function getCountdownTime() {
    const now = new Date();
    const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
    if (now > target) target.setDate(target.getDate() + 1);
    const diffMs = target.getTime() - now.getTime();
    const hours = Math.floor(diffMs / 3600000);
    const minutes = Math.floor((diffMs % 3600000) / 60000);
    const seconds = Math.floor((diffMs % 60000) / 1000);

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/**
 * 头部组件
 * @constructor
 */
export default function Header(){
    const [mounted, setMounted] = useState(false);
    const [currentTime, setCurrentTime] = useState(
        () => new Date().toLocaleTimeString('zh-CN', { hour12: false })
    );
    const [countdownTime, setCountdownTime] = useState('');

    useEffect(() => {
        setMounted(true);
        function updateTime() {
            setCountdownTime(getCountdownTime());
            setCurrentTime(getCurrentTime());
        }
        updateTime(); // 组件挂载后立刻更新时间
        const timer = setInterval(updateTime, 1000);
        return () => clearInterval(timer);
    }, []);

    if (!mounted) {
        // 服务端渲染和客户端首屏渲染都不显示时间
        return (
            <header className="col-span-3 p-0 relative mb-7 h-[50px] flex">
                <div className="absolute top-[25px] py-[10px] px-[20px]
                        bg-[rgba(0,30,60,0.7)] border border-[rgba(0,150,255,0.5)]
                        rounded-[80px] shadow-[0_0_15px_rgba(0,150,255,0.4)] z-[2] float-left" style={{left: '20px'}}>
                    <div className="text-[1rem] text-[#ffc800] font-medium">
                        作战时间:12:00:00
                    </div>
                </div>
                <div className="bg-[rgba(0,20,40,0.85)]
                            border border-[rgba(0,150,255,0.5)]
                            rounded-b-[15px]
                            pt-[30px] px-[50px] pb-[45px]
                            shadow-[0_0_30px_rgba(0,100,255,0.6)]
                            backdrop-blur-[6px]
                            w-1/2 min-w-[600px]
                            absolute overflow-hidden
                            clip-[polygon(0_0,100%_0,92%_100%,8%_100%)]
                            flex flex-col items-center justify-between
                            left-1/2 -translate-x-1/2">
                    <div className="text-[2.2rem] font-semibold uppercase tracking-[4px]
                            bg-gradient-to-r from-[#ff3333] to-[#3366ff] bg-clip-text text-transparent
                            relative bottom-[10px] z-[2] flex"
                            style={{
                             textShadow: "0 0 15px rgba(255,255,255,0.3)"
                    }}>红蓝无人机对抗监控系统</div>
                </div>
                <div className="absolute top-[25px] py-[10px] px-[20px]
                        bg-[rgba(0,30,60,0.7)] border border-[rgba(0,150,255,0.5)]
                        rounded-[80px] shadow-[0_0_15px_rgba(0,150,255,0.4)] z-[2] float-left" style={{right: '20px'}}>
                    <div className="text-[1rem] text-[#ffc800] font-medium">
                        倒计时:12:00:00
                    </div>
                </div>
            </header>
        );
    }

    return(
        <header className="col-span-3 p-0 relative mb-7 h-[50px] flex">
            <div className="absolute top-[25px] py-[10px] px-[20px]
                        bg-[rgba(0,30,60,0.7)] border border-[rgba(0,150,255,0.5)]
                        rounded-[80px] shadow-[0_0_15px_rgba(0,150,255,0.4)] z-[2] float-left" style={{left: '20px'}}>
                <div className="text-[1rem] text-[#ffc800] font-medium">
                    作战时间:
                    <span>{currentTime}</span>
                </div>
            </div>
            <div className="bg-[rgba(0,20,40,0.85)]
                            border border-[rgba(0,150,255,0.5)]
                            rounded-b-[15px]
                            pt-[30px] px-[50px] pb-[45px]
                            shadow-[0_0_30px_rgba(0,100,255,0.6)]
                            backdrop-blur-[6px]
                            w-1/2 min-w-[600px]
                            absolute overflow-hidden
                            clip-[polygon(0_0,100%_0,92%_100%,8%_100%)]
                            flex flex-col items-center justify-between
                            left-1/2 -translate-x-1/2">
                <div className="text-[2.2rem] font-semibold uppercase tracking-[4px]
                            bg-gradient-to-r from-[#ff3333] to-[#3366ff] bg-clip-text text-transparent
                            relative bottom-[10px] z-[2] flex"
                     style={{
                         textShadow: "0 0 15px rgba(255,255,255,0.3)"
                     }}>红蓝无人机对抗监控系统</div>
            </div>
            <div className="absolute top-[25px] py-[10px] px-[20px]
                        bg-[rgba(0,30,60,0.7)] border border-[rgba(0,150,255,0.5)]
                        rounded-[80px] shadow-[0_0_15px_rgba(0,150,255,0.4)] z-[2]" style={{right: '20px'}}>
                <div className="text-[1rem] text-[#ffc800] font-medium">
                    倒计时:
                    <span>{countdownTime}</span>
                </div>
            </div>
        </header>
    );
}