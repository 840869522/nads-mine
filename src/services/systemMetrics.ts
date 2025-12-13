import os from 'os';
import { promisify } from 'util';
import { exec } from 'child_process';

const execAsync = promisify(exec);

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

type CpuSnapshot = { idle: number; total: number };

const captureCpu = (): CpuSnapshot => {
  const cpus = os.cpus();
  const aggregate = cpus.reduce(
    (acc, cpu) => {
      const times = cpu.times;
      const total = times.user + times.nice + times.sys + times.idle + times.irq;
      acc.idle += times.idle;
      acc.total += total;
      return acc;
    },
    { idle: 0, total: 0 }
  );
  return aggregate;
};

export const getCpuUsage = async (sampleMs: number = 200) => {
  const start = captureCpu();
  await sleep(sampleMs);
  const end = captureCpu();

  const idleDiff = end.idle - start.idle;
  const totalDiff = end.total - start.total;
  const usage = totalDiff > 0 ? (1 - idleDiff / totalDiff) * 100 : 0;

  return {
    cores: os.cpus().length,
    usagePercent: Math.min(100, Math.max(0, Number(usage.toFixed(2))))
  };
};

export const getMemoryUsage = () => {
  const total = os.totalmem();
  const free = os.freemem();
  const used = total - free;
  const usedPercent = total > 0 ? Number(((used / total) * 100).toFixed(2)) : 0;

  return {
    total,
    free,
    used,
    usedPercent
  };
};

export type DiskUsage = {
  filesystem: string;
  type?: string;
  sizeKB: number;
  usedKB: number;
  availKB: number;
  usedPercent: number;
  mountpoint: string;
};

export const getDiskUsage = async (): Promise<DiskUsage[]> => {
  try {
    const { stdout } = await execAsync('df -kPT 2>/dev/null');
    const lines = stdout.trim().split('\n').slice(1);

    return lines
      .map(line => line.trim().split(/\s+/))
      .filter(parts => parts.length >= 7)
      .map(parts => {
        const [filesystem, type, size, used, avail, pcent, ...mount] = parts;
        const mountpoint = mount.join(' ');
        return {
          filesystem,
          type,
          sizeKB: Number(size),
          usedKB: Number(used),
          availKB: Number(avail),
          usedPercent: Number((pcent || '0').replace('%', '')),
          mountpoint
        };
      });
  } catch (error) {
    console.error('Failed to read disk usage', error);
    return [];
  }
};

export const getSystemResources = async () => {
  let cpu;
  try {
    cpu = await getCpuUsage();
  } catch (error) {
    console.error('Failed to read CPU usage', error);
    cpu = { cores: os.cpus().length, usagePercent: 0 };
  }

  let memory;
  try {
    memory = getMemoryUsage();
  } catch (error) {
    console.error('Failed to read memory usage', error);
    memory = { total: 0, free: 0, used: 0, usedPercent: 0 };
  }

  const disks = await getDiskUsage();

  return { cpu, memory, disks };
};
