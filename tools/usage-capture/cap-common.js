// 使い方ページ（usage.html）のカード画像・動画を作り直すためのスクリプト共通部。
// 手順（リポジトリのルートで実行。Playwright と ffmpeg が必要）:
//   1. フォント（OFL）を取得し、woff2 を1つのディレクトリ <フォント> にまとめる:
//        npm pack @fontsource/noto-serif-jp @fontsource/noto-sans-jp（明朝・ゴシック。今のデザインで使う）
//        npm pack @fontsource/m-plus-rounded-1c（丸ゴシック。旧デザイン用）
//      展開した各 package/files の woff2 をまとめてコピーする
//   2. スマホ枠に入れる画面を撮る:      node tools/usage-capture/cap-screens.js <画面>
//   3. 1枚目（静止画）を作る:           CARD_THEME=calm node tools/usage-capture/cap-cards.js <画面> <フォント> <出力>
//      → <出力>/card-1.png を WebP に変換して images/usage/card-1.webp に置く
//         ffmpeg -i card-1.png -c:v libwebp -quality 86 images/usage/card-1.webp
//   4. 2枚目以降（動画）を作る:         CARD_THEME=calm node tools/usage-capture/cap-cards-anim.js <画面> <フォント> images/usage <作業用> [名前,...]
// カードの文言・配置は cards.html、見た目は cards-calm.css（カレンダーに合わせたデザイン）、各動画の操作は cap-cards-anim.js の SCENES で変える。
// PC用のカード（usage.html の PC 表示。ブラウザの窓に PC 幅の画面を写す）は、2〜4 を CARD_SET=pc を付けて実行する
//   （CARD_THEME は付けない。テンプレートは cards-pc.html、出力は card-pc-N）:
//   CARD_SET=pc node tools/usage-capture/cap-screens.js <PC画面>
//   CARD_SET=pc node tools/usage-capture/cap-cards.js <PC画面> <フォント> <出力>  → card-pc-1.png を WebP にして images/usage/card-pc-1.webp
//   CARD_SET=pc node tools/usage-capture/cap-cards-anim.js <PC画面> <フォント> images/usage <作業用> [名前,...]
// 誕生日バッジや NEW! が写るよう、日付を 2026-10-28 に固定して撮影する。
const { chromium } = require('playwright');
const PAGE = 'file://' + require('path').resolve(__dirname, '../../aikatsu_calendar.html');
const FIXED = new Date('2026-10-28T10:00:00+09:00');
// CARD_SET=pc のときは PC 幅の画面（ブラウザの窓に写す大きさ）で撮る
const PC = process.env.CARD_SET === 'pc';
const VIEW = PC ? {width:1040,height:560} : {width:390,height:844};
async function newPage(b, opts={}){
  const ctx = await b.newContext({ viewport:VIEW, deviceScaleFactor:2, locale:'ja-JP', timezoneId:'Asia/Tokyo', ...opts });
  await ctx.clock.setFixedTime(FIXED);
  const p = await ctx.newPage();
  p.on('pageerror', e=>console.log('PAGEERR', e.message));
  await p.goto(PAGE); await p.waitForSelector('.add-cal',{state:'attached'});
  // ページを開いたときのフェードインは撮影の邪魔になるので止める
  await p.addStyleTag({content:`
    .today-bar,.page{animation:none!important}
    .um-ring{position:absolute;border:2px solid #24315e;border-radius:8px;pointer-events:none;z-index:9999;box-shadow:0 0 0 2px rgba(255,255,255,.9)}
    .um-num{position:absolute;width:22px;height:22px;border-radius:50%;background:#24315e;color:#fff;font:700 13px/22px "Hiragino Sans",sans-serif;text-align:center;z-index:10000;box-shadow:0 0 0 2px #fff;pointer-events:none;white-space:nowrap}
    .um-num.um-label{width:auto;padding:0 10px;border-radius:999px;font-size:12px}
    .um-tap{position:fixed;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;background:rgba(224,23,108,.35);border:2px solid rgba(224,23,108,.8);pointer-events:none;z-index:100000;animation:umtap .6s ease-out forwards}
    @keyframes umtap{from{transform:scale(.5);opacity:1}to{transform:scale(1.4);opacity:0}}`});
  return { ctx, p };
}
// marks: [{sel, n, pad, nth, round, text, corner, dx, dy}]
// 番号は指す場所に重ねないよう外側に置く。corner: 't'(上中央) 'b'(下中央) 'l'(左) 'r'(右) 'tl' 'tr' 'bl' 'tre'(上・右寄せ) 'tlo'(上・左寄せ)
// n が2文字以上（例: "A カテゴリ"）のときは横長のラベルになる
// 印の色はサイトのピンクと区別できるよう濃い紺にしている
async function mark(p, marks){
  await p.evaluate((marks)=>{
    document.querySelectorAll('.um-ring,.um-num').forEach(e=>e.remove());
    marks.forEach(m=>{
      const els=document.querySelectorAll(m.sel); const el=els[m.nth||0]; if(!el){ console.log('nomark',m.sel); return; }
      // text:true は要素の幅ではなく文字の部分だけを囲む
      let r=el.getBoundingClientRect(); if(m.text){ const rg=document.createRange(); rg.selectNodeContents(el); r=rg.getBoundingClientRect(); }
      const pad=m.pad==null?4:m.pad, sx=scrollX, sy=scrollY;
      const ring=document.createElement('div'); ring.className='um-ring';
      Object.assign(ring.style,{left:(r.left-pad+sx)+'px',top:(r.top-pad+sy)+'px',width:(r.width+pad*2)+'px',height:(r.height+pad*2)+'px'});
      if(m.round) ring.style.borderRadius='999px';
      const num=document.createElement('div'); num.className='um-num'+(String(m.n).length>1?' um-label':''); num.textContent=m.n;
      const c=m.corner||'tl'; let x,y;
      if(c==='tl'){x=r.left-pad-11;y=r.top-pad-11} else if(c==='tr'){x=r.right+pad-11;y=r.top-pad-11}
      else if(c==='l'){x=r.left-pad-26;y=r.top+r.height/2-11} else if(c==='r'){x=r.right+pad+4;y=r.top+r.height/2-11}
      else if(c==='bl'){x=r.left-pad-11;y=r.bottom+pad-11}
      else if(c==='t'){x=r.left+r.width/2-11;y=r.top-pad-26} else if(c==='b'){x=r.left+r.width/2-11;y=r.bottom+pad+4}
      else if(c==='tre'){x=r.right+pad-22;y=r.top-pad-26} else if(c==='tlo'){x=r.left-pad;y=r.top-pad-26}
      x+=m.dx||0; y+=m.dy||0;
      x=Math.max(2,Math.min(x,innerWidth-24));
      Object.assign(num.style,{left:(x+sx)+'px',top:(y+sy)+'px'});
      document.body.append(ring,num);
    });
  }, marks);
}
// タップした場所に丸を出す。開いているダイアログ（最前面に出る）があれば、その中に出さないと隠れてしまう
async function tapFx(p){
  await p.evaluate(()=>{ document.addEventListener('pointerdown',e=>{const d=document.createElement('div');d.className='um-tap';d.style.left=e.clientX+'px';d.style.top=e.clientY+'px';(document.querySelector('dialog[open]')||document.body).appendChild(d);setTimeout(()=>d.remove(),700)},true); });
}
module.exports = { chromium, newPage, mark, tapFx, PC, VIEW };
