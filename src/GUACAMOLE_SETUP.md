# guacd + guacamole-lite 使用说明

本项目现使用 `guacd` 搭配 Node.js 包 [`guacamole-lite`](https://github.com/netbrain/guacamole-lite) 提供远程桌面代理，不再依赖完整的 Apache Guacamole Web 服务。

## 1. 启动 guacd

```bash
sudo apt update
sudo apt install -y docker.io
sudo docker run -d --name guacd -p 4822:4822 guacamole/guacd:1.5.4
```

如需使用其他端口，可在启动 `server.js` 时设置环境变量 `GUACD_PORT`。

## 2. Node.js 集成

`src/server.js` 会在 `/api/guac` 路径下创建 `guacamole-lite` 实例并连接到 `guacd`。
前端通过如下 URL 即可建立会话：

```
/guac?type=<protocol>&hostname=<host>&port=<port>
```

其中 `<protocol>` 为 `ssh`、`rdp` 或 `vnc`。完成以上步骤后，虚拟机管理界面点击对应按钮即可在浏览器中打开远程桌面。
