// cards.html の data-anim の付いた画面を操作動画に差し替えた、動くカード（MP4）を作る。
// 使い方: node tools/usage-capture/cap-cards-anim.js <画面画像のディレクトリ> <フォントのディレクトリ> <出力ディレクトリ> <作業用ディレクトリ> [名前,...]
//   画面画像・フォントは cap-cards.js と同じもの。
//   カードの背景（見出し・スマホ枠など）を静止画で撮り、スマホ画面の位置に操作の録画を重ねて動画にする。
const { chromium, newPage, tapFx } = require('./cap-common.js');
const path = require('path'), fs = require('fs');
const { execFileSync } = require('child_process');
const [SCREENS, FONTS, O, TMP] = process.argv.slice(2, 6).map(p => path.resolve(p));
const ONLY = process.argv[6] ? process.argv[6].split(',') : null;
const W = ms => new Promise(r => setTimeout(r, ms));
const OUT_W = 640; // 出力する動画の横幅（px）。カードは最大 320px で表示するので2倍
const tagCell = (p, day, id) => p.evaluate(([day,id])=>{ const c=[...document.querySelectorAll('.cal-day:not(.pad)')].find(c=>c.querySelector('.num').textContent.trim()===String(day)); c.id=id; }, [day,id]);
const jump = (p, sel, off) => p.evaluate(([s,o])=>{ const e=document.querySelector(s); window.scrollTo(0, e.getBoundingClientRect().top+scrollY-o); },[sel,off]);
const glide = (p, sel, off) => p.evaluate(([s,o])=>{ const e=document.querySelector(s); window.scrollTo({top:e.getBoundingClientRect().top+scrollY-o, behavior:'smooth'}); },[sel,off]);

// 各カードの操作。prep は録画前の状態づくり（静止画版の画面と同じ状態にする）、act が録画する操作
const SCENES = {
  day: {
    prep: async p => { await jump(p, '.tabs-row', 62); await tagCell(p, 22, 'u22'); },
    act: async p => { await p.click('#u22'); await W(800); await glide(p, '#dayPanel', 62); await W(1100); await p.locator('#dayPanelBody .item-head').first().click(); await W(1800); },
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
      await glide(p, '.bday-month.current', 260); await W(900);
      await p.click('.bday-month.current summary'); await W(2000);
    },
  },
  addcal: {
    prep: async p => { await tagCell(p, 22, 'u22'); await p.click('#u22'); await p.locator('#dayPanelBody .item-head').first().click(); await jump(p, '#dayPanel', 62); },
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

// 操作を 2x の解像度で録画して、画面だけの動画（780x1688）にする
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
  await cdp.send('Page.startScreencast', { format:'jpeg', quality:92, maxWidth:780, maxHeight:1688, everyNthFrame:1 });
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
  execFileSync('ffmpeg', ['-y','-loglevel','error','-f','concat','-safe','0','-i',path.join(dir,'list.txt'),'-vf','scale=780:1688,fps=30','-c:v','libx264','-pix_fmt','yuv420p','-crf','14','-an',out]);
  return out;
}

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport:{ width:1800, height:1000 }, deviceScaleFactor:2 });
  await p.goto('file://' + path.join(__dirname, 'cards.html'));
  const face = (w, sub) => `@font-face{font-family:"MPR";font-weight:${w};src:url("file://${FONTS}/m-plus-rounded-1c-${sub}-${w}-normal.woff2") format("woff2");}`;
  await p.addStyleTag({ content: [800, 700].flatMap(w => ['latin', 'japanese'].map(s => face(w, s))).join('\n') });
  await p.evaluate(dir => document.querySelectorAll('img[data-screen]').forEach(i => { i.src = 'file://' + dir + '/' + i.dataset.screen + '.png'; }), SCREENS);
  await p.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(i => i.decode().catch(() => {}))); });

  for (const img of await p.$$('img[data-anim]')) {
    const name = await img.getAttribute('data-anim');
    if (ONLY && !ONLY.includes(name)) continue;
    const card = await img.evaluateHandle(i => i.closest('.card'));
    const id = await card.evaluate(c => c.id);
    // スマホ画面の位置（カード内の座標）。カードの下にはみ出す分は切り落とす
    const box = await img.evaluate(i => { const c=i.closest('.card').getBoundingClientRect(), r=i.getBoundingClientRect(); return { x:r.left-c.left, y:r.top-c.top, w:r.width, h:Math.min(r.height, c.bottom-r.top), cardW:c.width, cardH:c.height }; });
    // 背景は静止画版のカードそのもの（動画を重ねる位置に元の画面が写っていても上から覆われる）
    // 動画には透明がないので、角丸の外側はカードの地の色で埋める
    const bg = path.join(TMP, id + '-bg.png');
    await p.evaluate(() => { document.body.style.background = '#fbf3f7'; });
    await card.screenshot({ path: bg });
    const screen = await recordScreen(b, name);
    const S = 2, x = Math.round(box.x*S), y = Math.round(box.y*S), w = Math.round(box.w*S), h = Math.round(box.h*S);
    const out = path.join(O, id + '.mp4');
    execFileSync('ffmpeg', ['-y','-loglevel','error','-loop','1','-i',bg,'-i',screen,'-filter_complex',
      `[1:v]scale=${w}:-2,crop=${w}:${h}:0:0[s];[0:v][s]overlay=${x}:${y}:shortest=1,scale=${OUT_W}:-2,format=yuv420p[v]`,
      '-map','[v]','-c:v','libx264','-crf','27','-preset','slow','-movflags','+faststart','-an',out]);
    execFileSync('ffmpeg', ['-y','-loglevel','error','-i',bg,'-vf',`scale=${OUT_W}:-2`,'-c:v','libwebp','-quality','82',path.join(O, id + '-poster.webp')]);
    console.log(id, name, (fs.statSync(out).size/1024).toFixed(0)+'KB');
  }
  await b.close();
})();
