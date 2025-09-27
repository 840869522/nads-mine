# 部署

### PHP 安装

#### 使用apt 安装PHP

使用下面的命令更新系统软件包

```shell
sudo apt update
# 可选
sudo apt upgrade
```

使用下面的命令添加PHP软件源

```shell
sudo apt install ca-certificates apt-transport-https software-properties-common
sudo add-apt-repository ppa:ondrej/php
sudo apt update
```

使用下面的命令安装PHP:8.3

```shell
sudo apt install php8.3 php8.3-mysql
```

#### 下载composer(php 依赖管理工具)

```shell
wget http://https://getcomposer.org/download/2.8.11/composer.phar
```

### Node 和Npm安装

#### apt 安装

下载NodeSource并执行安装脚本

```shell
curl -sL https://deb.nodesource.com/setup_22.x | sudo -E bash -
```

安装node 和npm

```shell
sudo apt install nodejs
```

验证是否安装成功

```shell
node -v
# 输出 v22.x
npm -v
#输出 X.x.x
```

#### 二进制安装

访问node官网（https://nodejs.org/zh-cn/download），下载对应的版本，如： Linux x64复制下载连接，例如：https://nodejs.org/dist/v22.19.0/node-v22.19.0-linux-x64.tar.xz

```shell
wget https://nodejs.org/dist/v22.19.0/node-v22.19.0-linux-x64.tar.xz
```

解压下载的文件

```shell
tar -xJvf node-v22.19.0-linux-x64.tar.xz
```

建立软连接

```shell
sudo ln -s $PWD/node-v22.19.0-linux-x64/bin/node /usr/local/bin
sudo ln -s $PWD/node-v22.19.0-linux-x64/bin/npm /usr/local/bin
sudo ln -s $PWD/node-v22.19.0-linux-x64/bin/npx /usr/local/bin

# 测试是否正确安装
node -v
v22.19.0 # 预计输出，正确输出则正确安装
npm -v
10.9.3 # 预计输出，正确输出则正确安装
```

### 启动所需要的资源

```sheel
|home
|-----ubuntu
|-----------web
|--------------virsh # 虚拟机文件夹
|-------------------images # 虚拟机镜像文件夹
|-------------------instances # 虚拟机实例保存的文件夹
|--------------courses # 课程资源文件夹
|--------------qdrant # 向量数据库挂在文件夹， 在docker启动qdrant时用到
# 代码文件 nads、src下的node依赖文件夹node_modules、back下的php依赖文件夹vendor以及php依赖管理composer 
|-----nads
|---------src
|--------------node_modules
|----------back
|--------------vendor
|----------composer.phar
# 拷贝 node_modules vendor composer.phar
# 拷完back/vendor 执行下面的加载php依赖
cd nads/back
# 只想下面的命令同步php依赖并生成索引
../../composer.phar dump-autoload
```

### 虚拟机脚本权限设置

为vmscript文件夹中的虚拟机创建脚本添加执行权限：

```shell
# 进入vmscript目录
cd nads/back/app/RunTool/vmscript

# 为所有虚拟机创建脚本添加执行权限
chmod +x newvm_kali.sh
chmod +x newvm_switch.sh
chmod +x newvm_ql
chmod +x newvm_win10.sh
chmod +x newvm_win7.sh
chmod +x newvm_win7_1.sh
chmod +x newvm_win_2003.sh
```

### 初始存储池设置

**使用顺序一般是:**

`如果要重建存储池，首先 destroy 停止 → undefine 删除定义 → define-as 重新定义 → build 初始化 → start 启动 → autostart 开机自动启用。`

*注：如果系统还没有默认的存储池，可以直接从 define-as 开始，后续步骤依次进行即可。*

```shell
virsh pool-destroy default    # 停止名为 default 的存储池（正在运行时使用）
virsh pool-undefine default    # 删除存储池的配置定义（从 libvirt 配置中移除）
virsh pool-define-as --name default --type dir --target /path/to/vm/images # 定义一个新的存储池（名字 default，类型为目录，指定存放虚拟机镜像的路径）
virsh pool-build default     # 初始化存储池目录（如果目录不存在则创建）
virsh pool-start default     # 启动存储池，让其可用
virsh pool-autostart default   # 设置存储池开机自动启动
```

### Liboffice 以及FFmpeg安装

#### Libreoffice安装

`此工具用于将ppt转为pdf在网页显示`

```shell
# 安装
#添加 LibreOffice "Fresh" PPA
sudo add-apt-repository ppa:libreoffice/ppa
#更新软件包列表，然后安装
sudo apt update
sudo apt install libreoffice

# 安装验证
libreoffice --version
#预计输出
LibreOffice 7.3.7.2 30(Build:2)
```

#### FFmpeg安装

`此工具用于视频格式转化`

```shell
#安装 FFmpeg，命令如下
sudo apt update
sudo apt install ffmpeg
```

### 关于项目启动前的配置

#### 日志收集镜像配置以及交换机网络设置

```shelll
# 启动日志收集容器
docker run -it -d -p 9200:9200 -p 5601:5601 -p 3128:3128 elastic-redis-data-collector:v16 /bin/bash
# 创建交换机
sudo ovs-vsctl add-br ovs-switch -- set bridge ovs-switch stp_enable=true 
# 给容器配置网络
sudo ovs-docker add-port ovs-switch 容器内网卡名 容器号 --ipaddress=网络/子网掩码
# 例：
sudo ovs-docker add-port ovs-switch eth1 26b --ipaddress=10.100.88.88/16
```

#### 关于后端配置

`后端配置为项目目录下back/.env`

- 数据库相关的修改DB_*的配置项

```.env
APP_NAME=Laravel
APP_ENV=local
APP_KEY=base64:9Yo8SFD24BZWQIwoy0PyjmcKd6POjsiOr3kwPxS9Kws=
APP_DEBUG=false
APP_URL=http://localhost

LOG_CHANNEL=stack
LOG_DEPRECATIONS_CHANNEL=null
LOG_LEVEL=debug

DB_CONNECTION=mysql
#DB_HOST=127.0.0.1
DB_HOST=10.12.0.101
DB_PORT=3306
DB_DATABASE=nads
DB_USERNAME=nads
DB_PASSWORD=GQip8WD02X
DB_CHARSET=UTF8

# CACHE_DRIVER=redis
# CACHE_PREFIX=cache

# REDIS_CLIENT=predis
# REDIS_HOST=127.0.0.1
# REDIS_PORT=6380
# REDIS_PASSWORD=null
# REDIS_DB=0
# REDIS_CACHE_DB=1

MIX_PUSHER_APP_KEY="${PUSHER_APP_KEY}"
MIX_PUSHER_APP_CLUSTER="${PUSHER_APP_CLUSTER}"

GLOBAL_DIRECTORY="/home/ubuntu/web"

JWT_SECRET_KEY="E2FD8F64F0157998AA809C8E78D27A142D5DE9913B41A674ACB51C5AD2B4305D"

```

#### 关于Python

需要修改下面的文件

```sehll
<project_dir>/langchian/config.yaml
```

```yaml
# 修改 chatModel 和 embeddingModel 内容
chatModel:
  model: "gpt-oss"
  base_url: "http://43.143.151.41:3000/v1"
  api_key: "sk-45jfj2wN89d0hwLFA18c71D7D3A3462b9eBe96F6Ea7d8cF5"
embeddingModel:
    model: "nomic-embed-text"
    base_url: "http://43.143.151.41:3000/v1"
    api_key: "sk-45jfj2wN89d0hwLFA18c71D7D3A3462b9eBe96F6Ea7d8cF5"
qdrant:
  server: "http://localhost:6333"
server:
  ip: 127.0.0.1
  port: 9000
database:
  type: "mysql"
  host: "127.0.0.1"
  port: 3306
  user: "root"
  password: "123456"
  database: "deepseek"
  table: "chat_history"
```

### 启动

```shell
# docker启动qdrant
docker run -it -d -v /home/ubuntu/web/qdrant:/qdrant/storage  -p 6333:6333 qdrant:1.15

# 启动项目，务必在完成上面之后执行下面的
#screen 需要用到，没有需要装
#安装命令如下
sudo apt install screen
./start.sh start
```

# 维护

### 前端未启动，重新启动

```shell
screen -ls
# 预计输出
98019.nads_project_python      (09/23/25 20:37:18)     (Detached) # python启动会话
797833.nads_project_front       (09/23/25 20:37:17)     (Detached) # 前端启动会话
567249.nads_project_back        (09/23/25 18:46:53)     (Detached) # 后端启动会话
# 如果不存在 nads_project_front
screen -S nads_project_front

# 如果存在, 进入会话命令如下
screen -r nads_project_front

# cd到前端目录
cd /xx/xx/nads/src
npm run build
npm start >> front.log
# 预计输出
(node:2814469) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:2814469) [DEP0060] DeprecationWarning: The `util._extend` API is deprecated. Please use Object.assign() instead.
```

#### 退出会话

按住Ctl键之后按A键在按D键即可推出会话

### 存储池设置

**使用顺序一般是:**

`如果要重建存储池，首先 destroy 停止 → undefine 删除定义 → define-as 重新定义 → build 初始化 → start 启动 → autostart 开机自动启用。`

*注：如果系统还没有默认的存储池，可以直接从 define-as 开始，后续步骤依次进行即可。*

```shell
virsh pool-destroy default    # 停止名为 default 的存储池（正在运行时使用）
virsh pool-undefine default    # 删除存储池的配置定义（从 libvirt 配置中移除）
virsh pool-define-as --name default --type dir --target /path/to/vm/images # 定义一个新的存储池（名字 default，类型为目录，指定存放虚拟机镜像的路径）
virsh pool-build default     # 初始化存储池目录（如果目录不存在则创建）
virsh pool-start default     # 启动存储池，让其可用
virsh pool-autostart default   # 设置存储池开机自动启动
```

### vnc/docker连接异常

使用程序根目录的start.sh脚本重新启动node服务，详细看  **前端未启动，重新启动**。

### 如果ovs交换机出现 no such device 情况，可手动删除僵尸端口

```shell
# 把某个交换机上的端口删除的命令
ovs-vsctl del-port <bridge> <port> 
```

### 添加新类别后，如果在管理类别中显示为“未分配ID”，点击刷新类别即可正确被新的课程案例所使用

