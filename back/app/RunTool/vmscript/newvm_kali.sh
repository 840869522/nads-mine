#!/bin/bash
# 优化版虚拟机创建脚本（增强：非 cloud-init 镜像自动注入静态 IP）
# 使用 backing_file 技术避免高IO的 convert；对 Kali/Win/CentOS 等非 cloud 镜像直接写入网络配置
set -e

# ---------- 参数检查 ----------
if [ $# != 9 ]; then
  echo "USAGE: $0 num image_name ipCIDR SCENE_ID flag switch_name vm_name IMAGE_DIR INSTANCE_BASE_DIR"
  echo "e.g.   $0 1062 Report-tools.qcow2 10.100.0.3/16 scene-uuid NULL S-1_xxx VM-1 /path/images /path/instances/scene-uuid"
  exit 1
fi

NUM="$1"
IMAGE_PARAM="$2"          # 可能是 xxx.qcow2 / xxx.img / 或 "repo:tag"
IP_CIDR="$3"              # 形如 10.100.0.3/16
SCENE_ID="$4"
FLAG="$5"
SWITCH_NAME="$6"
VM_NAME="$7"
IMAGE_DIR="$8"
INSTANCE_BASE_DIR="$9"

# ---------- 常量/缺省 ----------
SCRIPT_DIR=$(cd "$(dirname "$0")"; pwd)
TEMPLATE_DIR="$SCRIPT_DIR"
DNS_LIST="${DNS_OVERRIDE:-"8.8.8.8 1.1.1.1"}" # 自定义 DNS: export DNS_OVERRIDE="10.100.0.2 1.1.1.1"

echo "DEBUG: Script directory: $SCRIPT_DIR"
echo "DEBUG: Template directory: $TEMPLATE_DIR"
echo "DEBUG: IMAGE_DIR: $IMAGE_DIR"
echo "DEBUG: INSTANCE_BASE_DIR: $INSTANCE_BASE_DIR"

# ---------- 实例目录 ----------
INSTANCE_DIR="$INSTANCE_BASE_DIR/$VM_NAME"
echo "DEBUG: Recreate instance dir: $INSTANCE_DIR"
rm -rf "$INSTANCE_DIR"
mkdir -p "$INSTANCE_DIR"

# ---------- 解析基础镜像 ----------
IMAGE_BASE_NAME=$(echo "$IMAGE_PARAM" | cut -d':' -f1 | sed 's/\.[^.]*$//')
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
echo "DEBUG: Source image: $SOURCE_IMAGE_PATH"

DESTINATION_IMAGE_NAME="$IMAGE_BASE_NAME.qcow2"
DESTINATION_IMAGE_PATH="$INSTANCE_DIR/$DESTINATION_IMAGE_NAME"

# ---------- cloud-init 模板（对 cloud 镜像仍保留） ----------
if [ ! -f "$TEMPLATE_DIR/network-config" ] || [ ! -f "$TEMPLATE_DIR/user-data" ] || [ ! -f "$TEMPLATE_DIR/meta-data" ]; then
  echo "WARN: Template files not found in $TEMPLATE_DIR (network-config/user-data/meta-data). Skip ISO but continue..."
  CI_TEMPLATES_OK=0
else
  CI_TEMPLATES_OK=1
  n="$NUM" ip="$IP_CIDR" SCENE_ID="$SCENE_ID" flag="$FLAG" eval "echo \"$(cat "$TEMPLATE_DIR/network-config")\"" > "$INSTANCE_DIR/network-config"
  n="$NUM" ip="$IP_CIDR" SCENE_ID="${SCENE_ID}_$VM_NAME" flag="$FLAG" eval "echo \"$(cat "$TEMPLATE_DIR/user-data")\"" > "$INSTANCE_DIR/user-data"
  cp "$TEMPLATE_DIR/meta-data" "$INSTANCE_DIR/"
  echo "FOREGROUND: Creating cloud-init ISO image..."
  genisoimage -output "$INSTANCE_DIR/config.iso" -volid cidata -joliet -rock \
    "$INSTANCE_DIR/meta-data" "$INSTANCE_DIR/network-config" "$INSTANCE_DIR/user-data" || echo "WARN: genisoimage failed (non-fatal)."
  echo "FOREGROUND: ISO image created (if genisoimage succeeded)."
fi

# ---------- 创建差分盘 ----------
echo "FOREGROUND: Creating differential image using backing file..."
qemu-img create -f qcow2 -o backing_file="$SOURCE_IMAGE_PATH",backing_fmt=qcow2 "$DESTINATION_IMAGE_PATH" 50G
echo "FOREGROUND: Differential image created."

# ---------- 资源规格 ----------
if [[ "$IMAGE_BASE_NAME" == *"SecurityOnion"* ]]; then
  RAM_SIZE=8192; VCPU_NUM=4; echo "DEBUG: SecurityOnion -> RAM 8G, vCPU 4"
elif [[ "$IMAGE_BASE_NAME" == *"kalinew"* ]]; then
  RAM_SIZE=8192; VCPU_NUM=8; echo "DEBUG: kalinew -> RAM 8G, vCPU 8"
elif [[ "$IMAGE_BASE_NAME" == *"Report-tools"* ]]; then
  RAM_SIZE=8192; VCPU_NUM=4; echo "DEBUG: Report-tools -> RAM 8G, vCPU 4"
else
  RAM_SIZE=8192; VCPU_NUM=4; echo "DEBUG: Standard -> RAM 8G, vCPU 4"
fi

# ---------- 解析 IP/CIDR ----------
IP_ADDR="${IP_CIDR%/*}"
CIDR="${IP_CIDR#*/}"
# CIDR->掩码
cidr_to_netmask() {
  local c=$1; local full=$((c/8)); local rem=$((c%8)); local i oct mask=""
  for ((i=0;i<4;i++)); do
    if (( i < full )); then oct=255
    elif (( i==full )); then (( rem==0 )) && oct=0 || oct=$(( 256 - 2**(8-rem) ))
    else oct=0
    fi
    mask+=$oct; [[ $i -lt 3 ]] && mask+="."
  done
  echo "$mask"
}
NETMASK=$(cidr_to_netmask "$CIDR")

# 自动推算网关
if [ -z "${GATEWAY_OVERRIDE:-}" ]; then
  ip_to_int() { local IFS=.; read -r a b c d <<< "$1"; echo $(( (a<<24)+(b<<16)+(c<<8)+d )); }
  int_to_ip() { local x=$1; printf "%d.%d.%d.%d" $(( (x>>24)&255 )) $(( (x>>16)&255 )) $(( (x>>8)&255 )) $(( x&255 )); }
  mask_to_int() { local IFS=.; read -r a b c d <<< "$1"; echo $(( (a<<24)+(b<<16)+(c<<8)+d )); }
  IP_INT=$(ip_to_int "$IP_ADDR")
  MASK_INT=$(mask_to_int "$NETMASK")
  NET_INT=$(( IP_INT & MASK_INT ))
  GW_INT=$(( NET_INT + 1 ))
  GW_AUTO=$(int_to_ip "$GW_INT")
  if [ "$CIDR" -ge 31 ]; then
    IFS=. read -r a b c d <<< "$IP_ADDR"
    GW_AUTO="$a.$b.$c.1"
  fi
  GATEWAY="$GW_AUTO"
else
  GATEWAY="$GATEWAY_OVERRIDE"
fi

echo "DEBUG: IP=$IP_ADDR CIDR=$CIDR NETMASK=$NETMASK GW=$GATEWAY DNS=[$DNS_LIST]"

# ---------- 生成固定 MAC ----------
VM_MAC=$(printf "52:54:00:%02x:%02x:%02x" $((RANDOM%256)) $((RANDOM%256)) $((RANDOM%256)))
echo "DEBUG: Generated VM MAC: $VM_MAC"

# ---------- 写静态网络配置 ----------
if ! command -v virt-customize >/dev/null 2>&1; then
  echo "ERROR: virt-customize not found. Please install with: sudo apt-get install -y libguestfs-tools"
  exit 1
fi

echo "FOREGROUND: Injecting static network config into guest image..."

# 使用单个 virt-customize 调用，避免多次调用开销
virt-customize -a "$DESTINATION_IMAGE_PATH" \
  --mkdir /etc/network/interfaces.d \
  --mkdir /etc/netplan \
  --mkdir /etc/udev/rules.d \
  --write /etc/network/interfaces.d/eth0:"auto eth0
iface eth0 inet static
  address $IP_ADDR
  netmask $NETMASK
  gateway $GATEWAY
  dns-nameservers $DNS_LIST" \
  --write /etc/netplan/01-netcfg.yaml:"network:
  version: 2
  renderer: networkd
  ethernets:
    eth0:
      dhcp4: false
      addresses: [$IP_ADDR/$CIDR]
      routes:
        - to: 0.0.0.0/0
          via: $GATEWAY
      nameservers:
        addresses: [${DNS_LIST// /, }]" \
  --write /etc/udev/rules.d/70-persistent-net.rules:"SUBSYSTEM==\"net\", ACTION==\"add\", ATTR{address}==\"$VM_MAC\", NAME=\"eth0\"" \
  --run-command "if [ -d /etc/NetworkManager ]; then mkdir -p /etc/NetworkManager/conf.d; echo '[keyfile]' > /etc/NetworkManager/conf.d/unmanaged-eth0.conf; echo 'unmanaged-devices=interface-name:eth0' >> /etc/NetworkManager/conf.d/unmanaged-eth0.conf; fi" \
  --run-command "printf '$(for d in $DNS_LIST; do echo nameserver $d; done)' > /etc/resolv.conf || true"

echo "FOREGROUND: Static IP injected."

# ---------- virt-install 启动 ----------
echo "FOREGROUND: Starting virt-install..."
virt-install --virt-type kvm \
  --name "$VM_NAME" \
  --ram "$RAM_SIZE" \
  --vcpus "$VCPU_NUM" \
  --network network="$SWITCH_NAME",model=virtio,mac="$VM_MAC" \
  --disk path="$DESTINATION_IMAGE_PATH",device=disk,bus=virtio,format=qcow2 \
  $( [ "$CI_TEMPLATES_OK" = "1" ] && echo "--disk path=$INSTANCE_DIR/config.iso,device=cdrom" ) \
  --os-variant=ubuntu20.04 \
  --graphics vnc,listen=0.0.0.0 \
  --noautoconsole \
  --import

echo "FOREGROUND: virt-install command for $VM_NAME completed."
echo "DEBUG: All tasks for VM '$VM_NAME' have completed."
