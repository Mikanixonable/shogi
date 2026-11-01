# 総合バグ調査（2026-11-01）

ロジック（compose/compat/constraints/hash-link）とUI（表示崩れ・操作・起動時の異常系）を
対象にした総点検の結果と修正記録。調査は vm ハーネス（tools/audit の手法に倣った
使い捨てスクリプト）と Playwright の実機プローブで行った。

## 方法と確認済みの健全さ

| 検査 | 規模 | 結果 |
|---|---|---|
| compose 総当たり（両立する戦法×囲い×戦型） | 1,990局面 | 駒重なり・盤外・二歩・枚数違反なし |
| 明示選択の ng → conflicts への到達 | 3,000ケース | 全件一致 |
| スロット操作列（set/remove/clear/normalize混在） | 2,000ケース | 冪等・同駒1枠・例外なし |
| suggest の候補は本当に ng でないか | 28,068候補 | 全件 ng でないことを実判定で確認 |
| ハッシュ往復（buildQuery→parseHash→normalize） | 500ケース+悪意入力 | 一致・例外なし |
| judge と judgeFull の level 一致性 | 3,000ケース | 一致 |
| 戦型ラベルの排他性（L9 再確認） | 2,000ケース | 複数同時出現なし。6種すべて出現 |
| deriveBoard の純粋性（入力不変・決定的） | 400ケース | 一致 |
| 複数戦法の合成 | 600局面 | 健全 |
| combos データ・comboOf | 7件 | id実在・検出される |
| 実機:盤のサイズ/位置の不変条件 | 3幅×60操作連打 | 幅・x位置とも不変（F1/F2の残りなし） |
| 実機:モンキー操作+高速連打 | 3幅 | JSエラー0、盤消失なし |
| 実機:トースト「元に戻す」/Esc/Delete/roving | — | 直前1手に戻る・閉じる・胞を外せる・フォーカス保持 |
| 実機:?flat / WebGL無効化 | — | DOM駒へ正常にフォールバック（19駒） |
| 実機:不正ハッシュ・壊れた localStorage | 6パターン | 例外なし・初期状態で起動 |

ui-check は調査前後とも 106/106 PASS（w=360 のタップ領域 44px 未満の警告1件は既知）。
validate-castles は 86囲い・68戦法 OK、警告7件は sources 1件のみの既知のもの。

## 修正済み

### F-1（P0）合成局面から玉が消える [js/core/compose.js]

- 再現: 戦法 `aigakari`＋囲い `hirame`、戦法 `chikatetsubisya`＋囲い
  `hashigyoku-ginkanmuri` を選ぶと、盤に玉が1枚も描かれない局面になる。
- 原因: core の目標マスがロック駒（essential/主役）に塞がれると SQUARE 衝突を記録して
  その駒を置かない（`placeCore`）。この間に別の core/rest 駒が玉の元位置を取ると、
  玉は持ち駒に送られたまま戻らなかった。
- 対応: 全配置ステップの後（二歩検証の前）に玉の救出を追加。盤に先手玉が無ければ、
  持ち駒の玉を元の位置から moveCount が最小の空きマスへ戻す。重なり自体は従来どおり
  SQUARE 衝突として報告される（例: 救出後 `aigakari+hirame` → 玉48）。

### F-2（P1）制約フィールド右端の胞が全幅で切れて押せない [js/ui/constraint-field.js]

- 再現: どの画面幅でも「自分=居飛車」のとき、戦法ドミノのうち玉の筋（列12-13）は
  完全に、金の筋（列10-11）は半分以上がフィールドの右端からはみ出す。
  胞も当たり判定のボタンも `overflow:hidden` で切れ、見えず・押せず・Tabでも見えない
  ボタンにフォーカスが行く状態だった（390px/1440px で実測）。
- 原因: 六角グリッドの viewBox 幅 W=395 が固定だったが、居飛車の7系統
  （FAMCOL 飛0,銀2,角4,桂6,歩8,金10,玉12 + ドミノ幅1列）は x≈481 まで必要。
- 対応: コメントの意図（「中身の幅いっぱいに viewBox を切る」）どおり、viewBox の幅を
  最右の胞＋余白まで動的に広げるよう変更。ヒット層・×ボタン・「＋相手」胞・
  相手囲い名の % 換算も同じ動的幅に統一。全胞が表示・押下可能になったことを
  390px/1440px で実測確認。胞は従来より約2割小さく描かれる。

### F-3（P0）手筋モーダルが開かない [js/ui/tesuji-modal.js]

- 再現: ヘッダーの「手筋と格言」を押すと
  `pageerror: this.repo._resolveSources is not a function` で _render が落ち、
  ダイアログが開かない（機能が完全に死んでいた。ui-check の対象外で見落とされていた）。
- 原因: コアAPI整理（`resolveSources` 公開化）のとき旧プライベート名の呼び出しが残った。
- 対応: `this.repo.resolveSources(all)` に修正。モーダルが開き13枚のカード・出典が描画
  されることを確認。

## 残課題（優先度つき）

| 優先度 | 番号 | 内容 | 根拠 |
|---|---|---|---|
| P1 | R-1 | merge の 'ng' 接触（歩以外・双方の退避先が塞がる歩同士）が conflicts に届かず、制約胞に ✕ が出ない。盤には赤い接触印が出るので完全に無音ではないが、「両立」としては無印。約800ケースの無作為調査で64件の接触のうち7件が無印（例: `横歩取り+へこみ矢倉` × `新石田流+ちょんまげ美濃` の 3四で飛どうし、76での歩×飛） | 監査H節。接触は overlay+詳細に出るが、制約の整合とは別系統でしか表面化しない |
| P2 | R-2 | w=360 で制約フィールドの胞ボタンが実効 31〜38px（44px 未満） | ui-check の既存 WARN。六角グリッドの実寸由来 |
| P2 | R-3 | `matchup.threat(null, null)` が `相振り飛車` という作られた結果を返す。アプリ経路では null 呼び出しは無い（deriveBoard は両側の実効値を渡す）が、防御的には null/例外が自然 | matchup.js。影響範囲なし |
| P3 | R-4 | `.dk-item` が scrollWidth 101px / clientWidth 94px。絶対配置の `.dk-seal`（基本バッジ）由来で実際の文字切れは未確認 | 実機 clipped scan |
| P3 | R-5 | モバイルのヘッダー小ボタン（`BUTTON.about` 等）の scrollWidth が数px超過。アイコン化表示のため実害は薄い | 同上 |

## 調査で再確認できた旧計画（plan-fix-unified.md）の消化状況

- L1（囲いの rest で残留駒）: 消化済み。compose に castle.rest の配置がある
- L2（ok の overrides）: 消化済み。compat.js に overrides 処理あり
- L3（届く判定の手数BFS）: 消化済み。moveCount を使用
- L4（起動時の正規化）: 消化済み。不正ハッシュ・壊れた保存値で初期状態になることを実機確認
- L7（外した後の ng 残り）: 3,000ケースで再現せず
- L9（戦型ラベル複数）: 2,000ケースで再現せず。排他的決定木が効いている
- L10（歩の接触で下げ先が塞がる）: 処理あり（'ng' 接触として記録。R-1 はこの表出経路の話）
- F1/F2（盤の揺れ・縮み）: 3幅×無作為60操作で盤幅・x位置は不変
- U2（トーストの元に戻す）: history.back 式。直前の1手に戻ることを実機確認
- U3（矢印キー/フォーカス）: roving + 差分更新でフォーカス保持を実機確認
- S4（メモの無制限増加）: evalMemo/judgeMemo/bandMemo/evalCache すべて共有 LRU 化済み
- 歩の横滑りアニメーション（dev.md）: moveCost が歩・香の横・後退を null にして防止済み

## 残課題の修正方針

### R-1（P1）merge の 'ng' 接触を制約の ✕ にも届ける

**設計判断**: 現状の「盤に赤印が出るが制約胞は無印」は、ユーザーに「両立」の誤認を与える。
接触は選択の結果なので、制約の不一致としても表面化させる方が一貫する。

**方針A（推奨）**: `deriveBoard` で merge の `contacts`（kind='ng' のみ、pawn は解消済みなので除く）
を conflicts に接続する。帰属は接触した駒の role から層へ写す:

1. `lead` → その側の該当戦法 id（`lead.square` と接触マスが一致する戦法。複数あれば共有扱い）
2. `core` / `rest` → `'castle'`
3. `setup` / `support` → layers なし（共有＝両側の全明示層にかかる）

実装場所は `js/core/board-model.js` の `deriveBoard` 末尾: `merged.contacts` の 'ng' を
`{ code:'CONTACT', squares:[c.sq], layers:[...], text:c.text }` の理由に変換し、
`conflicts()` と同じ hitsLayer 規則で `d.ng[who].tactic[id]` / `d.ng[who].castle` に追記する。
既存の表示経路（胞の ✕・点線・detail の理由一覧）にそのまま乗るので、
UI 側の変更は原則不要。`text` は merge が作る説明文を流用（「3四で飛と飛が重なる」）。

- 注意: 戦法の `lead.piece` が setup の駒と重なる場合など、片側にしか帰属しない接触もある。
  その場合は帰属した側だけ ✕ を出す（もう片側は共有理由があれば全層）。
- 後方互換: `d.ng` の形状は変えず理由を足すだけ。conflicts() 自体は pure のまま保ち、
  接続は deriveBoard 側に閉じ込める（unit-test からも検査できる）。
- 検証: 監査H節と同じ総当たりで「merge-ng が出たら必ず d.ng が空でない」ことを不変条件にする。
  逆に d.ng があるのに接触が無いケース（従来の SQUARE/SIDE 系）はそのまま残す。

**方針B（却下）**: 接触専用の警告ピルを河（labels 列）に出す案。実装は軽いが、
「両立しない」が ✕ とピルの2系統に分かれ、既存の理由一覧・胞の強調と連動しないため。

### R-2（P2）w=360 の胞タップ領域 44px 未満

- 現状: 胞ボタンの実効高さが 31〜38px（viewBox の hex 実寸由来）。WCAG AA の 24px は満たすが
  ui-check の 44px 基準を下回る。
- 方針: `.cf-hit` の当たり矩形を、胞の外接矩形から行ピッチの中間まで上下に広げる
  （`w2.y/h` の拡張。隣接行との重なりは半分ずつ折り合い、先勝ち or z-index で調整）。
  ドミノ左右方向は既に胞+gap を含むので、主に縦の余白を `rowH*0.25` ずつ足す。
- 合わせて `.cf-x`/`.cf-clear`（18px/22px）も、外側へはみ出した当たり判定を 24px 以上に広げる
  （胞本体と重ならない右上方向の帯に限る）。
- 検証: ui-check のタップ領域計測を流用し、w=360 で全胞 44px 未満の警告が消えるか
  少なくとも悪化しないこと。広げすぎて隣の胞を誤タップしないことを目視で1件確認。

### R-3（P2）`matchup.threat(null)` が作られた結果を返す

- 方針: `matchup.threat(me, opp)` の先頭に `if (!me || !opp) return null;` を足す。
- 呼び出し側の確認: 現行の到達可能な呼び出しはすべて非null
  （`constraints.labels` はガード済み、`board-detail-view` は `other &&`、
  compat は `layer==='castle' && opp` の内側）。戻り値が null になりうるのは
  直接呼び出しだけなので、fitness 系の呼び出しは `th ? ... : 中立値` で受ける形にしておく。
- 検証: `threat(null,null)===null`、`threat(me,null)===null` を unit-test に1行足す。

### R-4（P3）`.dk-item` の scrollWidth 超過

- 実質は `.dk-item[aria-current]::before`（right:-7px の ✓ バッジ）がカードの外へ
  はみ出す設計。表示上の破綻ではない。
- 方針: 見た目の意図（枠外に判子がかかる）を残すなら現状維持で「既知」とする。
  静かにするなら `right:-1px` 内側寄せに変えるだけ。優先度は低い。

### R-5（P3）モバイル小ボタンの scrollWidth 超過

- `BUTTON.about` 等はアイコン表示に対し textContent が残って計測だけ超過している。
- 方針: `.about` 系ボタンに `overflow:hidden`（または幅を text-indent で押し出した
  視覚隠しに変更）を当てる。数行の CSS で済む。合わせて `aria-label` が残っていることを確認。

## 未着手・今後の候補

- 将棋データの正確さの本格照合（今回は軽量チェックのみ。validate は通過）
- `tools/` の使い捨てスクリプト（_repro 等）と .scratch-review の整理
- 監査で使った不変条件（merge-ng→conflicts 到達・胞の可視性）を
  unit-test / ui-check に恒常化するかどうか（R-1・F-2 の回帰防止になる）
