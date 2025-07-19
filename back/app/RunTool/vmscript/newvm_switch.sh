#!/bin/bash
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
else
    # 如果上面的方法找不到，就直接使用参数2作为文件名
    if [ -f "$IMAGE_DIR/$IMAGE_PARAM" ]; then
        SOURCE_IMAGE_PATH="$IMAGE_DIR/$IMAGE_PARAM"
    else
        echo "Error: Base image not found for '$IMAGE_PARAM' in $IMAGE_DIR"
        exit 1
    fi
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

# 使用模板生成配置文件
n=$1 ip=$3 SCENE_ID=$4 flag=$5 eval "echo \"$(cat "$TEMPLATE_DIR/network-config")\"" > "$INSTANCE_DIR/network-config"
n=$1 ip=$3 SCENE_ID=$4 flag=$5 eval "echo \"$(cat "$TEMPLATE_DIR/user-data")\"" > "$INSTANCE_DIR/user-data"
cp "$TEMPLATE_DIR/meta-data" "$INSTANCE_DIR/"

# 將所有慢速操作打包到一個子Shell中，並將其整體放入後台
(
  # 創建 cloud-init 使用的 ISO 文件
  echo "BACKGROUND: Creating cloud-init ISO image..."
  genisoimage -output "$INSTANCE_DIR/config.iso" -volid cidata -joliet -rock "$INSTANCE_DIR/meta-data" "$INSTANCE_DIR/network-config" "$INSTANCE_DIR/user-data"
  echo "BACKGROUND: ISO image created."

  # 複製並可能轉換基礎镜像到實例目錄
  echo "BACKGROUND: Copying base image to instance directory..."
  qemu-img convert -O qcow2 "$SOURCE_IMAGE_PATH" "$DESTINATION_IMAGE_PATH"
  echo "BACKGROUND: Image copied and converted to qcow2 format."

  # 執行 virt-install 命令
  echo "BACKGROUND: Starting virt-install..."
  virt-install --virt-type kvm \
    --network network=$6,model=virtio \
    --name "$7" \
    --ram=2048 \
    --vcpus=2 \
    --disk path="$DESTINATION_IMAGE_PATH",device=disk,bus=virtio,format=qcow2 \
    --disk path="$INSTANCE_DIR/config.iso",device=cdrom \
    --os-variant=ubuntu20.04 \
    --graphics vnc,listen=0.0.0.0 \
    --noautoconsole \
    --import
  
  echo "BACKGROUND: virt-install command for $7 completed."

) > /dev/null 2>&1 &

echo "DEBUG: All slow tasks for VM '$7' have been dispatched to the background."