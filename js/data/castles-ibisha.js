// 居飛車の囲い
// core: 囲いを構成する駒 / support: 囲いごとの補助の駒（setup と合わせて先手の全駒になる）
// pros・cons の sq は盤上で示すマス、attacks の gote は後手の駒、target は狙われるマス
window.Kakoi = window.Kakoi || {};
Kakoi.CASTLES = Kakoi.CASTLES || [];
Kakoi.CASTLES.push(
  {
    id: 'anaguma', name: '居飛車穴熊', short: '居飛車穴熊', reading: 'いびしゃあなぐま', side: 'ibisha', family: 'anaguma', setup: 'ibisha',
    core: '玉99 香98 桂89 銀88 金79 金78',
    support: '角77 銀26 歩97 歩87 歩76 歩66 歩56 歩47 歩37',
    tags: ['対振り飛車', '持久戦', '堅さ最強クラス'],
    desc: '9九の香を9八に上げ、空いた9九に玉を入れて、8八銀・7九金・7八金で固める。王手がかかりにくく、終盤で「ゼット（絶対に詰まない形）」になりやすい。',
    ratings: { hard: 5, wide: 1, top: 3, side: 5, quick: 1 },
    pros: [
      { t: '王手がかかりにくく、終盤の攻め合いに強い', sq: ['99', '98', '89', '88'] },
      { t: '金銀がくっついていて崩れにくい', sq: ['88', '78', '79'] },
    ],
    cons: [
      { t: '組むのに手数がかかる' },
      { t: '端攻め（9筋）に弱く、崩れると逃げ場がない', sq: ['97', '98', '99'] },
    ],
    attacks: [
      { id: 'hashi', name: '端攻め', t: '△9五歩と端を突き、香・桂を足して9筋を破る。穴熊の代表的な攻略法。', gote: '歩95 香91 桂73', target: ['97', '98', '99'] },
    ],
    sources: [
      { ref: 'wj-ibisha-anaguma', for: '配置・解説' },
      { ref: 'wj-anaguma', for: '配置' },
      { ref: 'sj-ibiana', for: '配置・解説' },
      { ref: 'jsf-kakoi63', for: '手順' },
    ],
  },
  {
    id: 'funa', name: '舟囲い（7九銀型）', short: '舟囲い 7九銀', reading: 'ふながこい', side: 'ibisha', family: 'funa', subtype: 'base', setup: 'ibisha',
    core: '玉78 銀79 金69 金58',
    support: '角88 銀26 香99 桂89 歩96 歩87 歩76 歩67 歩56 歩47 歩36',
    tags: ['対振り飛車', '急戦', '基本形'],
    desc: '玉を7八に移し、5八金・6九金と7九銀で守る簡易な囲い。手数が少なく、右銀を棒銀などで繰り出して急戦を仕掛けるときの土台になる。',
    ratings: { hard: 2, wide: 3, top: 1, side: 3, quick: 5 },
    pros: [
      { t: '3〜4手で完成し、すぐに攻めに移れる' },
      { t: '左右に広く、横からの攻めに比較的強い', sq: ['69', '58', '79'] },
    ],
    cons: [
      { t: '玉頭（7筋・8筋の上部）が薄い', sq: ['77', '87', '67'] },
      { t: '6九の金が狙われると、取り返す駒が玉しかないことがある', sq: ['69'] },
    ],
    attacks: [
      { id: 'gyokuto', name: '玉頭攻め', t: '△7五歩・△6五桂のように玉の真上を狙い、7七や5七に駒を足してくる。', gote: '歩75 桂65', target: ['77', '57', '76'] },
    ],
    sources: [
      { ref: 'joutatsu-bougin', for: '配置' },
      { ref: 'wj-kakoi', for: '解説' },
      { ref: 'wj-funagakoi', for: '配置・解説' },
      { ref: 'sj-funakakoi', for: '配置' },
      { ref: 'we-castle', for: '配置' },
      { ref: 'jsf-kakoi37', for: '解説' },
    ],
  },
  {
    id: 'funa68gin', name: '舟囲い（6八銀型）', short: '舟囲い 6八銀', reading: 'ふながこい ろくはちぎんがた', side: 'ibisha', family: 'funa', subtype: 'base', setup: 'ibisha',
    core: '玉78 銀68 金69 金58',
    support: '角88 銀26 香99 桂89 歩96 歩87 歩76 歩67 歩56 歩47 歩36',
    tags: ['対振り飛車', '急戦'],
    desc: '7九銀型から左銀を6八へ上げた形。6七・5七・7七に利きが増え、中央が厚くなる。',
    ratings: { hard: 2, wide: 3, top: 2, side: 3, quick: 4 },
    pros: [
      { t: '中央・6筋の守りが強くなる', sq: ['67', '57', '77'] },
      { t: '金銀のつながりが7九銀型よりよい', sq: ['68', '69', '58'] },
    ],
    cons: [
      { t: '7九が空き、玉の下が薄くなる', sq: ['79'] },
      { t: '玉頭（7筋・8筋）は相変わらず薄い', sq: ['77', '87'] },
    ],
    attacks: [
      { id: 'gyokuto', name: '玉頭攻め', t: '△7五歩・△6五桂で7七を狙う。6八銀が6七・7七を守るぶん基本形より受けやすい。', gote: '歩75 桂65', target: ['77', '57', '76'] },
    ],
    sources: [
      { ref: 'mynavi-elmo', for: '配置' },
      { ref: 'wj-funagakoi', for: '配置・解説' },
      { ref: 'jsf-kakoi37', for: '手順' },
    ],
  },
  {
    id: 'elmo', name: 'エルモ囲い（舟囲い7九金型）', short: 'エルモ囲い', reading: 'えるもがこい', side: 'ibisha', family: 'funa', subtype: 'kin79', setup: 'ibisha',
    core: '玉78 銀68 金79 金59',
    support: '角88 銀26 香99 桂89 歩96 歩87 歩76 歩67 歩56 歩47 歩36',
    tags: ['対振り飛車', '急戦', 'コンピュータ発'],
    desc: '将棋ソフト「elmo」が多用して広まった形。舟囲いの6九金を7九へ寄せて6八銀と組み合わせ、右金は5九に置く。玉の真下の7九金が銀とつながるのが要。',
    ratings: { hard: 3, wide: 2, top: 2, side: 4, quick: 4 },
    pros: [
      { t: '金銀の連結がよく、舟囲いの6九金の弱点が解消される', sq: ['79', '68'] },
      { t: '7九金が8八・8九にも利き、角打ちや左からの攻めに強い', sq: ['88', '89', '79'] },
    ],
    cons: [
      { t: '右金（5九）が離れ気味で、中央が薄くなりやすい', sq: ['59', '58'] },
      { t: '玉頭（上部）からの攻めには舟囲い同様に薄い', sq: ['77', '87'] },
    ],
    attacks: [
      { id: 'gyokuto', name: '玉頭攻め', t: '△7五歩・△6五桂で7七を狙われる。上部の薄さは舟囲いと共通。', gote: '歩75 桂65', target: ['77', '57', '76'] },
    ],
    sources: [
      { ref: 'wj-elmo', for: '配置・解説' },
      { ref: 'mynavi-elmo', for: '配置・解説' },
      { ref: 'jsf-kakoi63', for: '手順' },
      { ref: 'sj-elmo', for: '配置' },
      { ref: 'we-castle', for: '配置' },
    ],
  },
  {
    id: 'funa68kin', name: '舟囲い（6八金型）', short: '舟囲い 6八金', reading: 'ふながこい ろくはちきんがた', side: 'ibisha', family: 'funa', subtype: 'kin68', setup: 'ibisha',
    core: '玉78 金68 金58',
    support: '銀57 角88 銀26 香99 桂89 歩96 歩87 歩76 歩67 歩56 歩47 歩36',
    tags: ['対振り飛車', '急戦'],
    desc: '左銀を7九から5七へ繰り出して急戦を仕掛けるときの舟囲い。左金を6八に上げ、6八金・5八金を横に並べて中央を守る。',
    ratings: { hard: 2, wide: 3, top: 3, side: 2, quick: 4 },
    pros: [
      { t: '左銀を攻めに使える', sq: ['57'] },
      { t: '金2枚が横に並び、6七・5七方面に利きが多い', sq: ['68', '58', '67'] },
    ],
    cons: [
      { t: '7九・6九が空き、玉の下段（底）が薄い', sq: ['79', '69'] },
      { t: '金2枚だけなので堅さは控えめ' },
    ],
    attacks: [
      { id: 'dan', name: '下段への飛車打ち', t: '△3九飛のように下段へ打ち込まれると、玉の下の7九・6九から王手がかかる。', gote: '飛39', target: ['69', '79'] },
    ],
    sources: [
      { ref: 'joutatsu-bougin', for: '配置・解説' },
      { ref: 'sj-funakakoi', for: '配置' },
      { ref: 'wj-funagakoi', for: '解説' },
    ],
  },
  {
    id: 'yagura', name: '矢倉囲い（金矢倉）', short: '金矢倉', reading: 'やぐらがこい', side: 'ibisha', family: 'yagura', subtype: 'kin', setup: 'ibisha',
    core: '玉88 銀77 金78 金67',
    support: '香99 桂89 角68 銀26 歩97 歩87 歩76 歩66 歩56 歩47 歩37',
    tags: ['相居飛車', '持久戦', '将棋の純文学'],
    desc: '相居飛車の代表的な囲い。8八玉を7七銀・7八金・6七金で包み、上からの攻めに強い。角は6八に引いて使う。',
    ratings: { hard: 4, wide: 3, top: 5, side: 3, quick: 2 },
    pros: [
      { t: '上部（正面）からの攻めに非常に強い', sq: ['77', '67', '76', '66'] },
      { t: '金銀3枚がまとまり、バランスがよい', sq: ['77', '78', '67'] },
    ],
    cons: [
      { t: '組むのに手数がかかる' },
      { t: '端攻め（9筋）にはやや弱い', sq: ['97', '98'] },
    ],
    attacks: [
      { id: 'hashi', name: '端攻め', t: '△9五歩から端を突き捨て、香・桂・角で9筋の玉のこびん（9七・8七）を狙う。', gote: '歩95 香91 桂73', target: ['97', '98', '87'] },
    ],
    sources: [
      { ref: 'joutatsu-bougin', for: '配置' },
      { ref: 'wj-yagura', for: '配置・解説' },
      { ref: 'we-fortress', for: '配置' },
      { ref: 'sj-yagura', for: '配置・解説' },
      { ref: 'jsf-kakoi77', for: '手順' },
    ],
  },
  {
    id: 'kani', name: 'カニ囲い', short: 'カニ囲い', reading: 'かにがこい', side: 'ibisha', family: 'gangi', subtype: 'heiretsu', refFamily: '文献ではどの系統にも属さず、「矢倉の子供」とも呼ばれる', setup: 'ibisha',
    core: '玉69 銀68 金78 金58',
    support: '角88 銀26 香99 桂89 歩97 歩87 歩76 歩67 歩57 歩47 歩37',
    tags: ['相居飛車', '急戦矢倉'],
    desc: '金・銀・金を8段目に横一列に並べ、その下の6九に玉を置く。形がカニに似ていることから。急戦矢倉や矢倉の序盤でよく現れる。',
    ratings: { hard: 2, wide: 3, top: 3, side: 3, quick: 4 },
    pros: [
      { t: '手数が少なく、矢倉への発展もできる' },
      { t: '金銀3枚が横に並び、左右どちらにも対応しやすい', sq: ['78', '68', '58'] },
    ],
    cons: [
      { t: '玉が中央に近く、戦場から近い', sq: ['69'] },
      { t: '玉が横（7九・5九）にしか逃げられない', sq: ['79', '59'] },
    ],
    attacks: [
      { id: 'center', name: '中央からの攻め', t: '△5五歩・△4五桂のように中央から5七を狙い、玉に近い5筋を破る。', gote: '歩55 桂45', target: ['56', '57'] },
    ],
    sources: [
      { ref: 'joutatsu-bougin', for: '配置' },
      { ref: 'wj-kani', for: '配置' },
      { ref: 'we-castle', for: '配置・解説' },
      { ref: 'sj-kani', for: '配置・解説' },
      { ref: 'jsf-kakoi87', for: '手順' },
    ],
  },
  {
    id: 'kabuto', name: '兜囲い（兜矢倉）', short: '兜矢倉', reading: 'かぶとがこい', side: 'ibisha', family: 'gangi', subtype: 'hidarimae', refFamily: '名前は矢倉系（文献でも矢倉系統）だが、形は雁木型', setup: 'ibisha',
    core: '玉68 銀77 金78 金58',
    support: '銀26 香99 桂89 歩97 歩87 歩76 歩67 歩57 歩47 歩37',
    hand: '角',
    tags: ['相居飛車', '急戦'],
    desc: '7七銀・7八金・5八金で6八玉をかぶせるように守る形。玉の頭上を銀・金がふさぎ、兜をかぶったように見える。角換わりなどで角を持ち駒にしているときに現れやすい。',
    ratings: { hard: 2, wide: 2, top: 4, side: 2, quick: 4 },
    pros: [
      { t: '手数が少ない' },
      { t: '7七銀で玉頭・7筋の受けが利く', sq: ['77', '76', '66'] },
    ],
    cons: [
      { t: '玉が中央寄りで戦場に近い', sq: ['68'] },
      { t: '6九・7九が空いており下段が薄い', sq: ['69', '79'] },
    ],
    attacks: [
      { id: 'dan', name: '下段への飛車打ち', t: '△3九飛のように下段へ打ち込まれると、空いている6九・7九から玉に迫られる。', gote: '飛39', target: ['69', '79'] },
    ],
    sources: [
      { ref: 'joutatsu-bougin', for: '配置・解説' },
      { ref: 'wj-yagura', for: '配置' },
      { ref: 'we-castle', for: '配置' },
      { ref: 'sj-kabuto', for: '配置・解説' },
    ],
  },
  {
    id: 'gangi', name: '雁木囲い（旧型）', short: '雁木', reading: 'がんぎがこい', side: 'ibisha', family: 'gangi', subtype: 'nimai', setup: 'ibisha',
    core: '玉69 銀67 銀57 金78 金58',
    support: '角88 香99 桂89 歩96 歩87 歩76 歩66 歩56 歩47 歩36',
    tags: ['相居飛車', '江戸時代からある'],
    desc: '6七銀・5七銀と銀を2枚並べ、その下に7八金・5八金、玉は6九。銀の並びが雪国の「雁木（がんぎ）」に似ていることから。角が8八のまま使えるのも特徴。',
    ratings: { hard: 2, wide: 3, top: 5, side: 2, quick: 3 },
    pros: [
      { t: '中央が非常に厚く、上部からの攻めに強い', sq: ['67', '57', '66', '56'] },
      { t: '角を初期位置のまま攻めに使える', sq: ['88'] },
    ],
    cons: [
      { t: '玉が中央にいて、横からの攻めに弱い', sq: ['69', '59', '49'] },
      { t: '銀が上がると玉の周りが薄くなる' },
    ],
    attacks: [
      { id: 'side', name: '横からの飛車打ち', t: '△3九飛のように下段へ打たれると、5九から6九の玉まで一直線に利く。', gote: '飛39', target: ['49', '59', '69'] },
    ],
    sources: [
      { ref: 'wj-gangi', for: '配置・解説' },
      { ref: 'we-castle', for: '配置' },
      { ref: 'sj-gangi', for: '配置・解説' },
      { ref: 'jsf-kuzushi48', for: '解説' },
    ],
  },
  {
    id: 'tsunogin', name: 'ツノ銀雁木', short: 'ツノ銀雁木', reading: 'つのぎんがんぎ', side: 'ibisha', family: 'gangi', subtype: 'tsuno', setup: 'ibisha',
    core: '玉69 銀67 銀47 金78 金58',
    support: '角88 香99 桂89 歩96 歩87 歩76 歩66 歩56 歩46 歩37',
    tags: ['相居飛車', '現代雁木', 'ソフト流行'],
    desc: '右銀を5七ではなく4七に置く雁木。銀2枚がツノのように左右に分かれる。2017年頃から将棋ソフトの影響で再流行した「新しい雁木」の代表形。',
    ratings: { hard: 2, wide: 4, top: 4, side: 3, quick: 3 },
    pros: [
      { t: '左右に広く、バランスがよい', sq: ['67', '47'] },
      { t: '4七銀が右側（攻め筋）も守る', sq: ['47', '36', '56'] },
    ],
    cons: [
      { t: '5七が空き、中央が旧型より薄い', sq: ['57'] },
      { t: '玉の囲いとしては堅くない', sq: ['69'] },
    ],
    attacks: [
      { id: 'side', name: '横からの飛車打ち', t: '△3九飛のように下段へ打たれると、5九から6九の玉まで一直線に利く。', gote: '飛39', target: ['49', '59', '69'] },
    ],
    sources: [
      { ref: 'wj-gangi', for: '配置・解説' },
      { ref: 'we-castle', for: '配置・解説' },
      { ref: 'jsf-kuzushi48', for: '解説' },
    ],
  },
  {
    id: 'bonanza', name: 'ボナンザ囲い', short: 'ボナンザ囲い', reading: 'ぼなんざがこい', side: 'ibisha', family: 'yagura', subtype: 'kata', refFamily: '文献では片矢倉の変形（後継ソフト Ponanza 由来の「ポナンザ囲い」の表記もある）', setup: 'ibisha',
    core: '玉78 銀77 金68 金58',
    support: '銀26 香99 桂89 歩97 歩87 歩76 歩67 歩57 歩47 歩37',
    hand: '角',
    tags: ['角換わり', 'コンピュータ発'],
    desc: '片矢倉の6七金を5八に残した形（7八玉・7七銀・6八金・5八金）。将棋ソフト「Bonanza」Ver.2が多用したことから名付けられた。角換わりなど角を交換した将棋で使われ、角は持ち駒。',
    ratings: { hard: 3, wide: 2, top: 3, side: 3, quick: 4 },
    pros: [
      { t: '金銀がまとまり、手数が少ない', sq: ['77', '68', '58'] },
      { t: '角打ちのスキが少ない' },
    ],
    cons: [
      { t: '矢倉ほどの上部の厚みはない' },
      { t: '8筋・9筋方面への逃げ道が狭い', sq: ['88', '89', '79'] },
    ],
    attacks: [
      { id: 'hashi', name: '端攻め', t: '△9五歩から端を攻め、玉の逃げ道になる8八・9八方面をふさぐ。', gote: '歩95 香91 桂73', target: ['97', '98', '88'] },
    ],
    sources: [
      { ref: 'wj-yagura', for: '配置・解説' },
      { ref: 'wj-bonanza', for: '配置・解説' },
      { ref: 'we-castle', for: '配置' },
      { ref: 'sj-bonanza', for: '配置・解説' },
    ],
  },
  {
    id: 'hidarimino', name: '左美濃', short: '左美濃', reading: 'ひだりみの', side: 'ibisha', family: 'mino', subtype: 'hon', refFamily: '文献では左美濃系統（居飛車側の美濃）', setup: 'ibisha',
    core: '玉88 銀78 金69 金58',
    support: '角77 銀26 香99 桂89 歩96 歩87 歩76 歩66 歩56 歩47 歩37',
    tags: ['対振り飛車', '持久戦'],
    desc: '振り飛車の美濃囲いを左右反転させた形。7七角と上げてから8八に玉を入れ、7八銀・6九金・5八金で守る。天守閣美濃や銀冠へ発展できる。',
    ratings: { hard: 3, wide: 3, top: 2, side: 4, quick: 3 },
    pros: [
      { t: '横からの攻めに強い', sq: ['69', '58', '78'] },
      { t: '穴熊より手数が少なく、天守閣美濃・銀冠などに発展できる' },
    ],
    cons: [
      { t: '玉頭（8筋）からの攻めに注意', sq: ['87', '86'] },
      { t: '7七角が動くと玉のこびんが空く', sq: ['77'] },
    ],
    attacks: [
      { id: 'gyokuto', name: '玉頭攻め', t: '△8五歩と玉頭の歩を伸ばし、△7三桂から△8五桂・△6五桂と跳ねて8七・7七を狙う。', gote: '歩85 桂73', target: ['87', '86'] },
    ],
    sources: [
      { ref: 'wj-hidarimino', for: '配置・解説' },
      { ref: 'we-castle', for: '配置' },
      { ref: 'sj-hidarimino', for: '配置' },
      { ref: 'jsf-kakoi41', for: '手順' },
    ],
  },
);
