// 手筋と格言: 駒組み（固定の局面）ではなく、数手で完結する局所の手順
// 手筋の図は盤の一部（files/ranks の窓）だけを、手順のコマ（frames）で見せる。先手視点
//   frames[i]: { move?: 直前に指した手, sente/gote: その時点の駒（"歩25" 形式。と金は "と"）,
//                hand?: 先手の持ち駒, caption: 一言 }
// role: attack（攻め）/ defense（受け）/ both
// piece: 主役の駒（コラムの目次で駒ごとに束ねる）
// proverbs: 関連する格言の id
// 歩の手筋は二歩に注意: 図はその筋に自分の歩が無い（交換済み）前提
window.Kakoi = window.Kakoi || {};
Kakoi.TESUJI = [
  // ---------- 歩 ----------
  {
    id: 'tsugifu', name: '継ぎ歩', reading: 'つぎふ', role: 'attack', piece: '歩',
    desc: '歩を突き捨てるか叩いた直後に、さらに歩を叩く手筋[[wj-shogi-yogo]]。相手の歩を前へ吊り上げ、その裏に拠点を作る準備になる[[wj-kakugen]]。',
    diagram: {
      files: [1, 3], ranks: [1, 8],
      frames: [
        { sente: '飛28 歩25', gote: '香11 桂21 歩23', hand: '歩歩', caption: '飛車先の歩が相手の歩とぶつかる手前' },
        { move: '▲2四歩 △同歩', sente: '飛28', gote: '香11 桂21 歩24', hand: '歩歩', caption: '突き捨てて歩を交換させる' },
        { move: '▲2五歩 △同歩', sente: '飛28', gote: '香11 桂21 歩25', hand: '歩', caption: '継ぎ歩：相手の歩を2五まで吊り上げる' },
      ],
    },
    proverbs: ['sanpu', 'tsukisute'],
    sources: [{ ref: 'wj-shogi-yogo', for: '定義' }, { ref: 'wj-kakugen', for: '格言' }],
  },
  {
    id: 'tarefu', name: '垂れ歩', reading: 'たれふ', aliases: ['垂らしの歩'], role: 'attack', piece: '歩',
    desc: '歩を敵陣の2〜4段目（次にと金に成れる位置）に打ち、相手に圧力をかける手筋（歩を垂らす）[[wj-shogi-yogo]]。継ぎ歩で相手の歩を吊り上げたあと、その裏に打って拠点にする使い方が定番[[wj-kakugen]]。',
    diagram: {
      files: [1, 3], ranks: [1, 8],
      frames: [
        { sente: '飛28', gote: '香11 桂21 歩25', hand: '歩', caption: '継ぎ歩で相手の歩を2五へ吊り上げた形' },
        { move: '▲2四歩', sente: '飛28 歩24', gote: '香11 桂21 歩25', caption: '垂れ歩：相手の歩の裏に打つので歩では取られない' },
        { move: '（受けがなければ）▲2三歩成', sente: '飛28 と23', gote: '香11 桂21 歩25', caption: 'と金ができる' },
      ],
    },
    proverbs: ['sanpu'],
    sources: [{ ref: 'wj-shogi-yogo', for: '定義' }, { ref: 'wj-kakugen', for: '格言' }],
  },
  {
    id: 'tatakifu', name: '叩きの歩', reading: 'たたきのふ', role: 'attack', piece: '歩',
    desc: '相手の駒の前に歩を打つ手筋（歩を叩く）[[wj-shogi-yogo]]。取ると陣形が乱れる、取らずに逃げると拠点が残る、という二択を迫る[[wj-shogi-yogo]]。相手の歩の前に打つ場合は「合わせ」と呼んで区別する[[wj-shogi-yogo]]。',
    diagram: {
      files: [1, 4], ranks: [1, 4],
      frames: [
        { sente: '', gote: '香11 桂21 玉22 金32 歩13', hand: '歩', caption: '金が玉の横を守っている' },
        { move: '▲3三歩', sente: '歩33', gote: '香11 桂21 玉22 金32 歩13', caption: '叩きの歩：金の頭に打つ' },
        { move: '△同金', sente: '', gote: '香11 桂21 玉22 金33 歩13', caption: '取れば金が玉から離れる。取らなければ次に▲3二歩成' },
      ],
    },
    proverbs: ['shouten'],
    sources: [{ ref: 'wj-shogi-yogo', for: '定義' }],
  },
  {
    id: 'rendafu', name: '連打の歩', reading: 'れんだのふ', role: 'attack', piece: '歩',
    desc: '相手の駒の頭に持ち駒の歩を次々と叩き、相手の駒をつり上げる手筋[[wj-shogi-yogo]]。先手を取って押さえ込んだり、攻めの手がかりを作ったりする[[wj-shogi-yogo]]。歩を何枚も使うので歩切れに注意。',
    diagram: {
      files: [1, 3], ranks: [1, 4],
      frames: [
        { sente: '', gote: '香11 玉31 金32', hand: '歩歩', caption: '香が隅を守っている' },
        { move: '▲1二歩 △同香', sente: '', gote: '香12 玉31 金32', hand: '歩', caption: '1回目：香を1二へつり上げる' },
        { move: '▲1三歩 △同香', sente: '', gote: '香13 玉31 金32', caption: '連打：さらに1三へ。1一・1二に空間ができる' },
      ],
    },
    proverbs: ['fu-nashi'],
    sources: [{ ref: 'wj-shogi-yogo', for: '定義' }],
  },
  {
    id: 'awasefu', name: '合わせの歩', reading: 'あわせのふ', role: 'both', piece: '歩',
    desc: '相手の歩の頭に持ち駒の歩を打つ手筋[[wj-shogi-yogo]]。多くは、その地点に利いている別の駒（飛車など）を活用する狙いがある[[wj-shogi-yogo]]。',
    diagram: {
      files: [1, 3], ranks: [1, 8],
      frames: [
        { sente: '飛28', gote: '香11 桂21 歩24', hand: '歩', caption: '相手の歩が2四まで伸びてきた' },
        { move: '▲2五歩', sente: '飛28 歩25', gote: '香11 桂21 歩24', caption: '合わせの歩：相手の歩の頭に打つ' },
        { move: '△同歩 ▲同飛', sente: '飛25', gote: '香11 桂21', hand: '歩', caption: '取れば飛車で取り返し、飛車が前に出る' },
      ],
    },
    proverbs: [],
    sources: [{ ref: 'wj-shogi-yogo', for: '定義' }],
  },
  {
    id: 'sokofu', name: '底歩', reading: 'そこふ', role: 'defense', piece: '歩',
    desc: '自陣のいちばん下（自分から見て一番手前の段）に打つ歩[[wj-shogi-yogo]]。典型は二段目の金の下に打ち、相手の飛車の横の利きをさえぎる形[[wj-shogi-yogo]]。弱点は香車で、その筋にもう歩を打てない（二歩）ことを突かれる[[wj-kakugen]]。',
    diagram: {
      files: [3, 8], ranks: [7, 9],
      frames: [
        { sente: '玉78 金58 銀67', gote: '飛39', hand: '歩', caption: '下段に飛車を打たれ、6九・7九へ成り込みを狙われる' },
        { move: '▲5九歩', sente: '玉78 金58 銀67 歩59', gote: '飛39', caption: '底歩：金の下に打って横の利きを止める' },
      ],
    },
    counters: ['side', 'dan'],
    proverbs: ['kinzoko', 'sokofu-kyo'],
    sources: [{ ref: 'wj-shogi-yogo', for: '定義' }, { ref: 'wj-kakugen', for: '格言' }],
  },
  {
    id: 'hikaefu', name: '控えの歩', reading: 'ひかえのふ', role: 'both', piece: '歩',
    desc: '持ち駒の歩を相手の駒に直接当てて打つのではなく、一つ下がったところに打ち、次に厳しい手を狙う手筋[[wj-shogi-yogo]]。受けでは、相手の垂れ歩の一つ下に打ち、と金を作られても取り返せるようにする。',
    diagram: {
      files: [6, 9], ranks: [6, 9],
      frames: [
        { sente: '玉89 金79', gote: '歩76', hand: '歩', caption: '相手の垂れ歩。次に△7七歩成を狙われる' },
        { move: '▲7八歩', sente: '玉89 金79 歩78', gote: '歩76', caption: '控えの歩：7七ではなく一つ下に打つ（7七に打つと歩で取られて成られる）' },
        { move: '△7七歩成 ▲同歩', sente: '玉89 金79 歩77', gote: '', caption: 'と金を作られても取り返せる' },
      ],
    },
    proverbs: [],
    sources: [{ ref: 'wj-shogi-yogo', for: '定義' }],
  },
  // ---------- 香・桂・銀・金 ----------
  {
    id: 'dengaku', name: '田楽刺し', reading: 'でんがくざし', role: 'attack', piece: '香',
    desc: '駒が縦に並んだ筋に香車を打ち、価値の高い駒を取る手[[wj-shogi-yogo]]。前の駒が逃げると後ろの駒が取られる。',
    diagram: {
      files: [1, 3], ranks: [1, 9],
      frames: [
        { sente: '', gote: '飛12 角14', hand: '香', caption: '相手の角と飛車が1筋に縦に並んでいる' },
        { move: '▲1九香', sente: '香19', gote: '飛12 角14', caption: '田楽刺し：下段から香を打つ。角が逃げると飛車に利きが通る' },
      ],
    },
    proverbs: ['gedan-kyo'],
    sources: [{ ref: 'wj-shogi-yogo', for: '定義' }, { ref: 'wj-kakugen', for: '格言' }],
  },
  {
    id: 'fundoshi', name: 'ふんどしの桂', reading: 'ふんどしのけい', aliases: ['桂馬のふんどし'], role: 'attack', piece: '桂',
    desc: '桂馬で両取りをかける手[[wj-shogi-yogo]]。利きの形がふんどしに似ていることからの名前[[wj-shogi-yogo]]。桂は駒を飛び越えるので合駒や紐で防ぎにくい。',
    diagram: {
      files: [3, 7], ranks: [2, 6],
      frames: [
        { sente: '', gote: '金43 飛63', hand: '桂', caption: '金と飛車が一マス空けて横に並んでいる' },
        { move: '▲5五桂', sente: '桂55', gote: '金43 飛63', caption: 'ふんどしの桂：金と飛車の両取り' },
      ],
    },
    proverbs: ['sankei'],
    sources: [{ ref: 'wj-shogi-yogo', for: '定義' }, { ref: 'wj-kakugen', for: '格言' }],
  },
  {
    id: 'wariuchi', name: '割り打ちの銀', reading: 'わりうちのぎん', aliases: ['割り銀'], role: 'attack', piece: '銀',
    desc: '銀の斜め後ろ2マスの利きを使う両取り[[wj-shogi-yogo]]。斜め後ろに動けない駒（金・飛車など）が一マス空けて並んでいるとき、その間の一段奥に銀を打つ[[wj-shogi-yogo]]。',
    diagram: {
      files: [2, 7], ranks: [1, 4],
      frames: [
        { sente: '', gote: '玉31 金42 金62', hand: '銀', caption: '金2枚が一マス空けて並んでいる' },
        { move: '▲5一銀', sente: '銀51', gote: '玉31 金42 金62', caption: '割り打ち：銀の斜め後ろで2枚の金を同時に狙う。金は斜め後ろに動けないので取れない' },
      ],
    },
    proverbs: ['gin-chidori'],
    sources: [{ ref: 'wj-shogi-yogo', for: '定義' }, { ref: 'wj-kakugen', for: '格言' }],
  },
  {
    id: 'atamakin', name: '頭金', reading: 'あたまきん', role: 'attack', piece: '金',
    desc: '相手の玉の一マス前に金を打って詰ます形[[wj-shogi-yogo]]。「詰みの基本は頭金」と言われる[[wj-shogi-yogo]]。金はひもが付いていれば玉で取れない。',
    diagram: {
      files: [3, 7], ranks: [1, 4],
      frames: [
        { sente: '歩53', gote: '玉51', hand: '金', caption: '居玉の頭に歩がいる' },
        { move: '▲5二金', sente: '金52 歩53', gote: '玉51', caption: '頭金：歩がひもになっていて玉で取れない。逃げ場もなく詰み' },
      ],
    },
    proverbs: ['kin-todome'],
    sources: [{ ref: 'wj-shogi-yogo', for: '定義' }, { ref: 'wj-kakugen', for: '格言' }],
  },
  // ---------- 角・飛 ----------
  {
    id: 'otebisha', name: '王手飛車', reading: 'おうてびしゃ', role: 'attack', piece: '角',
    desc: '王手と飛車取りを同時にかける両取り[[wj-shogi-yogo]]。王手を受けている間に飛車を取られる。序盤でかかると大きく形勢が傾くため、これを避ける駒組みが大切になる[[wj-shogi-yogo]]。玉と飛車が同じ斜めの筋に並んでいないかが危険の目安。',
    diagram: {
      files: [1, 6], ranks: [6, 9],
      frames: [
        { sente: '玉59 金69 金49 銀39 飛28', gote: '', caption: '居玉で、玉と飛車が斜めの筋に並んでいる（図は歩を省いた模式図）' },
        { move: '△3七角', sente: '玉59 金69 金49 銀39 飛28', gote: '角37', caption: '王手と同時に飛車にも利いている' },
      ],
    },
    detect: 'fork',
    proverbs: ['me-kara-hi', 'igyoku'],
    sources: [{ ref: 'wj-shogi-yogo', for: '定義' }, { ref: 'wj-kakugen', for: '格言' }],
  },
  {
    id: 'yureikaku', name: '幽霊角', reading: 'ゆうれいかく', role: 'attack', piece: '角',
    desc: '角が端（1筋か9筋）の五段目に飛び出す手、またはその角[[kouza-yureikaku|wj-tesuji]]。角の「覗き」の一種で、先手の▲9五角・後手の△1五角が典型[[kouza-yureikaku]]。相手陣への利きで駒取りや成り込みを見せて手番を握る。相手が端歩を突いていると追い返されるため、実戦で決まる機会は少ない[[kouza-yureikaku]]。',
    diagram: {
      files: [6, 9], ranks: [1, 7],
      frames: [
        { sente: '角77 歩97 歩87 歩76', gote: '香91 飛82 桂73 歩93 歩85 歩74', caption: '相手の9筋の端歩は9三のまま' },
        { move: '▲9五角', sente: '角95 歩97 歩87 歩76', gote: '香91 飛82 桂73 歩93 歩85 歩74', caption: '幽霊角：端の五段目に出て、8四を通して7三の桂を狙う' },
        { move: '△7二飛', sente: '角95 歩97 歩87 歩76', gote: '香91 飛72 桂73 歩93 歩85 歩74', caption: '飛車で桂を守る受けなどがある' },
      ],
    },
    proverbs: ['toomi'],
    sources: [{ ref: 'kouza-yureikaku', for: '定義・図' }, { ref: 'wj-tesuji', for: '分類' }, { ref: 'wj-kakugen', for: '格言' }],
  },
];

// 格言: コラム（手筋と格言のモーダル）で引く。出典は Wikipedia「将棋の格言」（五十音順の一覧）
// group: コラムでの見出し（序盤・駒の使い方・受け・寄せ・心得）
Kakoi.PROVERBS = [
  // 序盤・駒組み
  { id: 'igyoku', group: 'opening', text: '居玉は避けよ', reading: 'いぎょくはさけよ',
    desc: '玉を一マスも動かさないまま戦いが起こると、王手飛車の筋に入ったり反撃に脆かったりする。何かしら手をつけておく[[wj-kakugen]]。' },
  { id: 'gyokuhi', group: 'opening', text: '玉飛接近すべからず', reading: 'ぎょくひせっきんすべからず',
    desc: '攻めの要の飛車が玉のそばにあると攻防ともに支障が出て、飛車が犠牲になりやすい。カニカニ銀・右玉のような例外もある[[wj-kakugen]]。' },
  { id: 'kakusuji', group: 'opening', text: '角筋の玉受け難し', reading: 'かくすじのぎょくうけがたし',
    desc: '玉を囲うときも一時的に置くときも、相手の角の筋は避けておく[[wj-kakugen]]。' },
  { id: 'tsukisute', group: 'opening', text: '戦いは歩の突き捨てから', reading: 'たたかいはふのつきすてから',
    desc: '開戦前に歩を突き捨てておくと、相手の歩をうわずらせ、あとでその筋に持ち歩が利く[[wj-kakugen]]。' },
  { id: 'hashifu', group: 'opening', text: '手のない時には端歩を突け', reading: 'てのないときにははしふをつけ',
    desc: '指す手に困ったら、端歩を突いて待つのがよい[[wj-kakugen]]。' },
  // 駒の使い方
  { id: 'uke-kin', group: 'pieces', text: '受けは金、攻めは銀', reading: 'うけはきん、せめはぎん',
    desc: '金は守りに、銀は攻めに使うのが駒の性質に合っている[[wj-kakugen]]。' },
  { id: 'seme-hikaku', group: 'pieces', text: '攻めは飛角銀桂', reading: 'せめはひかくぎんけい',
    desc: '攻めは飛車・角・銀・桂で行うもの。「攻めは飛角銀桂香歩」とも[[wj-kakugen]]。' },
  { id: 'gin-chidori', group: 'pieces', text: '銀は千鳥に使え', reading: 'ぎんはちどりにつかえ',
    desc: '銀は斜めになら進むことも引くこともできるので、斜め（千鳥）に動かすのがよい[[wj-kakugen]]。' },
  { id: 'kei-takatobi', group: 'pieces', text: '桂の高跳び歩の餌食', reading: 'けいのたかとびふのえじき',
    desc: '桂は一度跳ぶと戻れないので、調子に乗って跳ねると歩に捕まる[[wj-kakugen]]。' },
  { id: 'gedan-kyo', group: 'pieces', text: '下段の香に力あり', reading: 'げだんのきょうにちからあり',
    desc: '香は利きを最大限に生かすため、下段から打つほうがよい。「香は下段から打て」とも[[wj-kakugen]]。' },
  { id: 'toomi', group: 'pieces', text: '遠見の角に好手あり', reading: 'とおみのかくにこうしゅあり',
    desc: '一見利いていないような遠くの角でも、角の利きは受けづらく後々利いてくる[[wj-kakugen]]。' },
  { id: 'hisha-juji', group: 'pieces', text: '飛車は十字に使え', reading: 'ひしゃはじゅうじにつかえ',
    desc: '飛車は縦横に動ける駒なので、十字に使ってその動きを存分に生かす[[wj-kakugen]]。' },
  { id: 'ippu', group: 'pieces', text: '一歩千金', reading: 'いっぷせんきん',
    desc: '歩でも局面によっては金以上に必要になる。たかが歩と軽く考えない[[wj-kakugen]]。' },
  { id: 'fu-nashi', group: 'pieces', text: '歩のない将棋は負け将棋', reading: 'ふのないしょうぎはまけしょうぎ',
    desc: '歩は攻防ともに欠かせない。持ち駒に歩が無いと、いざというときに打てず負けにつながる[[wj-kakugen]]。' },
  { id: 'sanpu', group: 'pieces', text: '三歩あったら継ぎ歩に垂れ歩', reading: 'さんぷあったらつぎふにたれふ',
    desc: '歩が3枚あれば、相手の駒を吊り上げて拠点を作ることができる[[wj-kakugen]]。' },
  { id: 'shouten', group: 'pieces', text: '焦点の歩に好手あり', reading: 'しょうてんのふにこうしゅあり',
    desc: '相手の駒が複数利いているところに歩を打つ手は、有効なことが多い[[wj-kakugen]]。' },
  // 受け
  { id: 'kinzoko', group: 'defense', text: '金底の歩は岩より固し', reading: 'きんそこのふはいわよりかたし',
    desc: '金の一段下に歩を打った形（金底の歩）は、強固な守りになることが多い[[wj-kakugen]]。' },
  { id: 'sokofu-kyo', group: 'defense', text: '底歩には香打ちで', reading: 'そこふにはきょううちで',
    desc: '底歩の弱点は香車の攻め。二歩が禁じ手であることを逆用する[[wj-kakugen]]。' },
  { id: 'oogoma-chikaku', group: 'defense', text: '大駒は近づけて受けよ', reading: 'おおごまはちかづけてうけよ',
    desc: '「大駒は離して打て」の裏返し。受ける側は大駒に近づいて働きを抑える[[wj-kakugen]]。' },
  { id: 'hayanige', group: 'defense', text: '玉の早逃げ八手の得', reading: 'ぎょくのはやにげはってのとく',
    desc: '攻めが止まりにくいときは、持ち駒で受けるより玉を安全地帯へ逃がすほうが手得になる[[wj-kakugen]]。' },
  { id: 'kinnashi', group: 'defense', text: '金なし将棋に受け手なし', reading: 'きんなししょうぎにうけてなし',
    desc: '金は守りの要。金が無ければ相手の攻めを受けきれない[[wj-kakugen]]。' },
  { id: 'ryoutori', group: 'defense', text: '両取り逃げるべからず', reading: 'りょうどりにげるべからず',
    desc: '両取りでも同時に2枚は取られない。逃げるより他の手を探したほうが得なこともある[[wj-kakugen]]。' },
  // 寄せ・終盤
  { id: 'nagai-tsumi', group: 'endgame', text: '長い詰みより短い必至', reading: 'ながいつみよりみじかいひっし',
    desc: '長手数の難しい詰みを読み切るより、短手数の分かりやすい必至（受けのない形）を読み切るほうが勝ちやすい[[wj-kakugen]]。' },
  { id: 'oute-ou', group: 'endgame', text: '王手は追う手', reading: 'おうてはおうて',
    desc: '策もなく王手をかけても、相手の玉を安全地帯へ逃がすだけ。類義に「玉は包むように寄せよ」[[wj-kakugen]]。' },
  { id: 'gedan-otose', group: 'endgame', text: '玉は下段に落とせ', reading: 'ぎょくはげだんにおとせ',
    desc: '寄せの段階では、相手の玉を下段に落とすと寄せやすい[[wj-kakugen]]。' },
  { id: 'sokudo', group: 'endgame', text: '終盤は駒の損得より速度', reading: 'しゅうばんはこまのそんとくよりそくど',
    desc: '終盤は駒を多く取るより、早く玉を寄せることを優先する[[wj-kakugen]]。' },
  { id: 'kin-todome', group: 'endgame', text: '金はとどめに残せ', reading: 'きんはとどめにのこせ',
    desc: '最後に玉を詰ますときに持ち駒に金を残しておくと、詰ませやすい[[wj-kakugen]]。' },
  { id: 'sankei', group: 'endgame', text: '三桂あって詰まぬことなし', reading: 'さんけいあってつまぬことなし',
    desc: '大げさな表現で詰まないことも多いが、桂は駒を飛び越えて玉を攻められるので、3枚あると様々な寄せが可能になる[[wj-kakugen]]。' },
  { id: 'me-kara-hi', group: 'endgame', text: '目から火の出る王手飛車', reading: 'めからひのでるおうてびしゃ',
    desc: '王手飛車取りは、かけられた側にとって厳しい手になることが多い[[wj-kakugen]]。' },
  { id: 'hashigyoku', group: 'endgame', text: '端玉には端歩で', reading: 'はしぎょくにははしふで',
    desc: '端にいる玉には、端歩を突いて攻めるのが有効[[wj-kakugen]]。' },
  { id: 'ukigoma', group: 'endgame', text: '浮き駒に手あり', reading: 'うきごまにてあり',
    desc: '守られていない相手の駒を狙うと駒得になりやすい。「離れ駒に手あり」とも[[wj-kakugen]]。' },
];
Kakoi.PROVERB_GROUPS = [
  ['opening', '序盤・駒組み'],
  ['pieces', '駒の使い方'],
  ['defense', '受け'],
  ['endgame', '寄せ・終盤'],
];
