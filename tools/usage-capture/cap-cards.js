// cards.html のカードを1枚ずつ画像にする（使い方ページのカード型デザイン用）。
// 使い方: node tools/usage-capture/cap-cards.js <画面画像のディレクトリ> <フォントのディレクトリ> <出力ディレクトリ>
//   画面画像は cap-screens.js で撮ったもの。
//   フォントは M PLUS Rounded 1c（OFL）。npm pack @fontsource/m-plus-rounded-1c で取得し、展開した package/files を渡す。
const { chromium } = require('playwright');
const path = require('path');
// フォントのディレクトリにある woff2 を @font-face にする。ファイル名の先頭で書体名を決める
// （m-plus-rounded-1c → MPR、noto-serif-jp → NSJ（明朝）、noto-sans-jp → NSANS（ゴシック））
function fontFaces(dir){
  const fam = { 'm-plus-rounded-1c':'MPR', 'noto-serif-jp':'NSJ', 'noto-sans-jp':'NSANS' };
  return require('fs').readdirSync(dir).map(f => {
    const m = f.match(/^(m-plus-rounded-1c|noto-serif-jp|noto-sans-jp)-[a-z]+-(\d+)-normal\.woff2$/);
    return m ? `@font-face{font-family:"${fam[m[1]]}";font-weight:${m[2]};src:url("file://${dir}/${f}") format("woff2");}` : '';
  }).join('\n');
}
const [SCREENS, FONTS, O] = process.argv.slice(2).map(p => path.resolve(p));
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport:{ width:1800, height:1000 }, deviceScaleFactor:2 });
  // CARD_SET=pc なら PC 用のテンプレート
  await p.goto('file://' + path.join(__dirname, process.env.CARD_SET === 'pc' ? 'cards-pc.html' : 'cards.html'));
  // フォントのディレクトリが空のとき（Mac でヒラギノを使うとき）は何も足さない
  const ff = fontFaces(FONTS); if (ff.trim()) await p.addStyleTag({ content: ff });
  // CARD_THEME=calm のように指定すると、cards-<名前>.css を重ねてデザインを切り替える
  if (process.env.CARD_THEME) await p.addStyleTag({ path: path.join(__dirname, 'cards-' + process.env.CARD_THEME + '.css') });
  await p.evaluate(dir => document.querySelectorAll('img[data-screen]').forEach(i => { i.src = 'file://' + dir + '/' + i.dataset.screen + '.png'; }), SCREENS);
  await p.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(i => i.decode().catch(() => {}))); });
  for (const c of await p.$$('.card')) {
    const id = await c.getAttribute('id');
    await c.screenshot({ path: path.join(O, id + '.png'), omitBackground: true });
    console.log(id);
  }
  await b.close();
})();
