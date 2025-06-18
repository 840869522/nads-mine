import Docker from 'dockerode';
import { ManagedImage, RunningInstance, InstanceStatus } from '@/types';
import * as os from "node:os";

const docker = new Docker(
    os.platform() === 'win32'
        ? { socketPath: '//./pipe/docker_engine' }
        : { socketPath: '/var/run/docker.sock' }
);

function mapStatus(state: string): InstanceStatus {
  switch (state) {
    case 'running':
      return 'running';
    case 'paused':
      return 'paused';
    case 'created':
    case 'exited':
    case 'dead':
      return 'stopped';
    default:
      return 'error';
  }
}

export async function listDockerImages(role: string, userId?: string): Promise<ManagedImage[]> {
  const images = await docker.listImages({ all: true });
  return images
    .filter(img => role === 'admin' || img.Labels?.creatorId === userId)
    .map(img => {
      const tag = img.RepoTags?.[0] || '<none>';
      const [name, version = 'latest'] = tag.split(':');
      return {
        id: img.Id,
        name,
        type: 'docker',
        version,
        description: img.Labels?.description || '',
        fileName: undefined,
        size: `${(img.Size / (1024 * 1024)).toFixed(2)} MB`,
        uploadDate: new Date(img.Created * 1000).toISOString(),
      } as ManagedImage;
    });
}

export async function listDockerContainers(role: string, userId?: string): Promise<RunningInstance[]> {
  const infos = await docker.listContainers({ all: true });
  const containers = infos.filter(c => role === 'admin' || c.Labels?.creatorId === userId);
  const result: RunningInstance[] = [];
  for (const info of containers) {
    try {
      const container = docker.getContainer(info.Id);
      const stats = await container.stats({ stream: false });
      const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
      const sysDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
      const cpuPercent = sysDelta > 0 ? (cpuDelta / sysDelta) * stats.cpu_stats.online_cpus * 100 : 0;
      const memUsage = stats.memory_stats.usage || 0;
      const memLimit = stats.memory_stats.limit || 0;
      const ports = info.Ports?.map(p =>
        p.PublicPort ? `${p.PrivatePort}->${p.PublicPort}` : `${p.PrivatePort}`
      ).join(', ') || '';
      result.push({
        id: info.Id,
        name: info.Names?.[0]?.replace(/^\//, '') || info.Id.slice(0, 12),
        type: 'container',
        status: mapStatus(info.State),
        ports,
        imageName: info.Image,
        cpuUsage: cpuPercent.toFixed(1) + '%',
        memoryUsage: `${(memUsage / 1024 / 1024).toFixed(1)}MB/${(memLimit / 1024 / 1024).toFixed(1)}MB`,
        diskUsage: '-',
        uptime: info.Status || '',
        nodeId: undefined,
        createdAt: new Date(info.Created * 1000).toISOString(),
      });
    } catch (err) {
      // ignore container errors
    }
  }
  return result;
}

export async function inspectContainer(id: string) {
  const container = docker.getContainer(id);
  return container.inspect();
}

export async function getContainerLogs(id: string, tail = 200) {
  const container = docker.getContainer(id);
  const stream = await container.logs({ stdout: true, stderr: true, tail, follow: false });
  return stream.toString();
}

export async function listBindMounts(id: string) {
  const info = await inspectContainer(id);
  return info.Mounts || [];
}


export async function getContainerStats(id: string) {
  const container = docker.getContainer(id);
  return container.stats({ stream: false });
}

export async function startContainer(id: string) {
  const container = docker.getContainer(id);
  await container.start();
}

export async function stopContainer(id: string) {
  const container = docker.getContainer(id);
  await container.stop();
}

export async function pauseContainer(id: string) {
  const container = docker.getContainer(id);
  await container.pause();
}

export async function unpauseContainer(id: string) {
  const container = docker.getContainer(id);
  await container.unpause();
}

export async function removeContainer(id: string) {
  const container = docker.getContainer(id);
  await container.remove({ force: true });
}

export interface CreateContainerOptions {
  image: string;
  name?: string;
  ports?: { containerPort: string | number; hostPort?: string | number }[];
  volumes?: { hostPath: string; containerPath: string }[];
  env?: { key: string; value: string }[];
  cmd?: string[];
  labels?: Record<string, string>;
}

export async function createDockerContainer(options: CreateContainerOptions) {
  const portBindings: Record<string, any> = {};
  const exposedPorts: Record<string, {}> = {};
  options.ports?.forEach(p => {
    const key = `${p.containerPort}/tcp`;
    exposedPorts[key] = {};
    if (p.hostPort) {
      portBindings[key] = [{ HostPort: String(p.hostPort) }];
    }
  });
  const hostConfig: Record<string, any> = {};
  if (Object.keys(portBindings).length) hostConfig.PortBindings = portBindings;
  if (options.volumes && options.volumes.length) {
    hostConfig.Binds = options.volumes.map(v => `${v.hostPath}:${v.containerPath}`);
  }
  const env = options.env?.map(e => `${e.key}=${e.value}`);
  const container = await docker.createContainer({
    Image: options.image,
    name: options.name,
    Cmd: options.cmd && options.cmd.length ? options.cmd : undefined,
    Env: env,
    ExposedPorts: Object.keys(exposedPorts).length ? exposedPorts : undefined,
    HostConfig: Object.keys(hostConfig).length ? hostConfig : undefined,
    Labels: options.labels,
  });
  await container.start();
  return container;
}
