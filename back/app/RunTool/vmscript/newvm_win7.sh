#!/bin/bash
# ==============================================================================
# Windows 7 虚拟机创建脚本 (兼容9参数版本)
#
# 版本: 1.1
# 更新: 修正了处理基础镜像名称的逻辑，避免重复添加 .qcow2 后缀。
# ==============================================================================

# 遇到任何错误则立即退出
set -e

# --- 1. 参数校验 ---
if [ $# != 9 ]; then
  echo "错误: 需要9个参数。"
  echo "用法: $0 <num> <image_name> <ip> <SCENE_ID> <flag> <switch_name> <vm_name> <IMAGE_DIR> <INSTANCE_BASE_DIR>"
  exit 1;
fi

# --- 2. 参数赋值与日志记录 ---
INSTANCE_NUM=$1
IMAGE_PARAM=$2
IP_WITH_PREFIX=$3
SCENE_ID=$4
FLAG=$5
SWITCH_NAME=$6
VM_NAME=$7
IMAGE_DIR=$8
INSTANCE_BASE_DIR=$9

IP_ADDRESS=$(echo "$IP_WITH_PREFIX" | cut -d'/' -f1)

echo "--- [INFO] 开始创建虚拟机: ${VM_NAME} ---"
echo "[PARAM] 镜像名称 (image_name): ${IMAGE_PARAM}"
# ... (其他日志保持不变)

# --- 3. 目录和路径准备 ---
INSTANCE_DIR="${INSTANCE_BASE_DIR}/${VM_NAME}"
echo "[SETUP] 虚拟机实例目录: ${INSTANCE_DIR}"

rm -rf "${INSTANCE_DIR}"
mkdir -p "${INSTANCE_DIR}"

# ★★★ 核心修复：采用与 Ubuntu 脚本相同的逻辑处理镜像名 ★★★
# 从传入的参数中提取不带扩展名的基础名称
IMAGE_BASE_NAME=$(echo "$IMAGE_PARAM" | sed 's/\.[^.]*$//')

# 确定基础镜像的完整路径
SOURCE_IMAGE_PATH="${IMAGE_DIR}/${IMAGE_BASE_NAME}.qcow2"
if [ ! -f "$SOURCE_IMAGE_PATH" ]; then
    echo "[ERROR] 基础镜像未找到: ${SOURCE_IMAGE_PATH}"
    exit 1
fi
echo "[SETUP] 基础镜像路径: ${SOURCE_IMAGE_PATH}"

# 目标差分镜像路径
DESTINATION_IMAGE_PATH="${INSTANCE_DIR}/disk.qcow2"
echo "[SETUP] 目标差分镜像路径: ${DESTINATION_IMAGE_PATH}"


# --- 4. 生成 Cloud-Init ISO ---
echo "[CONFIG] 正在生成 user-data..."
cat <<EOF > "${INSTANCE_DIR}/user-data"
#cloud-config
hostname: ${VM_NAME}
runcmd:
  - netsh interface ip set address name="本地连接" static ${IP_ADDRESS} 255.255.0.0 10.100.0.254 1
  - echo ${FLAG} > C:\flag.txt
EOF

echo "[CONFIG] 正在生成 meta-data..."
cat <<EOF > "${INSTANCE_DIR}/meta-data"
instance-id: ${VM_NAME}
local-hostname: ${VM_NAME}
EOF

echo "[CONFIG] 正在创建 Cloud-Init ISO (config.iso)..."
genisoimage -output "${INSTANCE_DIR}/config.iso" -volid cidata -joliet -rock "${INSTANCE_DIR}/user-data" "${INSTANCE_DIR}/meta-data"
echo "[CONFIG] config.iso 创建成功。"

# --- 5. 创建差分镜像 ---
echo "[IMAGE] 正在使用 backing file 创建差分镜像..."
qemu-img create -f qcow2 -o backing_file="${SOURCE_IMAGE_PATH}",backing_fmt=qcow2 "${DESTINATION_IMAGE_PATH}" 50G
echo "[IMAGE] 差分镜像创建成功。"

# --- 6. 使用 virt-install 创建并启动虚拟机 ---
echo "[VIRT] 正在执行 virt-install 命令..."
virt-install --virt-type kvm \
  --name "${VM_NAME}" \
  --ram=4096 \
  --vcpus=2 \
  --os-variant win7 \
  --disk path="${DESTINATION_IMAGE_PATH}",device=disk,bus=sata,format=qcow2 \
  --disk path="${INSTANCE_DIR}/config.iso",device=cdrom \
  --network network="${SWITCH_NAME}",model=virtio \
  --graphics vnc,listen=0.0.0.0 \
  --noautoconsole \
  --import

echo "[VIRT] virt-install 命令执行完毕。"
echo "--- [SUCCESS] 虚拟机 ${VM_NAME} 已成功启动 ---"

echo "VNC 连接信息:"
virsh domdisplay "${VM_NAME}"

