# TypeScript 移行計画：型で囲いを表し、変更に強い基盤にする

dev.md の「TSへの移行」「囲いを型で表す」に対応する本格移行の計画。`plan-dev-infra.md` の B-1（JSDoc + `@ts-check`）はこの計画の Phase 1 に吸収させる。型が固まる前に全面書き換えするのではなく、「ビルド基盤 → 機械的な TS 化 → strict 化」の順に、各段階で `npm test` が通る状態を保って進める。

## 背景（現状）

- ビルド不要の静的サイト。`window.Kakoi` 名前空間に各ファイルが IIFE で定義を足し、読み込み順は `js/manifest.js` が唯一の定義。index.html は manifest を読んで `<script>` を動的に挿入するため `file://` で動く
- `js/` は55ファイル・約8.5k行（`data/` が約2.6k行、`tools/` が約2.9k行）。`"type": "commonjs"`、devDependency は `playwright-core` のみ
- データは手書き JS（`tactics.js` 1228行など）。`'玉78 銀79 …'` の配置文字列や `from`/`family`/`castle` の id 参照の誤りは `validate-castles.js` を回すまで分からない
- テストは `node:vm` + manifest で core/data/logic を1コンテキストに読み込む方式（`validate-castles.js`・`unit-test.js`）。`ui-check.js` はローカル http サーバー + Playwright なので `file://` 非依存
- 配布は GitHub Pages の静的配信（`mikanixonable.github.io/shogi/`）。`js/vendor/three.min.js` は UMD r152
- design-refs HTML は実データをコピーして内蔵しており `js/` を直接読んでいない（移行で壊れない）

## 方針の選択

| 案 | 内容 | 判断 |
|----|------|------|
| A. JSDoc + `@ts-check` のまま | ビルド不要を維持。型の恩恵は補完と限定的な検査 | 却下。「囲いを型で表す」には `satisfies` や template literal 型が欲しく、JS のままでは表現力が足りない |
| B. TS を `tsc` でファイル単位にコンパイル | manifest 順の script 読み込みを維持 | 却下。`Kakoi` 名前空間を残す設計になり、型の import が不自然 |
| **C. ES module 化 + esbuild で IIFE バンドル** | `src/**/*.ts` を1本の classic script `dist/app.js` に束ねる | **採用**。`file://` を維持しつつ普通の import/export で書ける |
| D. ES module のまま配信 | `<script type="module">` | 却下。`file://` で CORS により動かず、README の「開くだけで動く」を失う |

採用構成（案C）:

- `src/` に TypeScript + ES modules。`js/` は移行が進むにつれ消す
- esbuild が2つのエントリから2つの成果物を出す
  - `src/app.ts` → `dist/app.js`（IIFE。ブラウザ用。DOM 起動コードを含む）
  - `src/kakoi.ts` → `dist/kakoi.cjs`（CJS。テスト用の barrel。データ・純関数・クラスを export し、DOM に触れない）
- index.html は `<script src="dist/app.js" defer>` の1本に簡素化。manifest.js と動的挿入は廃止
- テストは vm ではなく `require('../dist/kakoi.cjs')` に切り替える。プリロード・manifest 存在チェック・存在確認フォールバックのコードは全部消せる
- `dist/` をコミットし、`index.html` を直接開く動線を保つ（GitHub Pages もそのまま）。CI で `npm run build && git diff --exit-code dist/` を回して乖離を防ぐ（CI 導入は plan-dev-infra A-4 と一緒でよい）

## Phase 1：型の骨格を先に書く [M]

`js/` のまま型を育てる。成果物は後の Phase で `src/` に移すだけなので、ここで雑に始めてよい。

- `types/kakoi.d.ts` にドメイン型を定義する
  - `Castle` / `Tactic` / `TacticFamily` / `CastleFamily` / `Source` / `Setup`
  - `side: 'ibisha' | 'furibisha'`、`ratings` の5キー（hard/wide/top/side/quick）、`level`・`pace` などはリテラル union
  - 盤面型: `type File = '1'|…|'9'`、`type Rank = '1'|…|'9'`、`type Square = `${File}${Rank}``、`type PieceKanji = '玉'|'飛'|…`、`type Placement = `${PieceKanji}${Square}``。1駒の表記は template literal 型で表せるが、空白区切りの文字列全体は型で縛れないので引き続き validate に任せる
  - アプリ状態: `Slots`（`{me:{tactic,castle}, opp:{…}}`）、`AppState`（store の初期値の形）、`deriveBoard` の返り値 `BoardVM`
- `tsconfig.json`（`allowJs`, `checkJs`, `strict: false`, `noEmit`）と `npm run typecheck` を足し、`js/core/` から `// @ts-check` を付ける
- ここで型の揺れ（id のつづり、欠けたキー）が見つかったらデータ側を直す

## Phase 2：ビルド基盤 [S]

- devDeps に `typescript`・`esbuild` を追加（公開から1週間以上たった版に固定）
- `scripts`: `build`（2エントリ）、`dev`（esbuild --watch + ui-check.js の `serve()` を流用したローカルサーバー、plan-dev-infra D-2 と兼用）、`typecheck`（`tsc --noEmit`）
- **先に現在の `js/` をそのままバンドルしてテストを通す**: `Kakoi` グローバル参照は esbuild が素通しするので、manifest 順に import する shim エントリを書けば現行コードを変更せず束ねられる。ここで `validate-castles` / `unit-test` を `dist/kakoi.cjs` 読みに切り替え、ビルド経路の正しさをコード変更と分離して確認する
- `three.min.js` は esbuild が UMD ごとバンドルできる。型は `@types/three`（r152 系）か、使っている API 面だけ書いた小さい `.d.ts` のどちらか（実際に当ててみて決める）

## Phase 3：TS 化とモジュール化 [L]

manifest の並び（core → data → logic → ui → modes → app）に沿って、ディレクトリ単位で `.js` → `.ts` に変えて `src/` へ移す。バンドルが都度再生成されるので、半分 TS・半分グローバル参照の混在状態でも `npm test` は通る。

- **手順（各ステップで `npm run build && npm test`）**
  1. `src/types.ts` に Phase 1 の型を移し、`window.Kakoi` の型を `declare global` で manifest と突き合わせる
  2. `core/` → `data/` → `ui/` → `modes/` → `app.js` の順に変換。ファイル内の `K.xxx` 参照を import に、`Kakoi.X = …` の定義を export に置き換える
  3. `Kakoi.CASTLES.push(...)` 形式の data ファイルは `export const castlesIbisha = [...] satisfies Castle[]` 形式にし、`src/data/index.ts` で連結して `CASTLES` を export
  4. 全部 import 化したら `Kakoi` グローバルへの依存を消し、`js/`・`js/manifest.js`・index.html の動的挿入を削除。`?debug` 用の `window.__kakoi` だけ app.ts で立てる
- **変換時の注意**
  - `module.exports` は一部ファイルに残っているが tools は vm で読んでおり実質未使用。移行で全部消してよい
  - DOM 系ファイルの `document.getElementById` は nullable になるので、起動時にまとめて null チェックするか `!` を使う方針を CLAUDE.md に書いておく
  - 進行中の UI 作業（worktrees の並行ブランチ）と全ファイル変更が競合する。未コミット・未マージの作業が少ないタイミングで、短いコミットを manifest 順に積む。大きな機能ブランチがあるならそちらを先にマージする

## Phase 4：strict 化 [M〜L]

- `strict: true` を目指し、`noImplicitAny` → `strictNullChecks` → 残り、の順にフラグを上げる。ディレクトリごとに `// @ts-nocheck` を残して段階適用でもよい
- データの id 参照（`from`・`family`・`setup`・`castle`）は、`as const` した配列から `typeof` で id union を導けば型でも検査できる。ただし連結順の制約が増えるので、効果を見て採用判断（やらなくても validate が守る）
- `any` の棚卸し: Store・Repository・各 View の公開面は型を握り、内部実装の `any` は減らすが排除は目指さない

## Phase 5：tools と周辺 [S]

- `validate-castles.js` / `unit-test.js` は `require('../dist/kakoi.cjs')` に一本化（`pretest` で `npm run build`）。`URLSearchParams` の ctx 注入や存在チェックのフォールバック読み込みを削除
- `ui-check.js` は触らなくてよい（http サーバー経由でページを見るだけ）。TS 化するなら `tools/*.ts` を `tsx` で動かす形もあるが優先度は低い
- `hash-link.js`・`tactic-nav.js`・`mini-board.js` は DOM 非依存として `kakoi.cjs` から export し、unit-test の対象を維持する

## Phase 6：仕上げ [S]

- README の「ビルド不要」を「`npm run build` が必要」と更新（`index.html` を直接開く動線は `dist/` コミットで維持する旨も書く）
- `dev.md` の「TSへの移行」行と plan-dev-infra.md B-1 を消化済みにする
- CLAUDE.md / AGENTS 系に新構成（`src/`・バンドル・テストの読み方）を追記
- `js/` と `.gitignore` 周り、worktree での `dist/` 差分の扱いを決める

## 決めること（着手前に確認）

1. **ビルド不要方針の転換を受け入れるか** — dist コミット + file:// 維持なら利用者側の影響はほぼゼロ。 Actions ビルドに寄せるなら dist コミットは不要
2. **file:// 対応を維持するか** — 維持するなら案C（IIFE バンドル）一択。捨てるなら案D（`type="module"` でバンドルすら不要）もあり
3. **移行のタイミング** — 進行中の UI 改修（constraint バーのパズル化など）と全ファイル変更がぶつかる。区切りの良いところで一気にやる
4. **`kakoi.cjs` の公開面** — テストが使う API を洗って barrel に並べる（直近の「公開 API を狭める」コミットと同じ方向）

## 推奨の順序

1. Phase 1（型定義 + `@ts-check`）：ビルド導入前に型の設計を固める。単体でも価値がある
2. Phase 2（esbuild 基盤 + 現行コードのバンドル検証）：コードを触らずに経路だけ作る
3. Phase 3（TS 化）：機能変更を入れず、変換だけのコミットを manifest 順に積む
4. Phase 4〜6 は移行完了後に余裕を見て

## 完成条件

- `npm run typecheck` が `strict: true` で通る
- `npm run build && npm test` が通り、テストは `dist/kakoi.cjs` を require するだけになっている
- `index.html` が `dist/app.js` 1本で `file://` とサーバー経由の両方で動く
- `js/`・`js/manifest.js`・index.html の動的 script 挿入が消えている
- 囲い・戦法のデータが `satisfies Castle[]` / `satisfies Tactic[]` で書かれ、id・キーの誤りがエディタ上で赤くなる
- README と CLAUDE.md が新しい構成を説明している
