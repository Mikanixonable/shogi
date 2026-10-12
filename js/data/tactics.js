// 戦法: 主役の駒の筋で分類した駒組みの例（先手視点）
// pieces は先手の盤上の全駒、hand は持ち駒。lead.square に主役の駒が立つ
window.Kakoi = window.Kakoi || {};
Kakoi.TACTICS = [
  {
    id: 'kyukenbisha', name: '九間飛車', reading: 'きゅうけんびしゃ',
    aliases: ['端飛車'],
    family: 'furibisha-rook', lead: { piece: '飛', files: [9], square: '98' },
    route: ['28', '98'],
    pieces: '玉28 飛98 角77 金49 金58 銀38 銀67 桂89 桂29 香99 香19 歩96 歩87 歩76 歩66 歩57 歩47 歩37 歩27 歩17',
    castles: ['mino'], context: '対居飛車（相手の左美濃・雁木の端を狙う）',
    desc: '飛車を9筋（端）に振る戦法で、端飛車とも呼ばれる。9筋から相手玉の近くの端を攻める奇襲色の強い指し方。最大の課題は8八の角が飛車の通り道をふさぐ点。「二段ロケット」は飛車や香を同じ筋に縦に重ねる攻め方の呼び名で、筋で決まる戦法ではない。',
    pros: [
      { t: '相手が角道を止める振り飛車などに端から意表を突ける' },
      { t: '相手玉から遠い側を攻められる' },
    ],
    cons: [
      { t: '中央が薄く角打ちの隙ができやすい' },
      { t: '8八の角の処理が必要で一般的な定跡が乏しい' },
    ],
    note: '配置図は出典に例がないため一般的な美濃囲いから組み立てた例。8八の角が飛車の通り道をふさぐため、角を動かしてから振る。1筋に振る場合は一間飛車と呼ぶ',
    sources: [
      { ref: 'wj-ikkenbisha', for: '解説' },
      { ref: 'shinrar-hashibisha', for: '解説' },
      { ref: 'note-nifusen-kyuken', for: '解説' },
      { ref: 'wj-shogi-yogo', for: '用語' },
    ],
  },
  {
    id: 'mukaibisha', name: '向かい飛車', reading: 'むかいびしゃ',
    family: 'furibisha-rook', lead: { piece: '飛', files: [8], square: '88' },
    route: ['28', '88'],
    pieces: '玉28 飛88 角77 金78 金49 銀67 銀38 桂89 桂29 香99 香19 歩76 歩66 歩16 歩97 歩87 歩57 歩47 歩37 歩27',
    castles: ['mino', 'yagura'], context: '対居飛車',
    desc: '飛車を8筋に振り、相手の飛車先(居飛車の2筋)と正面から向き合う振り飛車。飛車交換を迫る逆襲が骨子で、攻撃力は振り飛車の中で最も高いとされる。玉は主に美濃囲いに囲うが左金は攻めの駒として左翼に残すことが多い。',
    pros: [
      { t: '攻撃力が高く、居飛車に飛車交換を迫れる' },
      { t: '角道を止めても居飛車穴熊と互角以上に戦える' },
    ],
    cons: [
      { t: '互いの飛車が向き合うため飛車の素抜きに注意が必要' },
      { t: '左金を囲いに使えず玉が薄くなりやすい' },
    ],
    sources: [
      { ref: 'wj-mukaibisha', for: '配置・解説' },
      { ref: 'wj-furibisha', for: '解説' },
      { ref: 'we-ranging-rook', for: '解説' },
    ],
  },
  {
    id: 'sankenbisha', name: '三間飛車', reading: 'さんげんびしゃ',
    family: 'furibisha-rook', lead: { piece: '飛', files: [7], square: '78' },
    route: ['28', '78'],
    pieces: '玉28 飛78 角77 金58 金49 銀68 銀38 桂89 桂29 香99 香19 歩76 歩66 歩56 歩16 歩97 歩87 歩47 歩37 歩27',
    castles: ['mino', 'takamino', 'gincan', 'furianaguma'], context: '対居飛車',
    desc: '飛車を7筋に振る振り飛車(後手は3筋)。急戦に強く「先手三間飛車に急戦なし」の格言があり、角道を開けて7五歩と突く石田流にも組みやすい。持久戦にも急戦にも対応できる主力戦法。',
    pros: [
      { t: '急戦に強く攻め駒を活用しやすい' },
      { t: '石田流など角道を開けた攻撃的な形に発展できる' },
    ],
    cons: [
      { t: '穴熊から飛車が遠く、居飛車穴熊への対策が必要' },
      { t: '飛車の位置が玉から遠く、玉側の守りが薄くなりやすい' },
    ],
    sources: [
      { ref: 'wj-sankenbisha', for: '配置・解説' },
      { ref: 'wj-furibisha', for: '解説' },
      { ref: 'we-ranging-rook', for: '解説' },
    ],
  },
  {
    id: 'shikenbisha', name: '四間飛車', reading: 'しけんびしゃ',
    family: 'furibisha-rook', lead: { piece: '飛', files: [6], square: '68' },
    route: ['28', '68'],
    pieces: '玉28 飛68 角77 金58 金49 銀67 銀38 桂89 桂29 香99 香19 歩76 歩66 歩56 歩16 歩97 歩87 歩47 歩37 歩27',
    castles: ['mino', 'takamino', 'gincan', 'furianaguma'], context: '対居飛車',
    desc: '飛車を6筋に振る振り飛車(後手は4筋)。振り飛車の代表格で、バランスが良く守りの美濃囲いと相性が良い。藤井システムなどプロでも多くの派生がある。',
    pros: [
      { t: '玉と飛車のバランスが良く美濃囲いを組みやすい' },
      { t: '変化が豊富で定跡が整備されている' },
    ],
    cons: [
      { t: '居飛車穴熊やミレニアム囲い・急戦への対策が必要' },
      { t: '攻撃力は向かい飛車・三間飛車よりやや穏やか' },
    ],
    sources: [
      { ref: 'wj-shikenbisha', for: '配置・解説' },
      { ref: 'wj-furibisha', for: '解説' },
      { ref: 'we-ranging-rook', for: '解説' },
    ],
  },
  {
    id: 'nakabisha', name: '中飛車', reading: 'なかびしゃ',
    family: 'furibisha-rook', lead: { piece: '飛', files: [5], square: '58' },
    route: ['28', '58'],
    pieces: '玉28 飛58 角77 金78 金49 銀67 銀38 桂89 桂29 香99 香19 歩76 歩66 歩56 歩16 歩97 歩87 歩47 歩37 歩27',
    castles: ['katamino', 'mino'], context: '対居飛車',
    desc: '飛車を中央の5筋に振る戦法。歴史が古く初心者向けとされてきたが、ツノ銀中飛車・5筋位取り・ゴキゲン中飛車(後手向けの角道を止めない型、先手でも応用可)などへ発展。角・桂を活かせ、破壊力が高い。',
    pros: [
      { t: '角・桂を使いやすく破壊力が高い' },
      { t: '初心者にも指しやすく歴史が深い' },
    ],
    cons: [
      { t: '左金の活用が難しく囲いが片美濃など薄くなりがち' },
      { t: '相振り飛車では飛車と玉が近づき採用が少ない' },
    ],
    sources: [
      { ref: 'wj-nakabisha', for: '配置・解説' },
      { ref: 'wj-furibisha', for: '解説' },
      { ref: 'we-ranging-rook', for: '解説' },
    ],
  },
  {
    id: 'koshikakegin', name: '腰掛け銀', reading: 'こしかけぎん',
    family: 'ibisha-silver', lead: { piece: '銀', files: [5], square: '56' },
    route: ['39', '38', '47', '56'],
    pieces: '玉79 金78 金58 銀77 銀56 飛28 桂89 桂37 香99 香19 歩96 歩76 歩66 歩46 歩36 歩16 歩87 歩57 歩25',
    hand: '角',
    castles: ['yagura'], context: '角換わり、相掛かり、矢倉、対振り飛車(右四間飛車と併用)',
    desc: '先手なら▲5六銀と5七の歩の上に銀を構える形。角換わりと相性が良く、5筋の歩を突かない▲5七歩型が本手。攻守のバランスが良い。',
    pros: [
      { t: '攻防のバランスがよく本格派' },
      { t: '角換わりの本手で定跡が充実' },
    ],
    cons: [
      { t: '玉形があまり固くならず攻めの反動が大きい' },
      { t: '同型は研究が進み変化が限られる' },
    ],
    note: '経路の途中のマスは手順からの推定',
    sources: [
      { ref: 'wj-koshikakegin', for: '配置・解説' },
      { ref: 'we-reclining-silver', for: '解説' },
    ],
  },
  {
    id: 'hayakurigin', name: '早繰り銀', reading: 'はやくりぎん',
    family: 'ibisha-silver', lead: { piece: '銀', files: [4, 3], square: '46' },
    route: ['39', '38', '37', '46'],
    pieces: '玉69 金78 金49 銀77 銀46 角79 飛28 桂89 桂29 香99 香19 歩76 歩56 歩35 歩25 歩97 歩87 歩67 歩47 歩17',
    castles: ['yagura'], context: '相矢倉(急戦矢倉)、角換わり、相掛かり(中原流)、一手損角換わり対策',
    desc: '右銀を3七から4六に繰り出し、3筋の歩を突き捨てて▲3五歩・▲4六銀から攻める戦法。矢倉・角換わり・相掛かりで用いられる。',
    pros: [
      { t: '棒銀より銀が中央寄りで攻めの幅が広い' },
      { t: '一手損角換わりなど手の遅れた相手に効果的' },
    ],
    cons: [
      { t: '腰掛け銀に銀を追われやすい' },
      { t: '玉の囲いが薄くなりがち' },
    ],
    note: '経路の途中のマスは手順からの推定',
    sources: [
      { ref: 'wj-hayakurigin', for: '配置・解説' },
      { ref: 'we-rushing-silver', for: '解説' },
    ],
  },
  {
    id: 'bougin', name: '棒銀', reading: 'ぼうぎん',
    family: 'ibisha-silver', lead: { piece: '銀', files: [2], square: '26' },
    route: ['39', '38', '27', '26'],
    pieces: '玉78 金68 金58 銀57 銀26 角88 飛28 桂89 桂29 香99 香19 歩96 歩76 歩56 歩46 歩35 歩25 歩87 歩67 歩17',
    castles: ['funa', 'yagura'], context: '対振り飛車(特に四間飛車)、相居飛車(相掛かり/角換わり/矢倉)',
    desc: '右銀を3八・2七と進めて2六に据え、飛車と縦に並べて2筋から▲1五歩・▲3五歩などで攻める戦法。速攻性に優れ、振り飛車の角頭を狙う急戦の代表格。',
    pros: [
      { t: '速攻性が高く主導権を握りやすい' },
      { t: '狙いが明快で覚えやすい' },
    ],
    cons: [
      { t: '狙いが単純で受けられやすい' },
      { t: '銀が前線に残り捌き後に不利を招きやすい' },
    ],
    note: '経路の途中のマスは手順からの推定',
    sources: [
      { ref: 'wj-bougin', for: '配置・解説' },
      { ref: 'we-climbing-silver', for: '解説' },
    ],
  },
  {
    id: 'naka-ibisha', name: '矢倉中飛車', reading: 'やぐらなかびしゃ',
    family: 'ibisha-rook', lead: { piece: '飛', files: [5], square: '59' },
    route: ['28', '29', '59'],
    pieces: '玉69 金67 金78 銀77 銀48 角79 飛59 桂89 桂37 香99 香19 歩76 歩66 歩56 歩36 歩26 歩15 歩97 歩87 歩47',
    castles: ['yagura'], context: '相矢倉(急戦矢倉の一種)',
    desc: '矢倉戦から飛車を5筋に回して中央から動く急戦。居飛車に分類されるが主に後手番で用いられ、先手では稀。',
    pros: [
      { t: '矢倉の中央の薄さを衝ける' },
      { t: '攻撃力に優れる' },
    ],
    cons: [
      { t: '玉が薄く反撃を受けやすい' },
      { t: '先手番では採用例が少ない' },
    ],
    note: 'まれな戦法。居飛車で5筋に飛車を振る標準的な戦法はなく、主に後手が用いる。例は1982年の米長邦雄の先手番',
    sources: [
      { ref: 'wj-yagura-nakabisha', for: '配置・解説' },
      { ref: 'wj-gosuji-kuraidori', for: '解説' },
    ],
  },
  {
    id: 'migishiken', name: '右四間飛車', reading: 'みぎしけんびしゃ',
    family: 'ibisha-rook', lead: { piece: '飛', files: [4], square: '48' },
    route: ['28', '48'],
    pieces: '玉78 金69 金58 銀79 銀56 飛48 角88 桂89 桂37 香99 香19 歩96 歩76 歩46 歩36 歩26 歩87 歩67 歩57 歩17',
    castles: ['funa', 'kani', 'hidarimino', 'anaguma'], context: '対四間飛車、対矢倉(急戦矢倉)、角換わり腰掛け銀の変化',
    desc: '飛車を4筋に振り、腰掛け銀と併用して5六銀・4筋の歩と桂で攻める居飛車戦法。▲2五桂などの速攻が狙い。',
    pros: [
      { t: '攻撃力が非常に高い' },
      { t: '振り飛車穴熊などに囲い完成前に仕掛けられる' },
    ],
    cons: [
      { t: '攻めが単調になりやすい' },
      { t: '対策されると玉が薄く反撃に弱い' },
    ],
    sources: [
      { ref: 'wj-migishiken', for: '配置・解説' },
      { ref: 'we-right-fourth-file-rook', for: '解説' },
    ],
  },
  {
    id: 'sodebisha', name: '袖飛車', reading: 'そでびしゃ',
    family: 'ibisha-rook', lead: { piece: '飛', files: [3], square: '38' },
    route: ['28', '38'],
    pieces: '玉59 金69 金49 銀79 銀46 飛38 角88 桂89 桂29 香99 香19 歩76 歩66 歩56 歩36 歩97 歩87 歩47 歩27 歩17',
    castles: [], context: '対居飛車、対振り飛車(加藤流等)',
    desc: '飛車を3筋に一つ振る形。居飛車に分類され、振り飛車からの変化で現れることも多い。対居飛車では3六歩・4六銀から玉頭を攻める。',
    pros: [
      { t: '飛車が3筋で玉頭攻めに直結する' },
      { t: '囲いの完成を待たず戦える' },
    ],
    cons: [
      { t: '飛車が狭く捌きにくい' },
      { t: '現代では採用が少なく定跡が限られる' },
    ],
    sources: [
      { ref: 'wj-sodebisha', for: '配置・解説' },
      { ref: 'we-sleeve-rook', for: '解説' },
    ],
  },
  {
    id: 'ibisha-base', name: '居飛車（2筋）', reading: 'いびしゃ',
    family: 'ibisha-rook', lead: { piece: '飛', files: [2], square: '28' },
    route: ['28'],
    pieces: '玉59 飛28 角88 金69 金49 銀79 銀39 桂89 桂29 香99 香19 歩97 歩87 歩77 歩67 歩57 歩47 歩37 歩27 歩17',
    castles: ['yagura', 'funa', 'anaguma', 'hidarimino'], context: '相居飛車、対振り飛車',
    desc: '飛車を初期位置の2筋に据えて戦う基本の戦法分類。相居飛車では矢倉・角換わり・相掛かり・横歩取りなどに分かれる。',
    pros: [
      { t: '自然で理解しやすい駒組み' },
      { t: '戦型が豊富で幅広く対応できる' },
    ],
    cons: [
      { t: '覚える定跡が多い' },
      { t: '振り飛車の対策が必要' },
    ],
    sources: [
      { ref: 'wj-ibisha', for: '配置・解説' },
      { ref: 'we-static-rook', for: '解説' },
    ],
  },
];
