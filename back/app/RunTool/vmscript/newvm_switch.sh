#!/bin/bash
# 优化版虚拟机创建脚本
# 使用 backing_file 技术避免高IO的 `convert` 操作

# 遇到任何错误则立即退出
set -e

# 检查参数数量是否为9
if [ $# != 9 ]; then
  echo "USAGE: $0 num image_name ip SCENE_ID flag switch_name vm_name IMAGE_DIR INSTANCE_BASE_DIR"
  exit 1;
fi

# --- 核心修改：获取脚本自己所在的目录作为模板目录 ---
SCRIPT_DIR=$(cd $(dirname $0); pwd)
TEMPLATE_DIR="$SCRIPT_DIR"

echo "DEBUG: Script directory is: $SCRIPT_DIR"
echo "DEBUG: Template directory is: $TEMPLATE_DIR"

# --- 核心修改：从命令行参数获取目录 ---
IMAGE_DIR="$8"
INSTANCE_BASE_DIR="$9"

echo "DEBUG: IMAGE_DIR set to: $IMAGE_DIR"
echo "DEBUG: INSTANCE_BASE_DIR set to: $INSTANCE_BASE_DIR"

# 定义当前这个虚拟机的具体实例目录
INSTANCE_DIR="$INSTANCE_BASE_DIR/$7"

echo "DEBUG: Creating instance directory: $INSTANCE_DIR for VM: $7"
# 清理并创建实例目录
rm -rf "$INSTANCE_DIR"
mkdir -p "$INSTANCE_DIR"

# --- 核心修改：处理镜像名称和后缀 ---
# 从 "vm-qemu:latest" 或 "jammy-server-cloudimg-amd64.img" 中提取基础名称
IMAGE_PARAM="$2"
IMAGE_BASE_NAME=$(echo "$IMAGE_PARAM" | cut -d':' -f1 | sed 's/\.[^.]*$//')
# 检查基础镜像文件，优先qcow2，其次img
SOURCE_IMAGE_PATH=""
if [ -f "$IMAGE_DIR/$IMAGE_BASE_NAME.qcow2" ]; then
    SOURCE_IMAGE_PATH="$IMAGE_DIR/$IMAGE_BASE_NAME.qcow2"
elif [ -f "$IMAGE_DIR/$IMAGE_BASE_NAME.img" ]; then
    SOURCE_IMAGE_PATH="$IMAGE_DIR/$IMAGE_BASE_NAME.img"
elif [ -f "$IMAGE_DIR/$IMAGE_PARAM" ]; then
    SOURCE_IMAGE_PATH="$IMAGE_DIR/$IMAGE_PARAM"
else
    echo "Error: Base image not found for '$IMAGE_PARAM' in $IMAGE_DIR"
    exit 1
fi

# 确定目标文件名，统一使用qcow2后缀
DESTINATION_IMAGE_NAME="$IMAGE_BASE_NAME.qcow2"
DESTINATION_IMAGE_PATH="$INSTANCE_DIR/$DESTINATION_IMAGE_NAME"

echo "DEBUG: Source image found at: $SOURCE_IMAGE_PATH"

# 检查模板文件是否存在
echo "DEBUG: Checking for template files in $TEMPLATE_DIR..."
if [ ! -f "$TEMPLATE_DIR/network-config" ] || [ ! -f "$TEMPLATE_DIR/user-data" ] || [ ! -f "$TEMPLATE_DIR/meta-data" ]; then
  echo "Error: Template files not found in $TEMPLATE_DIR"
  exit 1
fi
echo "DEBUG: Template files found."

# ====== 最小改动开始：读取 ES 环境变量并用于渲染 ======
ELASTICSEARCH_HOST=${ELASTICSEARCH_HOST:-10.100.88.88}
ELASTICSEARCH_PORT=${ELASTICSEARCH_PORT:-9200}
# ====== 最小改动结束 ======

# ====== 采集策略：解析 Zeek/Sysdig 开关 ======
ZEEK_ENABLED=${ZEEK_ENABLED:-0}
SYSDIG_ENABLED=${SYSDIG_ENABLED:-0}

if [[ "${ZEEK_ENABLED,,}" =~ ^(1|true|yes|on)$ ]]; then
  ZEEK_FLAG=1
else
  ZEEK_FLAG=0
fi
echo "DEBUG: Zeek collection flag resolved to $ZEEK_FLAG (raw: $ZEEK_ENABLED)"

if [[ "${SYSDIG_ENABLED,,}" =~ ^(1|true|yes|on)$ ]]; then
  SYSDIG_FLAG=1
else
  SYSDIG_FLAG=0
fi
echo "DEBUG: Sysdig collection flag resolved to $SYSDIG_FLAG (raw: $SYSDIG_ENABLED)"

# 使用模板生成配置文件（保持原有 eval 渲染方式）
n=$1 ip=$3 SCENE_ID=$4 flag=$5 eval "echo \"$(cat "$TEMPLATE_DIR/network-config")\"" > "$INSTANCE_DIR/network-config"
# 将 ES 变量注入到 eval 的环境中；保持 SCENE_ID="$4_$7" 的既有行为
n=$1 ip=$3 SCENE_ID="$4_$7" flag=$5 ELASTICSEARCH_HOST="$ELASTICSEARCH_HOST" ELASTICSEARCH_PORT="$ELASTICSEARCH_PORT" \
  zeek="$ZEEK_FLAG" sysdig="$SYSDIG_FLAG" \
  eval "echo \"$(cat "$TEMPLATE_DIR/user-data")\"" > "$INSTANCE_DIR/user-data"
cp "$TEMPLATE_DIR/meta-data" "$INSTANCE_DIR/"

# --- MODIFICATION: The following commands will now run in the foreground ---

# 創建 cloud-init 使用的 ISO 文件
echo "FOREGROUND: Creating cloud-init ISO image..."
genisoimage -output "$INSTANCE_DIR/config.iso" -volid cidata -joliet -rock "$INSTANCE_DIR/meta-data" "$INSTANCE_DIR/network-config" "$INSTANCE_DIR/user-data"
echo "FOREGROUND: ISO image created."

echo "FOREGROUND: Creating differential image using backing file..."
qemu-img create -f qcow2 -o backing_file="$SOURCE_IMAGE_PATH",backing_fmt=qcow2 "$DESTINATION_IMAGE_PATH" 50G
echo "FOREGROUND: Differential image created."

# 根据镜像类型设置内存大小
# SecurityOnion、kalinew、Report-tools镜像使用8GB内存，其他镜像使用4GB内存
if [[ "$IMAGE_BASE_NAME" == *"SecurityOnion"* ]]; then
    RAM_SIZE=8192
    echo "DEBUG: SecurityOnion image detected, setting RAM to 8GB"
elif [[ "$IMAGE_BASE_NAME" == *"kalinew"* ]]; then
    RAM_SIZE=8192
    echo "DEBUG: kalinew image detected, setting RAM to 8GB"
elif [[ "$IMAGE_BASE_NAME" == *"Report-tools"* ]]; then
    RAM_SIZE=8192
    echo "DEBUG: Report-tools image detected, setting RAM to 8GB"
else
    RAM_SIZE=4096
    echo "DEBUG: Standard image detected, setting RAM to 4GB"
fi

if [[ "$NADS_VM_MEMORY" =~ ^[0-9]+$ ]]; then
    RAM_SIZE=$NADS_VM_MEMORY
    echo "DEBUG: Overriding RAM to ${RAM_SIZE}MB from NADS_VM_MEMORY"
fi

# 根据镜像类型设置CPU核心数
VCPU_NUM=4
if [[ "$IMAGE_BASE_NAME" == *"kalinew"* ]]; then
    VCPU_NUM=8
    echo "DEBUG: kalinew image detected, setting vCPUs to 8"
elif [[ "$IMAGE_BASE_NAME" == *"Report-tools"* ]]; then
    VCPU_NUM=4
    echo "DEBUG: Report-tools image detected, setting vCPUs to 4"
else
    echo "DEBUG: Standard image detected, setting vCPUs to 4"
fi

if [[ "$NADS_VM_CPU" =~ ^[0-9]+$ ]]; then
    VCPU_NUM=$NADS_VM_CPU
    echo "DEBUG: Overriding vCPUs to ${VCPU_NUM} from NADS_VM_CPU"
fi

# 執行 virt-install 命令
echo "FOREGROUND: Starting virt-install..."
virt-install --virt-type kvm \
  --network network=$6,model=virtio \
  --name "$7" \
  --ram=$RAM_SIZE \
  --vcpus=$VCPU_NUM \
  --disk path="$DESTINATION_IMAGE_PATH",device=disk,bus=virtio,format=qcow2 \
  --disk path="$INSTANCE_DIR/config.iso",device=cdrom \
  --os-variant=ubuntu20.04 \
  --graphics vnc,listen=0.0.0.0 \
  --noautoconsole \
  --import

echo "FOREGROUND: virt-install command for $7 completed."
echo "DEBUG: All tasks for VM '$7' have completed."
