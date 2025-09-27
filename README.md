# nads
npm install
npm run dev
### 初始存储池设置
virsh pool-destroy default       # 停止名为 default 的存储池（正在运行时使用）
virsh pool-undefine default      # 删除存储池的配置定义（从 libvirt 配置中移除）
virsh pool-define-as --name default --type dir --target /path/to/vm/images # 定义一个新的存储池（名字 default，类型为目录，指定存放虚拟机镜像的路径）
virsh pool-build default         # 初始化存储池目录（如果目录不存在则创建）
virsh pool-start default         # 启动存储池，让其可用
virsh pool-autostart default     # 设置存储池开机自动启动
使用顺序一般是：
如果要重建存储池，首先 destroy 停止 → undefine 删除定义 → define-as 重新定义 → build 初始化 → start 启动 → autostart 开机自动启用。
如果系统还没有默认的存储池，可以直接从 define-as 开始，后续步骤依次进行即可。
### vnc/docker连接异常
使用程序根目录的start.sh脚本重新启动node服务，然后选择build模式启动。