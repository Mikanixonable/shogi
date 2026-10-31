// 振り飛車の囲い
// core: 囲いを構成する駒 / shell+filler+rest: 補助の駒（setup と合わせて先手の全駒になる）
//   shell: 囲いの形として意味がある歩（城壁の前線）。戦法と合成するときもそのまま置く
//   rest:  core に含まれない守り駒（金・銀）の置き場所。合成のとき優先して置く
//   filler: 比較用に揃えた駒（初期位置の香・桂、盤外扱いの駒）。合成のときは置かない
// from: 発展元の囲い（この囲いはそこから駒を動かして組む）。詳細に「発展元・発展先」として出す
// flex: 戦法に貸し出せる core の駒と行き先（崩し形になる）
// pros・cons の sq は盤上で示すマス、attacks の gote は後手の駒、target は狙われるマス
window.Kakoi = window.Kakoi || {};
Kakoi.CASTLES = Kakoi.CASTLES || [];
Kakoi.CASTLES.push(
  {
    id: 'mino', name: '美濃囲い（本美濃）', short: '本美濃', reading: 'みのがこい', side: 'furibisha', from: 'katamino', family: 'mino', subtype: 'hon', setup: 'furibisha', basic: true,
    core: '玉28 銀38 金49 金58',
    shell: '歩16 歩27 歩37 歩47',
    rest: '銀67',
    filler: '香19 桂29',
    tags: ['対居飛車', '基本の囲い'],
    desc: '振り飛車の代表的な囲い[[wj-mino|we-mino]]。玉を2八、右銀を3八、左金を5八へ動かし、4九金と合わせて組む[[wj-mino|we-mino|we-fourth-file-rook]]。少ない手数で横からの攻めに強く、高美濃・銀冠へ発展できる[[wj-mino]]。',
    ratings: { hard: 3, wide: 3, top: 2, side: 4, quick: 4 },
    pros: [
      { t: '手数が少なく、堅さとのバランスがよい[[wj-mino]]' },
      { t: '金銀が斜めにつながり、横（飛車）からの攻めに強い[[wj-mino|we-mino]]', sq: ['58', '49', '38'] },
      { t: '高美濃・銀冠へ発展できる[[wj-mino]]' },
    ],
    cons: [
      { t: '上部（玉頭）からの攻めに弱い[[wj-mino|we-mino]]', sq: ['27', '26', '37'] },
      { t: '端攻め（1筋）に注意[[wj-mino]]', sq: ['16', '17'] },
    ],
    attacks: [
      { id: 'hashi', name: '端攻め', t: '△1五歩と端を突き、香や桂を足して1筋から玉に迫る[[wj-mino]]。', gote: '歩15 香11 桂33', target: ['16', '17'] },
      { id: 'gyokuto', name: '玉頭攻め', t: '△2五歩・△3五銀のように、玉の真上（2筋・3筋）の2六・3六に駒を集めて押しつぶしにくる[[wj-mino]]。', gote: '歩25 銀35', target: ['26', '27', '36'] },
    ],
    sources: [
      { ref: 'wj-mino', for: '配置・解説' },
      { ref: 'we-mino', for: '配置・解説' },
      { ref: 'we-fourth-file-rook', for: '配置' },
    ],
  },
  {
    id: 'katamino', name: '片美濃囲い', short: '片美濃', reading: 'かたみのがこい', side: 'furibisha', family: 'mino', subtype: 'kata', setup: 'furibisha',
    core: '玉28 銀38 金49',
    shell: '歩16 歩27 歩37 歩47',
    rest: '銀67 金69',
    filler: '香19 桂29',
    tags: ['対居飛車', '急戦向き'],
    desc: '本美濃から左金（5八）を除いた形[[wj-mino|we-mino]]。左金は最後に動かす駒なので、本美濃に組む途中でもこの形になる[[wj-mino]]。左金を攻めや中央の守りに使いたいときや、中飛車で5八に飛車がいるときに現れる[[wj-mino]]。',
    note: '左金は出典の図では盤外扱いのため、初期位置の6九に置いている。',
    ratings: { hard: 2, wide: 3, top: 2, side: 3, quick: 5 },
    pros: [
      { t: 'さらに少ない手数で組める[[wj-mino]]' },
      { t: '左金を攻めや中央の守りに使える[[wj-mino]]', sq: ['69'] },
    ],
    cons: [
      { t: '5八が空いていて、中央・横からの攻めに弱い[[wj-mino]]', sq: ['58', '48', '59'] },
      { t: '本美濃より薄い' },
    ],
    attacks: [
      { id: 'center', name: '5八への打ち込み', t: '5八が空いているので、△5七銀のような打ち込みで5八・4八と飛車をまとめて狙われる。', gote: '銀57', target: ['58', '48', '68'] },
    ],
    sources: [
      { ref: 'wj-mino', for: '配置・解説' },
      { ref: 'we-mino', for: '配置・解説' },
    ],
  },
  {
    id: 'takamino', name: '高美濃囲い', short: '高美濃', reading: 'たかみのがこい', side: 'furibisha', from: 'mino', family: 'mino', subtype: 'taka', setup: 'furibisha',
    core: '玉28 銀38 金47 金49',
    shell: '歩16 歩27 歩37 歩46',
    rest: '銀67',
    filler: '香19 桂29',
    tags: ['対居飛車', '持久戦'],
    desc: '本美濃から4六歩と突き、左金を4七へ上げた形[[wj-mino|we-mino]]。上部への守りが厚くなり、玉頭や4筋・3筋からの攻めに強くなる[[wj-mino]]。銀冠へ組み替える途中の形でもある[[wj-mino]]。',
    ratings: { hard: 3, wide: 4, top: 4, side: 3, quick: 3 },
    pros: [
      { t: '本美濃より上部に強い[[wj-mino]]', sq: ['47', '37', '36'] },
      { t: '4七金が4筋・5筋を見張る', sq: ['47', '46', '56'] },
    ],
    cons: [
      { t: '5八が空き、横からの攻めは本美濃よりやや弱い[[wj-mino]]', sq: ['58', '48'] },
    ],
    attacks: [
      { id: 'side', name: '横からの飛車打ち', t: '△5九飛のように下段へ打ち込まれると、5八が空いているので4九金を横から狙われる。', gote: '飛59', target: ['49', '58'] },
    ],
    sources: [
      { ref: 'wj-mino', for: '配置・解説' },
      { ref: 'we-mino', for: '配置・解説' },
    ],
  },
  {
    id: 'gincan', name: '銀冠', short: '銀冠', reading: 'ぎんかんむり', side: 'furibisha', from: 'takamino', family: 'mino', subtype: 'gincan', setup: 'furibisha',
    core: '玉28 銀27 金38 金47',
    shell: '歩16 歩26 歩37 歩46',
    rest: '銀67',
    filler: '香19 桂29',
    tags: ['対居飛車', '持久戦', '上部に強い'],
    desc: '高美濃から2六歩と突き、3八銀を2七へ上げて、空いた3八に金を寄せた形[[wj-mino|we-mino]]。玉の頭に銀がかぶさり「冠」のように見える[[wj-mino]]。3七桂と跳ねる形もある[[wj-mino]]。',
    ratings: { hard: 4, wide: 5, top: 5, side: 3, quick: 2 },
    pros: [
      { t: '玉頭（上部）からの攻めにとても強い[[wj-mino|we-mino]]', sq: ['27', '26', '17'] },
      { t: '玉が広く、上へ逃げやすい[[wj-mino]]', sq: ['17', '18'] },
    ],
    cons: [
      { t: '組むのに手数がかかる' },
      { t: '下段（4九〜6九）が薄く、横からの攻めに注意[[wj-mino]]', sq: ['49', '59', '69'] },
    ],
    attacks: [
      { id: 'dan', name: '下段への飛車打ち', t: '△5九飛のように下段へ打ち込まれると、桂・香と玉の下が狙われる。', gote: '飛59', target: ['49', '39', '29'] },
    ],
    sources: [
      { ref: 'wj-mino', for: '配置・解説' },
      { ref: 'we-mino', for: '配置・解説' },
    ],
  },
  {
    id: 'diamond', name: 'ダイヤモンド美濃', short: 'ダイヤモンド美濃', reading: 'だいやもんどみの', side: 'furibisha', from: 'mino', family: 'mino', subtype: 'ginmino', setup: 'furibisha',
    core: '玉28 銀38 金49 金58 銀47',
    shell: '歩16 歩27 歩36 歩46',
    filler: '香19 桂29',
    tags: ['対居飛車', '持久戦', '金銀4枚'],
    desc: '本美濃に左銀を4七まで持ってきて、金銀4枚で守る形（銀美濃の一種）[[wj-mino|we-mino]]。駒の並びがダイヤモンドの形になる[[wj-mino]]。堅いが、攻めに使える駒が減る[[wj-mino]]。',
    ratings: { hard: 5, wide: 3, top: 4, side: 4, quick: 2 },
    pros: [
      { t: '金銀4枚でとても堅い[[wj-mino]]', sq: ['38', '47', '49', '58'] },
      { t: '上部・横どちらにも強い' },
    ],
    cons: [
      { t: '左銀を守りに使うので、攻めの駒が少なくなる' },
      { t: '組むのに手数がかかる' },
    ],
    attacks: [
      { id: 'hashi', name: '端攻め', t: '金銀が中央寄りに集まる分、1筋の端攻めが残る弱点になる。', gote: '歩15 香11 桂33', target: ['16', '17'] },
    ],
    sources: [
      { ref: 'wj-mino', for: '配置・解説' },
      { ref: 'we-mino', for: '配置' },
    ],
  },
  {
    id: 'furianaguma', name: '振り飛車穴熊', short: '振り飛車穴熊', reading: 'ふりびしゃあなぐま', side: 'furibisha', family: 'anaguma', subtype: 'sanmai', setup: 'furibisha', basic: true,
    core: '玉19 香18 桂29 銀28 金39 金38',
    shell: '歩17 歩27 歩36',
    rest: '銀67',
    filler: '歩47',
    tags: ['対居飛車', '持久戦', '堅さ最強クラス'],
    desc: '居飛車穴熊の左右反転形[[wj-furibisha-anaguma]]。1九の香を1八に上げ、空いた1九に玉を入れて、2八銀・3九金・3八金で固める[[wj-furibisha-anaguma|we-castle]]。王手がかかりにくく、振り飛車の攻めを最後まで通しやすい[[wj-furibisha-anaguma|wj-anaguma]]。',
    ratings: { hard: 5, wide: 1, top: 3, side: 5, quick: 1 },
    pros: [
      { t: '王手がかかりにくく、終盤の攻め合いに強い[[wj-furibisha-anaguma|wj-anaguma]]', sq: ['19', '18', '29', '28'] },
      { t: '金銀がくっついて崩れにくい[[wj-furibisha-anaguma]]', sq: ['28', '38', '39'] },
    ],
    cons: [
      { t: '組むのに手数がかかる' },
      { t: '端攻め（1筋）に弱く、崩れると逃げ場がない[[wj-furibisha-anaguma|wj-anaguma]]', sq: ['17', '18', '19'] },
    ],
    attacks: [
      { id: 'hashi', name: '端攻め', t: '△1五歩から端を突き捨て、香・桂を足して1筋を破る。穴熊の代表的な攻略法[[wj-anaguma]]。', gote: '歩15 香11 桂33', target: ['17', '18', '19'] },
    ],
    sources: [
      { ref: 'wj-furibisha-anaguma', for: '配置・解説' },
      { ref: 'wj-anaguma', for: '解説' },
      { ref: 'we-castle', for: '配置' },
    ],
  },
  {
    id: 'ginkananaguma', name: '銀冠穴熊', short: '銀冠穴熊', reading: 'ぎんかんあなぐま', side: 'furibisha', from: 'furianaguma', family: 'anaguma', subtype: 'ginkan', setup: 'furibisha',
    core: '玉19 香18 桂29 銀27 金38 金47',
    shell: '歩17 歩26 歩36 歩46',
    rest: '銀67',
    filler: '',
    tags: ['対居飛車', '持久戦', '堅さ最強クラス'],
    desc: '振り飛車穴熊の前面を銀冠型（銀2七・金3八・金4七）にした形[[wj-furibisha-anaguma]]。玉頭に銀がかぶさるため上部からの攻めに強く、穴熊の堅さと銀冠の上部耐性を併せ持つ[[wj-furibisha-anaguma|wj-anaguma]]。',
    ratings: { hard: 5, wide: 4, top: 5, side: 5, quick: 1 },
    pros: [
      { t: '上部・横ともに最強クラスの堅さ', sq: ['27', '38', '47', '19'] },
      { t: '王手がかかりにくい穴熊構造', sq: ['19', '18', '29'] },
    ],
    cons: [
      { t: '金銀をすべて囲いに使うので手数がかかり、攻め駒も少ない' },
      { t: '端攻め（1筋）が残る弱点', sq: ['17', '18', '19'] },
    ],
    attacks: [
      { id: 'hashi', name: '端攻め', t: '△1五歩から端を突き捨て、香・桂を足して1筋を破る。', gote: '歩15 香11 桂33', target: ['17', '18', '19'] },
    ],
    sources: [
      { ref: 'wj-furibisha-anaguma', for: '配置・解説' },
      { ref: 'wj-anaguma', for: '解説' },
    ],
  },
  {
    id: 'kimuramino', name: '木村美濃', short: '木村美濃', reading: 'きむらみの', side: 'furibisha', family: 'mino', subtype: 'kata', setup: 'furibisha',
    core: '玉28 金38 銀47',
    shell: '歩16 歩27 歩37 歩46',
    rest: '金69 銀67',
    filler: '香19 桂29',
    tags: ['対居飛車', '中飛車', '急戦向き'],
    desc: '玉2八・金3八・銀4七の3枚で組む簡易な美濃[[wj-kimuramino|sj-kimuramino]]。木村義雄十四世名人が中飛車で好んで用いたことに由来する[[wj-kimuramino|wj-nakabisha]]。左金を使わないため、5筋に飛車のいる中飛車の陣形と両立しやすい[[wj-kimuramino|wj-nakabisha]]。',
    ratings: { hard: 2, wide: 3, top: 3, side: 3, quick: 4 },
    pros: [
      { t: '少ない手数で組め、中飛車の陣形と両立する[[wj-kimuramino|wj-nakabisha]]', sq: ['28', '38', '47'] },
      { t: '左金を攻めや中央の守りに回せる', sq: ['49', '59'] },
    ],
    cons: [
      { t: '金1枚なので本美濃より薄い', sq: ['38', '48'] },
      { t: '端攻め（1筋）と玉頭への注意は他の美濃と同じ', sq: ['16', '27'] },
    ],
    attacks: [
      { id: 'gyokuto', name: '玉頭攻め', t: '△2五歩・△3五銀などで2六・3六へ押さえにくる。', gote: '歩25 銀35', target: ['26', '27', '36'] },
    ],
    sources: [
      { ref: 'wj-kimuramino', for: '配置・解説' },
      { ref: 'sj-kimuramino', for: '配置・解説' },
      { ref: 'wj-nakabisha', for: '組み合わせ' },
    ],
  },
  {
    id: 'kinmusou', name: '金無双', short: '金無双', reading: 'きんむそう', side: 'furibisha', family: 'kinmusou', setup: 'furibisha', basic: true,
    core: '玉38 銀28 金48 金58',
    shell: '歩16 歩27 歩37 歩47',
    rest: '銀67',
    filler: '香19 桂29',
    tags: ['相振り飛車', '持久戦'],
    desc: '相振り飛車の代表的な囲い[[wj-kinmusou|sj-kinmusou]]。金4八・金5八と金2枚を横に並べ（「金無双」）、玉3八・銀2八で固める[[wj-kinmusou|sj-kinmusou]]。横からの攻めに強く、上部への備えもある[[wj-kinmusou]]。',
    ratings: { hard: 4, wide: 3, top: 3, side: 4, quick: 2 },
    pros: [
      { t: '金2枚が横に並び、飛車など横からの攻めに強い[[wj-kinmusou|sj-kinmusou]]', sq: ['48', '58', '59'] },
      { t: '相振り飛車で互いの玉が近い筋同士でも対応しやすい' },
    ],
    cons: [
      { t: '玉頭（3筋・2筋の上部）はやや薄い', sq: ['37', '27', '26'] },
      { t: '金を2枚とも守りに使うので攻めの駒が減る' },
    ],
    attacks: [
      { id: 'gyokuto', name: '玉頭攻め', t: '△3五歩・△2五歩のように玉の真上の3筋・2筋を突いてくる。', gote: '歩35 歩25', target: ['36', '37', '26', '27'] },
    ],
    sources: [
      { ref: 'wj-kinmusou', for: '配置・解説' },
      { ref: 'sj-kinmusou', for: '配置・解説' },
    ],
  },
  {
    id: 'migiyagura', name: '右矢倉', short: '右矢倉', reading: 'みぎやぐら', side: 'furibisha', family: 'yagura', subtype: 'migi', setup: 'furibisha',
    core: '玉28 銀37 金38 金47',
    shell: '歩17 歩27 歩36 歩46',
    rest: '銀67',
    filler: '香19 桂29',
    tags: ['相振り飛車', '持久戦'],
    desc: '金矢倉を左右反転して右辺に組む形で、主に相振り飛車で使われる[[wj-migiyagura|sj-migiyagura]]。玉2八を銀3七・金3八・金4七で囲い、上部への厚みは矢倉譲り[[wj-migiyagura|wj-yagura]]。',
    ratings: { hard: 4, wide: 2, top: 5, side: 3, quick: 2 },
    pros: [
      { t: '上部からの攻めに強い（矢倉と同じ構造）[[wj-migiyagura|wj-yagura]]', sq: ['37', '47', '36', '46'] },
      { t: '金銀3枚がまとまりバランスがよい', sq: ['37', '38', '47'] },
    ],
    cons: [
      { t: '組むのに手数がかかる' },
      { t: '端攻め（1筋）に注意', sq: ['17', '18'] },
    ],
    attacks: [
      { id: 'hashi', name: '端攻め', t: '△1五歩から端を突き、香・桂・角で1筋の玉のコビンを狙う。', gote: '歩15 香11 桂33', target: ['17', '18', '27'] },
    ],
    sources: [
      { ref: 'wj-migiyagura', for: '配置・解説' },
      { ref: 'sj-migiyagura', for: '配置・解説' },
      { ref: 'wj-yagura', for: '解説' },
    ],
  },
);
