# guacd + guacamole-lite 使用说明

本项目通过 `guacd` 搭配 Node.js 包 [`guacamole-lite`](https://github.com/netbrain/guacamole-lite) 提供远程桌面代理，已不再依赖完整的 Apache Guacamole Web 服务。但浏览器与服务器之间仍需 `guacd` 作为后端支撑。

## 1. 安装并运行 guacd

推荐使用 Docker 快速部署：

```bash
sudo apt update
sudo apt install -y docker.io
sudo docker run -d --name guacd -p 4822:4822 guacamole/guacd:1.5.4
```

或在 Debian/Ubuntu 直接安装系统包：

```bash
sudo apt install -y guacamole-server
sudo systemctl enable --now guacd
```

如需使用其他端口，可在启动 `server.js` 时设置环境变量 `GUACD_PORT`。

## 2. 后端集成原理

启动 Node.js 服务器时，`src/server.js` 会在 `/api/guac` 路径下创建 `GuacamoleLite` 实例并连接到本地 `guacd`。浏览器与该路径建立 WebSocket 后，由 `guacamole-lite` 根据连接参数转发到 `guacd`。

`src/main_cli_local.py` 的 `guac-info` 命令返回虚拟机的主机名以及三种远程桌面端口，PHP 控制器 `/api/php/vms/<name>/guac` 调用此命令并将结果交给前端。

## 3. 前端调用方式

前端收到连接信息后，根据协议构造如下地址打开新窗口：

```
/guac?type=<protocol>&hostname=<host>&port=<port>
```

- `protocol`：`ssh`、`rdp` 或 `vnc`
- `hostname`：远程主机地址（通常为 `hypervisor`）
- `port`：对应协议端口号

`src/app/guac/page.tsx` 会解析这些参数并通过 `guacamole-common-js` 连接到 `/api/guac`，无需额外的 Guacamole 凭据即可显示远程桌面。
