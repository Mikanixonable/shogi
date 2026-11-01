# 戦型の体系化と読み物（コラム）企画

作成日: 2026-11-01 / 担当: 調査 cov-senkei / **状態: 完了**（2026-11-02 に最終確認）
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
| A1 | ja Wikipedia「将棋の戦法」の分類 | 確認済（要約経由）→ §2-1 |
| A2 | shougi.jp「将棋の戦法一覧」の分類 | 確認済 → §2-1 |
| A3 | shogidata.info の戦型分類（ホーム・ランキング） | 確認済 → §2-1, §7 |
| A4 | 棋士成績DB の戦型分類 | 確認済（藤井聡太のページの範囲）→ §2-1 |
| A5 | ALSOK 将棋コラム第3回（相居飛車6戦型） | 確認済 → §2-1, §6-5 |
| A6 | ABEMA TIMES 入門記事 / Arakippe / Wikibooks | 確認済 → §2-1 |
| A7 | 対抗形の細分類（急戦/持久戦×振り飛車の種類） | 済（Wikipedia 四間飛車・中飛車・急戦・将棋用語一覧）→ §2-2, §4 |
| A8 | 相振り飛車の細分類 | 済（Wikipedia 相振り飛車）→ §4 |
| A9 | 力戦・陽動振り飛車・角交換振り飛車 | 済（Wikipedia 各記事）→ §4 |
| A10 | 英語圏の分類（Wikipedia/Shogi Harbour 等） | **未調査**（改訂後の担当範囲外。英語版は既存の `we-*` 出典がある） |
| B1 | 現行コード（`labels()` / `constraint-field.js` / `board-detail-view.js` ほか）の読解と実行検証 | 済 → §2-3, §3 |
| B2 | 戦型データ下書き12件 | 済（`node` で id・出典を検証、コピー上で `validate-castles.js` エラー0）→ §4 |
| C1 | コラム題材20本 | 済 → §5 |
| C2 | 本文素案 上位5本 | 済 → §6 |
| C3 | 公開統計の所在 | 済（未取得の手がかりは §7-1 に明記）→ §7 |

---

## 1. 要約

**この文書の位置づけ**: `coverage-tactics.md` §1 の相居飛車5件の戦型データ（`senkei.js`）を土台に、**まだ無い部分**（対抗形の細分類・相振り飛車・力戦・角交換振り飛車・陽動振り飛車）と、現行 `labels()` の誤判定、UI への出し方、読み物の企画をまとめた。成果は §2〜§8、確認したのは 2026-11-01（最終確認 11-02）。

#### 主要な提案（5つ）

1. **戦型は「3段の階層＋対抗形の3本の直交軸」で持つ**（§2-2）。大分類（相居飛車・対抗形・相振り飛車・力戦）は `matchup.threat().kind` から導出済みで、中分類が `SENKEI`、小分類が戦法（`senkei[]` タグ）。対抗形は「振り飛車の種類（対四間・対三間・対中・対向かい）」×「居飛車の方針（急戦・持久戦）」×「振り飛車の型（角交換振り飛車）」の軸で表し、組み合わせの爆発を避ける。出典は雁木・一手損角換わり・対抗形の数え方・角交換振り飛車・力戦で食い違う（§2-1）ので、それぞれ理由つきで判断した。
2. **`SENKEI` は既存5件を変えずに広げる**（§3-1）。任意フィールド（`parent` `axis` `when` `decidedBy` `defaultTactic` `trend` など）と `SENKEI_GROUPS` を足し、下書き**12件**（対四間・対三間・対中・対向かい・急戦・持久戦・角交換振り飛車・相振り飛車・相中・相三間・力戦・陽動振り飛車）を §4 に置いた。id・出典は検証済み。
3. **戦型データと同名の戦法エントリの重複は役割で分ける**（§3-2）。戦型＝何であるか・歴史・流行・判定条件、戦法＝盤・`pace`・`pairings`・図のキャプション、所属の正は戦法側の `senkei[]` タグ。実測で、タグはあるのに `SENKEI.*.tactics` に無い戦法が `kakugawari` 4件・`aigakari` 6件・`yagura` 7件あった。
4. **UI は右ドックの戦型解説が最優先**（§3-4）。`SENKEI` は現状どの画面にも出ていない（`grep senkei js/ui js/modes` は0件）。順に ①右ドック `_senkei` ②河のピルをクリック可能に（2枚上限・暗示は点線）③左ドックに戦型チップ（候補は**相手の戦略から決まる**＝作者の「（敵）→戦型→囲い・戦法」。自動での差し替えはしない）。UI の「戦型」が居飛車/振り飛車を指す語の衝突があり、層名を「構え」に改める案を添えた。
5. **読み物**: 題材20本（§5）、本文素案5本（矢倉・穴熊と藤井システム・角換わり・相掛かり・戦型の選択権。各約900〜1,100字。§6）、公開統計の所在と使える数値（§7）。

#### すぐ直すべき判定の問題（§2-3。コードを実行して再現・修正案も検証済み）

- **A-1 既定値（implied）の囲いが戦型ラベルを決める**。囲い未選択だと既定の矢倉が規則3で先に当たり、**相掛かり×相掛かり→#矢倉、横歩取り×居飛車→#矢倉、ひねり飛車×ひねり飛車→#雁木、雁木戦法×雁木戦法→#矢倉、角換わり×棒銀→#矢倉**など、戦法が示す戦型が打ち消される。修正案 v2（明示した層を先に・戦法タグの交差・横歩取りは片側で成立）は 20 ケースで期待どおりになり、既存の `labels` ユニットテスト10件は PASS のまま。
- **A-2 相矢倉と矢倉が同じ表示**（commit 4d9f244 の回帰。`senkeiName('aiyagura')` が「矢倉」を返す）。1行で戻せる。
- 判定の穴（B）: 使われないタグ（`kakugawari` `yagura` `gangi`）、角換わりが `hand:'角'` 頼み、雁木×矢倉は「矢倉」になる、一手損角換わりと横歩取りの後手側が表せない、対抗形・相振りに細分類が無い。

#### 未解決の懸念・要確認

- **Wikipedia の内容の多くは取得ツールの要約経由**。年表の細部（持将棋定跡の年が「2022年〜」と「2024年」で食い違う、相掛かりの「約百年」の記述、相振り飛車の採用局数など）は掲載前に原文で再確認する。要約で食い違った箇所は本文に採らなかった（§6 の各「素案の注」）。
- 統計サイトの `shogidata.info` と棋士成績DB は**運営者・判定方法・利用条件の記載が無い**。再配布・加工の前に確認する（§7）。2011年度の戦型別集計の論文は取得が 503 で未確認。
- 設計判断が要る点: 旧型の二枚銀雁木（`gangi` 囲い）を雁木戦の根拠にするか（§2-3 B-3）、居飛車/振り飛車の層名を「構え」に改めるか（§3-4-4）、角交換振り飛車・陽動振り飛車を力戦に含めるか（§2-2 の 3。`group` の書き換えだけで変えられる）。`dock-view.js` `dock-grids.js` は別セッションが作業ツリーで編集中なので、左ドックの変更は調整が要る。
- 英語圏の戦型分類（A10）は未調査。


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
| **Wikibooks「将棋の戦法一覧」**<br>`wikibooks-senpou`（新規）<br>要約経由 | 居飛車の戦法 / 振り飛車の戦法 / その他 | 居飛車＝矢倉・相掛かり・角換わり・対振り飛車（急戦・持久戦・引き角戦・端角）／振り飛車＝角交換振り飛車・中・三間・四間・向かい・相振り・振り飛車穴熊／その他＝右四間・雁木・袖飛車・筋違い角・奇襲・嬉野流・英春流 | 「相居飛車」「対抗型」の語が無く、取得内容に**横歩取りの項が無い**。更新の有無は未確認で、**重みは低い**（参考のみ）|

**出典間で食い違う点（ここが設計の分かれ目）**
1. **雁木の置き場所**: Wikipedia＝矢倉戦の変化型／ALSOK・shogidata.info（ランキング）・ABEMA・Arakippe＝独立戦型／shougi.jp 一覧＝戦法一覧に無い。→ 本アプリは**独立戦型にする**のが現状の実務（統計・解説とも独立扱い）に合う。
2. **一手損角換わり**: Wikipedia＝角換わりの下／棋士成績DB・ALSOK・Arakippe＝別項目／shogidata.info＝別項目なし。→ **角換わりの小分類**にして、統計用には切り出せるようにする。
3. **対抗形の数え方**: 振り飛車の種類で数える（shogidata.info）／居飛車側の対策で数える（棋士成績DB・shougi.jp「対振り飛車向け」）／急戦・持久戦で割る（Wikipedia）。→ 3つは**直交する軸**なので、1局面を（振り飛車の種類，居飛車側の方針）の2成分で表すのが最も情報を落とさない（§2-2）。
4. **角交換振り飛車**: Wikipedia＝各振り飛車の「角交換型」（飛車の筋の下位）／shogidata.info・shougi.jp＝飛車の筋と同格の独立項目。→ **飛車の筋とは直交する「角交換の有無」軸**として持つ（§2-2）。
5. **力戦**: Wikipedia＝「その他」で定義は消極的／shogidata.info＝「居飛車(力戦)」という受け皿／棋士成績DB＝相居飛車力戦。→ **どの条件にも当たらないときの受け皿**として「力戦」を置くのが共通。積極的な戦型としては定義しない。

### 2-2. 本書が提案する階層

3段（大分類→中分類→小分類）と、対抗形の中だけに現れる3つの軸（振り飛車の種類・居飛車の方針・振り飛車の型。互いに直交）で表す。**大分類は両者の戦略から機械的に決まり（実装済み: `matchup.threat().kind`）、中分類が `SENKEI` のエントリ、小分類が戦法（`tactics.js`）**。作者の「戦型→囲い・戦法」の順序と同じで、囲いは戦型ごとに代表を挙げる（`castles`）。

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
| `decidedBy` | `'gote'` / `'sente'` | 「誰が戦型を決められるか」。ALSOK の整理は、後手が決める＝横歩取り・雁木・一手損角換わり、先手に委ねる＝矢倉・相掛かり・角換わり [alsok-column3]。左ドックの戦型チップに印を付け、作者の「（敵）→戦型」の依存を読み物（§6-5）と結ぶ材料になる。コラムは筆者個人の見解なので、`desc` には「〜とされる」と断る |
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

宣言的に判定規則を書く発想には先行例がある。JSR の `@shogi/classifier`（SFEN/KIF から戦型や囲いを判定する OSS）は、囲いの規則を `pieces`（必須の配置。AND）・`hand`（持ち駒条件。AND）・`tesuuMax`・`symmetric`（先後反転）で宣言的に記述する [jsr-shogi-classifier]。本アプリの `when` は盤の駒ではなく**戦法・囲いの選択**を入力にする点が違うが、「規則をデータに寄せる」方向は同じ。組み込みの戦型の一覧・階層はそのページからは確認できていない。

**力戦の出し方**: 相居飛車・対抗形・相振りのどれでも、**両側が戦法を明示し、どの戦型にも当たらない**ときだけ `#力戦` を点線で出す。既定値のままでは出さない（初級者が既定状態で「力戦」と出るのは誤解を招く）。**陽動振り飛車は判定しない**（`when` を持たせず、解説専用。結果の形＝振り飛車の戦法＋矢倉囲いは、現行 compat の SIDE 判定で ng になる）。

### 3-4. UI への組み込み（現在のコードに沿って）

**現状（2026-11-01 の作業ツリー）**: 制約フィールド `js/ui/constraint-field.js` は、左端に各側の「戦型の胞」＝**居飛車/振り飛車**（`_drawStrategy`、`STR_R`、選択は `'who.strategy'`）を置き、河（両側の間）に導出ラベルの**読み取り専用ピル**を最大2枚浮かべる（`render({labels})`→`_draw` の「関係ラベル」ブロック。相手を表示しているときだけ）。クリックで右ドックに出るのは**居飛車/振り飛車の説明**（`BoardDetailView._strategy`）で、`SENKEI` は画面に出ない。左ドックの `.dk-strategy`（居飛車/振り飛車）は一覧の絞り込み。

**提案（優先順。①だけでもデータが生きる）**

1. **右ドックに戦型の解説を出す（必須）**。`BoardDetailView.render()` の分岐（`sel.kind === 'strategy' ? this._strategy(…)`）に `'senkei'` を足し、`_senkei(sel, S, p)` を新設する。構成は既存の `Sec()` 部品で: パンくず（大分類›戦型›方針）→ 定義（`desc`）→ 成立の形（`forms`）→ 歴史・流行（`history`/`trend`）→ 代表の戦法・囲いのチップ（`data-act="set"`＝既存の `onSetConstraint` をそのまま使える）→ 「この戦型の代表形にする」→ 出典。`_strategy()` の末尾の文「相手と合わせた戦型は「…」です」は、この戦型へのチップにする。選択の文法は `'who.kind[.id]'` なので `constraints.parseSel` の `SEL_RE` を `(tactic|castle|strategy|senkei)` にし、`'me.senkei.kakugawari'`（戦型は両側共通だが選択上は `me` に寄せる）で受ける。`hash-link.js` は `KIND_CHAR/KIND_LETTER` に `k:'senkei'` を足し、`decodeSel` の正規表現を `[tcsk]` にする。
2. **河のピルを押せるようにする**。`ConstraintField` の `mods` に `kind:'senkei'` のモジュール（`_layout` で位置を振り、`_syncHits`/`_applyHit` で `.cf-hit` ボタンを作る）を足し、`onSelect('me','senkei',id)`→`constraint-mode._select` が `selected` を更新して右ドックが①を開く。`labels()` が `implied:true` を返したピルは**網掛け（点線）**にして、既定の胞と同じ「暗示」の言語にそろえる。**ピルは2枚が上限**（大分類＋戦型の葉）。対抗形の方針は葉のピルに `・急戦` と連結する（`#対四間飛車・急戦`）。3枚目は河に入らない。
3. **左ドックに戦型チップ（絞り込み）を足す**。`js/ui/dock-view.js` の `.dk-strategy`（居飛車/振り飛車）の下に、`Kakoi.SENKEI` から作る1行のチップ（矢倉｜角換わり｜…｜すべて）を置き、囲い・戦法の一覧を `tactic.senkei[]` と `SENKEI.castles` で絞り込む（`this.filter[who]` と同じ「表示だけの状態」。`dock-grids.js` の一覧生成に述語を渡す）。**作者の「（敵）→戦型→囲い・戦法」の一方向依存はここで表す**: チップの候補集合は**相手の戦略から決まる**（自分が居飛車で相手が居飛車なら相居飛車の5戦型、相手が振り飛車なら対抗形の4種、相手を表示していなければ両方）。相手が居飛車↔振り飛車に変わると候補集合が入れ替わるが、すでに選んだ戦法・囲いは**自動では差し替えない**（現行の `constraints` の原則どおり、両立しなければ ✕ と直す候補が出る）。「代表形にする」だけは明示ボタンで `defaultTactic`/`defaultCastle` を両側へ入れる。狭い画面では `_relocate()` が `.dk-strategy` を「並べ方」の行へ移すので、チップも同じ移動に含める。**注意**: `dock-view.js` `dock-grids.js` は別セッションが作業ツリーで編集中（未コミットの差分あり）なので、この項は調整してから入れる。
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

**自己検証の結果**: ① `tactics`/`castles` の id がすべて `tactics.js`/`castles-*.js` に実在、② `desc` の `[[ref]]` がすべて `sources` に宣言済みで、出典 id が `sources.js` か §8 の新規出典のどちらかに存在、を `node` で確認。さらにコピー上で `senkei.js` に追記し、下書きが使う新規出典7件（`wj-senpou` `wj-aifuribisha` `wj-youdou-furibisha` `wj-kakukoukan-furibisha` `wj-kyusen` `wj-rikisen` `alsok-column3`）を `sources.js` に足して `tools/validate-castles.js` を実行 → **エラー0**（警告は §2-3 C のとおり1件増えるだけ）。`when` はまだ評価器が無いので、Phase 1 の間は `labels()` へのハードコードで同じ意味になる（§3-3）。

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

上位5本（#1 矢倉・#3 穴熊と藤井システム・#5 角換わり・#6 相掛かり・#8 戦型の選択権）。各800〜1500字、常体。**段落末の `[[ref]]` がその段落の出典**（既存の `sources.js` の id か、§8 の新規出典）。確認できた事実だけを書き、解釈は「〜と読める」と断る。年代・棋士名は取得した記事に書かれているものだけ。本文には「アプリへの誘導」の一文を最後に置いた（不要なら削る）。見出し番号は §5 の表の番号と無関係（§6 内の通し番号）。

### 6-1. 矢倉は終わったのか（2013〜2019）

矢倉は、互いに金銀で玉を囲って戦う相居飛車の代表戦型で、相掛かり・角換わり・横歩取りと並ぶ「四大戦法」の一つとされてきた[[wj-yagura]]。その先手矢倉が、2010年代に大きく数を減らした。

節目は2013年度だ。先手矢倉が最後に勝ち越したのがこの年度で、以後は対局数も先手の勝率も下降した[[mynavi-yagura2019]]。2015年度には後手の対策「矢倉左美濃急戦」が登場し、先手の5手目は▲6六歩から▲7七銀へ移っていく。2017年度には採用数で▲7七銀型が▲6六歩型を逆転した[[mynavi-yagura2019]]。同じ2017年には、増田康宏が「矢倉は終わりました」と発言したと、Wikipedia は記す。背景には、コンピュータ将棋の影響で、玉の堅さよりバランスが重んじられるようになったことがある。プロの最前線では、互いに矢倉に組む相矢倉はほとんど見られなくなった[[wj-yagura]]。

ところが2019年度に、先手矢倉は復活する。マイナビの記事は、その要因を二つ挙げる。一つは、矢倉左美濃急戦への対策として5手目を▲6六歩から▲7七銀に改めたこと。もう一つは、早めに▲2五歩と突いて後手の角道を閉ざし、速攻を封じたことだ。早めの▲2五歩は2013年度には1局もなく、2014・2015年度に屋敷伸之九段が計14局指しただけだったが、2019年度には採用率が6割を超えた。矢倉の対局数は2018年度の193局から348局へ増え、先手の勝率も.410から.523へ上がった[[mynavi-yagura2019]]。

復活した矢倉は、昔のままではない。Wikipedia は、2020年代初頭の矢倉は相掛かりの一類型ともいえる戦いに変わったと述べる[[wj-yagura]]。相居飛車に占める矢倉の割合は、2017年12月が8局/77局（約10%）、2023年1〜3月が37局/277局（約13〜14%）で、標本が小さく傾向までは言えないが、消えてはいない[[arakippe-2018-01|arakippe-2023-spring]]。2026年10月31日時点の直近500局（7月24日以降）では、相矢倉は全局の4.4%（相居飛車の中では約7%の計算）で、相掛かりの17.8%や角換わりの14.0%には及ばない[[shogidata-senkei]]。

矢倉は「終わった」のか「復活した」のか。数字は、そのどちらとも言い切れない場所に落ち着いている。

本アプリでは、戦型「矢倉」に、囲い「矢倉囲い」「片矢倉」「ボナンザ囲い」、戦法「矢倉3七銀」「脇システム」「米長流急戦矢倉」を並べて確かめられる。

**素案の注（確認度）**: ① 数値・年度は マイナビの記事（`mynavi-yagura2019`）の本文で確認。同記事の表1・表2は画像のため、5手目の採用数の実数は未確認。② 増田康宏の発言・「相掛かりの一類型」は Wikipedia「矢倉囲い」（取得ツールの要約経由。末尾3,599字は未読）。③ マイナビは「矢倉左美濃急戦」、Wikipedia は「居角左美濃急戦」と書く。同じ作戦を指すとみられるが同一視は確認していないので、本文はマイナビの表記に統一した。④ 割合の比較は標本が異なる（Arakippe は相居飛車の局数が分母、shogidata.info は全局が分母）ため、本文では「傾向までは言えない」と断った。また Arakippe 2023年春季号の矢倉の率（13.6%）は局数÷277（13.4%）と0.2ポイントずれる（記事内の不一致。本文は「約13〜14%」とした）。

### 6-2. 居飛車穴熊の時代と藤井システム ― 振り飛車の三十年

居飛車穴熊は、9九に玉を入れ、香・銀・金で隅を固める居飛車の囲いだ。王手がかかりにくく、終盤で「ゼット」（絶対に詰まない形）になりやすい[[wj-ibisha-anaguma|sj-ibiana]]。いまでこそ定番だが、かつては「穴熊などやるようでは強くなれない」と低く見られていた。田中寅彦九段が体系化し、昭和50年代ごろから流行したとされる[[wj-ibisha-anaguma|wj-anaguma]]。

この穴熊が、振り飛車を追い詰めた。角交換振り飛車の記事は、居飛車穴熊の台頭で振り飛車の勝率が下がったと記す[[wj-kakukoukan-furibisha]]。反撃の切り札が、1990年代後半に藤井猛が確立した藤井システムだった。相手が穴熊を目指せば完成前に仕掛け、急戦に出れば囲いの堅さで優位に立つ、攻めと守りの両方に対応した設計で、『将棋世界』2007年9月号の「現役棋士が選ぶ衝撃の新手新戦法ベスト10」では第1位に選ばれている[[wj-fujiisystem]]。角道を止める四間飛車の対局数も、平成7年度に対左美濃・対居飛車穴熊の藤井システムが登場して増え、2001年度の636局でピークに達した[[wj-shikenbisha]]。

そこから下り坂になる。居飛車側の対策が進み、他の振り飛車や居飛車へ移る四間飛車党が増えたためだ。四間飛車の採用率は2007年度に15.8%まで下がり、2008年には藤井猛自身が居飛車志向になって「矢倉党に転向」と評された。背景には、ゴキゲン中飛車の流行と居飛車側の研究の進展があるとされる[[wj-shikenbisha]]。

振り飛車は、形を変えて生き残る。2010年には広瀬章人が四間飛車穴熊を連続で採用して王位を奪い、この年は184局中64局が四間飛車穴熊だったという。2012年ごろには藤井猛を中心に角交換四間飛車が指されるようになる[[wj-shikenbisha]]。角交換四間飛車は、もとは大学将棋界で指されていたものを藤井が居飛車穴熊対策に採って広まり、2013年度の升田幸三賞を受けた[[wj-kakukoukan-shiken]]。ゴキゲン中飛車が「角道を止めずに攻める感覚」を生んだことが、この流れの背景とされる[[wj-kakukoukan-furibisha]]。

2020年代の四間飛車では、「先手四間飛車には居飛車後手急戦、後手四間飛車には居飛車先手持久戦」という区分が見られるようになった[[wj-shikenbisha]]。2026年10月31日時点の直近500局（7月24日以降）を見ると、振り飛車が絡む対局は全体の36.6%。内訳は四間飛車12.8%、三間飛車9.4%、中飛車6.2%、角交換振り飛車6.0%、相振り飛車1.4%、向かい飛車0.8%で、四間飛車が最多だ[[shogidata-senkei]]。穴熊に追い詰められた振り飛車は、いまも全局の3分の1強で指されている。

本アプリでは、戦法「藤井システム」「角交換四間飛車」「ゴキゲン中飛車」と、囲い「居飛車穴熊」「振り飛車穴熊」を並べて、攻め筋と堅さの関係を確かめられる。

**素案の注（確認度）**: ① 居飛車穴熊の歴史（田中寅彦・昭和50年代ごろ）と藤井システムの『将棋世界』2007年9月号第1位、角交換四間飛車の経緯は `quality-castles.md` / `quality-tactics-furibisha.md` が Wikipedia に照合済みの記述を引用（本書では再取得していない）。② 四間飛車の年度・局数・採用率は Wikipedia「四間飛車」の歴史節（取得ツールの要約経由。同記事は「平成末から令和での内容記載」を求める加筆依頼つき）。③ 2026年の割合は `shogidata.info` のホーム（直近500局。日々変わるので掲載時は日付を再確認）。④ 「穴熊に追い詰められた」は筆者の言い回しで、記事の引用ではない。⑤ 「184局中64局」の184局がどの範囲の局数か（四間飛車の全局か、角道を止める四間飛車か）は要約から特定できなかったので、本文は母集団を断定しない書き方にした。

### 6-3. 角換わりの四十年 ― 木村定跡から持将棋定跡まで

角換わりは、序盤で角を交換してから駒組みを進める相居飛車の戦法だ。相矢倉より激しく、相掛かりより穏やかとされる。右銀の使い方で、棒銀や早繰り銀の急戦と、腰掛け銀や右玉の持久戦に分かれる[[wj-kakugawari]]。

歴史は昭和30年代の木村定跡にさかのぼる。木村義雄が、40手目前後で手詰まりになる局面の攻めに結論を出し、のちに木村定跡と呼ばれた。昭和60年代には谷川浩司が5手目▲7八金（飛車先保留）を見つけて戦型が見直され、1992年度には丸山忠久が米長邦雄との対局で丸山新手（▲1一角）を指した。先手必勝と考えられて先後同型は一時姿を消したが、2001〜2002年度に佐藤康光が新手で対抗し、羽生善治が王位戦で用いて勝ったことで復活した[[wj-kakugawari]]。

2000年代には、後手が早く角を交換する一手損角換わりが現れ、2008年度には後手の勝率が5割を超えた。2010年代後半には、後手の△6二金・△8一飛型が主流になる。2016年の第65回NHK杯決勝で千田翔太が採った形が「新型同型」として注目された[[wj-kakugawari]]。

やがて「先手必勝」が現実味を帯びる。2022年、電竜戦で将棋ソフト水匠が優勝し、腰掛け銀の特定の局面で先手が優勢とする研究が話題になった。ただ、NHKの番組では棋士の見解が分かれていることも紹介され、2024年の電竜戦では水匠が後手番の氷彗に敗れ、2025年の研究では後手勝ちの定跡も見つかったという[[wj-kakugawari]]。ALSOKの将棋コラムは、「先手角換わり必勝説」が正しければ、後手は戦型を先手に委ねる選び方（矢倉・相掛かり・角換わり）が減り、自分で戦型を決める選び方（横歩取り・雁木・一手損角換わり）が増えると予想した（2023年10月執筆）[[alsok-column3]]。

この流れのなかで、伊藤匠が持将棋定跡を披露した。入玉による持将棋で引き分けを狙い、先後を替えて指し直しを目指す戦術で、AIが27点法で判断するのに対しプロは24点法を採る、という違いを利用するものだ。升田幸三賞を受賞し、将棋流行語大賞2024でも第6位に入った[[wj-kakugawari]]。

数字で今を見ておく。2023年1〜3月のプロ公式戦（相居飛車277局）で、角換わりは67局（24.0%）。前回の集計の32.0%から下がった[[arakippe-2023-spring]]。ソフト同士の対局（floodgate、R3800以上）では、単に「角換わり」と判定された対局の出現率が、2019年の16.5%から2022年の29.2%へ上がっている[[yamaoka-floodgate]]。2026年10月31日時点の直近500局では14.0%で、名前のある戦型のなかでは相掛かり（17.8%）に次ぐ[[shogidata-senkei]]。

本アプリでは、戦型「角換わり」に、戦法「角換わり」「腰掛け銀」「一手損角換わり」と囲い「ボナンザ囲い」を重ねて、角を持ち合う形を確かめられる。

**素案の注（確認度）**: ① 角換わりの定義・歴史・近年の流行はすべて Wikipedia「角換わり」（取得ツールの要約経由。年表の細部は掲載前に原文で再確認する）。要約内で持将棋定跡の年が「2022年〜」と「2024年」で食い違っていたため、**本文では年を書かなかった**【年は要確認】。② 水匠・氷彗・電竜戦の勝敗は同記事の記述で、一次の対局記録は未確認。③ floodgate の数字は TadaoYamaoka 氏の記事（Mizar 氏の JSON 定義による分類）で、早繰り銀などの派生は別行になるため、本文は「単に角換わりと判定された対局」の出現率と断った。ソフト同士の対局であり、人間のプロ棋戦の傾向ではない。④ Arakippe の「前回」がどの期間かは記事から特定できていない。

### 6-4. 相掛かりの復活 ― 江戸の棋書から第74期王座戦まで

相掛かりは、互いに飛車先の歩を進めていく相居飛車の戦型だ。角換わりより激しく、横歩取りより穏やかとされる。当初は角道を止めずに駒組みを進める戦型をすべて相掛かりと呼んだが、のちに角換わりと横歩取りが独立し、現在はそれらを除くものを相掛かりと呼ぶ[[wj-aigakari]]。

歴史は古い。江戸時代から指され、大橋宗英『平手相懸定跡集』などの棋書に記されている。戦前に最盛期を迎えたが、終戦を境に急速に衰え、腰掛け銀・棒銀・横歩取り・矢倉が台頭した。それでも1985年度には、▲2六飛型が340局指され、矢倉の290局と並ぶ花形だった[[wj-aigakari]]。

本格的な復活は2010年代後半だ。コンピュータ将棋の発展で定跡が大きく進み、AlphaZeroが相掛かりを採用したことも記事に挙がる。2018年後半以降は、相居飛車で角換わりに次ぐ対局数になった。先手は浮き飛車の駒組みが増え、後手は相手の形に合わせる指し方が主流になる。2020年代に入ると、飛車先の歩を即座に交換せず様子を見る指し方が主流になり、2021年度にはタイトル戦で最も多く採用された戦型になった[[wj-aigakari]]。

その象徴が藤井聡太だ。Number Web は、藤井が先手の主軸戦法を2021年度に角換わり腰掛け銀から相掛かりへ切り替え、先手の相掛かりで17勝2敗（タイトル戦では6勝1敗）だったと伝える。理由として記事は、相掛かりは序盤から選択肢が広く、角換わり腰掛け銀ほど終盤まで定跡化されていないため、藤井の持ち味が出やすいと分析している[[number-fujii2021]]。

2026年9月2日の第74期王座戦五番勝負第1局も、相掛かりになった。中継ブログは、両対局者がともに先手番で主に用いる戦型だと紹介する。20手目までは、先日の王位戦七番勝負第4局（伊藤匠二冠対藤井聡太王位）を含む複数の前例があり、21手目の▲2四歩から新しい形に進んだ[[kifulog-ouza74-1]]。

数字でも勢いは分かる。プロの公式戦で、相居飛車に占める相掛かりは、2017年12月の7局/77局（約9%）から、2023年1〜3月の70局/277局（25.3%）に増えた[[arakippe-2018-01|arakippe-2023-spring]]。ソフト同士の対局（floodgate、R3800以上）でも、単に「相掛かり」と判定された対局が2019年の4.9%から2022年の15.1%に増えている[[yamaoka-floodgate]]。2026年10月31日時点の直近500局では17.8%で、名前のついた戦型では振り飛車の各戦型を含めても最も多い（「相居飛車（その他）」の23.2%は分類の受け皿）[[shogidata-senkei]]。

本アプリでは、戦型「相掛かり」に、戦法「相掛かり」「ひねり飛車」「塚田スペシャル」と囲い「中住まい」を重ねて確かめられる。

**素案の注（確認度）**: ① 相掛かりの定義・歴史・近年の流行は Wikipedia「相掛かり」（取得ツールの要約経由）。要約には「江戸末期に開発され終戦直前まで約百年流行」という別の記述もあったが、「江戸時代から指された」との整合が取れないため**本文には採らなかった**【要確認】。飛車先の交換割合の数値（▲2四歩9割超→▲3八銀8割超）も意味が曖昧なので採らなかった。② 藤井聡太の2021年度の成績は Number Web（2022-04-21。当時の肩書は竜王。本文では肩書を付けていない）。③ 第74期王座戦は日本将棋連盟の王座戦中継ブログ（2026-09-02）。片方の対局者は記事中で「広瀬九段」とだけ読め、もう一方の氏名は取得内容から確認できていないので書かなかった。④ Arakippe の7局/77局は2017年12月の単月、70局/277局は2023年1〜3月の四半期で、期間の長さが違う点に注意。

### 6-5. 戦型を選ぶのは誰か ― 先手と後手の選択権

相居飛車の戦型は、誰が決めるのか。ALSOK将棋コラムの第3回は、後手が主導権を持つと見る。後手には二つの選び方がある。(A) 自分で戦型を決める。(B) 決定権を先手に与える。筆者はこれを、相居飛車の代表6戦型に当てはめた[[alsok-column3]]。

(A)に当たるのは、横歩取り・雁木・一手損角換わり。後手が1つの戦法を深く研究すればよいので、理にかなって見える。ただし、どれにも先手側の有力な対策がある。横歩取りには青野流、雁木には早繰り銀・腰掛け銀・矢倉などの幅広い対策、一手損角換わりには早繰り銀が挙がる。(B)に当たるのは、矢倉・相掛かり・角換わり。こちらは先手が3通りのどれを選ぶか分からないので、後手は3つすべてに備えなければならない。(B)にも懸念材料は多いが、(A)に比べれば受け入れやすい、というのが筆者の見方だ[[alsok-column3]]。

公式戦は持ち時間が長く、棋力も高いので、相手のミスは期待しにくく、わずかな差が勝敗を分ける。そのため後手番では(B)が多く選ばれ、(A)は「スペシャリスト」と呼ばれる一部の棋士の戦略だと筆者は考える。藤井聡太、渡辺明、豊島将之、永瀬拓矢は、後手番で(B)を選ぶ印象だという[[alsok-column3]]。

好例が、第72期ALSOK杯王将戦だ。羽生善治は後手番の3局で一手損角換わり・雁木・横歩取りと、すべて(A)の戦型を選んだ。藤井聡太は後手番の3局で相掛かり・角換わり・角換わりと、すべて(B)だった。両者の戦略は真逆で、結果は藤井の4勝2敗。記事は、羽生が未開拓の「テーマ図」を示し、藤井がそれを深く突き詰めた構図だと指摘する。第三局で藤井が指した2六飛は、対雁木の形として定着したのではないか、とも書く[[alsok-column3]]。

この見方は、同じコラムが予想するように、研究の進み方で変わる。(B)で先手の有力な作戦が見つかれば、傾向は(A)へ寄る。「先手角換わり必勝説」が正しければ、(B)が減って(A)が増える、という予想だ。ただし同コラムは筆者個人の見解で、2023年10月の執筆である[[alsok-column3]]。

参考に、Arakippe の2023年1〜3月の集計（相居飛車277局）をこの分け方に当てはめると、(A)に当たる横歩取り・雁木・一手損角換わりは計80局（約29%）、(B)に当たる矢倉・相掛かり・角換わりは計174局（約63%）になる。筆者の計算で、集計は手番を区別しないため、実際に後手が決めた局数とは限らない[[arakippe-2023-spring]]。

本アプリで相手の表示をONにし、相手の戦法に「横歩取り」「雁木戦法」「一手損角換わり」を置くと、後手が戦型を決めにいく形を試せる。

**素案の注（確認度）**: ① 全文が ALSOK 将棋コラム第3回（`alsok-column3`）の記述に基づく。同コラムは執筆者名の記載がなく「筆者」の個人的見解と明記され、執筆時期は2023年10月。(A)(B) の呼び名と「課題の有無」の表はコラムのもの。② 第72期王将戦の局別の戦型・勝者はコラム内の表（6局）で確認し、「4勝2敗」は表の勝者から数えた。**第72期の開催年はコラムの取得内容から確認できていない**ので本文では年を書かなかった（第73期の前の期という位置づけからの推定は可能）。③ 棋士の姓名のうち、コラムの記載は肩書つきの姓だけ。名は `number-fujii2021` の記述と通称から補った。④ 最後の数値は Arakippe（`arakippe-2023-spring`）の局数を足した筆者の計算で、雁木は一方の意思で持ち込める戦型のため`wj-gangi`、手番ごとの内訳は分からない。



## 7. 統計データの所在

**使う前の注意**: 出典ごとに**分母（相居飛車だけ／全局）・期間（単月／四半期／直近500局）・分類（§2-1）・対象棋戦**が違う。グラフは**出典ごとに分けて描く**か、相居飛車内の割合に直して「目安」と明記する。`SENKEI.trend` には `{y, n, of, ref}`（件数・分母・出典）の形で入れ、出典ごとの系列として保つ。Wikipedia の数値は事実の引用だが出典表示（CC BY-SA）が要る。ブログ・個人サイトのデータは**引用に留め、再配布しない**（利用条件の記載を確認できたものは無い）。

#### 7-1. 所在（2026-11-01 に確認した範囲）

| # | 名称・URL | 内容 | 粒度・期間 | 分類 | 状況 |
|---|---|---|---|---|---|
| 1 | **あらきっぺの将棋ブログ「最新戦法の事情」**<br>カテゴリ: https://arakippe.com/archives/category/%e6%9c%80%e6%96%b0%e6%88%a6%e6%b3%95%e3%81%ae%e4%ba%8b%e6%83%85 （93記事＝居飛車編47・振り飛車編46） | 男性棋戦のプロ公式戦を定期集計した戦型別の局数・出現率（表）。分類基準の明文化なし | 居飛車編は少なくとも2017年12月分（2018-01-01公開）〜2023年春季号（2023-04-30公開、集計2023-01〜03）。振り飛車編は2021-09〜2023春季号（2023-03-31）の一覧を確認（それ以前は未確認）。月次→隔月→合併号→四半期と粒度が変わる | 角換わり／矢倉／相掛かり／雁木／横歩取り／その他（一手損角換わりを含む。内訳あり） | 本文を取得したのは2記事（2018-01・2023春季号）。居飛車編の一覧URL: `…/latest-tactics-lengthwise-rook201801.html`（2018-01）、`…/latest-tactics-lengthwise-rook.html`（2018-02）、`…/static-rook-201806.html`、`…/static-rook-202005-06.html`、`…/static-rook-202007-08.html`、`…/static-rook-202101.html`、`…/static-rook-202109.html` 〜 `…/static-rook-2023-spring.html`（`202110` `202111-12` `202201` `202202-03` `202204-05` `202206-07` `202208-09-10` `202211-202301` を挟む）。振り飛車編は `…/ranging-rook-202109.html` 〜 `…/ranging-rook-2023-spring.html`。**振り飛車編の本文・2018年中盤〜2020年の欠落の有無は未確認** |
| 2 | **shogidata.info「戦型統計」**<br>https://shogidata.info/ （ホーム）<br>https://shogidata.info/list/strategyrank.html<br>https://shogidata.info/list/strategylist_junni.html | ホーム: 直近500局の戦型採用率（相居飛車／振り飛車の内訳）。ランキング: 戦型別の棋士の採用率TOP5。早見表: 居飛車党・オールラウンダー・振り飛車党と居飛車/振り飛車の採用率（順位戦クラス別） | 最新のスナップショットのみ（更新日 2026-10-31）。ホームは「2026-07-24 から最新まで」の500局、ランキングは過去2年・10局以上の棋士。**時系列は無い**ので、使うなら定期的に自前で保存する | ホーム: 相矢倉／角換わり／横歩取り／相掛かり／相居飛車(その他)／中飛車／四間／三間／向かい／角交換振り飛車／相振り。ランキング: 雁木・居飛車(力戦)・対振り飛車が加わる | ホームとランキング2ページを取得。女流版（`strategylist_woman.html` `strategyrank_woman.html`）はURLのみ確認。**運営者・データの出所・判定方法・利用条件の記載なし**【要確認】 |
| 3 | **棋士成績DB**<br>http://shogirsltdb.cloudfree.jp/person3.php?name=594 （藤井聡太の戦型別成績） | 棋士ごとの戦型別成績（対局・勝敗・勝率、先手番・後手番別、持将棋・千日手） | 通算。「年度別」へのリンクあり（検索結果に `persony.php?name=627&je=2024` 〔伊藤匠 2024年度〕があるが未取得） | 矢倉／角換わり／相掛かり／横歩取り／一手損角換わり／四間・三間・中・向飛車(居飛車側)／相居飛車力戦／戦型不明 | 1ページのみ取得（要約経由）。運営者・更新日の記載なし |
| 4 | **TadaoYamaoka「floodgateの戦型別先手勝率の変化」**<br>https://tadaoyamaoka.hatenablog.com/entry/2022/12/28/185035 | **ソフト同士**（floodgate、R3800以上）の年別上位10戦型の回数・出現率・先手勝率・後手勝率・引分率（2019〜2022）と、第3回電竜戦A級の角換わり・相掛かり | 年別（2019〜2022） | Mizar 氏の JSON 定義ファイル（`sylwi.mzr.jp`）。**定義の中身は未取得**【要確認】。複合タグ（例: `角換わり,後手早繰り銀`）で別行になる | 記事全体を取得。数値は 7-2 表3 |
| 5 | **マイナビニュース（将棋情報局）2020-05-28**<br>https://news.mynavi.jp/article/20200528-1044684/ | 先手矢倉の年度別の対局数・先手勝率、5手目の変遷、早めの▲2五歩の局数 | 年度（2013〜2019） | 矢倉ほか | 本文取得。**表1・表2は画像で数値を読めない** |
| 6 | **Wikipedia の戦型・戦法の記事**（`wj-aigakari` `wj-yokofudori` `wj-kakugawari` `wj-shikenbisha` `wj-aifuribisha` `wj-kakukoukan-furibisha`） | 年度別の局数・採用率・勝率の単発の数値（7-2 表4） | 年度（散在） | 記事ごと | 取得ツールの要約経由。**掲載前に原文で再確認** |

**手がかりはあるが未取得（引用不可）**
- 藤井聡太の戦型別成績: https://shogi-sanpo.com/fujiisouta/result/senkei/ ・ https://sakidori-ch.com/fujiisouta-senkeibetu（検索結果で存在のみ確認。個人の戦型推移の可視化に使える）
- 2011年度のプロ公式戦2,379局の戦型別集計を載せた論文（`ouc.repo.nii.ac.jp/record/2000463`、タイトルに「将棋AIの進化が公式戦の戦型選択に与えた影響」）。検索結果の要約には角換わり375・横歩取り284・矢倉212・相掛かり118・中飛車459とあるが、**PDF の取得が 503 で本文を確認できていない**【要確認】。長期の系列（2011→2017→2023→2026）の起点になりうる
- アマチュア（将棋ウォーズ）の戦型分布: 個人の集計記事が複数ある（`note.com/tora9900/n/n99c2d517f231` など。検索結果で存在のみ確認）。公式の戦型別統計は見つからなかった
- 『将棋年鑑』に戦型別の集計があるかは、検索では確認できなかった【未確認】

#### 7-2. すぐ使える数値（出典つき。「計算」は筆者）

**表1 相居飛車の戦型別局数（Arakippe。男性棋戦のプロ公式戦）**

| 戦型 | 2017年12月分（n=77）局数 | 率（計算） | 2023年1〜3月（n=277）局数 | 率（計算） | 記事の率 |
|---|---|---|---|---|---|
| 矢倉 | 8 | 10.4% | 37 | 13.4% | 13.6% |
| 角換わり | 18 | 23.4% | 67 | 24.2% | 24.0% |
| 相掛かり | 7 | 9.1% | 70 | 25.3% | 25.3% |
| 雁木 | 14 | 18.2% | 33 | 11.9% | 11.9% |
| 横歩取り | 15 | 19.5% | 22 | 7.9% | 7.9% |
| 一手損角換わり | 3 | 3.9% | 25 | 9.0% | （その他の内訳） |
| その他 | 12 | 15.6% | 23（その他48−25） | 8.3% | 17.3%（一手損込み） |

記事の率と局数÷母数は一致しない箇所がある（2018-01 は雁木「約16%」に対し14/77＝18.2%、2023春は矢倉13.6%に対し37/277＝13.4%）。**局数から再計算して使う**こと。前回の集計（記事中の「前回32.0%」など）の期間は特定できていない。

**表2 shogidata.info 直近500局（2026-07-24〜、2026-10-31 更新）**

| 戦型 | 全局比 | 相居飛車内に換算（÷62.6、計算） |
|---|---|---|
| 相居飛車（計） | 62.6% | 100% |
| 相矢倉 | 4.4% | 7.0% |
| 角換わり | 14.0% | 22.4% |
| 横歩取り | 3.2% | 5.1% |
| 相掛かり | 17.8% | 28.4% |
| 相居飛車(その他。雁木・一手損角換わり等を含むとみられる) | 23.2% | 37.1% |
| 振り飛車（計） | 36.6% | — |
| 四間飛車 12.8%・三間飛車 9.4%・中飛車 6.2%・角交換振り飛車 6.0%・相振り飛車 1.4%・向かい飛車 0.8% | | |

**3時点の比較（相居飛車内の割合の目安。標本は 77局／277局／約313局＝500×62.6%、棋戦の範囲も違う）**

| 戦型 | 2017年12月 | 2023年1〜3月 | 2026年7〜10月 |
|---|---|---|---|
| 矢倉 | 10.4% | 13.4% | 7.0% |
| 角換わり | 23.4% | 24.2% | 22.4% |
| 相掛かり | 9.1% | 25.3% | 28.4% |
| 横歩取り | 19.5% | 7.9% | 5.1% |
| 雁木＋一手損＋その他 | 37.7% | 29.2% | 37.1% |

相掛かりの伸びと横歩取りの縮小が目に見える（§6-4 と §5 の #7 の主張と整合）。**雁木を2026年から切り出せない**ので最下段は合算にした。

**表3 ソフト同士の戦型（floodgate、R3800以上、TadaoYamaoka）**

| 年 | 角換わり 出現率 | 先手勝率 | 引分率 | 相掛かり 出現率 | 先手勝率 | 引分率 |
|---|---|---|---|---|---|---|
| 2019 | 16.5%（734局） | 52.5% | 11.6% | 4.9%（219局） | 47.9% | 9.1% |
| 2020 | 18.9%（1619局） | 49.3% | 11.7% | 7.6%（652局） | 45.4% | 10.1% |
| 2021 | 26.8%（3472局） | 53.4% | 9.4% | 12.2%（1577局） | 49.5% | 6.2% |
| 2022 | 29.2%（1550局） | 55.9% | 10.2% | 15.1%（800局） | 56.8% | 9.5% |

第3回電竜戦A級: 角換わり25局（30.5%、先手56.0%・後手36.0%・引分8.0%）、相掛かり14局（17.1%、先手71.4%・後手28.6%）。「単に角換わり」と判定された行で、派生タグつきは別行。

**表4 Wikipedia 記事内の単発の数値（要約経由。掲載前に原文で再確認）**

| 項目 | 数値 | 出典 |
|---|---|---|
| 角道を止める四間飛車の対局数 | 2001年度の636局がピーク | `wj-shikenbisha` |
| 四間飛車の採用率 | 2007年度15.8%、2008年度（8月まで）13.6% | 同 |
| 四間飛車穴熊 | 2010年は184局中64局が四間飛車穴熊（184局の母集団は要約から特定できていない） | 同 |
| 相掛かり▲2六飛型 | 1985年度340局（矢倉290局）。2009年度は20局・先手勝率25.0%、▲2八飛型は97局・先手勝率56.7% | `wj-aigakari` |
| 相振り飛車の公式戦 | 2000年度65局→2010年度151局【要約経由・要原文】 | `wj-aifuribisha` |
| 角交換振り飛車（3三角戦法） | 2008年度136局、後手82勝 | `wj-kakukoukan-furibisha` |
| 横歩取り8五飛戦法 | 2014年6月時点で公式戦600局以上。1997年の披露後、後手の勝率が一時約7割 | `wj-yokofudori` |
| 一手損角換わり | 2008年度に後手の勝率が5割超、2013年時点で4割前半 | `wj-kakugawari` |
| 先手矢倉 | 2018年度193局・先手勝率.410、2019年度348局・.523 | `mynavi-yagura2019` |

#### 7-3. 可視化の組み方（提案）

1. **戦型シェアの100%積み上げ棒（相居飛車内）**: 表1・表2の3時点。出典ごとに棒の下に「Arakippe 単月」「Arakippe 四半期」「shogidata.info 直近500局」と書き分ける。右ドックの `_senkei`（§3-4-1）に載せるなら、その戦型の1行の折れ線／スパークラインにするのが軽い。
2. **ソフト同士の年別折れ線**: 表3の角換わり・相掛かりの出現率と先手勝率（人間の傾向ではないことを凡例で断る）。「ソフトが選ぶ戦型」と「人間が選ぶ戦型」の対比が、§6-3 §6-4 の読み物の挿絵になる。
3. **矢倉の2本の棒**: 2018年度と2019年度の対局数と先手勝率（表4）。§6-1 の挿絵。
4. **振り飛車の内訳（2026）**: 表2の最下行。§6-2 の挿絵。

**取得の手順メモ**: Arakippe は記事ごとの表を手で写すのが現実的（居飛車編47記事）。shogidata.info は HTML を日次で保存すれば時系列になる（利用条件の確認が先）。floodgate は記事の表をそのまま使う。いずれも `SENKEI.trend` に `{y, n, of, ref}` で入れ、`validate.js` で「`ref` が `sources` に宣言済み」「`n ≤ of`」を検査する。

## 8. 新規出典の一覧

本書で使った出典のうち、`js/data/sources.js` に**無かった19件**。すべて 2026-11-01 に WebFetch で開いて内容を確かめた（Wikipedia と一部は取得ツールの要約経由。その旨を「確認できた内容」に書いた）。id は既存の接頭辞の慣習（`wj-` `mynavi-` など）に合わせ、既存 id と重複しないことを `node` で確認済み。

| id | title | publisher | url | 確認できた内容 |
|---|---|---|---|---|
| `wj-senpou` | 将棋の戦法 | Wikipedia日本語版 | https://ja.wikipedia.org/wiki/%E5%B0%86%E6%A3%8B%E3%81%AE%E6%88%A6%E6%B3%95 | 「対抗形」からのリダイレクト先。分類（相居飛車・対抗型・相振り飛車・その他〔奇襲戦法・力戦型〕）、戦型＝大駒の位置などで大別・戦法＝各戦型での攻め方受け方、居飛車側の対応は急戦と持久戦に大別、5筋の飛車の扱い、相振り飛車は近年居飛車党も指す、力戦型の定義文、2019年の人気ランキング（1位ゴキゲン中飛車・2位藤井システム・3位居飛車穴熊。『将棋世界Special 将棋戦法事典100＋』基）。要約経由 |
| `wj-aifuribisha` | 相振り飛車 | Wikipedia日本語版 | https://ja.wikipedia.org/wiki/%E7%9B%B8%E6%8C%AF%E3%82%8A%E9%A3%9B%E8%BB%8A | 見出し（概要〔角交換相振り飛車の出現・序盤からの駆け引き〕／戦型〔相中飛車〕／囲い／陽動相振り飛車〔雲隠れ玉型〕）、戦型ランク「中飛車＜四間飛車＜三間飛車＜向かい飛車」、囲い（金無双・美濃・右矢倉・穴熊）の傾向、1605年の例・1998年竜王戦、2000年度65局→2010年度151局、相三間（2010年代）、相向かい飛車は矢倉戦になりやすい。要約経由 |
| `wj-youdou-furibisha` | 陽動振り飛車 | Wikipedia日本語版 | https://ja.wikipedia.org/wiki/%E9%99%BD%E5%8B%95%E6%8C%AF%E3%82%8A%E9%A3%9B%E8%BB%8A | 広義（相居飛車模様から振り飛車に転じる作戦の総称）と狭義（相矢倉の出だしから主に後手が用いる）、命名は加藤治郎、昭和30年前後の大山康晴・升田幸三、1991年9月の竜王戦（真部一男－大山康晴）、居飛車穴熊の普及で効果が薄れた。対抗形としての用法は記事に無い。要約経由 |
| `wj-kakukoukan-furibisha` | 角交換振り飛車 | Wikipedia日本語版 | https://ja.wikipedia.org/wiki/%E8%A7%92%E4%BA%A4%E6%8F%9B%E6%8C%AF%E3%82%8A%E9%A3%9B%E8%BB%8A | 定義（振り飛車側が角道を止めず、または自ら角交換して駒組み）、19の事例見出し、背景（居飛車穴熊→藤井システム→ゴキゲン中飛車）、3三角戦法の2008年度136局・後手82勝、2017年第58期王位戦の菅井竜也。「振り飛車には角交換」の格言への言及は無い。要約経由 |
| `wj-kyusen` | 急戦 | Wikipedia日本語版 | https://ja.wikipedia.org/wiki/%E6%80%A5%E6%88%A6 | 定義（早いうちから相手を攻める）、持久戦との間に明確な基準は無い、利点と短手数の傾向、居飛車舟囲い急戦（山田定跡など）、振り飛車側の急戦（藤井システム・向かい飛車の急戦・玉頭銀）。出典不足の注意書きあり。要約経由 |
| `wj-rikisen` | 力戦 | Wikipedia日本語版 | https://ja.wikipedia.org/wiki/%E5%8A%9B%E6%88%A6 | 書きかけの項目。定跡から外れた指し方、語源（『史記』馮唐伝）、手将棋・力将棋・乱戦・力戦形/調/派、相振り飛車・角交換振り飛車が例。要約経由 |
| `alsok-column3` | 戦型選択の戦略についての一考察 ～棋士は、なぜその戦型を選ぶのか？～ | ALSOK 将棋コラム 第3回（第73期ALSOK杯 王将戦） | https://www.alsok.co.jp/info/alsokhai-oushousen/73rd/column/03.html | 相居飛車の代表6戦型、(A)後手が戦型を決める／(B)先手に委ねる、第72期王将戦の局別戦型表、必勝説に関する予想。公開日・執筆者名の記載なし、「執筆時期2023年10月」、筆者個人の見解と明記 |
| `mynavi-yagura2019` | 2019年度に復活を遂げた先手矢倉　徹底した急戦封じが功を奏す | マイナビニュース（将棋情報局提供） | https://news.mynavi.jp/article/20200528-1044684/ | 2020-05-28 公開。先手矢倉が最後に勝ち越した2013年度、2015年度の矢倉左美濃急戦、5手目の変遷（2017年度に▲7七銀型が逆転）、早めの▲2五歩（2013年度0局・2014/15年度は屋敷伸之九段計14局・2019年度6割超）、矢倉の対局数と先手勝率（2018年度193局.410／2019年度348局.523）。表1・表2は画像で未確認。執筆者名の記載なし |
| `number-fujii2021` | 藤井聡太竜王「12敗」の研究（昨年度も驚きの勝率0.813）…では“4強”相手の勝率は？ そもそも四段昇段の平均年齢が22歳なのに… | Number Web（君島俊介／将棋PRESS） | https://number.bunshun.jp/articles/-/852902 | 2022-04-21 公開。2021年度52勝12敗（.813）、先手の主軸を角換わり腰掛け銀から相掛かりへ切り替え、先手相掛かり17勝2敗（タイトル戦6勝1敗）、相掛かりは序盤の選択肢が広く終盤まで定跡化されていないため持ち味が出やすいという分析。2ページ目は未取得 |
| `abema-senkei` | 【初心者向け】将棋の戦型種類一覧！居飛車・振り飛車の特徴を分かりやすく解説 | ABEMA TIMES | https://times.abema.tv/articles/-/10239432 | 2026-04-16 公開。居飛車（矢倉・角換わり・相掛かり・雁木）／振り飛車（四間・三間・中・向かい）の分類。取得内容に横歩取りの記載なし。執筆者名の記載なし |
| `arakippe-2018-01` | プロの公式戦から分析する、最新戦法の事情（１月・居飛車編） | あらきっぺの将棋ブログ | https://arakippe.com/archives/latest-tactics-lengthwise-rook201801.html | 2018-01-01 公開（2019-01-17 更新）。集計2017-12-01〜31、相居飛車77局の戦型別局数（矢倉8・角換わり18・相掛かり7・雁木14・横歩取り15・一手損角換わり3・その他12）。シリーズの各号へのリンク一覧。雁木の率「約16%」は14/77＝18%と不一致 |
| `arakippe-2023-spring` | 最新戦法の事情 【居飛車編】 2023年春季号 | あらきっぺの将棋ブログ | https://arakippe.com/archives/static-rook-2023-spring.html | 2023-04-30 公開。集計2023-01-01〜03-31、男性棋戦のプロ公式戦277局（角換わり67・矢倉37・相掛かり70・雁木33・横歩取り22・その他48〔一手損角換わり25〕）。分類基準の明文化なし |
| `shogidata-senkei` | shogidata.info（将棋のデータベースサイト）ホーム「戦型」 | shogidata.info | https://shogidata.info/ | 2026-10-31 更新。直近500局（2026-07-24〜）の戦型採用率（相居飛車62.6%＝相矢倉4.4・角換わり14.0・横歩取り3.2・相掛かり17.8・その他23.2／振り飛車36.6%＝中6.2・四間12.8・三間9.4・向かい0.8・角交換6.0・相振り1.4）。運営者・出典・判定方法の記載なし |
| `shogidata-senkei-rank` | 戦型別、棋士の戦型採用率ランキング | shogidata.info | https://shogidata.info/list/strategyrank.html | 2026-10-31 更新。過去2年・登録10局以上の棋士の戦型別TOP5（矢倉・角換わり・横歩取り・相掛かり・雁木・居飛車(力戦)・対振り飛車／中・四間・三間・向かい・角交換振り飛車・相振り飛車）。判定方法の記載なし |
| `shogirsltdb-fujii` | 藤井聡太・戦型別成績 | 将棋棋士成績DB | http://shogirsltdb.cloudfree.jp/person3.php?name=594 | 戦型別の成績表（列: 戦型・対局・勝・敗・勝率・先勝/先敗/先勝率・後勝/後敗/後勝率・持・千）。戦型名は矢倉・角換わり・相掛かり・横歩取り・一手損角換わり・四間/三間/中/向飛車(居飛車側)・相居飛車力戦・戦型不明。運営者・更新日の記載なし。要約経由 |
| `yamaoka-floodgate` | floodgateの戦型別先手勝率の変化 | TadaoYamaokaの開発日記 | https://tadaoyamaoka.hatenablog.com/entry/2022/12/28/185035 | 2022-12-28 投稿。floodgate（R3800以上）の2019〜2022年別の上位10戦型（回数・出現率・先手勝率・後手勝率・引分率）と第3回電竜戦A級。分類は Mizar 氏の JSON 定義（中身は未取得） |
| `kifulog-ouza74-1` | 戦型は相掛かり | 王座戦中継Blog（日本将棋連盟） | https://kifulog.shogi.or.jp/ouza/2026/09/post-0f38.html | 2026-09-02 投稿。第74期王座戦五番勝負第1局の戦型は相掛かり。両対局者がともに先手番で主に用いる戦型、20手目までは王位戦七番勝負第4局（伊藤匠二冠－藤井聡太王位）を含む前例、21手目▲2四歩から新しい形、広瀬九段の言及 |
| `wikibooks-senpou` | 将棋の戦法一覧 | Wikibooks日本語版 | https://ja.wikibooks.org/wiki/%E5%B0%86%E6%A3%8B%E3%81%AE%E6%88%A6%E6%B3%95%E4%B8%80%E8%A6%A7 | 居飛車の戦法（矢倉・相掛かり・角換わり・対振り飛車〔急戦・持久戦・引き角戦・端角〕）／振り飛車の戦法／その他（右四間・雁木・袖飛車・筋違い角・奇襲・嬉野流・英春流）の整理。「相居飛車」「対抗型」「力戦」の語なし。更新の有無は未確認。要約経由 |
| `jsr-shogi-classifier` | @shogi/classifier | JSR（オープンソースのパッケージ） | https://jsr.io/@shogi/classifier | 「将棋の局面（SFEN）や棋譜（KIF）から、戦型や囲いを判定するためのライブラリ」。囲いの判定規則を宣言的に書く CastleDefinition（pieces＝必須の配置〔AND〕、hand＝持ち駒条件〔AND〕、tesuuMax、symmetric＝先後反転、tags、id、name）。組み込みの戦型一覧・階層は取得内容に無く未確認 |

**`sources.js` にそのまま追記できる形**（`title/publisher/url` のみ）:

```js
  'wj-senpou': { title: '将棋の戦法', publisher: 'Wikipedia日本語版', url: 'https://ja.wikipedia.org/wiki/%E5%B0%86%E6%A3%8B%E3%81%AE%E6%88%A6%E6%B3%95' },
  'wj-aifuribisha': { title: '相振り飛車', publisher: 'Wikipedia日本語版', url: 'https://ja.wikipedia.org/wiki/%E7%9B%B8%E6%8C%AF%E3%82%8A%E9%A3%9B%E8%BB%8A' },
  'wj-youdou-furibisha': { title: '陽動振り飛車', publisher: 'Wikipedia日本語版', url: 'https://ja.wikipedia.org/wiki/%E9%99%BD%E5%8B%95%E6%8C%AF%E3%82%8A%E9%A3%9B%E8%BB%8A' },
  'wj-kakukoukan-furibisha': { title: '角交換振り飛車', publisher: 'Wikipedia日本語版', url: 'https://ja.wikipedia.org/wiki/%E8%A7%92%E4%BA%A4%E6%8F%9B%E6%8C%AF%E3%82%8A%E9%A3%9B%E8%BB%8A' },
  'wj-kyusen': { title: '急戦', publisher: 'Wikipedia日本語版', url: 'https://ja.wikipedia.org/wiki/%E6%80%A5%E6%88%A6' },
  'wj-rikisen': { title: '力戦', publisher: 'Wikipedia日本語版', url: 'https://ja.wikipedia.org/wiki/%E5%8A%9B%E6%88%A6' },
  'alsok-column3': { title: '戦型選択の戦略についての一考察 ～棋士は、なぜその戦型を選ぶのか？～', publisher: 'ALSOK 将棋コラム 第3回（第73期ALSOK杯 王将戦）', url: 'https://www.alsok.co.jp/info/alsokhai-oushousen/73rd/column/03.html' },
  'mynavi-yagura2019': { title: '2019年度に復活を遂げた先手矢倉　徹底した急戦封じが功を奏す', publisher: 'マイナビニュース（将棋情報局提供）', url: 'https://news.mynavi.jp/article/20200528-1044684/' },
  'number-fujii2021': { title: '藤井聡太竜王「12敗」の研究（昨年度も驚きの勝率0.813）…では“4強”相手の勝率は？ そもそも四段昇段の平均年齢が22歳なのに…', publisher: 'Number Web（君島俊介／将棋PRESS）', url: 'https://number.bunshun.jp/articles/-/852902' },
  'abema-senkei': { title: '【初心者向け】将棋の戦型種類一覧！居飛車・振り飛車の特徴を分かりやすく解説', publisher: 'ABEMA TIMES', url: 'https://times.abema.tv/articles/-/10239432' },
  'arakippe-2018-01': { title: 'プロの公式戦から分析する、最新戦法の事情（１月・居飛車編）', publisher: 'あらきっぺの将棋ブログ', url: 'https://arakippe.com/archives/latest-tactics-lengthwise-rook201801.html' },
  'arakippe-2023-spring': { title: '最新戦法の事情 【居飛車編】 2023年春季号', publisher: 'あらきっぺの将棋ブログ', url: 'https://arakippe.com/archives/static-rook-2023-spring.html' },
  'shogidata-senkei': { title: 'shogidata.info（将棋のデータベースサイト）ホーム「戦型」', publisher: 'shogidata.info', url: 'https://shogidata.info/' },
  'shogidata-senkei-rank': { title: '戦型別、棋士の戦型採用率ランキング', publisher: 'shogidata.info', url: 'https://shogidata.info/list/strategyrank.html' },
  'shogirsltdb-fujii': { title: '藤井聡太・戦型別成績', publisher: '将棋棋士成績DB', url: 'http://shogirsltdb.cloudfree.jp/person3.php?name=594' },
  'yamaoka-floodgate': { title: 'floodgateの戦型別先手勝率の変化', publisher: 'TadaoYamaokaの開発日記', url: 'https://tadaoyamaoka.hatenablog.com/entry/2022/12/28/185035' },
  'kifulog-ouza74-1': { title: '戦型は相掛かり', publisher: '王座戦中継Blog（日本将棋連盟）', url: 'https://kifulog.shogi.or.jp/ouza/2026/09/post-0f38.html' },
  'wikibooks-senpou': { title: '将棋の戦法一覧', publisher: 'Wikibooks日本語版', url: 'https://ja.wikibooks.org/wiki/%E5%B0%86%E6%A3%8B%E3%81%AE%E6%88%A6%E6%B3%95%E4%B8%80%E8%A6%A7' },
  'jsr-shogi-classifier': { title: '@shogi/classifier', publisher: 'JSR（オープンソースのパッケージ）', url: 'https://jsr.io/@shogi/classifier' },
```

**既存 id の再利用**（新規作成不要。本文・下書きで使ったもの）: `wj-shogi-yogo`（急戦・持久戦・対抗形・力戦・戦型・定跡の定義を確認）、`wj-shikenbisha` `wj-sankenbisha` `wj-nakabisha` `wj-mukaibisha` `wj-gokigen` `wj-chousoku37gin` `wj-fujiisystem` `wj-kakukoukan-shiken` `we-ranging-rook` `wj-kakugawari` `wj-aigakari` `wj-yokofudori` `wj-yagura` `wj-gangi` `wj-ibisha-anaguma` `wj-anaguma` `sj-ibiana` `wj-bonanza` `sj-bonanza` `wj-elmo` `mynavi-elmo` `wj-millennium` `wj-tateishi` `wj-ureshinoryu` `wj-funagakoi` `wj-onigoroshi` `wj-kikusui` `wj-kimuramino` `sj-kakukoukan-furibisya`。そのうち §5 #3・#4・#17・#18 の個別の年代・命名の事実は、`quality-castles.md` `quality-tactics-furibisha.md` `quality-tactics-ibisha.md` が各記事に照合済みの記述を引用したもので、本書では再取得していない。

**確認できなかったもの（出典として使っていない）**: 2011年度の戦型別集計の論文（PDF が 503）、藤井聡太の戦型別成績の個人サイト2件（検索結果のみ）、アマチュアの戦型分布の個人集計（検索結果のみ）、Mizar 氏の JSON 定義（中身）、『将棋年鑑』の戦型別集計の有無、日本将棋連盟の戦型分類（検索では見つからず）。

