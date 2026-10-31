const { chromium, newPage, mark } = require('./cap-common.js');
const O = process.argv[2];
const tagCell = (p, day, id) => p.evaluate(([day,id])=>{ const c=[...document.querySelectorAll('.cal-day:not(.pad)')].find(c=>c.querySelector('.num').textContent.trim()===String(day)); c.id=id; }, [day,id]);
const clear = p => p.evaluate(()=>document.querySelectorAll('.um-ring,.um-num').forEach(e=>e.remove()));
const top = async (p, sel, off=70) => { await p.evaluate(([s,o])=>{ const e=document.querySelector(s); scrollTo(0, e.getBoundingClientRect().top+scrollY-o); },[sel,off]); await p.waitForTimeout(150); };
(async () => {
  const b = await chromium.launch();
  const { p } = await newPage(b);
  // A: overview
  await mark(p, [
    {sel:'#todayBadges .today-pill', n:1, pad:3, round:true}, {sel:'#searchToggleBtn', n:2, round:true, pad:3, corner:'bl'}, {sel:'#menuBtn', n:3, round:true, pad:3, corner:'bl'},
    {sel:'#brandHome', n:4}, {sel:'#lastUpdated', n:5, pad:3}, {sel:'#mainTabs', n:6, round:true}, {sel:'#exportOpenBtn', n:7, round:true}, {sel:'#legendCal', n:8, pad:3},
  ]);
  await p.screenshot({path:O+'/overview.png', clip:{x:0,y:0,width:390,height:340}});
  await clear(p);
  // B: menu
  await p.click('#menuBtn'); await p.waitForTimeout(400);
  await p.screenshot({path:O+'/menu.png', clip:{x:0,y:0,width:390,height:560}});
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  // C: calendar
  await tagCell(p, 8, 'umDots'); await tagCell(p, 28, 'umBday');
  await top(p, '.cal-nav-row', 60);
  await mark(p, [
    {sel:'#prevMonth', n:1, pad:0, round:true, corner:'l'}, {sel:'#nextMonth', n:1, pad:0, round:true, corner:'r'}, {sel:'#calMonthLabel', n:2, pad:2},
    {sel:'.cal-view-toggle', n:3, round:true, pad:3}, {sel:'#umDots', n:4, pad:-1}, {sel:'#umBday', n:5, pad:-1},
  ]);
  const g = await p.evaluate(()=>{ const a=document.querySelector('.cal-nav-row').getBoundingClientRect(), z=document.querySelector('.cal-grid').getBoundingClientRect(); return {y:a.top-14, h:z.bottom-a.top+28}; });
  await p.screenshot({path:O+'/calendar.png', clip:{x:0,y:g.y,width:390,height:g.h}});
  await clear(p);
  // D: day panel + item detail (gashapon reservation on 10/20)
  await tagCell(p, 20, 'um20'); await p.click('#um20'); await p.waitForTimeout(200);
  const it = p.locator('#dayPanelBody .item').filter({hasText:'予約開始'}).first();
  await it.locator('.item-head').click(); await p.waitForTimeout(200);
  await top(p, '#dayPanel', 64);
  await p.evaluate(()=>{ const i=[...document.querySelectorAll('#dayPanelBody .item')].find(x=>x.textContent.includes('予約開始')); i.id='umItem'; });
  await mark(p, [
    {sel:'#umItem .cat', n:1, pad:3}, {sel:'#umItem .eventline', n:2, pad:3}, {sel:'#umItem .add-cal-toggle', n:3, round:true, pad:3, corner:'l'}, {sel:'#umItem .src', n:4, pad:3, corner:'l'},
  ]);
  const d = await p.evaluate(()=>{ const r=document.getElementById('umItem').getBoundingClientRect(), h=document.getElementById('dayPanel').getBoundingClientRect(); return {y:h.top-8, h:r.bottom-h.top+18}; });
  await p.screenshot({path:O+'/item.png', clip:{x:0,y:d.y,width:390,height:d.h}});
  await clear(p);
  // E: topics (新着)
  await p.click('#tab-topics-btn'); await p.waitForTimeout(200);
  await top(p, '.tabs-row', 60);
  await mark(p, [ {sel:'#legendTopics', n:1, pad:3}, {sel:'.topics-toolbar .sort-toggle', n:2, round:true, pad:3}, {sel:'#topicsPaginationTop', n:3, pad:2}, {sel:'#topicsList .new-badge', n:4, pad:2, corner:'r'} ]);
  const t = await p.evaluate(()=>document.querySelector('.tabs-row').getBoundingClientRect().top-12);
  await p.screenshot({path:O+'/topics.png', clip:{x:0,y:t,width:390,height:640}});
  await clear(p);
  // F: birthday
  await p.click('#sortBirthdayBtn'); await p.waitForTimeout(200);
  await p.evaluate(()=>{ const d=document.querySelector('.bday-month.current'); d.open=true; d.id='umOct'; });
  await top(p, '#umOct', 80);
  await mark(p, [ {sel:'#umOct summary', n:1, pad:2}, {sel:'#umOct .bday-card', n:2, pad:2, corner:'tr'} ]);
  const bt = await p.evaluate(()=>{ const r=document.getElementById('umOct').getBoundingClientRect(); return {y:r.top-16, h:r.height+30}; });
  await p.screenshot({path:O+'/birthday.png', clip:{x:0,y:bt.y,width:390,height:bt.h}});
  // G: export dialog
  await p.click('#tab-cal-btn'); await p.click('#exportOpenBtn'); await p.waitForTimeout(200);
  await mark(p, [ {sel:'#exportPresets', n:1, round:true, pad:3}, {sel:'.export-range', n:2, pad:3}, {sel:'#exportCats', n:3, pad:3}, {sel:'.export-checks', n:4, pad:3}, {sel:'#exportCount', n:5, pad:3}, {sel:'#exportDownloadBtn', n:6, round:true, pad:3, corner:'tl'} ]);
  // markers are in body (below the top layer) -> move them into the dialog
  await p.evaluate(()=>{ const dlg=document.getElementById('exportDialog'), r=dlg.getBoundingClientRect(); dlg.style.overflow='visible';
    document.querySelectorAll('.um-ring,.um-num').forEach(e=>{ e.style.left=(parseFloat(e.style.left)-scrollX-r.left-1)+'px'; e.style.top=(parseFloat(e.style.top)-scrollY-r.top-1)+'px'; dlg.appendChild(e); }); });
  const er = await p.evaluate(()=>{ const r=document.getElementById('exportDialog').getBoundingClientRect(); return {x:r.left-14,y:r.top-14,width:r.width+28,height:r.height+28}; });
  await p.screenshot({path:O+'/export.png', clip:er});
  await b.close();
})();
