"use client";
import React, { createContext, useContext, useState, ReactNode } from 'react';
import ExecTerminalModal from '@/components/scenario/ExecTerminalModal';

interface ExecTerminalContextProps {
  openTerminals: string[];
  openTerminal: (id: string) => void;
  closeTerminal: (id: string) => void;
}

const ExecTerminalContext = createContext<ExecTerminalContextProps | undefined>(undefined);
const BASE_Z_INDEX = 1400;
export const ExecTerminalProvider = ({ children }: { children: ReactNode }) => {
  const [openTerminals, setOpenTerminals] = useState<string[]>([]);

  const openTerminal = (id: string) =>
    setOpenTerminals(prev => {
      // 如果终端已打开，则将其移到数组末尾，以获得最高的 z-index
      if (prev.includes(id)) {
        return [...prev.filter(tId => tId !== id), id];
      }
      // 否则，添加到数组末尾
      return [...prev, id];
    });

  const closeTerminal = (id: string) =>
    setOpenTerminals(t => t.filter(i => i !== id));

  return (
    <ExecTerminalContext.Provider value={{ openTerminals, openTerminal, closeTerminal }}>
      {children}
      {/* 为每个打开的终端渲染一个模态框。
        我们使用数组的索引来创建递增的 z-index，
        这样后打开或后点击的终端总是在最上面。
      */}
      {openTerminals.map((id, index) => (
        <ExecTerminalModal 
          key={id} 
          open 
          containerId={id} 
          onClose={() => closeTerminal(id)} 
          // ⭐ 关键改动：传递一个动态计算的 zIndex
          zIndex={BASE_Z_INDEX + index}
        />
      ))}
    </ExecTerminalContext.Provider>
  );
};

export const useExecTerminal = () => {
  const ctx = useContext(ExecTerminalContext);
  if (!ctx) throw new Error('useExecTerminal must be used within ExecTerminalProvider');
  return ctx;
};

