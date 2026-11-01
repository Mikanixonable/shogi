# docs/content の調査・提案をアプリに反映する計画

作成日: 2026-11-02 / 対象: `docs/content` の更新分（未コミット差分＋新規2ファイル）→ `js/` `css/` `tools/`
状態: **実行中**

## 方針

- `docs/content/README.md` §4 の推奨順に沿い、WP単位でコミットを切る（日本語・体言止めの件名）
- 各 WP の後に `node tools/validate-castles.js`（0 fail 維持）と `node tools/unit-test.js` を実行
- ユーザーの決定:
  - 範囲: **全 WP 実施**（フェーズ1〜3 すべて）
  - `review-ratings.md` §5-2 の「要判断」7件: **全部適用**
  - UI層名「戦型」→「構え」改名: **保留**（次善案。SENKEI の表示はパンくずで「戦型（細）」等と区別し、層名 `strategy` と内部idは不変）
  - `coverage-castles-remaining.md` の C1〜C3: **§3 の情報からこちらでデータ下書きを作成して反映**

## フェーズ1：小さく影響の大きい修正

### WP1. fun.js 差し替え＋「もう一つ」ボタン修正
`docs/content/review-fun-recheck.md` §3（貼り付け可能な全文・コード片あり）

- `js/data/sources.js`: §3-0 の新規出典7件
- `js/data/fun.js`: §3-1 で全文置換（格言22・ミーム5・動画6、`src` フィールド付き）
- `js/ui/detail-sections.js`: `srcLine`/`proverbHTML` 追加、見出しを「将棋の言葉・出来事」へ、動画節に YouTube 注意書き
- `js/ui/board-detail-view.js`: §3-2 のコードで2バグ修正（`closest('.fun-pv')` null・`pv === cur` の比較ミス）
- `css/layout.css`: `.fun-src` スタイル
- `js/core/validate.js`: `fun()` 追加＋`all()` 組込＋`used` 集計に `src[].ref`
- `tools/validate-castles.js`: `FUN` を渡す

### WP2. 戦型ラベル2件＋出典誤り3件
`coverage-senkei-and-reading.md` §2-3、`docs/content/README.md` §3-7/§3-9

- `js/core/constraints.js`: ①`aiyagura` の1行修正 ②`labels()` の戦型部分を修正案v2に差し替え（明示層優先・タグ交差・横歩片側成立・`implied:true`）
- `js/data/sources.js`: `wj-kakugen`/`wj-shogi-kakugen`（同一URL）を統一、`tactics.js` の参照を揃える
- `js/data/castles-ibisha.js`: `jsf-kuzushi48` の誤用5箇所（gangi・tsunogin の弱点根拠）を適切な出典へ
- `js/data/tesuji.js`: 幽霊角の `kouza-yureikaku`（ドメイン不存在）を差し替え or【要確認】化

### WP3. 最新7戦法の修正
`review-new-tactics-latest.md`（全件に修正案・ratings 案あり）

- `js/data/sources.js`: §4 の新規出典6件を**先に**追加
- `js/data/tactics.js`: 7件の修正案適用（murata-system 主客逆転、gangi-hikikaku「史上最初」削除、yonenaga-kyusen は lead/route/pieces/variantOf 改修、nakata-xp は `overrides:['COUNT']` 付き pairings）
- `js/data/tactic-ratings.js`: §3-6 の7行追加
- `tools/expected-matrix.txt`: 削除→再生成（想定差分3戦法は文書 §3-9 と照合）
- `tools/ui-check.js`: yonenaga-kyusen のセル46→57移動を確認
- 効果: 警告7件（「出典1件」）が全解消

### WP4. 囲い ratings（計19件）
`review-ratings.md` §5 ※C判定7件も全部適用

- 推奨12件（A1-A4・B1-B8）: 貼り付け可能ブロックを `castles-*.js` に適用
- C判定7件の適用値:
  - `nagareyagura` hard 4→3
  - `gangi` hard 2→3、top 5→4（連動して `tsunogin` top 4→3。pros の「上部に強い」は出典に無いので文言も見直す）
  - `ahiru` wide 5→4、hard 3→2
  - `takamino`: 値は据え置き（side 3）、cons の引用 `wj-mino` → 新出典 `sj-takamino`
  - `kinmusou`: side 2→3、hard 4→3（B3 の quick 2→4 と併せて最終 `{3,3,4,3,4}`）
  - `oojun` quick 2→3
- `nakabisha-hidari-anaguma`: `from` を `'furianaguma'`→`'anaguma'`
- `kikusui` cons 追加、`hirame` pros に新出典 `wj-hirame`、`sj-takamino` を sources.js に登録
- `kakuyagura`: `角67` 到達不能 → `hand:'角'` 形式に変更（§3-5）

## フェーズ2：データ追加

### WP5. SENKEI 拡張
`coverage-senkei-and-reading.md` §4・§8

- `js/data/senkei.js`: 下書き12件＋`SENKEI_GROUPS`（任意フィールドのみ、既存5件は不変）
- `js/data/sources.js`: 新規出典7件
- 前提: WP2②（`implied` 判定）を先に

### WP6. 手筋・崩し方の拡充
`coverage-tesuji.md` §5-10 の順序で

1. `js/core/tesuji-check.js` 新設（付録A `check-frames.js` を移植）
2. `js/core/pieces.js` 新設＋`core/tesuji.js` 拡張（成駒・`handGote`・`turn`・`onCastle`・`forCastle`）
3. `js/core/validate.js`: tesuji/proverb/combo 検査を復活、TOKEN に成駒
4. `js/data/tesuji.js`: `hikaefu` 持ち駒修正、`otebisha`、幽霊角対応、下書き7件追加（§6。検算7/7済み）
5. `js/data/sources.js`: 新規出典44件（§7）
6. UI: `detail-sections.js` の `kuzushi()`、`tesuji-modal` 成駒、`board-screen` 急所強調
7. PROVERBS 台帳（§5-9）→ `fun.js` 導出は WP1 の後（任意）

### WP7. 相振り強化
`coverage-tactics-extra.md` §5〜§7

- `js/data/sources.js`: 新規出典11件
- `js/data/tactics.js`: 新規7件＋既存追記（§5-9: against.furibisha 6件・pairings 6件）
- `js/data/combos.js`: COMBOS 5件（§5-7）
- `js/data/tactic-ratings.js`: 7行（§5-9）
- aliases/tags（§7-1）、`pacman-44fu`/`itteson-kakugawari` を `turn:'gote'`、囲い `nakabisha-hidari-anaguma` の desc 加筆
- matrix 再生成（68→75戦法）

## フェーズ3：UI・残件

### WP8. 戦型の UI 反映
`coverage-senkei-and-reading.md` §3-4 ※「構え」改名は保留

- ①右ドック `_senkei`（`board-detail-view.js`＋`SEL_RE`・`hash-link.js` 拡張。SENKEI の表示はパンくずで「戦型（細）」等と区別し、層名 `strategy` と内部idは不変）
- ②河のピルをクリック可能に（`constraint-field.js`。`implied` は点線）
- ③左ドックに戦型チップ（`dock-view.js`/`dock-grids.js`。候補は相手の戦略から決定）
- コラム5本（§6）・trend 統計（§7）は掲載設計が別途必要 → 最後の作業 or 別計画

### WP9. 囲い3件新規下書き＋読み物フィールド
`coverage-castles-remaining.md`（§3情報からこちらで起こす）

- **トーチカ**: family `yagura`/subtype `millennium`、玉89 銀88 金79 金78 銀68 桂77 角66＋完成図20駒。from なし
- **升田美濃**: family `mino`/subtype `hon`、玉79 銀78 金69 金67＋角77、`from:'hidarimino'`。note に金58・角88型も記載
- **金開き**: family `nakazumai`、玉58 金78 金38。from なし
- `millennium` の desc を「6六角型は別項『トーチカ』」に修正、`ahiru` の aliases に「金開き」を入れない（現状確認のうえ）
- `sources.js`: `wj-kinbiraki`（必須）・`wj-ahiru`（別名重複の注記用）を新規登録。`wj-millennium`/`we-castle`/`wj-hidarimino`/`wj-kakoi` は既存
- 読み物フィールド（README §3-2）: `history/origin/steps/players/proverbs` 任意項目＋validate、quality-*.md ③を流し込み

## 残件（文書未完のため対象外）

- `review-ratings.md` §6〜8: 残り20戦法の ratings と付け方規約 → 文書完成後
- `coverage-castles-remaining.md`: A1〜A21・B1-B2・D は未調査
- `coverage-senkei-and-reading.md`: コラム掲載の UI 設計

---

## 実施結果（サブエージェント並列実装＋本線レビュー）

全9WPを実施済み。各WPは `general-swe2` サブエージェントが並列実装し、完了ごとに本線で差分レビュー・補完した（コミットは未作成）。

| WP | 結果 | 本線レビューでの補完 |
|---|---|---|
| WP1 | fun.js 全文置換・出典7件・`srcLine`/`proverbHTML`・「もう一つ」修正・`validate.fun` | そのまま採用 |
| WP2 | `labels()` を v2（明示層優先・`implied`）＋ aiyagura 修正 | そのまま採用 |
| WP3 | 7戦法修正・出典6件・`wj-kakugen` 統一・matrix 再生成 | そのまま採用 |
| WP4 | 囲い ratings 19件（推奨12+C判定7）・`kakuyagura` の `hand:'角'`・`jsf-kuzushi48` 誤用修正 | matrix 再生成のみ追加 |
| WP5 | SENKEI 12件＋`SENKEI_GROUPS`＋出典7件 | used 集計は WP8 が対応 |
| WP6 | `pieces.js` 新設（piece-moves は委譲層に）・`tesuji-check.js`＋`tools/check-tesuji.js`・成駒/`handGote`/`turn`/`onCastle`/`mate` 受理・tesuji/proverb/combo 検査復活・下書き7件＋修正3件・出典44件・`kuzushi()`・モーダル成駒・急所強調 | 本文未引用の出典宣言9件を整理（`wj-kakugen` は proverbs 台帳側へ委譲）＋`app.js` の `?debug` ctx を Node 側と揃えた |
| WP7 | 新規7戦法・COMBOS 5・`against.furibisha` 6件・aliases・`turn:'gote'` 3件 | `ishida` へ pairings 2件（migiyagura・furibisha-anaguma-48kin）を追加 |
| WP8 | 河のピル（2枚・クリック可・implied=点線）・右ドック `_senkei`（パンくず＋大分類ビュー）・左ドック `.dk-senkei` チップ・`senkei` 選択層＋ハッシュ `k`・`labels()` 細分類（rook×pace×style、`sub`/`style` 導線）・表示語「戦型（細）」 | そのまま採用 |
| WP9 | torchika・masudamino・kinbiraki＋読み物任意フィールド（history/origin/steps/players/proverbs）＋ millennium desc 修正 | そのまま採用 |

### 最終検証（全WP統合後）

- `node tools/validate-castles.js` — 89 castles / 75 tactics、0 fail、source errors 0、warnings 38
  - 内訳: 未使用の予約出典37件（§7-1 が次期作業用に登録する分）＋ `yureikaku` の【要確認】1件
- `node tools/unit-test.js` — 184 tests / 0 fail
- `node tools/ui-check.js` — 108 pass / 0 fail / 1 warn（既存の44pxタップ領域警告）
- `node tools/check-tesuji.js` — 全20件合法（詰み・onCastle 整合を含む）

### 実施中の判断

- `kouza-yureikaku` 出典は削除（ドメイン・ページともに不存在）。幽霊角エントリは【要確認】note で残す
- `piece-moves.js` は新設 `pieces.js` への薄い委譲層に変更（二重定義の解消）
- 戦型の UI 表示語は「戦型（細）」（strategy の「戦型」と区別。「構え」改名は保留のまま）
- 手筋の `sources` に `for:'格言'` で宣言されていた `wj-kakugen` は、リンク先 PROVERBS が `[[wj-kakugen]]` を本文引用しているため重複宣言を外した
