# リファクタリング計画（現状版）：構造の整理とモジュール化への道筋

古い計画書（`plan-fix-unified.md`・`plan-next-actions.md`・`plan-ts-migration.md` など）が書かれた時点から
アプリの形が大きく変わった（3画面 → 対局図1画面に統合、戦法の複数採用、制約フィールド、手筋モーダル）。
この計画は **いまのコードを基準に** リファクタリングを立て直したもの。
振る舞いは変えず、`npm test` が常に通る状態を保って小さく進める。

## 背景（現状）

- `js/` は62ファイル・約14.2k行（data 約4.9k・core 約3.7k・ui 約4.6k・screen 約1.0k）。
  `window.Kakoi` 名前空間に IIFE で定義を足し、読み込み順は `js/manifest.js` が唯一の定義。
  index.html が manifest を読んで `<script>` を動的に挿入するため `file://` で動く
- データは手書き JS（`tactics.js` 約1.5k行・`castles-ibisha.js` 約1.3k行）。
  89囲い・75戦法・13手筋（`validate-castles.js` の実測）
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
| `plan-dev-infra.md` | A-2 テスト分割済み。A-4 CI は UI テスト更新待ち | 本計画の Phase 0 に吸収 |
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

### 1-1. データ参照の一本化 [S〜M]（完了）

`catalog.findTactic/findCastle` を Map 索引化し、配列の追加・置き換えに追従する。
`catalog` はグローバルデータとスキーマ定数、`Repository` は UI 用の組み立て済み窓口と役割を明記。

### 1-2. tacticId / tacticIds の二重表現を tacticIds に一本化 [M]（完了: sides() から tacticId を削除し defaults.primaryOf に集約）

実効状態は `tacticIds` のみを持つ。代表戦法が必要な読み側は `defaults.primaryOf(st)` で導出。
旧 `tacticId` 入力は `compat` などの境界で正規化し、`lookup.FIELD` から tactic を除去。
32万ケースの旧新判定を比較して差分0、unit-test で回帰確認済み。

### 1-3. 選択文字列（selected）のパース/構築の一元化 [S]（完了: constraints.DEFAULT_SEL に集約）

内部選択文字列（`me.tactic.bougin`）と URL 短縮文字列（`mt.bougin`）は形式を維持。
既定選択は `constraints.DEFAULT_SEL` に集約し、両形式の文法差をコメントで明記。

### 1-4. compose.js の分割 [M]（完了）

**実施済み**: `build()` を約35行のオーケストレータにし、フェーズを `ctx` を
受け取る名前つき関数（`buildBase`/`makeCtx`/`lockTactic`/`placeSubTactics`/
`placeCore`/`lendMissingCore`/`placeRest`/`normalizeGuardPieces`/`placeShell`/
`applyCastleHand`/`rescueKing`/`verifyPawns`/`countMoved`）に分割。
同一ファイル内に留め、unit-test 187/187 PASS。468行 → 495行（ctx 化の増分）。

### 1-5. compat.js の分割 [M]（完了）

**実施済み**: 5ブロック＋エクスポートのセクション構成に整理
（共通部品 / compose 評価 / 相性表・fitness / judge / searchAlternative）。
メモ・定数は使う責務のブロック内に配置。コード行の多重集合は完全一致で
振る舞い不変を確認。unit-test 187/187 PASS。426行 → 429行。

### 1-6. 依存方向の固定 [S]（完了）

`manifest.js` と `constraints` / `compat` / `compose` / `derive-board` の先頭コメントに
依存の方向を明記。既定値の権威に関する古いコメント（`compose`・`matchup`）も
`defaults` に修正した。`tesuji-check → pieceRules` は既存コメントで明記済み。

## Phase 2：UI の整理 [M]

Phase 1 が終わってから、大きい UI ファイルに手を入れる。renderKey 等の
描画抑制の仕組み（board-screen）・委譲リスナ（cites）等の**良い部分は残す**。

### 2-1. constraint-field.js の分割 [M]（完了: 6ブロックに整理、703→760行）

レイアウト計算・DOM/SVG 構築・イベント配線・ヒット領域更新のブロックに整理。
現在は新しい「駒つぎ」デザインへユーザー側で変更中のため、その表示は別途 E2E 更新が必要。

### 2-2. detail-sections / detail-view の整理 [M]（完了）

**実施済み**: `detail-sections.js` に `head` / `setChip` / `senkeiChip` / `vchips`
を追加し、`detail-view.js` の直接 HTML 構築を部品関数へ寄せた。`unit-test.js` に
detail-sections のスモークテスト5件を追加。旧版との DOM 出力を15シナリオで比較し
byte-identical を確認。

**別途要対応の表示バグ**: `_strategy` / `_senkei` でボタンHTMLを `Sec().note()` に渡すと
`rich()` がHTMLをエスケープしてボタンが文字として表示される箇所がある。今回の
振る舞い不変の整理では直していないため、独立したバグ修正タスクにする。

### 2-3. マジック値・フォールバックの統一 [S]（完了）

`constraints.DEFAULT_SEL` へ既定選択を集約。`derive-board.LATE='opp'` は
「選んだ順を持たないので相手側固定」の意図が既に明記されているため維持。
`Kakoi.newLRU(n)` を導入し、compat / constraints / piece-rules に散っていた
LRU生成を統一。`derive-board` の側ループは `catalog.WHOS` を使う。

## Phase 0-4：CI [S]（保留）

現在の未コミット UI デザイン変更により `ui-check.js` の既存セレクタ前提がずれ、
`npm test` は unit 196件の後、UI 7件失敗となる。新デザインに合わせた UI チェックを更新し、
全件 PASS を確認してから CI を有効化する。`test:fast` / `test:ui` の分離は完了済み。

## 命名の整理（責務が読める名前へ）[S〜M]（b〜e表は実施済み）

調査の結果、kebab-case のファイル名・「データ=ALL_CAPS・ロジック=camelCase・DOM クラス=PascalCase」
の規約は概ね統一されている。**同名衝突・責務が読めない名・画面領域名の揺れ**を
b〜e表の方針で改名済み。下表は変更前の名前と採用した名前の記録。

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
現状では TypeScript/compiler が依存にないため、導入時は `typescript` の追加が必要。

- 更新点: 55→62ファイル、data 約4.9k行、`ui-check.js` の Playwright パターン、
  `js/vendor/three.min.js` の取り扱い、`docs/archived/` 運用
- Phase 1〜2 で責務が整理されたあとにモジュール化すると、import 境界が自然に決まる
- 次の実装候補は `types/kakoi.d.ts` と `tsconfig.json` による型骨格。ただし `tsc` を
  実行するには依存導入が必要なので、ネットワークを使えるタイミングで同時に着手する

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
