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
    desc: '持ち駒の歩を相手の駒に直接当てて打つのではなく、一つ下がったところに打ち、次に厳しい手を狙う手筋[[wj-shogi-yogo]]。図は相手の垂れ歩への受けに使う例で、自陣二段目に控えて打って局面を収める「土下座の歩」に近い用法[[wj-fuhyou]]。',
    diagram: {
      files: [6, 9], ranks: [6, 9],
      frames: [
        { sente: '玉89 金79', gote: '歩76', hand: '歩', caption: '相手の垂れ歩。次に△7七歩成を狙われる' },
        { move: '▲7八歩', sente: '玉89 金79 歩78', gote: '歩76', caption: '控えの歩：7七ではなく一つ下に打つ（7七に打つと歩で取られて成られる）' },
        { move: '△7七歩成 ▲同歩', sente: '玉89 金79 歩77', gote: '', hand: '歩', caption: 'と金を作られても取り返せる' },
      ],
    },
    proverbs: [],
    sources: [{ ref: 'wj-shogi-yogo', for: '定義' }, { ref: 'wj-fuhyou', for: '受けの用法（土下座の歩）' }],
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
    sources: [{ ref: 'wj-shogi-yogo', for: '定義' }],
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
    sources: [{ ref: 'wj-shogi-yogo', for: '定義' }],
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
    sources: [{ ref: 'wj-shogi-yogo', for: '定義' }],
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
    sources: [{ ref: 'wj-shogi-yogo', for: '定義' }],
  },
  // ---------- 角・飛 ----------
  {
    id: 'otebisha', name: '王手飛車', reading: 'おうてびしゃ', role: 'attack', piece: '角',
    desc: '王手と飛車取りを同時にかける両取り[[wj-shogi-yogo]]。王手を受けている間に飛車を取られる。序盤でかかると大きく形勢が傾くため、これを避ける駒組みが大切になる[[wj-shogi-yogo]]。危険の目安は、玉と飛車に同時に利くマスに角（または桂）を打てて、そのマスが守りの駒で取れないこと。',
    diagram: {
      files: [1, 6], ranks: [6, 9],
      frames: [
        { sente: '玉59 金69 金49 銀39 飛28', gote: '', handGote: '角', caption: '居玉で、玉と飛車に同時に利く筋がある（図は歩を省いた模式図）' },
        { move: '△3七角', sente: '玉59 金69 金49 銀39 飛28', gote: '角37', handGote: '', caption: '王手と同時に飛車にも利いている' },
      ],
    },
    detect: 'fork',
    proverbs: ['me-kara-hi', 'igyoku'],
    sources: [{ ref: 'wj-shogi-yogo', for: '定義' }],
  },
  {
    id: 'yureikaku', name: '幽霊角', reading: 'ゆうれいかく', role: 'attack', piece: '角',
    note: '定義と図の裏付けとなる出典が確認できていない【要確認】（Wikipedia「手筋 (将棋)」に名前の記載のみ。用語一覧・将棋講座ドットコムの手筋一覧には項目が無い）',
    desc: '角が端（1筋か9筋）の五段目に飛び出す手、またはその角[[wj-tesuji]]。角の「覗き」の一種で、先手の▲9五角・後手の△1五角が典型とされる。相手陣への利きで駒取りや成り込みを見せて手番を握る。相手が端歩を突いていると追い返されるため、実戦で決まる機会は少ないとされる。',
    diagram: {
      files: [6, 9], ranks: [1, 7],
      frames: [
        { sente: '角77 歩97 歩87 歩76', gote: '香91 飛82 桂73 歩93 歩85 歩74', caption: '相手の9筋の端歩は9三のまま' },
        { move: '▲9五角', sente: '角95 歩97 歩87 歩76', gote: '香91 飛82 桂73 歩93 歩85 歩74', caption: '幽霊角：端の五段目に出て、8四を通して7三の桂を狙う' },
        { move: '△7二飛', sente: '角95 歩97 歩87 歩76', gote: '香91 飛72 桂73 歩93 歩85 歩74', caption: '飛車で桂を守る受けなどがある' },
      ],
    },
    proverbs: ['toomi'],
    sources: [{ ref: 'wj-tesuji', for: '分類・名前' }],
  },
  // ---------- 囲いの崩し方（coverage-tesuji §6。onCastle＝対象の囲いと急所。図の向きは文献どおり
  //   先手＝攻め方が下で、後手の囲いを攻める。先手の囲いへ重ねるときは 180度回して使う） ----------
  // ---------- 美濃囲いの崩し方（日本将棋連盟「美濃囲いの崩し方」vol.1〜4。図は vol.1 第3図・vol.4 第1〜4図と目視照合済み） ----------
  {
    id: 'mino-kyusho39', name: '美濃の急所を突く', reading: 'みののきゅうしょをつく', role: 'attack', piece: '銀',
    onCastle: { ids: ['mino', 'chonmagemino'], side: 'gote', requires: '玉82 銀72 金61 金52', weak: ['39'], note: '図は後手の美濃（記事の「7一」）。先手の美濃に換算すると急所は3九。図は端歩を突いていない形で、現行データの美濃は端歩が1六なので、△9二玉の変化は詰まない可能性がある【要確認】' },
    desc: '美濃囲いを横から攻めるときの急所は、玉の斜め後ろ（図では7一）[[jsf-mino01]]。その地点への利きが同数なら、角の足の長さで利きを1枚足してから銀を打つ[[jsf-mino02]]。同金なら角成、△9二玉には竜を切って金を取り、その金で詰ます[[jsf-mino01]]。',
    diagram: {
      files: [2, 9], ranks: [1, 4],
      frames: [
        { sente: '角44 龍21', gote: '香91 桂81 金61 玉82 銀72 金52 歩93 歩83 歩73 歩63', hand: '銀', caption: '角の筋が 7一 に通っている。7一は美濃の急所' },
        { move: '▲7一銀', sente: '銀71 角44 龍21', gote: '香91 桂81 金61 玉82 銀72 金52 歩93 歩83 歩73 歩63', caption: '△9二玉には ▲6一龍△同銀▲8二金 の変化がある（同じ形で終わる）' },
        { move: '△同金 ▲同角成', sente: '馬71 龍21', gote: '香91 桂81 玉82 銀72 金52 歩93 歩83 歩73 歩63', hand: '金', handGote: '銀', caption: '馬の王手。龍が守っているので玉は取れず、△9二玉の一手' },
        { move: '△9二玉 ▲8二金', sente: '金82 馬71 龍21', gote: '香91 桂81 玉92 銀72 金52 歩93 歩83 歩73 歩63', handGote: '銀', mate: true, caption: '詰み。金は馬が守っていて玉で取れない' },
      ],
    },
    proverbs: ['kaname-kin'],
    sources: [{ ref: 'jsf-mino01', for: '手順・図' }, { ref: 'jsf-mino02', for: '解説' }],
  },
  {
    id: 'mino-kobin-keima', name: 'コビン攻め（桂）', reading: 'こびんぜめ', role: 'attack', piece: '桂',
    onCastle: { ids: ['mino', 'chonmagemino'], side: 'gote', requires: '玉82 銀72 金61 金52', weak: ['36'], note: '図は後手の美濃。先手の美濃に換算すると、桂を打つのは 3六（玉28の斜め前）。端歩・玉の周りの歩の位置は美濃の急所と同じ注意【要確認】' },
    desc: '玉の斜め前（コビン）に桂を打つ手筋[[jsf-mino04]]。7三の歩は角の筋に縛られていて桂を取れない（取ると角が玉に届く）[[jsf-mino04]]。玉が逃げても ▲8二金 で詰む[[jsf-mino04]]。',
    diagram: {
      files: [5, 9], ranks: [1, 5],
      frames: [
        { sente: '角55', gote: '香91 桂81 金61 玉82 銀72 金52 歩93 歩83 歩73 歩63 歩53', hand: '金桂', handGote: '', caption: '盤上の駒は角だけ。金・桂を持っている' },
        { move: '▲7四桂', sente: '桂74 角55', gote: '香91 桂81 金61 玉82 銀72 金52 歩93 歩83 歩73 歩63 歩53', hand: '金', caption: 'コビンに桂。△7四同歩は角筋が通って玉を取られる（歩は縛られている）' },
        { move: '△7一玉 ▲8二金', sente: '金82 桂74 角55', gote: '香91 桂81 金61 玉71 銀72 金52 歩93 歩83 歩73 歩63 歩53', mate: true, caption: '詰み。金は桂が守っている。△9二玉でも ▲8二金 で詰み' },
      ],
    },
    proverbs: ['kakusuji-ukenikui'],
    sources: [{ ref: 'jsf-mino04', for: '手順・図' }],
  },
  {
    id: 'mino-kobin-ryu', name: 'コビン攻め（先に龍を切る）', reading: 'こびんぜめ さきにりゅうをきる', role: 'attack', piece: '龍',
    onCastle: { ids: ['mino', 'chonmagemino'], side: 'gote', requires: '玉82 銀72 金61 金52', weak: ['36'], note: '持ち駒が桂だけで 2一に龍がある形。先手の美濃に換算すると龍は 8九' },
    desc: '持ち駒が桂だけのとき、いきなり ▲7四桂 は △7一玉 で寄らない[[jsf-mino04]]。先に ▲6一龍 と金を取り、△同銀 を強いてから桂を打つ[[jsf-mino04]]。龍と桂のどちらが先かは形で変わるので、手を止めて読む[[jsf-mino04]]。',
    diagram: {
      files: [2, 9], ranks: [1, 5],
      frames: [
        { sente: '龍21 角55', gote: '香91 桂81 金61 玉82 銀72 金52 歩93 歩83 歩73 歩63 歩53', hand: '桂', caption: '▲7四桂 は △7一玉 で、5二の金が利いて寄らない' },
        { move: '▲6一龍', sente: '龍61 角55', gote: '香91 桂81 玉82 銀72 金52 歩93 歩83 歩73 歩63 歩53', hand: '金桂', caption: '先に龍で金を取る' },
        { move: '△同銀 ▲7四桂', sente: '桂74 角55', gote: '香91 桂81 銀61 玉82 金52 歩93 歩83 歩73 歩63 歩53', hand: '金', handGote: '飛', caption: '△同銀で 7二の銀が離れた。桂は歩で取れない' },
        { move: '△7二玉 ▲8二金', sente: '金82 桂74 角55', gote: '香91 桂81 銀61 玉72 金52 歩93 歩83 歩73 歩63 歩53', handGote: '飛', mate: true, caption: '詰み。△7一玉・△9二玉でも ▲8二金 で詰む' },
      ],
    },
    proverbs: [],
    sources: [{ ref: 'jsf-mino04', for: '手順・図' }],
  },
  // ---------- 舟囲いの崩し方（将棋上達塾「舟囲い崩しの手筋」。図1-1・1-2・1-5・1-6・2-1・2-3 と目視照合済み） ----------
  {
    id: 'funa-okuri31', name: '舟囲い（3一銀型）の送りの手筋', reading: 'ふながこいのおくりのてすじ', role: 'attack', piece: '金',
    onCastle: { ids: ['funa'], side: 'gote', requires: '玉32 銀31 金41 金52', weak: ['69'], note: '図は後手の3一銀型。先手の舟囲い（7九銀型）に換算すると、急所は 6九の金' },
    desc: '2段目の飛で5二の金を縛り、▲5三銀 を打つ[[joutatsu-funa-kuzushi]]。△4二金 のあと ▲7五角 から銀と角を清算し、▲2二金 の送りの手筋で寄り筋に入る[[joutatsu-funa-kuzushi]]。玉に近い攻め駒は、なるべく清算しない[[joutatsu-funa-kuzushi]]。',
    diagram: {
      files: [1, 8], ranks: [1, 5],
      frames: [
        { sente: '飛82', gote: '香11 桂21 銀31 金41 玉32 金52 歩43 歩23 歩54 歩34 歩14', hand: '角銀', caption: '先手の飛は2段目。5二の金が動くと玉に飛が利く' },
        { move: '▲5三銀 △4二金', sente: '飛82 銀53', gote: '香11 桂21 銀31 金41 金42 玉32 歩43 歩23 歩54 歩34 歩14', hand: '角', caption: '▲5三銀は取れない（△同金は飛の筋が通って玉を取られる）。△4二金と引くしかない' },
        { move: '▲7五角', sente: '飛82 銀53 角75', gote: '香11 桂21 銀31 金41 金42 玉32 歩43 歩23 歩54 歩34 歩14', caption: '攻防の角。ここで ▲4二銀成 と先に清算しない。別の筋は ▲7四角（▲4一角成△同玉▲5二金）' },
        { move: '▲4二銀成 △同金 ▲同角成 △同銀 ▲2二金', sente: '飛82 金22', gote: '香11 桂21 銀42 玉32 歩43 歩23 歩54 歩34 歩14', hand: '金', handGote: '角銀', caption: '送りの手筋：金を玉の横に打ち、玉で取らせて寄せに向かう' },
      ],
    },
    proverbs: ['kaname-kin'],
    sources: [{ ref: 'joutatsu-funa-kuzushi', for: '手順・図' }],
  },
  {
    id: 'funa-okuri42', name: '舟囲い（4二銀型）は 2二に打ち込む', reading: 'ふながこいにににうちこむ', role: 'attack', piece: '銀',
    onCastle: { ids: [], side: 'gote', requires: '玉32 銀42 金41 金52', weak: ['88'], note: '図は後手の4二銀型＝先手の 玉78 銀68 金69 金58。現行の funa68gin は core の右金が 4九 で形が違うため対象にしない【要確認】。打ち込む急所は先手換算で 8八' },
    desc: '4二銀型の舟囲いは、1段目の飛から攻めるのが筋[[joutatsu-funa-kuzushi]]。2二に駒を打ち込むのが急所で、銀でなく香や角でもよい[[joutatsu-funa-kuzushi]]。△同玉 に ▲4一飛成 と金を取り、送りの手筋で攻める[[joutatsu-funa-kuzushi]]。',
    diagram: {
      files: [1, 8], ranks: [1, 5],
      frames: [
        { sente: '飛81', gote: '香11 桂21 金41 銀42 玉32 金52 歩43 歩23 歩54 歩34 歩14', hand: '銀', caption: '4二銀型の舟囲い。先手の飛は1段目' },
        { move: '▲2二銀', sente: '飛81 銀22', gote: '香11 桂21 金41 銀42 玉32 金52 歩43 歩23 歩54 歩34 歩14', caption: '2二に打ち込むのが舟囲いの急所' },
        { move: '△同玉 ▲4一飛成', sente: '龍41', gote: '香11 桂21 銀42 玉22 金52 歩43 歩23 歩54 歩34 歩14', hand: '金', handGote: '銀', caption: '玉を2二へ送り出して金を取る。次は ▲5一龍（さらに金取り）か ▲3二金' },
      ],
    },
    proverbs: ['kaname-kin'],
    sources: [{ ref: 'joutatsu-funa-kuzushi', for: '手順・図' }],
  },
  // ---------- 穴熊の崩し方（日本将棋連盟「穴熊の崩し方」vol.9。図は Web Archive に無く本文から再構成【要確認】） ----------
  {
    id: 'ana-tsugifu-tarefu', name: '穴熊の 8三を継ぎ歩と垂れ歩で攻める', reading: 'あなぐまのはっさんを', role: 'attack', piece: '歩',
    onCastle: { ids: ['furianaguma'], mirrorIds: ['anaguma', 'nakabisha-hidari-anaguma'], side: 'gote', requires: '玉91 香92 桂81 銀82 金72 金71', weak: ['27'], note: '図は後手の穴熊（玉91）。右隅の振り飛車穴熊（玉19）に換算すると急所は 2七。左隅の居飛車穴熊（玉99）には筋を反転（mirrorIds）して使い、急所は 8七' },
    desc: '穴熊は 8三 が急所になることが多い[[jsf-ana09]]。歩が3枚あれば、▲8四歩△同歩▲8五歩△同歩▲8四歩 と継ぎ歩と垂れ歩で 8三 を空け、次の ▲8三桂（王手金取り）を狙える[[jsf-ana09]]。格言「三歩持ったら継ぎ歩と垂れ歩」の実例[[jsf-ana09]]。',
    diagram: {
      files: [7, 9], ranks: [1, 5],
      frames: [
        { sente: '', gote: '玉91 香92 桂81 銀82 金72 金71 歩83', hand: '歩歩歩桂', caption: '【要確認】記事の図は未取得。本文から再構成した金銀3枚の穴熊。持ち駒に歩が3枚' },
        { move: '▲8四歩 △同歩', sente: '', gote: '玉91 香92 桂81 銀82 金72 金71 歩84', hand: '歩歩桂', handGote: '歩', caption: '突き捨て。相手の歩を 8四 へ' },
        { move: '▲8五歩 △同歩', sente: '', gote: '玉91 香92 桂81 銀82 金72 金71 歩85', hand: '歩桂', handGote: '歩歩', caption: '継ぎ歩：歩をさらに 8五 へ吊り上げる' },
        { move: '▲8四歩', sente: '歩84', gote: '玉91 香92 桂81 銀82 金72 金71 歩85', hand: '桂', handGote: '歩歩', caption: '垂れ歩：次の ▲8三桂（王手金取り）を狙う' },
      ],
    },
    proverbs: ['sanpu'],
    sources: [{ ref: 'jsf-ana09', for: '手順' }],
  },
  // ---------- 受けの手筋（日本将棋連盟「銀の手筋」第2図と目視照合済み。後手の持ち駒の大駒1枚は種類を判別できず省略【要確認】） ----------
  {
    id: 'keitou-gin', name: '桂頭の銀', reading: 'けいとうのぎん', aliases: ['桂先の銀'], role: 'defense', piece: '銀',
    onCastle: { ids: ['katamino', 'bouzumino'], side: 'sente', requires: '玉28 銀38 金49', weak: ['36', '16'], note: '受ける側（先手）が下の図なので回転しない。2四に跳ねた桂の跳び先 3六・1六 が守る急所' },
    desc: '桂の頭（真正面）に銀を打つ受け[[jsf-tesuji-gin]]。銀は斜め後ろにも利くので、桂の跳び先に利かせられ、桂を取る狙いも持つ[[jsf-tesuji-gin]]。玉頭や端を桂で狙われたときの受けの基本[[jsf-tesuji-gin]]。',
    diagram: {
      files: [1, 4], ranks: [3, 9],
      frames: [
        { sente: '歩47 歩37 歩27 歩17 銀38 玉28 金49 桂29 香19', gote: '歩23 歩34 桂24 歩14', hand: '銀', handGote: '桂金', caption: '後手の桂が 2四 にいる。次に △3六桂（王手）や △1六桂 の筋' },
        { move: '▲2五銀', sente: '歩47 歩37 歩27 歩17 銀38 玉28 金49 桂29 香19 銀25', gote: '歩23 歩34 桂24 歩14', handGote: '桂金', caption: '桂頭の銀：3六・1六の跳び先に銀が利く。桂も取りに行ける' },
        { move: '△3六桂 ▲同歩', sente: '歩47 歩36 歩27 歩17 銀38 玉28 金49 桂29 香19 銀25', gote: '歩23 歩34 歩14', hand: '桂', handGote: '桂金', caption: '跳んでも ▲同歩（または▲同銀）で桂損' },
      ],
    },
    proverbs: ['keitou-gin-k'],
    sources: [{ ref: 'jsf-tesuji-gin', for: '定義・図' }],
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
  { id: 'kakusuji-ukenikui', group: 'pieces', text: '角筋は受けにくし', reading: 'かくすじはうけにくし', alt: ['角筋は止めにくし'],
    desc: '角の筋は駒の間を縫うように利き、玉の近くの受けにも使いやすい[[wj-kakugen]]。「角筋の玉受け難し」とは別の見出し。' },
  { id: 'tsukisute', group: 'opening', text: '戦いは歩の突き捨てから', reading: 'たたかいはふのつきすてから',
    desc: '開戦前に歩を突き捨てておくと、相手の歩をうわずらせ、あとでその筋に持ち歩が利く[[wj-kakugen]]。' },
  { id: 'hashifu', group: 'opening', text: '手のない時には端歩を突け', reading: 'てのないときにははしふをつけ',
    desc: '指す手に困ったら、端歩を突いて待つのがよい[[wj-kakugen]]。' },
  { id: 'kyusen-igyoku', group: 'opening', text: '急戦は居玉', reading: 'きゅうせんはいぎょく',
    desc: '急戦のときは、玉を囲わず居玉のまま攻めたほうがよいことがある。早繰り銀や棒銀などの急戦で言われる[[wj-kakugen]]。' },
  { id: 'joban-hikaku', group: 'opening', text: '序盤は飛車より角', reading: 'じょばんはひしゃよりかく',
    desc: '序盤は敵陣に飛車を打ち込む隙が少ないが、斜めに利く角は序盤から働く。飛車と角の交換では、角を手に入れた側が有利[[wj-kakugen]]。' },
  { id: 'furibisha-kakukoukan', group: 'opening', text: '振り飛車には角交換を狙え', reading: 'ふりびしゃにはかくこうかんをねらえ',
    desc: '振り飛車は角打ちの隙ができやすいので、居飛車側は角交換をすると有利に進めやすい。ただし近年は、角交換型の振り飛車など振り飛車側から動く戦法も指され、一概には言えない[[wj-kakugen]]。' },
  { id: 'yokofu-sannen', group: 'opening', text: '横歩三年の患い', reading: 'よこふさんねんのうれい',
    desc: '飛車先の歩を交換したあと、一歩得を狙ってむやみに横歩を取ると、駒組みに手数がかかって苦労するという意味。ただし2004年の資料は、のちに横歩を取る側の勝率が良くなり、時代によって変わるとしている[[wj-kakugen]]。' },
  { id: 'hishasaki-koukan', group: 'opening', text: '飛車先の歩交換三つの得あり', reading: 'ひしゃさきのふこうかんみつのとくあり',
    desc: '飛車先の歩の交換には三つの得がある。持ち駒に歩が増える。歩がいなくなったマスへ自分の駒を進められる。飛車の利きが敵陣へ直接通る[[wj-kakugen]]。' },
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
  { id: 'sanpu-hashite', group: 'pieces', text: '三歩持ったら端に手あり', reading: 'さんぷもったらはしにてあり',
    desc: '歩を3枚持っていれば、相手の香車を吊り上げて攻めることができる[[wj-kakugen]]。' },
  { id: 'kin-hiku', group: 'pieces', text: '金は引く手に好手あり', reading: 'きんはひくてにこうしゅあり',
    desc: '金は下への利きが弱いので、引くことで「上に強い」という持ち味が生きやすい。「金は斜めに誘え」の逆[[wj-kakugen]]。' },
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
  { id: 'keitou-gin-k', group: 'defense', text: '桂頭の銀、これ定跡なり', reading: 'けいとうのぎん これじょうせきなり', alt: ['桂先の銀、定跡なり'],
    desc: '桂の頭（真正面）に銀を置く受けは、玉頭や端を桂で狙われたときの定跡[[wj-kakugen]]。' },
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
  { id: 'kaname-kin', group: 'endgame', text: '要の金を狙え', reading: 'かなめのきんをねらえ',
    desc: '玉の周りの金を攻めるのは、囲いを崩すときの基本になる[[wj-kakugen]]。' },
  { id: 'kinnashi-seme', group: 'endgame', text: '金なし将棋に攻め手なし', reading: 'きんなししょうぎにせめてなし',
    desc: '金は攻めの要でもあり、金がなければ相手の玉を詰ますことはできない。守りの面を言う「金なし将棋に受け手なし」と対になる[[wj-kakugen]]。' },
  // 心得
  { id: 'chouko', group: 'mind', text: '長考に好手なし', reading: 'ちょうこうにこうしゅなし',
    desc: '長く考えても、良い手が出るとは限らない。羽生善治は、長考しているときは考えているというより迷って悩んでいることが多いからだと話している[[wj-kakugen]][[bunshun-chouko]]。',
    sources: [{ ref: 'bunshun-chouko', for: '羽生善治の発言' }] },
];
Kakoi.PROVERB_GROUPS = [
  ['opening', '序盤・駒組み'],
  ['pieces', '駒の使い方'],
  ['defense', '受け'],
  ['endgame', '寄せ・終盤'],
  ['mind', '心得'],
];
