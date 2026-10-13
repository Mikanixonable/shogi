// 居飛車の囲い
// core: 囲いを構成する駒 / shell+filler+rest: 補助の駒（setup と合わせて先手の全駒になる）
//   shell: 囲いの形として意味がある歩（城壁の前線）。戦法と合成するときもそのまま置く
//   rest:  core に含まれない守り駒（金・銀）の置き場所。合成のとき優先して置く
//   filler: 比較用に揃えた駒（初期位置の角・香・桂、遠側の歩）。合成のときは置かない
// hand: 囲いが持ち駒にしている駒（兜・ボナンザの角）。合成のとき盤上から持ち駒へ移す
// from: 発展元の囲い（この囲いはそこから駒を動かして組む）。詳細に「発展元・発展先」として出す
// flex: 戦法に貸し出せる core の駒と行き先（崩し形になる。例: 雁木の右銀→腰掛け銀）
// pros・cons の sq は盤上で示すマス、attacks の gote は後手の駒、target は狙われるマス
window.Kakoi = window.Kakoi || {};
Kakoi.CASTLES = Kakoi.CASTLES || [];
Kakoi.CASTLES.push(
  {
    id: 'anaguma', name: '居飛車穴熊', short: '居飛車穴熊', reading: 'いびしゃあなぐま', side: 'ibisha', from: 'funa', family: 'anaguma', setup: 'ibisha',
    core: '玉99 香98 桂89 銀88 金79 金78',
    shell: '歩97 歩87 歩76',
    rest: '銀26',
    filler: '角77 歩66 歩56 歩47 歩37',
    tags: ['対振り飛車', '持久戦', '堅さ最強クラス'],
    desc: '9九の香を9八に上げ、空いた9九に玉を入れて、8八銀・7九金・7八金で固める[[wj-ibisha-anaguma|wj-anaguma|jsf-kakoi63]]。王手がかかりにくく、終盤で「ゼット（絶対に詰まない形）」になりやすい[[wj-ibisha-anaguma|sj-ibiana]]。',
    ratings: { hard: 5, wide: 1, top: 3, side: 5, quick: 1 },
    pros: [
      { t: '王手がかかりにくく、終盤の攻め合いに強い[[sj-ibiana]]', sq: ['99', '98', '89', '88'] },
      { t: '金銀がくっついていて崩れにくい[[sj-ibiana]]', sq: ['88', '78', '79'] },
    ],
    cons: [
      { t: '組むのに手数がかかる[[wj-ibisha-anaguma]]' },
      { t: '端攻め（9筋）に弱く、崩れると逃げ場がない[[wj-ibisha-anaguma]]', sq: ['97', '98', '99'] },
    ],
    attacks: [
      { id: 'hashi', name: '端攻め', t: '△9五歩と端を突き、香・桂を足して9筋を破る。穴熊の代表的な攻略法[[wj-ibisha-anaguma]]。', gote: '歩95 香91 桂73', target: ['97', '98', '99'] },
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
    shell: '歩87 歩76 歩67 歩56',
    rest: '銀26',
    filler: '角88 香99 桂89 歩96 歩47 歩36',
    tags: ['対振り飛車', '急戦', '基本形'],
    desc: '玉を7八に移し、5八金・6九金と7九銀で守る簡易な囲い[[wj-funagakoi|sj-funakakoi|joutatsu-bougin|we-castle]]。手数が少なく、右銀を棒銀などで繰り出して急戦を仕掛けるときの土台になる[[wj-funagakoi|wj-kakoi]]。',
    ratings: { hard: 2, wide: 3, top: 1, side: 3, quick: 5 },
    pros: [
      { t: '3〜4手で完成し、すぐに攻めに移れる[[wj-funagakoi]]' },
      { t: '左右に広く、横からの攻めに比較的強い[[wj-funagakoi]]', sq: ['69', '58', '79'] },
    ],
    cons: [
      { t: '玉頭（7筋・8筋の上部）が薄い[[wj-funagakoi]]', sq: ['77', '87', '67'] },
      { t: '6九の金が狙われると、取り返す駒が玉しかないことがある[[jsf-kakoi37]]', sq: ['69'] },
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
    id: 'funa68gin', name: '舟囲い（6八銀型）', short: '舟囲い 6八銀', reading: 'ふながこい ろくはちぎんがた', side: 'ibisha', from: 'funa', family: 'funa', subtype: 'base', setup: 'ibisha',
    core: '玉78 銀68 金69 金58',
    shell: '歩87 歩76 歩67 歩56',
    rest: '銀26',
    filler: '角88 香99 桂89 歩96 歩47 歩36',
    tags: ['対振り飛車', '急戦'],
    desc: '7九銀型から左銀を6八へ上げた形[[wj-funagakoi|mynavi-elmo|jsf-kakoi37]]。6七・5七・7七に利きが増え、中央が厚くなる[[wj-funagakoi]]。',
    ratings: { hard: 2, wide: 3, top: 2, side: 3, quick: 4 },
    pros: [
      { t: '中央・6筋の守りが強くなる[[jsf-kakoi37]]', sq: ['67', '57', '77'] },
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
    id: 'elmo', name: 'エルモ囲い（舟囲い7九金型）', short: 'エルモ囲い', reading: 'えるもがこい', side: 'ibisha', from: 'funa68gin', family: 'funa', subtype: 'kin79', setup: 'ibisha',
    core: '玉78 銀68 金79 金59',
    shell: '歩87 歩76 歩67 歩56',
    rest: '銀26',
    filler: '角88 香99 桂89 歩96 歩47 歩36',
    tags: ['対振り飛車', '急戦', 'コンピュータ発'],
    desc: '将棋ソフト「elmo」が多用して広まった形[[wj-elmo|mynavi-elmo]]。舟囲いの6九金を7九へ寄せて6八銀と組み合わせ、右金は5九に置く[[wj-elmo|sj-elmo|we-castle]]。玉の真下の7九金が銀とつながるのが要[[mynavi-elmo|jsf-kakoi63]]。',
    note: '見方を変えると、雁木の金銀を下段（7九・6八）まで下ろした形とも言える。右金は5八ではなく一つ飛ばした5九に置く。',
    ratings: { hard: 3, wide: 2, top: 2, side: 4, quick: 4 },
    pros: [
      { t: '金銀の連結がよく、舟囲いの6九金の弱点が解消される[[wj-elmo|mynavi-elmo]]', sq: ['79', '68'] },
      { t: '7九金が8八・8九にも利き、角打ちや左からの攻めに強い[[mynavi-elmo]]', sq: ['88', '89', '79'] },
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
    id: 'funa68kin', name: '舟囲い（6八金型）', short: '舟囲い 6八金', reading: 'ふながこい ろくはちきんがた', aliases: ['居飛車金無双'], side: 'ibisha', from: 'funa', family: 'funa', subtype: 'kin68', setup: 'ibisha',
    core: '玉78 金68 金58',
    shell: '歩87 歩76 歩67 歩56',
    rest: '銀57 銀26',
    filler: '角88 香99 桂89 歩96 歩47 歩36',
    tags: ['対振り飛車', '急戦'],
    desc: '左銀を7九から5七へ繰り出して急戦を仕掛けるときの舟囲い[[joutatsu-bougin|wj-funagakoi]]。左金を6八に上げ、6八金・5八金を横に並べて中央を守る[[joutatsu-bougin|sj-funakakoi]]。',
    ratings: { hard: 2, wide: 3, top: 3, side: 2, quick: 4 },
    pros: [
      { t: '左銀を攻めに使える', sq: ['57'] },
      { t: '金2枚が横に並び、6七・5七方面に利きが多い[[joutatsu-bougin]]', sq: ['68', '58', '67'] },
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
    shell: '歩97 歩87 歩76 歩66',
    rest: '銀26',
    filler: '香99 桂89 角68 歩56 歩47 歩37',
    flex: [{ sq: '77', to: ['66', '86'] }],
    tags: ['相居飛車', '持久戦', '将棋の純文学'],
    desc: '相居飛車の代表的な囲い[[wj-yagura|sj-yagura]]。8八玉を7七銀・7八金・6七金で包み[[joutatsu-bougin|we-fortress|jsf-kakoi77]]、上からの攻めに強い[[wj-yagura|sj-yagura|we-fortress]]。角は6八に引いて使う[[wj-yagura]]。',
    ratings: { hard: 4, wide: 3, top: 5, side: 3, quick: 2 },
    pros: [
      { t: '上部（正面）からの攻めに非常に強い[[wj-yagura|sj-yagura]]', sq: ['77', '67', '76', '66'] },
      { t: '金銀3枚がまとまり、バランスがよい[[wj-yagura]]', sq: ['77', '78', '67'] },
    ],
    cons: [
      { t: '組むのに手数がかかる' },
      { t: '端攻め（9筋）にはやや弱い[[wj-yagura]]', sq: ['97', '98'] },
    ],
    attacks: [
      { id: 'hashi', name: '端攻め', t: '△9五歩から端を突き捨て、香・桂・角で9筋の玉のコビン（9七・8七）を狙う[[sj-yagura]]。', gote: '歩95 香91 桂73', target: ['97', '98', '87'] },
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
    shell: '歩87 歩76 歩67 歩57',
    rest: '銀26',
    filler: '角88 香99 桂89 歩97 歩47 歩37',
    tags: ['相居飛車', '急戦矢倉'],
    desc: '金・銀・金を8段目に横一列に並べ、その下の6九に玉を置く[[wj-kani|sj-kani|we-castle|joutatsu-bougin]]。形がカニに似ていることから[[wj-kani|sj-kani]]。急戦矢倉や矢倉の序盤でよく現れる[[sj-kani|we-castle]]。',
    ratings: { hard: 2, wide: 3, top: 3, side: 3, quick: 4 },
    pros: [
      { t: '手数が少なく、矢倉への発展もできる[[sj-kani|jsf-kakoi87]]' },
      { t: '金銀3枚が横に並び、左右どちらにも対応しやすい[[wj-kani|sj-kani]]', sq: ['78', '68', '58'] },
    ],
    cons: [
      { t: '玉が中央に近く、戦場から近い[[sj-kani]]', sq: ['69'] },
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
    shell: '歩87 歩76 歩67 歩57',
    rest: '銀26',
    filler: '香99 桂89 歩97 歩47 歩37',
    flex: [{ sq: '77', to: ['66', '86'] }],
    hand: '角',
    tags: ['相居飛車', '急戦'],
    desc: '7七銀・7八金・5八金で6八玉をかぶせるように守る形[[sj-kabuto|joutatsu-bougin|wj-yagura|we-castle]]。玉の頭上を銀・金がふさぎ、兜をかぶったように見える[[sj-kabuto]]。角換わりなどで角を持ち駒にしているときに現れやすい[[sj-kabuto|joutatsu-bougin]]。',
    ratings: { hard: 2, wide: 2, top: 4, side: 2, quick: 4 },
    pros: [
      { t: '手数が少ない' },
      { t: '7七銀で玉頭・7筋の受けが利く[[sj-kabuto]]', sq: ['77', '76', '66'] },
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
    shell: '歩87 歩76 歩66 歩56',
    filler: '角88 香99 桂89 歩96 歩47 歩36',
    flex: [{ sq: '57', to: ['46', '56'] }],
    tags: ['相居飛車', '江戸時代からある'],
    desc: '6七銀・5七銀と銀を2枚並べ、その下に7八金・5八金、玉は6九[[wj-gangi|sj-gangi|we-castle]]。銀の並びが雪国の「雁木（がんぎ）」に似ていることから[[wj-gangi|sj-gangi]]。角が8八のまま使えるのも特徴[[wj-gangi]]。',
    ratings: { hard: 2, wide: 3, top: 5, side: 2, quick: 3 },
    pros: [
      { t: '中央が非常に厚く、上部からの攻めに強い[[wj-gangi|sj-gangi]]', sq: ['67', '57', '66', '56'] },
      { t: '角を初期位置のまま攻めに使える[[wj-gangi]]', sq: ['88'] },
    ],
    cons: [
      { t: '玉が中央にいて、横からの攻めに弱い[[wj-gangi|jsf-kuzushi48]]', sq: ['69', '59', '49'] },
      { t: '銀が上がると玉の周りが薄くなる' },
    ],
    attacks: [
      { id: 'side', name: '横からの飛車打ち', t: '△3九飛のように下段へ打たれると、5九から6九の玉まで一直線に利く[[jsf-kuzushi48]]。', gote: '飛39', target: ['49', '59', '69'] },
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
    shell: '歩87 歩76 歩66 歩56 歩46',
    filler: '角88 香99 桂89 歩96 歩37',
    flex: [{ sq: '47', to: ['46', '56', '36'] }],
    tags: ['相居飛車', '現代雁木', 'ソフト流行'],
    desc: '右銀を5七ではなく4七に置く雁木[[wj-gangi|we-castle]]。銀2枚がツノのように左右に分かれる[[wj-gangi|we-castle]]。2017年頃から将棋ソフトの影響で再流行した「新しい雁木」の代表形[[wj-gangi]]。',
    ratings: { hard: 2, wide: 4, top: 4, side: 3, quick: 3 },
    pros: [
      { t: '左右に広く、バランスがよい[[wj-gangi]]', sq: ['67', '47'] },
      { t: '4七銀が右側（攻め筋）も守る', sq: ['47', '36', '56'] },
    ],
    cons: [
      { t: '5七が空き、中央が旧型より薄い[[wj-gangi|jsf-kuzushi48]]', sq: ['57'] },
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
    id: 'bonanza', name: 'ボナンザ囲い', short: 'ボナンザ囲い', reading: 'ぼなんざがこい', side: 'ibisha', from: 'katayagura', family: 'yagura', subtype: 'kata', refFamily: '文献では片矢倉の変形（後継ソフト Ponanza 由来の「ポナンザ囲い」の表記もある）', setup: 'ibisha',
    core: '玉78 銀77 金68 金58',
    shell: '歩87 歩76 歩67 歩57',
    rest: '銀26',
    filler: '香99 桂89 歩97 歩47 歩37',
    flex: [{ sq: '77', to: ['66', '86'] }],
    hand: '角',
    tags: ['角換わり', 'コンピュータ発'],
    desc: '片矢倉の6七金を5八に残した形（7八玉・7七銀・6八金・5八金）[[wj-bonanza|sj-bonanza|wj-yagura|we-castle]]。将棋ソフト「Bonanza」Ver.2が多用したことから名付けられた[[wj-bonanza|sj-bonanza]]。角換わりなど角を交換した将棋で使われ、角は持ち駒[[wj-bonanza]]。',
    ratings: { hard: 3, wide: 2, top: 3, side: 3, quick: 4 },
    pros: [
      { t: '金銀がまとまり、手数が少ない[[wj-bonanza|sj-bonanza]]', sq: ['77', '68', '58'] },
      { t: '角打ちのスキが少ない[[wj-bonanza|sj-bonanza]]' },
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
    shell: '歩96 歩87 歩76 歩66 歩56',
    rest: '銀26',
    filler: '角77 香99 桂89 歩47 歩37',
    tags: ['対振り飛車', '持久戦'],
    desc: '振り飛車の美濃囲いを左右反転させた形[[wj-hidarimino|we-castle|sj-hidarimino]]。7七角と上げてから8八に玉を入れ、7八銀・6九金・5八金で守る[[wj-hidarimino|jsf-kakoi41]]。天守閣美濃や銀冠へ発展できる[[wj-hidarimino]]。',
    ratings: { hard: 3, wide: 3, top: 2, side: 4, quick: 3 },
    pros: [
      { t: '横からの攻めに強い[[wj-hidarimino]]', sq: ['69', '58', '78'] },
      { t: '穴熊より手数が少なく、天守閣美濃・銀冠などに発展できる[[wj-hidarimino]]' },
    ],
    cons: [
      { t: '玉頭（8筋）からの攻めに注意[[wj-hidarimino]]', sq: ['87', '86'] },
      { t: '7七角が動くと玉のコビンが空く[[jsf-kakoi41]]', sq: ['77'] },
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
  {
    id: 'ginyagura', name: '銀矢倉', short: '銀矢倉', reading: 'ぎんやぐら', side: 'ibisha', from: 'yagura', family: 'yagura', subtype: 'gin', setup: 'ibisha',
    core: '玉88 銀77 金78 銀67',
    shell: '歩97 歩87 歩76 歩66',
    rest: '金58',
    filler: '香99 桂89 角68 歩56 歩47 歩37',
    flex: [{ sq: '77', to: ['66', '86'] }],
    tags: ['相居飛車', '持久戦'],
    desc: '金矢倉の6七金を銀に替えた形（玉8八・銀7七・金7八・銀6七）[[wj-ginyagura|sj-yagura|wj-yagura]]。銀は上方向への利きが強いので上部・玉頭への耐性は金矢倉以上だが、銀の真下には利かないため6八方面が弱点になる[[wj-ginyagura|wj-yagura]]。',
    ratings: { hard: 4, wide: 3, top: 5, side: 3, quick: 2 },
    pros: [
      { t: '上部（正面）からの攻めに非常に強い[[wj-ginyagura]]', sq: ['77', '67', '76', '66'] },
      { t: '6七銀が5六・7六を押さえ、相手の銀や歩の進出を防ぐ[[wj-ginyagura]]', sq: ['67', '56', '76'] },
    ],
    cons: [
      { t: '6七銀は真下に利かず、6八への打ち込みが弱点になる[[wj-ginyagura]]', sq: ['67', '68'] },
      { t: '組むのに手数がかかる' },
    ],
    attacks: [
      { id: 'hashi', name: '端攻め', t: '△9五歩から端を突き捨て、香・桂・角で9筋の玉のコビン（9七・8七）を狙う。', gote: '歩95 香91 桂73', target: ['97', '98', '87'] },
    ],
    sources: [
      { ref: 'wj-ginyagura', for: '配置・解説' },
      { ref: 'wj-yagura', for: '解説' },
      { ref: 'sj-yagura', for: '配置' },
    ],
  },
  {
    id: 'katayagura', name: '片矢倉（天野矢倉）', short: '片矢倉', reading: 'かたやぐら', aliases: ['天野矢倉'], side: 'ibisha', family: 'yagura', subtype: 'kata', setup: 'ibisha',
    core: '玉78 銀77 金68 金67',
    shell: '歩97 歩87 歩76 歩66',
    rest: '銀26',
    filler: '角88 香99 桂89 歩56 歩47 歩37',
    flex: [{ sq: '77', to: ['66', '86'] }],
    tags: ['相居飛車', '急戦矢倉'],
    desc: '玉を7八に止め、右側だけ矢倉の形（銀7七・金6八・金6七）に組んだ囲い[[wj-yagura|we-fortress]]。天野矢倉とも呼ばれ、急戦矢倉や角換わり系の将棋で現れる[[wj-yagura]]。本図鑑のボナンザ囲いはこの形の6七金を5八に残した変形で、両者は元の形と派生の関係にある[[wj-bonanza]]（「ボナンザ囲い」の項も参照）。',
    ratings: { hard: 3, wide: 3, top: 4, side: 3, quick: 3 },
    pros: [
      { t: '金矢倉より少ない手数で組める[[wj-yagura]]' },
      { t: '6七金・6八金が7筋・6筋を厚く守る', sq: ['67', '68', '77'] },
    ],
    cons: [
      { t: '玉が7八なので8筋・9筋への逃げ道が少ない', sq: ['78', '88', '89'] },
      { t: '上部の厚みは金矢倉に劣る', sq: ['77', '87'] },
    ],
    attacks: [
      { id: 'hashi', name: '端攻め', t: '△9五歩から端を攻め、玉の逃げ道になる8八・9八方面をふさぐ。', gote: '歩95 香91 桂73', target: ['97', '98', '88'] },
    ],
    sources: [
      { ref: 'wj-yagura', for: '配置・解説' },
      { ref: 'wj-bonanza', for: 'ボナンザ囲いとの関係' },
      { ref: 'we-fortress', for: '配置' },
    ],
  },
  {
    id: 'doiyagura', name: '土居矢倉', short: '土居矢倉', reading: 'どいやぐら', side: 'ibisha', family: 'yagura', setup: 'ibisha',
    core: '玉78 銀77 金67 金58',
    shell: '歩97 歩87 歩76 歩66',
    rest: '銀26',
    filler: '角88 香99 桂89 歩56 歩47 歩37',
    flex: [{ sq: '77', to: ['66', '86'] }],
    tags: ['相居飛車', '急戦矢倉'],
    desc: '玉7八・銀7七・金6七・金5八で組む簡易な矢倉[[wj-doiyagura|jsf-kakoi77]]。土居市之助名誉名人が好んで用いたことに由来する[[wj-doiyagura]]。金矢倉より手数を省け、左金は8段目に残して中央を広くカバーする[[wj-doiyagura|wj-yagura]]。',
    ratings: { hard: 3, wide: 3, top: 3, side: 3, quick: 3 },
    pros: [
      { t: '手数が少なく、矢倉以外の展開にも転じやすい[[wj-doiyagura|jsf-kakoi77]]' },
      { t: '5八金が中央・下段の守りに効く[[wj-doiyagura]]', sq: ['58', '67', '48'] },
    ],
    cons: [
      { t: '玉が7八なので上部への厚みは金矢倉に劣る', sq: ['78', '77', '87'] },
      { t: '左方向（8八・9八）への逃げ道が狭い', sq: ['88', '89'] },
    ],
    attacks: [
      { id: 'gyokuto', name: '玉頭攻め', t: '△7五歩・△6五桂のように玉の頭上（7七・8七）を狙ってくる。', gote: '歩75 桂65', target: ['77', '87'] },
    ],
    sources: [
      { ref: 'wj-doiyagura', for: '配置・解説' },
      { ref: 'jsf-kakoi77', for: '手順' },
      { ref: 'wj-yagura', for: '解説' },
    ],
  },
  {
    id: 'kikusui', name: '菊水矢倉', short: '菊水矢倉', reading: 'きくすいやぐら', side: 'ibisha', family: 'itidan', setup: 'ibisha',
    core: '玉89 銀88 金78 金67 桂77',
    shell: '歩97 歩87 歩76 歩66',
    rest: '銀26',
    filler: '香99 角68 歩56 歩47 歩37',
    tags: ['相居飛車', '持久戦', '一段玉'],
    desc: '玉を8九に据え、銀8八と桂7七で屋根を作る一段玉型の矢倉[[wj-kikusui|wj-yagura]]。桂7七が8五・6五を押さえるため上部・端への進出路が少なく耐性が高い[[wj-kikusui]]。反面、前線に出た7七の桂が攻めの焦点になりやすい[[wj-kikusui]]。',
    ratings: { hard: 4, wide: 2, top: 5, side: 4, quick: 2 },
    pros: [
      { t: '桂7七が8五・6五を押さえ、上部と端の両方に強い[[wj-kikusui]]', sq: ['77', '85', '65'] },
      { t: '銀8八・金7八・金6七の連結がよい', sq: ['88', '78', '67'] },
    ],
    cons: [
      { t: '桂7七を攻められると手を戻されやすい[[wj-kikusui]]', sq: ['77', '76'] },
      { t: '組むのに手数がかかる' },
    ],
    attacks: [
      { id: 'hashi', name: '端攻め', t: '△9五歩から端を突く。桂が9七を守る分、単純な端攻めは通常の矢倉より効きにくい。', gote: '歩95 香91 桂73', target: ['97', '98'] },
    ],
    sources: [
      { ref: 'wj-kikusui', for: '配置・解説' },
      { ref: 'wj-yagura', for: '解説' },
    ],
  },
  {
    id: 'millennium', name: 'ミレニアム囲い', short: 'ミレニアム', reading: 'みれにあむがこい', side: 'ibisha', family: 'itidan', setup: 'ibisha',
    core: '玉89 銀88 銀79 金78 金67 桂77',
    shell: '歩97 歩87 歩76 歩66',
    filler: '香99 角68 歩56 歩47 歩37',
    tags: ['相居飛車', '持久戦', '一段玉'],
    desc: '玉8九を銀8八・銀7九で挟み、金7八・金6七・桂7七で前面を固める一段玉型の囲い[[wj-millennium|sj-millennium|wj-yagura]]。2000年（ミレニアム）前後に流行した[[wj-millennium]]。下段まで金銀が埋まり、角打ちの隙が少ない[[wj-millennium|sj-millennium]]。',
    ratings: { hard: 4, wide: 3, top: 4, side: 4, quick: 3 },
    pros: [
      { t: '金銀4枚が玉の周囲に集まり隙が少ない[[wj-millennium|sj-millennium]]', sq: ['88', '79', '78', '67'] },
      { t: '桂7七が8五・6五を押さえ、上部への接点を減らす', sq: ['77', '85', '65'] },
    ],
    cons: [
      { t: '玉が8筋に近く、8筋の突破や桂馬の吊り上げに注意', sq: ['87', '88', '89'] },
      { t: '駒が密集しているので、崩れ始めると立て直しにくい' },
    ],
    attacks: [
      { id: 'gyokuto', name: '玉頭攻め', t: '△8五歩・△7四桂のように8筋から玉の真上を狙う。', gote: '歩85 桂74', target: ['87', '88', '89'] },
    ],
    sources: [
      { ref: 'wj-millennium', for: '配置・解説' },
      { ref: 'sj-millennium', for: '配置・解説' },
      { ref: 'wj-yagura', for: '解説' },
    ],
  },
  {
    id: 'yagura-anaguma', name: '矢倉穴熊', short: '矢倉穴熊', reading: 'やぐらあなぐま', side: 'ibisha', family: 'anaguma', setup: 'ibisha',
    core: '玉99 香98 桂89 銀77 金78 金67',
    shell: '歩97 歩87 歩76 歩66',
    rest: '銀26',
    filler: '角68 歩56 歩47 歩37',
    tags: ['相居飛車', '持久戦', '堅さ最強クラス'],
    desc: '玉を9九に潜らせつつ、前面は矢倉と同じ銀7七・金7八・金6七を残す形[[wj-yagura-anaguma|wj-ibisha-anaguma]]。穴熊の低い堅さに矢倉の上部の厚みを併せ持つが、その分だけ組み上がるまでの手数は多い[[wj-yagura-anaguma|wj-anaguma]]。',
    ratings: { hard: 5, wide: 2, top: 4, side: 5, quick: 1 },
    pros: [
      { t: '王手がかかりにくく、終盤の攻め合いに強い[[wj-ibisha-anaguma|wj-anaguma]]', sq: ['99', '98', '89'] },
      { t: '前面が矢倉形なので上部からの攻めにも強い[[wj-yagura-anaguma]]', sq: ['77', '78', '67'] },
    ],
    cons: [
      { t: '組むのに非常に手数がかかる' },
      { t: '端攻め（9筋）には弱い（穴熊共通）[[wj-anaguma]]', sq: ['97', '98', '99'] },
    ],
    attacks: [
      { id: 'hashi', name: '端攻め', t: '△9五歩と端を突き捨て、香・桂を足して9筋を破る。穴熊共通の攻略法[[wj-anaguma]]。', gote: '歩95 香91 桂73', target: ['97', '98', '99'] },
    ],
    sources: [
      { ref: 'wj-yagura-anaguma', for: '配置・解説' },
      { ref: 'wj-anaguma', for: '解説' },
      { ref: 'wj-ibisha-anaguma', for: '解説' },
    ],
  },
  {
    id: 'matsuo-anaguma', name: '松尾流穴熊', short: '松尾流穴熊', reading: 'まつおりゅうあなぐま', side: 'ibisha', family: 'anaguma', setup: 'ibisha',
    core: '玉99 香98 桂89 銀88 銀79 金78 金67',
    shell: '歩97 歩87 歩76',
    filler: '角77 歩66 歩56 歩47 歩37',
    tags: ['相居飛車', '持久戦', '堅さ最強クラス'],
    desc: '松尾亨八段が得意とした穴熊の変形[[wj-matsuo-anaguma]]。通常の穴熊から右側をさらに強化し、銀7九・金7八・金6七と金銀4枚で前面を厚くした形[[wj-matsuo-anaguma|wj-anaguma]]。7筋・6筋方面からの攻めに強い[[wj-matsuo-anaguma]]。',
    ratings: { hard: 5, wide: 1, top: 4, side: 5, quick: 1 },
    pros: [
      { t: '金銀4枚が連結し、前面・上部ともに厚い[[wj-matsuo-anaguma]]', sq: ['88', '79', '78', '67'] },
      { t: '王手がかかりにくい穴熊構造', sq: ['99', '98', '89'] },
    ],
    cons: [
      { t: '金銀4枚をすべて動かすので手数がかかり、攻め駒も減る' },
      { t: '端攻め（9筋）に弱い', sq: ['97', '98', '99'] },
    ],
    attacks: [
      { id: 'hashi', name: '端攻め', t: '△9五歩と端を突き捨て、香・桂を足して9筋を破る。', gote: '歩95 香91 桂73', target: ['97', '98', '99'] },
    ],
    sources: [
      { ref: 'wj-matsuo-anaguma', for: '配置・解説' },
      { ref: 'wj-anaguma', for: '解説' },
    ],
  },
  {
    id: 'big4', name: 'ビッグ4', short: 'ビッグ4', reading: 'びっぐふぉー', side: 'ibisha', family: 'anaguma', setup: 'ibisha',
    core: '玉99 香98 桂89 金88 金78 銀87 銀77',
    shell: '歩97 歩86 歩76',
    filler: '角68 歩66 歩56 歩47 歩37',
    note: '【要確認】配置は出典の図と照合が必要。銀を87・77と縦に並べる形のほか、6七銀型などの記述がある[[wj-big4|sj-big4]]。',
    tags: ['相居飛車', '持久戦', '堅さ最強クラス'],
    desc: '金8八・金7八に銀8七・銀7七と、金銀4枚を玉の周囲に集めた穴熊の変形[[wj-big4|sj-big4|wj-anaguma]]。「大駒4枚で玉を固める」ことからこの名がある[[wj-big4|sj-big4]]。陣形は低く固いが、銀が縦に並ぶぶん上部は見た目ほど厚くない[[wj-big4]]。',
    ratings: { hard: 5, wide: 1, top: 3, side: 5, quick: 1 },
    pros: [
      { t: '金銀4枚が玉を覆い、横からの攻めにとても強い', sq: ['88', '78', '87', '77'] },
      { t: '王手がかかりにくい穴熊構造', sq: ['99', '98', '89'] },
    ],
    cons: [
      { t: '金銀4枚を囲いに使うので手数がかかり、攻め駒が減る' },
      { t: '端攻め（9筋）が残る弱点', sq: ['97', '98', '99'] },
    ],
    attacks: [
      { id: 'hashi', name: '端攻め', t: '△9五歩と端を突き捨て、香・桂を足して9筋を破る。', gote: '歩95 香91 桂73', target: ['97', '98', '99'] },
    ],
    sources: [
      { ref: 'wj-big4', for: '配置・解説' },
      { ref: 'sj-big4', for: '配置・解説' },
      { ref: 'wj-anaguma', for: '解説' },
    ],
  },
  {
    id: 'tenshukaku', name: '天守閣美濃', short: '天守閣美濃', reading: 'てんしゅかくみの', side: 'ibisha', from: 'hidarimino', family: 'mino', setup: 'ibisha',
    core: '玉87 銀78 金69 金58',
    shell: '歩96 歩86 歩76 歩66 歩56',
    rest: '銀26',
    filler: '角77 香99 桂89 歩47 歩37',
    note: '【要確認】金の位置に2説がある。本データは金6九・金5八型。金4八型・金6七型（四枚美濃へ発展する形）の記述もある[[wj-tenshukaku]]。',
    tags: ['対振り飛車', '持久戦'],
    desc: '左美濃の玉を8八から8七へ一段上げた形[[wj-tenshukaku|wj-hidarimino]]。玉が高くそびえる見た目から天守閣の名がある[[wj-tenshukaku]]。玉頭への当たりを遠ざけるが、8九・9九の底が薄くなる[[wj-tenshukaku]]。',
    ratings: { hard: 3, wide: 3, top: 3, side: 4, quick: 3 },
    pros: [
      { t: '玉が高いので玉頭への直接の当たりを受けにくい', sq: ['87', '86'] },
      { t: '左美濃から1手で発展でき、四枚美濃への接続もある[[wj-tenshukaku|wj-hidarimino]]', sq: ['88', '87'] },
    ],
    cons: [
      { t: '下段（8九・9九・7九）が薄くなる', sq: ['89', '99', '79'] },
      { t: '玉が高いぶん、突破されると逃げ場を作りにくい' },
    ],
    attacks: [
      { id: 'dan', name: '下段への飛車打ち', t: '△9一飛のように下段へ打ち込まれると、薄い8九から玉に迫られる。', gote: '飛91', target: ['89', '99'] },
    ],
    sources: [
      { ref: 'wj-tenshukaku', for: '配置・解説' },
      { ref: 'wj-hidarimino', for: '解説' },
    ],
  },
  {
    id: 'yonmaimino', name: '四枚美濃（左美濃系）', short: '四枚美濃', reading: 'よんまいみの', side: 'ibisha', from: 'tenshukaku', family: 'mino', subtype: 'ginmino', setup: 'ibisha',
    core: '玉87 銀78 銀77 金69 金67',
    shell: '歩96 歩86 歩76 歩66 歩56',
    filler: '角88 香99 桂89 歩47 歩37',
    tags: ['対振り飛車', '持久戦', '金銀4枚'],
    desc: '天守閣美濃の7筋に銀を埋め、金銀4枚で囲う左美濃系の発展形[[wj-yonmaimino|wj-mino]]。上部にも横にも厚いが、駒が密集し組み上がるまでの手数も多い[[wj-yonmaimino]]。',
    ratings: { hard: 4, wide: 3, top: 4, side: 4, quick: 2 },
    pros: [
      { t: '金銀4枚で上部・横の両方に強い[[wj-yonmaimino]]', sq: ['78', '77', '69', '67'] },
      { t: '銀7七が玉頭（8七）と7筋をカバーする', sq: ['77', '87', '76'] },
    ],
    cons: [
      { t: '組むのに手数がかかる' },
      { t: '端（9筋）と下段（8九・9九）が薄い', sq: ['96', '89', '99'] },
    ],
    attacks: [
      { id: 'hashi', name: '端攻め', t: '△9五歩から端を突き、9六の歩を取って端から崩す。', gote: '歩95 香91 桂73', target: ['96', '97', '98'] },
    ],
    sources: [
      { ref: 'wj-yonmaimino', for: '配置・解説' },
      { ref: 'wj-mino', for: '解説' },
    ],
  },
  {
    id: 'nakazumai', name: '中住まい（4八銀型）', short: '中住まい', reading: 'なかずまい', side: 'ibisha', family: 'nakazumai', setup: 'ibisha',
    core: '玉58 金78 金38 銀48',
    shell: '歩97 歩87 歩76 歩67 歩57 歩47 歩37',
    rest: '銀79',
    filler: '角88 香99 桂89',
    tags: ['相居飛車', '急戦', '相掛かり・横歩取り'],
    desc: '玉を5八に上げただけの簡素な構え[[wj-nakazumai|sj-nakazumai]]。金は7八と3八に開き（金開き）、銀は4八に置く形が代表的[[wj-nakazumai|sj-nakazumai]]。囲いというより居玉を1手だけ固くした形で、横歩取りや相掛かりの激しい展開でよく現れる[[wj-nakazumai]]。',
    ratings: { hard: 2, wide: 4, top: 2, side: 3, quick: 5 },
    pros: [
      { t: '最短1〜2手で形になるので急戦に間に合う' },
      { t: '左右どちらにも逃げられ、飛車打ちの隙が少ない', sq: ['48', '58', '68'] },
    ],
    cons: [
      { t: '玉頭（5七方面）への攻めに弱い', sq: ['57', '47'] },
      { t: '玉が中央なので持久戦には向かない', sq: ['58'] },
    ],
    attacks: [
      { id: 'gyokuto', name: '玉頭攻め', t: '△5五歩・△4五桂などで5七を狙い、中央の玉を直接押さえにくる。', gote: '歩55 桂45', target: ['57', '47', '58'] },
    ],
    sources: [
      { ref: 'wj-nakazumai', for: '配置・解説' },
      { ref: 'sj-nakazumai', for: '配置・解説' },
    ],
  },
  {
    id: 'nakahara', name: '中原囲い', short: '中原囲い', reading: 'なかはらがこい', side: 'ibisha', family: 'nakazumai', setup: 'ibisha',
    core: '玉69 金78 金59 銀88 銀48',
    shell: '歩96 歩87 歩76 歩66 歩56 歩46',
    filler: '角79 香99 桂89 歩37',
    note: '【要確認】8八銀の位置に2説ある（7九銀とする記述もある[[wj-nakahara]]）。本データはWikipedia日本語版の図（8八銀・4八銀）に従う。',
    tags: ['相居飛車', '相掛かり・横歩取り'],
    desc: '中原誠名人が相掛かりで多用した囲い[[wj-nakahara]]。玉6九・金7八・金5九・銀4八と駒を低く並べ、8八にも銀を置く[[wj-nakahara]]。陣形が低いため飛車打ちや桂馬の攻めに強く、左右の逃げ道も広い[[wj-nakahara|wj-kakoi]]。',
    ratings: { hard: 3, wide: 4, top: 2, side: 4, quick: 4 },
    pros: [
      { t: '陣形が低く、自陣への飛車打ちに強い[[wj-nakahara]]', sq: ['69', '59', '48'] },
      { t: '8七の歩を突かずに済み、9六歩〜7七桂の反撃と結びつく', sq: ['87', '96', '77'] },
    ],
    cons: [
      { t: '玉頭（5〜6筋の上部）が薄い', sq: ['67', '57', '68'] },
      { t: '相掛かり・横歩取り以外で組む機会が少ない' },
    ],
    attacks: [
      { id: 'gyokuto', name: '玉頭攻め', t: '△6五歩・△5五桂のように上部から6七・5七を狙う。', gote: '歩65 桂55', target: ['67', '57', '68'] },
    ],
    sources: [
      { ref: 'wj-nakahara', for: '配置・解説' },
      { ref: 'wj-kakoi', for: '解説' },
    ],
  },
  {
    id: 'migigyoku', name: '右玉（角換わり型）', short: '右玉', reading: 'みぎぎょく', side: 'ibisha', family: 'migigyoku', setup: 'ibisha', kingWing: 'rook',
    core: '玉48 金58 金78 銀47 銀67 桂37',
    shell: '歩36 歩46 歩56 歩66 歩76',
    filler: '角88 香99 歩87 歩97',
    note: '【要確認】配置は代表例。金の置き所（5八／3八／6八）や銀の枚数は資料によって異なる[[wj-migigyoku|sj-migigyoku]]。飛車と同じ翼に玉を置くため、玉飛接近の判定からは kingWing:rook で外す（§6-3）。',
    tags: ['角換わり', 'バランス型', '玉飛接近'],
    desc: '飛車と同じ右側の翼へ玉を移す特殊な構え[[wj-migigyoku|sj-migigyoku]]。「玉飛接近すべからず」の例外で、自分から攻めず手待ちと受けで千日手も視野に入れる戦略の土台になる[[wj-migigyoku|sj-migigyoku]]。金銀が玉の左と正面を覆い、上部への仕掛けを受け止める[[wj-migigyoku]]。',
    ratings: { hard: 3, wide: 4, top: 3, side: 2, quick: 3 },
    pros: [
      { t: '左右に広く、飛車打ちへの対応がしやすい', sq: ['48', '58', '38'] },
      { t: '金銀3枚が正面を覆い、上部への押し込みに耐える[[wj-migigyoku]]', sq: ['47', '67', '78'] },
    ],
    cons: [
      { t: '飛車と玉が近い（玉飛接近）ため、成り込みや両取りに弱い[[wj-migigyoku]]', sq: ['28', '48'] },
      { t: '攻めに転じにくく、受けの構えになりがち' },
    ],
    attacks: [
      { id: 'dan', name: '下段への飛車打ち', t: '△3九飛・△5九飛のような下段打ちで、飛車と玉の間を割く。', gote: '飛39', target: ['38', '49', '59'] },
    ],
    sources: [
      { ref: 'wj-migigyoku', for: '配置・解説' },
      { ref: 'sj-migigyoku', for: '解説' },
    ],
  },
);
