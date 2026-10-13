# 将棋の囲い図鑑

囲い・戦法・戦型を盤面で見比べる静的サイト。制約（戦型・戦法・囲い）を自分側と
相手側に積み上げると、3層（戦略テンプレート・戦法・囲い）を合成した局面が
盤に描かれ、両立しない組み合わせは差し替えや理由付きの注記で示される。

ビルド工程のない純粋な HTML/CSS/JS で、すべてのデータとロジックはブラウザの
`window.Kakoi` 名前空間に読み込まれる。

## 使い方

`index.html` をブラウザで直接開くか、任意の静的サーバを立てる:

```
npx http-server .
```

GitHub Pages での公開は、このディレクトリ（またはリポジトリルート）を
Pages のソースに指定すれば `index.html` がそのまま配信される。

## 画面の構成

- **左ドック**: 上=相手・下=自分の選択パネル（アコーディオン収納可）。戦型
  （居飛車/振り飛車）・戦法・囲いをそれぞれの側に積む
- **中央ステージ**: 相手がいるときは相手の状態名＋制約バーが盤の上、自分の
  ものが盤の下（相手なしのときは自分のものが盤の上）。持ち駒は伝統記法で
  相手=盤左・自分=盤右
- **制約バー**: 選んだ制約が `#名称` チップで並ぶ。破線＋「既定」は暗黙の
  補完値（戦略・既定囲い）。チップの ×、または「相手/自分/すべてをはずす」
  ボタンで解除する
- **右ドック**: 選択中の制約の詳細（ペンタグラム評価・強み弱み・攻め筋・出典）

## ディレクトリ構成

- `index.html` — アプリのエントリ。`<script>` の列挙は `js/manifest.js` と整合
- `css/` — layout / dock / board / constraint / tactics / detail ほか
- `js/core/` — DOM 非依存のロジック（`notation` `position` `compose`
  `constraints` `compat` `matchup` `piece-match` `validate`）
- `js/data/` — 囲い・戦法・想定配置・出典などのデータ（`castles-*.js` の
  `core/shell/filler/leave/flex` が合成の材料）
- `js/ui/` — 盤描画・ドック・制約バー・サムネイルなどのビュー部品
- `js/modes/` — `constraint-mode.js`（盤モードの配線）
- `tools/` — 検証スクリプト群（下記）
- `docs/` — 設計・実装計画書

## 検証

```
node tools/unit-test.js          # 合成・両立判定・制約の単体テスト
node tools/validate-castles.js   # 囲い・戦法データのスキーマ検査
node tools/ui-check.js           # ブラウザ巡回の UI チェック（要ブラウザ同梱）
```

`tools/unit-test.js` は `tools/expected-matrix.txt`（戦法×囲いの両立
マトリクスのスナップショット）と照合する。意図した判定変更のときは同
ファイルを消して再生成する。

## 合成モデルの要点（js/core/compose.js）

- 土台は戦法の局面図、戦法がなければ戦略テンプレート（既定囲い＋想定配置）
- 戦法の essential ∪ 主役（lead）のマスはロックし、囲いは原則それを追い出さない
- `castle.core` → `castle.shell` の順に置く。`filler` は比較専用で置かない
- `castle.leave` で「その囲いではその駒がいない」を宣言できる
  （`金58` = マス指定、filler→初期位置→持ち駒へ退かす。`角` = 盤上全体→持ち駒）
- `castle.flex` で core の目標マスが塞がれたときの崩し形の逃がし先を定義
