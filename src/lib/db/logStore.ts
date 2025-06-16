import fs from 'fs';
import path from 'path';

// 日志文件路径，模拟 RocksDB 的键值存储
const logPath = path.join(process.cwd(), 'attack_logs.json');

// 追加一条日志
export function appendLog(entry: any) {
  const logs = fs.existsSync(logPath) ? JSON.parse(fs.readFileSync(logPath,'utf8')) : [];
  logs.push(entry);
  fs.writeFileSync(logPath, JSON.stringify(logs));
}

// 获取全部日志
export function getLogs() {
  return fs.existsSync(logPath) ? JSON.parse(fs.readFileSync(logPath,'utf8')) : [];
}
