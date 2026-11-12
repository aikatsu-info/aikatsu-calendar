#!/bin/bash
# 使い方ページ（usage.html）の画像・動画を、スマホ用・PC用ともまとめて作り直す。
# Mac で実行すると、iPhone と同じヒラギノの文字で撮れる（フォントは Mac に入っているものを使う）。
# 使い方（リポジトリのどこからでも可）: bash tools/usage-capture/run-all.sh
# 必要なもの: Node.js・ffmpeg（brew install node ffmpeg）と、リポジトリの直下で
#   npm install --no-save playwright@1.63.0 && npx playwright install chromium
set -euo pipefail
cd "$(dirname "$0")/../.."
W="$(mktemp -d)"
trap 'rm -rf "$W"' EXIT
# フォントのディレクトリは空にする（追加のフォントを使わず、Mac のヒラギノで表示させるため）
mkdir -p "$W/fonts" "$W/sp/screens" "$W/sp/out" "$W/sp/tmp" "$W/pc/screens" "$W/pc/out" "$W/pc/tmp"
T=tools/usage-capture

echo "== スマホ用：画面を撮影"
node $T/cap-screens.js "$W/sp/screens"
echo "== スマホ用：1枚目の画像"
CARD_THEME=calm node $T/cap-cards.js "$W/sp/screens" "$W/fonts" "$W/sp/out" > /dev/null
ffmpeg -y -loglevel error -i "$W/sp/out/card-1.png" -c:v libwebp -quality 86 images/usage/card-1.webp
echo "== スマホ用：2〜7枚目の動画"
CARD_THEME=calm node $T/cap-cards-anim.js "$W/sp/screens" "$W/fonts" images/usage "$W/sp/tmp"

echo "== PC用：画面を撮影"
CARD_SET=pc node $T/cap-screens.js "$W/pc/screens"
echo "== PC用：1枚目の画像"
CARD_SET=pc node $T/cap-cards.js "$W/pc/screens" "$W/fonts" "$W/pc/out" > /dev/null
ffmpeg -y -loglevel error -i "$W/pc/out/card-pc-1.png" -vf scale=1600:-2 -c:v libwebp -quality 86 images/usage/card-pc-1.webp
echo "== PC用：2〜7枚目の動画"
CARD_SET=pc node $T/cap-cards-anim.js "$W/pc/screens" "$W/fonts" images/usage "$W/pc/tmp"

echo "完了：images/usage/ の画像・動画を作り直しました"
