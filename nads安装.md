## PHP 安装

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

## Node 和Npm安装

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

安装

```shell
sudo ln -s $PWD/node-v22.19.0-linux-x64/bin/node /usr/local/bin
sudo ln -s $PWD/node-v22.19.0-linux-x64/bin/npm /usr/local/bin
sudo ln -s $PWD/node-v22.19.0-linux-x64/bin/npx /usr/local/bin
```

## 资源

```sheel
|home
|-----ubuntu
|-----------web
|--------------virsh
|-------------------images
|-------------------instances
|--------------courses
|--------------qdrant
|xxx
|-----nads
|---------src
|--------------node_modules
|----------back
|--------------vendor
|----------composer.phar
# 拷贝 node_modules vendor composer.phar
```

```shell
# 拷完back/vendor 执行下面的加载php依赖
cd nads/back
../../composer.phar dump-autoload
```

## 虚拟机脚本权限设置

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

## 部署

```shell
# qdrant docker启动
docker run -it -d -v /home/ubuntu/web/qdrant:/qdrant/storage  -p 6333:6333 qdrant:1.15
# 获取代码
git clone <github仓库地址>
# 安装后端依赖
cd nads/back
$PWD/composer.phar install
cd ../src
npm install
cd ../../
./start.sh start
```


#存储池设置
virsh pool-destroy default       # 停止存储池
virsh pool-undefine default      # 删除存储池定义
virsh pool-define-as --name default --type dir --target 虚拟机镜像所在目录
virsh pool-build default
virsh pool-start default
virsh pool-autostart default

