"use client";
import React, { useEffect } from "react";
import Header from "@/app/visualization/header";
// import Battlefield from "./battlefield";

import dynamic from 'next/dynamic';
import ThreeDimensional from "./threeDimensional";
import { websocketClient } from "@/utils/websocket";

const Battlefield = dynamic(() => import('./battlefield'), { ssr: false });

if (typeof window !== 'undefined') {
    ;(window as any).CESIUM_BASE_URL = '/mapdata/cesium/';
}

const ADPage: React.FC = () => {
    let id:string|null = localStorage.getItem('instance_id');
        if (id !== null) {
            sessionStorage.setItem('instance_id', id); // 存到每个标签页独立的 sessionStorage
            localStorage.removeItem('instance_id');           // 用完就删
        }
    id = sessionStorage.getItem('instance_id') ;
    useEffect(()=>{
        websocketClient.connect();
    })
    return (
        <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', background: 'black' }}>
            <Header/>
            {/* <Battlefield/> */}
            <ThreeDimensional id={id ?? ''}/>
        </div>
    );
}

export default ADPage;