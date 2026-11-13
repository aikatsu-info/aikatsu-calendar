// プロモーションムービー（縦長 1080×1920）を作る。構成案ごとに PLANS に場面の並びを書いてある。
//   案1：ひと目でわかる（約15秒）／案2：こんなとき便利（約30秒）／案3：アイカツ！のある、いつもの一日（約30秒）／案4：見た目で魅せる（約15秒）
// 使い方（リポジトリのルートで）: node tools/promo/make-promo.js <フォントのディレクトリ> <出力ディレクトリ> <作業用ディレクトリ> [案の番号,...]
//   出力は <出力ディレクトリ>/promo-<番号>.mp4。番号を省くと全部作る。
//   フォントのディレクトリは使い方の撮影と同じ（Noto の woff2）。Mac でヒラギノを使うときは空のディレクトリを渡す。
//   必要なもの: Playwright・ffmpeg（使い方の撮影と同じ）
// 文言・見た目は promo.html、ホーム画面の見本は home.html、各場面の操作はこのファイルの SCENES で変える。
const { chromium, newPage, tapFx } = require('../usage-capture/cap-common.js');
const path = require('path'), fs = require('fs');
const { execFileSync } = require('child_process');
const [FONTS, OUTDIR, TMP] = process.argv.slice(2, 5).map(p => path.resolve(p));
const ONLY = process.argv[5] ? process.argv[5].split(',') : null;
fs.mkdirSync(TMP, { recursive:true }); fs.mkdirSync(OUTDIR, { recursive:true });
const W = ms => new Promise(r => setTimeout(r, ms));
const ROOT = path.resolve(__dirname, '../..');
const ICON = 'file://' + path.join(ROOT, 'images/icon/apple-touch-icon.png');
const FPS = 30;
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

const tagCell = (p, day, id) => p.evaluate(([day,id])=>{ const c=[...document.querySelectorAll('.cal-day:not(.pad)')].find(c=>c.querySelector('.num').textContent.trim()===String(day)); c.id=id; }, [day,id]);
const toTabs = p => p.evaluate(()=>{ const e=document.querySelector('.tabs-row'); scrollTo(0, e.getBoundingClientRect().top+scrollY-62); });
// カレンダーを指でなぞるように左右に動かす（dx が負なら次の月へ）
async function drag(p, dx){
  const b = await p.locator('.cal-pane').boundingBox(); const x = b.x + b.width/2, y = b.y + 160;
  await p.mouse.move(x, y); await p.mouse.down();
  for (let i=1; i<=14; i++){ await p.mouse.move(x + dx*i/14, y); await W(16); }
  await p.mouse.up();
}
const appMode = p => p.evaluate(()=>document.documentElement.classList.add('app-mode'));

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
  // 案1
  'cal-swipe': { prep: async p => { await appMode(p); await toTabs(p); }, act: async p => { await W(500); await drag(p, -220); await W(1000); await drag(p, 220); await W(700); } },
  'day-tap': { prep: async p => { await appMode(p); await toTabs(p); await tagCell(p, 22, 'u22'); }, act: async p => { await W(400); await p.click('#u22'); await W(1400); await p.locator('#dayPanelBody .item-head').first().click(); await W(1500); } },
  filter: { prep: async p => { await appMode(p); await p.evaluate(()=>{ const e=document.querySelector('#legendCal'); scrollTo(0, e.getBoundingClientRect().top+scrollY-70); }); },
    act: async p => { await W(400); await p.click('#legendCal .chip:has-text("グッズ")'); await W(1100); await p.click('#legendCal .chip:has-text("イベント")'); await W(1100); await p.click('#legendCal .chip:has-text("グッズ")'); await W(250); await p.click('#legendCal .chip:has-text("イベント")'); await W(800); } },
  // 案2
  search: { prep: async p => { await appMode(p); }, act: async p => { await W(500); await p.click('#searchToggleBtn'); await W(900); await p.keyboard.type('予約', { delay:220 }); await W(900); await glide(p, '.search-panel', 62); await W(2000); } },
  bday: { prep: async p => { await appMode(p); }, act: async p => { await W(1400); await p.click('#tab-topics-btn'); await W(500); await p.click('#sortBirthdayBtn'); await W(800); await glide(p, '.bday-month.current', 220); await W(2000); } },
  addcal: { prep: async p => { await appMode(p); await toTabs(p); await tagCell(p, 22, 'u22'); }, act: async p => { await W(400); await p.click('#u22'); await W(1400); await p.locator('#dayPanelBody .item-head').first().click(); await W(900); await p.locator('#dayPanelBody .add-cal-toggle').first().click(); await W(1900); } },
  // 案4（全面に出す短いカット）
  'v-load': { prep: async p => { await appMode(p); await p.evaluate(()=>{ document.querySelector('.page').style.setProperty('opacity','0','important'); }); },
    act: async p => { await W(200); await p.evaluate(()=>{ const e=document.querySelector('.page'); e.style.removeProperty('opacity'); e.style.setProperty('animation','page-rise 1.6s cubic-bezier(.25,.6,.2,1) both','important'); }); await W(1900); } },
  'v-swipe': { prep: async p => { await appMode(p); await toTabs(p); }, act: async p => { await W(200); await drag(p, -240); await W(900); } },
  'v-week': { prep: async p => { await appMode(p); await toTabs(p); }, act: async p => { await W(300); await p.click('#viewWeekBtn'); await W(1300); } },
  'v-menu': { prep: async p => { await appMode(p); }, act: async p => { await W(300); await p.click('#menuBtn'); await W(1500); } },
  'v-bday': { prep: async p => { await appMode(p); await p.click('#tab-topics-btn'); await p.click('#sortBirthdayBtn'); await toTabs(p); }, act: async p => { await W(300); await glide(p, '.bday-month.current', 260); await W(1500); } },
};

// 構成案。still は文字だけの場面（秒数）、phone はスマホ枠に録画を入れる場面、full は録画を全面に出す場面（案4）
const PLANS = {
  1: { xf:0.4, segs:[ {still:'op1',sec:2.2}, {phone:'c1',rec:['cal-swipe']}, {phone:'c2',rec:['day-tap']}, {phone:'c3',rec:['filter']}, {still:'ed1',sec:2.8} ] },
  2: { xf:0.45, segs:[ {still:'q1',sec:2.2}, {phone:'a1',rec:['search']}, {still:'q2',sec:2.0}, {phone:'a2',rec:['bday']}, {still:'q3',sec:2.0}, {phone:'a3',rec:['addcal']}, {still:'ed2',sec:3.6} ] },
  3: { xf:0.5, segs:[ {still:'op',sec:3.0}, {phone:'morning',rec:['home','morning']}, {phone:'noon',rec:['noon']}, {phone:'night',rec:['night']}, {still:'ed',sec:4.0} ] },
  4: { xf:0.3, segs:[ {full:'v-load'}, {full:'v-swipe'}, {full:'v-week'}, {full:'v-menu'}, {full:'v-bday'}, {still:'ed4',sec:2.8} ] },
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
  const plans = Object.keys(PLANS).filter(k => !ONLY || ONLY.includes(k));
  const b = await chromium.launch();
  // 1) 背景（各場面）を画像にする
  const p = await b.newPage({ viewport:{ width:1200, height:2000 }, deviceScaleFactor:1 });
  await p.goto('file://' + path.join(__dirname, 'promo.html'));
  await addFonts(p);
  await p.evaluate(src => document.querySelectorAll('img[data-icon]').forEach(i => { i.src = src; }), ICON);
  await p.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(i => i.decode().catch(()=>{}))); });
  const bg = {}, box = {};
  for (const el of await p.$$('.scene')){
    const id = await el.getAttribute('id');
    bg[id] = path.join(TMP, id + '-bg.png'); await el.screenshot({ path: bg[id] });
    box[id] = await el.evaluate(s => { const r=s.querySelector('.rec'); if(!r) return null; const c=s.getBoundingClientRect(), q=r.getBoundingClientRect(); return { x:Math.round(q.left-c.left), y:Math.round(q.top-c.top), w:Math.round(q.width), h:Math.round(Math.min(q.height, c.bottom-q.top)) }; });
  }
  await p.close();
  // 2) 使う操作を録画する（同じものは1回だけ）
  const rec = {};
  for (const k of plans) for (const s of PLANS[k].segs) for (const n of (s.rec || (s.full ? [s.full] : []))) {
    if (!rec[n]) { rec[n] = await record(b, n); console.log('録画', n, dur(rec[n]).toFixed(1)+'秒'); }
  }
  await b.close();
  // 3) 案ごとに組み立てる
  for (const k of plans){
    const { xf, segs } = PLANS[k], files = [];
    segs.forEach((s, i) => {
      const o = path.join(TMP, `p${k}-${i}.mp4`);
      if (s.still){
        ff(['-loop','1','-t',String(s.sec),'-i',bg[s.still],'-vf',`fps=${FPS},format=yuv420p`,'-c:v','libx264','-crf','16',o]);
      } else if (s.phone){
        let src = rec[s.rec[0]];
        if (s.rec.length > 1){ src = path.join(TMP, `p${k}-${i}-src.mp4`); ff([...s.rec.flatMap(n=>['-i',rec[n]]),'-filter_complex',s.rec.map((_,j)=>`[${j}:v]`).join('')+`concat=n=${s.rec.length}:v=1[v]`,'-map','[v]','-c:v','libx264','-pix_fmt','yuv420p','-crf','14',src]); }
        const { x,y,w,h } = box[s.phone];
        // 録画の前後に少し止めた画面を足して、つなぎのフェードで操作が切れないようにする
        ff(['-loop','1','-i',bg[s.phone],'-i',src,'-filter_complex',
          `[1:v]scale=${w}:-2,crop=${w}:${h}:0:0,tpad=start_mode=clone:start_duration=${xf+0.3}:stop_mode=clone:stop_duration=${xf+0.2}[s];[0:v][s]overlay=${x}:${y}:shortest=1,fps=${FPS},format=yuv420p[v]`,
          '-map','[v]','-c:v','libx264','-crf','16',o]);
      } else if (s.full){
        // 録画を画面いっぱいに（上をそろえて、はみ出す下は切る）
        ff(['-i',rec[s.full],'-vf',`scale=1080:-2,crop=1080:1920:0:0,tpad=stop_mode=clone:stop_duration=${xf},fps=${FPS},format=yuv420p`,'-c:v','libx264','-crf','16',o]);
      }
      files.push(o);
    });
    const ds = files.map(dur);
    let fc = '', last = '[0:v]', t = 0;
    for (let i=1; i<files.length; i++){
      t += ds[i-1] - xf;
      const outL = i === files.length-1 ? '[x]' : `[x${i}]`;
      fc += `${last}[${i}:v]xfade=transition=fade:duration=${xf}:offset=${t.toFixed(3)}${outL};`;
      last = outL;
    }
    const total = ds.reduce((a,b)=>a+b,0) - xf*(files.length-1);
    // フェードは黒ではなく、背景と同じ淡いピンクから・へ
    fc += `[x]fade=t=in:st=0:d=0.5:color=0xfff8fb,fade=t=out:st=${(total-0.7).toFixed(3)}:d=0.7:color=0xfff8fb,format=yuv420p[v]`;
    const OUT = path.join(OUTDIR, `promo-${k}.mp4`);
    ff([...files.flatMap(f => ['-i', f]), '-filter_complex', fc, '-map','[v]','-c:v','libx264','-crf','20','-preset','slow','-movflags','+faststart','-an', OUT]);
    console.log('できあがり 案'+k, OUT, total.toFixed(1)+'秒', (fs.statSync(OUT).size/1024/1024).toFixed(1)+'MB');
  }
})();
