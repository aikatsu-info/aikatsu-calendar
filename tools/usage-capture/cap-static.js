const { chromium, newPage, mark } = require('./cap-common.js');
const O = process.argv[2];
const tagCell = (p, day, id) => p.evaluate(([day,id])=>{ const c=[...document.querySelectorAll('.cal-day:not(.pad)')].find(c=>c.querySelector('.num').textContent.trim()===String(day)); c.id=id; }, [day,id]);
const clear = p => p.evaluate(()=>document.querySelectorAll('.um-ring,.um-num').forEach(e=>e.remove()));
const top = async (p, sel, off=70) => { await p.evaluate(([s,o])=>{ const e=document.querySelector(s); scrollTo(0, e.getBoundingClientRect().top+scrollY-o); },[sel,off]); await p.waitForTimeout(150); };
(async () => {
  const b = await chromium.launch();
  const { p } = await newPage(b);
  // C0: カレンダーの全体像（A カテゴリ／B 操作ボタン／C 日付のマス の3つに分けて見せる）
  // ラベルを枠の上に置く余白を作るため、撮影時だけ部分の間隔を広げる
  await p.addStyleTag({content:'#legendCal{margin-bottom:38px !important} .cal-nav-row{margin-bottom:34px !important}'});
  await top(p, '#legendCal', 110);
  await mark(p, [
    {sel:'#legendCal', n:'A カテゴリ', pad:4, corner:'tlo'}, {sel:'.cal-nav-row', n:'B 操作ボタン', pad:4, corner:'tlo'},
    {sel:'.cal-grid', n:'C 日付のマス', pad:4, corner:'tlo'},
  ]);
  const ov = await p.evaluate(()=>{ const a=document.getElementById('legendCal').getBoundingClientRect(), g=document.querySelector('.cal-grid').getBoundingClientRect(); return {y:a.top-40, h:g.bottom-a.top+52}; });
  await p.screenshot({path:O+'/calendar-overview.png', clip:{x:0,y:ov.y,width:390,height:ov.h}});
  await clear(p);
  await p.evaluate(()=>{ document.querySelectorAll('style').forEach(st=>{ if(st.textContent.includes('#legendCal{margin-bottom:38px')) st.remove(); }); });
  // C: カレンダー上部の操作（1つずつ番号を付ける）
  await tagCell(p, 14, 'um14'); await tagCell(p, 15, 'um15'); await tagCell(p, 19, 'um19'); await tagCell(p, 17, 'um17'); await tagCell(p, 20, 'um20'); await tagCell(p, 28, 'um28');
  await top(p, '.cal-nav-row', 110);
  await p.evaluate(()=>{ document.getElementById('legendCal').style.visibility='hidden'; });
  await mark(p, [
    {sel:'#prevMonth', n:1, pad:0, round:true, corner:'t'}, {sel:'#calMonthLabel', n:2, pad:2, corner:'t'},
    {sel:'#nextMonth', n:3, pad:0, round:true, corner:'t'}, {sel:'.cal-view-toggle', n:4, round:true, pad:2, corner:'t'},
  ]);
  const nv = await p.evaluate(()=>{ const a=document.querySelector('.cal-nav-row').getBoundingClientRect(), l=document.getElementById('prevMonth').getBoundingClientRect(); return {x:l.left-16, y:a.top-36, h:a.height+48}; });
  await p.screenshot({path:O+'/calendar-nav.png', clip:{x:nv.x,y:nv.y,width:390-nv.x,height:nv.h}});
  await clear(p);
  await p.evaluate(()=>{ document.getElementById('legendCal').style.visibility=''; });
  // C2: カレンダーのマス（火〜土の下3週を切り出して大きく見せる）
  await top(p, '#um15', 120);
  await mark(p, [
    {sel:'#um14 .dots', n:1, pad:3, text:true, round:true, corner:'r'}, {sel:'#um17 .more', n:2, pad:2, text:true, corner:'r', dy:4},
    {sel:'#um20 .dot-emoji-mini', n:3, pad:2, corner:'l'}, {sel:'#um28 .num', n:4, pad:2, round:true, corner:'l'},
  ]);
  const gr = await p.evaluate(()=>{ const c=document.querySelector('#um19').getBoundingClientRect(), t=document.querySelector('#um15').getBoundingClientRect(), b=document.querySelector('#um28').getBoundingClientRect(), g=document.querySelector('.cal-grid').getBoundingClientRect(); return {x:c.left-6, y:t.top-6, w:g.right-c.left+6, h:b.bottom-t.top+12}; });
  await p.screenshot({path:O+'/calendar-grid.png', clip:{x:gr.x,y:gr.y,width:gr.w,height:gr.h}});
  await clear(p);
  // E: トピックス（新着）
  await p.click('#tab-topics-btn'); await p.waitForTimeout(200);
  await top(p, '.tabs-row', 60);
  await mark(p, [
    {sel:'#legendTopics', n:1, pad:2, corner:'tre'}, {sel:'.topics-toolbar .sort-toggle', n:2, round:true, pad:2, corner:'r'},
    {sel:'#topicsPaginationTop', n:3, pad:2, corner:'l'}, {sel:'#topicsList .new-badge', n:4, pad:2, round:true, corner:'r'},
  ]);
  const t = await p.evaluate(()=>{ const a=document.querySelector('.tabs-row').getBoundingClientRect(), n=document.querySelector('#topicsList .new-badge').closest('.item').getBoundingClientRect(); return {y:a.top-12, h:n.bottom-a.top+16}; });
  await p.screenshot({path:O+'/topics.png', clip:{x:0,y:t.y,width:390,height:t.h}});
  await clear(p);
  // F: birthday（トピックス→誕生日→月を開く、の流れが分かるようタブから写す）
  await p.click('#sortBirthdayBtn'); await p.waitForTimeout(200);
  await p.evaluate(()=>{ const d=document.querySelectorAll('.bday-month')[2]; d.open=true; d.id='umMar'; });
  await top(p, '.tabs-row', 62);
  await mark(p, [
    {sel:'#tab-topics-btn', n:1, pad:2, round:true, corner:'r'}, {sel:'#sortBirthdayBtn', n:2, pad:2, round:true, corner:'r'},
    {sel:'#umMar summary', n:3, pad:2, corner:'l'}, {sel:'#umMar .bday-card', n:4, pad:2, corner:'l'},
  ]);
  const bt = await p.evaluate(()=>{ const a=document.querySelector('.tabs-row').getBoundingClientRect(), m=document.getElementById('umMar').nextElementSibling.getBoundingClientRect(); return {y:a.top-14, h:m.bottom-a.top+24}; });
  await p.screenshot({path:O+'/birthday.png', clip:{x:0,y:bt.y,width:390,height:bt.h}});
  // G: export dialog
  await p.click('#tab-cal-btn'); await p.click('#exportOpenBtn'); await p.waitForTimeout(200);
  await mark(p, [ {sel:'#exportPresets', n:1, round:true, pad:2, corner:'l'}, {sel:'.export-range', n:2, pad:2, corner:'l'}, {sel:'#exportCats', n:3, pad:2, corner:'l'}, {sel:'.export-checks', n:4, pad:2, corner:'l'}, {sel:'#exportCount', n:5, pad:2, corner:'l'}, {sel:'#exportDownloadBtn', n:6, round:true, pad:2, corner:'r'} ]);
  // markers are in body (below the top layer) -> move them into the dialog
  await p.evaluate(()=>{ const dlg=document.getElementById('exportDialog'), r=dlg.getBoundingClientRect(); dlg.style.overflow='visible';
    document.querySelectorAll('.um-ring,.um-num').forEach(e=>{ e.style.left=(parseFloat(e.style.left)-scrollX-r.left-1)+'px'; e.style.top=(parseFloat(e.style.top)-scrollY-r.top-1)+'px'; dlg.appendChild(e); }); });
  const er = await p.evaluate(()=>{ const r=document.getElementById('exportDialog').getBoundingClientRect(); return {x:r.left-16,y:r.top-14,width:r.width+32,height:r.height+28}; });
  await p.screenshot({path:O+'/export.png', clip:er});
  await b.close();
})();
