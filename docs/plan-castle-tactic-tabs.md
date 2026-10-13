# 移植計画：囲い・戦法タブを playground/shogi へ

lab/shogi の「囲い」(view=`castle`) と「戦法」(view=`tactic`) のタブを、統合画面（board）＋分類マップ（cluster）の2画面構成になった playground/shogi へ復帰させる。

## 0. 前提と決定事項

- 作業途中の未コミット変更（盤面からの周期表 `#ptable` の撤去、`tactic-table-view.js` 削除、ドックの「もう一方の戦略」折りたたみ撤去）は**前提**とする。周期表は戦法タブの中に戻すので、盤面からの撤去はそのまま生かす。
- **閲覧状態は `constraints` と独立**させる（旧版と同じ）。タブで囲い・戦法を眺めても対局図の制約リストは変わらない。「対局図で開く」で明示的に制約へ移す。
- lab 側だけにある囲いの `from:`（発展元）フィールドと詳細の「発展」節も**データごと移植する**。
- 分類マップの詳細にある「盤で開く」ボタンは **囲いタブへ変更**する（旧版の「囲い図鑑で開く」の意味に戻る）。
- データファイル（castles/tactics/tactic-families 等）は playground 側が新しい（`rest`/`hand`/`[[ref]]` 出典トークン付き）。**そのまま使う**。

## 1. 状態・URL・永続化

store の既定値と persist キーに、閲覧用のキーを追加する（旧版と同名）。

```js
castleId: repo.castles()[0].id,   // ※ repo 生成後に決める
familyFilter: null,
lastBySide: {},                   // 戦型ごとに最後に見た囲い
tacticId: repo.tactics()[0]?.id ?? null,
tacticLastBySide: {},
tacticLastByFam: {},              // 系統ごとに最後に見た戦法（周期表ピッカー用）
```

- `attackId` は board と共有の既存キーを使う（旧版も共有だった）。
- URL ハッシュ: `buildQuery` に `c=`（castleId）と `t=`（tacticId）を追加する。`v=castle`/`v=tactic` は旧形式と同じ書式で書き出す。
  - `read()` の変更: `v=castle`/`v=tactic` は**旧形式移行ではなく実ビューとして解釈**し、`castleId`/`tacticId` に直接書く。`v=matchup` と `v=` 無しの断片（`ms=` 等）は従来どおり制約へ変換する。
  - `normalize()` / 起動時の旧形式 `replaceState` は、新形式の `c=`/`t=` が残るようにする（`buildQuery` が両方書くので自然に保たれる）。
- localStorage 移行（app.js の旧形式変換ブロック）: 旧 `view:'castle'` は `castleId`＋`view:'castle'` へ、旧 `view:'tactic'` は `tacticId`＋`view:'tactic'` へ**タブ復元**に変える（いまは制約へ変換して board を開いている）。`view:'matchup'` は変更なし（制約変換のまま）。

## 2. ファイル単位の作業

| # | ファイル | 内容 |
|---|---|---|
| 1 | `index.html` | ① viewSeg に「囲い」「戦法」ボタン（並びは旧版どおり 囲い・戦法・対局図・分類マップ）。② rail に `data-view="castle"` の器（`#sideSeg`/`#familyChips`/`.rail-h`/`#railCount`/`#cards`）と `pane-fill` の `#tacticRail`。③ stage に `data-view="castle"` の器（`.stage-h`＝題名・読み・想定配置、`.stage-f`＝凡例・持ち駒）と `#tacticStage`。④ board-pane の `data-view` を `"board castle tactic"` にし、`.boardwrap` の先頭に `#ptable` を復活。⑤ detail に `#castleDetail`・`#tacticDetail` ペイン。**id 衝突に注意**: `#ttl`/`#title`/`#legend`/`#hand`/`#detail` は board が使用中。囲いタブは `castleTitle`/`castleReading`/`castleSetup`/`castleLegend`/`castleHand`/`castleDetail` のように接頭辞をつける |
| 2 | `js/ui/` にコピー（lab から） | `rail-view.js`（囲いカード一覧＋系統チップ＋矢印キー）、`stage-view.js`、`detail-view.js`、`tactic-rail-view.js`、`tactic-stage-view.js`、`tactic-detail-view.js`、`tactic-table-view.js`（系統ピッカー付きの最新版）。**変更点は `bindCites` のみ**: lab 版は `Kakoi.html.bindCites`、playground では `K.cites.bind`（ui/cites.js）に差し替える |
| 3 | `js/modes/` にコピー | `castle-mode.js`、`tactic-mode.js`。変更点は導線のみ（§3） |
| 4 | `js/core/repository.js` | S1 で削除された3メソッドを復活: `lineageOf(castle)`（from/発展先）、`sourcesOf(castle)`（囲い＋想定配置の出典）、`tacticPositionOf(tactic)`（戦法のみの局面） |
| 5 | `js/ui/tactic-nav.js` | WIP で削除された `lanesOf`/`laneRows`/`fileBadge` を復活（`placeTactics` と共存。周期表と戦法レールが使う）。`tacticRows`/`isRare`/`neighbor` は既存 |
| 6 | `js/app.js` | `VIEWS` を `['board','castle','tactic','cluster']` に。既定値・persist キー追加（§1）。旧 localStorage 移行の `view==='castle'/'tactic'` 分岐をタブ復元へ変更。modes に `castle`/`tactic` を追加（els は §2-1 の id） |
| 7 | `js/ui/hash-link.js` | §1 の通り `buildQuery`/`read` を変更 |
| 8 | `js/data/castles-*.js` | lab の `from:` フィールドを移植（ibisha 4件＋furibisha 4件）。`from` の参照先は validate で検査対象にする（既存の検査があれば通るか確認） |
| 9 | `js/modes/cluster-mode.js` | `_openCastle` を board 遷移から `store.set({ view:'castle', castleId:id, attackId:null })` へ変更 |

## 3. 導線の変換（mode 内の `store.set`）

旧版は `matchup` オブジェクトを書いていた。playground では `constraints.apply` を順に適用する。

| 操作 | 旧 | 新 |
|---|---|---|
| 囲い詳細「対局図で開く」 | `view:'matchup'` + me の3層 | `apply` を strategy → tactic（`STRATEGIES[side].defaultTactic`）→ castle の順に適用し、`view:'board'`, `selected:'me.castle'` |
| 戦法詳細の囲いボタン（tc-castle） | `view:'matchup'` + me.{strategy,tacticId,castleId} | `apply` を同じ順で（strategy は系統の side）、`view:'board'`, `selected:'me.tactic'` |
| 戦法詳細「→」（囲いの画面へ） | `view:'castle'` + castleId | そのまま（`familyFilter` の整合は旧版の規則を引き継ぐ） |
| 分類マップ「盤で開く」 | `view:'board'` + me.castle | `view:'castle'` + castleId（決定事項③） |

## 4. 画面構成と CSS

- `css/layout.css`: `castle`/`tactic` 用の view-pane 表示規則を追加（`body[data-view="castle"] …` の2組＋`.pane-fill` 版）。lab の layout.css から `.fchips`/`.fchip`/`.cards`/`.card`/`.rail-h`/`.stage-h`/`.setup`/`.rd .setup` 等のブロックを復元。`.ttl`/`.rd`/`.swap` は既存を再利用。
- `css/tactics.css`: WIP で削除した `.ptable`/`.pt-*` と、lab だけにある `.tr-list`/`.tr-row`/`.tr-item`/`.ln-row` を復元。`.ptable` の表示は従来どおり `body[data-view="tactic"]` スコープ（board/cluster では `display:none` のまま）。
- `css/matchup.css`: `.mu-open`（「対局図で開く」ボタン）を復元（または layout.css へ移す）。
- 持ち駒列 `#handOpp`/`#handMe` は `body[data-view="board"]` のときだけ表示（castle/tactic では中身が残っていても見せない）。戦法タブの持ち駒は旧版どおり `.stage-f` の `.hand`（`castleHand` とは別要素）に出す。
- 周期表が `boardwrap` に書く `--pt-rows` インライン変数は view をまたいでも残るが、`.ptable` 非表示なので実害なし。

## 5. 実装フェーズ

| フェーズ | 内容 | 完了条件 |
|---|---|---|
| T0 骨格 | index.html のペイン・セグ・id 確定、view-pane CSS、manifest に新規ファイル登録（空のモードでも可） | タブを切り替えると3パネルが空で切り替わる |
| T1 囲い | repository 3メソッド、rail/stage/detail ビュー、castle-mode、CSS、`from:` データ | 囲いタブが lab 版と同じ見た目・操作（系統チップ・矢印キー・攻め筋の盤表示）で動く |
| T2 戦法 | tactic-nav の3関数、tactic-* ビュー、周期表、tactic-mode、ptable CSS | 周期表・系統ピッカー・順に再生・相性のよい囲いが動く |
| T3 導線・URL | hash-link、localStorage 移行、cluster-mode の行き先変更 | 新旧ハッシュの往復、`v=castle&c=funa` が囲いタブで開く |
| T4 検証 | ui-check の view/seg 期待値更新、ハッシュ往復ケース、スクリーンショット | `npm test`（validate＋unit-test＋ui-check）が通る |

## 6. 注意点・リスク

- **キー衝突なし**: `constraint-mode` の矢印キーは `data-view==='board'`、戦法・囲いのキーは `data-view==='tactic'`/`'castle'` でガード済み。混線しない。
- **ツールバー**: `mode`/`heat`/`skeleton`/`heatScope` は全ビュー共通。囲い・戦法のモード実装がそのまま消費する（骨格線は囲いのみ。旧版と同じ仕様）。
- **detail ドロワー**: `#detailToggle` は既存どおり view に関係なく効く。
- **`sides()`/`apply` の依存**: 「対局図で開く」は `K.constraints.apply` を3回順に呼ぶだけでよい（連鎖解決は apply がやる）。
- **再生の停止**: 他タブへ移るとき `leave()` で `player.stop()`（旧版と同じ）。cluster↔board 間の既存遷移には影響しない。
- **ui-check**: 盤の矩形不変の検査（F1）が castle/tactic でも通ること。周期表の高さは `--pt-rows` で盤から引くので、戦法タブでは盤が小さくなるのは仕様（旧版と同じ）。
