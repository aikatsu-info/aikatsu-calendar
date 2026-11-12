// cards.html の data-anim の付いた画面を操作動画に差し替えた、動くカード（MP4）を作る。
// 使い方: node tools/usage-capture/cap-cards-anim.js <画面画像のディレクトリ> <フォントのディレクトリ> <出力ディレクトリ> <作業用ディレクトリ> [名前,...]
//   画面画像・フォントは cap-cards.js と同じもの。
//   カードの背景（見出し・スマホ枠など）を静止画で撮り、スマホ画面の位置に操作の録画を重ねて動画にする。
const { chromium, newPage, tapFx, PC, VIEW } = require('./cap-common.js');
const path = require('path'), fs = require('fs');
// フォントのディレクトリにある woff2 を @font-face にする。ファイル名の先頭で書体名を決める
// （m-plus-rounded-1c → MPR、noto-serif-jp → NSJ（明朝）、noto-sans-jp → NSANS（ゴシック））
function fontFaces(dir){
  const fam = { 'm-plus-rounded-1c':'MPR', 'noto-serif-jp':'NSJ', 'noto-sans-jp':'NSANS' };
  return require('fs').readdirSync(dir).map(f => {
    const m = f.match(/^(m-plus-rounded-1c|noto-serif-jp|noto-sans-jp)-[a-z]+-(\d+)-normal\.woff2$/);
    return m ? `@font-face{font-family:"${fam[m[1]]}";font-weight:${m[2]};src:url("file://${dir}/${f}") format("woff2");}` : '';
  }).join('\n');
}
const { execFileSync } = require('child_process');
const [SCREENS, FONTS, O, TMP] = process.argv.slice(2, 6).map(p => path.resolve(p));
const ONLY = process.argv[6] ? process.argv[6].split(',') : null;
const W = ms => new Promise(r => setTimeout(r, ms));
// 出力する動画の横幅（px）。スマホ用カードは最大 320px で表示するので2倍。PC用（横 1200px のカード）は最大 920px 前後で表示する
const OUT_W = PC ? 1600 : 640;
// 録画する画面の大きさ（2x）
const REC_W = VIEW.width*2, REC_H = VIEW.height*2;
const tagCell = (p, day, id) => p.evaluate(([day,id])=>{ const c=[...document.querySelectorAll('.cal-day:not(.pad)')].find(c=>c.querySelector('.num').textContent.trim()===String(day)); c.id=id; }, [day,id]);
const jump = (p, sel, off) => p.evaluate(([s,o])=>{ const e=document.querySelector(s); window.scrollTo(0, e.getBoundingClientRect().top+scrollY-o); },[sel,off]);
const glide = (p, sel, off) => p.evaluate(([s,o])=>{ const e=document.querySelector(s); window.scrollTo({top:e.getBoundingClientRect().top+scrollY-o, behavior:'smooth'}); },[sel,off]);

// 各カードの操作。prep は録画前の状態づくり（静止画版の画面と同じ状態にする）、act が録画する操作
const SCENES = {
  day: {
    prep: async p => { await jump(p, '.tabs-row', 62); await tagCell(p, 22, 'u22'); },
    // 日付を押すと、その日の情報まで自動でスクロールする
    act: async p => { await p.click('#u22'); await W(1700); await p.locator('#dayPanelBody .item-head').first().click(); await W(1800); },
  },
  filter: {
    prep: async p => { await jump(p, '#legendCal', 70); },
    act: async p => {
      await p.click('#legendCal .chip:has-text("グッズ")'); await W(1500);
      await p.click('#legendCal .chip:has-text("イベント")'); await W(1500);
      await p.click('#legendCal .chip:has-text("グッズ")'); await W(500); await p.click('#legendCal .chip:has-text("イベント")'); await W(1200);
    },
  },
  switch: {
    prep: async p => { await jump(p, '.tabs-row', 62); },
    act: async p => { await p.click('#tab-topics-btn'); await W(1800); await p.click('#tab-cal-btn'); await W(1500); },
  },
  birthday: {
    prep: async p => { await p.click('#tab-topics-btn'); await jump(p, '.tabs-row', 62); },
    act: async p => {
      await p.click('#sortBirthdayBtn'); await W(1000);
      // 今月は最初から開いているので、スクロールして見せるだけ
      await glide(p, '.bday-month.current', 260); await W(2600);
    },
  },
  addcal: {
    prep: async p => { await tagCell(p, 22, 'u22'); await p.click('#u22'); await W(1000); await p.locator('#dayPanelBody .item-head').first().click(); await jump(p, '#dayPanel', 62); },
    act: async p => { await W(400); await p.locator('#dayPanelBody .add-cal-toggle').first().click(); await W(2400); },
  },
  export: {
    prep: async p => {},
    act: async p => {
      await p.click('#exportOpenBtn'); await p.evaluate(() => document.getElementById('exportTitle').blur()); await W(1000);
      await p.click('#exportPresets [data-preset="1y"]'); await W(1100);
      await p.click('#exportCats .chip:has-text("誕生日")'); await W(1300);
      await p.click('#exportDownloadBtn'); await W(900);
    },
  },
};

// 操作を 2x の解像度で録画して、画面だけの動画（スマホは 780x1688、PC は 2080x1120）にする
async function recordScreen(b, name){
  const dir = path.join(TMP, name); fs.mkdirSync(dir, { recursive:true });
  for (const f of fs.readdirSync(dir)) fs.unlinkSync(path.join(dir, f));
  const { ctx, p } = await newPage(b, { acceptDownloads:true });
  await tapFx(p); await SCENES[name].prep(p); await W(500);
  const cdp = await ctx.newCDPSession(p);
  const frames = [];
  cdp.on('Page.screencastFrame', async f => {
    const file = path.join(dir, 'f'+String(frames.length).padStart(5,'0')+'.jpg');
    fs.writeFileSync(file, Buffer.from(f.data, 'base64'));
    frames.push({ file, t: f.metadata.timestamp });
    try{ await cdp.send('Page.screencastFrameAck', { sessionId:f.sessionId }); }catch(e){}
  });
  await cdp.send('Page.startScreencast', { format:'jpeg', quality:92, maxWidth:REC_W, maxHeight:REC_H, everyNthFrame:1 });
  await W(700); await SCENES[name].act(p); await W(800);
  const endT = Date.now()/1000;
  await cdp.send('Page.stopScreencast'); await W(200);
  await ctx.close();
  // 画面が変化したときだけフレームが届くので、各フレームの表示時間を timestamp の差から決める
  let list = '';
  for (let i=0; i<frames.length; i++){
    const d = i+1 < frames.length ? Math.max(0.01, frames[i+1].t-frames[i].t) : Math.min(3, Math.max(0.5, endT-frames[i].t));
    list += "file '"+frames[i].file+"'\nduration "+d.toFixed(3)+"\n";
  }
  list += "file '"+frames[frames.length-1].file+"'\n";
  fs.writeFileSync(path.join(dir, 'list.txt'), list);
  const out = path.join(dir, 'screen.mp4');
  execFileSync('ffmpeg', ['-y','-loglevel','error','-f','concat','-safe','0','-i',path.join(dir,'list.txt'),'-vf',`scale=${REC_W}:${REC_H},fps=30`,'-c:v','libx264','-pix_fmt','yuv420p','-crf','14','-an',out]);
  return out;
}

// 画像を WebP にする。ffmpeg に WebP の機能（libwebp）があればそれを使い、なければ cwebp（brew install webp）を使う
// （Homebrew の ffmpeg には libwebp が入っていないことがあるため）
let FFMPEG_WEBP = null;
function toWebp(src, out, width, quality){
  if (FFMPEG_WEBP === null) FFMPEG_WEBP = execFileSync('ffmpeg', ['-hide_banner','-encoders']).toString().includes('libwebp');
  if (FFMPEG_WEBP) execFileSync('ffmpeg', ['-y','-loglevel','error','-i',src,'-vf',`scale=${width}:-2`,'-c:v','libwebp','-quality',String(quality),out]);
  else execFileSync('cwebp', ['-quiet','-q',String(quality),'-resize',String(width),'0',src,'-o',out]);
}

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport:{ width:1800, height:1000 }, deviceScaleFactor:2 });
  await p.goto('file://' + path.join(__dirname, PC ? 'cards-pc.html' : 'cards.html'));
  // フォントのディレクトリが空のとき（Mac でヒラギノを使うとき）は何も足さない
  const ff = fontFaces(FONTS); if (ff.trim()) await p.addStyleTag({ content: ff });
  // CARD_THEME=calm のように指定すると、cards-<名前>.css を重ねてデザインを切り替える
  if (process.env.CARD_THEME) await p.addStyleTag({ path: path.join(__dirname, 'cards-' + process.env.CARD_THEME + '.css') });
  await p.evaluate(dir => document.querySelectorAll('img[data-screen]').forEach(i => { i.src = 'file://' + dir + '/' + i.dataset.screen + '.png'; }), SCREENS);
  await p.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(i => i.decode().catch(() => {}))); });

  for (const img of await p.$$('img[data-anim]')) {
    const name = await img.getAttribute('data-anim');
    if (ONLY && !ONLY.includes(name)) continue;
    const card = await img.evaluateHandle(i => i.closest('.card'));
    const id = await card.evaluate(c => c.id);
    // スマホ画面の位置（カード内の座標）。カードの下にはみ出す分は切り落とす
    // data-anim-offset は、スマホの中に写す画面を何px（サイトの画面上のpx）下から始めるか
    const box = await img.evaluate(i => { const c=i.closest('.card').getBoundingClientRect(), r=i.getBoundingClientRect(); return { x:r.left-c.left, y:r.top-c.top, w:r.width, h:Math.min(r.height, c.bottom-r.top), offset:Number(i.dataset.animOffset||0) }; });
    // 背景は静止画版のカードそのもの（動画を重ねる位置に元の画面が写っていても上から覆われる）
    // 動画には透明がないので、角丸の外側はカードの地の色で埋める
    const bg = path.join(TMP, id + '-bg.png');
    await p.evaluate(() => { document.body.style.background = '#fbf3f7'; });
    await card.screenshot({ path: bg });
    const screen = await recordScreen(b, name);
    const S = 2, x = Math.round(box.x*S), y = Math.round(box.y*S), w = Math.round(box.w*S), h = Math.round(box.h*S);
    const offY = Math.round(box.offset * w / VIEW.width);
    const out = path.join(O, id + '.mp4');
    execFileSync('ffmpeg', ['-y','-loglevel','error','-loop','1','-i',bg,'-i',screen,'-filter_complex',
      `[1:v]scale=${w}:-2,crop=${w}:${h}:0:${offY}[s];[0:v][s]overlay=${x}:${y}:shortest=1,scale=${OUT_W}:-2,format=yuv420p[v]`,
      '-map','[v]','-c:v','libx264','-crf','27','-preset','slow','-movflags','+faststart','-an',out]);
    toWebp(bg, path.join(O, id + '-poster.webp'), OUT_W, 82);
    console.log(id, name, (fs.statSync(out).size/1024).toFixed(0)+'KB');
  }
  await b.close();
})();
