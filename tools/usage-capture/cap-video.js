const { chromium, newPage, tapFx } = require('./cap-common.js');
const fs = require('fs'); const { execFileSync } = require('child_process');
const O = process.argv[2], TMP = process.argv[3];
const W = ms => new Promise(r=>setTimeout(r,ms));
const scrollToSel = (p, sel, off=70) => p.evaluate(([s,o])=>{ const e=document.querySelector(s); scrollTo({top:e.getBoundingClientRect().top+scrollY-o, behavior:'smooth'}); },[sel,off]);
const tagCell = (p, day, id) => p.evaluate(([day,id])=>{ const c=[...document.querySelectorAll('.cal-day:not(.pad)')].find(c=>c.querySelector('.num').textContent.trim()===String(day)); c.id=id; }, [day,id]);
async function record(b, name, prep, act){
  if(process.argv[4] && !process.argv[4].split(',').includes(name)) return;
  const dir = TMP+'/'+name; fs.rmSync(dir,{recursive:true,force:true}); fs.mkdirSync(dir,{recursive:true});
  const { ctx, p } = await newPage(b);
  await tapFx(p); await prep(p); await W(400);
  // 2x の解像度で撮るため、Playwright の録画ではなく CDP のスクリーンキャストでフレームを集める
  const cdp = await ctx.newCDPSession(p);
  const frames = [];
  cdp.on('Page.screencastFrame', async f => {
    const file = dir+'/f'+String(frames.length).padStart(5,'0')+'.jpg';
    fs.writeFileSync(file, Buffer.from(f.data,'base64'));
    frames.push({ file, t: f.metadata.timestamp });
    try{ await cdp.send('Page.screencastFrameAck',{sessionId:f.sessionId}); }catch(e){}
  });
  await cdp.send('Page.startScreencast',{format:'jpeg',quality:92,maxWidth:780,maxHeight:1688,everyNthFrame:1});
  await W(300); await act(p); await W(900);
  const endT = Date.now()/1000;
  await cdp.send('Page.stopScreencast'); await W(200);
  await ctx.close();
  // 画面が変化したときだけフレームが届くので、各フレームの表示時間を timestamp の差から決める
  let list = '';
  for(let i=0;i<frames.length;i++){
    const d = i+1<frames.length ? Math.max(0.01, frames[i+1].t-frames[i].t) : Math.min(3, Math.max(0.5, endT-frames[i].t));
    list += "file '"+frames[i].file+"'\nduration "+d.toFixed(3)+"\n";
  }
  list += "file '"+frames[frames.length-1].file+"'\n";
  fs.writeFileSync(dir+'/list.txt', list);
  const out = O+'/'+name+'.mp4';
  execFileSync('ffmpeg',['-y','-loglevel','error','-f','concat','-safe','0','-i',dir+'/list.txt','-vf','scale=600:-2,fps=30','-c:v','libx264','-pix_fmt','yuv420p','-crf','28','-preset','slow','-movflags','+faststart','-an',out]);
  execFileSync('ffmpeg',['-y','-loglevel','error','-i',frames[0].file,'-vf','scale=600:-2','-c:v','libwebp','-quality','80',O+'/'+name+'-poster.webp']);
  console.log(name, frames.length+' frames', (fs.statSync(out).size/1024).toFixed(0)+'KB');
}
(async () => {
  const b = await chromium.launch();
  await record(b, 'video-menu', async p=>{}, async p=>{
    await p.click('#menuBtn'); await W(1200); await p.click('[data-menu=topics]'); await W(1500);
  });
  await record(b, 'video-day', async p=>{ await tagCell(p,22,'um22'); await scrollToSel(p,'.cal-nav-row',60); }, async p=>{
    await p.click('#um22'); await W(700); await scrollToSel(p,'#dayPanel',70); await W(1000);
    await p.locator('#dayPanelBody .item-head').first().click(); await W(1600);
  });
  await record(b, 'video-filter', async p=>{ await scrollToSel(p,'#legendCal',70); }, async p=>{
    await p.click('#legendCal .chip:has-text("グッズ")'); await W(1600);
    await p.click('#legendCal .chip:has-text("イベント")'); await W(1600);
    await p.click('#legendCal .chip:has-text("グッズ")'); await W(400); await p.click('#legendCal .chip:has-text("イベント")'); await W(800);
  });
  await record(b, 'video-search', async p=>{}, async p=>{
    await p.click('#searchToggleBtn'); await W(900); await p.keyboard.type('ガシャポン', {delay:180}); await W(1500);
    await p.evaluate(()=>scrollTo({top:300,behavior:'smooth'})); await W(1200);
  });
  await record(b, 'video-addcal', async p=>{ await tagCell(p,22,'um22'); await p.click('#um22'); await p.locator('#dayPanelBody .item-head').first().click(); await scrollToSel(p,'#dayPanel',70); await W(600); }, async p=>{
    await p.locator('#dayPanelBody .add-cal-toggle').first().click(); await W(2200);
  });
  await record(b, 'video-export', async p=>{ await scrollToSel(p,'#exportOpenBtn',90); await W(500); }, async p=>{
    await p.click('#exportOpenBtn'); await W(1000);
    await p.click('#exportPresets [data-preset="1y"]'); await W(1000);
    await p.click('#exportCats .chip:has-text("誕生日")'); await W(1200);
    await p.click('#exportDownloadBtn'); await W(800);
  });
  await b.close();
})();
