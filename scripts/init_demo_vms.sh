#!/usr/bin/env bash
set -e
DIR=$(dirname "$0")/../demo-images
mkdir -p "$DIR"
cd "$DIR"

# Download minimal Ubuntu image (VM will get IP from br0 so you can SSH to it)
if [ ! -f ubuntu-demo.img ]; then
  curl -L -o ubuntu-demo.img \
    https://cloud-images.ubuntu.com/minimal/releases/jammy/release/ubuntu-22.04-minimal-cloudimg-amd64.img
fi

# Download Windows evaluation image
#if [ ! -f win-demo.qcow2 ]; then
#  curl -L -o win-demo.qcow2 https://go.microsoft.com/fwlink/?linkid=2215517
#fi

cd ..
src/.venv/bin/python3 src/main_cli_local.py create-vm \
  --vm-name demo-linux \
  --base-image demo-images/ubuntu-demo.img \
  --admin-password demo123
# The VM will obtain an IP via DHCP on br0; use that address to connect.

#python3 src/main_cli_local.py create-vm \
#  --vm-name demo-win \
#  --base-image demo-images/win-demo.qcow2 \
#  --admin-password P@ssw0rd

