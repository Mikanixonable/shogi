# 囲いカバレッジ調査：未収録囲いリストと組み込み提案（coverage-castles）

作成: 2025年 文献調査（ja.wikipedia「囲い」「矢倉囲い」「穴熊囲い」「アヒル囲い」「箱入り娘」「壁囲い」「左玉」「無敵囲い」「多伝囲い」「相掛かり」、en.wikipedia「Castle (shogi)」、shougi.jp 囲い一覧、将棋上達塾、将棋ジム等を webfetch で突合）

目的: 現在収録の 39 件（居飛車 29 + 振り飛車 10）との差分を洗い出し、次弾として組み込む囲いの優先順位付けとデータ案を作る。コードは編集しない（この文書のみ）。

凡例:
- **優先度 高** … 文献上頻出・基本形/発展の結節点。次弾の主対象
- **優先度 中** … 有名な発展形。データ化の価値あり
- **優先度 低** … 珍形・駒落ち専用・冗談囲い・出典が薄いもの
- **core 欄** … Wikipedia/shougi.jp の模式図から確定できた配置のみ記載。`?` は文献未確認で実装前に要検証

---

## ① 未収録囲いの総表（優先度順）

### 優先度 高（基本形・文献頻出）

| 囲い | 読み | side | family/subtype 案 | core（文献確認済み） | 備考 |
|---|---|---|---|---|---|
| へこみ矢倉 | へこみやぐら | ibisha | yagura / heko（新設） | `玉88 銀77 金78 金68` | 金矢倉の6七金を6八に下げた形。角換わり・急戦矢倉・角交換振り飛車で頻出 [[wj-yagura]] |
| 総矢倉 | そうやぐら | ibisha | yagura / sou（新設） | `玉88 銀77 金78 金67 銀57` | 金矢倉+右銀5七。金銀4枚。相総矢倉は千日手定跡で有名 [[wj-yagura]] |
| 箱入り娘 | はこいりむすめ | ibisha | funa / kin68 | `玉78 銀79 金69 金68` | 舟囲いの5八金を6八へ。命名は加藤治郎、1947年『将棋世界』読者投票由来 [[wj-hakoiri]] |
| 壁囲い（早囲い・三手囲い） | かべがこい | furibisha | mino / kabe（新設） | `玉38 銀48`（rest 金49） | 振り飛車急戦用の最速囲い。金美濃へ発展可 [[wj-kabegakoi]] |
| 左玉 | ひだりぎょく | furibisha | hidarigyoku（新 family） | `玉78 銀67 金58 金38`（高田流例） | 相振り飛車・対振り飛車（向かい飛車型）。田丸流・松浦流銀多伝など型が多い [[wj-hidarigyoku]] |
| イチゴ囲い | いちごがこい | ibisha | nakazumai / ichigo（新設） | `玉68 銀79 金78 銀38 金49`（ja例）※en は金58型 | 相掛かり腰掛け銀の代表的な6八玉型 [[wj-aigakari|we-castle]] |
| 田尻穴熊 | たじりあなぐま | ibisha | anaguma / yonmai | `玉99 香98 桂89 銀88 銀78 金79 金69` | アマ強豪・田尻隆司考案の四枚穴熊。金銀が2×2に凝縮 [[wj-anaguma]] |
| 端玉銀冠（米長玉） | はしぎょくぎんかんむり | ibisha | mino / hashigyoku（新設） | `玉98 銀87 角88 金78 金67`（米長玉）/ `玉98 銀87 銀77 金78 金67`（銀冠型） | 左美濃系統の最終形の一つ。別名 米長玉銀冠 [[wj-hidarimino|we-castle]] |
| かんぴょう囲い | かんぴょうがこい | ibisha | mino / hashigyoku | `玉98 香97 銀87 角77 金78 金68` | 端玉銀冠の別バリエーション（香を9七へ突き出した形） [[wj-kakoi]] |
| 串カツ囲い（端美濃） | くしかつがこい | ibisha | mino / hashigyoku | `玉98 銀88 金78 金79` | 玉9八と香9九が串に刺さったように見える珍形。ミレニアムへ2手で発展 [[wj-kakoi|we-castle]] |
| 大住囲い（大隅囲い） | おおずみがこい | furibisha | kinmusou / oosumi（新設） | `玉38 金48 銀39` | 江戸時代からある古典囲い。3手で組める早囲いの一種（「三手囲い」「早囲い」とも） [[we-castle]] |
| アヒル囲い | あひるがこい | ibisha | kinbiraki（新 family）| `玉58 銀68 銀48 金79 金39` | 金開きの代表形。アマ人気が高い奇襲系の構え。別名 御神酒指し [[wj-ahiru|we-castle]] |

### 優先度 中（有名な発展形・準基本形）

| 囲い | 読み | side | family/subtype 案 | core（確認状況） | 備考 |
|---|---|---|---|---|---|
| 菱矢倉（6六銀型） | ひしやぐら | ibisha | yagura / hishi（新設） | `玉88 銀77 金78 金67 銀66` | 相矢倉で頻出の右銀活用形。「6六銀型」と呼ぶ方が一般的 [[wj-yagura]] |
| 流れ矢倉 | ながれやぐら | ibisha | yagura / nagare（新設） | `玉88 金78 金67 銀57` | 守備銀が中央へ進出した形。1947年『将棋世界』命名投票の一つ [[wj-yagura]] |
| 銀立ち矢倉 | ぎんだちやぐら | ibisha | yagura / gintachi（新設） | `玉88 銀76 金78 金67` | 対振り飛車・玉頭位取り用の囲い。位取り系統の代表 [[wj-yagura|wj-kakoi]] |
| 四角矢倉 | しかくやぐら | ibisha | yagura / shikaku（新設） | 金四角 `玉88 銀77 金78 金67 銀68` / 銀四角 `玉88 銀77 銀67 金78 金68` | 金銀4枚が2×2の四角を作る強固な形。銀四角はビッグ4と構造類似 [[wj-yagura]] |
| 6八銀型 金矢倉 | ろくはちぎんがた | ibisha | yagura / gin68（新設） | `玉88 金78 金67 銀68` | 左美濃+右四間対策。桂馬攻めを避けて銀を6八に留める形 [[wj-yagura]] |
| 一文字矢倉 | いちもんじやぐら | ibisha | yagura / ichimonji（新設） | `玉78 銀77 金67 銀57 金47` | 金銀4枚が三段目に一直線に並ぶ形 [[wj-yagura]] |
| 富士見矢倉 | ふじみやぐら | ibisha | yagura / fujimi（新設） | `玉88 銀77 金78 金67 銀56 角68`＋歩55 | 5五歩の位+5六銀で中央を押さえる攻め志向の矢倉 [[sj-fujimi]] |
| 角矢倉 | かくやぐら | ibisha | yagura / kaku（新設） | `玉88 銀77 金78 角67` | 6七を金ではなく角が担当。筋違い角から現れる [[sj-kakuyagura]] |
| 豆腐矢倉 | とうふやぐら | ibisha | yagura / tofu（新設） | `玉88 銀86 金78 金67 角68` | 金矢倉が桂馬攻めで変形した「柔らかい」形。囲いというより崩れ形だが文献独立節あり [[wj-yagura]] |
| 流線矢倉 | りゅうせんやぐら | ibisha | yagura / ryusen（新設） | `玉89 銀88 金78 金67 銀57 桂77` | 流れ矢倉×菊水矢倉のミックス [[wj-yagura]] |
| トラック囲い | とらっくがこい | ibisha | funa / torakku（新設） | `玉78 銀67 銀57 金68 金58` | 珍形だが en.wiki・ja.wiki 囲い記事双方に掲載 [[we-castle|wj-kakoi]] |
| 文鎮囲い | ぶんちんがこい | ibisha | funa or kinbiraki / bunchin | `玉78 銀88 金68 金58 桂77`（＋香98） | 地下鉄飛車用の囲い。8段目が文鎮状に一直線 [[wj-kakoi|we-castle]] |
| 平目（双片美濃） | ひらめ | furibisha | mino / hirame（新設） | `玉28 銀38 金49 金59` | 金2枚を下段に横並びに置く美濃系変形。平目戦法由来 [[wj-kakoi|we-castle]] |
| ちょんまげ美濃 | ちょんまげみの | furibisha | mino / chonmage（新設） | `玉28 銀38 金49`＋歩26 | 美濃の2七歩が2六に出た形。陽動振り飛車で現れる [[sj-chonmage]] |
| 坊主美濃 | ぼうずみの | furibisha | mino / bouzu（新設） | `玉28 銀38 金49`（2筋歩なし） | 片美濃から2七歩が消えた形。ひねり飛車で現れる [[sj-bouzu]] |
| 現代穴熊（振り飛車） | げんだいあなぐま | furibisha | anaguma / gendai（新設） | `玉19 香18 桂29 銀28 金49 金47` | 金1枚を七段目に配した広瀬章人流の形 [[wj-anaguma]] |
| 相振り穴熊 4八金型 | よんはちきんがた | furibisha | anaguma / kin48（新設） | `玉19 香18 桂29 銀28 金48 金38` | 相振り飛車用。広瀬流は金を4筋に2枚並べる型（金49・金48） [[wj-anaguma]] |
| 銀冠穴熊（居飛車） | ぎんかんあなぐま | ibisha | anaguma / ginkan | `玉99 香98 桂89 銀87 金78 金67`（※反転推定・要検証） | 囲い記事で居飛車穴熊系統に明記。振り飛車銀冠穴熊の反転形と推定 [[wj-kakoi]] |
| 音無し構え | おとなしのかまえ | ibisha | anaguma / otonashi（新設） | `玉99 香98 桂89 金88 銀87 金78` | 居飛車穴熊系統。8八金+8七銀の硬い上部構造 [[wj-kakoi]] |
| 居飛車金美濃 | いびしゃきんみの | ibisha | mino / kinmino（新設） | `玉88 金78 金67 銀79 銀57 角77` | 居飛車穴熊系統に分類される美濃の金版 [[wj-kakoi]] |
| 中飛車左穴熊 | なかびしゃひだりあなぐま | furibisha | anaguma / sanmai | `玉99 香98 桂89 銀88 金78 金79`（居飛車穴熊と同形） | 中飛車で玉を左端（9九）に囲う形。2014年頃流行 [[wj-hidarigyoku|wj-kakoi]] |
| 無敵囲い | むてきがこい | furibisha | nakazumai or 新family | `玉59 金49 金69 銀48 銀68 飛58` | 初心者囲い・最強囲いとも。3手で完成する冗談囲いだが認知度は高い [[wj-muteki]] |

### 優先度 低（珍形・駒落ち・要検証）

| 囲い | 読み | side | family 案 | core | 備考 |
|---|---|---|---|---|---|
| カタツムリ | かたつむり | ibisha | yagura or itadori | `?` | 玉頭位取り用囲い（銀立ち矢倉系） [[wj-kakoi]] |
| 左多伝囲い | ひだりたでんがこい | ibisha | itadori（新設？） | `?` | 5筋位取り6筋(4筋)歩交換型 [[wj-kakoi|wj-taden]] |
| 銀雲雀 | ぎんひばり | ibisha | itadori | `?` | 左銀4八銀型5筋位取り [[wj-kakoi]] |
| 左木村美濃 | ひだりきむらみの | ibisha | mino / kata | `玉88 金78 銀67`（反転推定・要検証） | 6筋位取り用の居飛車版木村美濃 [[wj-kakoi]] |
| 多伝囲い（銀多伝） | たでんがこい | ibisha（駒落ち） | komaochi（新設） | `玉38 金48 銀47 銀46 桂37` | 二枚落ち下手用。4筋の位が骨子。金多伝型もあり [[wj-taden]] → **実装済み**（`gintaden`・`kintaden`） |
| 金象眼 | きんぞうがん | ibisha（駒落ち・上手） | komaochi | `玉67 銀57 金58 桂77` | 角落ち上手の囲い [[wj-kakoi|we-castle]] → **実装済み**（`kinzogan`、日本語版の5筋型 `玉57 銀47 金58 桂67` を採用。本表は英語版の形） |
| 銀象眼 | ぎんぞうがん | ibisha（駒落ち・上手） | komaochi | `玉67 銀57 銀58 桂77` | 角落ち上手の囲い（金象眼の銀版） [[wj-kakoi|we-castle]] → **実装済み**（`ginzogan`、同上） |
| カギ囲い | かぎがこい | furibisha（駒落ち・上手） | komaochi | `玉78 銀88 金67 銀57 金48` | 角落ち上手の△5三銀型右四間飛車で現れる [[wj-kakoi]] → **実装済み**（`kagi`、日本語版の図では金5八・桂7七/3七に従う） |
| 金盾囲い | きんじゅんがこい | ibisha | funa | `玉78 角88 金68 金69 銀57` | 舟囲い系統の盾囲い [[wj-kakoi]] → **実装済み**（`kinjun`） |
| 大盾囲い | おおじゅんがこい | ibisha | funa | `玉78 角88 銀68 金69 金67` | 舟囲い系統の盾囲い（金6七型） [[wj-kakoi]] → **実装済み**（`oojun`） |
| セメント囲い | せめんとがこい | ibisha | funa | `?` | 舟囲い系統に列挙。形未確認 [[wj-kakoi]] |
| 二枚囲い | にまいがこい | ibisha | funa | `?` | 同上 |
| カタ囲い | かたがこい | ibisha | nakazumai? | `?` | 相掛かり系に列挙。形未確認 [[wj-kakoi]] |
| ポナンザ囲い | ぽなんざがこい | ibisha | yagura / kata | `?` | ボナンザ囲いと同形or近形（後継ソフト名由来） [[wj-kakoi|wj-bonanza]] |
| 半カブト囲い | はんかぶとがこい | ibisha | gangi | `?` | 矢倉系統に列挙。兜矢倉の半形と推定されるが図未確認 [[wj-kakoi]] |
| 金冠 | きんかんむり | ibisha | yagura | `?` | 矢倉系統の末尾に列挙。図未確認 [[wj-kakoi]] |
| 高矢倉 | たかやぐら | ibisha | yagura | `?` | 同上 |
| 半矢倉 | はんやぐら | ibisha | yagura / kata | 片矢倉の別名 | エントリ不要 → **実装済み**（katayagura の aliases に追加済み） |
| ずれ美濃 | ずれみの | furibisha | mino / zure | `?` | 美濃を一路ずらした形（阪田流向かい飛車・立石流） [[wj-kabegakoi|wj-kakoi]] |
| 片穴熊 | かたあなぐま | furibisha | anaguma / kata | `?` | 振り飛車穴熊の金1枚型と推定されるが図未確認 [[wj-kakoi]] |
| 振り飛車ミレニアム | ふりびしゃみれにあむ | furibisha | yagura or mino | `?` | 囲い記事の振り飛車節に列挙。図未確認 [[wj-kakoi]] |
| 風車 | ふうしゃ/かざぐるま | furibisha | ? | `?` | 左右バランス型に列挙。戦法名としても存在し囲いとしての固定形は要検証 [[wj-kakoi|wj-muteki]] |
| 神吉流穴熊 | かみよしりゅうあなぐま | furibisha | anaguma | `?` | 囲い記事は居飛車穴熊系統に列挙するが神吉流は三間飛車戦法。要検証 [[wj-kakoi]] |
| 平美濃 | ひらみの | ibisha | mino | `?` | 左美濃系統の変形として列挙。形未確認 [[wj-kakoi]] |
| 6七金型穴熊 | ろくななきんがた | ibisha | anaguma | `?` | 居飛車穴熊系統に列挙。6七に金を置く型と推定 [[wj-kakoi]] |
| 角道開型銀冠 | かくみちひらきがたぎんかん | furibisha（駒落ち） | mino / gincan | `?` | 飛香落ち・飛車落ち下手用 [[wj-kakoi]] |
| 四段端玉 | よんだんはしぎょく | ibisha | chudan / yondan（新設） | `玉96 金86 金76 銀66 桂77` | 中段玉系統の第二の代表形 [[wj-kakoi|we-castle]] → **実装済み**（`yondanhashigyoku`） |
| エア金（銀冠エア金） | えあきん | furibisha | mino / gincan | `玉17 銀27 桂37 金47 金38 香18` | 銀冠を横から攻められたときの終盤の逃げ形。珍形 [[we-castle]] → **実装済み**（`airkin`） |
| 珍玉・棒玉 | ちんぎょく/ぼうぎょく | ibisha | ? | `?` | 花村流・英春流カメレオン棒銀など。冗談囲い系 [[wj-kakoi]] |
| 大阪囲い | おおさかがこい | ibisha | kinbiraki | `?` | 金開きのバリエーションとして列挙。形未確認 [[wj-kakoi]] |
| 矢倉早囲い | やぐらはやがこい | ibisha | yagura | `?` | 戦法名として有名だが固定形は曖昧。将棋ジム一覧にも掲載 [[wj-yagura]] |

### 未確認・採用見送り候補

- **大山囲い** … 検索では独立した囲い名として確認できず（「大山十五世名人の陣形と囲いの破り方」は書名）。大山流の駒組みを指す俗称の可能性。文献確定までは採用見送り
- **錨囲い** … 標準的な囲い名として確認できず。カギ囲いとの混同の可能性
- **千日手囲い** … 確認できず。「総矢倉の相矢倉＝千日手定跡」に由来する誤解か
- **イルカ囲い** … 確認できず（ブログ等の俗称の可能性）
- **カニ缶** … 確認できず
- **開き囲い** … 「金開き」の別表現と推定。アヒル囲いの aliases として扱えばよい
- **Lucky+Lupin（elmo の原型）** … elmo囲いは既収録。Lucky 時代の類似形は独立した囲い名ではないため新規エントリは不要（elmo の desc/note に追記する程度）
- **居飛車の四枚美濃・銀冠** … 既収録の yonmaimino・hidariginkan が該当
- **居飛車の銀冠穴熊/銀冠** … 銀冠穴熊（居飛車）は上記「中」に列挙。振り飛車の gincan/ginkananaguma は既収録（同名だが side 違いで別エントリにするかは実装判断）

---

## ② 優先度「高」の囲いのデータ案

スキーマは castles-*.js と同じ。`shell`/`rest`/`filler` は既存エントリの同 family から流用する想定で記す（要 validate 確認）。desc 内の [[ref]] は ⑤ の新規 sources 案と既存 ref を併用。

### hekomi-yagura（へこみ矢倉）ibisha

```js
{
  id: 'hekomiyagura', name: 'へこみ矢倉', short: 'へこみ矢倉', reading: 'へこみやぐら',
  aliases: ['凹み矢倉'], side: 'ibisha', from: 'yagura', family: 'yagura', subtype: 'heko', setup: 'ibisha',
  core: '玉88 銀77 金78 金68',
  shell: '歩97 歩87 歩76 歩67',          // 6筋歩は6七に留めるのが要点（突けば金矢倉に発展）
  rest: '銀26 金58',
  filler: '香99 桂89 角88→角がいる場合は68か46',  // 角換わりでは角は持ち駒 or 46/57。hand:'角'案も検討
  tags: ['角換わり', '相居飛車', '急戦矢倉'],
  desc: '金矢倉の6七金を一段下げて6八に置いた形（玉8八・銀7七・金7八・金6八）[[wj-yagura]]。前線が「へこむ」ため上部の厚みは金矢倉に劣るが、6八金で7筋・8段目が厚く、角換わりや急戦矢倉（後手番）、角交換振り飛車に多く現れる[[wj-yagura]]。兜矢倉から発展することが多い[[wj-yagura]]。',
  ratings: { hard: 3, wide: 3, top: 4, side: 4, quick: 3 },
  pros: [
    { t: '6八金が8段目を厚くし、横（飛車）からの攻めに金矢倉より強い[[wj-yagura]]', sq: ['68', '78', '88'] },
    { t: '6六歩を突けばそのまま金矢倉に発展できる[[wj-yagura]]', sq: ['66', '67'] },
  ],
  cons: [
    { t: '6七が空き、上部の厚みは金矢倉に劣る', sq: ['67', '76'] },
    { t: '端攻め（9筋）は矢倉系共通の弱点', sq: ['97', '98'] },
  ],
  attacks: [
    { id: 'gyokuto', name: '玉頭攻め', t: '△7五歩・△6五桂で6七の空きを突き、玉頭から押しつぶしにくる。金矢倉より6七が薄い分だけ早い。', gote: '歩75 桂65', target: ['67', '77', '87'] },
    { id: 'hashi', name: '端攻め', t: '△9五歩から端を突き捨て、香・桂・角で玉のコビンを狙う。', gote: '歩95 香91 桂73', target: ['97', '98', '87'] },
  ],
  sources: [{ ref: 'wj-yagura', for: '配置・解説' }, { ref: 'we-castle', for: '配置' }, { ref: 'sj-hekomi', for: '配置・解説' }],
}
```

### souyagura（総矢倉）ibisha

```js
{
  id: 'souyagura', name: '総矢倉', short: '総矢倉', reading: 'そうやぐら',
  aliases: ['四枚矢倉', '完全矢倉'], side: 'ibisha', from: 'yagura', family: 'yagura', subtype: 'sou', setup: 'ibisha',
  core: '玉88 銀77 金78 金67 銀57',
  shell: '歩97 歩87 歩76 歩66 歩56',
  filler: '香99 桂89 角68→角46が多い 歩47 歩37',
  tags: ['相居飛車', '持久戦', '金銀4枚', '千日手'],
  desc: '金矢倉に右銀を5七へ加えた金銀4枚の矢倉（玉8八・銀7七・金7八・金6七・銀5七）[[wj-yagura]]。角を4六に動かした場合に組まれることが多く、主に後手側で見られる[[wj-yagura]]。相総矢倉になると双方とも攻め手を欠き、飛車を動かすだけの千日手になりやすいことで知られる[[wj-yagura]]。',
  ratings: { hard: 5, wide: 4, top: 5, side: 4, quick: 1 },
  pros: [
    { t: '金銀4枚で非常に堅く、上部・横ともに厚い[[wj-yagura]]', sq: ['77', '78', '67', '57'] },
    { t: '相手が同型を目指すと千日手を狙える（戦略的な引き分け）', sq: [] },
  ],
  cons: [
    { t: '金銀4枚を守りに使うので攻め駒が少ない' },
    { t: '攻め手が乏しく、自分から仕掛けにくい[[wj-yagura]]' },
  ],
  attacks: [
    { id: 'hashi', name: '端攻め', t: '金銀が中央〜左に寄る分、端（9筋）への対応は残る。', gote: '歩95 香91 桂73', target: ['97', '98'] },
  ],
  sources: [{ ref: 'wj-yagura', for: '配置・解説' }, { ref: 'we-fortress', for: '配置' }, { ref: 'sj-souyagura', for: '配置・解説' }],
}
```

### hakoiri（箱入り娘）ibisha

```js
{
  id: 'hakoiri', name: '箱入り娘', short: '箱入り娘', reading: 'はこいりむすめ',
  aliases: ['ガール・イン・ザ・ハウス'], side: 'ibisha', from: 'funa', family: 'funa', subtype: 'kin68', setup: 'ibisha',
  core: '玉78 銀79 金69 金68',
  shell: '歩87 歩76 歩67 歩56',
  rest: '銀26',
  filler: '角88 香99 桂89 歩96 歩47 歩36',
  tags: ['対振り飛車', '急戦'],
  desc: '舟囲いから5八の金を6八へ移した形（玉7八・銀7九・金6九・金6八）[[wj-hakoiri]]。玉が箱に入ったように見えることから加藤治郎が命名し、1947年『将棋世界』の駒組名称募集で決まった[[wj-hakoiri]]。舟囲いの弱点だった6九金を6八金で補強し、角頭を狙う3筋（7筋）回り飛車後の銀交換の割り打ちも避けられる[[wj-hakoiri]]。',
  ratings: { hard: 3, wide: 3, top: 2, side: 3, quick: 4 },
  pros: [
    { t: '舟囲いから1手で堅くでき、6筋を金2枚が守る[[wj-hakoiri]]', sq: ['68', '69', '67'] },
    { t: '4六銀右戦法など最短の仕掛けと両立する[[wj-hakoiri]]' },
  ],
  cons: [
    { t: '右辺への退路が塞がり玉が窮屈。端・玉頭に弱い[[wj-hakoiri]]', sq: ['79', '77', '87'] },
    { t: '7九銀を動かせず働きの悪い駒になりやすい[[wj-hakoiri]]', sq: ['79'] },
  ],
  attacks: [
    { id: 'gyokuto', name: '玉頭攻め', t: '△7五歩・△6五桂で7七を狙う。銀冠・高美濃まで発展された持久戦では左銀急戦が効きにくい[[wj-hakoiri]]。', gote: '歩75 桂65', target: ['77', '87'] },
  ],
  sources: [{ ref: 'wj-hakoiri', for: '配置・解説' }, { ref: 'we-castle', for: '配置' }, { ref: 'sj-hakoiri', for: '配置・解説' }],
}
```

### kabegakoi（壁囲い/早囲い/三手囲い）furibisha

```js
{
  id: 'kabegakoi', name: '壁囲い（早囲い）', short: '壁囲い', reading: 'かべがこい',
  aliases: ['早囲い', '三手囲い'], side: 'furibisha', family: 'mino', subtype: 'kabe', setup: 'furibisha', basic: true,
  core: '玉38 銀48',
  shell: '歩16 歩27 歩37 歩47',
  rest: '金49 金69 銀67',
  filler: '香19 桂29',
  tags: ['対居飛車', '急戦向き', '基本形'],
  desc: '玉を3八、右銀を4八に動かすだけの振り飛車急戦用の囲い[[wj-kabegakoi]]。早囲い・三手囲いとも呼ばれ、金銀2枚なので舟囲いよりも堅さは劣るが、左金を5八に添えたり、2八玉・3八金の片美濃、さらに金美濃へ発展できる[[wj-kabegakoi]]。',
  ratings: { hard: 1, wide: 2, top: 1, side: 3, quick: 5 },
  pros: [
    { t: '2〜3手で形になる最速クラスの囲い[[wj-kabegakoi]]' },
    { t: '片美濃・金美濃への発展性がある[[wj-kabegakoi]]', sq: ['28', '38', '58'] },
  ],
  cons: [
    { t: '金銀2枚で上部も横も薄い[[wj-kabegakoi]]', sq: ['37', '27', '58'] },
  ],
  attacks: [
    { id: 'gyokuto', name: '玉頭攻め', t: '△3五歩・△2五歩で玉の正面を直接攻められる。', gote: '歩35 歩25', target: ['36', '37', '26'] },
  ],
  sources: [{ ref: 'wj-kabegakoi', for: '配置・解説' }, { ref: 'we-castle', for: '配置' }, { ref: 'sj-hayagakoi', for: '解説' }, { ref: 'sj-sante', for: '解説' }],
}
```

### hidarigyoku（左玉）furibisha

```js
{
  id: 'hidarigyoku', name: '左玉（高田流）', short: '左玉', reading: 'ひだりぎょく',
  side: 'furibisha', family: 'hidarigyoku', setup: 'furibisha', kingWing: 'rook',
  core: '玉78 銀67 金58 金38',
  shell: '歩96 歩76 歩66 歩56',
  rest: '銀47',
  filler: '香99 角68 桂29 歩47 歩37 歩27 歩17',   // 飛車は8筋/9筋想定→setup側の調整も検討
  tags: ['相振り飛車', '対振り飛車', '玉飛接近'],
  desc: '振り飛車側が玉を左側（7〜8筋）に囲う構え。相振り飛車では向かい飛車型で相手飛車から玉を遠ざけ、対振り飛車でも8筋に飛車を回して使う[[wj-hidarigyoku]]。「玉飛接近すべからず」の格言に反するがバランスが良く自陣の打ち込みの隙が少ない[[wj-hidarigyoku]]。図は高田流（松浦流銀多伝型）。田丸流は6七銀-5八金型のほか6八玉の金冠型もある[[wj-hidarigyoku]]。',
  ratings: { hard: 3, wide: 4, top: 3, side: 3, quick: 3 },
  pros: [
    { t: '相手飛車から玉が遠く、上部への圧力を受けにくい[[wj-hidarigyoku]]', sq: ['78', '67'] },
    { t: '自玉の懐が広く逃げ道が豊富[[wj-hidarigyoku]]' },
  ],
  cons: [
    { t: '右辺（1〜3筋）が薄く、玉頭・右辺の攻防に弱い[[wj-hidarigyoku]]', sq: ['38', '28', '18'] },
    { t: '飛車と玉が近く成り込み・両取りの筋がある[[wj-hidarigyoku]]' },
  ],
  attacks: [
    { id: 'gyokuto', name: '玉頭攻め（右辺）', t: '右辺の薄さを突き、△2四歩〜△2二銀〜角銀桂で玉頭（7筋・6筋）を攻める。左玉側の狙いと同じ筋で逆に攻められることも。', gote: '歩24 銀22 角46', target: ['76', '67', '78'] },
  ],
  sources: [{ ref: 'wj-hidarigyoku', for: '配置・解説' }, { ref: 'wj-kakoi', for: '配置' }],
}
```

### ichigo（イチゴ囲い）ibisha

```js
{
  id: 'ichigo', name: 'イチゴ囲い', short: 'イチゴ囲い', reading: 'いちごがこい',
  side: 'ibisha', family: 'nakazumai', subtype: 'ichigo', setup: 'ibisha',
  core: '玉68 銀79 金78 銀38 金49',
  shell: '歩97 歩87 歩76 歩67 歩57 歩47 歩37',
  rest: '銀79（coreに含む）',
  filler: '角88 香99 桂89 桂29',
  tags: ['相居飛車', '相掛かり・横歩取り'],
  desc: '玉を6八に上げ、左右対称に金銀を配した相掛かりの囲い（玉6八・銀7九・金7八・銀3八・金4九）[[wj-aigakari|sj-ichigo]]。腰掛け銀の6八玉型（△4二玉型）として相掛かりでよく現れる。英語圏では金を7八・5八に置き左銀を初期位置に残す形（Strawberry castle）として紹介される[[we-castle]]。',
  ratings: { hard: 3, wide: 4, top: 3, side: 3, quick: 4 },
  pros: [
    { t: '左右対称でバランスがよく、どちらの翼にも対応しやすい' },
    { t: '手数が少なく相掛かりの速い展開に間に合う[[wj-aigakari]]' },
  ],
  cons: [
    { t: '6八玉は戦場に近く上部（5〜7筋）が薄い', sq: ['67', '57', '58'] },
  ],
  attacks: [
    { id: 'gyokuto', name: '玉頭攻め', t: '△5五歩・△4五桂などで6七〜5七の頭上を攻められる。', gote: '歩55 桂45', target: ['67', '57', '68'] },
  ],
  sources: [{ ref: 'wj-aigakari', for: '配置（相掛かり記事の囲い節）' }, { ref: 'we-castle', for: '配置（別形）' }, { ref: 'sj-ichigo', for: '解説' }],
}
```

### tajiri-anaguma（田尻穴熊）ibisha

```js
{
  id: 'tajiri-anaguma', name: '田尻穴熊', short: '田尻穴熊', reading: 'たじりあなぐま',
  side: 'ibisha', from: 'anaguma', family: 'anaguma', subtype: 'yonmai', setup: 'ibisha',
  core: '玉99 香98 桂89 銀88 銀78 金79 金69',
  shell: '歩97 歩87 角77 歩67',      // ※角77はwiki図の配置。filler 側に回すか要検討
  filler: '歩66 歩56 歩47 歩37',
  tags: ['対振り飛車', '持久戦', '金銀4枚'],
  desc: 'アマチュア強豪の田尻隆司が考案した四枚穴熊[[wj-anaguma]]。銀8八・銀7八・金7九・金6九と金銀4枚を玉の周囲に凝縮し、7七に角を置いた形。上部の銀2枚が玉頭を覆い、横への耐性も高い。',
  ratings: { hard: 5, wide: 2, top: 4, side: 5, quick: 1 },
  pros: [
    { t: '銀2枚が玉頭を覆い上部・横ともに強い', sq: ['88', '78', '87'] },
    { t: '金7九・金6九が玉の下段と右辺を固める', sq: ['79', '69'] },
  ],
  cons: [
    { t: '金銀4枚を動かす手数がかかる' },
    { t: '端攻め（9筋）に弱い（穴熊共通）[[wj-anaguma]]', sq: ['97', '98', '99'] },
  ],
  attacks: [
    { id: 'hashi', name: '端攻め', t: '△9五歩から端を突き捨て、香・桂を足して9筋を破る。穴熊共通の攻略法[[wj-anaguma]]。', gote: '歩95 香91 桂73', target: ['97', '98', '99'] },
  ],
  sources: [{ ref: 'wj-anaguma', for: '配置・解説' }],
}
```

### hashigyoku-ginkan（端玉銀冠／米長玉）ibisha

```js
{
  id: 'hashigyoku-ginkan', name: '端玉銀冠（米長玉）', short: '端玉銀冠', reading: 'はしぎょくぎんかんむり',
  aliases: ['米長玉', '米長玉銀冠'], side: 'ibisha', from: 'hidariginkan', family: 'mino', subtype: 'hashigyoku', setup: 'ibisha',
  core: '玉98 銀87 銀77 金78 金67',
  shell: '歩96 歩86 歩76 歩66 歩56',
  rest: '角79',
  filler: '香99 桂89 歩47 歩37',
  tags: ['対振り飛車', '持久戦', '金銀4枚', '端玉'],
  desc: '左銀冠（四枚）から玉を1筋ずらして9八に据えた端玉型の銀冠[[wj-hidarimino|we-castle]]。米長邦雄に由来して米長玉（米長玉銀冠）とも呼ばれる。玉が端に逃げた分だけ上部の圧力を受けにくいが、端歩を突いていないと端攻めが直結する。',
  note: '簡易型は「米長玉」（玉9八・銀8七・角8八・金7八・金6七、en.wiki Yonenaga King 図）。香を9七に突き出した別形がかんぴょう囲い（玉9八・香9七・銀8七・角7七・金7八・金6八）で、別エントリ化も可 [[wj-kakoi|we-castle]]。',
  ratings: { hard: 4, wide: 3, top: 5, side: 3, quick: 1 },
  pros: [
    { t: '銀冠構造で上部に強く、端にいる分だけ玉頭への当たりを受けにくい', sq: ['87', '86', '77'] },
    { t: '9九方向へ玉が逃げやすい', sq: ['98', '99'] },
  ],
  cons: [
    { t: '端攻め（9筋）が直結しやすい', sq: ['96', '97', '98'] },
    { t: '組むのに手数がかかる' },
  ],
  attacks: [
    { id: 'hashi', name: '端攻め', t: '△9五歩から端を突き、9六歩を取って玉の正面から崩す。端玉なので直結する。', gote: '歩95 香91 桂73', target: ['96', '97', '98'] },
  ],
  sources: [{ ref: 'wj-hidarimino', for: '配置・解説' }, { ref: 'we-castle', for: '配置（米長玉）' }, { ref: 'sj-hashigyoku-ginkan', for: '配置・解説' }],
}
```

### kushikatsu（串カツ囲い）ibisha

```js
{
  id: 'kushikatsu', name: '串カツ囲い（端美濃）', short: '串カツ', reading: 'くしかつがこい',
  aliases: ['端美濃', '端美濃囲い'], side: 'ibisha', family: 'mino', subtype: 'hashigyoku', setup: 'ibisha',
  core: '玉98 銀88 金78 金79',
  shell: '歩97 歩87 歩67',
  rest: '銀26',
  filler: '香99 桂89 角88→実は88は銀が占有。角79 歩76 歩56 歩47 歩37',
  tags: ['対振り飛車', '珍形'],
  desc: '玉を9八、香を9九に残して串に刺したように見える端玉の囲い（玉9八・銀8八・金7八・金7九）[[wj-kakoi|we-castle|sj-kushikatsu]]。角の筋から玉が外れていて横攻めに対し上へ逃げやすく、穴熊より1手少なく組めるが、香が玉を守れず（むしろ塞ぐ）端攻めには弱い[[we-castle]]。ミレニアムへは2手で発展できる[[we-castle]]。',
  ratings: { hard: 3, wide: 2, top: 3, side: 4, quick: 2 },
  pros: [
    { t: '角筋（88の斜め）から玉が外れ、横攻めに上へ逃げやすい[[we-castle]]', sq: ['98', '97'] },
    { t: 'ミレニアムへの発展が2手で可能[[we-castle]]' },
  ],
  cons: [
    { t: '端攻めに弱く、香が玉の逃げ道を塞ぐ[[we-castle]]', sq: ['99', '97'] },
    { t: '香車の攻撃力が使えない' },
  ],
  attacks: [
    { id: 'hashi', name: '端攻め', t: '△9五歩から端を突き、9七の歩を取って香の列を絆創膏のように破る。串カツの最大の弱点。', gote: '歩95 香91 桂73', target: ['97', '98'] },
  ],
  sources: [{ ref: 'wj-kakoi', for: '配置' }, { ref: 'we-castle', for: '配置・解説' }, { ref: 'sj-kushikatsu', for: '配置・解説' }],
}
```

### oosumi（大住囲い）furibisha

```js
{
  id: 'oosumi', name: '大住囲い', short: '大住囲い', reading: 'おおずみがこい',
  aliases: ['大隅囲い', 'こじまり囲い（Cozy castle）', '三手囲い（別義あり）'], side: 'furibisha', family: 'kinmusou', subtype: 'oosumi', setup: 'furibisha',
  core: '玉38 金48 銀39',
  shell: '歩16 歩27 歩37 歩47 歩57',
  rest: '金69 銀67',
  filler: '香19 桂29',
  tags: ['相振り飛車', '急戦向き', '古典'],
  desc: '江戸時代からある古典的な簡易囲いで、玉4八→3八、金4八の3手で形になる（en.wiki「Cozy/Ōsumi castle」）[[we-castle]]。銀は3九のままにするのが要点で、右金を5八に寄せて厚くする型もある。時代とともに「三手囲い」「早囲い」の名は壁囲いにも使われるようになり、同名異形に注意が必要[[we-castle|wj-kabegakoi]]。',
  ratings: { hard: 2, wide: 3, top: 2, side: 3, quick: 5 },
  pros: [
    { t: '3手で組める最短クラス' },
    { t: '金無双・美濃系へ発展しやすい' },
  ],
  cons: [
    { t: '上部も横も薄い。持久戦向きではない', sq: ['37', '47', '58'] },
  ],
  attacks: [
    { id: 'gyokuto', name: '玉頭攻め', t: '△3五歩・△2五歩で玉頭の3七・2七を攻める。', gote: '歩35 歩25', target: ['36', '37', '27'] },
  ],
  sources: [{ ref: 'we-castle', for: '配置・解説' }],
}
```

### ahiru（アヒル囲い）ibisha

```js
{
  id: 'ahiru', name: 'アヒル囲い', short: 'アヒル', reading: 'あひるがこい',
  aliases: ['金開き', '御神酒指し', 'ダック'], side: 'ibisha', family: 'kinbiraki', setup: 'ibisha',
  core: '玉58 銀68 銀48 金79 金39',
  shell: '歩96 歩87 歩77 歩67 歩57 歩47 歩17',  // 完成図では飛車は2六中段、角は9七に移動済み
  filler: '香99 桂89 飛26 角97 桂29 香19',
  tags: ['相居飛車', '奇襲', '金開き'],
  desc: '金2枚を7九・3九に開き、銀6八・銀4八と玉5八で低く固める陣形[[wj-ahiru|we-castle]]。金銀の並びがアヒルの黄色い足に見えることから命名。一種の奇襲戦法の構えで、江戸時代の縁台将棋に由来するとされる[[wj-ahiru]]。打ち込みの隙のない低い陣形が特徴で、居飛車・振り飛車どちらにも対応できる[[wj-ahiru]]。',
  ratings: { hard: 3, wide: 4, top: 2, side: 4, quick: 3 },
  pros: [
    { t: '飛車・角の打ち込みの隙がない低い陣形[[wj-ahiru]]', sq: ['68', '58', '48'] },
    { t: '相手の戦型を選ばず対応できる[[wj-ahiru]]' },
  ],
  cons: [
    { t: '玉頭（5筋〜6筋上部）が薄く、持久戦では押し込まれやすい', sq: ['57', '67', '47'] },
    { t: '飛車を中段（2六）に構える必要があり、組み立てが特殊[[wj-ahiru]]' },
  ],
  attacks: [
    { id: 'gyokuto', name: '玉頭攻め', t: '△5五歩・△4五桂・△6五桂で5六・6六を狙い、中央の玉に直接圧力をかける。', gote: '歩55 桂45 桂65', target: ['56', '57', '66'] },
  ],
  sources: [{ ref: 'wj-ahiru', for: '配置・解説' }, { ref: 'we-castle', for: '配置' }, { ref: 'sj-ahiru', for: '配置・解説' }],
}
```

### bunshin（文鎮囲い）ibisha ※優先度「中」だが地下鉄飛車の存在から実用度は中〜高

```js
{
  id: 'bunchin', name: '文鎮囲い', short: '文鎮囲い', reading: 'ぶんちんがこい',
  side: 'ibisha', family: 'funa', subtype: 'bunchin', setup: 'ibisha',
  core: '玉78 銀88 金68 金58 桂77',
  shell: '歩96 歩87 歩76 歩56',
  rest: '銀48',
  filler: '香98 桂89 角66 飛29 歩36 歩47',  // 地下鉄飛車は飛29・香98も構えの一部
  tags: ['対振り飛車', '地下鉄飛車', '端攻め'],
  desc: '地下鉄飛車戦法で用いる囲いで、8段目に香・銀・玉・金・金と一直線に並ぶ形が文鎮に似ることから命名[[wj-kakoi|we-castle]]。角を6六、桂を7七に配し、飛車を9筋（地下鉄）へ回して端攻めを狙う戦法とセットで使う。',
  ratings: { hard: 3, wide: 2, top: 2, side: 4, quick: 2 },
  pros: [
    { t: '8段目の壁が横からの攻めに強い', sq: ['88', '78', '68', '58'] },
    { t: '端攻め（地下鉄）との親和性が高い' },
  ],
  cons: [
    { t: '飛車を9筋へ回す手数がかかる' },
    { t: '上部・玉頭は薄い', sq: ['77', '87'] },
  ],
  attacks: [
    { id: 'gyokuto', name: '玉頭攻め', t: '△7五歩・△8五歩で玉の正面を攻める。8段目の壁は高さがないので上からは素通し。', gote: '歩75 歩85', target: ['77', '87', '76'] },
  ],
  sources: [{ ref: 'wj-kakoi', for: '配置' }, { ref: 'we-castle', for: '配置・解説' }],
}
```

※ 上記のほか「中」の 菱矢倉・流れ矢倉・銀立ち矢倉・四角矢倉・6八銀型金矢倉・一文字矢倉・富士見矢倉・角矢倉・豆腐矢倉・流線矢倉・トラック囲い・平目・ちょんまげ美濃・坊主美濃・現代穴熊・4八金型穴熊・音無し構え・居飛車金美濃・中飛車左穴熊・無敵囲い は、① の表の core を使えば同様に起こせる。個別データ案は実装時に作成（形は確認済みのものを使用）。

---

## ③ attacks（攻め筋）の種類の網羅度点検

現在使用されている attack id は 5 種:

| 現行 id | 内容 | カバーされる攻め |
|---|---|---|
| `hashi` | 端攻め | 端歩の突き捨て＋香・桂での端筋突破（穴熊・矢倉・美濃全般） |
| `gyokuto` | 玉頭攻め | 玉の真上の歩・桂・銀による上部突破 |
| `dan` | 下段への飛車打ち | 底段への飛車打ち（下段が薄い囲い） |
| `side` | 横からの飛車打ち | 横一線への飛車打ち（雁木・高美濃など） |
| `center` | 中央からの攻め/打ち込み | 5〜6筋中央突破、片美濃の5八打ちなど |
| `hachinana` | 8七への集中砲火 | 舟囲い系の角頭+香の集中砲火（固有 id） |

### 文献上確認できる未カバーの攻めパターン（追加提案）

| 新 id 案 | 名称案 | 内容 | 根拠 |
|---|---|---|---|
| `keima` | 桂馬による攻め | △8五桂・△6五桂と桂を跳ねて7七銀・6七金など前線の守備駒を攻め、交換or移動を強要する。豆腐矢倉化の機構、ミレニアムの「桂馬の吊り上げ」、左美濃急戦が典型 | wj-yagura（豆腐矢倉節・6八銀型の説明） |
| `kakumichi` | 角道を使う攻め | 角道に囲いの駒（6七金・7七銀）が並ぶ形を、角のにらみ＋歩突き（△6五歩→△6六歩）で突く。美濃のコビン攻め（斜めのライン）もこの系統 | wj-yagura（豆腐矢倉）、joutatsu（美濃系記事） |
| `tokin` | と金による横攻め | 穴熊攻略法として文献明記。「小駒の攻め」で歩・香・桂を使い、と金を作って横から迫る。遅くとも受けにくい有力手段 | wj-anaguma（攻略法節） |
| `wariuchi` | 割り打ち | 飛車や角を駒と駒の間（例：金と玉の間、飛車先の裏）へ打ち込んで両取り・金取りを狙う。舟囲い系の6九金問題・片美濃5八打ちの一般化 | jsf-kakoi37、katamino の center attack を一般形へ |
| `hagare` | 金銀を剥がす攻め | 歩交換・銀交換を強いて囲いの金銀を「浮き駒」にし、タダ取り・打ち込みへつなげる。美濃の2筋交換→△同飛、矢倉の7六歩▲同歩△同銀からの展開など | 実戦定跡一般（要出典選択） |

既存 `hachinana` は「舟囲い系固有の8七集中砲火」として残しつつ、`kakumichi`（角道）に吸収できる部分は整理候補。また各囲いの attacks に複数 id を持たせて良い（例：豆腐矢倉には keima+kakumichi、左美濃系には keima+hashi+kakumichi、穴熊系には hashi+tokin）。

---

## ④ taxonomy.js（系統分類）への追提案

### 既存 family への subtype 追加

- **yagura** … 追加提案（多いため2段構えも可）
  - `heko` へこみ矢倉（金を6八に下げた形）
  - `sou` 総矢倉（金銀4枚・銀57）
  - `shikaku` 四角矢倉（金銀4枚の2×2）
  - `gin68` 6八銀型金矢倉
  - `gintachi` 銀立ち矢倉（左銀7六・位取り型）
  - `nagare` 流れ矢倉（銀57）/ `ryusen` 流線矢倉（玉89＋桂77）
  - `hishi` 菱矢倉（右銀6六型）※囲い記事の「菱矢倉」はこちら。既存の「菱囲い」は funa 系なので名称衝突に注意（id は hishiyagura 推奨）
  - `fujimi` 富士見矢倉（銀56＋歩55位取り）
  - `kaku` 角矢倉（6七が角）
  - `ichimonji` 一文字矢倉（三段目一直線）
  - `tofu` 豆腐矢倉（崩れ形・収録するなら）
- **funa** … `hakoiri`（箱入り娘：6八金+7九銀の2×2）を新設するか、既存 `kin68`（6八金型）に含めるかは実装判断。形は kin68 より「箱」なので分けた方が直感的。`bunchin`（文鎮）・`torakku`（トラック）も追加候補
- **mino** … `hashigyoku`（端玉系：端玉銀冠・かんぴょう・串カツをまとめる）を新設推奨。`kabe`（壁囲い）・`hirame`（平目）・`chonmage`・`bouzu`・`kinmino`（金美濃：居飛車金美濃・左木村美濃も近い）も追加候補
- **anaguma** … `gendai`（現代穴熊・金七段型）・`kin48`（4八金型/広瀬流）・`tajiri` or yonmai 内で区別・`kata`（片穴熊）・`otonashi`（音無し構え）の追加候補。中飛車左穴熊は `sanmai`（本穴熊と同形）でよい
- **nakazumai** … `ichigo`（イチゴ囲い）を subtype として追加（玉68型の中央住まい系）
- **chudan** … `rohaku`（空中楼閣＝既存）に加え `yondan`（四段端玉）追加候補
- **kinmusou** … `oosumi`（大住囲い）追加候補。形は kinmusou と別系統（金1枚+銀）なので、単独 family `oosumi` でも可

### 新規 family 候補

| id 案 | name 案 | 含める囲い | 要否 |
|---|---|---|---|
| `hidarigyoku` | 左玉型 | 左玉（田丸流・高田流・松浦流銀多伝） | 推奨。右玉型（migigyoku）の対として形が明確（玉を飛車と反対側でなく同側…正確には向かい飛車側左翼。右玉の反転近似） |
| `kinbiraki` | 金開き型 | アヒル囲い・大阪囲い・金開き | 任意。nakazumai に含めてもよいが、金2枚を左右に開く独自の形状なので分けると綺麗 |
| `itadori` | 位取り型 | 銀立ち矢倉・カタツムリ・左多伝・銀雲雀・左木村美濃 | 任意。文献の「位取り系統」は戦法分類なので、形分類の方針なら yagura/mino の subtype に分散させる方が一貫する（銀立ち矢倉→yagura/gintachi、左木村美濃→mino/kata、左多伝→komaochi 関連） |
| `komaochi` | 駒落ち型 | 多伝囲い・金象眼・銀象眼・カギ囲い | 任意。収録する場合だけ必要。アプリの対象が平手戦なら低優先 |

### 分類上の注意点

- 「菱」の名称が2系統ある: `hishigakoi`（舟囲い5七銀右型＝菱囲い、既存）と `hishiyagura`（矢倉の6六銀型＝菱矢倉、未収録）。aliases/note で区別を明記する必要あり
- 「銀冠」は side 違いで3種: gincan（振り飛車）既存、hidariginkan（左銀冠・居飛車）既存、hashigyoku-ginkan（端玉銀冠・提案）、居飛車銀冠穴熊（提案）。名称衝突回避のため id は明示的に
- 「三手囲い」は壁囲い（早囲い）と大住囲いの両方で使われる同名異義語（we-castle で明示）。aliases には入れられるが primary name にはしない

---

## ⑤ 新規 sources.js エントリ案

既存 ref を最大限再利用（矢倉系バリエーションは `wj-yagura` に集約、穴熊系は `wj-anaguma`、駒落ち系は `wj-kakoi`/`we-castle`）。追加が必要なもの:

```js
// ---- 囲いの追加（coverage-castles 第2弾）----
'wj-hakoiri': { title: '箱入り娘 (将棋)', publisher: 'Wikipedia日本語版', url: 'https://ja.wikipedia.org/wiki/%E7%AE%B1%E5%85%A5%E3%82%8A%E5%A8%98_(%E5%B0%86%E6%A3%8B)' },
'wj-kabegakoi': { title: '壁囲い', publisher: 'Wikipedia日本語版', url: 'https://ja.wikipedia.org/wiki/%E5%A3%81%E5%9B%B2%E3%81%84' },
'wj-hidarigyoku': { title: '左玉', publisher: 'Wikipedia日本語版', url: 'https://ja.wikipedia.org/wiki/%E5%B7%A6%E7%8E%89' },
'wj-ahiru': { title: 'アヒル囲い', publisher: 'Wikipedia日本語版', url: 'https://ja.wikipedia.org/wiki/%E3%82%A2%E3%83%92%E3%83%AB%E5%9B%B2%E3%81%84' },
'wj-aigakari': { title: '相掛かり（囲いの節：イチゴ囲い）', publisher: 'Wikipedia日本語版', url: 'https://ja.wikipedia.org/wiki/%E7%9B%B8%E6%8E%9B%E3%81%8B%E3%82%8A' },
'wj-muteki': { title: '無敵囲い', publisher: 'Wikipedia日本語版', url: 'https://ja.wikipedia.org/wiki/%E7%84%A1%E6%95%B5%E5%9B%B2%E3%81%84' },
'wj-taden': { title: '多伝囲い', publisher: 'Wikipedia日本語版', url: 'https://ja.wikipedia.org/wiki/%E5%A4%9A%E4%BC%9D%E5%9B%B2%E3%81%84' },
'sj-hakoiri': { title: '箱入り娘とは？', publisher: '将棋の囲い（shougi.jp）', url: 'https://www.shougi.jp/kakoi/hakoiri_musume/' },
'sj-hayagakoi': { title: '早囲い（壁囲い）とは？', publisher: '将棋の囲い（shougi.jp）', url: 'https://www.shougi.jp/kakoi/hayagakoi/' },
'sj-sante': { title: '三手囲いとは？', publisher: '将棋の囲い（shougi.jp）', url: 'https://www.shougi.jp/kakoi/sante/' },
'sj-ahiru': { title: 'アヒル囲いとは？', publisher: '将棋の囲い（shougi.jp）', url: 'https://www.shougi.jp/kakoi/ahiru/' },
'sj-ichigo': { title: 'いちご囲いとは？', publisher: '将棋の囲い（shougi.jp）', url: 'https://www.shougi.jp/kakoi/ichigo/' },
'sj-hekomi': { title: 'へこみ矢倉とは？', publisher: '将棋の囲い（shougi.jp）', url: 'https://www.shougi.jp/kakoi/hekomi_yagura/' },
'sj-souyagura': { title: '総矢倉とは？', publisher: '将棋の囲い（shougi.jp）', url: 'https://www.shougi.jp/kakoi/souyagura/' },
'sj-gindati': { title: '銀立ち矢倉とは？', publisher: '将棋の囲い（shougi.jp）', url: 'https://www.shougi.jp/kakoi/gindati_yagura/' },
'sj-hishiyagura': { title: '菱矢倉とは？', publisher: '将棋の囲い（shougi.jp）', url: 'https://www.shougi.jp/kakoi/hishi_yagura/' },
'sj-nagare': { title: '流れ矢倉とは？', publisher: '将棋の囲い（shougi.jp）', url: 'https://www.shougi.jp/kakoi/nagare_yagura/' },
'sj-ryusen': { title: '流線矢倉とは？', publisher: '将棋の囲い（shougi.jp）', url: 'https://www.shougi.jp/kakoi/ryusen_yagura/' },
'sj-fujimi': { title: '富士見矢倉とは？', publisher: '将棋の囲い（shougi.jp）', url: 'https://www.shougi.jp/kakoi/fujimi_yagura/' },
'sj-kakuyagura': { title: '角矢倉とは？', publisher: '将棋の囲い（shougi.jp）', url: 'https://www.shougi.jp/kakoi/kaku_yagura/' },
'sj-kushikatsu': { title: '串カツ囲いとは？', publisher: '将棋の囲い（shougi.jp）', url: 'https://www.shougi.jp/kakoi/kushikatsu/' },
'sj-hashigyoku-ginkan': { title: '端玉銀冠（米長玉）とは？', publisher: '将棋の囲い（shougi.jp）', url: 'https://www.shougi.jp/kakoi/hashigyoku_ginkanmuri/' },
'sj-chonmage': { title: 'ちょんまげ美濃とは？', publisher: '将棋の囲い（shougi.jp）', url: 'https://www.shougi.jp/kakoi/tyonmage_mino/' },
'sj-bouzu': { title: '坊主美濃とは？', publisher: '将棋の囲い（shougi.jp）', url: 'https://www.shougi.jp/kakoi/bouzu_mino/' },
'sj-ginmino': { title: '銀美濃とは？', publisher: '将棋の囲い（shougi.jp）', url: 'https://www.shougi.jp/kakoi/ginmino/' },
'sj-taden': { title: '多伝囲いとは？', publisher: '将棋の囲い（shougi.jp）', url: 'https://www.shougi.jp/kakoi/taden_kakoi/' },
'sj-chudangyoku': { title: '中段玉とは？', publisher: '将棋の囲い（shougi.jp）', url: 'https://www.shougi.jp/kakoi/chudangyoku/' },
'joutatsu-mino-kei': { title: '美濃囲い系の囲い一覧', publisher: '将棋上達塾（ゼロから始める将棋研究所）', url: 'https://shogi-joutatsu.com/archives/5985' },
'shogi-gym-kakoi': { title: '将棋の囲い一覧37種・守りの定跡', publisher: '将棋ジム', url: 'https://shogi-gym.com/kakoi/' },
```

`we-castle`（既存）は へこみ/総矢倉/豆腐/四角/一文字/トラック/文鎮/イチゴ/米長玉/串カツ/大住/平目/エア金/四段端玉/象眼/壁 の en 側一次ソースとしてそのまま再利用できる。

---

## ⑥ 実装時の留意点

1. **駒配置の検証** … 本ドキュメントの core は全て Wikipedia/英語版/shougi.jp の模式図を書き写したものだが、写しミス・段ずれがありうる。実装時は `node tools/validate-castles.js` で宣言局面の到達可能性（初期配置から合法手で組めるか・枚数・重複）を必ず確認し、`npm test`（validate + unit-test + ui-check）を通すこと
2. **shell/rest/filler の調整** … core 以外の駒は「先手の全駒が一度だけ置かれる」制約がある。新エントリは同 family の既存エントリ（矢倉系→yagura、美濃系→hidarimino/mino、穴熊系→anaguma/furianaguma）をベースに shell/rest/filler を書き換えるのが安全
3. **setup の選択** … 振り飛車側は `furibisha`（四間飛車想定）固定。左玉・中飛車左穴熊・カギ囲いは飛車の位置が特殊（8筋/9筋・5筋）なので、setup 共用だと飛車位置が実態とずれる → `kingWing` や filler で吸収するか、専用 setup を検討（setups.js の追加は構造変更になるので注意）
4. **同名異形の扱い** … 「銀冠」「三手囲い」「菱」「片矢倉（半矢倉）」は aliases と note で区別を明記。特に「居飛車の銀冠穴熊」は既存 `ginkananaguma`（furibisha）と id 衝突しないよう `ginkananaguma-ibisha` 等にする
5. **要検証と明記したもの** … ① 表中 `?` の囲い（カタツムリ/左多伝/銀雲雀/セメント/二枚/カタ/ポナンザ/半カブト/金冠/高矢倉/ずれ美濃/片穴熊/振り飛車ミレニアム/風車/神吉流穴熊/平美濃/6七金型穴熊/角道開型銀冠/珍玉/大阪囲い/矢倉早囲い）は、実装前に必ず図のある文献（『将棋囲い事典100+』マイナビムック、将棋世界、各戦法書）で配置を確認すること。推測で core を書かない
6. **駒落ち囲いの方針** … 多伝・象眼・カギは下手/上手という前提があり、現行スキーマ（先手の自分陣想定）にそのまま載せると用途が不自然。収録するなら `note` に駒落ち専用と明記するか、side/家族を別枠にする
7. **優先度の実施順** … まず「高」の中でも矢倉系3件（へこみ/総/箱入りは別系統）と振り飛車側の壁囲い・左玉が収録効果大。次に菱矢倉〜四角矢倉あたりの矢倉バリエーションは taxonomy の subtype 整備と一緒に入れると desc が書きやすい
8. **attacks の新 id 導入** … ③ の keima/kakumichi/tokin/wariuchi/hagare を入れる場合は tactics.js 側の表現と揃っているか確認（tactics 側にも似た概念があるかもしれない）。validate が attack id の既知集合を検査している可能性があるので、新 id は tools のチェックに引っかからないか先に確認
