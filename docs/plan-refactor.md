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
| `plan-fix-unified.md` | ほぼ消化済み（S1〜S6 の構造項目はコードに実装痕跡あり） | 未消化の残りを確認して archived へ |
| `plan-next-actions.md` | 陳腐化（3画面時代の記述。分類マップは削除済み） | archived へ |
| `plan-castle-tactic-tabs.md` | 実装済み（dockTab: 'castle'/'tactic'） | archived へ |
| `plan-tactics-and-clusters.md` | 陳腐化（分類マップ削除済み） | archived へ |
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
- **0-2. 古い計画書を archived へ**
  - 上の表の「archived へ」の4本を移す。`plan-fix-unified.md` は未消化の残り
    （特に P2 の構造項目が全部済みか）だけ確認してから
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

### 1-1. データ参照の一本化 [S〜M]

`Kakoi.lookup.findTactic`/`findCastle`（配列の線形走査）と `Repository` の Map が
**2系統の参照経路**になっている。core は lookup、UI は両方を使い分けている現状を整理する。

- `lookup` を index 化（初回アクセス時に id→オブジェクトの Map を構築）するか、
  Repository への経路を統一するかは実装時に決める
- 少なくとも「どちらを使うか」の規則をコメントで明文化し、UI が両方を使う理由を揃える

### 1-2. tacticId / tacticIds の二重表現の整理 [M]

複数戦法対応で `tacticId`（主の戦法・飛車優先）と `tacticIds`（全リスト）が併存し、
`compat.tacticIdsOf`・`constraints.sides`・`hash-link`・`board-screen`・`defaults` に
同じ変換ロジックが散っている。

- **実効状態は `tacticIds` のみを正にし、`tacticId` は導出値**として扱う方向に揃える
- 旧形式（単独 id 文字列）の読み取りは `normalizeSlots`・`hash-link` の境界に閉じ込める
- `compat.judgeFull` の `candPiece` 差し替えロジックを `constraints.setTactic` と重複なく共有する

### 1-3. 選択文字列（selected）のパース/構築の一元化 [S]

`constraints.parseSel`（`'me.tactic.bougin'` 形式）と `hash-link.encodeSel/decodeSel`（`'mt.bougin'` 形式）は
同じ概念の2つの文法。フォーマット自体は変えず、以下を整理する。

- `'me.castle'` フォールバックが `constraints.normalizeSelected` と
  `board-screen._renderDetail`（`{who:'me',kind:'castle'}` の直書き）に重複しているのを一元化
- `SEL_RE` と `hash-link` の `decodeSel` の正規表現の意味差をコメントで明記

### 1-4. compose.js の分割 [M]

`position()` が448行の単一関数で、盤上の駒配列・持ち駒・ロック・確定集合を
クロージャで共有して進行する。動作は正しいが読みにくい。

- フェーズ（土台構築 → ロック → 副戦法 → core → rest → 金銀正規化 → shell → hand → 検証）
  を名前つきの関数または小さなモジュールに分ける
- 分割は純粋な移動（振る舞い不変）。`merge` は既に別関数なので維持
- 既存の unit-test（matrix スナップショット＋acceptance）が正しさの担保

### 1-5. compat.js の分割 [M]

426行に「compose 評価（evaluate）」「相性表適用（applyPairings）」「fitness 帯（fitnessBand）」
「judge（memo化）」「searchAlternative」「dedupeReasons」が同居。

- 責務ごとにファイル分け（例: `compat-evaluate.js` / `compat-judge.js` / `compat-suggest.js`）か、
  同一ファイル内でセクションを分離する
- メモ（evalMemo/judgeMemo/bandMemo）の配置も責務と一緒に整理する

### 1-6. 依存方向の固定 [S]

実行時に `constraints → compat → compose → defaults/lookup` の参照がグローバル経由で
張られている（`constraints.sides` が `Kakoi.compat.judgeFull` を呼ぶ等）。
循環は `defaults` の分離で既に解消済みだが、依存図を manifest/コメントで明文化し、
新しいコードが逆方向を張らないようにする。

## Phase 2：UI の整理 [M]

Phase 1 が終わってから、大きい UI ファイルに手を入れる。renderKey 等の
描画抑制の仕組み（board-screen）・委譲リスナ（cites）等の**良い部分は残す**。

### 2-1. constraint-field.js の分割 [M]

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
前のフェーズが安定してから。

各フェーズの完了条件は `npm run test:fast` → `npm test` が通ること。
表示に影響し得る UI の整理（Phase 2）では `ui-check.js` のスクショ比較も使う。

## やらないこと

- フレームワーク（React/Vue 等）の導入
- URL ハッシュ形式・データ記法・駒の表記の変更
- `index.html` を直接開いて動く動線を壊す変更（`file://` の維持）
- 戦型ラベルの決定木・両立判定ルール・相性スコアの計算式の変更（将棋の正確さに関わるので別タスク）
