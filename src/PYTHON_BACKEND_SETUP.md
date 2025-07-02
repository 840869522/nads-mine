# Python 后端安装与配置指南 (VM 管理 API)

本文档概述了为 VM 管理 API 设置 Python 后端环境所需的步骤。Node.js 服务器 (`src/server.js`) 负责自动启动此 Python 后端。

## 先决条件

1.  **Python 3.8+**:
    确保您的系统上安装了 Python 3.8 或更高版本。您可以从 [python.org](https://www.python.org/downloads/) 下载。
    验证您的安装：
    ```bash
    python --version
    # 或者
    python3 --version
    ```

2.  **pip**:
    Python 的包安装器 `pip` 通常随 Python 安装一同提供。如果未安装，请遵循官方安装指南：[pip installation](https://pip.pypa.io/en/stable/installation/)。

## 安装步骤

1.  **确保 Python 环境**:
    *   您的系统需要一个 Python 环境 (推荐 Python 3.8+)。
    *   `python` (Windows) 或 `python3` (Linux/macOS 通常) 命令应在您的终端 PATH 中可用。
    *   `pip` (Python 包安装器) 也应可用。

2.  **安装 Python 依赖项**:
    *   Python 依赖项列在 `src/requirements.txt` 文件中。
    *   **推荐使用虚拟环境**: 虽然 `server.js` 现在直接调用 `python src/main.py`，不再依赖于从特定 `.venv` 路径查找 `uvicorn` 可执行文件，但为您的 Python 项目使用虚拟环境仍然是管理依赖项的最佳实践。
        *   在项目根目录 (与 `src` 同级) 创建虚拟环境：
            ```bash
            python3 -m venv .venv
            # (Windows 上可能用: python -m venv .venv)
            ```
        *   激活虚拟环境：
            *   macOS/Linux: `source .venv/bin/activate`
            *   Windows (Git Bash): `source .venv/Scripts/activate`
            *   Windows (CMD): `.venv\Scripts\activate.bat`
    *   **安装包**: 无论是否使用虚拟环境，请确保在将要执行 `src/main.py` 的 Python 环境中安装依赖：
        ```bash
        pip install -r src/requirements.txt
        ```
        这将安装 `fastapi`、`uvicorn`、`pydantic`、`python-dotenv` 以及 `libvirt-python` (如果需要真实 Libvirt 连接) 等。
        *如果您不使用虚拟环境，这些包将安装到您的全局或用户 Python站点包中。*

3.  **Node.js 服务器依赖项检查 (`http-proxy-middleware`)**:
    主 Node.js 服务器 (`src/server.js`) 使用 `http-proxy-middleware` 将 API 请求代理到 Python 后端。此 Node.js 依赖项应在 `src/package.json` (或项目根目录的 `package.json`) 中列出并已安装。如果缺失，请导航到包含相应 `package.json` 的目录并运行：
    ```bash
    npm install http-proxy-middleware
    # 或
    yarn add http-proxy-middleware
    ```
    *(此步骤针对 Node.js 环境，而非 Python，但对于代理功能正常工作至关重要。)*

## 为 WSL Libvirt 配置 TCP 连接 (可选，用于 Windows 主机开发)

如果您的开发环境是 Windows，并且希望 Python 后端 (在 Windows 上通过 `server.js` 启动) 连接到在 WSL (Windows Subsystem for Linux) 内部运行的 Libvirt 服务，您需要进行以下配置：

1.  **在 WSL 内部启用 Libvirt TCP Socket 监听 (推荐方法)**:
    *   现代 systemd-based Linux 发行版 (通常 WSL2 使用这类发行版，如 Ubuntu) 通过 systemd socket activation 来管理服务监听。这通常比直接编辑 `libvirtd.conf` 中的 `listen_tcp` 更简洁。
    *   打开 WSL 终端，执行以下命令以启用并立即启动 Libvirt TCP socket：
        ```bash
        sudo systemctl enable --now libvirtd-tcp.socket
        ```
        *注意：具体的 socket 单元名称可能是 `libvirtd-tcp.socket` (专门用于无加密 TCP) 或 `libvirtd.socket` (一个通用的 socket，其行为可能取决于 `libvirtd.conf` 中的其他设置)。对于无加密的 TCP，`libvirtd-tcp.socket` 通常是正确的。如果此命令失败，您可以尝试 `sudo systemctl enable --now libvirtd.socket`，然后检查它是否在 TCP 端口 16509 上监听。*
    *   此方法通常会自动处理监听地址和默认端口 (16509)，无需在 `libvirtd.conf` 中设置 `listen_tcp = 1` 或 `tcp_port`。

2.  **配置认证 (`auth_tcp`)**:
    *   **重要**: 即便使用 socket activation，认证方式仍需在 Libvirt 配置文件中指定。
    *   编辑 WSL 中的 `/etc/libvirt/libvirtd.conf`:
        ```bash
        sudo nano /etc/libvirt/libvirtd.conf
        ```
    *   确保 `auth_tcp` 设置为 `"none"` (用于开发环境，不安全) 或 `"sasl"` (更安全，但需要额外配置 SASL)。**为方便本地开发，我们这里使用 "none"**:
        ```ini
        # 找到或添加此行
        auth_tcp = "none"
        ```
        *警告：`auth_tcp = "none"` 会允许任何能够通过网络访问此端口的客户端无密码连接到 Libvirt。这仅适用于受信任的本地开发网络环境。*
    *   如果修改了 `libvirtd.conf`，你需要重启 `libvirtd` 服务以使更改生效：
        ```bash
        sudo systemctl restart libvirtd.service
        # 或者简单地 sudo systemctl restart libvirtd
        ```
        (注意：如果仅启用了 socket 而 `libvirtd.service` 本身未运行，它会在第一个 TCP 连接到达时由 systemd 自动启动。但如果更改了 `libvirtd.conf`，重启服务是确保配置加载的好习惯。)

3.  **获取 WSL 实例的 IP 地址**:
    Python 后端 (在 Windows 上运行时) 需要知道 WSL 实例的 IP 地址才能通过 TCP 连接。
    *   在 WSL 终端中，运行以下命令之一来查找 IP 地址：
        ```bash
        hostname -I
        # 或
        ip addr show eth0 | grep "inet " | awk '{print $2}' | cut -d/ -f1
        ```
        (注意：网络接口名称可能是 `eth0` 或其他名称，如 `ensP preocupaciónX`。)
    *   WSL 的 IP 地址在重启后可能会改变。为了更稳定的开发，您可以考虑为 WSL 设置静态 IP，或者在 Windows 的 `hosts` 文件中为动态获取的 IP 设置一个本地 DNS 名称。

3.  **在 Windows 上设置 `WSL_LIBVIRT_IP` 环境变量**:
    当您从 Windows 启动 Node.js 服务器 (`src/server.js`) 时，`src/main.py` (Python 后端) 会读取名为 `WSL_LIBVIRT_IP` 的环境变量来找到 WSL。
    在启动 `server.js` 的那个 Windows 终端会话中设置此变量：
    *   使用 PowerShell:
        ```powershell
        $env:WSL_LIBVIRT_IP="YOUR_WSL_IP_ADDRESS"
        ```
    *   使用命令提示符 (CMD):
        ```cmd
        set WSL_LIBVIRT_IP=YOUR_WSL_IP_ADDRESS
        ```
    将 `YOUR_WSL_IP_ADDRESS` 替换为您在上一步中找到的实际 WSL IP 地址。
    为了方便，您也可以将此环境变量添加到系统的环境变量中，或者使用 `.env` 文件配合 `python-dotenv` (如果项目中配置了)。

4.  **防火墙注意事项**:
    *   **Windows 防火墙**: 可能需要配置 Windows 防火墙以允许出站连接到 WSL IP 地址的 `16509` 端口。通常，出站连接的限制较少，但如果遇到问题，这是一个检查点。
    *   **WSL 防火墙**: 如果您在 WSL 内部运行了防火墙 (如 `ufw`)，请确保它允许来自 Windows 主机 IP 地址 (或所有本地网络) 对 `16509` TCP 端口的入站连接。
        例如，使用 `ufw`:
        ```bash
        sudo ufw allow 16509/tcp
        ```

## 运行后端

Python FastAPI 后端由主 Node.js 服务器 (`src/server.js`) 在您启动 Node.js 应用时 (例如，通过 `npm start` 或 `yarn start`) 自动作为子进程启动。`server.js` 会执行 `python src/main.py` (或 `python3 src/main.py`)，而 `src/main.py` 内部使用 `uvicorn.run()` 来启动 FastAPI 服务。

Node.js 服务器将会：
*   通过运行 `python src/main.py` 启动 FastAPI/Uvicorn 服务，该服务将监听端口 8000 (或由 `PYTHON_API_PORT` 环境变量配置的端口)。
*   将对 `/api/vm/*` (在 Node.js 服务器的端口上，例如 3000) 的请求代理到 Python 后端的此端口。

启动 `src/server.js` 时，请检查控制台输出，以获取指示 FastAPI 服务器状态的消息。
如果您想单独测试 Python 后端（不通过 Node.js 代理），您可以直接在已安装依赖的 Python 环境中运行：
```bash
python src/main.py
# 或者 python3 src/main.py
```
这将直接在 `0.0.0.0:8000` (或 `PYTHON_API_PORT` 指定的端口) 上启动 FastAPI 服务。

## 故障排除

*   **命令 `python` 或 `python3` 未找到 (当 `server.js` 尝试运行时)**:
    *   确保 `python` (Windows) 或 `python3` (Linux/macOS) 在您运行 `npm start` 的终端的系统 PATH 中。
    *   如果您使用了虚拟环境，直接从 `server.js` 启动 Python 脚本通常不需要预先激活该虚拟环境，因为 `server.js` 会调用系统级的 `python` 或 `python3`。重要的是，这个被调用的 `python`/`python3` 实例能够访问到 `src/requirements.txt` 中安装的包（即这些包要么全局安装，要么安装在 `server.js` 执行时 `python` 命令所指向的环境中）。
    *   如果坚持在特定虚拟环境下运行 Python 脚本，您需要在 `server.js` 中指定虚拟环境内 Python解释器的绝对路径，或者在启动 `server.js` 前确保该虚拟环境已被激活，并且其 `python` 解释器是默认的。

*   **Python 模块未找到 (例如 `No module named 'fastapi'` 或 `No module named 'uvicorn'`)**:
    *   这表示 `src/requirements.txt` 中的依赖项没有安装到 `server.js` 调用 `python src/main.py` 时所使用的 Python 环境中。
    *   请返回 “安装 Python 依赖项” 部分，确保在正确的 Python 环境中执行了 `pip install -r src/requirements.txt`。

*   **代理错误**:
    *   通过查看 `server.js` 的控制台输出来检查 FastAPI 服务器 (Python) 是否已正确启动。
    *   确保 `server.js` 中的 `FASTAPI_TARGET_URL` (例如 `http://127.0.0.1:8000`) 与 Python Uvicorn 服务器实际监听的地址匹配。

*   **端口冲突**:
    *   如果端口 8000 (Python 用) 或 3000 (Node.js 用) 已被占用，您可以更改它们：
        *   对于 Python/FastAPI：在运行 `server.js` 之前设置 `PYTHON_API_PORT` 环境变量。
        *   对于 Node.js/Next.js：设置 `PORT` 环境变量。

通过执行这些步骤，Python 后端应能被主应用服务器正确配置和启动。
