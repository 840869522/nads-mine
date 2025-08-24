"use client";
import React, { useEffect } from "react";
import Header from "@/app/visualization/header";
import Battlefield from "./battlefield";
import axios from 'axios';

if (typeof window !== 'undefined') {
    ;(window as any).CESIUM_BASE_URL = 'http://localhost:8090/cesium/';
}

async function getVmsByAdConfigId(adConfigId: string) {
  try {
    const response = await axios.post('back/api/ad/vms', { adConfigId });
    if (response.data.status === 'success') {
      return response.data.data; // 直接返回数组
    } else {
      console.error('Error fetching VMs:', response.data.message);
      return [];
    }
  } catch (err) {
    console.error('Request failed:', err);
    return [];
  }
}

const ADPage: React.FC = () => {
    useEffect(()=>{
        const adConfigId = '2658dff5-dbf0-4004-aa02-b24c52c3fe7d';
        try {
            const vms = getVmsByAdConfigId(adConfigId);
            console.log('虚拟机列表:', vms);
        } catch (err) {
            console.error('获取虚拟机失败:', err);
        }
    })
    return (
        <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', background: 'black' }}>
            <Header/>
            <Battlefield/>
        </div>
    );
}

export default ADPage;