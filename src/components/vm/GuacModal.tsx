"use client";

import React, {
    useRef,
    useCallback,
    useEffect,
    useState,
} from "react";
import {
    Dialog,
    DialogTitle,
    DialogContent,
    IconButton,
    CircularProgress,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import Guacamole from "guacamole-common-js";

export interface GuacModalProps {
    open: boolean;
    onClose: () => void;
    /** rdp / vnc / ssh */
    type: "ssh" | "rdp" | "vnc";
    hostname: string;
    port: number;
    /** 以下字段可选，仅 ssh/rdp 需要 */
    username?: string;
    password?: string;
}

/**
 * GuacModal — 全功能 Guacamole 前端组件
 *
 * 功能
 * 1. Portal 渲染完成后才初始化 `Guacamole.Client`
 * 2. 自动绑定 Mouse / Keyboard，支持剪贴板与滚轮
 * 3. 根据窗口大小与 DPI 实时 sendSize，保证最佳显示
 * 4. 模态关闭或组件卸载时完整清理，防止内存与事件泄漏
 * 5. HTTPS 环境下自动使用 wss:// WebSocket
 */
export default function GuacModal(props: GuacModalProps) {
    const { open, onClose, type, hostname, port, username, password } = props;

    /* -------- refs -------- */
    const containerRef = useRef<HTMLDivElement>(null);
    const clientRef = useRef<Guacamole.Client | null>(null);
    const mouseRef = useRef<Guacamole.Mouse | null>(null);
    const keyboardRef = useRef<Guacamole.Keyboard | null>(null);
    const resizedRef = useRef(false);

    /* -------- state -------- */
    const [connecting, setConnecting] = useState(false);

    /* -------- helpers -------- */
    /** 发送显示尺寸给远端 */
    const sendResize = useCallback(() => {
        const client = clientRef.current;
        const el = containerRef.current;
        if (!client || !el) return;
        const width = el.clientWidth;
        const height = el.clientHeight;
        const dpi = Math.round(window.devicePixelRatio * 96);
        client.sendSize(width, height, dpi);
    }, []);

    /** 初始化鼠标 & 键盘 */
    const bindInput = useCallback((displayEl: HTMLElement, client: Guacamole.Client) => {
        // Mouse
        const mouse = new Guacamole.Mouse(displayEl);
        const send = (state: any) => client.sendMouseState(state);
        mouse.onmousedown = send;
        mouse.onmouseup = send;
        mouse.onmousemove = send;
        mouse.onwheel = send as any;
        mouseRef.current = mouse;

        // Keyboard (绑 document，避免焦点丢失)
        const keyboard = new Guacamole.Keyboard(document);
        keyboard.onkeydown = (ks) => client.sendKeyEvent(1, ks);
        keyboard.onkeyup = (ks) => client.sendKeyEvent(0, ks);
        keyboardRef.current = keyboard;
    }, []);

    /** 建立连接 */
    const connect = useCallback(() => {
        if (!containerRef.current || connecting) return;
        setConnecting(true);

        const paramsInit: Record<string, string> = {
            type,
            hostname,
            port: String(port),
        };
        if (username) paramsInit.username = username;
        if (password) paramsInit.password = password;

        const params = new URLSearchParams(paramsInit).toString();

        fetch("/api/token-guac?" + params)
            .then((r) => {
                if (!r.ok) throw new Error("Token request failed");
                return r.json();
            })
            .then((data) => {
                if (!data.token) throw new Error("Token not found");

                const wsBase =
                    (window.location.protocol === "https:" ? "wss://" : "ws://") +
                    window.location.host;
                const wsUrl = `${wsBase}/connect-guac?token=${encodeURIComponent(
                    data.token
                )}`;

                const tunnel = new Guacamole.WebSocketTunnel(wsUrl);
                const client = new Guacamole.Client(tunnel);

                clientRef.current = client;

                client.onstatechange = (state) => {
                    if (state === 3 /*CONNECTED*/) {
                        sendResize();
                        resizedRef.current = true;
                    }
                };
                client.onerror = (err) => console.error("[Guac] error →", err);

                // attach display
                const displayEl = client.getDisplay().getElement();
                containerRef.current!.innerHTML = "";
                containerRef.current!.appendChild(displayEl);

                // input
                bindInput(displayEl, client);

                client.connect();
            })
            .catch((err) => console.error("[Guac] connect failed →", err))
            .finally(() => setConnecting(false));
    }, [bindInput, connecting, hostname, password, port, sendResize, type, username]);

    /* -------- effect: resize listener -------- */
    useEffect(() => {
        if (!open) return;

        const onResize = () => {
            if (clientRef.current) sendResize();
        };
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, [open, sendResize]);

    /* -------- effect: cleanup on close -------- */
    useEffect(() => {
        if (!open) return;

        return () => {
            // Disconnect client
            clientRef.current?.disconnect();
            clientRef.current = null;

            // Remove input helpers
            mouseRef.current = null;
            keyboardRef.current = null;

            // Clear DOM
            if (containerRef.current) containerRef.current.innerHTML = "";
        };
    }, [open]);

    /* -------- UI -------- */
    if (!open) return null;

    return (
        <Dialog
            open={open}
            onClose={onClose}
            fullScreen
            TransitionProps={{ onEntered: connect }}
        >
            <DialogTitle sx={{ m: 0, p: 1 }}>
                远程连接
                <IconButton
                    edge="end"
                    color="inherit"
                    onClick={onClose}
                    aria-label="close"
                    sx={{ position: "absolute", right: 8, top: 8 }}
                >
                    <CloseIcon />
                </IconButton>
            </DialogTitle>

            <DialogContent sx={{ p: 0, position: "relative" }}>
                {/* 连接指示 */}
                {connecting && (
                    <div
                        style={{
                            position: "absolute",
                            inset: 0,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            background: "rgba(0,0,0,0.4)",
                            zIndex: 10,
                        }}
                    >
                        <CircularProgress size={48} />
                    </div>
                )}

                <div
                    ref={containerRef}
                    style={{ width: "100%", height: "100%", background: "#000" }}
                />
            </DialogContent>
        </Dialog>
    );
}
