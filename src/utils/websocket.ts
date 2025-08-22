// src/utils/websocket.ts
type MessageHandler = (data: any) => void;

class WSClient {
  private ws: WebSocket | null = null;
  private handlers: MessageHandler[] = [];
  private url: string;

  constructor(url: string) {
    this.url = url;
  }

  // 建立连接
  connect() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;

    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      console.log("WebSocket 已连接");
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handlers.forEach(fn => fn(data)); // 调用所有注册回调
      } catch (err) {
        console.error("解析消息失败:", err);
      }
    };

    this.ws.onclose = () => console.log("WebSocket 已关闭");
    this.ws.onerror = (err) => console.error("WebSocket 错误:", err);
  }

  // 注册消息回调
  onMessage(fn: MessageHandler) {
    this.handlers.push(fn);
  }

  // 发送消息
  send(data: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }
}

// 全局单例
export const websocketClient = new WSClient("ws://127.0.0.1:8080");
