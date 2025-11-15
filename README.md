# 1 部署

### 1.1 PHP 安装

#### 1.1.1 使用apt 安装PHP

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
sudo apt install php8.3 php8.3-mysql php8.3-xml php8.3-fpm php8.3-common php8.3-zip php8.3-curl
```

#### 1.1.2下载composer(php 依赖管理工具)

```shell
wget http://getcomposer.org/download/2.8.11/composer.phar
```

### 1.2 Node 和Npm安装（两种安装任选其一）

#### 1.2.1 apt 安装

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

#### 1.2.2 二进制安装

访问[node官网](https://nodejs.org/zh-cn/download)，下载对应的版本，如： Linux x64复制下载连接，例如：https://nodejs.org/dist/v22.19.0/node-v22.19.0-linux-x64.tar.xz

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

### 1.3 Redis 安装
#### 1.3.1 APT 安装
```shell
# 更新包管理器
sudo apt update

# 安装 Redis 服务器
sudo apt install redis-server

# 启动 Redis 服务
sudo systemctl start redis

# 设置 Redis 开机自启
sudo systemctl enable redis

# 验证 Redis 是否正常运行
redis-cli ping
# 预期输出: PONG

```
#### 1.3.2 dcoker部署

```shell
# 拉取 Redis 官方镜像
docker pull redis:latest
# 如果不能拉取请使用国内镜像源， 如
# docker pull swr.cn-north-4.myhuaweicloud.com/ddn-k8s/quay.io/opstree/redis:v7.0.5
# docker tag swr.cn-north-4.myhuaweicloud.com/ddn-k8s/quay.io/opstree/redis:v7.0.5  redis:latest


# 运行 Redis 容器
docker run -d --name redis-server -p 6379:6379 redis:latest

# 或者使用持久化存储运行 Redis
docker run -d --name redis-server -p 6379:6379 -v /home/ubuntu/redis/data:/data redis:latest redis-server --appendonly yes

# 验证 Redis 容器是否正常运行
docker exec -it redis-server redis-cli ping
# 预期输出: PONG
```

### 1.4 启动所需要的资源

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
|---------back
|--------------vendor
|---------composer.phar
# 拷贝 node_modules vendor composer.phar
```

#### 1.4.1 qdrant目录的创建以及nltk_data

##### 1.4.1.1 nltk_data

 nltk_data是nltk用来存放预训练模型、语料库、词典等数据的目录，是nltk解析文件内容所必需。

```python
# 注：当nltk_data不在/home/ubunut 目录时，可添加下面代码到python代码
os.environ['NLTK_DATA'] = '/home/ubunut/nltk_data' # nltk_data的实际所在目录
```

##### 1.4.1.2 创建qdrant目录

qdrant目录用于挂载到qdrant的docker容器中，以存储向量数据库的数据。

```shell
# 创建文件夹
mkdir qdrant
```

### 1.5 虚拟机脚本权限设置

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

### 1.6 初始存储池设置

**使用顺序一般是:**

`libvirt默认的default池目录不指向虚拟机镜像文件所在目录的时候，也就是第一次装系统的时候，需要重建存储池，首先 destroy 停止 → undefine 删除定义 → define-as 重新定义 → build 初始化 → start 启动 → autostart 开机自动启用。`

*注：如果系统还没有默认的存储池，可以直接从 define-as 开始，后续步骤依次进行即可。*

```shell
virsh pool-destroy default    # 停止名为 default 的存储池（正在运行时使用）
virsh pool-undefine default    # 删除存储池的配置定义（从 libvirt 配置中移除）
virsh pool-define-as --name default --type dir --target /path/to/vm/images # 定义一个新的存储池（名字 default，类型为目录，指定存放虚拟机镜像的路径）
virsh pool-build default     # 初始化存储池目录（如果目录不存在则创建）
virsh pool-start default     # 启动存储池，让其可用
virsh pool-autostart default   # 设置存储池开机自动启动
```

### 1.7 Liboffice 以及FFmpeg安装

#### 1.7.1 Libreoffice安装

```shell
此工具用于将ppt转为pdf在网页显示
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

#### 1.7.2 FFmpeg安装

```shell
此工具用于视频格式转化
#安装 FFmpeg，命令如下
sudo apt update
sudo apt install ffmpeg
```

### 1.8 关于项目启动前的配置

#### 1.8.1 日志收集镜像配置以及交换机网络设置

```shelll
# 启动日志收集容器，需要启动最新的elastic-data-collector，假设镜像名为 elastic-data-collector:v1.1 那么命令如下
sudo docker run -it -d -p 9200:9200 -p 5601:5601 -p 3218:3218 --memory="4g" --memory-swap="4g" -e "ES_JAVA_OPTS=-Xms2g -Xmx2g" -e "bootstrap.memory_lock=true" --name elastic-data-collector -v eslogs:/usr/share/elasticsearch/logs elastic-data-collector:v1.6 /bin/bash

# 创建交换机
sudo ovs-vsctl add-br ovs-switch -- set bridge ovs-switch stp_enable=true 

# 给容器配置网络
sudo ovs-docker add-port ovs-switch 容器内网卡名 容器号 --ipaddress=网络/子网掩码

# 例：
sudo ovs-docker add-port ovs-switch eth1 26b --ipaddress=10.100.88.88/16
```

注意：需要在宿主机上创建一个5601到25601的端口映射！以供访问kibana界面

#### 1.8.2 关于后端配置

`后端配置为项目目录下back/.env`

数据库相关的修改DB_*的配置项

```.env
# 日志配置
LOG_CHANNEL=daily
LOG_DEPRECATIONS_CHANNEL=null
LOG_PATH = "logs/laravel.log" # 日志目录 默认在back/storage/logs文件夹下，当指定值时请使用绝对路径，例如/var/log/back
LOG_DAYS = 14 # 保存的天数
LOG_LEVEL=info


# database setting
DB_CONNECTION=mysql
DB_HOST=10.12.0.101 # 数据库地址
DB_PORT=3306 # 数据库端口
DB_DATABASE=nads # 数据库名
DB_USERNAME=nads # 数据库用户名
DB_PASSWORD=GQip***02X # 数据库用户密码
DB_CHARSET=UTF8

# cache setting
CACHE_DRIVER=redis # cache 使用的驱动 file memory redis
CACHE_PREFIX=cache # cache的key前缀

# redis setting

REDIS_CLIENT=predis
REDIS_HOST=127.0.0.1 # redis服务地址
REDIS_PORT=6380 # redis服务端口
REDIS_PASSWORD=null # redis连接密码
REDIS_DB=0  # redis的默认使用数据库
REDIS_CACHE_DB=1 # cache使用的redis数据库
```

#### 1.8.3 关于Python

需要修改下面的文件

```sehll
# 修改 <project_dir>/langchian/config.yaml中的chatModel 和 embeddingModel 以及qdrant 的内容
chatModel:
  model: "gpt-oss"
  base_url: "http://43.143.151.41:3000/v1"
  api_key: "sk-45jfj2wN89d0hwLFA18c71D7D3A8962b9eBe96F6Ea7d8cF5"
embeddingModel:
    model: "nomic-embed-text"
    base_url: "http://43.143.151.41:3000/v1"
    api_key: "sk-45jfj2wN89d0hwLFA18c71D7D3A8962b9eBe96F6Ea7d8cF5"
qdrant:
  server: "http://localhost:6333"
  
```
#### 1.8.4 安装 guacd

两种方法任选其一
1. apt安装
```shelll
apt install guacd
systemctl start guacd
systemctl enable guacd
```
2.docker安装
```shelll
docker run --name guacd \
  --network host \
  -d --restart unless-stopped \
  guacamole/guacd:1.6.0
```

### 1.9 启动

#### 1.9.1 启动Qdrant向量数据库

```shell
# docker启动qdrant
# /home/ubuntu/web/qdrant 需要改为 1.3.1.2中创建的路径
docker run -it -d -v /home/ubuntu/web/qdrant:/qdrant/storage --name qdrant_database -p 6333:6333 qdrant:1.15
```

#### 1.9.2 构建向量数据库

需要用到llm_parse代码，在执行之前需要激活虚拟环境并修改如下内容。修改之后，使用 python main.py 执行llm_parse的main.py。

```python
# 激活虚拟环境
source 
# main.py
asyncio.run(process_file(".")) # 需要将 . 改为课程资源所在路径
# llm_parse/llm/__init__.py
qdrant = QdrantClient(
   url="http://localhost:6333" # 需要修改为对应的
 )
# 需要修改为对应的模型名、url以及api_key
embedding_model = CustomEmbeddings(
    model="nomic-embed-text",
    base_url="http://43.143.151.41:3000/v1",
    api_key="sk-45jfj2wN89d0hwLFA18c71D7D3A3462b9eBe96F6Ea7d8ad5",
)
```

#### 1.9.3 同步依赖并启动项目

```shell
cd nads/back
# 执行下面的命令同步php依赖并生成索引
../../composer.phar dump-autoload

# 启动项目，务必在完成上面之后执行下面的
# 需要用到screen（用于多会话管理），安装命令如下
sudo apt install screen
./start.sh start
```

#### 1.9.4 启动之后

```shell
# 进入会话查看相关服务是否启动
screen -r nads_project_front # 进入前端会话
# 退出前端会话之后进入后端会话，如何退出见 2.1.3
screen -r nads_project_back # 进入后端会话

# 查看相关服务的启动日志 
# 位于项目目录下，查看前端日志
cd src
cat front.log

# 位于项目目录下，查看后端日志
cd back
cat back.log
```

# 2 维护

### 2.1 会话操作

#### 2.1.1 列出已有会话

```shell
# 查看已有的会话
screen -ls
# 输出示例如下
98019.nads_project_python      (09/23/25 20:37:18)     (Detached) # python启动会话
797833.nads_project_front       (09/23/25 20:37:17)     (Detached) # 前端启动会话
567249.nads_project_back        (09/23/25 18:46:53)     (Detached) # 后端启动会话
```

#### 2.1.2 进入会话

```shell
screen -r <会话名>
# 例如：
screen -r nads_project_front # 进入前端会话
screen -r nads_project_back # 进入后端会话
```

#### 2.1.3 退出会话

先按住Ctrl键，然后按a键（松开），再按d键

### 2.2 前端未启动，重新启动

```shell
screen -ls
# 预计输出
98019.nads_project_python      (09/23/25 20:37:18)     (Detached) # python启动会话
797833.nads_project_front       (09/23/25 20:37:17)     (Detached) # 前端启动会话
567249.nads_project_back        (09/23/25 18:46:53)     (Detached) # 后端启动会话

# 如果存在, 进入会话命令如下,
screen -r nads_project_front

# 如果不存在 nads_project_front，建立会话（会自动进入会话）
screen -S nads_project_front

# 进入会话后执行
# cd到前端目录
cd /xx/xx/nads/src
npm run build
npm start >> front.log
# 预计输出
(node:2814469) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:2814469) [DEP0060] DeprecationWarning: The `util._extend` API is deprecated. Please use Object.assign() instead.
```

### 2.3 后端重新启动

```shell
# 通过列出所有会话，检查是否存在后端会话 见2.1.1

# 如果存在, 进入会话命令如下：
screen -r nads_project_back

# 如果不存在，则需要建立会话（会自动进入会话）
screen -S nads_project_back
# 位于项目录下
cd back
php artisan serve >> back.log
```

### 2.4 存储池设置

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

### 2.5 vnc/docker连接异常

使用程序根目录的start.sh脚本重新启动node服务，详细看  [重新启动](README.md#32-重新启动)。

### 2.6 如果ovs交换机出现 no such device 情况，可手动删除僵尸端口

```shell
# 把某个交换机上的端口删除的命令
ovs-vsctl del-port <bridge> <port> 
```

### 2.7 添加新类别后，在管理类别中显示为“未分配ID”

`在课程管理页面添加新类别后，如果出现在管理类别中显示为“未分配ID"的情况，点击刷新类别，即可正确被使用。`

### 2.8 chatenv问题

需要修改的文件包含

```shell
chatenv/bin/activate
chatenv/bin/pip
chatenv/bin/pip3
chatenv/bin/pip3.10
```

具体的修改内容：

- chatenv/bin/activate

  ```shell
  vi chtenv/bin/activate
  # 修改下面的内容到实际的chatenv路径
  VIRTUAL_ENV=/home/ubuntu/chatenv
  ```

- chatenv/bin/pip

  ```python
  vi chatenv/bin/pip
  # 将下面的内容修改为实际的chatenv路径，下面的内容为pip寻找python解释器的路径
  #!/var/www/chatenv/bin/python3
  ```

- chatenv/bin/pip3、chatenv/bin/pip3.10 

  与chatenv/bin/pip 类似

# 3 更新

### 3.1 在Git中生成和应用补丁（Patch）

在软件开发中，补丁（Patch）是一种重要的代码更改管理工具。Git提供了生成和应用补丁的功能，这对于代码版本控制和协作开发非常有用。

#### 3.1.1 生成补丁

在Git中，可以使用*git diff*和*git format-patch*命令来生成补丁文件。*git diff*命令可以创建一个补丁文件，其中包含自上次提交以来的所有更改。例如，要生成一个包含所有更改的补丁文件，可以使用以下命令：

```shell 
git diff > changes.patch 
```

如果只想为特定文件生成补丁，可以指定文件名：

```shell
git diff Test.java > test.patch
```

另一种方法是使用*git format-patch*命令，它会生成一个或多个补丁文件，每个文件对应一个提交。这些补丁文件包含了提交的详细信息，如作者、提交信息和更改内容。例如，要生成最近一次提交的补丁，可以使用：

```shell
git format-patch HEAD^
```

如果需要生成两个特定提交之间的补丁，可以指定提交范围：

```shell
git format-patch <commit1>..<commit2>
```

#### 3.1.2 应用补丁

应用补丁时，可以使用*git apply*或*git am*命令。*git apply*命令会将补丁中的更改应用到工作目录中，但不会创建新的提交。在应用补丁之前，可以使用*--check*选项来测试补丁是否能够成功应用：

git apply --check changes.patch

如果一切正常，可以使用以下命令应用补丁：

```shell
git apply changes.patch
```

*git am*命令则会将补丁文件中的更改应用到当前分支，并创建新的提交。这个命令会保留原始提交的作者信息和提交信息。例如，要应用一个补丁文件，可以使用：

```shell
git am 0001-limit-log-function.patch
```

如果在应用补丁时遇到冲突，可以使用*--abort*选项来取消所有已应用的补丁，或者解决冲突后使用*--resolved*继续应用剩余的补丁。

#### 3.1.3 解决冲突

当应用补丁发生冲突时，有两种主要的解决方案。第一种是使用*git apply --reject*命令强制应用补丁，冲突的部分会保存为*.rej*文件，然后手动解决冲突。第二种是编辑发生冲突的代码文件，然后使用*git add*命令将更改添加到工作区，并使用*git am --resolved*命令继续应用补丁。

在解决冲突时，重要的是要确保更改是正确的，并且与原始补丁文件的期望相符。如果不确定，可以参考*.rej*文件或原始补丁文件中的内容来进行校对。apply /path/to/fix_login.patch # 

### 3.2 重新启动

*注：start.sh 脚本能够停止已启动的服务，在选择停止后才会启动新的服务*

```shell
# 切换到项目目录，执行start.sh 脚本如下
./start.sh start
# 在选择前端启动模式时，选择“build”，如下：输入“build”即可
[INFO] 步骤 3/3: 启动前端服务...
选择前端运行模式 dev or build:
```

在启动中出现问题，请见 [2 维护](README.md#2-维护)

### 3.3 其他问题
拷贝日志文件，位置为 src/front.log 、 back/back.log以及back/storage/logs/laravel.log ，查看并与开发人员联系
