// cards.html のカードを1枚ずつ画像にする（使い方ページのカード型デザイン用）。
// 使い方: node tools/usage-capture/cap-cards.js <画面画像のディレクトリ> <フォントのディレクトリ> <出力ディレクトリ>
//   画面画像は cap-screens.js で撮ったもの。
//   フォントは M PLUS Rounded 1c（OFL）。npm pack @fontsource/m-plus-rounded-1c で取得し、展開した package/files を渡す。
const { chromium } = require('playwright');
const path = require('path');
const [SCREENS, FONTS, O] = process.argv.slice(2).map(p => path.resolve(p));
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport:{ width:1800, height:1000 }, deviceScaleFactor:2 });
  await p.goto('file://' + path.join(__dirname, 'cards.html'));
  const face = (w, sub) => `@font-face{font-family:"MPR";font-weight:${w};src:url("file://${FONTS}/m-plus-rounded-1c-${sub}-${w}-normal.woff2") format("woff2");}`;
  await p.addStyleTag({ content: [800, 700].flatMap(w => ['latin', 'japanese'].map(s => face(w, s))).join('\n') });
  await p.evaluate(dir => document.querySelectorAll('img[data-screen]').forEach(i => { i.src = 'file://' + dir + '/' + i.dataset.screen + '.png'; }), SCREENS);
  await p.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(i => i.decode().catch(() => {}))); });
  for (const c of await p.$$('.card')) {
    const id = await c.getAttribute('id');
    await c.screenshot({ path: path.join(O, id + '.png'), omitBackground: true });
    console.log(id);
  }
  await b.close();
})();
