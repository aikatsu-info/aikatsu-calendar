#!/bin/bash
# 使い方ページ（usage.html）の画像・動画を、スマホ用・PC用ともまとめて作り直す。
# Mac で実行すると、iPhone と同じヒラギノの文字で撮れる（フォントは Mac に入っているものを使う）。
# 使い方（リポジトリのどこからでも可）: bash tools/usage-capture/run-all.sh
# 必要なもの: Node.js・ffmpeg・webp（brew install node ffmpeg webp）と、リポジトリの直下で
#   npm install --no-save playwright@1.63.0 && npx playwright install chromium
set -euo pipefail
cd "$(dirname "$0")/../.."
W="$(mktemp -d)"
trap 'rm -rf "$W"' EXIT
# フォントのディレクトリは空にする（追加のフォントを使わず、Mac のヒラギノで表示させるため）
mkdir -p "$W/fonts" "$W/sp/screens" "$W/sp/out" "$W/sp/tmp" "$W/pc/screens" "$W/pc/out" "$W/pc/tmp"
T=tools/usage-capture
# 画像を WebP にする（入力, 出力, 横幅）。ffmpeg に libwebp がなければ cwebp を使う（Homebrew の ffmpeg には入っていないことがある）
webp(){
  if ffmpeg -hide_banner -encoders 2>/dev/null | grep -q libwebp; then
    ffmpeg -y -loglevel error -i "$1" -vf "scale=$3:-2" -c:v libwebp -quality 86 "$2"
  elif command -v cwebp > /dev/null; then
    cwebp -quiet -q 86 -resize "$3" 0 "$1" -o "$2"
  else
    echo "WebP に変換できません。brew install webp を実行してから、もう一度実行してください" >&2; exit 1
  fi
}

echo "== スマホ用：画面を撮影"
node $T/cap-screens.js "$W/sp/screens"
echo "== スマホ用：1枚目の画像"
CARD_THEME=calm node $T/cap-cards.js "$W/sp/screens" "$W/fonts" "$W/sp/out" > /dev/null
webp "$W/sp/out/card-1.png" images/usage/card-1.webp 780
echo "== スマホ用：2〜7枚目の動画"
CARD_THEME=calm node $T/cap-cards-anim.js "$W/sp/screens" "$W/fonts" images/usage "$W/sp/tmp"

echo "== PC用：画面を撮影"
CARD_SET=pc node $T/cap-screens.js "$W/pc/screens"
echo "== PC用：1枚目の画像"
CARD_SET=pc node $T/cap-cards.js "$W/pc/screens" "$W/fonts" "$W/pc/out" > /dev/null
webp "$W/pc/out/card-pc-1.png" images/usage/card-pc-1.webp 1600
echo "== PC用：2〜7枚目の動画"
CARD_SET=pc node $T/cap-cards-anim.js "$W/pc/screens" "$W/fonts" images/usage "$W/pc/tmp"

echo "完了：images/usage/ の画像・動画を作り直しました"
