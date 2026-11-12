// プロモーションムービー（案3「アイカツ！のある、いつもの一日」・縦長 1080×1920・約30秒）を作る。
// 使い方（リポジトリのルートで）: node tools/promo/make-promo.js <フォントのディレクトリ> <出力する mp4> <作業用ディレクトリ>
//   フォントのディレクトリは使い方の撮影と同じ（Noto の woff2）。Mac でヒラギノを使うときは空のディレクトリを渡す。
//   必要なもの: Playwright・ffmpeg（使い方の撮影と同じ）
// 構成：はじめ（タイトル）→ 朝（ホーム画面から開いて今日の誕生日）→ 昼（新着のトピックス）→ 夜（週表示から予定をカレンダーに追加）→ おわり
// 文言・見た目は promo.html、ホーム画面の見本は home.html、各場面の操作はこのファイルの SCENES で変える。
const { chromium, newPage, tapFx } = require('../usage-capture/cap-common.js');
const path = require('path'), fs = require('fs');
const { execFileSync } = require('child_process');
const [FONTS, OUT, TMP] = process.argv.slice(2, 5).map(p => path.resolve(p));
fs.mkdirSync(TMP, { recursive:true });
const W = ms => new Promise(r => setTimeout(r, ms));
const ROOT = path.resolve(__dirname, '../..');
const ICON = 'file://' + path.join(ROOT, 'images/icon/apple-touch-icon.png');
const FPS = 30, XF = 0.5; // 場面のつなぎ（クロスフェード）の秒数
const ff = args => execFileSync('ffmpeg', ['-y','-loglevel','error', ...args]);

function fontFaces(dir){
  const fam = { 'm-plus-rounded-1c':'MPR', 'noto-serif-jp':'NSJ', 'noto-sans-jp':'NSANS' };
  return fs.readdirSync(dir).map(f => {
    const m = f.match(/^(m-plus-rounded-1c|noto-serif-jp|noto-sans-jp)-[a-z]+-(\d+)-normal\.woff2$/);
    return m ? `@font-face{font-family:"${fam[m[1]]}";font-weight:${m[2]};src:url("file://${dir}/${f}") format("woff2");}` : '';
  }).join('\n');
}
async function addFonts(p){ const css = fontFaces(FONTS); if (css.trim()) await p.addStyleTag({ content: css }); }
const glide = (p, sel, off) => p.evaluate(([s,o])=>{ const e=document.querySelector(s); window.scrollTo({top:e.getBoundingClientRect().top+scrollY-o, behavior:'smooth'}); },[sel,off]);
const slowScroll = (p, dy, ms) => p.evaluate(([dy,ms])=>new Promise(res=>{ const y0=scrollY, t0=performance.now(); (function f(t){ const k=Math.min(1,(t-t0)/ms), e=k<.5?2*k*k:1-Math.pow(-2*k+2,2)/2; scrollTo(0,y0+dy*e); k<1?requestAnimationFrame(f):res(); })(t0); }),[dy,ms]);

// 各場面の操作。prep は録画前の状態づくり、act が録画する操作。page が 'home' のものはホーム画面の見本を録画する
const SCENES = {
  home: {
    page: 'home',
    prep: async p => { await p.evaluate(src => { document.getElementById('icon').src = src; }, ICON); await p.evaluate(()=>document.getElementById('icon').decode().catch(()=>{})); },
    act: async p => { await W(900); await p.click('#go'); await W(800); },
  },
  morning: {
    prep: async p => { await p.evaluate(()=>{ document.documentElement.classList.add('app-mode'); scrollTo(0,0); }); },
    act: async p => { await W(1900); await glide(p, '.cal-grid', 150); await W(2200); },
  },
  noon: {
    prep: async p => { await p.evaluate(()=>document.documentElement.classList.add('app-mode')); await p.evaluate(()=>{ const e=document.querySelector('.tabs-row'); scrollTo(0, e.getBoundingClientRect().top+scrollY-62); }); },
    act: async p => { await W(600); await p.click('#tab-topics-btn'); await W(1400); await slowScroll(p, 420, 1600); await W(1600); },
  },
  night: {
    prep: async p => { await p.evaluate(()=>document.documentElement.classList.add('app-mode')); await p.evaluate(()=>{ const e=document.querySelector('.tabs-row'); scrollTo(0, e.getBoundingClientRect().top+scrollY-62); }); },
    act: async p => {
      await W(600); await p.click('#viewWeekBtn'); await W(1200);
      // 今週の、予定のある日を押す（その日の情報まで自動でスクロールする）
      await p.evaluate(()=>{ const c=[...document.querySelectorAll('.cal-day.week.has-items')].find(c=>c.querySelector('.num').textContent.trim()==='30') || document.querySelector('.cal-day.week.has-items'); c.id='pick'; });
      await p.click('#pick'); await W(1500);
      await p.locator('#dayPanelBody .item-head').first().click(); await W(900);
      await p.locator('#dayPanelBody .add-cal-toggle').first().click(); await W(2000);
    },
  },
};

// 操作を 2x で録画して、画面だけの動画（780×1688・30fps）にする（使い方の動画と同じ作り方）
async function record(b, name){
  const dir = path.join(TMP, name); fs.mkdirSync(dir, { recursive:true });
  for (const f of fs.readdirSync(dir)) fs.unlinkSync(path.join(dir, f));
  const S = SCENES[name];
  const { ctx, p } = await newPage(b);
  if (S.page === 'home') await p.goto('file://' + path.join(__dirname, 'home.html'));
  await addFonts(p); await tapFx(p);
  await S.prep(p); await W(500);
  const cdp = await ctx.newCDPSession(p); const frames = [];
  cdp.on('Page.screencastFrame', async f => {
    const file = path.join(dir, 'f'+String(frames.length).padStart(5,'0')+'.jpg');
    fs.writeFileSync(file, Buffer.from(f.data, 'base64')); frames.push({ file, t: f.metadata.timestamp });
    try{ await cdp.send('Page.screencastFrameAck', { sessionId:f.sessionId }); }catch(e){}
  });
  await cdp.send('Page.startScreencast', { format:'jpeg', quality:92, maxWidth:780, maxHeight:1688, everyNthFrame:1 });
  await W(300); await S.act(p); await W(300);
  const endT = Date.now()/1000;
  await cdp.send('Page.stopScreencast'); await W(200); await ctx.close();
  let list = '';
  for (let i=0; i<frames.length; i++){
    const d = i+1 < frames.length ? Math.max(0.01, frames[i+1].t-frames[i].t) : Math.min(3, Math.max(0.3, endT-frames[i].t));
    list += "file '"+frames[i].file+"'\nduration "+d.toFixed(3)+"\n";
  }
  list += "file '"+frames[frames.length-1].file+"'\n";
  fs.writeFileSync(path.join(dir,'list.txt'), list);
  const out = path.join(dir, 'screen.mp4');
  ff(['-f','concat','-safe','0','-i',path.join(dir,'list.txt'),'-vf',`scale=780:1688,fps=${FPS}`,'-c:v','libx264','-pix_fmt','yuv420p','-crf','14','-an',out]);
  return out;
}
const dur = f => parseFloat(execFileSync('ffprobe',['-v','error','-show_entries','format=duration','-of','csv=p=0',f]).toString());

(async () => {
  const b = await chromium.launch();
  // 1) 背景（各場面）を画像にする
  const p = await b.newPage({ viewport:{ width:1200, height:2000 }, deviceScaleFactor:1 });
  await p.goto('file://' + path.join(__dirname, 'promo.html'));
  await addFonts(p);
  await p.evaluate(src => document.querySelectorAll('img[data-icon]').forEach(i => { i.src = src; }), ICON);
  await p.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(i => i.decode().catch(()=>{}))); });
  const bg = {}, box = {};
  for (const id of ['op','morning','noon','night','ed']){
    const el = await p.$('#'+id);
    bg[id] = path.join(TMP, id + '-bg.png'); await el.screenshot({ path: bg[id] });
    box[id] = await el.evaluate(s => { const r=s.querySelector('.rec'); if(!r) return null; const c=s.getBoundingClientRect(), q=r.getBoundingClientRect(); return { x:Math.round(q.left-c.left), y:Math.round(q.top-c.top), w:Math.round(q.width), h:Math.round(Math.min(q.height, c.bottom-q.top)) }; });
  }
  await p.close();
  // 2) 操作を録画する（朝はホーム画面 → アプリの順につなぐ）
  const rec = {};
  for (const n of ['home','morning','noon','night']) { rec[n] = await record(b, n); console.log('録画', n, dur(rec[n]).toFixed(1)+'秒'); }
  await b.close();
  const morning = path.join(TMP, 'morning-all.mp4');
  ff(['-i',rec.home,'-i',rec.morning,'-filter_complex','[0:v][1:v]concat=n=2:v=1[v]','-map','[v]','-c:v','libx264','-pix_fmt','yuv420p','-crf','14',morning]);
  rec.morning = morning;
  // 3) 場面ごとの動画（1080×1920）を作る
  const seg = {};
  const still = (id, sec) => { const o = path.join(TMP, id+'.mp4'); ff(['-loop','1','-t',String(sec),'-i',bg[id],'-vf',`fps=${FPS},format=yuv420p`,'-c:v','libx264','-crf','16',o]); return o; };
  seg.op = still('op', 3.0);
  for (const id of ['morning','noon','night']){
    const o = path.join(TMP, id+'.mp4'), { x,y,w,h } = box[id];
    // 録画の前後に少し止めた画面を足して、つなぎのフェードで操作が切れないようにする
    ff(['-loop','1','-i',bg[id],'-i',rec[id],'-filter_complex',
      `[1:v]scale=${w}:-2,crop=${w}:${h}:0:0,tpad=start_mode=clone:start_duration=${XF+0.3}:stop_mode=clone:stop_duration=${XF+0.2}[s];[0:v][s]overlay=${x}:${y}:shortest=1,fps=${FPS},format=yuv420p[v]`,
      '-map','[v]','-c:v','libx264','-crf','16',o]);
    seg[id] = o;
  }
  seg.ed = still('ed', 4.0);
  // 4) クロスフェードでつなぎ、はじめはフェードイン、おわりはフェードアウト
  const order = ['op','morning','noon','night','ed'];
  const ds = order.map(k => dur(seg[k]));
  let fc = '', last = '[0:v]', t = 0;
  for (let i=1; i<order.length; i++){
    t += ds[i-1] - XF;
    const outL = i === order.length-1 ? '[x]' : `[x${i}]`;
    fc += `${last}[${i}:v]xfade=transition=fade:duration=${XF}:offset=${t.toFixed(3)}${outL};`;
    last = outL;
  }
  const total = ds.reduce((a,b)=>a+b,0) - XF*(order.length-1);
  // フェードは黒ではなく、背景と同じ淡いピンクから・へ
  fc += `[x]fade=t=in:st=0:d=0.6:color=0xfff8fb,fade=t=out:st=${(total-0.8).toFixed(3)}:d=0.8:color=0xfff8fb,format=yuv420p[v]`;
  ff([...order.flatMap(k => ['-i', seg[k]]), '-filter_complex', fc, '-map','[v]','-c:v','libx264','-crf','20','-preset','slow','-movflags','+faststart','-an', OUT]);
  console.log('できあがり', OUT, total.toFixed(1)+'秒', (fs.statSync(OUT).size/1024/1024).toFixed(1)+'MB');
})();
