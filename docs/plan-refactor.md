# リファクタリング計画（現状版）：構造の整理とモジュール化への道筋

古い計画書（`plan-fix-unified.md`・`plan-next-actions.md`・`plan-ts-migration.md` など）が書かれた時点から
アプリの形が大きく変わった（3画面 → 対局図1画面に統合、戦法の複数採用、制約フィールド、手筋モーダル）。
この計画は **いまのコードを基準に** リファクタリングを立て直したもの。
振る舞いは変えず、`npm test` が常に通る状態を保って小さく進める。

## 背景（現状）

- `js/` は57ファイル・約11.9k行（data 約3.7k・core 約3.0k・ui 約4.0k・modes 約0.6k）。
  `window.Kakoi` 名前空間に IIFE で定義を足し、読み込み順は `js/manifest.js` が唯一の定義。
  index.html が manifest を読んで `<script>` を動的に挿入するため `file://` で動く
- データは手書き JS（`tactics.js` 1548行・`castles-ibisha.js` 1327行）。86囲い・68戦法・8+14系統・13手筋
- テストは `validate-castles.js`（データ）・`unit-test.js`（純関数＋matrix スナップショット）・
  `ui-check.js`（Playwright）の3段。`npm test` 全体で約46秒、大半は `ui-check`
- ビルド不要の静的サイト。配布は GitHub Pages。CI・lint・formatter は無し
- `docs/archived/` に消化済みの計画書を移す運用は既にある

## 旧計画書との関係（棚卸し）

| 計画書 | 状態 | 扱い |
|---|---|---|
| `plan-fix-unified.md` | 消化済み（残課題は plan-bug-audit.md の R-1/R-2 として管理） | **archived へ移動済み** |
| `plan-next-actions.md` | 陳腐化（3画面時代の記述。分類マップは削除済み） | **archived へ移動済み** |
| `plan-castle-tactic-tabs.md` | 実装済み（dockTab: 'castle'/'tactic'） | **archived へ移動済み** |
| `plan-tactics-and-clusters.md` | 陳腐化（分類マップ削除済み） | **archived へ移動済み** |
| `plan-dev-infra.md` | 新しい（2026-11-01）。A-2 テスト分割・A-4 CI は未実施 | 本計画の Phase 0 に吸収 |
| `plan-ui-overhaul.md` | 新しい（2026-11-01）。UI 改善案でリファクタではない | 別計画として残す |
| `plan-ts-migration.md` | 未着手だが方向は有効 | 本計画の Phase 3 で現状版に更新 |

## 原則

- 1項目 = 1コミット〜1PR。各ステップで `npm test` が通ること
- **後方互換**: URL ハッシュの形式（`#k=mt:…&opp=1&sel=…`）は変えない。共有済みリンクを壊さない
- データの書き方（`'玉78 銀79 …'` の表記、`[[ref]]` 出典記法）は変えない
- core（DOM 非依存の純粋層）→ ui → modes の依存方向を崩さない
- リファクタとコンテンツ追加を同じコミットに混ぜない

## Phase 0：土台と棚卸し [S]

リファクタを安全に進めるための足場。`plan-dev-infra.md` との重複はここに吸収させる。

- **0-1. テストを速い層と遅い層に分ける**（plan-dev-infra A-2）
  - `npm run test:fast`：`validate-castles.js` と `unit-test.js`（数秒）
  - `npm test`：全体（今と同じ）。リファクタ中は test:fast を頻繁に回す
- **0-2. 古い計画書を archived へ**（実施済み: 4本を `docs/archived/` へ git mv）
  - `dev.md` を「未着手／進行中／完了」に分ける
- **0-3. 死コードの棚卸し**
  - `Kakoi.*` の各公開 API が実際に呼ばれているか grep で洗う
    （`fun.js`・`combos.js`・`senkei.js` 等の参照元を確認）
  - `tools/` の `_` 接頭辞スクリプトは gitignore 済みで問題なし
- **0-4. CI（GitHub Actions）**（plan-dev-infra A-4。任意だが推奨）
  - PR ごとに `npm test`。ui-check のスクショを artifact に残す

## Phase 1：core の整理 [M]

core は既に純粋層として健全だが、複数戦法対応の過渡期の痕跡と大きい関数が残る。
**振る舞い不変の機械的な整理**として行い、単体テストで固定する。

### 1-1. データ参照の一本化 [S〜M]（完了: lookup を Map 索引化→catalog.js へ改名）

`Kakoi.lookup.findTactic`/`findCastle`（配列の線形走査）と `Repository` の Map が
**2系統の参照経路**になっている。core は lookup、UI は両方を使い分けている現状を整理する。

- `lookup` を index 化（初回アクセス時に id→オブジェクトの Map を構築）するか、
  Repository への経路を統一するかは実装時に決める
- 少なくとも「どちらを使うか」の規則をコメントで明文化し、UI が両方を使う理由を揃える

### 1-2. tacticId / tacticIds の二重表現を tacticIds に一本化 [M]（完了: sides() から tacticId を削除し defaults.primaryOf に集約）

複数戦法対応で `tacticId`（主の戦法・飛車優先）と `tacticIds`（全リスト）が併存し、
`compat.tacticIdsOf`・`constraints.sides`・`hash-link`・`board-screen`・`defaults` に
同じ変換ロジックが散っている。実態として `tacticId` は
`primaryTacticId(tacticIds)` の導出値で独立した情報を持たないので、
**導出のまま残すのではなく消して `tacticIds` に一本化する**。

- `sides()` の出力から `tacticId` を外す（現在は `tacticIds` と並んで導出値を持つ。
  <ref>constraints.js L143 付近</ref>）。`fillImplied` も `tacticIds` だけを書く
- 代表戦法が欲しい読み側（`compat.tacticIdOf`・`board-screen`・`board-detail-view`・
  `keyboard-nav`・`matchup._resolveTactic` など）は `primaryTacticId(st.tacticIds)` を
  その場で呼ぶ。頻出なら `defaults` に薄いヘルパー（`primaryOf(st)` など）を足す
- `lookup.FIELD` の `tactic: 'tacticId'` を消す。`compat.judgeFull` の
  `st[FIELD[layer]] = candidateId` は層ごとの代入に分け、castle は `castleId`、
  tactic は既存の `tacticIds` 駒枠ロジックのみとする
- 入力境界（`compat.judge` の `me`/`opp` や unit-test の `{strategy, tacticId}`）は
  `compat.tacticIdsOf` が旧形式を配列に正規化し続けるので、外部仕様は変えない
- 削る前に確認: `judgeFull` が `tacticId=candidateId` に立てると `ev.tactic` が
  「候補そのもの」になる経路（`pairingBestOf` 内部など）がある。観測できる振る舞いの
  差は出ないと読み取れるが、unit-test で固定してから削る
- `compat.judgeFull` の `candPiece` 差し替えロジックを `constraints.setTactic` と重複なく共有する

### 1-3. 選択文字列（selected）のパース/構築の一元化 [S]（完了: constraints.DEFAULT_SEL に集約）

`constraints.parseSel`（`'me.tactic.bougin'` 形式）と `hash-link.encodeSel/decodeSel`（`'mt.bougin'` 形式）は
同じ概念の2つの文法。フォーマット自体は変えず、以下を整理する。

- `'me.castle'` フォールバックが `constraints.normalizeSelected` と
  `board-screen._renderDetail`（`{who:'me',kind:'castle'}` の直書き）に重複しているのを一元化
- `SEL_RE` と `hash-link` の `decodeSel` の正規表現の意味差をコメントで明記

### 1-4. compose.js の分割 [M]（完了）

**実施済み**: `position()` を約35行のオーケストレータにし、フェーズを `ctx` を
受け取る名前つき関数（`buildBase`/`makeCtx`/`lockTactic`/`placeSubTactics`/
`placeCore`/`lendMissingCore`/`placeRest`/`normalizeGuardPieces`/`placeShell`/
`applyCastleHand`/`rescueKing`/`verifyPawns`/`countMoved`）に分割。
同一ファイル内に留め、unit-test 187/187 PASS。468行 → 495行（ctx 化の増分）。

### 1-5. compat.js の分割 [M]（完了）

**実施済み**: 5ブロック＋エクスポートのセクション構成に整理
（共通部品 / compose 評価 / 相性表・fitness / judge / searchAlternative）。
メモ・定数は使う責務のブロック内に配置。コード行の多重集合は完全一致で
振る舞い不変を確認。unit-test 187/187 PASS。426行 → 429行。

### 1-6. 依存方向の固定 [S]（保留: 改名で実質解消を確認後に判断）

実行時に `constraints → compat → compose → defaults/lookup` の参照がグローバル経由で
張られている（`constraints.sides` が `Kakoi.compat.judgeFull` を呼ぶ等）。
循環は `defaults` の分離で既に解消済みだが、依存図を manifest/コメントで明文化し、
新しいコードが逆方向を張らないようにする。

## Phase 2：UI の整理 [M]

Phase 1 が終わってから、大きい UI ファイルに手を入れる。renderKey 等の
描画抑制の仕組み（board-screen）・委譲リスナ（cites）等の**良い部分は残す**。

### 2-1. constraint-field.js の分割 [M]（完了: 6ブロックに整理、703→760行）

645行で最大の UI ファイル。六角グリッドのレイアウト計算・SVG/DOM 構築・
イベント配線・胞の状態更新が同居している。

- レイアウト計算（座標・辺の共有判定）を純粋関数として分離
- DOM 構築とイベントは別層に。現状は描画と配線が混在

### 2-2. detail-sections / board-detail-view の整理 [M]

419行＋352行の `innerHTML` 文字列構築。動作は安定しているので全面書き換えはしない。

- 長いセクション関数を責務（概要・ペンタグラム・相性・出典）ごとに分割
- `innerHTML` 経路は据え置くが、XSS/属性エスケープの扱いを確認
  （`Kakoi.html` が HTML 構築の唯一権威ならそれに寄せる）

### 2-3. マジック値・フォールバックの統一 [S]

`'me.castle'` や `{who:'me',kind:'castle'}` の既定選択、`board-model` の `LATE='opp'`、
`Kakoi.LRU || Map` の繰り返しなど、散在する小さな重複を揃える。

## 命名の整理（責務が読める名前へ）[S〜M]（b〜e表は実施済み）

調査の結果、kebab-case のファイル名・「データ=ALL_CAPS・ロジック=camelCase・DOM クラス=PascalCase」
の規約は概ね統一されている。残るのは **同名衝突・責務が読めない名・画面領域名の揺れ**。
Phase 3 でファイル名がそのまま import パスになるので、モジュール化の前に済ませる。
改名だけのコミットとし（振る舞い不変）、manifest・tools/ の読み込みパス・`Kakoi.*` の
参照を機械的に置き換える。

### a. 同名・近似名の衝突（最優先）

| 現行 | 案 | 理由 |
|---|---|---|
| `js/core/tesuji.js` ↔ `js/data/tesuji.js`（`Kakoi.tesuji` ↔ `Kakoi.TESUJI`） | core を `tesuji-engine.js`（export は `Kakoi.tesuji` のまま） | 同名ファイルが層をまたいでいる。engine=検出・評価（forks/sokofu/detectors）、data=手筋データ、`tesuji-check.js`=検算器で役割が3つある |
| `core/pieces.js` ↔ `core/piece-moves.js` | `piece-moves.js` を pieces.js へ統合して削除 | 駒の動きの定義が2権威に分裂している途中（pieces.js は「単一権威」を宣言済みだが attack-map/piece-match が旧版を参照中）。統合の完了が先 |
| `core/pieces.js`（`Kakoi.pieces`） | `piece-rules.js`（`Kakoi.pieceRules`） | `position.pieces`・`t.pieces`（駒配置データ）と同名で、「駒の動きの規則」が読めない |
| `core/piece-match.js`（`Kakoi.pieceMatch`） | `piece-pairing.js`（`Kakoi.piecePairing`） | 中身はアニメ用の駒対応づけ（pair/plan）。「届くか」の moveCount は piece-rules 側に寄せる |

### b. 責務が読めない関数名・ファイル名

| 現行 | 案 | 理由 |
|---|---|---|
| `compose.position()` | `compose.build()` | 名詞メソッドで「組み立てる」動作が見えない（`Position` クラスと紛らわしい） |
| `matchup.fitness()` ↔ `matchup.tacticFit()` | `castleFit()` / `tacticFit()` に統一 | 対称なペア（囲いスコア/戦法適性）なのに名が非対称 |
| `constraints.sides()` | `effectiveSides()` または `derive()` | 「実効状態を返す」が読めない。sides() は全画面の導出入口なので特に |
| `constraints.labels()` | `senkeiLabels()` | `notation.label()`（4六の筋段名）と label が衝突 |
| `pieceMatch.moveCount()` / `moveCost()` | `reachPly()` / `slideCost()` | 「合成の届く判定（BFS手数）」と「アニメの滑らせやすさ」で目的が違うのに近似名 |
| `core/board-model.js` | `core/derive-board.js` | 中身は裸の関数 `deriveBoard` 1つ。ファイル名と export を揃える |
| `core/lookup.js` | `core/catalog.js` | 「lookup」は Repository と同義で経路が読めない。層スキーマ定数（KINDS/WHOS/FIELD）も同居している |
| `core/html.js` | `core/markup.js` | DOM に触れない文字列ユーティリティ（esc/cite）なのに html と名乗っている |
| `ui/roving.js` | `ui/roving-tabindex.js` | roving tabindex のこと。短すぎて意味が取れない |
| `data/fun.js` | `data/trivia.js` または `extras.js` | お楽しみ欄（格言・ミーム・動画）のデータ。「fun」は責務が読めない |
| `ui/kaya-art.js` | `ui/piece-art.js`（任意・好み） | 榧（kaya）は固有名詞で「盤・駒の絵を焼く」責務が読めない。芸名として残すのもあり |

### c. 画面領域名の統一（rail / detail / field / board）

index.html では左=`.rail`・右=`.detail`・上=`#cfield`・中央=盤。ファイル名は
左ドックが `dock-*`、右ドックが `detail-*`/`board-detail-view`、下端タブが `dock-tabs` で揺れている。
画面領域名に揃えると「どこを描くか」が名前から読める。

| 現行 | 案 |
|---|---|
| `ui/dock-view.js` / `dock-grids.js` / `dock-badges.js` | `rail-view.js` / `rail-grids.js` / `rail-badges.js` |
| `ui/board-detail-view.js` | `detail-view.js`（`detail-sections.js` と対になる。「board」は中央の盤を指すので誤解） |
| `ui/dock-tabs.js` | `mobile-tabs.js`（下端タブ＋スワイプ。ドックの中身ではない） |

### d. modes/ の揺れ

`modes/` は3画面時代の名残で、中身はコントローラ（ConstraintMode）・描画統合（BoardScreen）・
純関数（keyboardNav）と種類が混在している。

| 現行 | 案 |
|---|---|
| `modes/` ディレクトリ | `screen/` または `controllers/`（「mode」は画面が1つしかない今は名を捨てる） |
| `modes/constraint-mode.js`（`K.ConstraintMode`） | `screen/controller.js`（`K.ScreenController` など。「対局図のコントローラ」が責務） |
| `modes/board-screen.js`・`keyboard-nav.js` | そのまま（ファイル名は概ね責務どおり） |

### e. 小さな揺れ（任意・優先度低）

- data ファイル: `tactics.js`（複数形）に対し `tactic-families.js`/`tactic-ratings.js`（単数形
  接頭辞）。`castles-*` は複数形。`tactics-*` に揃えるか現状維持でもよい
- `Kakoi.deriveBoard` は唯一の「裸の関数」export（他は名前空間かクラス）。b 表の
  `derive-board.js` への改名と併せて `Kakoi.boardModel.derive` のような名前空間に
  揃えるかは一貫性で決める
- `ui/segmented.js` → `ui/segmented-control.js`（クラス `Segmented` に揃える。任意）

## Phase 3：モジュール化・型（plan-ts-migration の現状版）[L]

`docs/plan-ts-migration.md` の方向（esbuild で IIFE バンドル、`file://` 維持）は依然として有効。
数字と対象が変わっているので、着手前に同書を現状に更新する。

- 更新点: 55→57ファイル、data 約3.7k行、`ui-check.js` の Playwright パターン、
  `js/vendor/three.min.js` の取り扱い、`docs/archived/` 運用
- Phase 1〜2 で責務が整理されたあとにモジュール化すると、import 境界が自然に決まる
- 型は `types/kakoi.d.ts` の骨格から（`plan-ts-migration` Phase 1）か、
  core の整理と並行して進めてもよい

## Phase 4：リポジトリ整備（随時・並行可）

- `design-refs*.html`（21ファイル・約1MB超）をディレクトリに集約するか検討
  （現状はルート直下で追跡済み。docs から参照されているか確認してから）
- `docs/` の計画書と archived の運用を継続（完了したら移す）
- `dev.md` のバックログを定期的に整理

## 進め方の順序

依存の少ないものから順に進める。Phase 0 → 1-3（小さい整理）→ 1-1/1-2（core 内部）→
1-4/1-5（大きいファイルの分割）→ Phase 2（UI）→ Phase 3（モジュール化）は
前のフェーズが安定してから。命名の整理は Phase 3 より前ならいつでも挟める
（ファイル名が import パスになる前に済ませる）。a 表（衝突の解消）は誤読を招くので早めがよい。

各フェーズの完了条件は `npm run test:fast` → `npm test` が通ること。
表示に影響し得る UI の整理（Phase 2）では `ui-check.js` のスクショ比較も使う。

## やらないこと

- フレームワーク（React/Vue 等）の導入
- URL ハッシュ形式・データ記法・駒の表記の変更
- `index.html` を直接開いて動く動線を壊す変更（`file://` の維持）
- 戦型ラベルの決定木・両立判定ルール・相性スコアの計算式の変更（将棋の正確さに関わるので別タスク）
