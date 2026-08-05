# aikatsu-calendar

「アイカツ！」シリーズの最新情報（グッズ・イベント・配信・誕生日・周年など）をまとめる非公式ファンメイドカレンダーサイト。

## 構成

- [aikatsu_calendar.html](aikatsu_calendar.html) — サイト本体。`// ITEMS:START` 〜 `// ITEMS:END` の間に `var ITEMS = [...]` として全イベント/商品データを直接埋め込んでいる（JSオブジェクトリテラル、キーは無引用符）。
- [data/items.json](data/items.json) — 同じデータの JSON 版（キーは引用符あり）。**両ファイルは独立した複製であり、自動同期されない。** 片方を編集したら必ずもう片方も同じ内容で更新すること。
- ページはビルドプロセスを持たない素の静的HTML。`items.json` を `fetch()` で読み込んではいない（コード内に埋め込み済みのため）。

## データエントリの形式

```
{id:"YYYYMMDD-NN", cat:"goods"|"event"|..., subcat:"gashapon"(任意), published:"YYYY-MM-DD"|null,
 addedAt:"YYYY-MM-DD", eventDate:"YYYY-MM-DD"|null, eventLabel:"...", title:"...", detail:"...",
 src:"...", url:"...", reservation:true(予約系のみ)}
```

- `id` は `追加日-連番`。同じ日に追加した項目は連番を振る。
- 予約商品は「予約開始」と「予約締切」で **2件のペア** を作るのが慣例（`published` は両方とも予約開始日で揃える。`eventDate` は開始/締切それぞれの日付）。
- ガシャポン関連は `subcat:"gashapon"` を付与する。
- **予約・グッズに限らず、開始日と終了日（締切日）の両方がある情報は必ず2件ペアで登録する**（POP UP SHOP等の開催期間、通販受付期間、サービス利用期間など）。`eventLabel` に「〜」で範囲をまとめて1件だけ登録するのは禁止。`title` は「〜開始」「〜終了」「〜締切」など、開始/終了のどちらかが名称から分かるようにする。`published` は両方とも同じ値（元の告知日）で揃える。

  例（NG → OK）:
  ```
  NG: {eventLabel:"7月17日(金)〜7月30日(木) 開催", title:"POP UP SHOP開催中", ...}
  OK: {eventLabel:"7月17日(金) 開催開始（〜7月30日）", title:"POP UP SHOP開催開始", ...}
      {eventLabel:"7月30日(木) 開催終了", title:"POP UP SHOP開催終了", ...}
  ```

## 情報源一覧

サイト側の公式情報源一覧は [aikatsu_calendar.html](aikatsu_calendar.html) 内 `<details class="foot-links">`（フッターの「リンクを表示する」）に集約されている。ここが正本（single source of truth）で、`data/items.json` 側には複製しない。新しい情報源（公式X・公式サイト等）を追加する際は、このフッターのリンク一覧に追記すること。1つ目の `.foot-group` が公式サイト、2つ目の `.foot-group` が公式Xアカウントの一覧。

- 2026-08-03 に **X @p_bandai（プレミアムバンダイ公式）** をXアカウント一覧に追加。プレミアムバンダイの予約商品情報の収集に利用する。
  - 未ログイン状態では直近5件程度のポストしか見えず、スクロールしても増えない（ログイン壁が出る）。検索機能（`x.com/search?...`）も未ログインでは使えない。そのため過去分の網羅的な取得はできず、**その時点のタイムライン上位数件を確認する運用**になる。個別ポストは `x.com/p_bandai/status/<id>` で直接開けば全文と画像が見える（プロフィールページのタイムラインでは「さらに表示」で本文が省略される）。
  - **p-bandai.jp の商品ページ（`p-bandai.jp/item/item-xxxxxxx/`）はボット検知（stclab botmanager）で弾かれ、ブラウザ・WebFetchどちらでもアクセス不可**（`restriction.p-bandai.jp` にリダイレクトされ `AccessDenied`）。回避策は取らない。p-bandai.jp の商品は基本的に https://www.aikatsu.net/portal/topics/ （アイカツ！ポータルのニュース記事）でも同時告知されており、そちらは通常通りアクセスできて商品名・価格・種類数・予約期間などの詳細が載っているので、そちらを情報源にする。

## ガシャポン情報収集の手順（重要 — 過去に情報漏れが発生した原因と対策）

アイカツ関連ガシャポンの情報源は2つ：

1. **https://gashapon.jp/products/result.php?free=アイカツ**（バンダイ公式ガシャポン検索、通常カプセル）
2. **https://parks2.bandainamco-am.co.jp/category/GASHAPON_TOP_TAG/?keyword=アイカツ&category_cd=GASHAPON_TOP_TAG**（ガシャポンオンライン、ナムコパークス）

### 過去に起きた見落としの原因

- **gashapon.jp**: 検索結果は「1ページ20件×3ページ」のように見えるが、実際は **49件全てが初回ロードのHTMLに含まれている**。ページネーションは表示/非表示をJSで切り替えているだけで、2ページ目以降の商品は `display:none` などで**非表示**になる。`WebFetch`（AIによる要約）や `get_page_text`（可視テキストのみ抽出）はどちらも**非表示要素を読み飛ばす**ため、1ページ目の20件しか拾えず、残り29件を見逃していた。
- **parks2.bandainamco-am.co.jp**: 全商品はDOM上で可視状態だったが、`WebFetch` の要約モデルが「その他22件」のように**リストを丸めて省略**し、個別の商品名・予約期間を落としていた。

### 今後の正しい取得方法

1. ブラウザツール（`mcp__Claude_Browser__*`）でページを開く。
2. `WebFetch` や `get_page_text` だけに頼らず、**`javascript_tool` でDOMから直接抽出**する。可視/不可視を問わず全件取得するには `document.querySelectorAll(...)` で対象リンクを全て取り、`offsetParent !== null` は無視して良い（非表示でも実データとして有効）。
   - gashapon.jp: `a[href*="detail.php?jan_code"]` で全商品リンク・JANコードが取れる。
   - parks2: `li.item-list-item` 単位で商品名・価格・発送月・SOLD OUT状態が取れる。
3. 既存の `data/items.json` に含まれるJANコード／商品コード（`grep -oE 'jan_code=[0-9]+|PRE_[0-9A-Z]+' data/items.json`）と突き合わせて、未収録の商品を洗い出す。
4. 新商品・未収録の予約情報が見つかったら、該当の detail ページ（`gashapon.jp/products/detail.php?jan_code=...` または `parks2.../PRE_xxx.html` / `ITEM_Axxx.html`）を個別に開いて発売時期・価格・種類数・説明文を取得する。
5. `aikatsu_calendar.html` の `ITEMS` 配列と `data/items.json` の**両方**に追記する（順序・件数が一致するか `grep -c '"id"' data/items.json` などで確認）。
6. 個別detailページを多数(10件以上)開く場合は、都度 `navigate` するより、同一オリジンの1ページを開いた状態で `javascript_tool` から `fetch('/products/detail.php?jan_code=...')` → `DOMParser` でパースする方が高速（`h1.pg-heading` がタイトル、`p.pg-detail__description` が説明文、`dl.pg-detailDefinition` の dt/dd が発売時期・価格・種類数・対象年齢）。ただし2019年より前の古い商品ページは `dl` に「発売時期」しか無く、価格・種類数は載っていない（検索結果一覧ページ側のバッジ表示から補う）。
7. 発売時期が「○月第N週」表記の場合、日曜始まり週（月初日を含む週を第1週とする）のMonday（月曜）をeventDateとして採用するのが既存データの慣例（例: 2026年1月第3週 → 2026-01-12）。「上旬/中旬/下旬」表記の場合は旬の初日（上旬=1日、中旬=11日、下旬=21日）をeventDateとして採用する。

### 収録範囲についての方針

2013〜2021年頃の旧世代ガシャポン（初代アイカツ！〜アイカツフレンズ！時代）も、ユーザーの意向により**全て収録済み**（2026-08-02に25件追加）。gashapon.jpの検索結果に出てくる商品は年代を問わず全件カレンダー化する方針。今後も同様に、検索結果でヒットする商品は年代の新旧を問わず追加してよい。
