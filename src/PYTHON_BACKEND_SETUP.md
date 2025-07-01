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

1.  **导航到项目的 `src` 目录**:
    打开您的终端，并切换到本项目的 `src` 目录，Python 后端文件 (`main.py`, `requirements.txt`) 位于此处。
    ```bash
    cd path/to/your/project/src
    # 或者，如果您在项目根目录：
    # cd src
    ```

2.  **创建虚拟环境 (推荐)**:
    强烈建议使用虚拟环境来管理项目特定的依赖项。这将您的项目的 Python 包与全局 Python 安装隔离开来。

    *   创建虚拟环境 (例如，命名为 `.venv`):
        ```bash
        python3 -m venv .venv
        ```
        (如果 `python3` 命令无效，请尝试使用 `python`)

    *   激活虚拟环境:
        *   在 macOS 和 Linux 上:
            ```bash
            source .venv/bin/activate
            ```
        *   在 Windows (Git Bash 或类似工具) 上:
            ```bash
            source .venv/Scripts/activate
            ```
        *   在 Windows (命令提示符) 上:
            ```bash
            .venv\Scripts\activate.bat
            ```
        您的终端提示符现在应指示虚拟环境已激活 (例如，`(.venv) your-prompt$`)。

3.  **安装依赖项**:
    激活虚拟环境后，安装 `src` 目录中 `requirements.txt` 文件列出的所需 Python 包。
    ```bash
    pip install -r requirements.txt
    ```
    这将安装 `fastapi`、`uvicorn`、`pydantic`、`python-dotenv` 以及 `libvirt-python` (如果需要真实 Libvirt 连接) 等库。
    *注意: 如果您仅使用 mock 数据，`libvirt-python` 可能不是必需的，或者在 `requirements.txt` 中被注释掉了。如需连接到真实的 libvirt 守护进程，请确保它已安装，并且在 Linux 系统上可能需要 libvirt 开发头文件。*

4.  **Node.js 服务器依赖项检查 (`http-proxy-middleware`)**:
    主 Node.js 服务器 (`src/server.js`) 使用 `http-proxy-middleware` 将 API 请求代理到 Python 后端。此 Node.js 依赖项应在 `src/package.json` (或项目根目录的 `package.json`) 中列出并已安装。如果缺失，请导航到包含相应 `package.json` 的目录并运行：
    ```bash
    npm install http-proxy-middleware
    # 或
    yarn add http-proxy-middleware
    ```
    *(此步骤针对 Node.js 环境，而非 Python，但对于代理功能正常工作至关重要。)*

## 为 WSL Libvirt 配置 TCP 连接 (可选，用于 Windows 主机开发)

如果您的开发环境是 Windows，并且希望 Python 后端 (在 Windows 上通过 `server.js` 启动) 连接到在 WSL (Windows Subsystem for Linux) 内部运行的 Libvirt 服务，您需要进行以下配置：

1.  **在 WSL 内部配置 `libvirtd` 监听 TCP**:
    *   编辑 WSL 中 Libvirt 的主配置文件，通常位于 `/etc/libvirt/libvirtd.conf` (或某些发行版可能是 `/usr/local/etc/libvirt/libvirtd.conf` 等)。
        ```bash
        sudo nano /etc/libvirt/libvirtd.conf
        ```
    *   确保以下行存在并且未被注释，按如下设置：
        ```ini
        listen_tls = 0
        listen_tcp = 1
        auth_tcp = "none"  # 警告：这为了开发方便禁用了认证。对于生产环境，应考虑 "sasl" 或其他安全认证机制。
        tcp_port = "16509" # Libvirt 默认的 TCP 端口
        ```
    *   根据您的发行版，可能还需要修改 `libvirtd` 的服务启动选项，以使其监听。编辑 `/etc/default/libvirtd` (Debian/Ubuntu) 或 `/etc/sysconfig/libvirtd` (RHEL/CentOS/Fedora)。
        在 `libvirtd_opts` 或类似变量中添加 `-l` 或 `--listen` 标志。例如：
        ```bash
        # /etc/default/libvirtd (示例)
        libvirtd_opts="-d -l"
        ```
        如果该文件不存在或配置方式不同，请查阅您 WSL 发行版的特定文档。
    *   保存更改并重启 WSL 中的 `libvirtd` 服务：
        ```bash
        sudo systemctl restart libvirtd
        # 或者，如果 systemctl 不可用/不适用:
        # sudo service libvirtd restart
        ```

2.  **获取 WSL 实例的 IP 地址**:
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

您 **不需要** 手动运行 `uvicorn src.main:app --host 0.0.0.0 --port 8000`。
Python FastAPI 后端会在您运行前端/Node.js 应用 (例如，通过 `npm start` 或 `yarn start` 从包含主 `package.json` 的目录，可能是项目根目录或 `src/`) 时，由主 Node.js 服务器 (`src/server.js`) 自动作为子进程启动。

Node.js 服务器将会：
*   在端口 8000 (或由 `PYTHON_API_PORT` 环境变量配置的端口) 上为 `src/main.py` 启动 Uvicorn 服务器。
*   将对 `/api/vm/*` (在 Node.js 服务器的端口上，例如 3000) 的请求代理到 Python 后端的端口 8000。

启动 `src/server.js` 时，请检查控制台输出，以获取指示 FastAPI 服务器状态的消息。

## 故障排除

*   **命令 `uvicorn` 未找到 (当 `server.js` 尝试运行时)**:
    *   确保在 `src` 目录内创建了虚拟环境 (`.venv`)，并且通过 `pip install -r requirements.txt` 正确地将 `uvicorn` 安装到了该环境中。
    *   `server.js` 脚本尝试直接运行 `uvicorn`。如果您的系统 PATH 或虚拟环境设置不允许 `server.js` (一个 Node 进程) 从 `server.js` 本身 *未* 运行于其中的已激活 Python venv 中找到 `uvicorn`，您可能需要调整 `server.js` 中的 `childProcessSpawn` 命令以使用 `.venv/bin/uvicorn` (Linux/macOS) 或 `.venv\Scripts\uvicorn.exe` (Windows) 的绝对路径，或者确保运行 `server.js` 的环境的 PATH 中包含 `.venv/bin` (或 `Scripts`) 目录。
    *   一个更简单的开发方法可能是在运行 `npm start` 以启动 `server.js` *之前*，在终端中激活 Python 虚拟环境。这通常会使 `uvicorn` 在子进程的 PATH 中可用。

*   **代理错误**:
    *   通过查看 `server.js` 的控制台输出来检查 FastAPI 服务器 (Python) 是否已正确启动。
    *   确保 `server.js` 中的 `FASTAPI_TARGET_URL` (例如 `http://127.0.0.1:8000`) 与 Python Uvicorn 服务器实际监听的地址匹配。

*   **端口冲突**:
    *   如果端口 8000 (Python 用) 或 3000 (Node.js 用) 已被占用，您可以更改它们：
        *   对于 Python/FastAPI：在运行 `server.js` 之前设置 `PYTHON_API_PORT` 环境变量。
        *   对于 Node.js/Next.js：设置 `PORT` 环境变量。

通过执行这些步骤，Python 后端应能被主应用服务器正确配置和启动。
