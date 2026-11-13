// 使い方: tools/promo/3d で npm install --no-save three@0.170.0 を実行し、frames/ に録画のコマ（f0001.jpg〜、780×1688）を置いて、
// このフォルダで python3 -m http.server 8790 を動かしてから node render.js を実行する。phone-intro.mp4 と phone.glb ができる。
// scene.html を1コマずつ画像にして、5秒の動画（1080×1920・30fps）とスマホの3Dデータ（phone.glb）を作る
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path');
const { execFileSync } = require('child_process');
const D = __dirname, N = Number(process.argv[2] || 150), ONLY = process.argv[3]; // ONLY=frames:0,60,149 で確認用に数コマだけ
(async()=>{
  const b = await chromium.launch({ args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport:{ width:1080, height:1920 }, deviceScaleFactor:1 });
  p.on('console', m => { if (m.type()==='error') console.log('console', m.text()); }); p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto('http://localhost:8790/scene.html');
  await p.evaluate(n => { window.FRAME_COUNT = n; }, fs.readdirSync(path.join(D,'frames')).length);
  await p.waitForFunction(() => window.READY === true, null, { timeout:60000 });
  const out = path.join(D, 'out'); fs.mkdirSync(out, { recursive:true });
  const list = ONLY ? ONLY.split(',').map(Number) : [...Array(N).keys()];
  const t0 = Date.now();
  for (const i of list){
    await p.evaluate(i => window.renderFrame(i), i);
    await p.locator('canvas').screenshot({ path: path.join(out, 'r' + String(i).padStart(4,'0') + '.png') });
    if (i % 30 === 0) console.log('frame', i, ((Date.now()-t0)/1000).toFixed(0)+'s');
  }
  if (!ONLY){
    execFileSync('ffmpeg', ['-y','-loglevel','error','-framerate','30','-i',path.join(out,'r%04d.png'),'-c:v','libx264','-pix_fmt','yuv420p','-crf','18','-preset','slow','-movflags','+faststart',path.join(D,'phone-intro.mp4')]);
    const b64 = await p.evaluate(() => window.exportGLB(70));
    fs.writeFileSync(path.join(D, 'phone.glb'), Buffer.from(b64, 'base64'));
    console.log('done', fs.statSync(path.join(D,'phone.glb')).size);
  }
  await b.close();
})();
