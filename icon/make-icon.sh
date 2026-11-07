#!/bin/bash
# 重新生成 AppIcon.icns（离线，仅用系统 sips + iconutil + CoreGraphics）
#
# 用法：把新的 1024x1024 方形主图存为 icon-1024-square.png，然后执行本脚本
#   → 自动裁成 macOS 风格圆角（超椭圆）→ 生成 icon-1024.png → 打包 AppIcon.icns
set -e
cd "$(dirname "$0")"

SQUARE="icon-1024-square.png"   # 方形原始主图（满幅渐变）
MASTER="icon-1024.png"          # 最终使用的圆角主图
ICNS="AppIcon.icns"

# ---- 1. 若存在方形主图，先裁成圆角（超椭圆 squircle，外缘透明 + 轻微投影）----
if [ -f "$SQUARE" ]; then
  if [ ! -x /tmp/round-icon ]; then
    xcrun swiftc -O round-icon.swift -framework CoreGraphics -framework ImageIO \
      -o /tmp/round-icon 2>/dev/null || true
  fi
  if [ -x /tmp/round-icon ]; then
    /tmp/round-icon "$SQUARE" "$MASTER"
  else
    echo "  [警告] 圆角工具编译失败，直接使用方形主图"
    cp "$SQUARE" "$MASTER"
  fi
fi

[ -f "$MASTER" ] || { echo "缺少主图 $MASTER"; exit 1; }

# ---- 2. 生成 16 → 1024 全尺寸 iconset ----
ICONSET="$(mktemp -d)/AppIcon.iconset"
mkdir -p "$ICONSET"

sips -z 16   16   "$MASTER" --out "$ICONSET/icon_16x16.png"      >/dev/null
sips -z 32   32   "$MASTER" --out "$ICONSET/icon_16x16@2x.png"   >/dev/null
sips -z 32   32   "$MASTER" --out "$ICONSET/icon_32x32.png"      >/dev/null
sips -z 64   64   "$MASTER" --out "$ICONSET/icon_32x32@2x.png"   >/dev/null
sips -z 128  128  "$MASTER" --out "$ICONSET/icon_128x128.png"    >/dev/null
sips -z 256  256  "$MASTER" --out "$ICONSET/icon_128x128@2x.png" >/dev/null
sips -z 256  256  "$MASTER" --out "$ICONSET/icon_256x256.png"    >/dev/null
sips -z 512  512  "$MASTER" --out "$ICONSET/icon_256x256@2x.png" >/dev/null
sips -z 512  512  "$MASTER" --out "$ICONSET/icon_512x512.png"    >/dev/null
cp "$MASTER" "$ICONSET/icon_512x512@2x.png"

# ---- 3. 打包 icns ----
iconutil -c icns "$ICONSET" -o "$ICNS"
echo "已生成 $ICNS"
