# 開発基盤の計画：速く・正確に・並行して作る

機能とデータが増え、手作業の確認・データ記述・指示の伝え直しにかかる時間が目立ってきた。ここでは機能追加ではなく「開発そのものを速くする基盤」をまとめる。各項目は独立しており、上から順に取るのを推奨する。

## 背景（現状）

- ビルド不要の静的サイト。`window.Kakoi` 名前空間、読み込み順は `js/manifest.js` が唯一の定義
- テストは `validate-castles.js`（データ）・`unit-test.js`（純関数）・`ui-check.js`（Playwright で E2E とスクショ）の3段。`npm test` 全体で約46秒かかり、大半は `ui-check`
- データは手書きの JS（`tactics.js` 1118行、`castles-ibisha.js` 677行）。駒配置は `'玉78 銀79 …'` の文字列で、誤りは validate を実行するまで分からない
- バックログは `dev.md` に未整理で積まれ、完了と未完了が混在。`docs/plan-*.md` は10本に増え、ルートには `design-refs-*.html` が8本ある
- CLAUDE.md がなく、Claude との作業では前提（manifest、駒の表記、`[[ref]]` 出典記法、design-refs の作り方）を毎回コードから読み直している
- CI はない。`.claude/worktrees/` での並行作業が始まっている

## フェーズ A：すぐ効く

### A-1. CLAUDE.md [S]
次の内容を書いておく。
- 方針：ビルド不要、新しいファイルは `manifest.js` に登録する
- データの書き方：`core/shell/rest/filler/hand/from/flex` の意味（`castles-ibisha.js` 冒頭のコメントを要約）、駒の表記、出典 `[[ref|ref2]]`、正式名称と別名の扱い
- テストコマンドと、どの変更でどの層を回すか
- design-refs の置き場所・命名・形式（複数案を並べて比較する HTML）
- コミットの粒度とメッセージの流儀

指示の伝え直しが減り、Claude の出力のぶれも小さくなる。

### A-2. テストを速い層と遅い層に分ける [S]
- `npm run test:fast`：`validate-castles.js` と `unit-test.js` だけを数秒で回す
- `npm run test:ui`：今の `ui-check.js`
- `npm test`：両方（今と同じ）
- Claude Code の hook（PostToolUse）を設定し、`js/data/*` を編集したら自動で `validate-castles.js` を走らせる。データの誤りを書いた直後に捕まえられる

### A-3. 置き場所の整理 [S]
- `.gitignore` に `.claude/worktrees/` を追加する
- ルートの `design-refs-*.html` と `design-refs-board/` を `design/` に移し、一覧ページ `design/index.html` を置く
- 完了した計画書は `docs/archive/` に移す
- `dev.md` を「未着手／進行中／完了」に分ける。完了済みの項目は消すか archive に回す

### A-4. GitHub Actions で CI [S]
- PR ごとに `npm test` を実行する。ubuntu ランナーには Chrome が入っているので、`ui-check` の `launch()` はそのまま動く見込み
- `tools/shots/` を artifact として保存し、PR 上でモバイルやダークモードの見た目まで確認できるようにする

## フェーズ B：開発体験を一段上げる

### B-1. JSDoc + `@ts-check` による段階的な型チェック [M]
dev.md の「TSへの移行」「囲いを型で表す」には、いきなり TS に移すより、ビルド不要の方針を保ったまま型の恩恵を受ける方法から始める。
- `types/kakoi.d.ts` に `Castle` / `Tactic` / `Source` / `Setup` を定義する。`side: 'ibisha' | 'furibisha'`、`ratings` の5キー、`family`・`pace`・`level` などはリテラル型にする
- 駒1つの表記は `` `${Piece}${File}${Rank}` `` の template literal 型で表せる。空白区切りの文字列全体は型では表しにくいので、引き続き validate で検査する
- `tsconfig.json`（`allowJs`, `checkJs`, `noEmit`）を置き、`npm run typecheck` を足す。まず `js/core/` から `// @ts-check` を付けていく
- エディタで補完が効き、`from`・`castle` などの id の参照ミスも型で検出できる
- 本格的な TS 移行は、この段階で型が固まってから判断する

### B-2. 盤面エディタと SFEN 取り込み（`?debug`）[M]
- 盤のマスをクリックして駒を置く・消すと、`玉78 銀79 …` の文字列がクリップボードに入る
- 将棋ソフトや棋譜サイトの SFEN を貼ると、プロジェクトの表記（先手の駒、後手の `gote`、持ち駒の `hand`）に変換する
- 囲いや戦法の追加が速くなり、配置の正確さも上がる。変換は純関数として `js/core/` に置き、`unit-test.js` で検査する

### B-3. 確認用ギャラリー（`dev/gallery.html`）[S]
- 全囲い・全戦法のミニ盤と、主要な組み合わせ（`expected-matrix.txt` の行）を1画面に並べる
- 「将棋としての正確性をレビュー」は、データを1件ずつ開くより一覧で眺めるほうが速く、ずれも見つけやすい
- 既存の `mini-board.js` と `compose.js` を流用できる

### B-4. スクリーンショットの差分比較 [S〜M]
- `ui-check.js` が撮っているスクショを基準画像として保存し、pixelmatch で比べる
- 「切り替え時にサイズが微妙に変化したり揺れたりする」崩れは、切り替えの前後でスクショを撮り、要素の矩形の差分を見れば機械的に検出できる
- 意図した変更のときは、基準画像を更新するコマンド（例: `npm run shots:accept`）で上書きする

## フェーズ C：将棋としての正確性を担保する

### C-1. 簡易の指し手生成器による到達検査 [M〜L]
- 先手の駒の動きだけを扱う簡易の指し手生成器を `js/core/` に置く（純関数で、Node とブラウザの両方で動かす）
- 検査する内容
  - 発展元（`from`）の囲いから、その囲いに妥当な手数で到達できるか
  - 二歩や、行き所のない駒がないか
  - 解説にある手数（「3〜4手で完成」など）が、初期配置や `setup` からの最短手数と合っているか
- 結果は `validate` の warning として出す。データの正しさを人の目だけに頼らずに済む

## フェーズ D：Claude と並行して開発するための基盤

### D-1. プロジェクト専用の skill / スラッシュコマンド [S〜M]
- `/add-castle`：必須項目（core/shell/rest/filler/ratings/pros/cons/attacks/sources）のチェックリスト → validate → その囲いのスクショを撮って確認、までを1コマンドにする
- `/design-ref`：design-refs をいつも同じ形式で出力する（複数案を並べ、案ごとに意図を短く添える）
- `/shot <hash>`：指定した URL 状態のスクショを撮って確認する。ハッシュで状態を表す仕組み（`hash-link.js`）が既にあるので流用できる

### D-2. ワークツリーごとの開発サーバー [S]
- `npm run dev` で、空いているポートに簡易サーバー（ライブリロード付き）を立てる。`ui-check.js` の `serve()` を共通モジュールに切り出して流用する
- `.claude/worktrees/*` での並行作業でも、それぞれの画面を同時に開いて比べられる

## 推奨の順序

1. A-1（CLAUDE.md）
2. A-2（テストの分割と hook）
3. B-1（JSDoc による型チェック）
4. B-2（盤面エディタと SFEN 取り込み）

A-1・A-2 は即効性があり、B-1・B-2 はこれからのデータ追加（舟囲い5七銀型の追加や、正式名称の変更など）の速さと正確さに直接効く。A-3・A-4 は合間に取れる。

## 完成条件

- `npm run test:fast` が数秒で終わり、データの編集時に自動で走る
- CLAUDE.md があり、データ追加とデザインリファレンス作成の手順がそこから読み取れる
- `npm run typecheck` が `js/core/` とデータファイルで通る
- SFEN を貼るだけで、囲いのデータの駒配置が書ける
- PR ごとに CI でテストが回り、スクショを確認できる
