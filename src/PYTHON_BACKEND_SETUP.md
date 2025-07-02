# Python 后端安装与配置指南 (VM 管理 API)

本文档概述了为 VM 管理 API 设置 Python 后端环境所需的步骤。Node.js 服务器 (`src/server.js`) 负责自动启动此 Python 后端。

**重要提示：此项目的 Python 后端配置主要为在 WSL (Windows Subsystem for Linux) 或原生 Linux 环境下运行和开发而设计。当 `server.js` 在这些环境中执行时，它会尝试启动 Python 后端。如果在其他操作系统 (如直接在 Windows 上运行 Node.js，而非通过 WSL) 上运行 `server.js`，Python 后端将不会启动，依赖于它的 API 功能 (如 `/api/vm/*`) 将不可用，并会返回 503 服务不可用错误。**

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

## Libvirt 服务 (在 WSL 内部)

由于开发环境现在直接在 WSL 内部，Python 后端将通过本地 Unix domain socket (`qemu:///system`) 连接到 Libvirt 服务。您不再需要为 Libvirt 配置 TCP 监听或在 Windows 上设置特殊环境变量来连接 WSL。

*   **确保 Libvirt 服务正在运行**:
    在您的 WSL 终端中，检查 `libvirtd`服务的状态并确保它正在运行：
    ```bash
    sudo systemctl status libvirtd
    # 或者，如果 systemctl 不可用或服务名称不同 (例如在非 systemd 的 WSL 发行版中):
    # sudo service libvirtd status
    ```
    如果服务未运行，请启动它：
    ```bash
    sudo systemctl start libvirtd
    sudo systemctl enable libvirtd # 设置为开机自启 (可选, 仅适用于 systemd 系统)
    # 或者:
    # sudo service libvirtd start
    ```
    标准安装的 Libvirt 通常会默认配置为监听本地 Unix socket。

## 运行后端

Python FastAPI 后端由主 Node.js 服务器 (`src/server.js`) 在您启动 Node.js 应用时 (例如，通过 `npm start` 或 `yarn start` 从项目根目录) 自动作为子进程启动。`server.js` 会执行 `python src/main.py` (或 `python3 src/main.py`)，而 `src/main.py` 内部使用 `uvicorn.run()` 来启动 FastAPI 服务。

Node.js 服务器将会：
*   通过运行 `python src/main.py` (在WSL环境中) 启动 FastAPI/Uvicorn 服务，该服务将监听端口 8000 (或由 `PYTHON_API_PORT` 环境变量配置的端口)。
*   将对 `/api/vm/*` (在 Node.js 服务器的端口上，例如 3000) 的请求代理到 Python 后端的此端口。

启动 `src/server.js` 时，请检查控制台输出，以获取指示 FastAPI 服务器状态的消息。
如果您想单独测试 Python 后端（不通过 Node.js 代理），您可以直接在已安装依赖的 Python 环境中 (在 WSL 内部) 运行：
```bash
# 确保你在 src 目录的父目录下，或者调整路径
python src/main.py
# 或者 python3 src/main.py
```
这将直接在 `0.0.0.0:8000` (或 `PYTHON_API_PORT` 指定的端口) 上启动 FastAPI 服务。

## 故障排除

*   **命令 `python` 或 `python3` 未找到 (当 `server.js` 尝试运行时 从 Node.js)**:
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
