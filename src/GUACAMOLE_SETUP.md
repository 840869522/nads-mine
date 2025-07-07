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

前端收到连接信息后，通过 `/api/guac-token` 获取加密后的连接 token，再在模态框中使用 `guacamole-common-js` 连接 `/api/guac`。
若想在独立页面中访问，也可继续使用以下地址：

```
/guac?type=<protocol>&hostname=<host>&port=<port>
```

`protocol` 为 `ssh`、`rdp` 或 `vnc`，其余参数分别为目标主机及端口。`src/app/guac/page.tsx` 仍可解析这些参数并建立连接。

## 4. 下载示例镜像并一键初始化

为了让开发者无需手动配置虚拟机，仓库提供了快速脚本 `scripts/init_demo_vms.sh`。
脚本会下载预装好 SSH、RDP、VNC 服务的最小 Linux 与 Windows 镜像，并调用
`main_cli_local.py` 创建两个测试实例。

### 使用步骤

```bash
chmod +x scripts/init_demo_vms.sh
./scripts/init_demo_vms.sh
```

脚本会自动下载下列镜像（也可手动下载）：

- [Ubuntu 22.04 Minimal](https://cloud-images.ubuntu.com/minimal/releases/22.04/release/ubuntu-22.04-minimal-cloudimg-amd64.img)
- [Windows 10 Evaluation](https://go.microsoft.com/fwlink/?linkid=2215517)

脚本默认为 Linux 与 Windows 虚拟机分别设置密码 `demo123` 与 `P@ssw0rd`，
无需本地 `~/.ssh/id_rsa.pub` 文件即可登录。如果希望改用 SSH 密钥登录 Linux
实例，可先运行：

```bash
ssh-keygen -t rsa -b 2048 -f ~/.ssh/id_rsa
```

然后在脚本中将 `--admin-password demo123` 替换为
`--ssh-key "$(cat ~/.ssh/id_rsa.pub)"`。

执行完成后，默认端口分别为：SSH `2222`、RDP `33389`、VNC 从虚拟机 XML 中读取
（通常为 `59xx`）。可在页面中点击对应按钮弹出远程桌面模态框，或手动访问：

```
/guac?type=ssh&hostname=hypervisor&port=2222
/guac?type=rdp&hostname=hypervisor&port=33389
/guac?type=vnc&hostname=hypervisor&port=<vnc_port>
```
