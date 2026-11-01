# 次のアクション計画：共有・拡張・検証

「囲い図鑑＋戦法周期表＋分類マップ」の3画面と、戦法×囲いの重ね合わせ・立体駒が揃った。ここから先は「見せる・増やす・守る」の3軸で進める。各項目は独立しており、順不同で取れる。

## 背景（現状）

- 18囲い（居飛車12/振り飛車6）・12戦法・系統5。データは `validate-castles.js`、画面は `ui-check.js`（18項目・5幅・明暗）が通る状態
- 戦法の局面に囲いを重ねる `combo`、立体駒レイヤ（既定）と DOM レイヤ（`?flat`）、`piece-match` の駒種コスト対応づけ、攻め筋・骨格線・経路のオーバーレイ
- 前回の計画書 `plan-accuracy-combo-and-3d.md` の完成条件はすべて消化。未消化は「任意」とした Q4（合成局面の validate）と Q6（`#`タグを絞り込み導線に）だけ

## フェーズ A：見せる（共有と導線）

### A-1. 状態を URL に載せる [S〜M]
`view / castleId / tacticId / tacticCastleId / attackId / mode / skeleton / heat / heatScope / familyFilter / clusterFamily` を `location.hash` にシリアライズし、「この囲い」「この組み合わせ」への直リンクを可能にする。`?debug`・`?flat` はそのまま残す。
- `js/ui/store.js` の保存・読込に hash を併記する形が自然（localStorage は起動時の既定として残す）
- ハッシュから起動したときの sanitize（`app.js` の `repo.has` 等の検証）を共通経路に通す
- 例: `index.html#view=tactic&tactic=bougin&castle=yagura`

### A-2. 任意の囲いを重ねる [S]
`combinePosition` は汎用だが、UI は「相性のよい囲い」列挙分しか選べない（`tactic-detail-view.js` の `.tc-castle`）。`sodebisha` は `castles:[]` で導線すらない。全囲いを選べるセレクタ（ドロップダウン or 小さな一覧）を足す。合成関数は変更なしで済む。
- 逆方向（囲い画面から「この囲いに合う戦法を重ねる」）も視野に入れる

### A-3. `#`タグを絞り込み導線に [S]
詳細の `#`タグ（系統・タイプ・別名）は装飾止まり（`detail-view.js`）。押すと同系統に絞り込む / 関連囲いへ飛ぶ動線にすると、タグの情報量が活きる（旧計画の Q6）。

## フェーズ B：表現を広げる

### B-1. 攻め筋にも経路矢印を [S]
`overlay.route(..., { tone:'bad' })` は対応済みだが、castle 画面の攻め筋は `gote 配置＋target マス` の表示のみ。`attacks` データに手順の経路（戦法の `route` と同形式）を持たせ、`castle-mode.js` で矢印を引く。狙いが「点」から「線」で伝わる。

### B-2. 立体駒の質感と成駒 [M]
- 駒の輪郭線：DOM 版の `--piece-edge` に相当する墨枠を、EdgesGeometry か台座側ベベルの強調で足す
- 成駒（と・馬・竜・杏・圭・全）：`PIECE_CHARS`・notation の TOKEN・validate・駒面アトラス（朱の裏面）まで波及するため、需要が出た時点で。現データに成駒はいない
- カメラ：真上の Orthographic 固定を「やや俯瞰の等角」に切り替えるスイッチも面白い（駒の厚みが視認できる）

### B-3. 分類マップの操作 [S〜M]
- 葉・枝へのキーボード移動（`leaves()` 順で ↑↓、Enter で選択）。castle/tactic は矢印対応済みで cluster だけ未対応（F2）
- カット線 `k=5` 固定をドラッグまたは ± で変えられると「何グループに切るか」が対話的に分かる
- 囲いが増えたらズーム・部分木折りたたみが要る（現18葉では不要）

## フェーズ C：データを増やす・揃える

### C-1. 一間飛車の欠落 [S]
周期表の 1 筋が空欄（計画書の表は「（一間飛車）」を想定、`docs/plan-tactics-and-clusters.md`）。`kyukenbisha` の別名扱いか独立項目化かを決めて、少なくとも空セルを意味のある表示にする。`wj-ikkenbisha` の出典は登録済み。

### C-2. 囲いの追加（継続）[M/件]
偏りがある: 振り飛車は美濃系5＋穴熊1、居飛車は雁木系が手薄。候補: 金美濃・銀冠穴熊・木村美濃・中住まい・金無双・天守閣美濃 / 銀矢倉・角矢倉・菊水・へこみ矢倉・右玉・ミレニアム・松尾流穴熊・ビッグ4。1件につき core/support/ratings/attacks/sources が要る。`shape` の系統記述と `validate` で整合を確認。

### C-3. 出典の偏り [S]
美濃系4件（katamino/takamino/gincan/diamond）が `wj-mino`＋`we-mino` の下限ぎりぎり2件のみ。書籍・連盟系の出典で補強する。

### C-4. 戦法の評価軸 [M]
囲いには5軸ペンタグラムがあるが戦法には無い。「速攻性 / 持久力 / 定跡量 / 対応範囲 / 先手を取れる度」など軸を設計し、戦法詳細にも図を出すと対称になる。

### C-5. 後手・対振り飛車視点 [S〜M / L]
`side` は戦型であって手番ではない。まずは盤の左右反転で「後手から見た囲い」表示（新規データ不要）。後手固有の囲いデータを入れるのは L。

## フェーズ D：守る（検証とアクセシビリティ）

### D-1. 純粋ロジックの単体テスト [S]
tools/ に `validate`（データ）と `ui-check`（E2E）はあるが単体テストがない。`piece-match.moveCost` の罰則表・`pair`・`combinePosition`・`shape`・`tactic-nav.neighbor`・`attack-map`・`notation` はすべて純関数で、vm 読み込みの土台は `validate-castles.js` にある。`3dp/src/*_test.js` と同じ `check()/ok()` の流儀で `tools/unit-test.js` を足す。

### D-2. 合成局面の validate [S]
旧計画の Q4（任意）を回収。全 `tactic.castles` 組み合わせで ① 先手20枚＋後手 ② 主役が元のマスに残る ③ 囲い core が目標へ配置 ④ マス重複なし を検査（P4 で手元スモーク済み。tools に恒久化する）。

### D-3. 盤の代替テキストとキーボード到達 [S]
- 駒は canvas/div でスクリーンリーダーに届かない → 局面のテキストサマリ（「７八玉・６八金…」）を visually-hidden か `aria-live` で
- `data-sq` の強調（長所/短所・経路・囲いの駒）が mouseover 専用 → `focusin/focusout` も効かせる
- cluster のホバーカードはポインタ追従のみ → タップ/ピン留め
- reduced-motion の扱いは既に適切（良い状態）

## フェーズ E：印刷と3D（3dp 連携）

### E-1. 囲いの STL エクスポート [M]
兄弟プロジェクト `3dp/`（protein/knot）の流儀——純粋メッシュ `{positions, indices}` → バイナリ STL——に合わせる。
- 駒の形を「五角形プリズムを positions/indices で返す純関数 `js/core/piece-geometry.js`」に切り出すと、Node/ブラウザ両用でテストできる。`piece-layer-3d.js` の `geoBody` はそれを THREE.BufferGeometry に包む形に寄せる
- 出力は「駒だけ」と「盤＋目盛り溝を手続き生成して乗せる」の二択。まず駒のみ
- UI: 囲い画面か合成画面に「STL」ボタン。`showSaveFilePicker`→Blob のフォールバックは 3dp と同じ
- `js/vendor/three.min.js` は UMD なので Node でも require できる

### E-2. 駒の3Dプリント品質 [M]
実造形を意識するなら: 字は浮き彫り（別パーツ色分け）か彫り込み、駒の裏に滑り止めの窪み、目安サイズ（本将棋駒 約 29×33×10mm）に合わせた寸法オプション。

## 整理・その他

- `design-refs.html` は manifest 外の残置ファイル。参照として残すなら `docs/` へ、不要なら削除の判断を
- `dev.md` は要件メモ（未追跡）。`docs/` に移すか削除か

## 優先度の目安

1. **A-1 URL共有** — 「この囲い/組み合わせを見せる」導線の欠落は図鑑として大きい。効果/工数比が最大
2. **B-1 攻め筋の経路** — `overlay.route` の bad トーンが遊んでいる。仕組みは済み
3. **E-1 STL 出力** — 兄弟プロジェクトの資産を直に使える差別化機能
4. **D-1 + D-2** — piece-match/combo は壊れやすいので、増やす前に単体テストを敷く
5. **A-2 任意囲いの combo** — 関数は汎用、UI 開放だけで効く
6. **C-1 一間飛車** — 周期表の完成度
7. **B-3 / D-3** — キーボード・a11y は小さく効く
8. C-2/C-3/D-1の戦法軸・B-2成駒・C-5後手は中〜長期

## 未確定事項

- **Q1**: 一間飛車は独立項目か、九間飛車の別名表示で足すか（周期表の「1筋=端」列の見せ方とセットで決める）
- **Q2**: hash 共有は「開いたら常に保存」でよいか、共有ボタン発行の形にするか
- **Q3**: STL の対象範囲（駒のみ / 盤込み / 両方切替）
- **Q4**: 成駒を入れるなら駒文字のデータモデル（`p` の字）とアトラス設計を先に決める
- **Q5**: `design-refs.html`・`dev.md` をどこに置くか（残す場所）
