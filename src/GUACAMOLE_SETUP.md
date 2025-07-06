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

## 4. 本地测试虚拟机配置

为了在开发环境中验证远程桌面连接，建议在本机准备一台精简 Linux 虚拟机和一台 Windows 虚拟机，并开启 SSH、RDP、VNC 服务。

### Linux 实例

1. 使用 KVM 或 VirtualBox 创建最小化 Ubuntu Server。
2. 在系统中安装并启动服务：
   ```bash
   sudo apt update
   sudo apt install -y openssh-server xrdp tigervnc-standalone-server
   sudo systemctl enable --now ssh xrdp
   ```
3. 运行 `vncpasswd` 设置密码后执行 `vncserver` 启动会话。
   默认端口分别为 22 (SSH)、3389 (RDP)、5901 (VNC)。

### Windows 实例

1. 创建 Windows 10/11 虚拟机，可使用微软官方评估镜像。
2. 在“系统属性”中启用远程桌面并记下登录凭据。
3. 安装 [TightVNC](https://www.tightvnc.com/) 并允许远程访问。
4. 确认 3389 (RDP) 与 5900 (VNC) 端口在防火墙中开放。

完成后即可在浏览器中访问如下地址测试：

```
/guac?type=ssh&hostname=<VM_IP>&port=22
/guac?type=rdp&hostname=<VM_IP>&port=3389
/guac?type=vnc&hostname=<VM_IP>&port=5901
```
