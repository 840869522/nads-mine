"use client";
import React, { createContext, useContext, useState, ReactNode } from 'react';
import ExecTerminalModal from '@/components/scenario/ExecTerminalModal';

interface ExecTerminalContextProps {
  openTerminals: string[];
  openTerminal: (id: string) => void;
  closeTerminal: (id: string) => void;
}

const ExecTerminalContext = createContext<ExecTerminalContextProps | undefined>(undefined);

export const ExecTerminalProvider = ({ children }: { children: ReactNode }) => {
  const [openTerminals, setOpenTerminals] = useState<string[]>([]);

  const openTerminal = (id: string) =>
    setOpenTerminals(t => (t.includes(id) ? t : [...t, id]));

  const closeTerminal = (id: string) =>
    setOpenTerminals(t => t.filter(i => i !== id));

  return (
    <ExecTerminalContext.Provider value={{ openTerminals, openTerminal, closeTerminal }}>
      {children}
      {openTerminals.map(id => (
        <ExecTerminalModal key={id} open containerId={id} onClose={() => closeTerminal(id)} />
      ))}
    </ExecTerminalContext.Provider>
  );
};

export const useExecTerminal = () => {
  const ctx = useContext(ExecTerminalContext);
  if (!ctx) throw new Error('useExecTerminal must be used within ExecTerminalProvider');
  return ctx;
};

