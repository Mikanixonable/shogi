# コンテンツ拡充提案：未収録の戦型・戦法・手筋

作成日: 2025-11-01 / 対象: `js/data/tactics.js`（40件）・`strategies.js`（2件）・関連データ
方針: 本書は調査と提案のみ。`js/data/*.js` のコード変更は行わない。駒配置（`pieces`）は文献の図・手順から確実に分かるものだけ記し、それ以外は「要検証」とする。

## 0. 要約

- 最大の欠落は**戦型大系の実体が無い**こと。`tactics.js` の `senkei` タグ（`kakugawari`/`aigakari`/`yokofudori`/`yagura`/`gangi`）と `constraints.js` の `labels()` は戦型名を出すが、角換わり・相掛かり・横歩取り・矢倉・雁木という「大系」はデータ実体として存在せず、個別戦法としても未収録。
- 戦法の欠落は3層ある: (a) 戦型の本筋（矢倉3七銀・3七桂、相掛かり▲2六飛、横歩取り▲3四飛、雁木戦法）、(b) 名前のある個別戦法（脇システム・塚田スペシャル・棒金・米長流急戦矢倉・中田功XP・村田システム・本来の雁木＝対振り引き角など）、(c) 後手番専用・ハメ手・中盤手筋（現行の先手視点の駒組みモデルに合わないもの）。
- 手筋（テスジ）は `tesuji-combos` ブランチ（`.claude/worktrees/tesuji`）に `Kakoi.TESUJI` の設計済みデータモデルがある（継ぎ歩・垂れ歩・叩きの歩・連打の歩・底歩・控えの歩・王手飛車＋格言）。本流への導入は§4参照。

## 1. 「戦型」を実体データとして持つ設計案

### 1-1. 現状

- `js/core/constraints.js` の `SENKEI_LABELS` は `kakugawari: '角換わり', yokofudori: '横歩取り', aiyagura: '相矢倉', yagura: '矢倉', gangi: '雁木', aigakari: '相掛かり'` を持ち、`labels()` が決定木で戦型ラベルを1つ導出する（両者角持駒→角換わり、双方 yokofudori タグ→横歩取り、囲いが矢倉系→矢倉、雁木系→雁木、双方 aigakari タグ→相掛かり）。
- よって「戦型」は**表示だけの導出ラベル**であり、解説・代表戦法・代表囲い・成立手順を持つコンテンツとして欠落している。四大戦法（角換わり・相掛かり・横歩取り・相矢倉）＋雁木は将棋の主戦場そのもので、図鑑としての最大の穴（`wj-kakugawari` 系記事より、相矢倉・相掛かり・角換わり・横歩取りは「相居飛車戦における四大戦法」と明記）。

### 1-2. 提案: `js/data/senkei.js`（新規データ種 `Kakoi.SENKEI`）

`strategies.js`（居飛車/振り飛車＝戦略レベル）とは別物として、**戦型＝相居飛車の将棋が分岐する「形」**を定義する。1件あたり:

```js
Kakoi.SENKEI = {
  kakugawari: {
    name: '角換わり', reading: 'かくがわり', short: '角換',
    group: 'aiibisha',               // 相居飛車内の分岐（対抗形では発生しない）
    desc: '序盤で角を交換してから駒組みを進める戦型。相矢倉より激しく相掛かりより穏やかとされる。右銀の使い方が急戦（棒銀・早繰り銀）と持久戦（腰掛け銀・右玉）を分かつ。',
    forms: '▲7七角△同角▲同銀（または一手損の△8八角成▲同銀）で角を交換',
    tactics: ['koshikakegin', 'bougin', 'hayakurigin', 'sujichigaikaku'], // この戦型に属する/誘導する既存・提案戦法id
    castles: ['yagura', 'bonanza', 'migigyoku', 'kani'],
    sources: [{ ref: 'wj-kakugawari', for: '解説' }],
  },
  aigakari:   { name: '相掛かり', ... },   // お互いに飛車先の歩を伸ばし交換、横歩は取らずに飛車を引く
  yokofudori: { name: '横歩取り', ... },   // ▲3四飛の横歩取りから大駒交換の激しい急戦
  yagura:     { name: '矢倉', aliases: ['相矢倉'], ... }, // 角道を止めて駒組み。四大戦法の筆頭
  gangi:      { name: '雁木', ... },       // 左銀を6七に置く形で戦う2010年代以降の新型戦型
};
```

### 1-3. 既存の `senkei` タグ・`labels()` との整合

- **役割分担**: 戦法側の `senkei: [...]` は「その戦法が属する・誘導する戦型」の宣言（labels() の判定入力）で据え置き。`SENKEI` はその id をキーにした**表示・解説コンテンツ**。`SENKEI_LABELS` を constraints.js から `Kakoi.SENKEI` の name に移管すれば二重管理が消える。
- **aiyagura の扱い**: 現在 labels() は両者矢倉系なら `aiyagura`、片方だけなら `yagura` を出す。SENKEI 側は `yagura` 1件にまとめ、「双方が矢倉に組むと相矢倉」は desc に書く（aiyagura を別エントリにすると内容がほぼ重複する）。labels() のラベル解決は `aiyagura → SENKEI.yagura` へのマップで吸収。
- **対抗形・相振り飛車・相居飛車**: これらは matchup.threat() の kind（`aiibisha`/`taikou-i`/`taikou-f`/`aifuri`）で既に導出済み。戦型ではなく「対戦形式」なので SENKEI には入れず、§4で触れる「戦型ブラウザ」を作る場合は上段のグルーピングとして使う（`group` フィールドはそのための布石）。
- **戦法の senkei タグの穴埋め**: 現状タグ付きは居飛車系のみ。新規戦法を加える際は同じ規則（属する・誘導する戦型）で付与する。例: 提案中の `aigakari`（本筋）は `['aigakari']`、`yokofudori` は `['yokofudori']`、矢倉系の各戦法は `['yagura']`。
- **注意点（バリデータ）**: labels() の角換わり判定は `senkei` タグではなく **両者の `hand` に角があること**。角換わり系戦法を新規追加する際、`hand: '角'` を入れると「両者角持ち＝角換わり」ラベルが出る設計に既になっている（koshikakegin が `hand:'角'` を持つ先例）。

## 2. 未収録戦法の総表（優先度順）

凡例: family＝周期表の行（既存4行に収まる。振り飛車=飛車の筋、居飛車=銀の筋/飛車の筋/角・桂・歩の筋）。side＝主に使う手番。「後手」は現行の先手視点モデルにそのまま乗らないため原則低優先度（旧計画書でパックマン・阪田流△3二飛・ウソ矢倉が保留されたのと同じ理由）。pieces＝文献上の代表局面の確認状況。

### A. 戦型の本筋（最優先：大系の旗艦）

| 戦法（正式名） | 読み | family | side | pace | senkei | lead | pieces | 優先 |
|---|---|---|---|---|---|---|---|---|
| 矢倉3七銀戦法 | やぐらさんななぎんせんぽう | ibisha-silver | 先 | slow | yagura | 銀@37 | 24手組から▲3七銀（文献記述あり・要検証） | 高 |
| 矢倉3七桂戦法（4七銀-3七桂型・同型矢倉） | やぐらさんななけい | ibisha-kakukeifu | 先 | both | yagura | 桂@37 | 要検証 | 高 |
| 相掛かり（▲2六飛型・本筋） | あいがかり | ibisha-rook | 先後 | both | aigakari | 飛@26 | Wikipedia図から組立可・要検証 | 高 |
| 横歩取り（本筋） | よこふどり | ibisha-rook | 先 | rapid | yokofudori | 飛@34 | Wikipedia基本図（15手目▲3四飛） | 高 |
| 雁木戦法（新型・相居飛車） | がんぎせんぽう | ibisha-silver | 先後 | both | gangi | 銀@67or47 | 雁木囲い記事の基本図あり | 高 |
| 脇システム | わきシステム | ibisha-kakukeifu | 先 | slow | yagura | 角@46 | **Wikipedia基本図から確定**（下記） | 高 |
| 森内システム | もりうちシステム | ibisha-kakukeifu | 先 | both | aigakari? | 角@77 | 要検証（専用記事なし・別出典必要） | 中高 |
| 米長流急戦矢倉（先手版） | よねながりゅうきゅうせんやぐら | ibisha-silver（variantOf hayakurigin） | 先後 | rapid | yagura | 銀@46 | Wikipedia「▲5七銀まで」図あり・要検証 | 高 |
| 塚田スペシャル | つかだスペシャル | ibisha-rook | 先 | rapid | aigakari | 飛@26 | Wikipedia図あり・要検証 | 高 |
| 棒金 | ぼうきん | ibisha-kakukeifu | 先後 | rapid | —（対振り） | 金@26 | Wikipedia図あり・要検証 | 高 |
| 中田功XP（コーヤン流） | なかたいさおエックスピー | furibisha-rook（variantOf sankenbisha） | 先 | rapid | —（対居飛車穴熊） | 飛@78 | Wikipedia図あり・要検証 | 高 |
| 村田システム | むらたシステム | ibisha-silver | 先後 | both | — | 銀@48 | Wikipedia図1（▲5六歩まで） | 高 |
| 本来の雁木（対振り引き角雁木） | がんぎ（ひきかく） | ibisha-kakukeifu | 先 | both | —（対振り） | 角@79 | **Wikipedia基本図から確定**（下記） | 高 |
| 右玉戦法（角換わり右玉） | みぎぎょく | ibisha-kakukeifu | 先後 | slow | kakugawari | 玉@38? | 要検証（囲い migigyoku 収録済みで相性◎） | 中高 |

### B. 個別の有名戦法（中優先度）

| 戦法 | 読み | family | side | pace | senkei | lead | 備考 |
|---|---|---|---|---|---|---|---|
| 4六銀右戦法 | よんろくぎんみぎ | ibisha-silver（variantOf hayakurigin） | 先 | rapid | — | 銀@46 | 対四間。4六銀左と対になる右銀版。記事あり |
| 二枚銀（対四間/対中飛車） | にまいぎん | ibisha-silver | 先後 | rapid | — | 銀@47or57 | 5七銀+4七銀の形。雁木囲いと同型を別文脈で使う |
| ポンポン桂 | ぽんぽんけい | ibisha-kakukeifu | 先 | rapid | — | 桂@45? | 対四間急戦。記事あり・要検証 |
| 端角（中原流） | はしかく | ibisha-kakukeifu | 先 | both | — | 角@97 | 対四間。山田定跡△5四歩への▲9七角も同系 |
| 四手角/三手角 | よんてかく/さんてかく | ibisha-kakukeifu | 先 | slow | yagura | 角@26 | 矢倉の角を▲7九〜4六〜3七〜2六へ。千日手矢倉 |
| ▲2九飛戦法 | にくひしゃ | ibisha-rook | 先 | slow | yagura | 飛@29 | 雀刺し系・態度保留型 |
| 同型矢倉（4七銀-3七桂型） | どうけいやぐら | ibisha-silver | 先 | slow | yagura | 銀@47 | 米長流対策としても現れる |
| 青野流（5八玉型） | あのりゅう | ibisha-rook（variantOf yokofudori） | 先 | rapid | yokofudori | 飛@34 | 横歩取り△3三角への▲5八玉。2020年代に猛威 |
| 勇気流（6八玉型） | ゆうきりゅう | ibisha-rook（variantOf yokofudori） | 先 | rapid | yokofudori | 飛@34 | 佐々木勇気の▲6八玉 |
| 加藤流 | かとうりゅう | ibisha-silver（variantOf yagura-37gin） | 先 | slow | yagura | 銀@37 | ▲2六歩-3七銀型＋▲1六歩。加藤一二三名付け |
| 木村定跡 | きむらじょうせき | ibisha-silver（variantOf koshikakegin） | 先 | both | kakugawari | 銀@56 | 角換わり41手目〜の定跡。深い変化は note で |
| ダイレクト向かい飛車 | ダイレクトむかいびしゃ | furibisha-rook（variantOf mukaibisha） | 先後 | rapid | — | 飛@88 | 角道を止めず直接8筋。要検証 |
| 先手中飛車 | せんてなかびしゃ | furibisha-rook（variantOf nakabisha） | 先 | both | — | 飛@58 | 先手番の対居飛車中飛車 |
| 原始中飛車 | げんしなかびしゃ | furibisha-rook（variantOf nakabisha） | 先後 | rapid | — | 飛@58 | 玉を囲わず振る古典形 |
| 英ちゃん流中飛車 | えいちゃんりゅう | furibisha-rook（variantOf nakabisha） | 先後 | slow | — | 飛@58 | 5筋不突き型。ツノ銀 note で言及済→独立化も可 |
| 風車 | ふうしゃ | furibisha-rook | 先後 | slow | — | 飛@59? | ツノ銀から一段飛車・角を5筋・中住まい。lead.squareが58と違い派生にはできない |
| 楠本式石田流 | くすもとしきいしだりゅう | furibisha-rook（variantOf ishida） | 先後 | both | — | 飛@76 | 楠本誠の石田流本組型。要検証 |
| 三間飛車藤井システム | さんげんびしゃふじい | furibisha-rook（variantOf sankenbisha） | 先 | rapid | — | 飛@78 | 対左美濃の三間版急戦。要検証 |
| 角交換振り飛車（筋違い角向かい飛車含む） | かくこうかんふりびしゃ | furibisha-rook（variantOf mukaibisha） | 先後 | both | — | 飛@88 | 角交換前提の振り飛車系 |
| エルモ囲い急戦 | えるもがこいきゅうせん | ibisha-silver | 先 | rapid | — | 銀@46? | 対四間。elmo囲い収録済・要検証 |
| 早囲い（矢倉早囲い） | はやがこい | ibisha-silver? | 先後 | slow | yagura | 要検証 | 米長流に敗れ衰退。囲い寄りの駒組み |
| 新鬼殺し | しんおにごろし | ibisha-kakukeifu（variantOf onigoroshi） | 先 | rapid | — | 桂@65 | 鬼殺しの改良型 |
| 5手爆弾 | ごてばくだん | ibisha-rook | 先 | rapid | aigakari | 飛@24? | ▲7八金を省く▲2四歩のハメ手。低めでOK |

### C. 後手番専用・モデル非適合・マイナー（低優先度）

| 戦法 | 理由・扱い |
|---|---|
| 阿久津流急戦矢倉（中原式/郷田式/渡辺式） | 後手の△5三銀右急戦。2008竜王戦で渡辺が連投。後手番モデルが要る |
| 対矢倉左美濃急戦（居角左美濃急戦） | 後手の対矢倉策（千田翔太、升田幸三賞）。先手の矢倉側対策として desc で言及が現実的 |
| 藤森流急戦矢倉 | 後手の米長流進化版。同上 |
| 屋敷流忍者銀（二枚銀急戦矢倉） | 屋敷伸之の後手急戦矢倉。同上 |
| 鎖鎌銀（猪突銀戦法） | 後手が△7四銀〜8五銀と音なしを狙う相掛かり。後手専用 |
| 後手番一手損角換わり | 淡路仁茂考案・升田幸三賞。後手番専用。先手側対策は早繰り銀の context に既出 |
| 横歩取り8五飛/4五角/3三角/3三桂/相横歩取り/超急戦 | すべて後手の選択。先手側の対策（青野流・勇気流・新山崎流）のみ先手モデルに乗る |
| 新山崎流 | △8五飛への先手の対策。内容は要検証・中程度 |
| 阪田流向かい飛車 | 後手の△3二飛→△5四銀形。後手専用（旧計画で保留済） |
| 4四歩パックマン | 後手2手目ハメ手。旧計画で保留済みのまま |
| ウソ矢倉 | 後手番発祥のハメ手。旧計画で保留済み |
| 銀多伝 | 相掛かり後手の罠的戦法。記事はあるが出典薄め・低 |
| きmきm金/4六金戦法/たこ金 | 対三間・対ツノ銀・対ひねりの金繰り出し系。棒金の desc/関連として言及、独立は低 |
| トマホーク | 確認できる記事が見当たらず内容未検証・低 |
| 大フィラデルフィア | 対振り高美濃系とされるが細部未検証・低 |
| 菅井流（△3三金型/やんちゃ三間飛車） | 後手の型・低 |
| 端角阿部流 | 端角の別系統。端角エントリの alias か関連に |
| 村山流/ショーダンオリジナル | 村田システム関連の厚み構え。村田の desc で言及 |
| 筋違い角阪田流 | 筋違い角の後手版。収録済み sujichigaikaku の関連として言及 |
| 地下鉄飛車 | 中盤の転回手筋。旧計画同様 tactics ではなく手筋モデル（§4）向き |
| 新・丸山ワクチン | 後手ゴキゲンの対超速策。後手専用 |
| 千田流三間飛車（千田右翼） | 内容要検証・低 |

## 3. 優先度「高」の戦法データ案（スキーマ準拠）

`pieces` は先手側全20駒・`essential` は `pieces` の部分集合・`route` の終点=`lead.square`・`variantOf` は親と同じ `lead.square`・`best` pairing は why＋出典必須・`essential`∩囲い`core` が重なると best 不可（archived/plan-tactic-additions.md §1）。

### 3-1. `yagura-37gin` 矢倉3七銀戦法

```js
{ id: 'yagura-37gin', name: '矢倉3七銀戦法', short: '3七銀', reading: 'やぐらさんななぎんせんぽう', basic: true,
  family: 'ibisha-silver', lead: { piece: '銀', files: [3], square: '37' },
  route: ['39', '38', '37'],
  pieces: '玉69 飛28 角88 金78 金67 銀77 銀37 桂89 桂29 香99 香19 歩97 歩87 歩76 歩66 歩56 歩47 歩36 歩27 歩16',
  // ↑24手組（▲6九玉型）から▲3七銀とした形。Wikipedia「矢倉囲い」24手組の記述から組立・推定。要検証（飛車先▲2五歩か保留かで変化）
  essential: '銀37 銀77', pace: 'slow', senkei: ['yagura'],
  against: { ibisha: 'good' },
  pairings: [ { castle: 'yagura', level: 'best', why: '矢倉戦の本筋であり矢倉囲いに入城するのが前提', sources:[{ref:'wj-yagura',for:'組み合わせ'}] } ],
  tags: ['本格派', '矢倉'], context: '相矢倉（先手の主導権型）',
  desc: '24手組から右銀を▲3七銀と進める矢倉の本筋[[wj-yagura]]。▲2五歩を突くか保留するかで系統が分かれ、ここから棒銀・▲4六銀-3七桂戦法（91手定跡）・加藤流・▲4六角（脇システム）に分岐する。後手の急戦矢倉・左美濃急戦への対応が必修科目。',
  pros: ['先手が主導権を握りやすい', '定跡が最も深く研究されている'],
  cons: ['覚える変化が膨大', '急戦矢倉・左美濃急戦への対策が必須'],
  sources: [{ ref: 'wj-yagura', for: '配置・解説' }] }
```

### 3-2. `yagura-37kei` 矢倉3七桂戦法

```js
{ id: 'yagura-37kei', name: '矢倉3七桂戦法', short: '3七桂', reading: 'やぐらさんななけいせんぽう',
  family: 'ibisha-kakukeifu', lead: { piece: '桂', files: [3], square: '37' },
  route: ['29', '37'],
  pieces: '玉69 飛28 角88 金78 金67 銀77 銀48 桂89 桂37 香99 香19 歩97 歩87 歩76 歩66 歩56 歩47 歩36 歩27 歩16',
  // ↑3七桂型の布陣（右銀は4八待機）。要検証
  essential: '桂37', pace: 'both', senkei: ['yagura'],
  against: { ibisha: 'good' },
  pairings: [ { castle: 'yagura', level: 'best', why: '矢倉戦からの駒組み[[wj-yagura]]', sources:[{ref:'wj-yagura',for:'組み合わせ'}] } ],
  tags: ['矢倉'], context: '相矢倉（飛車先を伸ばしてからの分岐）',
  desc: '24手組から▲3七桂と跳ねる型。ここから飛車先を伸ばして▲4七銀-3七桂型（▲3八飛・同型矢倉）、▲2六歩止め▲3七桂-4八銀型から雀刺しに発展する。▲3八飛から森下システムへの合流も可能[[wj-yagura]]。',
  pros: ['雀刺し・同型・森下Sへ分岐でき柔軟'], cons: ['3筋の歩交換を含む変化が複雑'],
  sources: [{ ref: 'wj-yagura', for: '配置・解説' }] }
```

### 3-3. `aigakari` 相掛かり（▲2六飛型）

```js
{ id: 'aigakari', name: '相掛かり', short: '相掛かり', reading: 'あいがかり', basic: true,
  aliases: ['相懸かり', 'Double Wing Attack'],
  family: 'ibisha-rook', lead: { piece: '飛', files: [2], square: '26' },
  route: ['28', '24', '26'],
  pieces: '玉59 飛26 角88 金78 金49 銀79 銀39 桂89 桂29 香99 香19 歩97 歩87 歩76 歩67 歩57 歩47 歩37 歩17',
  hand: '歩', essential: '飛26',
  pace: 'both', senkei: ['aigakari'],
  against: { ibisha: 'good' },
  pairings: [ { castle: 'nakazumai', level: 'ok', why: '相掛かりで主流の中住まい型' }, { castle: 'kabuto', level: 'ok', why: '▲6八玉型も主流の一つ' } ],
  tags: ['本格派'], context: '相居飛車（飛車先交換後に飛車を引く）',
  desc: 'お互いに飛車先の歩を突き合わせ（掛かり）、▲7八金△3二金と角頭を守ってから▲2四歩△同歩▲同飛△2三歩▲2六飛と進む相居飛車の戦型[[wj-aigakari]]。横歩を取らずに飛車を引くのが横歩取りとの分岐。AlphaZeroが採用するなど2010年代後半に研究が躍進し、2021年度タイトル戦で最多の採用戦型となった[[wj-aigakari]]。',
  pros: ['急戦から持久戦まで手が広い', '人間的な好みを出せる'],
  cons: ['角換わりより変化が散らばり定跡が乱立'],
  note: '図は▲2六飛の型。近年は▲2五飛型・交換先延ばしも増加。旧来は角道を開けて飛車先を伸ばす形もあった[[wj-aigakari]]',
  sources: [{ ref: 'wj-aigakari', for: '配置・解説' }] }
```

### 3-4. `yokofudori` 横歩取り

```js
{ id: 'yokofudori', name: '横歩取り', short: '横歩', reading: 'よこふどり', basic: true,
  aliases: ['Side Pawn Picker'],
  family: 'ibisha-rook', lead: { piece: '飛', files: [3], square: '34' },
  route: ['28', '24', '34'],
  pieces: '玉59 飛34 角88 金78 金49 銀79 銀39 桂89 桂29 香99 香19 歩97 歩87 歩76 歩67 歩57 歩47 歩37 歩17',
  hand: '歩歩歩', essential: '飛34',
  pace: 'rapid', senkei: ['yokofudori'],
  against: { ibisha: 'good' },
  pairings: [ { castle: 'nakahara', level: 'ok', why: '8五飛戦法との組み合わせで普及した中原囲い' }, { castle: 'nakazumai', level: 'ok', why: '玉を中央に置く主戦型' } ],
  tags: ['急戦', '大駒交換'], context: '相居飛車（15手目▲3四飛から）',
  desc: '▲2四歩△同歩▲同飛の飛車先交換後、後手の△3四歩を▲3四飛と横から取る戦法[[wj-yokofudori]]。「横歩三年の患い」の格言に反して木村義雄の横歩取り2三歩で認知が変わり、羽生世代の研究で激しい急戦型に発展。後手の対策は△8六歩（8五飛・4五角・3三角系）か△2三歩に分かれる[[wj-yokofudori]]。',
  pros: ['強制力が高く主導権を握れる', '研究が進み結論が出ている変化も多い'],
  cons: ['一手の過ちが即敗北に直結', '青野流対策後は先手の採用が激減した時期も'],
  note: '図は15手目▲3四飛の局面（先手歩3・後手歩2の持ち駒）[[wj-yokofudori]]',
  sources: [{ ref: 'wj-yokofudori', for: '配置・解説' }] }
```

### 3-5. `gangi-ibisha` 雁木戦法（新型）

```js
{ id: 'gangi-ibisha', name: '雁木戦法', short: '雁木', reading: 'がんぎせんぽう',
  family: 'ibisha-silver', lead: { piece: '銀', files: [6], square: '67' },
  route: ['79', '68', '67'],
  pieces: '玉69 飛28 角88 金78 金58 銀67 銀47 桂89 桂29 香99 香19 歩97 歩87 歩76 歩66 歩56 歩46 歩36 歩27 歩17',
  // ↑ツノ銀雁木の駒組みイメージ（左銀6七・右銀4七）。要検証
  essential: '銀67', pace: 'both', senkei: ['gangi'],
  against: { ibisha: 'good' },
  pairings: [
    { castle: 'gangi', level: 'best', why: '雁木囲い（二枚銀）は戦法の母体となる囲い[[wj-gangi]]', sources:[{ref:'wj-gangi',for:'組み合わせ'}] },
    { castle: 'tsunogin', level: 'best', why: 'ツノ銀雁木は新型雁木戦の代表的な構え[[wj-gangi]]', sources:[{ref:'wj-gangi',for:'組み合わせ'}] },
  ],
  tags: ['持久戦', '現代戦法'], context: '相居飛車（一方の意思で雁木戦型に持ち込める）',
  desc: '居飛車で左銀を6七に置く形の囲いを総称して雁木囲いと呼び、一方が雁木囲いを構築して戦う戦型が2010年代の雁木戦[[wj-gangi]]。角道を開けたまま駒組みし、様々な局面から強引に雁木戦型へ持ち込めるのが特徴。コンピュータ将棋の発展で復権した現代の主戦場[[wj-gangi]]。語義は時代で3段階に変化した（本来の雁木＝対振り引き角→旧型＝二枚銀→新型）[[wj-gangi]]。',
  pros: ['矢倉ほど型が固定せず工夫の余地が大きい', '相手の戦型宣言を待たず仕掛けられる'],
  cons: ['体系が発展途上で定跡が整理しにくい'],
  sources: [{ ref: 'wj-gangi', for: '配置・解説' }] }
```

### 3-6. `waki-system` 脇システム

```js
{ id: 'waki-system', name: '脇システム', short: '脇シス', reading: 'わきしすてむ',
  family: 'ibisha-kakukeifu', lead: { piece: '角', files: [4], square: '46' },
  route: ['88', '79', '46'],
  pieces: '玉88 飛28 角46 金78 金67 銀77 銀37 桂89 桂29 香99 香19 歩97 歩87 歩76 歩66 歩56 歩47 歩36 歩25 歩16',
  // ↑Wikipedia「脇システム」基本形の図から確定（玉88・金78-67・銀77-37・角46・歩25・16）
  essential: '角46', pace: 'slow', senkei: ['yagura'],
  against: { ibisha: 'good' },
  pairings: [
    { castle: 'yagura', level: 'best', why: '相矢倉の戦法であり矢倉に入城するのが本筋[[wj-wakisystem]]', sources:[{ref:'wj-wakisystem',for:'組み合わせ'}] },
    { castle: 'katayagura', level: 'best', why: '藤井猛により片矢倉との相性の良さが発見された（藤井流早囲いの母体）[[wj-wakisystem]]', sources:[{ref:'wj-wakisystem',for:'組み合わせ'}] },
  ],
  tags: ['矢倉', '持久戦'], context: '相矢倉（角を4六-6四でぶつける）',
  desc: '後手△6四角に対し先手も▲4六角と角をぶつけ、先後ほぼ同形で駒組みを進める相矢倉の戦法[[wj-wakisystem]]。脇謙二が多用し命名。角交換のタイミングを計り▲6一や▲4一への成り込みを狙う。2五歩の突き越しを活かせるため、居角左美濃急戦対策として2010年代後半も存在感を維持した[[wj-wakisystem]]。',
  pros: ['急戦封じとして機能し主導権を保てる', '片矢倉との併用で研究対象として深い'],
  cons: ['角がぶつかったまま同形が進み読みが極めて深い'],
  sources: [{ ref: 'wj-wakisystem', for: '配置・解説' }] }
```

### 3-7. `yonenaga-kyusen` 米長流急戦矢倉（先手版）

```js
{ id: 'yonenaga-kyusen', name: '米長流急戦矢倉', short: '米長流', reading: 'よねながりゅうきゅうせんやぐら',
  variantOf: 'hayakurigin',
  family: 'ibisha-silver', lead: { piece: '銀', files: [4], square: '46' },
  route: ['79', '68', '57', '46'],
  pieces: '要検証', // Wikipediaに後手版基本図と先手版「▲5七銀まで」図あり。左銀を中央へ繰り出す
  essential: '銀46', pace: 'rapid', senkei: ['yagura'],
  against: { ibisha: 'ok' },
  pairings: [], tags: ['急戦', '矢倉'],
  context: '相矢倉（急戦矢倉。元は後手番の戦法）',
  desc: '米長邦雄が創案した急戦矢倉。本来は後手が矢倉囲いを目指さず△4四歩を突かずに△4四銀と銀を繰り出して中央突破を狙うものだが、先手版（左銀を▲6八銀〜5七銀〜4六銀と中央へ）としても残り、2018年竜王戦挑決の深浦康市が▲5七銀から仕掛ける形を見せた[[wj-yonenaga]]。飛角銀桂の5枚攻めで破壊力が高い。',
  pros: ['中央突破の破壊力が高い'], cons: ['玉形が薄くカウンターに弱い'],
  note: '後手番発祥のため、先手の代表局面は文献確認が要る',
  sources: [{ ref: 'wj-yonenaga', for: '配置・解説' }, { ref: 'wj-yagura', for: '戦型' }] }
```

### 3-8. `boukin` 棒金

```js
{ id: 'boukin', name: '棒金', short: '棒金', reading: 'ぼうきん',
  family: 'ibisha-kakukeifu', lead: { piece: '金', files: [2], square: '26' },
  route: ['49', '38', '27', '26'],
  pieces: '要検証', // Wikipedia「棒金」に基本図（先手：右金を2筋へ繰り出す形）あり
  essential: '金26', pace: 'rapid', senkei: [],
  against: { furibisha: 'good' },
  againstTactic: { ishida: 'good', sankenbisha: 'ok' },
  pairings: [ { castle: 'funa', level: 'ok', why: '最小限の囲いで金の繰り出しに合わせる' } ],
  tags: ['急戦', '対石田流'], context: '対石田流（対ひねり飛車にも応用）',
  desc: '守りの駒の概念が強い金を前線に繰り出す戦法。対石田流に▲3八金〜▲2七金〜▲2六金と進め、金の威力で飛車・角を押さえ込み振り飛車側の捌きを封じる[[wj-boukin]]。飛車の退路を塞がれた石田流には堅実な金が防ぎようもなく、対ひねり飛車にも用いられる[[wj-boukin]]。',
  pros: ['石田流の理想形を封じられる', '銀より堅実で相手の反発を受けにくい'],
  cons: ['失敗すれば金を渡し自陣の金が1枚減る', '右銀の活用法が難しくばらけやすい'],
  sources: [{ ref: 'wj-boukin', for: '配置・解説' }] }
```

### 3-9. `tsukada-special` 塚田スペシャル

```js
{ id: 'tsukada-special', name: '塚田スペシャル', short: '塚田SP', reading: 'つかだすぺしゃる',
  family: 'ibisha-rook', lead: { piece: '飛', files: [2], square: '26' },
  route: ['28', '24', '26'],
  pieces: '要検証', // Wikipedia基本図（仕掛け始め）：玉59 飛26 角88 金78 金49 銀79 銀38 …
  essential: '飛26', pace: 'rapid', senkei: ['aigakari'],
  against: { ibisha: 'ok' },
  pairings: [ { castle: 'funa', level: 'ok', why: '超急戦なので軽い囲いに留める' } ],
  tags: ['急戦', '升田幸三賞'], context: '相掛かり（飛車先を切った瞬間の反撃）',
  desc: '1986年に塚田泰明が考案した相掛かりの超急戦[[wj-tsukada]]。後手が飛車先を切りに来た瞬間に▲2四歩と再度合わせたり、1筋の歩付き合いで歩を持駒にしてから▲1五歩△同歩▲1三歩と攻め込む。2015年に升田幸三賞特別賞を受賞[[wj-tsukada]]。',
  pros: ['相掛かり定跡の外で戦える奇襲性'], cons: ['失敗時は歩切れと形の歪みが残る'],
  sources: [{ ref: 'wj-tsukada', for: '配置・解説' }] }
```

### 3-10. `nakata-XP` 中田功XP

```js
{ id: 'nakata-XP', name: '中田功XP', short: '中田XP', reading: 'なかたいさおエックスピー',
  aliases: ['コーヤン流'], variantOf: 'sankenbisha',
  family: 'furibisha-rook', lead: { piece: '飛', files: [7], square: '78' },
  route: ['28', '78'],
  pieces: '要検証', // Wikipedia基本図：玉39（美濃に収めず）・飛78・角77・端歩▲1六歩
  essential: '飛78 玉39', pace: 'rapid', senkei: [],
  against: { ibisha: 'good' },
  pairings: [ { castle: 'mino', level: 'ok', why: '仕掛け後に組み替える流れ（基本は居玉で戦う）' } ],
  tags: ['急戦', '対居飛車穴熊', '端攻め'],
  context: '対居飛車穴熊（三間飛車）',
  desc: '中田功が創案し島朗『島ノート』で広まった三間飛車の居飛車穴熊対策[[wj-nakata-XP]]。藤井システム同様、序盤で飛車を振る前に玉側の端歩▲1六歩を突き、玉を3九に留めて美濃に収めない。端攻めと角の利きを両用し、▲6五歩で角道を通して▲2五桂〜▲1三桂成を狙う[[wj-nakata-XP]]。「コーヤン流」は中田の三間飛車全体の呼称で、狭義にはこの対穴熊策を指す[[wj-nakata-XP]]。',
  pros: ['居飛車穴熊への明確な対策を三間飛車に与えた', '玉を遠ざけて端攻めの反動を受けにくい'],
  cons: ['四枚穴熊に組まれない・早めの引き角対応など対策が進んだ'],
  sources: [{ ref: 'wj-nakata-XP', for: '配置・解説' }] }
```

### 3-11. `murata-system` 村田システム

```js
{ id: 'murata-system', name: '村田システム', short: '村田S', reading: 'むらたしすてむ',
  family: 'ibisha-silver', lead: { piece: '銀', files: [4], square: '48' },
  route: ['39', '48'],
  pieces: '玉59 飛28 角88 金78 金49 銀68 銀48 桂89 桂29 香99 香19 歩97 歩87 歩77 歩67 歩56 歩47 歩37 歩27 歩17',
  // ↑Wikipedia図1（▲5六歩まで）の骨格。角道不開（▲7七歩据え）・▲4八銀・6八銀・7八金・5六歩が確定要素。歩の細部は要検証
  essential: '銀48 銀68 歩56', pace: 'both', senkei: [],
  against: { ibisha: 'good', furibisha: 'ok' },
  pairings: [
    { castle: 'gangi', level: 'ok', why: '旧式の雁木の厚み構えへの発展がある[[wj-murata]]' },
    { castle: 'nakazumai', level: 'ok', why: '軽い構えで戦う選択肢' },
  ],
  tags: ['総合戦法', '角道保留'], context: '相居飛車・対振り飛車（総合）',
  desc: '村田顕弘が開発した総合戦法。角道を開けない（村田は「角道保留」と表現）ことで居飛車党に角換わり・横歩取りに誘導させず、右銀▲4八銀の活用を主とし、左銀も6八〜5七〜4六・6六とトリッキーに使う[[wj-murata]]。嬉野流の派生形だが嬉野流が左銀主役なのに対し右銀主役で、初手のパターンも複数ある[[wj-murata]]。藤井聡太が第71期王座戦で「新・村田システム」を採用し注目された[[wj-murata]]。',
  pros: ['相手の定跡の土俵に乗せない', '左右銀の使い方が多彩で撹乱できる'],
  cons: ['著作（2023）ベースの新体系で定跡の蓄積が浅い'],
  sources: [{ ref: 'wj-murata', for: '配置・解説' }] }
```

### 3-12. `gangi-hikikaku` 本来の雁木（対振り引き角雁木）

```js
{ id: 'gangi-hikikaku', name: '雁木（対振り引き角）', short: '雁木', reading: 'がんぎ',
  aliases: ['対振り引き角雁木', '本来の雁木戦法'],
  family: 'ibisha-kakukeifu', lead: { piece: '角', files: [7], square: '79' },
  route: ['88', '79'],
  pieces: '玉78 飛28 角79 金69 金58 銀77 銀48 桂89 桂29 香99 香19 歩96 歩87 歩76 歩67 歩56 歩47 歩36 歩25 歩17',
  // ↑Wikipedia「雁木囲い」対振り引き角雁木の基本図から確定（玉78・角79・銀77-48・金69-58・2五歩）
  essential: '角79 銀77 歩25', pace: 'both', senkei: [],
  against: { furibisha: 'ok' },
  pairings: [
    { castle: 'yagura', level: 'ok', why: '角を7九に引いた後、矢倉早囲いから矢倉を目指すのが本来の構想[[wj-gangi]]', sources:[{ref:'wj-gangi',for:'組み合わせ'}] },
  ],
  tags: ['古典', '引き角'], context: '対振り飛車（歴史上初の対振り専用戦法）',
  desc: '江戸時代前期の檜垣是安が考案した史上最初の対振り飛車戦法[[wj-gangi]]。舟囲いの陣形から左銀を▲7七銀と上がり▲7九角と引くと、6九金から2五歩まで階段（雁木）状に連なった駒を登るように角筋が争点（2四・3五）へ通る。1981年棋王戦で米長邦雄が採用し防衛を決めた例もある。対振り引き角のコンセプトは飯島流引き角などに受け継がれている[[wj-gangi]]。',
  pros: ['角筋を活かした飛角連携の先駆け', '矢倉への組み替えが自然'],
  cons: ['美濃囲いの登場後は横からの攻めに弱いと見なされ衰退した'],
  note: '「雁木」の語義は本来の引き角戦法→旧型（相居飛車二枚銀）→新型（2010年代の左銀6七型）と3段階に変化。周期表では角@79セルで嬉野流・引き角系と同じマスに束ねられる',
  sources: [{ ref: 'wj-gangi', for: '配置・解説' }] }
```

### 3-13. 補助エントリ（圧縮案）

| id | 要点（lead/family） | 出典 |
|---|---|---|
| `moriuchi-system` 森内システム | 先手が▲2五歩のあと▲7七角と上がり横歩取り・角換わりを封じる。lead 角@77・family ibisha-kakukeifu・route['88','77']。専用Wikipedia記事なし→別出典必要・pieces要検証 | （要追加） |
| `aono-ryu` 青野流 | 横歩取り△3三角への先手▲5八玉型。variantOf 'yokofudori'（lead 飛@34共通）・pace rapid・senkei['yokofudori']。pieces要検証 | wj-yokofudori |
| `yuuki-ryu` 勇気流 | 同じく▲6八玉型（佐々木勇気）。variantOf 'yokofudori'。pieces要検証 | wj-yokofudori |
| `migigyoku-senpou` 右玉 | 角換わりの持久戦形。lead 玉@38・family ibisha-kakukeifu・senkei['kakugawari']・pairing: migigyoku(best、囲い収録済)。pieces要検証 | wj-migigyoku（既存） |
| `nimaigin` 二枚銀 | ▲5七銀+4七銀の形で仕掛ける対四間/対中飛車。lead 銀@47・family ibisha-silver。pieces要検証 | wj-nimaigin（新規） |
| `hashikaku-nakahara` 端角（中原流） | 対四間で▲9七角と端を覗く。lead 角@97・route['88','97']・family ibisha-kakukeifu・againstTactic{shikenbisha:'good'}。pieces要検証 | wj-hashikaku（新規） |
| `yonte-kaku` 四手角 | 角を▲7九〜4六〜3七〜2六の四手で▲2六へ。lead 角@26・route['88','79','46','37','26']・senkei['yagura']。pieces要検証 | wj-yagura（既存） |
| `46gin-migi` 4六銀右戦法 | 対四間の右銀斜め棒銀。variantOf 'hayakurigin'・route['39','38','37','46']・againstTactic{shikenbisha:'good'}。pieces要検証 | wj-46gin-migi（新規） |

## 4. 手筋（テスジ）・囲いの崩し方の将来拡張案

### 4-1. 現状

- 囲いの崩し方は各囲いの `attacks[]`（攻め方の名前・説明・`gote` 配置・`target`）として最小限あるのみ。「手筋」は戦法でも囲いでもなく、**数手で完結する局所の手順**として第3のコンテンツ種になる。
- 作業中ブランチ `tesuji-combos`（`.claude/worktrees/tesuji`）に `js/data/tesuji.js` が既にあり、`Kakoi.TESUJI` = `{ id, name, reading, role: attack|defense|both, piece, diagram:{files,ranks,frames:[{move?,sente,gote,hand?,caption}]}, counters:[攻め筋id], proverbs:[格言id], sources }` の設計が確立済み。`frames` は盤の一部窓で手順をコマ送り表示する。格言データ（`PROVERBS`）も同ファイルにある。

### 4-2. 提案

- **第1段階（ブランチのマージ）**: `js/data/tesuji.js`＋`js/core/tesuji.js`＋`js/ui/tesuji-modal.js` を main に取り込み、囲い詳細の `attacks` と `counters` を双方向リンクする（底歩は各囲いの「下段への飛車打ち」攻め筋に対応する受け手筋として既に `counters:['side','dan']`）。
- **第2段階（歩の手筋を網羅）**: 継ぎ歩・垂れ歩・叩きの歩・連打の歩・底歩・控えの歩（収録済）に、止め歩・合い打ちの歩・金底の歩・延び歩・突き捨てを追加。格言「三歩あったら継ぎ歩に垂れ歩」「金底の歩は岩より固し」などと対応づける。
- **第3段階（囲いの崩し方シリーズ）**: 矢倉崩し（▲3五歩〜端攻め・雀刺し）、美濃崩し（△1五歩端攻め・2六-3六玉頭）、穴熊崩し（9五歩〜香桂での端破り・無理やりの成り込み）、雁木崩し（横からの飛車打ち）を、囲いごとの `attacks[]` を手順化したものとして frames 付きで提供する。既存 `attacks` の `gote`/`target` を frames の初期・終了図に流用できる設計にする。
- **検出ロジック**: `detect:'fork'`（王手飛車の自動検出）のように、現在局面から手筋が成立しているかを示す検出器を増やしていく（垂れ歩可能地点・底歩の効く局面など）。
- **戦法との接続**: 5手爆弾・鬼殺し・早石田の「ハメ手」は戦法（駒組み）と手筋（局所手順）の中間にある。ハメ手系は `pace:'rapid'`＋`tags:['ハメ手']` の戦法エントリに、該当手筋へのリンクを `desc` で張る形が現行スキーマに最もなじむ。

## 5. 新規 `sources.js` エントリ案

```js
// ---- 戦型大系 ----
'wj-kakugawari':   { title: '角換わり', publisher: 'Wikipedia日本語版', url: 'https://ja.wikipedia.org/wiki/角換わり' },
'wj-aigakari':     { title: '相掛かり', publisher: 'Wikipedia日本語版', url: 'https://ja.wikipedia.org/wiki/相掛かり' },
'wj-yokofudori':   { title: '横歩取り', publisher: 'Wikipedia日本語版', url: 'https://ja.wikipedia.org/wiki/横歩取り' },
// 雁木は既存 'wj-gangi'（雁木囲い＝本来/旧型/新型の3段階を解説）を流用

// ---- 矢倉の個別戦法 ----
'wj-wakisystem':   { title: '脇システム', publisher: 'Wikipedia日本語版', url: 'https://ja.wikipedia.org/wiki/脇システム' },
'wj-yonenaga':     { title: '米長流急戦矢倉', publisher: 'Wikipedia日本語版', url: 'https://ja.wikipedia.org/wiki/米長流急戦矢倉' },
'wj-akutsu':       { title: '阿久津流急戦矢倉', publisher: 'Wikipedia日本語版', url: 'https://ja.wikipedia.org/wiki/阿久津流急戦矢倉' },
// 矢倉3七銀・3七桂・同型・四手角は 'wj-yagura'（矢倉囲い）の「矢倉の諸戦法」節を流用

// ---- 相掛かり・角換わりの個別戦法 ----
'wj-tsukada':      { title: '塚田スペシャル', publisher: 'Wikipedia日本語版', url: 'https://ja.wikipedia.org/wiki/塚田スペシャル' },
'wj-kusarigama':   { title: '鎖鎌銀', publisher: 'Wikipedia日本語版', url: 'https://ja.wikipedia.org/wiki/鎖鎌銀' },
'wj-kimura-jouseki':{ title: '木村定跡', publisher: 'Wikipedia日本語版', url: 'https://ja.wikipedia.org/wiki/木村定跡' },
'wj-ittezon':      { title: '後手番一手損角換わり', publisher: 'Wikipedia日本語版', url: 'https://ja.wikipedia.org/wiki/後手番一手損角換わり' },
'wj-sujichigai':   { title: '筋違い角', publisher: 'Wikipedia日本語版', url: 'https://ja.wikipedia.org/wiki/筋違い角' },
'wj-5te-bakudan':  { title: '5手爆弾（Wikibooks）', publisher: 'Wikibooks', url: 'https://ja.wikibooks.org/wiki/将棋/5手爆弾' },

// ---- 対振り飛車急戦 ----
'wj-boukin':       { title: '棒金', publisher: 'Wikipedia日本語版', url: 'https://ja.wikipedia.org/wiki/棒金' },
'wj-nimaigin':     { title: '二枚銀', publisher: 'Wikipedia日本語版', url: 'https://ja.wikipedia.org/wiki/二枚銀' },
'wj-46gin-migi':   { title: '4六銀右戦法', publisher: 'Wikipedia日本語版', url: 'https://ja.wikipedia.org/wiki/4六銀右戦法' },
'wj-ponpon-kei':   { title: 'ポンポン桂', publisher: 'Wikipedia日本語版', url: 'https://ja.wikipedia.org/wiki/ポンポン桂' },
'wj-hashikaku':    { title: '端角', publisher: 'Wikipedia日本語版', url: 'https://ja.wikipedia.org/wiki/端角' },

// ---- その他 ----
'wj-nakata-XP':    { title: '中田功XP', publisher: 'Wikipedia日本語版', url: 'https://ja.wikipedia.org/wiki/中田功XP' },
'wj-murata':       { title: '村田システム', publisher: 'Wikipedia日本語版', url: 'https://ja.wikipedia.org/wiki/村田システム' },
'wj-eichan':       { title: '山口英夫 (棋士)（英ちゃん流中飛車節）', publisher: 'Wikipedia日本語版', url: 'https://ja.wikipedia.org/wiki/山口英夫_(棋士)' },
'wj-kaku-furi':    { title: '角交換振り飛車', publisher: 'Wikipedia日本語版', url: 'https://ja.wikipedia.org/wiki/角交換振り飛車' },
'wj-morishita-book':{ title: '現代矢倉の闘い（森下卓）書評', publisher: 'shogi-books.com', url: 'https://www.shogi-books.com/yagura/gendai_yagura02.htm' },
```

## 6. 実装留意点

1. **スキーマ制約**（`js/core/validate.js`・旧計画 §1）:
   - `variantOf` は親と**同じ `lead.square`** 必須 → 風車（飛59?）は中飛車（58）の派生にできず独立エントリ。`lead.square` に lead.piece の駒が `pieces` 上に必要。
   - 同じ `lead.square` は `tactic-nav.js`（placeTactics）で1セルに束ねられる → 角@79 は嬉野流・新嬉野流・メイド・鳥刺し・飯島流＋提案の雁木引き角で6件に。セル内の表示上限を確認。
   - `essential` ∩ 囲い `core` が重なる組み合わせは `best` 不可（例: 米長流は `essential` に銀77を入れないと yagura core と衝突）。
   - `best` pairing は `why`＋`sources` 必須、`[[ref]]` 引用は宣言済み ref のみ。
   - `hand:'角'` を持つ両者の組み合わせは `labels()` で自動的に「角換わり」になる（senkei タグ不要）。
2. **テスト**: `npm test` = `validate-castles.js`（スキーマ検証）→ `unit-test.js`（互換性マトリクス含む。戦法追加時は `rm tools/expected-matrix.txt` して再生成）→ `ui-check.js`（周期表・詳細・ハッシュ往復）。
3. **ratings**: `tactic-ratings.js` は pace と矛盾させない（rapid=4〜5, both=3, slow=1〜2 の speed）。新戦法に合わせて追加。
4. **後手番専用戦法**: パックマン・阪田流・鎖鎌銀・阿久津流・一手損は現行の先手視点モデルに乗らない。導入するなら「後手側エントリ」という設計判断が別途要る（旧計画 §4 で保留済みのものと同じ扱い）。
5. **SENKEI 導入時**: `SENKEI_LABELS` の重複定義を `Kakoi.SENKEI[id].name` に寄せる。labels() の `aiyagura` は `yagura` エントリへのエイリアス解決で吸収。`basic:true` の戦型旗艦戦法（3七銀・相掛かり・横歩取り）は戦法ブラウザの初期候補に。
6. **本書の `pieces: '要検証'`** は文字列ではなく未確定のしるし。実装時に各記事の基本図・手順から組み立てて入れる。特に矢倉系は 24手組/新24手組（▲2五歩突き/保留）で局面が変わるため、採用する代表局面を `note` に明記する。

### 参考にした既存資料

- `docs/archived/plan-tactic-additions.md`: スキーマ制約・パックマン等の保留基準
- `.claude/worktrees/tesuji/`（tesuji-combos ブランチ）: `js/data/tesuji.js` の手筋データ設計
- `js/core/constraints.js` `SENKEI_LABELS`/`labels()`: 戦型判定ロジック
