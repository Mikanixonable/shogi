# 実装計画：未収録戦法の追加（嬉野流・メイドシステム他）

現行 30 戦法（`js/data/tactics.js`）に、文献確認済みの未収録戦法を追加する計画。

## 0. 前提調査の結論

- `lab/playground/shogi`（旧 shogi1 系）は現行とデータ ID が完全一致（戦法 30・囲い 35）。取り込み漏れなし。現行は `basic`/`from` フィールド付きの上位集合
- `import/shogi1-main` / `import/shogi1-origin` ブランチも同様に上位集合で包含
- したがって本計画は新規調査分の追加のみを扱う

## 1. データ設計上の制約（`js/core/validate.js` / `compose.js` / `tactic-nav.js`）

- `variantOf` の派生は親と**同じ `lead.square`** を持つ必須ルール
- 周期表では `lead.square` が同じ戦法は1セルに束ねられる（`placeTactics`）
- `essential` ∩ 囲い `core` のマスが重なる組み合わせは `best`（◎）にできない（バリデータがエラー）。`ok`（○）相当で実質衝突（SQUARE 等）がある場合は `overrides` が必要
- `[[ref]]` 引用はそのエントリの `sources` / `pairings[].sources` に宣言済みの ref のみ。`best` の pairing は why＋出典が必須
- `pieces` は先手側の全20駒、`essential` ⊆ `pieces`、`route` の終点 = `lead.square`

## 2. 追加する出典（`js/data/sources.js`）

| ref | 出典 |
|---|---|
| `wj-ureshinoryu` | Wikipedia日本語版「嬉野流」（存在確認済み・手順あり） |
| `wj-torisashi` | Wikipedia日本語版「鳥刺し (将棋)」（存在確認済み・基本図あり） |
| `wj-tsunogin` | Wikipedia日本語版「ツノ銀中飛車」（存在確認済み・基本図あり） |
| `wj-kanikanigin` | Wikipedia日本語版「カニカニ銀」（存在確認済み・最序盤図あり） |
| `wj-morishita` | Wikipedia日本語版「森下システム」（存在確認済み） |
| `maid-yui` | YouTube「わかる！勝てる！メイドシステム！」（将棋メイドゆい＝考案者） |
| `d31ta-maid` | d31taのブログ「振り飛車相手にメイドシステムを指す」 |

※ `wj-gosuji-kuraidori`（5筋位取り）・`jsf-kakoi41`（飯島流引き角）・`wj-nakabisha`・`wj-sankenbisha`・`wj-furibisha`・`wj-yagura` は既登録

※「パックマン」の Wikipedia 記事は「4四歩パックマン」＝後手番の2手目ハメ手（初手▲7六歩に△4四歩）。先手視点の駒組みモデルに合わないため本計画では保留（§4 へ移動）

## 3. 追加する戦法

### A. 引き角系：`family='ibisha-kakukeifu'`・`lead={piece:'角', files:[7], square:'79'}`・`route=['88','79']` で統一

周期表の「角・桂・歩」行の 7筋列に「引き角」1セルとして束ねる（嬉野流・メイドシステム・鳥刺し・飯島流引き角が同じマスに入る）。

#### `ureshino` 嬉野流

- pieces: `玉59 金78 金49 銀48 銀46 角79 飛28 桂89 桂29 香99 香19 歩97 歩87 歩77 歩67 歩56 歩47 歩37 歩25 歩17`（Wikipedia の代表的な手順： ▲6八銀△3四歩▲7九角△8四歩▲7八金△8五歩▲4八銀〜▲5七銀左▲4六銀）
- essential: `角79 銀46` / pace: `rapid` / senkei: `[]`
- against: `{ ibisha:'ok', furibisha:'good' }`（対振りは鳥刺しへ合流）
- pairings: nakazumai(ok: 玉は居玉〜6九の軽い構え), kani(ok)
- tags: `['奇襲','引き角']` / context: `相居飛車・対振り飛車（総合）`

#### `shin-ureshino` 新嬉野流 `variantOf:'ureshino'`

- pieces: `玉69 金78 金49 銀57 銀48 角79 飛28 桂89 桂29 香99 香19 歩97 歩87 歩77 歩67 歩56 歩47 歩36 歩25 歩17`（▲5七銀を先に決め引き角を保留する型）
- essential: `角79 銀57`
- pairings: nakazumai(ok), migigyoku(ok: 文献に右玉への合流記述あり)
- desc に米長流急戦矢倉・屋敷流二枚銀への合流を明記

#### `maid-system` メイドシステム

- pieces: `玉88 金69 金58 銀78 銀39 角79 飛28 桂89 桂29 香99 香19 歩96 歩87 歩77 歩67 歩57 歩47 歩37 歩26 歩16`（対振りの終着形。左美濃＋引き角）
- essential: `角79 歩77`（**銀78を essential に入れない**。入れると hidarimino の core（銀78）と衝突して best が不可になる。銀78は pieces 上では戦法・囲いの「兼ねる駒」として自然合成される）
- against: `{ ibisha:'ok', furibisha:'ok' }` / pace: `both` / tags: `['引き角','総合戦法']`
- pairings: hidarimino(best: 対振りの終着形), nakazumai(ok), anaguma(ok + `overrides:['SQUARE']`: core の金79が角79と重なるため角を退かしてから組む形)
- context: `総合（対居飛車は向かい飛車へ転換）` / note に【要確認】（Wikipedia 記事なし・一次出典は考案者の動画と実践ブログ）

#### `torisashi` 鳥刺し

- pieces: `玉78 角79 金69 金48 銀46 銀38 飛28 桂89 桂29 香99 香19 歩96 歩87 歩77 歩67 歩56 歩47 歩36 歩25 歩17`（Wikipedia 基本図：玉7八・角7九・左銀4六到達・右銀3八・金4八・角道不開。手順▲2六歩▲4八銀▲5六歩▲6八玉▲7八玉▲2五歩▲3六歩▲6八銀▲5七銀左▲4六銀▲7九角）
- essential: `角79 銀46` / pace: `rapid` / against: `{ furibisha:'good' }`
- pairings: funa(ok + `overrides:['SQUARE']`: 玉78の構えは舟囲いに近いが7九は角が使う), nakazumai(ok)
- againstTactic: `{ sankenbisha:'ng' }`（実践レポートで三間飛車は天敵とされる）/ `{ shikenbisha:'ok' }`（対四間が本道）
- tags: `['急戦','引き角','端攻め']` / desc に「鳥刺しは端を狙え」の格言と嬉野流との合流を明記

#### `iijima-hikikaku` 飯島流引き角

- 対振り持久戦。左美濃＋角7九＋歩77据え置き（角道不開）
- pieces: `玉88 金69 金58 銀78 銀46 角79 飛28 桂89 桂29 香99 香19 歩96 歩87 歩77 歩67 歩56 歩47 歩37 歩26 歩16`（左美濃＋引き角＋右銀4六の攻め形。4筋歩は47据え置き＝銀46と重複しない）
- essential: `角79 歩77` / pace: `slow` / against: `{ furibisha:'good' }`
- pairings: hidarimino(best: この戦法の囲いそのもの、出典 jsf-kakoi41 既登録), anaguma(ok + SQUARE 同上)
- メイドシステムが対振りで模倣する原型として desc で相互参照

### B. その他の追加

#### `tsunogin-nakabisha` ツノ銀中飛車 `variantOf:'nakabisha'`（square `58`）

- pieces: `玉28 飛58 角77 金78 金38 銀67 銀47 桂89 桂29 香99 香19 歩96 歩87 歩76 歩66 歩57 歩46 歩36 歩27 歩16`（Wikipedia 掲載の持久戦型基本図そのまま：左銀6七・右銀4七・右金3八・左金7八・玉2八の左右対称形、5筋の歩は未突き）
- essential: `飛58 銀67`（**銀47は essential に入れない** — kimuramino の core が銀47を要求し best が衝突するため。pieces 上の銀47は囲いの駒として兼ねる）
- pairings: kimuramino(best: ツノ銀中飛車の囲いが木村美濃そのもの), mino(ok), kinmusou(ok: 相振りでの持久戦形)
- desc: nakabisha の「ツノ銀中飛車…へ発展」の記述と接続。風車への発展も言及

#### `gosuji-kuraidori` 5筋位取り中飛車 `variantOf:'nakabisha'`（square `58`）

- pieces: `玉28 飛58 角77 金78 金49 銀67 銀38 桂89 桂29 香99 香19 歩76 歩66 歩55 歩16 歩97 歩87 歩47 歩37 歩27`
- essential: `飛58 歩55` / pace: `both`
- pairings: katamino(ok), mino(ok) / sources: `wj-gosuji-kuraidori`（既登録）+ `wj-nakabisha`

#### `kanikanigin` カニカニ銀 `family:'ibisha-silver'`、`lead={piece:'銀', files:[4], square:'46'}`

- pieces: `玉59 金69 金49 銀77 銀46 角88 飛28 桂89 桂29 香99 香19 歩96 歩87 歩76 歩67 歩56 歩47 歩37 歩25 歩17`（Wikipedia「最序盤の一例」：玉金不動・居玉が本質。左銀7七・右銀4六・飛車先2五まで）
- essential: `銀46 銀77` / pace: `rapid` / senkei: `['yagura']`（急戦矢倉）
- against: `{ ibisha:'good' }`
- pairings: `[]`（居玉前提のため組み合わせる囲いを持たない。note にその旨明記。対5筋歩型の5八飛・9七角転回は desc で言及）
- 周期表では早繰り銀系（銀46セル）に束ねられる

#### `morishita-system` 森下システム `family:'ibisha-kakukeifu'`、`lead={piece:'角', files:[6], square:'68'}`

- ※調査で訂正： 三間飛車の派生ではなく**相矢倉の戦法**（現代矢倉24手組みから ▲7九角→▲6八角 とした局面が「森下システム」）。右銀は4八のまま態度を保留し、玉の入城を後回しにする
- pieces: `玉69 金78 金67 銀77 銀48 角68 飛28 桂89 桂29 香99 香19 歩97 歩87 歩76 歩66 歩56 歩47 歩36 歩27 歩17`（矢倉道場掲載の手順：▲7六歩▲6八銀▲6六歩▲5六歩▲4八銀▲5八金右▲7八金▲6七金右▲6九玉▲7七銀▲3六歩▲7九角▲6八角。飛車先不突き＝歩27据え置き）
- essential: `角68`（銀77を入れない： yagura core 銀77と衝突して best 不可になるため。pieces の銀77・金78・金67は囲い core として兼ねる）
- pace: `slow` / senkei: `['yagura']` / against: `{ ibisha:'good' }` / againstTactic: `{ suzumezashi:'ok' }`（天敵だったが▲4六銀～5五歩の「深浦新手」で対抗可能に）
- pairings: yagura(best: 相矢倉の戦法であり矢倉囲いに入城するのが本筋、出典 `wj-morishita`+`wj-yagura`)
- 周期表では角@68の新セル（6筋列・角・桂・歩行）に置かれる

## 4. 保留（今回入れない）

| 戦法 | 理由 |
|---|---|
| パックマン | 「4四歩パックマン」は後手番の2手目ハメ手（▲7六歩に△4四歩）。先手視点の駒組みモデルに合わない |
| 地下鉄飛車 | 開戦の駒組みでなく中盤の転回手筋。代表局面の切り方が本アプリのモデル（固定の駒組み）と合わない |
| ウソ矢倉 | 後手番発祥のハメ手。居飛車のまま飛車を振らないため系統行に置きにくい |
| 米長流急戦矢倉・屋敷流二枚銀 | 新嬉野流の desc で合流先として言及に留める。独立エントリは別途調査 |
| 風車 | ツノ銀中飛車の desc で言及に留める（一段飛車型は lead.square が58と異なり派生にできない） |
| 阪田流△3二飛 等の後手専用戦法 | 現モデルは先手視点の駒組み。後手専用の形は別の設計判断が要る |

囲い側: lab 照合済み・未収録の有名囲い（ずく美濃・銀美濃・へこみ矢倉等）は本計画の対象外。必要なら別計画。

## 5. 作業手順

1. `js/data/sources.js` に §2 の出典を追加
2. `js/data/tactics.js` に §3 のエントリを追加（各 family の既存エントリの直後または末尾に、系統行の並びは `lead.files` の中心値で自動ソート）
3. `node tools/validate-castles.js` — スキーマ・出典・ペアリング整合を検証
4. `rm tools/expected-matrix.txt && node tools/unit-test.js` — 互換性マトリクス再生成＋全テスト
5. `node tools/ui-check.js` — 周期表のセル束ね・詳細描画・ハッシュ往復を確認（新規チェック追加も可： 角79セルに引き角系4件が束ねられる等）
6. スクショ確認（`tools/shots/`）
