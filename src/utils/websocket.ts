// src/utils/websocket.ts
type MessageHandler = (data: any) => void;

class WSClient {
  private ws: WebSocket | null = null;
  private handlers: MessageHandler[] = [];
  private url: string;
  private token: string | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectInterval = 3000;
  private isAuthenticated = false;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(url: string) {
    this.url = url;
  }

  // 设置认证token
  setToken(token: string) {
    this.token = token;
  }

  // 建立连接
  connect() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;

    console.log('正在连接WebSocket...', this.url);
    console.log('当前页面地址:', window.location.href);
    console.log('解析的主机名:', window.location.hostname);
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      console.log("WebSocket 已连接");
      this.reconnectAttempts = 0;
      this.authenticate();
      this.startHeartbeat();
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('WebSocket原始消息:', event.data);
        console.log('WebSocket解析后数据:', data);
        
        // 处理认证响应
        if (data.type === 'auth_response') {
          if (data.success) {
            this.isAuthenticated = true;
            console.log('WebSocket 认证成功');
          } else {
            console.error('WebSocket 认证失败:', data.error);
          }
        }
        
        // 特别处理flag_submission消息
        if (data.type === 'flag_submission') {
          console.log('✅ 收到Flag提交消息:', {
            submission_id: data.submission_id,
            username: data.c_username,
            is_correct: data.c_is_correct,
            instance_type: data.instance_type
          });
        }
        
        console.log('当前注册的消息处理器数量:', this.handlers.length);
        this.handlers.forEach((fn, index) => {
          console.log(`调用消息处理器 ${index}:`, fn.name || '匿名函数');
          fn(data);
        });
      } catch (err) {
        console.error("解析消息失败:", err, '原始数据:', event.data);
      }
    };

    this.ws.onclose = () => {
      console.log("WebSocket 已关闭");
      this.isAuthenticated = false;
      this.stopHeartbeat();
      this.attemptReconnect();
    };
    
    this.ws.onerror = (err) => {
      console.error("WebSocket 错误:", err);
    };
  }

  // 认证
  private authenticate() {
    if (this.token) {
      this.send({
        type: 'auth',
        token: this.token
      });
    }
  }

  // 尝试重连
  private attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`尝试重连 (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      setTimeout(() => {
        this.connect();
      }, this.reconnectInterval);
    } else {
      console.error('WebSocket重连失败，已达到最大重试次数');
    }
  }

  // 心跳检测
  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.send({ type: 'ping' });
      }
    }, 30000); // 30秒心跳
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  // 断开连接
  disconnect() {
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isAuthenticated = false;
  }

  // 注册消息回调
  onMessage(fn: MessageHandler) {
    this.handlers.push(fn);
  }

  // 移除消息回调
  offMessage(fn: MessageHandler) {
    const index = this.handlers.indexOf(fn);
    if (index > -1) {
      this.handlers.splice(index, 1);
    }
  }

  // 发送消息
  send(data: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
      return true;
    }
    return false;
  }

  // 检查连接状态
  isConnected() {
    return this.ws && this.ws.readyState === WebSocket.OPEN;
  }

  // 检查认证状态
  isAuth() {
    return this.isAuthenticated;
  }
}

// 全局单例 - 使用与前端相同的地址和端口，通过 Next.js 代理访问 WebSocket
const getWebSocketUrl = () => {
  if (typeof window !== 'undefined') {
    return `ws://${window.location.host}/ws`; // 使用/ws路径通过代理访问
  }
  return 'ws://localhost:3000/ws'; // 服务器端渲染时的默认值
};

export const websocketClient = new WSClient(getWebSocketUrl());
