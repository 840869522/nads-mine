"use client";

import { useEffect, useRef } from "react";
import Guacamole from "guacamole-common-js";
import crypto from "crypto"; // ⚠️ 注意：这只在 Node.js 里可用

const CIPHER = "aes-256-cbc";
const SECRET_KEY = "0123456789abcdef0123456789abcdef";

// 示例连接信息
const tokenObject = {
  connection: {
    type: "vnc",
    settings: {
      hostname: "127.0.0.1",
      port:5900
    },
  },
};

// ⚠️ 不推荐在前端使用
function encryptToken(value: object): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(CIPHER, Buffer.from(SECRET_KEY), iv);

  let encrypted = cipher.update(JSON.stringify(value), "utf8", "base64");
  encrypted += cipher.final("base64");

  const data = {
    iv: iv.toString("base64"),
    value: encrypted,
  };

  const json = JSON.stringify(data);
  return Buffer.from(json).toString("base64");
}

export default function GuacPage() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const token = encryptToken(tokenObject); // ⚠️ 实际使用中应从 API 获取

    const tunnel = new Guacamole.WebSocketTunnel("ws://localhost:3001/connect-guac");
    const client = new Guacamole.Client(tunnel);

    if (containerRef.current) {
      containerRef.current.appendChild(client.getDisplay().getElement());
    }

    client.connect("token=" + token);

    window.onunload = () => {
      client.disconnect();
    };

    return () => {
      client.disconnect();
    };
  }, []);

  return (
      <div style={{ width: "100vw", height: "100vh", backgroundColor: "#000" }}>
        <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
      </div>
  );
}
