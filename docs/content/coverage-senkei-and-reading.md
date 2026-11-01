# 戦型の体系化と読み物（コラム）企画

作成日: 2026-11-01 / 担当: 調査 cov-senkei / **状態: 作業中（骨組み＋確認済みの節から順に追記）**
方針: 本書は調査と提案のみ。`js/` `css/` `index.html` は変更しない。確認できなかった事実は【要確認】と明記する。

---

## 0. 先行ドキュメントとの関係（重複を避けるための線引き）

- `docs/content/coverage-tactics.md` §1 に、**相居飛車の戦型データ案**（`js/data/senkei.js`、`kakugawari/aigakari/yokofudori/yagura/gangi`、`group:'aiibisha'`）がすでにある。本書はそれを書き直さず、**まだ無い部分**に広げる:
  対抗形の細分類（振り飛車の種類 × 急戦/持久戦）、相振り飛車、力戦、角交換振り飛車、陽動振り飛車、そして階層（大分類→中分類）と成立条件の宣言化。
- 角換わり・相掛かり・横歩取り・矢倉・雁木などは、その後 `tactics.js` に**戦法エントリ**として入った（`kakugawari` `itteson-kakugawari` `aigakari` `yokofudori` `aonoryu` `yuukiryu` `yagura-senpou` `yagura37gin` `yagura-37kei` `waki-system` `gangi-ibisha` `gangi-hikikaku` `migigyoku-senpou`、いずれも 2026-11-01 時点で確認）。**戦型データと戦法エントリの役割分担と重複解消**は §3-2 で提案する。
- 制約UIは六角フィールドに統一され、戦法を複数選べる（`js/ui/constraint-field.js` / `js/core/constraints.js` / commit 59def77）。UI案は §3-4 で**現行コードを読んで**書く。
- 歴史・由来の事実は `quality-*.md` ③加筆案（そこで Wikipedia 各記事に照合済み）から引用し、引用元を `（q-i）=quality-tactics-ibisha.md` `（q-f）=quality-tactics-furibisha.md` `（q-c）=quality-castles.md` と示す。

### 0-1. 対象一覧と確認状況（1件確認するごとに更新）

| # | 対象 | 状況 |
|---|---|---|
| A1 | ja Wikipedia「将棋の戦法」の分類 | 確認済（要約経由） |
| A2 | shougi.jp「将棋の戦法一覧」の分類 | 確認済 |
| A3 | shogidata.info の戦型分類（2ページ） | 確認済 |
| A4 | 棋士成績DB の戦型分類 | 確認済（藤井聡太のページの範囲） |
| A5 | ALSOK 将棋コラム第3回（相居飛車6戦型） | 確認済 |
| A6 | ABEMA TIMES 入門記事 / Arakippe / Wikibooks | 確認済 |
| A7 | 対抗形の細分類（急戦/持久戦×振り飛車の種類） | 未 |
| A8 | 相振り飛車の細分類 | 未 |
| A9 | 力戦・陽動振り飛車・角交換振り飛車 | 未 |
| A10 | 英語圏の分類（Wikipedia/Shogi Harbour 等） | 未 |
| B1 | 現行コード（constraints.js labels/ constraint-field.js / board-detail-view.js）の読解 | 済 |
| B2 | 戦型データ下書き（対抗形・相振り・力戦・角交換・陽動） | 未 |
| C1 | コラム題材リスト（15〜25本）の事実確認 | 未 |
| C2 | 本文素案 上位5本 | 未 |
| C3 | 公開統計の所在（Arakippe / shogidata.info / floodgate 等） | 一部確認済 |

---

## 1. 要約

<!-- TODO:sec1 -->

## 2. 戦型の階層表と現行実装との差分

### 2-1. 出典ごとの分類（比較）

2026-11-01 に WebFetch で開いて確かめた範囲。「要約経由」は、取得ツールが記事を要約して返したもの（細目の取りこぼしがありうる。見出し構造は信頼してよい）。

| 出典 | 大分類 | 中分類（戦型）・小分類 | 備考（出典ごとの違い） |
|---|---|---|---|
| **ja Wikipedia「将棋の戦法」**<br>`wj-senpou`（新規。「対抗形」はここへのリダイレクト）<br>要約経由 | 相居飛車 / 対抗型 / 相振り飛車 / その他（奇襲戦法・力戦型・その他） | **相居飛車**: 矢倉戦（相矢倉・急戦矢倉・変化型）/ 角換わり（腰掛け銀・早繰り銀・棒銀・筋違い角・後手一手損角換わり）/ 相掛かり（相居飛車型・変化型＝ひねり飛車）/ 横歩取り（△3三角・△3三桂・△4五角・相横歩取りなど）<br>**対抗型**: 居飛車側＝急戦用（対中飛車・対四間・対三間・対向かい）と持久戦用・その他（居飛車穴熊・左美濃・位取り・ミレニアム・糸谷流右玉・飯島流引き角・地下鉄飛車・英春流）／振り飛車側＝中飛車・四間・三間・向かいの各「ノーマル」と「角交換型」<br>**相振り飛車**: 中飛車・四間・三間・向かい | 「戦型＝大駒（飛車・角）の位置などで大別した型」「戦法＝各戦型での攻め方・受け方」と定義し、「大駒の位置だけでは分類しきれず、囲いも戦法を決める」と断る。**雁木は矢倉戦の「変化型」**（▲3五歩早仕掛け・陽動振り飛車・無理矢理矢倉と並ぶ）に置かれ、独立した戦型扱いではない。右から3・4番目の筋の飛車（袖飛車・右四間）は居飛車に含め、**5筋の飛車は振り飛車が多数派だが居飛車扱いもある**と書く。力戦型は「通常の戦型の分類に当てはまらない進行」の総称で、定義は消極的 |
| **shougi.jp「将棋の戦法一覧」**（将棋研究）<br>`sj-senpou-index`（既存） | 居飛車の戦法 / 振り飛車の戦法 / その他 | **居飛車**: 矢倉系（矢倉・矢倉3七銀・雀刺し・森下システム・脇システム）/ 相掛かり系（相掛かり・ひねり飛車）/ 角換わり系（角換わり・一手損角換わり・角換わり棒銀・腰掛け銀・早繰り銀）/ 横歩取り系（横歩取り・青野流・勇気流）/ 汎用的な居飛車戦法（棒銀・袖飛車・右四間飛車・右玉）/ 対振り飛車向け（居飛車穴熊・玉頭位取り・5筋位取り・地下鉄飛車・棒金・4五歩早仕掛け・鷺宮定跡）<br>**振り飛車**: 向かい飛車系 / 三間飛車系 / 四間飛車系 / 中飛車系 / その他（一間飛車・角交換振り飛車・振り飛車穴熊・相振り飛車・陽動振り飛車）<br>**その他**: かまいたち・4四歩パックマン・嬉野流・筋違い角 | 「相居飛車」「対抗形」「力戦」「奇襲」の語は本文に無い。**対抗形に当たるものを「対振り飛車向けの戦法」として居飛車側の下に置く**（急戦/持久戦の区別はしない）。**雁木は一覧に無い**（囲いのページにだけある）。相居飛車の4戦型は「○○系」でまとめ、戦型の下に戦法・変化を並べる＝本アプリの「戦型＞戦法」に近い |
| **shogidata.info「戦型統計」**（2026-10-31 更新）<br>`shogidata-senkei` `shogidata-senkei-rank`（新規）<br>ホームと採用率ランキングの2種類 | 居飛車 / 振り飛車 | **ホーム（直近500局）**: 相居飛車＝相矢倉・角換わり・横歩取り・相掛かり・相居飛車(その他)／振り飛車＝中飛車・四間飛車・三間飛車・向かい飛車・角交換振り飛車・相振り飛車<br>**採用率ランキング（過去2年・10局以上の棋士）**: 居飛車＝矢倉・角換わり・横歩取り・相掛かり・**雁木**・居飛車(力戦)・**対振り飛車**／振り飛車＝中飛車・四間飛車・三間飛車・向かい飛車・**角交換振り飛車**・相振り飛車 | **同一サイトでも2つの表で分類が違う**（ホームには雁木が無く「相居飛車(その他)」に含まれうる。ランキングには雁木と対振り飛車がある）。**対抗形は振り飛車側の種類（中・四間・三間・向かい）で分けて見える**（ホームの割合は 相居飛車62.6%＋振り飛車36.6% で合計がほぼ100%になり、1局を1項目に割り当てていると読める。割当規則そのものはページに記載なし）。**角交換振り飛車が飛車の筋の分類と並ぶ独立項目**。棋士の傾向は居飛車党・オールラウンダー・振り飛車党の3区分。判定方法はページに記載なし |
| **棋士成績DB**（藤井聡太のページ）<br>`shogirsltdb-fujii`（新規）<br>要約経由 | （階層なし） | 矢倉 / 角換わり / 相掛かり / 横歩取り / 一手損角換わり / 四間飛車(居飛車側) / 三間飛車(居飛車側) / 中飛車(居飛車側) / 向飛車(居飛車側) / 相居飛車力戦 / 戦型不明 | **一手損角換わりを角換わりから分ける**。**雁木が無い**（相居飛車力戦に入る）。対抗形は「四間飛車(居飛車側)」のように**居飛車側の成績として**数える表記（藤井聡太は居飛車党なので居飛車側の項目だけが出ており、振り飛車側の項目の有無は未確認）。運営者・更新日の記載なし |
| **ALSOK 将棋コラム 第3回**（執筆2023年10月）<br>`alsok-column3`（新規） | 相居飛車に絞った論 | 矢倉・相掛かり・角換わり・横歩取り・雁木・一手損角換わりの**6戦型**を「現在も公式戦で採用されている代表」とする | **戦型を決める権利で2群に分ける**: 後手が決められる＝横歩取り・雁木・一手損角換わり／先手に決定を委ねる＝矢倉・相掛かり・角換わり。雁木と一手損角換わりを独立戦型として扱う点が、Wikipedia「将棋の戦法」の分類と異なる |
| **ABEMA TIMES 入門記事**（2026-04-16）<br>`abema-senkei`（新規） | 居飛車 / 振り飛車 | 居飛車＝矢倉・角換わり・相掛かり・雁木／振り飛車＝四間・三間・中・向かい | 入門向けの最小構成。取得内容に**横歩取りの記載が無く**、雁木は載る |
| **あらきっぺの将棋ブログ「最新戦法の事情」**<br>`arakippe-2018-01` `arakippe-2023-spring`（新規。ほか同シリーズ多数） | 相居飛車のみ集計 | 角換わり / 矢倉 / 相掛かり / 雁木 / 横歩取り / その他の戦型（一手損角換わりを含む。内訳で△8四歩型・△8三歩型） | 2017年12月分〜2023年春季号の公式戦を定期集計（§7）。**2017年12月分の集計（2018-01-01 公開）で既に雁木は独立項目**（相居飛車77局中14局）。個人ブログで分類基準の明文化なし |
| **Wikibooks「将棋の戦法一覧」**<br>要約経由 | 居飛車の戦法 / 振り飛車の戦法 / その他 | 居飛車＝矢倉・相掛かり・角換わり・対振り飛車（急戦・持久戦・引き角戦・端角）／振り飛車＝角交換振り飛車・中・三間・四間・向かい・相振り・振り飛車穴熊／その他＝右四間・雁木・袖飛車・筋違い角・奇襲・嬉野流・英春流 | 「相居飛車」「対抗型」の語が無く、取得内容に**横歩取りの項が無い**。更新の有無は未確認で、**重みは低い**（参考のみ）|

**出典間で食い違う点（ここが設計の分かれ目）**
1. **雁木の置き場所**: Wikipedia＝矢倉戦の変化型／ALSOK・shogidata.info（ランキング）・ABEMA・Arakippe＝独立戦型／shougi.jp 一覧＝戦法一覧に無い。→ 本アプリは**独立戦型にする**のが現状の実務（統計・解説とも独立扱い）に合う。
2. **一手損角換わり**: Wikipedia＝角換わりの下／棋士成績DB・ALSOK・Arakippe＝別項目／shogidata.info＝別項目なし。→ **角換わりの小分類**にして、統計用には切り出せるようにする。
3. **対抗形の数え方**: 振り飛車の種類で数える（shogidata.info）／居飛車側の対策で数える（棋士成績DB・shougi.jp「対振り飛車向け」）／急戦・持久戦で割る（Wikipedia）。→ 3つは**直交する軸**なので、1局面を（振り飛車の種類，居飛車側の方針）の2成分で表すのが最も情報を落とさない（§2-2）。
4. **角交換振り飛車**: Wikipedia＝各振り飛車の「角交換型」（飛車の筋の下位）／shogidata.info・shougi.jp＝飛車の筋と同格の独立項目。→ **飛車の筋とは直交する「角交換の有無」軸**として持つ（§2-2）。
5. **力戦**: Wikipedia＝「その他」で定義は消極的／shogidata.info＝「居飛車(力戦)」という受け皿／棋士成績DB＝相居飛車力戦。→ **どの条件にも当たらないときの受け皿**として「力戦」を置くのが共通。積極的な戦型としては定義しない。

### 2-2. 本書が提案する階層

3段（大分類→中分類→小分類）と、対抗形の中だけに現れる2本の直交軸で表す。**大分類は両者の戦略から機械的に決まり（実装済み: `matchup.threat().kind`）、中分類が `SENKEI` のエントリ、小分類が戦法（`tactics.js`）**。作者の「戦型→囲い・戦法」の順序と同じで、囲いは戦型ごとに代表を挙げる（`castles`）。

```
大分類（対戦形式）          中分類（SENKEI の id）                         小分類（既存の戦法 id。senkei[] タグで所属）
├ 相居飛車  aiibisha ─ 矢倉 yagura ········ 相矢倉(yagura37gin / yagura-37kei / waki-system / morishita-system / suzumezashi) / 急戦矢倉(yonenaga-kyusen / kanikanigin / naka-ibisha)   ［既存］
│                    ├ 角換わり kakugawari ·· 腰掛け銀 / 早繰り銀 / 棒銀 / 右玉(migigyoku-senpou) / 一手損角換わり(itteson-kakugawari)               ［既存］
│                    ├ 相掛かり aigakari ···· 浮き飛車 / ひねり飛車(hineribisha) / 塚田スペシャル(tsukada-special)                                    ［既存］
│                    ├ 横歩取り yokofudori ·· 青野流(aonoryu) / 勇気流(yuukiryu)                                                                    ［既存］
│                    └ 雁木 gangi ········· ツノ銀雁木など(gangi-ibisha)                                                                           ［既存］
├ 対抗形    taikou ─── 【軸1: 振り飛車の種類 rook】 対四間 taikou-shiken / 対三間 taikou-sanken / 対中 taikou-naka / 対向かい taikou-mukai       ［新規4］
│                    ├ 【軸2: 居飛車の方針 approach】 急戦 kyusen / 持久戦 jikyusen                                                                  ［新規2］
│                    └ 【軸3: 振り飛車の型 style】 角交換振り飛車 kakukoukan-furi（ノーマル＝角道を止める型との対）                                    ［新規1］
├ 相振り飛車 aifuri ─ 相中 ai-naka / 相三間 ai-sanken / （向かい飛車系は aifuri の desc で触れる）                                                    ［新規3］
└ 力戦      rikisen ─── 力戦（どれにも当たらない受け皿）/ 陽動振り飛車 youdou-furi（転換型。解説専用）                                                ［新規2］
```

**この形にした理由（§2-1 の食い違いへの答え）**
1. **対抗形は「振り飛車の種類」を主軸にする**。shogidata.info（中・四間・三間・向かい）、Wikipedia（振り飛車の筋で分類）、ABEMA とも、振り飛車側の筋を第一の分類にしているため。居飛車側の「急戦/持久戦」（Wikipedia が大別に使う）は**別の軸**にし、1局面を（種類，方針）の2成分で表す。例: `#対抗形 #対四間飛車・急戦`。軸を分けないと「対四間急戦」「対四間持久戦」「対三間急戦」…の8〜12件に爆発し、各エントリに書くことが無くなる。
2. **急戦/持久戦は境界が曖昧**（Wikipedia「急戦」: 「両者の間に明確な基準はない」[wj-kyusen]）。よって判定はデータの `pace`（戦法）と囲いの系統という**機械的な代理指標**で行い、解説文で「目安」と断る（§3-3）。
3. **角交換振り飛車は力戦に入れない**。shogidata.info・shougi.jp が独立項目にし、Wikipedia に19の事例を持つ独立記事があるなど、定跡化された戦型だから。飛車の筋とは直交するので `axis:'style'` で持つ。**陽動振り飛車は力戦側**に置く（Wikipedia が矢倉戦の変化型にも力戦型にも挙げて分類が揺れるうえ、途中で飛車を振る手順依存の戦型で、1局面のモデルに乗らない）。両者を力戦に入れたい場合も、`group` を書き換えるだけで済む（スキーマは変わらない）。
4. **雁木は相居飛車の独立戦型**（ALSOK・shogidata.info・ABEMA・Arakippe が独立扱い。Wikipedia「将棋の戦法」は矢倉戦の変化型に置くが、別記事「雁木囲い」は新型雁木を「大戦型の一つと見る向きもある」と書く[wj-gangi]）。**一手損角換わりは角換わりの小分類**（戦法エントリ `itteson-kakugawari` が既にある）で、統計用に切り出せるよう `parent` で結ぶ。
5. **力戦は「受け皿」**。Wikipedia・shogidata.info・棋士成績DB のすべてで、積極的な戦型ではなく「分類に当てはまらない」ものとして扱われる。

**境界の注記（判定が割れる場所）**: Wikipedia 用語一覧は居飛車を「飛車を1〜4筋に配置する戦法」と定義する [wj-shogi-yogo]。この定義では1筋の一間飛車も居飛車だが、本アプリは `ikkenbisha`（飛車1筋）を `furibisha-rook` 系統（振り飛車）に置く。5筋の飛車も、Wikipedia「将棋の戦法」は「振り飛車に分類されることが多いが居飛車に分類される場合もある」と書き、本アプリは `nakabisha` を振り飛車、`naka-ibisha`（飛59）を居飛車に置く。**どちらも出典間で割れている境界**なので、`matchup.threat().kind` の大分類がここで変わりうることを desc に一言書くのが安全。

### 2-3. 現行実装（`labels()`・`senkei` タグ）との差分と、すぐ直すべき判定

対象: `js/core/constraints.js` の `labels()`（commit 4d9f244 後の現行）と `js/data/senkei.js`。以下は**コードを実際に実行して確かめた**結果（`tools/unit-test.js` と同じ vm 読み込みで `sides()`→`labels()` を総当たり。リポジトリは読むだけで変更していない）。

#### A. 検証済みの不具合（優先度順）

**A-1（最優先）既定値の囲いが戦型ラベルを決めてしまう。** `labels()` は `sides()` の実効値（囲いが未選択でも既定囲いが入り `implied.castle` が立つ）をそのまま `isYagura()`/`isGangi()` に渡す。居飛車どうしの既定囲いは矢倉（`strategies.js` の `defaultCastle.vsIbisha`）なので、規則3（矢倉）が戦法のタグ判定（規則5 相掛かりなど）より先に当たり、**戦法が示す戦型を打ち消す**。

| 選択（自分 × 相手。囲いは未選択） | 現行の戦型ラベル | あるべき表示 | 原因 |
|---|---|---|---|
| 相掛かり × 相掛かり | #矢倉 | #相掛かり | 暗示の矢倉囲いが規則3で先に当たる |
| 塚田スペシャル × 相掛かり | #矢倉 | #相掛かり | 同上 |
| ひねり飛車 × ひねり飛車 | #雁木 | #相掛かり | 暗示囲いが雁木系になる |
| 横歩取り × 居飛車(2筋) / × 相掛かり | #矢倉 | #横歩取り | 規則2が**両側とも**yokofudori を要求。実戦で横歩を取るのは片側だけ |
| 雁木戦法 × 雁木戦法 | #矢倉 | #雁木 | 暗示の銀矢倉が当たる。`gangi` タグは判定に使われない |
| 角換わり(戦法) × 居飛車(2筋) / × 棒銀 / × 早繰り銀 | #矢倉 | #角換わり | 規則1が**両側の hand に角**を要求。棒銀・早繰り銀は hand 空 |
| 矢倉(戦法) × 矢倉(戦法) | #矢倉 | #相矢倉 | A-2 の回帰 |
| （全部未選択）× （全部未選択） | #矢倉 | #相矢倉（既定による暗示と分かる出し方） | 既定値を明示と区別していない |

**A-2（回帰）相矢倉と矢倉が同じ表示になった。** commit 4d9f244 で表示名を `senkeiName(id)`＝`SENKEI[SENKEI_RESOLVE[id]].name` に寄せた結果、`aiyagura`（両者矢倉）も `yagura`（片方だけ）も「矢倉」になった（`SENKEI.yagura.aliases:['相矢倉']` は使われていない）。`unit-test.js` は `id==='aiyagura'` だけを見るので通ってしまう。`label: id==='aiyagura' ? '相矢倉' : senkeiName(id)` で戻せる。

**A-3 SENKEI の中身はどの画面にも出ていない。** `grep senkei js/ui js/modes` は0件。`desc/forms/tactics/castles/sources` を読む箇所は無く、`labels()` が表示名を引くだけ（出典は `validate.js` の「使用済み出典」集計に数えられるのみ）。データを足す前に、見せる場所（§3-4）が要る。

#### B. 判定の設計上の穴（誤りやすいケース）

1. **使われないタグがある**: `labels()` が読む `senkei` タグは `yokofudori` と `aigakari` の2つだけ。`kakugawari`（8戦法）・`yagura`（13戦法）・`gangi`（1戦法）のタグは判定に使われない（角換わりは `hand` の角、矢倉・雁木は囲いの系統で決めている）。タグは「その戦法が属する・誘導する戦型」と定義されているのに、入力として働いていない。
2. **角換わりを `hand:'角'` だけで判定してよいか**: 持ち駒に角を持つ戦法は `koshikakegin` `kakugawari` `itteson-kakugawari` `direct-mukaibisha` の4つだけ。盤の事実（両者が角を持つ＝角交換済み）としては正しい定義だが、(a) 角換わり棒銀・早繰り銀・右四間・右玉は成立しない、(b) `koshikakegin` は `senkei` に kakugawari/aigakari/yagura の3つを持つのに `hand:'角'` を固定しているため、矢倉腰掛け銀・相掛かり腰掛け銀を選んでも**常に角換わり**になる。→ 盤の事実（両者の角）を第一に、タグを補助に使う（A-1 の修正案）。
3. **雁木と矢倉の境界**: 規則3（片方でも矢倉系なら「矢倉」）が規則4（雁木）より前なので、**雁木囲い×矢倉囲いは「矢倉」**になる。ALSOK の整理では雁木は「後手が選べる戦型」、矢倉は「先手に委ねる戦型」で別物 [alsok-column3]。ただし旧型の二枚銀雁木（`gangi` 囲い）は「主に矢倉戦で採用された」[wj-gangi] ので、`gangi`（旧型）を雁木戦の根拠にするか、新型（`tsunogin`＝`subtype:'tsuno'`）と戦法 `gangi-ibisha` だけを根拠にするかは**設計判断**（現行の unit-test は `gangi` 囲いで「雁木」を期待している）。
4. **一手損角換わりは先手視点データでは作れない**: `itteson-kakugawari` は通常の角換わりと同じ配置（desc に明記）。角換わりと一手損は label では区別できないので、小分類として解説（`parent:'kakugawari'`）に留める。
5. **横歩取りは先手側の戦法しか無い**: 後手の応手（△8五飛・△3三角・△3三桂・△4五角・相横歩取り）は後手専用で未収録（coverage-tactics.md §2-C）。片側成立の規則（A-1）にしないと、相手に何を置けば「横歩取り」になるのか UI から分からない。
6. **対抗形・相振りに細分類が無い**: `#対抗形` `#相振り飛車` で止まる。振り飛車の種類（`lead.files[0]`）と居飛車側の方針（`pace`・囲いの系統）で機械的に導ける（§3-3 で試作・実行済み: 棒銀×四間→`対四間飛車・急戦`、居飛車穴熊×四間→`対四間飛車・持久戦`、超速3七銀×ゴキゲン→`対中飛車・急戦` など）。
7. **力戦のラベルが無い**: どの規則にも当たらないとき何も出ない。明示した層だけで判定し、当たらなければ `#力戦` を点線で出す案（§3-3）。
8. **`SENKEI` の `tactics` が戦法側のタグとずれている（実測）**: `kakugawari` は `migishiken` `kakugawari` `itteson-kakugawari` `migigyoku-senpou`、`aigakari` は `koshikakegin` `hayakurigin` `bougin` `genshibougin` `hineribisha` `hineri-76hi`、`yagura` は `koshikakegin` `hayakurigin` `kanikanigin` `bougin` `naka-ibisha` `migishiken` `yonenaga-kyusen` が、タグはあるのに `SENKEI.*.tactics` に無い。二重管理なので必ずずれる（役割分担は §3-2）。

#### C. 修正案 v2（A-1 の修正。実行して検証済み）

方針は3つ。(1) **明示した層だけを根拠に先に判定し、決まらなければ既定値まで含めて再判定して `implied:true` を付ける**（UI は点線のピルにする）。(2) **戦法の `senkei` タグを両側で交差**させ、複数残るときだけ囲いで絞る。(3) 横歩取りは片側でよい。`labels()` の戦型部分（`if (me.strategy !== 'ibisha' …` 以降）の差し替え:

```js
const evidence = (st, useImplied) => {                    // その側の根拠。useImplied=false なら明示した層だけ
  const ids = st.tacticIds && st.tacticIds.length ? st.tacticIds : [st.tacticId];
  const ts = (useImplied || !(st.implied && st.implied.tactic) ? ids : []).map(findTactic).filter(Boolean);
  const c = (useImplied || !(st.implied && st.implied.castle)) ? findCastle(st.castleId) : null;
  return { tags: new Set(ts.flatMap(t => t.senkei || [])),
           kaku: ts.some(t => (t.hand || '').includes('角')),
           yagura: !!(c && c.family === 'yagura'),
           gangi: !!(c && c.family === 'gangi' && !c.refFamily) };   // カニ・兜は雁木戦と呼ばない
};
const decide = useImplied => {
  const A = evidence(me, useImplied), B = evidence(opp, useImplied);
  if (A.kaku && B.kaku) return 'kakugawari';                                      // 盤の事実: 両者の持ち駒に角
  if (A.tags.has('yokofudori') || B.tags.has('yokofudori')) return 'yokofudori';  // 横歩を取るのは片側だけ
  let cand = A.tags.size && B.tags.size ? [...A.tags].filter(x => B.tags.has(x))  // 戦法タグは交差
           : [...(A.tags.size ? A.tags : B.tags)];
  if (cand.length > 1) {                                                          // 複数残れば囲いで絞る
    const by = cand.filter(x => (x === 'yagura' && (A.yagura || B.yagura)) || (x === 'gangi' && (A.gangi || B.gangi)));
    cand = by.length === 1 ? by : [];
  }
  let id = cand.length === 1 ? cand[0] : null;
  if (!id) id = (A.yagura || B.yagura) ? 'yagura' : (A.gangi || B.gangi) ? 'gangi' : null;  // 囲いだけが根拠
  if (id === 'yagura' && (A.yagura || A.tags.has('yagura')) && (B.yagura || B.tags.has('yagura'))) return 'aiyagura';
  return id;
};
let id = decide(false), implied = false;
if (!id) { id = decide(true); implied = !!id; }
if (id) out.push({ id, label: id === 'aiyagura' ? '相矢倉' : senkeiName(id), ...(implied ? { implied: true } : {}) });
```

**検証**: スクラッチ上のコピーに差し替えて 20 ケースを実行し、A-1 の表の全行が「あるべき表示」になった（棒銀×棒銀のような本当に曖昧な組は `#相矢倉` を暗示として点線で出す）。右玉×右玉は `#角換わり`（`migigyoku-senpou` のタグ。Wikipedia 角換わりも右玉を持久戦志向の指し方に含める [wj-kakugawari]）。**既存の `labels` ユニットテスト10件は全て PASS のまま**。`tools/unit-test.js` 全体はリポジトリの現状で 150 PASS / 1 FAIL で、FAIL は `matrix:snapshot`（`expected-matrix.txt` と不一致。本件より前からの状態）。`tools/validate-castles.js` は §4 の下書き12件と新規出典を足したコピーでもエラー0（警告は `source:alsok-column3: どこからも参照されていない` が1件増えるだけ。大分類の desc が `SENKEI` 集計に入らないため。§3-5 参照）。

## 3. 戦型データのスキーマ案と UI 組み込み案

### 3-1. 現行の `SENKEI` を広げる（coverage-tactics.md §1-2 / commit 4d9f244 からの差分だけ）

現状は `Kakoi.SENKEI`（id→`{name, reading, short, aliases?, group:'aiibisha', desc, forms, tactics[], castles[], sources[]}`）と `Kakoi.SENKEI_RESOLVE`（`aiyagura→yagura`）の5件。使われ方は `labels()` が表示名を引くだけ（§2-3 A-3）。**既存5件は一字も変えずに通る**よう、追加はすべて任意フィールドにする。

| 追加するもの | 形 | 目的 |
|---|---|---|
| `Kakoi.SENKEI_GROUPS`（新規定数） | `{ aiibisha, taikou, aifuri, rikisen }` 各 `{name, short, kinds[], desc, sources}` | 大分類。`kinds` は `matchup.threat().kind` との対応（`aiibisha→['aiibisha']`、`taikou→['taikou-i','taikou-f']`、`aifuri→['aifuri']`、`rikisen→[]`）。`group` が増えるので入れ物を別に持つ |
| `group` の値 | `'aiibisha'`（既存）に `'taikou'` `'aifuri'` `'rikisen'` を足す | §2-2 の大分類 |
| `parent` | 戦型 id | 小分類（`ai-naka→aifuri`、`itteson-kakugawari→kakugawari`）。階層は最大3段 |
| `axis` | `'rook'` / `'approach'` / `'style'` | 対抗形の直交軸。**同じ軸の項目は排他、違う軸は併記**（`#対四間飛車・急戦` ＝ rook × approach） |
| `when` | 宣言的な条件（§3-3） | 判定を `labels()` の if 連鎖から SENKEI に移す（Phase 2） |
| `tactics` / `castles` | 配列、または `{ ibisha:[…], furibisha:[…] }` | 対抗形は両側の戦法・囲いが出るので側別を許す |
| `defaultTactic` / `defaultCastle` | id（`STRATEGIES` と同じ形） | 「この戦型の代表形にする」ボタンの行き先（§3-4） |
| `history` `trend` `origin` `players` `proverbs` | ブリーフ §7 の共通語彙 | 読み物。`trend` は `[{y, games, firstWin, ref}]` のように**数値＋出典**を必須にする（§7 に使える実数値あり） |
| `note` | 文字列 | 設計メモ（例: 陽動振り飛車の「モデル適合△」） |

### 3-2. 戦型データと戦法エントリの役割分担（重複の解消）

**重複の実態**。戦型と同名の戦法エントリが `tactics.js` に入った（`kakugawari` `itteson-kakugawari` `aigakari` `yokofudori` `aonoryu` `yuukiryu` `yagura-senpou` `yagura37gin` `yagura-37kei` `waki-system` `gangi-ibisha` `gangi-hikikaku` `migigyoku-senpou`）。結果、(1) **定義文が二重**（`SENKEI.kakugawari.desc`「序盤で角を交換してから駒組みを進める戦型。…」[wj-kakugawari] と `tactics.kakugawari.desc`「序盤に角を交換し、持ち角の打ち込みを警戒しながら…相居飛車戦型」[sj-kakugawari]）、(2) **出典が二重で別系統**（SENKEI は `wj-*`、戦法は `sj-*`）、(3) **所属が二重**（戦法の `senkei[]` タグと `SENKEI.*.tactics`。§2-3 B-8 のとおり既にずれている）。

**線引き（提案）**

| 情報 | SENKEI（戦型） | 同名の戦法エントリ | 理由 |
|---|---|---|---|
| 定義・成り立ち・成立の概形（`desc` `forms`） | **ここだけ** | 書かない（参照） | 戦型は「何であるか」、戦法は「盤にどう置くか」 |
| 歴史・流行・由来・使い手（`history` `trend` `origin` `players`） | **ここだけ** | 書かない | 戦型の流行は戦法より大きな単位で語られる（Arakippe・shogidata.info・ALSOK も戦型単位） |
| 盤の配置・持ち駒・経路・`essential`・`pace`・`against`・`pairings` | 持たない | **ここだけ** | 戦型は盤を持たない（複数の配置を含む） |
| 図のキャプション（「図は角交換直後の代表配置」） | 持たない | **desc を1〜2文のキャプションに短縮** | 同名戦法は「その戦型の代表形のスナップショット」 |
| 判定条件（`when`） | **ここ** | `senkei[]` タグだけ持つ（入力） | タグ＝入力、`when`＝判定規則 |
| 所属する戦法の一覧 | `featured`（代表と表示順だけ） | `senkei[]` が**唯一の正** | 全メンバーはタグから導出（`repo.tacticsOfSenkei(id)`）。`featured ⊆ tagged` を validate |
| 代表形（選んだときに入る戦法・囲い） | `defaultTactic` `defaultCastle` | — | `STRATEGIES.defaultTactic` と同じ流儀 |
| 出典 | 定義・分類・歴史の出典 | 配置・手順の出典 | 同じ事実を二重に引かない |

**書き換え例**（`tactics.kakugawari.desc`）: 現行「序盤に角を交換し、持ち角の打ち込みを警戒しながら銀や桂を使う相居飛車戦型[[sj-kakugawari|sj-senpou-index]]。図は角交換直後の代表配置。」→ 案「戦型『角換わり』の代表配置。図は角交換直後（互いに持ち角）[[sj-kakugawari]]。」。定義は `SENKEI.kakugawari` に一本化する。これでタグ・リスト・出典の三重管理が、**タグ（所属）＋SENKEI（物語）＋戦法（盤）**の三役に整理される。

### 3-3. 判定の宣言化と、対抗形・相振りの細分類

**Phase 1（コード数行・すぐ）**: §2-3 C の差し替えで A-1/A-2 を直す。あわせて下の細分類を `labels()` に足す。**試作を実行して確かめた**（棒銀・穴熊などの選択からの導出。リポジトリ無変更、スクラッチで16ケース）:

```js
const ROOK_KIND = { 5: 'naka', 6: 'shiken', 7: 'sanken', 8: 'mukai' };       // 先手視点の飛車の筋 → 振り飛車の種類
const rookFileOf = st => { const t = findTactic(st.tacticId);                 // 主の戦法（飛車優先）の筋
  return t && t.lead && t.lead.piece === '飛' ? t.lead.files[0] : null; };
const SLOW_CASTLE = new Set(['anaguma', 'mino']);                             // 居飛車側で手数がかかる囲いの系統
const paceOf = st => {                                                        // 居飛車側の方針: 明示した戦法の pace → 明示した囲い
  const ts = (st.implied.tactic ? [] : st.tacticIds).map(findTactic).filter(Boolean);
  const p = ts.map(t => t.pace).find(x => x === 'rapid' || x === 'slow');
  if (p) return p;
  const c = st.implied.castle ? null : findCastle(st.castleId);
  return c && SLOW_CASTLE.has(c.family) ? 'slow' : null; };
// 対抗形: furi=振り飛車側, ibi=居飛車側。 rook = ROOK_KIND[rookFileOf(furi)], 方針 = paceOf(ibi)（rapid→急戦 / slow→持久戦）
//         角交換 = furi の戦法に senkei タグ 'kakukoukan-furi'（要追加。現状 hand:'角' を持つのは direct-mukaibisha だけ）
// 相振り: 両者の ROOK_KIND が同じなら 相中飛車 / 相三間飛車…、違えば「三間飛車×向かい飛車」
```

| 選択（自分 × 相手） | 導出されたラベル |
|---|---|
| 棒銀 × 四間飛車 | #対抗形 #対四間飛車・急戦 |
| 山田定跡 × 四間飛車 | #対抗形 #対四間飛車・急戦 |
| 居飛車穴熊（囲い）× 四間飛車 | #対抗形 #対四間飛車・持久戦 |
| 左美濃（囲い）× 藤井システム | #対抗形 #対四間飛車・持久戦 |
| 超速▲3七銀 × ゴキゲン中飛車 | #対抗形 #対中飛車・急戦 |
| 居飛車穴熊（囲い）× 三間飛車 | #対抗形 #対三間飛車・持久戦 |
| 居飛車（2筋）× 向かい飛車 | #対抗形 #対向かい飛車（方針は未決定なので付かない） |
| 居飛車（2筋）× 九間飛車 | #対抗形 のみ（九間・一間は種類を付けない） |
| 中飛車 × 中飛車 / 三間 × 三間 | #相振り飛車 #相中飛車 / #相三間飛車 |
| 三間飛車 × 向かい飛車 | #相振り飛車 #三間飛車×向かい飛車 |

**Phase 2（SENKEI を判定の唯一の定義にする）**: `labels()` の if 連鎖をやめ、`when` を評価する関数 `Kakoi.senkei.derive(me, opp)`（新規 `js/core/senkei.js`、`matchup.threat()` と同じ純関数）に置き換える。語彙は次の6つで足りる（既存5件も同じ語彙で書ける）:

| キー | 意味 | 例 |
|---|---|---|
| `kind` | `threat().kind` の大分類 | `'taikou'`（`taikou-i`/`taikou-f` を束ねる） |
| `both` / `either` | 条件を両側／どちらか片側が満たす | `{ either: { tag: 'yokofudori' } }` |
| `tag` | 明示した戦法の `senkei[]` にある | `'kakukoukan-furi'` |
| `hand` | 戦法の `hand` に含む | `'角'` |
| `furi` / `ibi` | 振り飛車側／居飛車側の主戦法・囲いの条件 | `furi:{rook:6}`、`ibi:{pace:'rapid'}`、`ibi:{castleFamily:['anaguma','mino']}` |
| `castleFamily` | 囲いの系統（`refFamily` は除外） | `'yagura'` / `'gangi'` |

既存5件の書き換え: `kakugawari = {kind:'aiibisha', both:{hand:'角'}}`、`yokofudori = {kind:'aiibisha', either:{tag:'yokofudori'}}`、`aigakari = {kind:'aiibisha', both:{tag:'aigakari'}}`、`yagura = {kind:'aiibisha', either:{castleFamily:'yagura'}}`（両側なら表示名だけ `相矢倉`）、`gangi = {kind:'aiibisha', either:{castleFamily:'gangi'}}`。**判定の根拠は明示した層を先に**、足りなければ既定値まで含めて再判定して `implied:true`（§2-3 C と同じ規則）。優先順位は `priority` で持たせる。§4 の12件の `when` はこの語彙で書いてある。

**力戦の出し方**: 相居飛車・対抗形・相振りのどれでも、**両側が戦法を明示し、どの戦型にも当たらない**ときだけ `#力戦` を点線で出す。既定値のままでは出さない（初級者が既定状態で「力戦」と出るのは誤解を招く）。**陽動振り飛車は判定しない**（`when` を持たせず、解説専用。結果の形＝振り飛車の戦法＋矢倉囲いは、現行 compat の SIDE 判定で ng になる）。

### 3-4. UI への組み込み（現在のコードに沿って）

**現状（2026-11-01 の作業ツリー）**: 制約フィールド `js/ui/constraint-field.js` は、左端に各側の「戦型の胞」＝**居飛車/振り飛車**（`_drawStrategy`、`STR_R`、選択は `'who.strategy'`）を置き、河（両側の間）に導出ラベルの**読み取り専用ピル**を最大2枚浮かべる（`render({labels})`→`_draw` の「関係ラベル」ブロック。相手を表示しているときだけ）。クリックで右ドックに出るのは**居飛車/振り飛車の説明**（`BoardDetailView._strategy`）で、`SENKEI` は画面に出ない。左ドックの `.dk-strategy`（居飛車/振り飛車）は一覧の絞り込み。

**提案（優先順。①だけでもデータが生きる）**

1. **右ドックに戦型の解説を出す（必須）**。`BoardDetailView.render()` の分岐（`sel.kind === 'strategy' ? this._strategy(…)`）に `'senkei'` を足し、`_senkei(sel, S, p)` を新設する。構成は既存の `Sec()` 部品で: パンくず（大分類›戦型›方針）→ 定義（`desc`）→ 成立の形（`forms`）→ 歴史・流行（`history`/`trend`）→ 代表の戦法・囲いのチップ（`data-act="set"`＝既存の `onSetConstraint` をそのまま使える）→ 「この戦型の代表形にする」→ 出典。`_strategy()` の末尾の文「相手と合わせた戦型は「…」です」は、この戦型へのチップにする。選択の文法は `'who.kind[.id]'` なので `constraints.parseSel` の `SEL_RE` を `(tactic|castle|strategy|senkei)` にし、`'me.senkei.kakugawari'`（戦型は両側共通だが選択上は `me` に寄せる）で受ける。`hash-link.js` は `KIND_CHAR/KIND_LETTER` に `k:'senkei'` を足し、`decodeSel` の正規表現を `[tcsk]` にする。
2. **河のピルを押せるようにする**。`ConstraintField` の `mods` に `kind:'senkei'` のモジュール（`_layout` で位置を振り、`_syncHits`/`_applyHit` で `.cf-hit` ボタンを作る）を足し、`onSelect('me','senkei',id)`→`constraint-mode._select` が `selected` を更新して右ドックが①を開く。`labels()` が `implied:true` を返したピルは**網掛け（点線）**にして、既定の胞と同じ「暗示」の言語にそろえる。**ピルは2枚が上限**（大分類＋戦型の葉）。対抗形の方針は葉のピルに `・急戦` と連結する（`#対四間飛車・急戦`）。3枚目は河に入らない。
3. **左ドックに戦型チップ（絞り込み）を足す**。`js/ui/dock-view.js` の `.dk-strategy`（居飛車/振り飛車）の下に、`Kakoi.SENKEI` から作る1行のチップ（矢倉｜角換わり｜…｜すべて）を置き、囲い・戦法の一覧を `tactic.senkei[]` と `SENKEI.castles` で絞り込む（`this.filter[who]` と同じ「表示だけの状態」。`dock-grids.js` の一覧生成に述語を渡す）。**作者の「（敵）→戦型→囲い・戦法」の一方向依存はここで表す**: チップの候補集合は**相手の戦略から決まる**（自分が居飛車で相手が居飛車なら相居飛車の5戦型、相手が振り飛車なら対抗形の4種、相手を表示していなければ両方）。相手が居飛車↔振り飛車に変わると候補集合が入れ替わるが、すでに選んだ戦法・囲いは**自動では差し替えない**（現行の `constraints` の原則どおり、両立しなければ ✕ と直す候補が出る）。「代表形にする」だけは明示ボタンで `defaultTactic`/`defaultCastle` を両側へ入れる。**注意**: `dock-view.js` `dock-grids.js` は別セッションが作業ツリーで編集中（未コミットの差分あり）なので、この項は調整してから入れる。
4. **語の衝突を先に決める**。UI の「戦型」は現在**居飛車/振り飛車**を指す（`lookup.js` の `LAYER_JA.strategy:'戦型'`、`constraint-field.js` の `KIND_LABEL`、`dock-view.js` の aria-label「戦型の絞り込み」、dev.md「戦型は振り飛車、居飛車である」）。文献では戦型は矢倉・角換わり…を指す（Wikipedia「将棋の戦法」・shogidata.info・ALSOK）。①〜③を入れると2つの「戦型」が同居するので、**居飛車/振り飛車の層名を「構え」に改める**案を推す（`LAYER_JA.strategy`、`KIND_LABEL.strategy`、aria-label の3か所。内部の id `strategy` はそのまま）。作者が居飛車/振り飛車を「戦型」と呼びたいなら、SENKEI を「戦型（細）」とパンくずで区別する次善案でも成り立つ。
5. **やらないこと**: 戦型を制約スロットにしない（plan-unified-constraints Q5 の判断を維持。導出ラベル＋閲覧＋明示的な代表形ボタンまで）。

### 3-5. 変更ファイル・関数の一覧

| 区分 | ファイル | 関数・定数 | 変更内容 |
|---|---|---|---|
| データ | `js/data/senkei.js` | `Kakoi.SENKEI` `SENKEI_RESOLVE` | §4 の12件を追加。`SENKEI_GROUPS` を新設。拡張フィールド（§3-1）。`SENKEI_RESOLVE` を `{aiyagura:{id:'yagura',label:'相矢倉'}}` の形にすると A-2 も直る |
| データ | `js/data/tactics.js` | `senkei[]` | `kakukoukan-furi` タグを `kakukoukan-shiken` `direct-mukaibisha` `hirame-senpou` に追加。同名戦法の `desc` を短縮（§3-2） |
| データ | `js/data/sources.js` | — | 新規出典（§8） |
| コア | `js/core/constraints.js` | `labels()` `senkeiName()` `SEL_RE` `parseSel` `normalizeSelected` | §2-3 C（v2）、§3-3 の細分類、`senkei` 層の選択 |
| コア | `js/core/senkei.js`（新規） | `derive(me, opp)` `candidates(S, who)` | Phase 2。`manifest.js` の `logic` に追加 |
| コア | `js/core/lookup.js` | `findSenkei` `LAYER_JA` | 参照窓口を足す。層名の変更（§3-4-4） |
| コア | `js/core/repository.js` | コンストラクタ（`SENKEI` を受ける）`senkeiById` `tacticsOfSenkei(id)` `senkeiOfTactic(t)` | 右ドック・左ドックが共通で使う |
| コア | `js/core/board-model.js` | `deriveBoard()` | `labels` の要素に `sub`（方針）と `implied` を載せる |
| コア | `js/core/validate.js` | `all(ctx)`（l.549 付近の `used` 集計） | `SENKEI_GROUPS` の出典も数える。戦型エントリの検査を追加（`tactics`/`castles` の id 実在、`featured ⊆ senkei[]`、`desc` の `[[ref]]` が `sources` に宣言済み、`group` が実在、`parent` が実在） |
| UI | `js/ui/constraint-field.js` | `render` `_layout` `_draw`（関係ラベル）`_syncHits` `_applyHit` `KIND_LABEL` | ピルの当たり判定・点線・連結表示 |
| UI | `js/ui/board-detail-view.js` | `render` の分岐 `_senkei`（新規）`_strategy` | §3-4-1 |
| UI | `js/ui/dock-view.js` `js/ui/dock-grids.js` | `.dk-strategy` の下にチップ、`update` の絞り込み述語 | §3-4-3（作業ツリーで編集中のため調整が要る） |
| UI | `js/ui/hash-link.js` | `KIND_CHAR` `KIND_LETTER` `decodeSel` | `k` を足す |
| モード | `js/modes/constraint-mode.js` `js/modes/board-screen.js` | `_select` `_renderDetail` `_paintField` | `senkei` 層の選択、`labels` の新しい形 |
| ツール | `tools/unit-test.js` `tools/ui-check.js` | `labels` テスト群 | A-1 の各行を期待値にしたテストを追加。ピルの `.cf-hit` を巡回に足す |

## 4. 主要戦型のデータ下書き（coverage-tactics.md §1 に無いもの）

`js/data/senkei.js` の**現行フォーマット**（`name/reading/short/group/desc/forms/tactics/castles/sources`）に、§3-1 の任意フィールド（`axis` `parent` `when` `note`、側別の `tactics`/`castles`）を足した12件。大分類4件（`SENKEI_GROUPS`）つき。相居飛車の5件は既にあるので書き直さない。`desc` は常体・1文1主張・文末に `[[ref]]`（そのエントリの `sources` に宣言済みのものだけ）。

**自己検証の結果**: ① `tactics`/`castles` の id がすべて `tactics.js`/`castles-*.js` に実在、② `desc` の `[[ref]]` がすべて `sources` に宣言済みで、出典 id が `sources.js` か §8 の新規出典のどちらかに存在、を `node` で確認。さらにコピー上で `senkei.js` に追記し §8 の新規出典を `sources.js` に足して `tools/validate-castles.js` を実行 → **エラー0**（警告は §2-3 C のとおり1件増えるだけ）。`when` はまだ評価器が無いので、Phase 1 の間は `labels()` へのハードコードで同じ意味になる（§3-3）。

| id | 名前 | 大分類・軸 | 優先度 | モデル適合度 | 備考 |
|---|---|---|---|---|---|
| `taikou-shiken` | 対四間飛車 | 対抗形・rook | A | ◎ | 2020年代の「先手四間→居飛車後手急戦／後手四間→居飛車先手持久戦」の区分を載せた [wj-shikenbisha] |
| `taikou-sanken` | 対三間飛車 | 対抗形・rook | A | ◎ | 「先手三間飛車に急戦なし」 |
| `taikou-naka` | 対中飛車 | 対抗形・rook | A | ◎ | 5筋の飛車の分類揺れを注記 |
| `taikou-mukai` | 対向かい飛車 | 対抗形・rook | B | ◎ | 居飛車側の具体的な定跡名は未確認のため desc では一般論に留めた |
| `kyusen` | 急戦 | 対抗形・approach | A | ○ | 判定は `pace:'rapid'` という代理指標。desc に「境界に明確な基準はない」 |
| `jikyusen` | 持久戦 | 対抗形・approach | A | ○ | 判定は `pace:'slow'` または囲いの系統（穴熊・美濃系） |
| `kakukoukan-furi` | 角交換振り飛車 | 対抗形・style | B | ○ | 判定に `senkei` タグの追加が要る（§3-5）。相振りにも現れる |
| `aifuri` | 相振り飛車 | 相振り飛車 | A | ◎ | 強弱の整理「中飛車＜四間飛車＜三間飛車＜向かい飛車」を載せた |
| `ai-naka` | 相中飛車 | 相振り飛車 | C | ◎ | プロ棋戦ではまれ |
| `ai-sanken` | 相三間飛車 | 相振り飛車 | B | ◎ | 2010年代に角道を止めない相三間が増えた |
| `rikisen` | 力戦 | 力戦 | B | ○ | 受け皿。明示した層だけで判定 |
| `youdou-furi` | 陽動振り飛車 | 力戦 | C | △ | 手順依存。解説専用で `when` なし |

```js
// 戦型データ下書き（coverage-tactics.md §1 / js/data/senkei.js の現行フォーマットを踏襲し、任意の拡張フィールドを足す）
// 拡張（すべて任意）: parent / axis / when / note、tactics・castles は配列または { ibisha:[..], furibisha:[..] }
window.Kakoi = window.Kakoi || {};
Kakoi.SENKEI_GROUPS = {
  aiibisha: {
    name: '相居飛車', short: '相居', kinds: ['aiibisha'],
    desc: '双方が居飛車の対局。飛車と角の使い方、相手の飛車先の受け方で矢倉・角換わり・相掛かり・横歩取りに分かれる[[wj-senpou]]。近年は雁木も独立した戦型として扱われる[[alsok-column3]]。',
    sources: [{ ref: 'wj-senpou', for: '分類' }, { ref: 'alsok-column3', for: '分類' }],
  },
  taikou: {
    name: '対抗形', short: '対抗', kinds: ['taikou-i', 'taikou-f'],
    desc: '一方が居飛車、他方が振り飛車の対局[[wj-shogi-yogo]]。振り飛車の飛車の筋（中飛車・四間飛車・三間飛車・向かい飛車）で分類し、居飛車側の対応は速攻の急戦と固い囲いを組む持久戦に大別される[[wj-senpou]]。',
    sources: [{ ref: 'wj-shogi-yogo', for: '定義' }, { ref: 'wj-senpou', for: '分類' }],
  },
  aifuri: {
    name: '相振り飛車', short: '相振', kinds: ['aifuri'],
    desc: '双方が振り飛車の対局[[wj-senpou]]。従来は限定的な戦型とされたが、近年は居飛車党の棋士も指すようになった[[wj-senpou]]。',
    sources: [{ ref: 'wj-senpou', for: '分類' }],
  },
  rikisen: {
    name: '力戦', short: '力戦', kinds: [],
    desc: '定跡形から著しく外れた将棋[[wj-shogi-yogo]]。どの戦型にも当たらない進行の受け皿で、積極的な戦型としては定義されない[[wj-senpou]]。',
    sources: [{ ref: 'wj-shogi-yogo', for: '定義' }, { ref: 'wj-senpou', for: '分類' }],
  },
};

Kakoi.SENKEI_DRAFT = {
  // ---------- 対抗形：振り飛車の種類（axis: rook） ----------
  'taikou-shiken': {
    name: '対四間飛車', reading: 'たいしけんびしゃ', short: '対四間',
    group: 'taikou', axis: 'rook',
    desc: '振り飛車側が飛車を6筋（後手なら4筋）に振る対抗形[[wj-shikenbisha]]。居飛車側は居飛車舟囲い急戦などの急戦と、左美濃・居飛車穴熊などの持久戦に分かれる[[wj-shikenbisha]]。2020年代に入ると、「先手四間飛車には居飛車後手急戦、後手四間飛車には居飛車先手持久戦」という区分も見られるようになった[[wj-shikenbisha]]。',
    forms: '居飛車は飛車を2筋に置いたまま、振り飛車は飛車を6筋へ振る（先手の場合）',
    tactics: { furibisha: ['shikenbisha', 'fujiisystem', 'kakukoukan-shiken'], ibisha: ['gin46-hidari', 'yamada-jouseki', 'saginomiya', 'bougin', 'migishiken'] },
    castles: { furibisha: ['mino', 'takamino', 'gincan'], ibisha: ['funa57gin', 'funa68gin', 'hidarimino', 'anaguma'] },
    when: { kind: 'taikou', furi: { rook: 6 } },
    sources: [{ ref: 'wj-shikenbisha', for: '解説' }, { ref: 'wj-senpou', for: '分類' }],
  },
  'taikou-sanken': {
    name: '対三間飛車', reading: 'たいさんげんびしゃ', short: '対三間',
    group: 'taikou', axis: 'rook',
    desc: '振り飛車側が飛車を7筋（後手なら3筋）に振る対抗形[[wj-sankenbisha]]。「先手三間飛車に急戦なし」の格言がある[[wj-sankenbisha]]。居飛車側は石田流対策を含む急戦や、居飛車穴熊などの持久戦を選ぶ[[wj-senpou|wj-sankenbisha]]。',
    forms: '居飛車は飛車を2筋に置いたまま、振り飛車は飛車を7筋へ振る（先手の場合）。角道を開けて7五歩を突くと石田流になる',
    tactics: { furibisha: ['sankenbisha', 'ishida', 'hayaisida', 'masuda-ishida', 'shin-ishida', 'tomahawk', 'nakata-xp'], ibisha: ['boukin', 'bougin'] },
    castles: { furibisha: ['mino', 'takamino', 'gincan', 'furianaguma'], ibisha: ['funa', 'anaguma'] },
    when: { kind: 'taikou', furi: { rook: 7 } },
    sources: [{ ref: 'wj-sankenbisha', for: '解説' }, { ref: 'wj-senpou', for: '分類' }],
  },
  'taikou-naka': {
    name: '対中飛車', reading: 'たいなかびしゃ', short: '対中',
    group: 'taikou', axis: 'rook',
    desc: '振り飛車側が飛車を5筋に振る対抗形[[wj-nakabisha]]。ゴキゲン中飛車が広まると、居飛車側に超速▲3七銀・丸山ワクチン・▲5八金右超急戦などの対策が積み重ねられた[[wj-gokigen|wj-chousoku37gin]]。5筋の飛車は振り飛車に分類されることが多いが、居飛車に分類される場合もある[[wj-senpou]]。',
    forms: '居飛車は飛車を2筋に置いたまま、振り飛車は飛車を5筋へ振る',
    tactics: { furibisha: ['nakabisha', 'gokigen', 'tsunogin-nakabisha', 'gosuji-kuraidori', 'kazaguruma', 'hirame-senpou'], ibisha: ['chousoku37gin'] },
    castles: { furibisha: ['katamino', 'mino'], ibisha: ['funa68gin'] },
    when: { kind: 'taikou', furi: { rook: 5 } },
    sources: [{ ref: 'wj-nakabisha', for: '解説' }, { ref: 'wj-gokigen', for: '対策' }, { ref: 'wj-chousoku37gin', for: '対策' }, { ref: 'wj-senpou', for: '分類' }],
  },
  'taikou-mukai': {
    name: '対向かい飛車', reading: 'たいむかいびしゃ', short: '対向',
    group: 'taikou', axis: 'rook',
    desc: '振り飛車側が飛車を8筋（後手なら2筋）に振り、居飛車の飛車先と向かい合う対抗形[[wj-mukaibisha]]。飛車交換を迫る逆襲が骨子で、攻撃力は振り飛車の中で最も高いとされる[[wj-mukaibisha|we-ranging-rook]]。角道を止めても居飛車穴熊と互角以上に戦えるとされ、居飛車側は急戦と持久戦に分かれる[[wj-mukaibisha|wj-senpou]]。',
    forms: '居飛車は飛車を2筋に置いたまま、振り飛車は飛車を8筋へ振る（互いの飛車先が向き合う）',
    tactics: { furibisha: ['mukaibisha', 'direct-mukaibisha'], ibisha: [] },
    castles: { furibisha: ['mino', 'katamino', 'furianaguma'], ibisha: ['anaguma'] },
    when: { kind: 'taikou', furi: { rook: 8 } },
    sources: [{ ref: 'wj-mukaibisha', for: '解説' }, { ref: 'we-ranging-rook', for: '解説' }, { ref: 'wj-senpou', for: '分類' }],
  },
  // ---------- 対抗形：居飛車側の方針（axis: approach）と振り飛車側の型（axis: style） ----------
  'kyusen': {
    name: '急戦', reading: 'きゅうせん', short: '急戦',
    group: 'taikou', axis: 'approach',
    desc: '守りに手数をかけず、早い段階から戦いを起こす作戦[[wj-shogi-yogo]]。居飛車側では居飛車舟囲い急戦（山田定跡など）が代表で、振り飛車側にも藤井システムや向かい飛車の急戦などがある[[wj-kyusen]]。相手が守りを固める前に攻められる利点がある一方、自分の囲いも固くならず短手数で終わることが多い[[wj-kyusen]]。持久戦との間に明確な基準はない[[wj-kyusen]]。',
    forms: '舟囲いのまま銀や飛車を繰り出して早く仕掛ける（居飛車舟囲い急戦。山田定跡など）',
    tactics: { ibisha: ['gin46-hidari', 'yamada-jouseki', 'saginomiya', 'shigofu-hayajikake', 'chousoku37gin', 'torisashi', 'bougin', 'migishiken'] },
    castles: { ibisha: ['funa', 'funa57gin', 'funa68gin'] },
    when: { kind: 'taikou', ibi: { pace: 'rapid' } },
    sources: [{ ref: 'wj-shogi-yogo', for: '定義' }, { ref: 'wj-kyusen', for: '解説' }],
  },
  'jikyusen': {
    name: '持久戦', reading: 'じきゅうせん', short: '持久',
    group: 'taikou', axis: 'approach',
    desc: 'お互いにすぐには攻めず、長い中盤戦が続く戦型[[wj-shogi-yogo]]。居飛車側の持久戦は、左美濃や居飛車穴熊など固い囲いを組んでから戦う形が代表[[wj-shikenbisha|wj-senpou]]。位取り・ミレニアム・飯島流引き角・地下鉄飛車なども持久戦用に挙げられる[[wj-senpou]]。',
    forms: '穴熊・左美濃などの固い囲いを完成させてから仕掛ける',
    tactics: { ibisha: ['iijima-hikikaku', 'gyokutou-kuraidori', 'ibisha-gosuji-kuraidori', 'chikatetsubisya'] },
    castles: { ibisha: ['anaguma', 'hidarimino', 'millennium', 'big4'] },
    when: { kind: 'taikou', ibi: { pace: 'slow', castleFamily: ['anaguma', 'mino'] } },
    sources: [{ ref: 'wj-shogi-yogo', for: '定義' }, { ref: 'wj-shikenbisha', for: '例' }, { ref: 'wj-senpou', for: '分類' }],
  },
  'kakukoukan-furi': {
    name: '角交換振り飛車', reading: 'かくこうかんふりびしゃ', short: '角交換',
    group: 'taikou', axis: 'style',
    desc: '振り飛車側が角道を止めず、または自分から角交換を行ったうえで駒組みを進める戦型[[wj-kakukoukan-furibisha]]。居飛車穴熊の台頭で振り飛車の勝率が下がり、藤井システムで盛り返したあと、ゴキゲン中飛車が「角道を止めずに攻める感覚」を生んだことが背景とされる[[wj-kakukoukan-furibisha]]。2017年の第58期王位戦で菅井竜也が菅井流角交換三間飛車を用いて初タイトルを獲得した、と同記事は記す[[wj-kakukoukan-furibisha]]。',
    forms: '振り飛車側の角道が開いたまま（または角交換後）に飛車を振る。飛車の筋とは別の軸',
    tactics: { furibisha: ['kakukoukan-shiken', 'direct-mukaibisha', 'hirame-senpou'] },
    castles: { furibisha: ['mino', 'katamino'] },
    when: { kind: 'taikou', tag: 'kakukoukan-furi' },
    note: '飛車の筋（axis: rook）とは直交する軸。Wikipedia は各振り飛車の「角交換型」、shogidata.info と shougi.jp は飛車の筋と並ぶ独立項目として扱う。相振り飛車にも現れる（Wikipedia 相振り飛車に「角交換相振り飛車の出現」の節）[[wj-aifuribisha]]。',
    sources: [{ ref: 'wj-kakukoukan-furibisha', for: '解説' }, { ref: 'sj-kakukoukan-furibisya', for: '解説' }, { ref: 'wj-aifuribisha', for: '関連' }],
  },
  // ---------- 相振り飛車 ----------
  'aifuri': {
    name: '相振り飛車', reading: 'あいふりびしゃ', short: '相振',
    group: 'aifuri',
    desc: '双方が振り飛車にする戦型[[wj-aifuribisha]]。従来は振り飛車党どうしなどの限定的な戦型だったが、近年は居飛車党の棋士も指すようになった[[wj-senpou]]。囲いは金無双・美濃・右矢倉・穴熊があり、相手の出方を見てから決めるのが基本とされる[[wj-aifuribisha]]。振り飛車の種類の強弱は「中飛車＜四間飛車＜三間飛車＜向かい飛車」と整理され、後手の向かい飛車は先手の振り飛車にとって強敵とされる[[wj-aifuribisha]]。',
    forms: '双方が飛車を2筋から他の筋へ振る。囲いは相手の出方を見てから決める',
    tactics: ['mukaibisha', 'sankenbisha', 'nakabisha', 'shikenbisha', 'kyukenbisha'],
    castles: ['kinmusou', 'migiyagura', 'mino', 'takamino', 'furianaguma'],
    when: { kind: 'aifuri' },
    sources: [{ ref: 'wj-aifuribisha', for: '解説' }, { ref: 'wj-senpou', for: '分類' }],
  },
  'ai-naka': {
    name: '相中飛車', reading: 'あいなかびしゃ', short: '相中',
    group: 'aifuri', parent: 'aifuri',
    desc: '両者が飛車を5筋に振る相振り飛車[[wj-aifuribisha]]。攻め口が少なく千日手になりやすいため、プロ棋戦ではまれで、アマチュア向けの色合いが強いとされる[[wj-aifuribisha]]。相美濃の囲いが中心で、角交換型や三間飛車への変化などがある[[wj-aifuribisha]]。',
    forms: '双方が飛車を5筋に振る',
    tactics: ['nakabisha'],
    castles: ['mino', 'katamino'],
    when: { kind: 'aifuri', both: { rook: 5 } },
    sources: [{ ref: 'wj-aifuribisha', for: '解説' }],
  },
  'ai-sanken': {
    name: '相三間飛車', reading: 'あいさんげんびしゃ', short: '相三間',
    group: 'aifuri', parent: 'aifuri',
    desc: '両者が飛車を7筋（後手は3筋）に振る相振り飛車[[wj-aifuribisha]]。2010年代から、角道を止めない相三間飛車が多く指されるようになった[[wj-aifuribisha]]。三間飛車には美濃囲いが相性がよいとされる[[wj-aifuribisha]]。',
    forms: '双方が飛車を三間（先手7筋・後手3筋）に振る',
    tactics: ['sankenbisha', 'ishida'],
    castles: ['mino', 'takamino'],
    when: { kind: 'aifuri', both: { rook: 7 } },
    sources: [{ ref: 'wj-aifuribisha', for: '解説' }],
  },
  // ---------- 力戦・転換 ----------
  'rikisen': {
    name: '力戦', reading: 'りきせん', short: '力戦',
    group: 'rikisen',
    desc: '定跡形から著しく外れた将棋[[wj-shogi-yogo]]。通常の戦型の分類に当てはまらない進行を見せる将棋を「力戦型」と呼ぶ[[wj-senpou]]。「力戦」の語は『史記』馮唐伝の用例に結びつけて説明される[[wj-rikisen]]。',
    forms: '相居飛車・対抗形・相振り飛車のどの戦型にも当たらない',
    tactics: [], castles: [],
    when: { kind: 'any', none: true },
    note: '本アプリでは「明示した戦法・囲いの組み合わせが、どの戦型にも当たらない」ときの受け皿。既定値だけの状態や、判定の根拠が足りないときは出さない。',
    sources: [{ ref: 'wj-shogi-yogo', for: '定義' }, { ref: 'wj-senpou', for: '分類' }, { ref: 'wj-rikisen', for: '語源' }],
  },
  'youdou-furi': {
    name: '陽動振り飛車', reading: 'ようどうふりびしゃ', short: '陽動',
    group: 'rikisen',
    desc: '相居飛車の出だしから、相手の出方を見て飛車を振る作戦[[wj-youdou-furibisha]]。広義には相居飛車模様から一方が振り飛車に転じる作戦の総称、狭義には相矢倉の出だしから主に後手が用いる作戦を指し、命名者は加藤治郎とされる[[wj-youdou-furibisha]]。相手が矢倉に囲うのを見届けてから振る狙いがあったが、矢倉の駒組みから居飛車穴熊にも組めるため効果は薄れ、現在はあまり指されない[[wj-youdou-furibisha]]。',
    forms: '居飛車の駒組みから途中で飛車を振る（途中経過を含む手順依存の戦型）',
    tactics: [], castles: ['yagura'],
    note: 'モデル適合△。盤は1局面なので「転換」は表せず、結果の形（振り飛車の戦法＋矢倉囲い）は囲いの side 不一致（compat の SIDE）で ng になる。解説専用エントリにとどめ、判定（when）は持たせない。',
    sources: [{ ref: 'wj-youdou-furibisha', for: '解説' }],
  },
};
```

**書かなかったもの（理由）**: 対向かい飛車の居飛車側の具体的な定跡名と、相向かい飛車（矢倉戦になりやすいという記述のみ確認）は、出典で内容を確かめていないため空にした。`aifuri` の desc に載せた「公式戦の採用数 2000年度65局→2010年度151局」は要約経由の数値なので desc には入れず、§6・§7 でのみ【要約経由】と明記して使う。


## 5. コラム題材リスト

20本。戦型・戦法・囲いの歴史と流行の変遷を中心に、**このリポジトリの収録済み id と結べるもの**だけを選んだ。出典は〔 〕内の id（§8 が新規、それ以外は既存の `sources.js`）。

- **優先**: A=戦型の核／アプリの軸（敵→戦型→囲い・戦法）に直結 B=流行史・中級者向け C=周辺
- **確認度**: ◎=本書で記事を取得して確認（Wikipedia は取得ツールの要約経由を含む。年代・数字の細部は掲載前に原文で再確認を推奨）／○=既存の `quality-*.md` が Wikipedia に照合済みで、本書では再取得せず引用（q-c=quality-castles.md、q-f=quality-tactics-furibisha.md、q-i=quality-tactics-ibisha.md）

| # | 題材 | 関連 id | 要点（3つ） | 出典 | 確認度・優先 |
|---|---|---|---|---|---|
| 1 | 矢倉は終わったのか（2013〜2019） | 戦型 `yagura`／囲い `yagura` `katayagura` `bonanza`／戦法 `yagura37gin` `waki-system` `yonenaga-kyusen` | ①先手矢倉が最後に勝ち越したのは2013年度で、以後は対局数・先手勝率が下がった<br>②2015年度に矢倉左美濃急戦が登場し、5手目は2017年度に▲6六歩から▲7七銀へ逆転。2017年に増田康宏が「矢倉は終わりました」と発言<br>③2019年度に復活（矢倉の対局数193→348局、先手勝率.410→.523。早めの▲2五歩が6割超） | 〔mynavi-yagura2019〕〔wj-yagura〕 | ◎ A（§6 に本文） |
| 2 | 雁木、三つの意味を生きた戦法 | 戦型 `gangi`／囲い `gangi` `tsunogin`／戦法 `gangi-ibisha` `gangi-hikikaku` | ①本来の雁木は17世紀の檜垣是安が考案した対振り飛車の引き角戦法<br>②昭和戦前に二枚銀の囲いを雁木と呼ぶようになり、木村義雄は「木村不敗の陣」と呼んだ<br>③2010年代後半に左銀6七の新型が復権。プロの雁木志向の序盤は2017年以降に急増（2017年12月は相居飛車77局中14局） | 〔wj-gangi〕〔arakippe-2018-01〕 | ◎ A |
| 3 | 居飛車穴熊の時代と藤井システム（振り飛車の三十年） | 囲い `anaguma` `furianaguma`／戦法 `fujiisystem` `kakukoukan-shiken` `gokigen`／戦型 `taikou-shiken` | ①居飛車穴熊は田中寅彦が体系化し昭和50年代頃から流行（それ以前は評価が低かった）<br>②1990年代後半に藤井猛が藤井システムを確立。角道を止める四間飛車の対局数は2001年度の636局がピーク。『将棋世界』2007年9月号の「衝撃の新手新戦法ベスト10」で第1位<br>③居飛車穴熊で振り飛車の勝率が下がり、藤井システムで盛り返し、ゴキゲン中飛車が「角道を止めずに攻める感覚」を生んだ | 〔wj-ibisha-anaguma〕〔wj-anaguma〕〔wj-shikenbisha〕〔wj-fujiisystem〕〔wj-kakukoukan-furibisha〕 | ◎＋○（q-c, q-f） A（§6 に本文） |
| 4 | ゴキゲン中飛車と超速▲3七銀：新戦法が対策を生むまで | 戦法 `gokigen` `chousoku37gin` `nakabisha`／戦型 `taikou-naka`／囲い `funa68gin` | ①近藤正和が升田式石田流と5筋位取り中飛車を元に開発。名付け親は『将棋世界』編集長の大崎善生。2002年度升田幸三賞<br>②対策は丸山ワクチン・▲5八金右超急戦・超速▲3七銀など層が厚い<br>③超速▲3七銀は当時奨励会三段の星野良生が開発し2004年ごろ現れ、2010年度の升田幸三賞。2019年の人気ランキングは1位ゴキゲン中飛車・2位藤井システム・3位居飛車穴熊 | 〔wj-gokigen〕〔wj-chousoku37gin〕〔wj-senpou〕 | ○（q-f, q-i）＋◎ A |
| 5 | 角換わりの四十年：木村定跡から持将棋定跡まで | 戦型 `kakugawari`／戦法 `kakugawari` `koshikakegin` `itteson-kakugawari`／囲い `bonanza` | ①昭和30年代の木村定跡→1992年度の丸山新手で先手必勝と考えられ先後同型が一時消える→2001〜02年度に佐藤康光・羽生善治が復活させる<br>②2016年の第65回NHK杯決勝で千田翔太の新型同型が注目。2022年の電竜戦で水匠の先手必勝研究が話題（2024年には後手勝ちの定跡も）<br>③2022年から伊藤匠が持将棋定跡を披露（升田幸三賞、将棋流行語大賞2024第6位）【要約経由】 | 〔wj-kakugawari〕〔alsok-column3〕 | ◎（細部は要原文確認） A（§6 に本文） |
| 6 | 相掛かりの復活：江戸から藤井聡太、第74期王座戦まで | 戦型 `aigakari`／戦法 `aigakari` `tsukada-special` `hineribisha`／囲い `nakazumai` | ①江戸時代から指され、戦前に隆盛、戦後に急速に衰退（腰掛け銀・棒銀・横歩取り・矢倉が台頭）<br>②2018年後半以降は相居飛車で角換わりに次ぐ対局数、2021年度はタイトル戦で最多の戦型<br>③藤井聡太は2021年度に先手の主軸を角換わり腰掛け銀から相掛かりへ切り替え、先手相掛かり17勝2敗。2026年9月の第74期王座戦第1局も相掛かり | 〔wj-aigakari〕〔number-fujii2021〕〔kifulog-ouza74-1〕 | ◎ A（§6 に本文） |
| 7 | 横歩取りはなぜ減ったのか | 戦型 `yokofudori`／戦法 `yokofudori` `aonoryu` `yuukiryu`／囲い `nakahara` | ①「横歩三年の患い」の格言に反し、昭和5年ごろ木村義雄が通説に挑んで先手が取る考えが一般化<br>②1997年に中座真が△8五飛戦法を披露（後手の勝率が一時約7割）。平成22年に松尾歩が5二玉型で再興し、2014年6月時点で公式戦600局以上<br>③2020年度は採用がほとんどない時期。相居飛車内の割合は2017年12月の15/77局（19.5%）から2023年1〜3月の22/277局（7.9%）へ、2026年は全局比3.2% | 〔wj-yokofudori〕〔arakippe-2018-01〕〔arakippe-2023-spring〕〔shogidata-senkei〕 | ◎ B |
| 8 | 戦型を選ぶのは誰か（先手と後手の選択権） | 戦型 `kakugawari` `aigakari` `yagura`（先手に委ねる）／`yokofudori` `gangi`（後手が決める） | ①後手が戦型を決められる＝横歩取り・雁木・一手損角換わり、先手に委ねる＝矢倉・相掛かり・角換わり<br>②後手番で委ねる側を選ぶ棋士が多く、決める側はスペシャリストの戦略（筆者の見解）<br>③第72期王将戦（2023年）では羽生善治が決める側、藤井聡太が委ねる側で、6局の戦型が割れた | 〔alsok-column3〕 | ◎ A（§6 に本文。作者の「敵→戦型」の依存と同じ構造） |
| 9 | 一手損角換わり：手を損して何を得るか | 戦法 `itteson-kakugawari` `hayakurigin`／戦型 `kakugawari` | ①後手が早い段階で角を交換し、一手を指さない形<br>②もとは冗談扱いの戦法が、プロの公式戦でも多く見られるようになった<br>③2008年度に後手の勝率が5割を超え（2013年時点では4割前半）、先手側の課題は早繰り銀とされる | 〔wj-kakugawari〕〔wj-senpou〕〔alsok-column3〕 | ◎（要約経由） B |
| 10 | 相振り飛車：限定的な戦型から居飛車党も指す戦型へ | 戦型 `aifuri` `ai-naka` `ai-sanken`／囲い `kinmusou` `migiyagura`／戦法 `mukaibisha` `sankenbisha` | ①古くは1605年の大橋宗桂対本因坊算砂戦に例があり、1998年の竜王戦（谷川浩司対藤井猛）で登場して採用が増えた<br>②囲いは金無双が代表だったが、2000年代に居飛車党の参入で右矢倉が主流に。戸辺流の登場で後手三間飛車穴熊も<br>③2010年代は角道を止めない相三間飛車が多い。公式戦の採用数は2000年度65局→2010年度151局【要約経由】 | 〔wj-aifuribisha〕 | ◎（要約経由） B |
| 11 | 四間飛車の三十年 | 戦法 `shikenbisha` `fujiisystem` `kakukoukan-shiken`／囲い `mino` `furianaguma`／戦型 `taikou-shiken` | ①1990年代前半に小林健二の「スーパー四間飛車」で復活。2001年度の636局をピークに下降し、2007年度の採用率は15.8%<br>②2010年に広瀬章人が四間飛車穴熊を連採して王位を奪取（184局中64局）。2012年頃に藤井猛の角交換四間飛車<br>③2020年以降は「先手四間飛車には居飛車後手急戦、後手四間飛車には居飛車先手持久戦」。2026年の直近500局でも四間飛車は12.8%で振り飛車最多 | 〔wj-shikenbisha〕〔shogidata-senkei〕 | ◎ B |
| 12 | 振り飛車はなぜ角を交換し始めたか | 戦型 `kakukoukan-furi`／戦法 `kakukoukan-shiken` `direct-mukaibisha` `hirame-senpou` | ①背景は居飛車穴熊の台頭→藤井システムで盛り返し→ゴキゲン中飛車で「角道を止めずに攻める感覚」<br>②3三角戦法は2008年度に136局で後手が82勝。2017年の第58期王位戦で菅井竜也が菅井流角交換三間飛車で初タイトル（同記事の記述）<br>③2026年の直近500局で角交換振り飛車6.0%、向かい飛車0.8% | 〔wj-kakukoukan-furibisha〕〔shogidata-senkei〕 | ◎ B |
| 13 | 陽動振り飛車：居飛車党が振る日 | 戦型 `youdou-furi`／囲い `yagura` | ①命名は加藤治郎。昭和30年前後に大山康晴と升田幸三が「雲隠れ玉」の発想で振り飛車に転じた<br>②1991年9月の竜王戦（先手真部一男、後手大山康晴）で後手の△2二飛の転換から42手で後手勝ち<br>③居飛車穴熊の普及で効果が薄れ、現在はあまり指されない | 〔wj-youdou-furibisha〕 | ◎（要約経由） C |
| 14 | 力戦とは何か | 戦型 `rikisen` | ①「定跡形から著しく外れた将棋」<br>②「通常の戦型の分類に当てはまらない進行」を力戦型と呼ぶ<br>③語は『史記』馮唐伝の用例に結びつけて説明され、相振り飛車や角交換振り飛車が例に挙がる | 〔wj-shogi-yogo〕〔wj-senpou〕〔wj-rikisen〕 | ◎ B |
| 15 | 戦型・戦法・囲い・定跡は何が違うのか | 全体（戦型／戦法／囲い）。手筋は `tesuji.js` | ①戦型＝対局の展開をパターン化し分類したもの（序盤の駒の配置と手順による）<br>②戦法＝各戦型での攻め方・受け方。戦型は大駒（飛車・角）の位置などで大別する<br>③定跡＝序盤の駒組・主要局面で、過去の対局や検討から最善とされる指し方 | 〔wj-shogi-yogo〕〔wj-senpou〕 | ◎ A（作者の「戦型、戦法、囲い、手筋、定石」の階層の入口） |
| 16 | 将棋ソフトが運んだ囲い：Bonanza・elmo・ツノ銀雁木 | 囲い `bonanza` `elmo` `tsunogin` | ①ボナンザ囲いは将棋ソフト「Bonanza」Ver.2が多用したことから名付けられた片矢倉系で、角換わりなど角を交換した将棋で使われる<br>②elmo囲いはソフト「elmo」が多用して広まった。7九の金が銀とつながるのが要<br>③ツノ銀雁木は2017年ごろソフトの影響で再流行。矢倉の衰退の背景にも、玉の堅さよりバランスを重く見る流れがある | 〔wj-bonanza〕〔sj-bonanza〕〔wj-elmo〕〔mynavi-elmo〕〔wj-gangi〕〔wj-yagura〕 | ○（既存の囲いデータの記述を引用） A |
| 17 | 升田幸三賞でたどる新戦法の年表 | 囲い `millennium` `nakahara`／戦法 `gokigen` `chousoku37gin` `kakukoukan-shiken` `tateishi` `ureshino` `iijima-hikikaku` | ①ミレニアム囲い（三浦弘行）は2001年度、ゴキゲン中飛車（近藤正和）は2002年度<br>②立石流は2004年（第31回）の特別賞、超速▲3七銀は2010年度（第38回）、角交換四間飛車は2013年度<br>③耀龍四間飛車（大橋貴洸）は第48回、嬉野流の嬉野宏明は2023年の第50回（アマチュアの受賞は立石勝己以来2人目） | 〔wj-millennium〕〔wj-gokigen〕〔wj-tateishi〕〔wj-chousoku37gin〕〔wj-kakukoukan-shiken〕〔wj-shikenbisha〕〔wj-ureshinoryu〕 | ○（q-c, q-f, q-i。本書では再取得せず） B |
| 18 | 名前の由来で読む囲いと戦法 | 囲い `funa` `gangi` `kikusui` `kimuramino`／戦法 `gokigen` `onigoroshi` `suzumezashi` | ①舟囲いの名は1955年『将棋世界』の読者募集で決まり、玉が船に乗る見た目に由来<br>②雁木は雁の群れが斜めに飛ぶ姿に由来し、雪よけの「雁木造」説は誤解とされる。ゴキゲンの名付け親は大崎善生<br>③鬼殺しは大正末の本の売り文句「鬼も逃げ出す」に由来、菊水矢倉は楠木正成の家紋に由来、木村美濃は1947年の駒組名称募集で命名 | 〔wj-funagakoi〕〔wj-gangi〕〔wj-gokigen〕〔wj-onigoroshi〕〔wj-kikusui〕〔wj-kimuramino〕 | ○（q-c, q-f, q-i） B |
| 19 | 戦型の「いま」を数字で読む（2026年） | 戦型（全部） | ①直近500局（2026-07-24〜）は相居飛車62.6%（相掛かり17.8・角換わり14.0・相矢倉4.4・横歩取り3.2・その他23.2）、振り飛車36.6%（四間12.8・三間9.4・中6.2・角交換6.0・相振り1.4・向かい0.8）<br>②ソフト同士（floodgate、R3800以上）では角換わりの出現率が2019年16.5%→2022年29.2%、相掛かりが4.9%→15.1%<br>③2023年1〜3月のプロ公式戦（相居飛車277局）は相掛かり25.3%・角換わり24.0%・矢倉13.6%・雁木11.9%・横歩取り7.9% | 〔shogidata-senkei〕〔yamaoka-floodgate〕〔arakippe-2023-spring〕 | ◎ A（可視化の素材。§7） |
| 20 | 急戦と持久戦：境界のない二分法 | 戦型 `kyusen` `jikyusen`／戦法 `bougin` `yamada-jouseki` `iijima-hikikaku` | ①急戦＝守りに手数をかけず早い段階から戦いを起こす、持久戦＝すぐには攻めず長い中盤戦が続く<br>②両者の間に明確な基準はなく、急戦は短手数で終わることが多い<br>③居飛車側の持久戦は左美濃・居飛車穴熊が代表。2020年代の対四間飛車では先後で急戦と持久戦を選び分ける | 〔wj-shogi-yogo〕〔wj-kyusen〕〔wj-shikenbisha〕 | ◎ A（アプリの `pace` 軸の説明） |

## 6. コラム本文素案 上位5本

<!-- TODO:sec6 -->

## 7. 統計データの所在

<!-- TODO:sec7 -->

## 8. 新規出典の一覧

<!-- TODO:sec8 -->
