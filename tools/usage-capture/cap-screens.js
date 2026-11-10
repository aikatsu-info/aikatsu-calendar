// 使い方ページ（カード型デザイン）のスマホ枠に入れる画面を、番号なしで撮影する。
// 使い方: node tools/usage-capture/cap-screens.js <出力ディレクトリ>
const { chromium, newPage } = require('./cap-common.js');
const O = process.argv[2];
const W = ms => new Promise(r=>setTimeout(r,ms));
const tagCell = (p, day, id) => p.evaluate(([day,id])=>{ const c=[...document.querySelectorAll('.cal-day:not(.pad)')].find(c=>c.querySelector('.num').textContent.trim()===String(day)); c.id=id; }, [day,id]);
const scrollTo = (p, sel, off) => p.evaluate(([s,o])=>{ const e=document.querySelector(s); window.scrollTo(0, e.getBoundingClientRect().top+scrollY-o); },[sel,off]);
(async () => {
  const b = await chromium.launch();
  const shot = async (name, prep) => {
    const { ctx, p } = await newPage(b);
    await prep(p); await W(350);
    await p.screenshot({ path: O+'/'+name+'.png' });
    await ctx.close();
  };
  // カレンダー全体
  await shot('s-calendar', async p => { await scrollTo(p, '.tabs-row', 62); });
  // 日付をタップ → その日の予定（詳細を開く）
  await shot('s-day', async p => { await tagCell(p,22,'u22'); await p.click('#u22'); await W(1000); await p.locator('#dayPanelBody .item-head').first().click(); await scrollTo(p,'#dayPanel',62); });
  // カテゴリで絞り込み（グッズ）
  await shot('s-filter', async p => { await p.click('#legendCal .chip:has-text("グッズ")'); await scrollTo(p, '#legendCal', 70); });
  // トピックス
  await shot('s-topics', async p => { await p.click('#tab-topics-btn'); await scrollTo(p, '.tabs-row', 62); });
  // 誕生日（10月を開く）
  await shot('s-birthday', async p => { await p.click('#tab-topics-btn'); await p.click('#sortBirthdayBtn'); await p.evaluate(()=>{ const d=document.querySelector('.bday-month.current'); d.open=true; d.id='uOct'; }); await scrollTo(p,'#uOct',300); });
  // 1件ずつ追加のメニュー
  await shot('s-addcal', async p => { await tagCell(p,22,'u22'); await p.click('#u22'); await W(1000); await p.locator('#dayPanelBody .item-head').first().click(); await scrollTo(p,'#dayPanel',62); await W(200); await p.locator('#dayPanelBody .add-cal-toggle').first().click(); });
  // まとめて追加
  await shot('s-export', async p => { await p.click('#exportOpenBtn'); await p.evaluate(()=>document.getElementById('exportTitle').blur()); });
  // メニュー
  await shot('s-menu', async p => { await p.click('#menuBtn'); await W(300); });
  await b.close();
})();
