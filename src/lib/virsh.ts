import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

export async function getVmImageDir(): Promise<string> {
  const { stdout } = await execAsync('virsh -c qemu:///system pool-dumpxml default');
  const match = stdout.match(/<path>([^<]+)<\/path>/);
  if (!match) {
    throw new Error('default storage pool path not found');
  }
  return match[1];
}
