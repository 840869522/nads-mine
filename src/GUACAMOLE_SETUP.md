# Guacamole 安装与配置指南

本文档描述如何在本服务器上部署 [Apache Guacamole](https://guacamole.apache.org/) 并使 `src/main_cli.py` 中的 `/api/vms/create` 接口能够自动创建 SSH、VNC 与 RDP 连接。

## 1. 安装依赖

以 Ubuntu 22.04 为例，首先安装构建 guacd 所需的库及 Tomcat9：

```bash
sudo apt update
sudo apt install -y build-essential libcairo2-dev libjpeg-turbo8-dev \
  libpng-dev libtool-bin libossp-uuid-dev libvncserver-dev \
  freerdp2-dev libpango1.0-dev libssh2-1-dev libtelnet-dev \
  libwebsockets-dev libpulse-dev libvorbis-dev libwebp-dev \
  tomcat9 tomcat9-admin
```

接下来下载并编译 `guacamole-server`：

```bash
wget https://downloads.apache.org/guacamole/1.5.4/source/guacamole-server-1.5.4.tar.gz
 tar -xf guacamole-server-1.5.4.tar.gz
 cd guacamole-server-1.5.4
 ./configure --with-init-dir=/etc/init.d
 make -j$(nproc)
 sudo make install
 sudo ldconfig
 sudo systemctl enable guacd
 sudo systemctl start guacd
```

## 2. 部署 Web 应用

下载 Guacamole Web 应用并放入 Tomcat 的 `webapps` 目录：

```bash
wget https://downloads.apache.org/guacamole/1.5.4/binary/guacamole-1.5.4.war \
  -O /var/lib/tomcat9/webapps/guacamole.war
sudo systemctl restart tomcat9
```

创建配置目录 `/etc/guacamole` 并添加 `guacamole.properties`：

```bash
sudo mkdir -p /etc/guacamole
cat <<'_EOF' | sudo tee /etc/guacamole/guacamole.properties
# guacd 连接信息
 guacd-hostname: localhost
 guacd-port: 4822
_EOF
```

将该目录链接到 Tomcat：

```bash
sudo ln -s /etc/guacamole /var/lib/tomcat9/.guacamole
```

## 3. 创建登录账户

为了让后端调用 REST API，需要在 `user-mapping.xml` 中定义至少一个用户：

```bash
cat <<'_EOF' | sudo tee /etc/guacamole/user-mapping.xml
<user-mapping>
    <authorize username="guacadmin" password="guacpass">
        <connection name="placeholder" protocol="vnc" />
    </authorize>
</user-mapping>
_EOF
sudo systemctl restart tomcat9
```

登录地址为 `http://<服务器IP>:8080/guacamole`，使用上述用户名和密码即可登录。

## 4. 确保名称解析

`/api/vms/create` 会在 Guacamole 中生成指向主机名 `hypervisor` 的连接，请确保在运行 Guacamole 的服务器上能解析此主机名，例如在 `/etc/hosts` 中加入：

```
127.0.0.1   hypervisor
```

或将其指向实际的虚拟化宿主机 IP。

## 5. 测试 REST API

部署完成后，可使用以下命令测试登录及创建连接是否正常：

```bash
curl -X POST "http://<服务器IP>:8080/guacamole/api/tokens" \
     -d "username=guacadmin" -d "password=guacpass"
```

返回 JSON 中应包含 `authToken`。随后即可按照 `src/main_cli.py` 中的逻辑创建 SSH、VNC、RDP 连接。

完成以上步骤后，前端在调用 `/api/vms/create` 时填写相同的 Guacamole URL 与凭据，即可在 Guacamole 中自动生成对应连接。
