#!/bin/bash

# 检查参数数量
if [ $# -ne 6 ]; then
    echo "Usage: $0 num base_image_name network_name vm_name image_dir instance_base_dir"
    echo "Example: $0 15 win7 ovs-network ns15 /home/ubuntu/virsh/images /home/ubuntu/virsh/instances"
    exit 1
fi

INSTANCE_NUM=$1
BASE_IMAGE_NAME=$2
NETWORK=$3
VM_NAME=$4
IMAGE_DIR=$5
INSTANCE_BASE_DIR=$6

# 虚拟机实例目录
INSTANCE_DIR="${INSTANCE_BASE_DIR}/${VM_NAME}"

# 基础镜像路径（不含扩展名）
BASE_IMAGE="${IMAGE_DIR}/${BASE_IMAGE_NAME}"

# 内存大小（单位：MB）
MEMORY_SIZE=4096

# CPU核心数
CPU_CORES=4

# 图形界面配置（VNC）
GRAPHICS="vnc,listen=0.0.0.0"

# 创建实例目录
echo "--- [INFO] 开始创建虚拟机: ${VM_NAME} ---"
echo "[SETUP] 虚拟机实例目录: ${INSTANCE_DIR}"

rm -rf "${INSTANCE_DIR}"
mkdir -p "${INSTANCE_DIR}"

# 创建增量磁盘镜像
echo "[IMAGE] 正在创建差分镜像..."
qemu-img create -f qcow2 -F qcow2 \
    -o backing_file="${BASE_IMAGE}.qcow2" \
    "${INSTANCE_DIR}/disk.qcow2"
echo "[IMAGE] 差分镜像创建成功。"

# 创建虚拟机
echo "[VIRT] 正在执行 virt-install 命令..."
virt-install \
    --connect qemu:///system \
    --name "${VM_NAME}" \
    --ram "${MEMORY_SIZE}" \
    --vcpus "${CPU_CORES}" \
    --os-variant win2k3r2 \
    --disk path="${INSTANCE_DIR}/disk.qcow2",format=qcow2,bus=ide \
    --network network="${NETWORK}",model=virtio \
    --graphics "${GRAPHICS}" \
    --noautoconsole \
    --import

echo "[VIRT] virt-install 命令执行完毕。"
echo "--- [SUCCESS] 虚拟机 ${VM_NAME} 已成功启动 ---"

# 输出VNC连接信息
echo "VNC 连接信息:"
virsh domdisplay "${VM_NAME}"
