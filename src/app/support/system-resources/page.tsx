"use client";

import React from 'react';
import useSWR from 'swr';
import {
  Box,
  Card,
  CardContent,
  LinearProgress,
  Stack,
  Typography,
  Skeleton,
  createTheme,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PauseCircleIcon from '@mui/icons-material/PauseCircle';
import ErrorIcon from '@mui/icons-material/Error';
import { customFetch } from '@/utils/fetch';
import { InstanceStatus, RunningInstance } from '@/types';
import { DiskUsage } from '@/services/systemMetrics';
import { useState, useEffect, useRef } from 'react';
import { 
  Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  AreaChart, Area, PieChart, Pie
} from 'recharts';
import { 
  Memory, Dns, Album, Storage,
  Warning, Terminal, Security, 
  Hub, CheckCircle, ViewModule,
  PauseCircle, StopCircle, Loop,
  RemoveCircle, Delete,Error as MuiError
} from '@mui/icons-material';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

interface SystemResources {
  cpu: {
    cores: number;
    usagePercent: number;
  };
  memory: {
    total: number;
    used: number;
    free: number;
    usedPercent: number;
  };
  disks: DiskUsage[];
}

interface VmInstance {
  id: string;
  name: string;
  hostNode: string;
  pool: string;
  state: "running" | "paused" | "shutoff" | "shut off";
  vcpu: number;
  vmem: number;
  ip?: string;
  scene_instance_id?: string;
  scene_name?: string;
  uptime?: string;
}

interface VmDetailResponse {
  vram?: {
    total_mb?: number;
  };
}

const fetcher = (url: string) => customFetch(url).then(res => res.json());

const formatBytes = (bytes: number) => {
  if (!bytes && bytes !== 0) return '未知';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(1)} ${units[index]}`;
};

const statusColor = (status: string) => {
  switch (status) {
    case 'running':
      return 'success';
    case 'paused':
      return 'warning';
    case 'shutoff':
    case 'shut off':
    case 'stopped':
      return 'default';
    default:
      return 'error';
  }
};

const statusIcon = (status: string) => {
  switch (status) {
    case 'running':
      return <CheckCircleIcon fontSize="small" color="success" />;
    case 'paused':
      return <PauseCircleIcon fontSize="small" color="warning" />;
    case 'shutoff':
    case 'shut off':
    case 'stopped':
      return <PauseCircleIcon fontSize="small" color="action" />;
    default:
      return <ErrorIcon fontSize="small" color="error" />;
  }
};

const MetricSparkline = ({ data, color = '#1976d2' }: { data: number[]; color?: string }) => {
  const width = 160;
  const height = 48;

  if (!data.length) {
    return <Skeleton variant="rectangular" height={height} />;
  }

  const maxValue = Math.max(100, ...data);
  const points = data
    .map((value, index) => {
      const x = (index / Math.max(data.length - 1, 1)) * width;
      const y = height - (value / maxValue) * height;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        points={points}
      />
    </svg>
  );
};

const ResourceCard = ({
  title,
  icon,
  percent,
  value,
  helperText,
  loading,
  chart
}: {
  title: string;
  icon: React.ReactNode;
  percent?: number;
  value: string;
  helperText?: string;
  loading?: boolean;
  chart?: React.ReactNode;
}) => (
  <Card sx={{ height: '100%' }}>
    <CardContent>
      <Stack direction="row" spacing={1} alignItems="center" mb={1}>
        {icon}
        <Typography variant="subtitle1">{title}</Typography>
      </Stack>
      <Typography variant="h4" component="div" sx={{ fontWeight: 600, mb: 1 }}>
        {loading ? <Skeleton width={140} /> : value}
      </Typography>
      {percent !== undefined && (
        <Box sx={{ mb: 1 }}>
          <LinearProgress variant="determinate" value={percent} sx={{ height: 10, borderRadius: 1 }} />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {percent.toFixed(1)}%
          </Typography>
        </Box>
      )}
      {chart && <Box sx={{ mt: 1 }}>{chart}</Box>}
      {helperText && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {loading ? <Skeleton width={200} /> : helperText}
        </Typography>
      )}
    </CardContent>
  </Card>
);

const COLORS = {
  dark: '#020617',    // bg-cyber-dark
  panel: '#0f172a',   // bg-cyber-panel
  cyan: '#06b6d4',    // text-[#06b6d4]
  blue: '#3b82f6',
  purple: '#8b5cf6',
  grid: '#1e293b'
};

const GlobalStyles = () => (
  <style>{`
    html, body, #root {
      width: 100%;
      height: 100%;
      margin: 0;
      padding: 0;
    }
    body {
      background-color: ${COLORS.dark};
      color: #e2e8f0;
      overflow-x: hidden;
    }
    /* Custom scrollbar for cyberpunk look */
    ::-webkit-scrollbar {
      width: 6px;
      height: 6px;
    }
    ::-webkit-scrollbar-track {
      background: ${COLORS.panel}; 
    }
    ::-webkit-scrollbar-thumb {
      background: ${COLORS.cyan}; 
      border-radius: 3px;
    }
    .bg-grid-pattern {
      background-image: linear-gradient(to right, #1e293b 1px, transparent 1px), linear-gradient(to bottom, #1e293b 1px, transparent 1px);
      background-size: 30px 30px;
    }
  `}</style>
);

const standaloneTheme = createTheme({
  components: {
    // 关键：禁用 MUI 试图去覆盖背景色和文字颜色的默认行为
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          color: 'inherit', // 强制继承你自己写的颜色，而不是主题色
          backgroundColor: 'inherit',
        }
      }
    }
  }
});

const CyberPanel = ({ 
  title, 
  children, 
  className = "", 
}: { 
  title?: string; 
  children?: React.ReactNode; 
  className?: string;
}) => {
  return (
    <div className={`relative bg-[#0f172a]/40 border border-[#06b6d4]/30 backdrop-blur-sm shadow-[0_0_15px_rgba(6,182,212,0.1)] flex flex-col h-full ${className}`}>
      {/* Corner decorations */}
      <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-[#06b6d4]"></div>
      <div className="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-[#06b6d4]"></div>
      <div className="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-[#06b6d4]"></div>
      <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-[#06b6d4]"></div>
      
      {/* Header Line Decoration */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#06b6d4]/50 to-transparent opacity-50"></div>

      {title && (
        <div className="flex items-center px-4 py-2 border-b border-[#06b6d4]/20 bg-[#020617]/30 shrink-0">
           <div className="w-1 h-4 bg-[#06b6d4] mr-2 shadow-[0_0_8px_#06b6d4]"></div>
           <h3 className="text-[#06b6d4] font-bold tracking-wider text-sm md:text-base uppercase shadow-black drop-shadow-md">
            {title}
           </h3>
           <div className="flex-grow ml-4 h-[1px] bg-gradient-to-r from-[#06b6d4]/30 to-transparent"></div>
        </div>
      )}
      <div className="flex-grow p-2 overflow-hidden relative min-h-0">
        {children}
      </div>
    </div>
  );
};

const Header = () => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="relative w-full h-16 mb-2 flex justify-between items-center px-4 md:px-8 bg-[#020617] border-b border-[#06b6d4]/30 shadow-[0_0_20px_rgba(6,182,212,0.15)] shrink-0 z-50">
      {/* Left: Date and Week */}
      <div className="text-[#06b6d4] font-mono w-1/4 flex items-center gap-4">
        <span className="text-sm md:text-lg tracking-wide">{time.toLocaleDateString()}</span>
        <span className="text-xs md:text-base text-slate-400">星期{['日','一','二','三','四','五','六'][time.getDay()]}</span>
      </div>

      {/* Center Title */}
      <div className="relative flex-grow flex justify-center items-center h-full">
         <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-[#06b6d4] to-transparent shadow-[0_0_10px_#06b6d4]"></div>
         <div className="h-full w-3/4 md:w-1/2 bg-gradient-to-b from-[#3b82f6]/10 to-transparent transform -skew-x-12 absolute z-0 border-x border-[#3b82f6]/20"></div>
         
         <h1 className="text-lg md:text-2xl lg:text-3xl font-black tracking-[0.2em] text-transparent bg-clip-text bg-gradient-to-b from-white to-[#06b6d4] z-10 drop-shadow-[0_0_10px_rgba(6,182,212,0.8)] text-center">
            系统资源监控管理
         </h1>
      </div>

      {/* Right: Specific Time */}
      <div className="w-1/4 flex justify-end items-center text-[#06b6d4]">
         <div className="font-mono text-xl md:text-3xl font-bold text-glow tracking-widest">
            {time.toLocaleTimeString([], { hour12: false })}
         </div>
      </div>
    </header>
  );
};

/**
 * Real 3D Scene using Three.js
 */
/**
 * Real 3D Scene using Three.js (修复版)
 */
const ThreeScene = () => {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mountRef.current) return;

    // --- 修复点 1: 防御性清理 ---
    // 防止 React Strict Mode 导致 append 两次 canvas
    while (mountRef.current.firstChild) {
      mountRef.current.removeChild(mountRef.current.firstChild);
    }

    // 获取容器当前的真实尺寸
    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;

    const scene = new THREE.Scene();
    // 调整相机视距，防止一开始太大
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.z = 5.5;
    camera.position.y = 1.2;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mountRef.current.appendChild(renderer.domElement);

    // --- 场景内容保持不变 ---
    const coreGroup = new THREE.Group();
    scene.add(coreGroup);

    const geometry = new THREE.IcosahedronGeometry(1.2, 1);
    const material = new THREE.MeshStandardMaterial({ 
      color: 0x06b6d4,
      emissive: 0x06b6d4,
      emissiveIntensity: 0.6,
      wireframe: true
    });
    const core = new THREE.Mesh(geometry, material);
    coreGroup.add(core);

    const innerGeo = new THREE.SphereGeometry(0.8, 16, 16);
    const innerMat = new THREE.MeshBasicMaterial({ color: 0xe0f2fe });
    const innerSphere = new THREE.Mesh(innerGeo, innerMat);
    coreGroup.add(innerSphere);

    const ringGeo = new THREE.TorusGeometry(2.8, 0.03, 16, 100);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x3b82f6, transparent: true, opacity: 0.4 });
    const ring1 = new THREE.Mesh(ringGeo, ringMat);
    const ring2 = new THREE.Mesh(ringGeo, ringMat);
    const ring3 = new THREE.Mesh(ringGeo, ringMat);
    
    ring1.rotation.x = Math.PI / 3;
    ring2.rotation.x = -Math.PI / 3;
    ring3.rotation.y = Math.PI / 2;
    
    scene.add(ring1);
    scene.add(ring2);
    scene.add(ring3);

    // 粒子系统
    const particlesGeometry = new THREE.BufferGeometry();
    const particleCount = 300;
    const posArray = new Float32Array(particleCount * 3);
    for(let i = 0; i < particleCount * 3; i++) {
        posArray[i] = (Math.random() - 0.5) * 12;
    }
    particlesGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    const particlesMaterial = new THREE.PointsMaterial({
        size: 0.04,
        color: 0x06b6d4,
        transparent: true,
        opacity: 0.6,
        blending: THREE.AdditiveBlending
    });
    const particlesMesh = new THREE.Points(particlesGeometry, particlesMaterial);
    scene.add(particlesMesh);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
    scene.add(ambientLight);
    const pointLight = new THREE.PointLight(0x06b6d4, 3, 20);
    pointLight.position.set(3, 3, 3);
    scene.add(pointLight);
    const blueLight = new THREE.PointLight(0x3b82f6, 3, 20);
    blueLight.position.set(-3, -3, 3);
    scene.add(blueLight);

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.8;
    controls.enableZoom = true; // 允许缩放以便你调试

    // 动画循环
    let frameId: number;
    const animate = () => {
      frameId = requestAnimationFrame(animate);
      core.rotation.x += 0.005;
      core.rotation.y += 0.005;
      ring1.rotation.z += 0.002;
      ring2.rotation.z -= 0.002;
      ring3.rotation.x += 0.002;
      innerSphere.scale.setScalar(0.9 + Math.sin(Date.now() * 0.001) * 0.1);
      particlesMesh.rotation.y -= 0.0005;
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // --- 修复点 2: 使用 ResizeObserver 监听 DIV 大小变化 ---
    // 之前的 window resize 监听不到 div 宽度的变化
    const handleResize = () => {
      if (!mountRef.current) return;
      const newWidth = mountRef.current.clientWidth;
      const newHeight = mountRef.current.clientHeight;
      
      // 只有当尺寸真的大于0才更新，防止报错
      if (newWidth === 0 || newHeight === 0) return;

      renderer.setSize(newWidth, newHeight);
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
    };

    const resizeObserver = new ResizeObserver(() => {
        handleResize();
    });
    resizeObserver.observe(mountRef.current);

    // Cleanup
    return () => {
      resizeObserver.disconnect(); // 停止监听
      cancelAnimationFrame(frameId);
      
      // 销毁 Three.js 资源
      if (mountRef.current && mountRef.current.contains(renderer.domElement)) {
          mountRef.current.removeChild(renderer.domElement);
      }
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div 
      ref={mountRef} 
      className="w-full h-full overflow-hidden" // 修复点 3: 加上 overflow-hidden
      style={{ position: 'relative' }} 
    />
  );
};

const CenterHub = () => {
  return (
    <div className="w-full h-full relative flex items-center justify-center">
      {/* Background 3D Scene */}
      <div className="absolute inset-0 z-0">
          <ThreeScene />
      </div>

      {/* Floating Identifiers Overlay */}
      <div className="relative z-10 w-full h-full pointer-events-none">
          {[
            { icon: Security, label: "网络攻防", pos: "top-[15%] left-[20%]" },
            { icon: Dns, label: "虚拟机", pos: "top-[15%] right-[20%]" },
            { icon: ViewModule, label: "容器", pos: "bottom-[20%] right-[20%]" },
            { icon: Hub, label: "资源管理", pos: "bottom-[20%] left-[20%]" },
          ].map((item, idx) => (
            <div key={idx} className={`absolute ${item.pos} pointer-events-auto`}>
                 <div className="group flex items-center gap-3 cursor-pointer hover:scale-110 transition-transform duration-300">
                    <div className="relative">
                        <div className="w-12 h-12 rounded-full bg-[#020617]/40 border border-[#06b6d4]/50 flex items-center justify-center shadow-[0_0_15px_rgba(6,182,212,0.3)] backdrop-blur-md z-10 relative group-hover:bg-[#06b6d4]/20 group-hover:border-[#06b6d4] transition-colors">
                           <item.icon className="text-[#06b6d4] w-6 h-6 group-hover:text-white transition-colors" />
                        </div>
                        {/* Rotating ring effect */}
                        <div className="absolute inset-0 rounded-full border-t border-[#06b6d4]/80 w-full h-full animate-spin duration-[3s]"></div>
                    </div>
                    <span className="text-sm font-bold text-[#06b6d4] tracking-widest uppercase bg-black/20 px-2 py-1 rounded border-l-2 border-[#06b6d4] backdrop-blur-sm group-hover:text-white group-hover:bg-[#06b6d4]/10 transition-colors">
                        {item.label}
                    </span>
                 </div>
            </div>
          ))}
      </div>
    </div>
  );
};

// --- Sub-components for specific charts ---

const CPUMonitor = ({ data, cores }: { data: number[]; cores: number }) => {
  const chartData = data.map((val, idx) => ({ value: val }));
  
  return (
    <div className="w-full h-full relative">
        <div className="absolute top-0 right-2 z-10 pointer-events-none">
            <div className="flex items-center gap-2 bg-[#020617]/80 border border-[#06b6d4]/30 px-2 py-1 rounded text-xs text-[#06b6d4] font-mono shadow-[0_0_10px_rgba(6,182,212,0.2)]">
                <Memory sx={{ fontSize: 12 }} />
                <span>{cores} Cores</span>
            </div>
        </div>

        <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <defs>
                    <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.6}/>
                        <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.1}/>
                    </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={true} horizontal={true} />
                <XAxis hide />
                <YAxis 
                domain={[0, 100]} 
                tick={{ fill: '#94a3b8', fontSize: 10 }} 
                axisLine={false} 
                tickLine={false} 
                width={35}
                />
                <Tooltip 
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#06b6d4' }} 
                labelStyle={{ display: 'none' }}
                itemStyle={{ color: '#fff' }}
                formatter={(value: number) => [`${value.toFixed(1)}%`, 'CPU Usage']}
                />
                <Area 
                type="monotone" 
                dataKey="value" 
                stroke="#06b6d4" 
                strokeWidth={2}
                fillOpacity={1} 
                fill="url(#colorCpu)" 
                isAnimationActive={false} 
                />
            </AreaChart>
        </ResponsiveContainer>
    </div>
  );
};

const MemMonitor = ({ data }: { data: SystemResources['memory'] }) => {
    // Input is in KB. Convert to GB for display.
    const B_TO_GB = 1024 ** 3;
    
    // Ensure we have data
    const usedKB = data?.used || 0;
    const freeKB = data?.free || 1;
    const totalKB = data?.total || 1;

    const usedGB = usedKB / B_TO_GB;
    const freeGB = freeKB / B_TO_GB;
    const totalGB = totalKB / B_TO_GB;

    const memPieData = [
        { name: '已用', value: usedGB, color: '#06b6d4' },
        { name: '空闲', value: freeGB, color: '#334155' }, // Lighter Slate for visibility against dark bg
    ];

    const percentage = totalKB > 0 ? ((usedKB / totalKB) * 100).toFixed(1) : "0.0";

    return (
        <div className="flex h-full w-full items-center">
            <div className="w-1/2 h-full relative min-h-[120px]">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={memPieData}
                            cx="50%"
                            cy="50%"
                            innerRadius="60%" // Percentages work well for responsive
                            outerRadius="80%"
                            paddingAngle={5}
                            dataKey="value"
                            stroke="none"
                            isAnimationActive={false} // Disable animation to prevent hydration issues causing invisibility
                        >
                            {memPieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                        </Pie>
                        <Tooltip 
                            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#06b6d4' }} 
                            itemStyle={{ color: '#fff' }}
                            formatter={(value: number) => `${value.toFixed(2)} GB`}
                        />
                    </PieChart>
                </ResponsiveContainer>
                {/* Center Text (Absolute Positioned HTML) */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="flex flex-col items-center justify-center">
                         <div className="text-sm font-bold text-white drop-shadow-[0_0_3px_rgba(6,182,212,0.8)]">
                            {percentage}<span className="text-[8px]">%</span>
                         </div>
                         <div className="text-[8px] text-slate-400 uppercase tracking-wider">Used</div>
                    </div>
                </div>
            </div>
            {/* Legend Area */}
            <div className="w-1/2 flex flex-col justify-center gap-2 pr-4">
                {memPieData.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-sm bg-current" style={{color: item.color}}></div>
                            <span className="text-slate-300">{item.name}</span>
                        </div>
                        <span className="font-mono text-white">{item.value.toFixed(1)} GB</span>
                    </div>
                ))}
                <div className="border-t border-slate-700 mt-1 pt-1 flex justify-between text-xs">
                    <span className="text-slate-400">Total</span>
                    <span className="font-mono text-[#06b6d4]">{totalGB.toFixed(1)} GB</span>
                </div>
            </div>
        </div>
    );
};

const DiskMonitor = ({ data }: { data: DiskUsage[] }) => {
    const colors = ['#06b6d4', '#3b82f6', '#8b5cf6', '#10b981', '#f59e0b'];
    
    // Process data from props
    // Convert KB to GB for UI display
    const processedData = data?.map((item, index) => {
        const totalGB = item.sizeKB / (1024 * 1024);
        const usedGB = item.usedKB / (1024 * 1024);
        
        return {
            name: item.mountpoint,
            value: item.usedPercent,
            total: totalGB,
            used: usedGB,
            fill: colors[index % colors.length]
        };
    }).reverse();

    const totalCapacity = processedData?.reduce((acc, curr) => acc + curr.total, 0);
    const totalUsed = processedData?.reduce((acc, curr) => acc + curr.used, 0);
    const totalPercent = totalCapacity > 0 ? (totalUsed / totalCapacity) * 100 : 0;
    const mountCount = data?.length;

    return (
        <div className="flex h-full w-full items-center p-2">
            {/* Left Side: Static Visual representing SSD/Storage */}
            <div className="w-1/2 h-full relative flex flex-col items-center justify-center border-r border-white/5">
                <div className="relative group">
                    {/* Glowing background */}
                    <div className="absolute inset-0 bg-cyber-cyan/10 blur-xl rounded-full group-hover:bg-cyber-cyan/20 transition-all duration-500"></div>
                    
                    {/* Main Icon */}
                    <Storage sx={{ fontSize: 50 }} className="text-[#06b6d4] relative z-10 drop-shadow-[0_0_8px_rgba(6,182,212,0.5)]" />
                    
                    {/* decorative status light */}
                    <div className="absolute top-0 right-0 w-2 h-2 bg-green-400 rounded-full shadow-[0_0_5px_#4ade80] animate-pulse"></div>
                </div>
                
                {/* Simple Label */}
                <div className="mt-3 text-xs text-slate-400 font-mono tracking-widest uppercase">
                    SSD Storage
                </div>
            </div>

            {/* Right Side: List details */}
            <div className="w-1/2 h-full flex flex-col justify-between pl-4 overflow-hidden">
                <div className="border-b border-white/10 pb-1 mb-1">
                     <div className="flex justify-between items-center text-xs text-slate-400">
                        <span>挂载点</span>
                        <div className="flex items-center gap-1">
                             <span className="text-white font-mono font-bold">{mountCount}</span>
                             <span className="text-[9px] text-[#06b6d4]">active</span>
                        </div>
                     </div>
                     <div className="flex justify-between items-center text-xs text-slate-400 mt-1">
                        <span>总占用</span>
                        <div className="text-right">
                             <span className="text-[#06b6d4] font-mono font-bold">{totalUsed?.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                             <span className="text-[9px] text-slate-500 ml-1">/ {totalCapacity?.toLocaleString(undefined, { maximumFractionDigits: 0 })} GB</span>
                        </div>
                     </div>
                     <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden mt-1">
                        <div 
                            className="h-full bg-gradient-to-r from-[#3b82f6] to-cyber-cyan" 
                            style={{width: `${totalPercent}%`}}
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 space-y-1.5">
                    {[...processedData ?? []].reverse().map((disk, i) => (
                        <div key={i} className="flex flex-col gap-0.5">
                            <div className="flex justify-between items-center text-[10px]">
                                <span className="text-slate-300 flex items-center gap-1.5 truncate max-w-[80px]" title={disk?.name}>
                                    <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{backgroundColor: disk.fill}}></div>
                                    {disk?.name}
                                </span>
                                <span className="text-slate-500 font-mono">
                                    {Math.round(disk?.value)}%
                                </span>
                            </div>
                            <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                                <div 
                                    className="h-full rounded-full" 
                                    style={{
                                        width: `${disk?.value}%`, 
                                        backgroundColor: disk?.fill
                                    }}
                                ></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

const getStatusIcon = (status: InstanceStatus) => {
    switch(status) {
        case 'running': return <CheckCircle sx={{ fontSize: 14 }} className="text-green-500" />;
        case 'paused': return <PauseCircle sx={{ fontSize: 14 }} className="text-yellow-500" />;
        case 'stopped': return <StopCircle sx={{ fontSize: 14 }} className="text-slate-500" />;
        case 'error': return <MuiError sx={{ fontSize: 14 }} className="text-red-500" />;
        case 'starting': return <Loop sx={{ fontSize: 14 }} className="text-blue-500 animate-spin" />;
        case 'stopping': return <RemoveCircle sx={{ fontSize: 14 }} className="text-orange-500" />;
        case 'deleting': return <Delete sx={{ fontSize: 14 }} className="text-red-700" />;
        default: return <Warning sx={{ fontSize: 14 }} className="text-slate-500" />;
    }
}

// --- Helper for VM State Color ---
const getVmStateColor = (state: VmInstance['state']) => {
    switch(state) {
        case 'running': return 'bg-green-500/20 text-green-400 border-green-500/30';
        case 'paused': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
        case 'shutoff':
        case 'shut off': return 'bg-red-500/20 text-red-400 border-red-500/30';
        default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    }
}

const SystemResourcesPage: React.FC = () => {
  const { data: resources, isLoading: loadingResources } = useSWR<SystemResources>('/api/system/resources', fetcher, {
    refreshInterval: 1000,
  });

  const { data: containerData } = useSWR<RunningInstance[] | { data: RunningInstance[] }>('/back/api/instances', fetcher, {
    refreshInterval: 10_000,
  });
  const { data: vmData } = useSWR<VmInstance[] | { data: VmInstance[] }>('/back/api/vms', fetcher, {
    refreshInterval: 10_000,
  });

  const containers: RunningInstance[] = Array.isArray(containerData)
    ? containerData
    : (containerData as any)?.data ?? [];
  const vms: VmInstance[] = Array.isArray(vmData)
    ? vmData
    : (vmData as any)?.data ?? [];

  const { data: vmDetails } = useSWR<Record<string, VmDetailResponse> | null>(
    vms.length ? ['vm-details', vms.map(vm => vm.id).join(',')] : null,
    async () => {
      const entries = await Promise.all(
        vms.map(async vm => {
          try {
            const detail = await fetcher(`/back/api/vms/${vm.id}`);
            return [vm.id, detail as VmDetailResponse];
          } catch (error) {
            console.error('Failed to fetch vm detail', vm.id, error);
            return [vm.id, null];
          }
        })
      );

      return Object.fromEntries(entries);
    },
    { refreshInterval: 20_000 }
  );

  const diskTotals = React.useMemo(() => {
    if (!resources?.disks?.length) return undefined;
    const sizeKB = resources.disks.reduce((acc, disk) => acc + (disk.sizeKB || 0), 0);
    const usedKB = resources.disks.reduce((acc, disk) => acc + (disk.usedKB || 0), 0);
    const usedPercent = sizeKB > 0 ? (usedKB / sizeKB) * 100 : 0;
    return { sizeKB, usedKB, usedPercent };
  }, [resources?.disks]);
  const cpuUsage = resources?.cpu?.usagePercent;
  const memoryUsage = resources?.memory;

  const [cpuHistory, setCpuHistory] = React.useState<number[]>([]);
  const [memoryHistory, setMemoryHistory] = React.useState<number[]>([]);

  React.useEffect(() => {
    if (cpuUsage !== undefined) {
      setCpuHistory(prev => [...prev.slice(-29), cpuUsage]);
    }
  }, [cpuUsage]);

  React.useEffect(() => {
    if (memoryUsage?.usedPercent !== undefined) {
      setMemoryHistory(prev => [...prev.slice(-29), memoryUsage.usedPercent]);
    }
  }, [memoryUsage?.usedPercent]);

  const instanceRows = React.useMemo(() => {
    const containerRows = containers.map(container => ({
      id: container.id,
      name: container.name,
      type: '容器',
      status: container.status,
      ip: container.ipAddress ?? '',
      cpu: container.cpuUsage ?? '',
      memory: container.memoryUsage ?? '',
      disk: container.uptime ?? '',
      scene: container.scene_name ?? ''
    }));

    const vmRows = vms.map(vm => ({
      id: vm.id,
      name: vm.name,
      type: '虚拟机',
      status: vm.state,
      ip: vm.ip ?? '',
      cpu: vm.vcpu ? `${vm.vcpu} vCPU` : '',
      memory: vmDetails?.[vm.id]?.vram?.total_mb ? `${vmDetails[vm.id].vram!.total_mb} MB` : vm.vmem ? `${vm.vmem} MB` : '',
      disk: vm.uptime ?? '',
      scene: vm.scene_name ?? ''
    }));

    return [...containerRows, ...vmRows];
  }, [containers, vms, vmDetails]);

  // 1. 单独处理容器列表
const containerRows = React.useMemo(() => {
  return containers.map(container => ({
    id: container.id,
    name: container.name,
    type: '容器',
    status: container.status,
    ip: container.ipAddress ?? '',
    cpu: container.cpuUsage ?? '',
    memory: container.memoryUsage ?? '',
    disk: container.uptime ?? '',
    scene: container.scene_name ?? ''
  }));
}, [containers]); // 依赖项只保留 containers

// 2. 单独处理虚拟机列表
const vmRows = React.useMemo(() => {
  return vms.map(vm => ({
    id: vm.id,
    name: vm.name,
    type: '虚拟机',
    status: vm.state,
    ip: vm.ip ?? '',
    cpu: vm.vcpu ? `${vm.vcpu} vCPU` : '',
    // 注意这里保留了对 vmDetails 的依赖逻辑
    memory: vmDetails?.[vm.id]?.vram?.total_mb 
      ? `${vmDetails[vm.id].vram!.total_mb} MB` 
      : vm.vmem 
        ? `${vm.vmem} MB` 
        : '',
    disk: vm.uptime ?? '',
    scene: vm.scene_name ?? ''
  }));
}, [vms, vmDetails]); // 依赖项保留 vms 和 vmDetails

  // return (
  //   <Container maxWidth="xl" sx={{ py: 3 }}>
  //     <Stack spacing={2}>
  //       <Box>
  //         <Typography variant="h4" fontWeight={700}>系统资源详情</Typography>
  //         <Typography variant="body1" color="text.secondary">查看服务器资源占用与虚拟化实例总体情况</Typography>
  //       </Box>

  //       <Box
  //         sx={{
  //           display: 'grid',
  //           gap: 2,
  //           gridTemplateColumns: {
  //             xs: '1fr',
  //             sm: 'repeat(2, minmax(0, 1fr))',
  //             md: 'repeat(3, minmax(0, 1fr))'
  //           }
  //         }}
  //       >
  //         <ResourceCard
  //           title="CPU"
  //           icon={<MonitorHeartIcon color="primary" />}
  //           value={cpuUsage !== undefined ? `${cpuUsage.toFixed(1)}%` : '--'}
  //           percent={cpuUsage}
  //           helperText={resources?.cpu ? `${resources.cpu.cores} 核` : ''}
  //           loading={loadingResources}
  //           chart={<MetricSparkline data={cpuHistory} color="#1976d2" />}
  //         />
  //         <ResourceCard
  //           title="内存"
  //           icon={<MemoryIcon color="primary" />}
  //           value={memoryUsage ? `${formatBytes(memoryUsage.used)} / ${formatBytes(memoryUsage.total)}` : '--'}
  //           percent={memoryUsage?.usedPercent}
  //           helperText={memoryUsage ? `剩余 ${formatBytes(memoryUsage.free)}` : ''}
  //           loading={loadingResources}
  //           chart={<MetricSparkline data={memoryHistory} color="#9c27b0" />}
  //         />
  //         <ResourceCard
  //           title="磁盘"
  //           icon={<StorageIcon color="primary" />}
  //           value={diskTotals ? `${formatBytes(diskTotals.usedKB * 1024)} / ${formatBytes(diskTotals.sizeKB * 1024)}` : '--'}
  //           percent={diskTotals?.usedPercent}
  //           helperText={diskTotals ? `共 ${resources?.disks?.length ?? 0} 个挂载` : '等待加载磁盘信息'}
  //           loading={loadingResources}
  //         />
  //       </Box>

  //       <Divider />

  //       <Box>
  //         <Typography variant="h5" fontWeight={600} gutterBottom>虚拟化与容器实例概览</Typography>
  //         <Paper variant="outlined" sx={{ p: 2 }}>
  //           <Stack direction="row" spacing={1} alignItems="center" mb={2}>
  //             <DnsIcon color="primary" />
  //             <RouterIcon color="primary" />
  //             <Typography variant="h6">实例列表</Typography>
  //             <Chip label={`总计 ${instanceRows.length}`} size="small" sx={{ ml: 'auto' }} />
  //           </Stack>
  //           <Table size="small">
  //             <TableHead>
  //               <TableRow>
  //                 <TableCell>类型</TableCell>
  //                 <TableCell>名称</TableCell>
  //                 <TableCell>状态</TableCell>
  //                 <TableCell>IP</TableCell>
  //                 <TableCell>CPU</TableCell>
  //                 <TableCell>内存</TableCell>
  //                 <TableCell>运行时长 / 磁盘</TableCell>
  //                 <TableCell>场景</TableCell>
  //               </TableRow>
  //             </TableHead>
  //             <TableBody>
  //               {instanceRows.length === 0 ? (
  //                 <TableRow>
  //                   <TableCell colSpan={8} align="center">
  //                     <Typography variant="body2" color="text.secondary">暂无实例</Typography>
  //                   </TableCell>
  //                 </TableRow>
  //               ) : (
  //                 instanceRows.map(row => (
  //                   <TableRow key={`${row.type}-${row.id}`}>
  //                     <TableCell>{row.type}</TableCell>
  //                     <TableCell>{row.name}</TableCell>
  //                     <TableCell>
  //                       <Stack direction="row" spacing={1} alignItems="center">
  //                         {statusIcon(row.status)}
  //                         <Chip label={row.status} color={statusColor(row.status) as any} size="small" />
  //                       </Stack>
  //                     </TableCell>
  //                     <TableCell>{row.ip || '-'}</TableCell>
  //                     <TableCell>{row.cpu || '-'}</TableCell>
  //                     <TableCell>{row.memory || '-'}</TableCell>
  //                     <TableCell>{row.disk || '-'}</TableCell>
  //                     <TableCell>{row.scene || '-'}</TableCell>
  //                   </TableRow>
  //                 ))
  //               )}
  //             </TableBody>
  //           </Table>
  //         </Paper>
  //       </Box>
  //     </Stack>
  //   </Container>
  // );

  return (
    
    <div className="h-full w-full !bg-[#020617] !text-slate-200 bg-grid-pattern bg-[size:30px_30px] flex flex-col font-sans selection:bg-cyber-cyan/30 overflow-hidden">
      <GlobalStyles />
      <Header />

      {/* Main Grid Content: 12 Columns x 3 Rows */}
      <main className="flex-1 p-3 pt-0 grid grid-cols-12 grid-rows-3 gap-3 h-full min-h-0">
        
        {/* === TOP ROW (Height: ~66%) === */}
        
        {/* LEFT: Virtual Machine Monitoring (3 Cols) */}
        <div className="row-span-2 col-span-3 min-h-0">
            <CyberPanel title="虚拟机资源监测">
                <div className="flex flex-col h-full overflow-hidden gap-2 pt-2">
                    {/* Visual Style: Cards with Absolute Values ONLY */}
                    <div className="flex-1 overflow-y-auto pr-1 space-y-2 custom-scrollbar relative">
                        {!vmRows || vmRows.length === 0 ? (
                           <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 opacity-60">
                              <Dns sx={{ fontSize: 40 }} className="mb-2 text-slate-600" />
                              <span className="text-xs tracking-wider">暂无活跃虚拟机</span>
                           </div>
                        ) : (
                          vmRows.map((vm, idx) => (
                            <div key={idx} className="bg-white/5 border border-white/5 p-3 rounded hover:border-[#06b6d4]/40 transition-all group">
                                <div className="flex justify-between items-center mb-1">
                                    <div className="flex items-center gap-2">
                                        <Dns sx={{ fontSize: 14 }} className="text-[#06b6d4]" />
                                        <span className="text-xs font-bold text-white group-hover:text-[#06b6d4] transition-colors">{vm.name}</span>
                                    </div>
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${getVmStateColor(vm.status)}`}>
                                        {vm.status.toUpperCase()}
                                    </span>
                                </div>
                                <div className="text-[10px] text-slate-500 mb-2 font-mono">{vm.ip}</div>
                                
                                {/* Resource Grid - Absolute Values ONLY (No total, no ratio) */}
                                <div className="grid grid-cols-2 gap-2 mt-2">
                                    <div className="bg-black/20 p-1.5 rounded flex items-center gap-2 border border-white/5">
                                        <div className="p-1 rounded bg-cyber-blue/10 text-cyber-blue">
                                            <Memory sx={{ fontSize: 12 }} />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[9px] text-slate-400">CPU 使用</span>
                                            <span className="text-xs font-mono font-bold text-white leading-none">
                                                {vm.cpu} <span className="text-[9px] text-slate-500 font-normal"></span>
                                            </span>
                                        </div>
                                    </div>
                                    
                                    <div className="bg-black/20 p-1.5 rounded flex items-center gap-2 border border-white/5">
                                        <div className="p-1 rounded bg-cyber-purple/10 text-cyber-purple">
                                            <Album sx={{ fontSize: 12 }} />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[9px] text-slate-400">内存 使用</span>
                                            <span className="text-xs font-mono font-bold text-white leading-none">
                                                {vm.memory} <span className="text-[9px] text-slate-500 font-normal"></span>
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                          ))
                        )}
                    </div>
                </div>
            </CyberPanel>
        </div>

        {/* CENTER: 3D Visualization (6 Cols) */}
        {/* CENTER: 3D Visualization (6 Cols) */}
        <div className="row-span-2 col-span-6 min-h-0 relative">
             <CyberPanel className="h-full relative overflow-hidden !bg-opacity-20 !border-[#06b6d4]/50">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(6,182,212,0.15)_0%,transparent_70%)] pointer-events-none"></div>
                {/* 3D Component */}
                <CenterHub />
            </CyberPanel>
        </div>

        {/* RIGHT: Container Monitoring (3 Cols) */}
        <div className="row-span-2 col-span-3 min-h-0">
             <CyberPanel title="容器资源监测">
                 <div className="flex flex-col h-full overflow-hidden">
                    <div className="grid grid-cols-12 text-[10px] text-[#06b6d4] font-bold pb-2 border-b border-white/10 px-2 shrink-0 mt-2">
                        <span className="col-span-4">Name / NS</span>
                        <span className="col-span-2 text-center">CPU</span>
                        <span className="col-span-4 text-center">MEM</span>
                        <span className="col-span-2 text-right">Status</span>
                    </div>
                    <div className="flex-1 overflow-y-auto mt-1 pr-1 custom-scrollbar relative">
                        {!containerRows || containerRows.length === 0 ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 opacity-60">
                                <Terminal sx={{ fontSize: 40 }} className="mb-2 text-slate-600" />
                                <span className="text-xs tracking-wider">暂无容器数据</span>
                            </div>
                        ) : (
                          containerRows.map((pod, idx) => (
                            <div key={idx} className="grid grid-cols-12 items-center px-2 py-2 border-b border-white/5 hover:bg-white/5 transition-colors text-[10px] font-mono">
                                <div className="col-span-4 flex flex-col">
                                    <span className="text-white break-all whitespace-normal leading-tight" title={pod.name}>{pod.name}</span>
                                    {/* <span className="text-slate-500 text-[9px]">{pod.scene}</span> */}
                                </div>
                                <div className="col-span-2 text-center text-[#3b82f6] break-all">{pod.cpu}</div>
                                <div className="col-span-4 text-center text-[#8b5cf6] break-all">{pod.memory}</div>
                                <div className="col-span-2 flex justify-end">
                                  {getStatusIcon(pod.status)}
                                    {/* {pod.status === 'Running' ? 
                                        <CheckCircle sx={{ fontSize: 12 }} className="text-green-500" /> : 
                                        <Warning sx={{ fontSize: 12 }} className="text-yellow-500" />
                                    } */}
                                </div>
                            </div>
                          ))
                        )}
                    </div>
                 </div>
            </CyberPanel>
        </div>

        {/* === BOTTOM ROW (Height: ~33%) === */}

        {/* BOTTOM 1: CPU Information (4 Cols) */}
        <div className="row-span-1 col-span-4 min-h-0">
             <CyberPanel title="CPU 负载趋势">
                <div className="h-full w-full">
                    <CPUMonitor data={cpuHistory} cores={resources?.cpu?.cores!} />
                </div>
             </CyberPanel>
        </div>

        {/* BOTTOM 2: Memory Information (4 Cols) */}
        <div className="row-span-1 col-span-4 min-h-0">
             <CyberPanel title="内存空间分布">
                <div className="h-full w-full">
                    <MemMonitor data={resources?.memory!} />
                </div>
             </CyberPanel>
        </div>

        {/* BOTTOM 3: Disk Information (4 Cols) */}
        <div className="row-span-1 col-span-4 min-h-0">
             <CyberPanel title="磁盘存储状态">
                <div className="h-full w-full">
                    <DiskMonitor data={resources?.disks!} />
                </div>
             </CyberPanel>
        </div>

      </main>
      
    </div>
  );
};

export default SystemResourcesPage;
