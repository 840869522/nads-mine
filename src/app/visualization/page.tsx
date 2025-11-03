"use client";
import React, { useEffect, useRef, useState } from "react";
import Header from "@/app/visualization/header";
import dynamic from 'next/dynamic';
import ThreeDimensional from "./threeDimensional";

const Battlefield = dynamic(() => import('./battlefield'), { ssr: false });

if (typeof window !== 'undefined') {
    (window as any).CESIUM_BASE_URL = '/mapdata/cesium/';
}

// FPS 组件
function Fps() {
  	const [fps, setFps] = useState(0);
  	const frameCount = useRef(0);
  	const lastFpsUpdate = useRef(performance.now());
	const wsRef = useRef<WebSocket | null>(null);
    const isConnected = useRef(false); // 连接标志

  	useEffect(() => {
    	let animationId: number;

    	const update = (time: number) => {
      		frameCount.current += 1;
      		const delta = time - lastFpsUpdate.current;

      		if (delta >= 1000) {
        		setFps(Math.round((frameCount.current * 1000) / delta));
        		frameCount.current = 0;
        		lastFpsUpdate.current = time;
      		}

      		animationId = requestAnimationFrame(update);
    	};

		function createWebSocket() {
            console.log("🔗 尝试创建 WebSocket 连接");
            if (isConnected.current) {
                console.log("⚠️ WebSocket 已存在，跳过创建");
                return;
            }

            const ws = new WebSocket("wss://10.100.0.26:7189");
            wsRef.current = ws;

            ws.onopen = () => {
                console.log("✅ WebSocket 已连接");
                isConnected.current = true;
                ws.send(JSON.stringify({ action: "subscribe", topic: "uav/state" }));
            };

            ws.onmessage = (event) => {
                try {
                    const msg = JSON.parse(event.data);
                    console.log(msg);
                    //setMessage((prev) => [...prev.slice(-9), msg]);
                } catch {
                    //setMessage((prev) => [...prev.slice(-9), event.data]);
                }
            };

            ws.onclose = () => {
                console.log("⚠️ WebSocket 已关闭");
                isConnected.current = false;
                wsRef.current = null;
            };

            ws.onerror = (err) => {
                console.error("❌ WebSocket 错误:", err);
                isConnected.current = false;
            };
        }

		createWebSocket()
    	animationId = requestAnimationFrame(update);

    	return () => cancelAnimationFrame(animationId);
  	}, []);

 	return (
    	<div
      		style={{
        	position: 'fixed',
        	bottom: 10,
        	right: 10,
        	padding: '5px 10px',
        	backgroundColor: 'rgba(0,0,0,0.6)',
        	color: '#fff',
        	fontFamily: 'monospace',
        	borderRadius: 4,
        	zIndex: 9999,
      		}}
    	>
      		FPS: {fps}
    	</div>
  	);
}

export interface AdData{
	id: string;
	type: number,
    showAttack: number
}

const ADPage: React.FC = () => {
    const [adData, setAdData] = useState<AdData | null>(null);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const storedData = localStorage.getItem('adData');
            if (storedData !== null) {
                sessionStorage.setItem('adData', storedData);
                localStorage.removeItem('adData');
            }
            const sessionData = sessionStorage.getItem('adData');
			let sessionObj: AdData | null = null;
			if(sessionData)
				sessionObj = JSON.parse(sessionData) as AdData;
            setAdData(sessionObj);
        }
    },[]);
	
    return (
        <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', background: 'black' }}>
            <Header />
			{adData && (adData.type === 1 ? <Battlefield {...adData} /> : <ThreeDimensional {...adData} />)}
			{/* {adData && <Battlefield {...adData} />} */}
            {/* {adData && <ThreeDimensional {...adData} />} */}
            <Fps />
        </div>
    );
}

export default ADPage;