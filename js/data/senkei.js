// 戦型（senkei.js）: 将棋の対局が分岐する「形」の実体データ。
// constraints.senkeiLabels() が導出する id をキーに、解説・成立形・代表戦法・代表囲いを持つ。
//   - group: 大分類（'aiibisha' 相居飛車 / 'taikou' 対抗形 / 'aifuri' 相振り飛車 / 'rikisen' 力戦。SENKEI_GROUPS）
//   - axis: 対抗形の直交軸（'rook' 振り飛車の種類 / 'approach' 居飛車側の方針 / 'style' 振り飛車の型。
//     同じ軸の項目は排他、違う軸は併記できる。coverage-senkei-and-reading.md §2-2）
//   - parent: 小分類の親戦型 id（ai-naka → aifuri など。階層は最大3段）
//   - when: 宣言的な判定条件（まだ評価器は無い。データとして保持するのみ。§3-3）
//   - forms: 成立する駒組み・手順の概形
//   - tactics/castles: この戦型に属する・誘導する代表の戦法id・囲いid（補助表示用。
//     側別に分けるときは { ibisha:[…], furibisha:[…] } の形）
//   - aiyagura（相矢倉）は senkeiLabels() のラベルidで、本体は yagura エントリ
//     （内容が重複するため別エントリにしない。coverage-tactics.md §1-3）
window.Kakoi = window.Kakoi || {};
Kakoi.SENKEI = {
  kakugawari: {
    name: '角換わり', reading: 'かくがわり', short: '角換',
    group: 'aiibisha',
    desc: '序盤で角を交換してから駒組みを進める戦型。相矢倉より激しく相掛かりより穏やかとされる[[wj-kakugawari]]。右銀の使い方が急戦（棒銀・早繰り銀）と持久戦（腰掛け銀・右玉）を分かつ。',
    forms: '▲7七角△同角▲同銀（または一手損の△8八角成▲同銀）で角を交換',
    tactics: ['koshikakegin', 'bougin', 'hayakurigin', 'sujichigaikaku'],
    castles: ['yagura', 'bonanza', 'migigyoku', 'kani'],
    sources: [{ ref: 'wj-kakugawari', for: '解説' }],
  },
  aigakari: {
    name: '相掛かり', reading: 'あいがかり', short: '相掛',
    group: 'aiibisha',
    desc: 'お互いに飛車先の歩を伸ばして交換し、横歩は取らずに飛車を引いて駒組みを進める戦型[[wj-aigakari]]。腰掛け銀の持久戦と、相掛かり型の急戦に分かれる。',
    forms: '▲2六歩△8四歩▲2五歩△8五歩▲7八金△3二金▲2四歩△同歩▲同飛 で飛車先を突き合わせ',
    tactics: ['aigakari', 'tsukada-special'],
    castles: ['funa', 'ichigo'],
    sources: [{ ref: 'wj-aigakari', for: '解説' }],
  },
  yokofudori: {
    name: '横歩取り', reading: 'よこふどり', short: '横歩',
    group: 'aiibisha',
    desc: '飛車先を突き合わせたあと▲3四飛（△8二飛）と横歩を取る、大駒交換の激しい急戦戦型[[wj-yokofudori]]。後手の△3三角・△3三桂・△4五角などの応手で大きく変化が分かれる。',
    forms: '▲2四歩△同歩▲同飛△8八角成▲同銀△3四飛 で横歩を取る',
    tactics: ['yokofudori', 'aonoryu', 'yuukiryu'],
    castles: ['nakazumai'],
    sources: [{ ref: 'wj-yokofudori', for: '解説' }],
  },
  yagura: {
    name: '矢倉', reading: 'やぐら', short: '矢倉',
    aliases: ['相矢倉'],
    group: 'aiibisha',
    desc: '角を交換せずに駒組みを進め、お互いに矢倉囲い（やその変形）を目指す、四大戦法の筆頭とされる戦型[[wj-yagura]]。双方が矢倉に組むと相矢倉（本アプリのラベル「相矢倉」はこのエントリ）。急戦矢倉・24手組の駒組みから多様な戦法に分岐する。',
    forms: '▲7六歩〜▲6八銀〜▲7七銀の駒組みで、角道を開けずに銀を繰り出して組み進める',
    tactics: ['yagura-senpou', 'yagura37gin', 'yagura-37kei', 'waki-system', 'suzumezashi', 'morishita-system'],
    castles: ['yagura', 'ginyagura', 'doiyagura'],
    sources: [{ ref: 'wj-yagura', for: '解説' }],
  },
  gangi: {
    name: '雁木', reading: 'がんぎ', short: '雁木',
    group: 'aiibisha',
    desc: '左銀を6七に置く雁木囲いで戦う、2010年代以降に広まった相居飛車の新しい戦型[[wj-gangi]]。角道を開けたまま駒組みし、様々な局面から持ち込める。',
    forms: '▲6七銀（左銀）の形を作り、角道は開けたまま駒組みを進める',
    tactics: ['gangi-ibisha'],
    castles: ['gangi', 'tsunogin'],
    sources: [{ ref: 'wj-gangi', for: '解説' }],
  },
  // ---------- 対抗形：振り飛車の種類（axis: rook） ----------
  'taikou-shiken': {
    name: '対四間飛車', reading: 'たいしけんびしゃ', short: '対四間',
    group: 'taikou', axis: 'rook',
    desc: '振り飛車側が飛車を6筋（後手なら4筋）に振る対抗形[[wj-shikenbisha|wj-senpou]]。居飛車側は居飛車舟囲い急戦などの急戦と、左美濃・居飛車穴熊などの持久戦に分かれる[[wj-shikenbisha]]。2020年代に入ると、「先手四間飛車には居飛車後手急戦、後手四間飛車には居飛車先手持久戦」という区分も見られるようになった[[wj-shikenbisha]]。',
    forms: '居飛車は飛車を2筋に置いたまま、振り飛車は飛車を6筋へ振る（先手の場合）',
    tactics: { furibisha: ['shikenbisha', 'fujiisystem', 'kakukoukan-shiken'], ibisha: ['gin46-hidari', 'yamada-jouseki', 'saginomiya', 'bougin', 'migishiken'] },
    castles: { furibisha: ['mino', 'takamino', 'gincan'], ibisha: ['funa57gin', 'funa68gin', 'hidarimino', 'anaguma'] },
    when: { kind: 'taikou', furi: { rook: 6 } },
    sources: [{ ref: 'wj-shikenbisha', for: '解説' }, { ref: 'wj-senpou', for: '分類' }],
  },
  'taikou-sanken': {
    name: '対三間飛車', reading: 'たいさんげんびしゃ', short: '対三間',
    group: 'taikou', axis: 'rook',
    desc: '振り飛車側が飛車を7筋（後手なら3筋）に振る対抗形[[wj-sankenbisha]]。「先手三間飛車に急戦なし」の格言がある[[wj-sankenbisha]]。居飛車側は石田流対策を含む急戦や、居飛車穴熊などの持久戦を選ぶ[[wj-senpou|wj-sankenbisha]]。',
    forms: '居飛車は飛車を2筋に置いたまま、振り飛車は飛車を7筋へ振る（先手の場合）。角道を開けて7五歩を突くと石田流になる',
    tactics: { furibisha: ['sankenbisha', 'ishida', 'hayaisida', 'masuda-ishida', 'shin-ishida', 'tomahawk', 'nakata-xp'], ibisha: ['boukin', 'bougin'] },
    castles: { furibisha: ['mino', 'takamino', 'gincan', 'furianaguma'], ibisha: ['funa', 'anaguma'] },
    when: { kind: 'taikou', furi: { rook: 7 } },
    sources: [{ ref: 'wj-sankenbisha', for: '解説' }, { ref: 'wj-senpou', for: '分類' }],
  },
  'taikou-naka': {
    name: '対中飛車', reading: 'たいなかびしゃ', short: '対中',
    group: 'taikou', axis: 'rook',
    desc: '振り飛車側が飛車を5筋に振る対抗形[[wj-nakabisha]]。ゴキゲン中飛車が広まると、居飛車側に超速▲3七銀・丸山ワクチン・▲5八金右超急戦などの対策が積み重ねられた[[wj-gokigen|wj-chousoku37gin]]。5筋の飛車は振り飛車に分類されることが多いが、居飛車に分類される場合もある[[wj-senpou]]。',
    forms: '居飛車は飛車を2筋に置いたまま、振り飛車は飛車を5筋へ振る',
    tactics: { furibisha: ['nakabisha', 'gokigen', 'tsunogin-nakabisha', 'gosuji-kuraidori', 'kazaguruma', 'hirame-senpou'], ibisha: ['chousoku37gin'] },
    castles: { furibisha: ['katamino', 'mino'], ibisha: ['funa68gin'] },
    when: { kind: 'taikou', furi: { rook: 5 } },
    sources: [{ ref: 'wj-nakabisha', for: '解説' }, { ref: 'wj-gokigen', for: '対策' }, { ref: 'wj-chousoku37gin', for: '対策' }, { ref: 'wj-senpou', for: '分類' }],
  },
  'taikou-mukai': {
    name: '対向かい飛車', reading: 'たいむかいびしゃ', short: '対向',
    group: 'taikou', axis: 'rook',
    desc: '振り飛車側が飛車を8筋（後手なら2筋）に振り、居飛車の飛車先と向かい合う対抗形[[wj-mukaibisha]]。飛車交換を迫る逆襲が骨子で、攻撃力は振り飛車の中で最も高いとされる[[wj-mukaibisha|we-ranging-rook]]。角道を止めても居飛車穴熊と互角以上に戦えるとされ、居飛車側は急戦と持久戦に分かれる[[wj-mukaibisha|wj-senpou]]。',
    forms: '居飛車は飛車を2筋に置いたまま、振り飛車は飛車を8筋へ振る（互いの飛車先が向き合う）',
    tactics: { furibisha: ['mukaibisha', 'direct-mukaibisha'], ibisha: [] },
    castles: { furibisha: ['mino', 'katamino', 'furianaguma'], ibisha: ['anaguma'] },
    when: { kind: 'taikou', furi: { rook: 8 } },
    sources: [{ ref: 'wj-mukaibisha', for: '解説' }, { ref: 'we-ranging-rook', for: '解説' }, { ref: 'wj-senpou', for: '分類' }],
  },
  // ---------- 対抗形：居飛車側の方針（axis: approach）と振り飛車側の型（axis: style） ----------
  'kyusen': {
    name: '急戦', reading: 'きゅうせん', short: '急戦',
    group: 'taikou', axis: 'approach',
    desc: '守りに手数をかけず、早い段階から戦いを起こす作戦[[wj-shogi-yogo]]。居飛車側では居飛車舟囲い急戦（山田定跡など）が代表で、振り飛車側にも藤井システムや向かい飛車の急戦などがある[[wj-kyusen]]。相手が守りを固める前に攻められる利点がある一方、自分の囲いも固くならず短手数で終わることが多い[[wj-kyusen]]。持久戦との間に明確な基準はない[[wj-kyusen]]。',
    forms: '舟囲いのまま銀や飛車を繰り出して早く仕掛ける（居飛車舟囲い急戦。山田定跡など）',
    tactics: { ibisha: ['gin46-hidari', 'yamada-jouseki', 'saginomiya', 'shigofu-hayajikake', 'chousoku37gin', 'torisashi', 'bougin', 'migishiken'] },
    castles: { ibisha: ['funa', 'funa57gin', 'funa68gin'] },
    when: { kind: 'taikou', ibi: { pace: 'rapid' } },
    sources: [{ ref: 'wj-shogi-yogo', for: '定義' }, { ref: 'wj-kyusen', for: '解説' }],
  },
  'jikyusen': {
    name: '持久戦', reading: 'じきゅうせん', short: '持久',
    group: 'taikou', axis: 'approach',
    desc: 'お互いにすぐには攻めず、長い中盤戦が続く戦型[[wj-shogi-yogo]]。居飛車側の持久戦は、左美濃や居飛車穴熊など固い囲いを組んでから戦う形が代表[[wj-shikenbisha|wj-senpou]]。位取り・ミレニアム・飯島流引き角・地下鉄飛車なども持久戦用に挙げられる[[wj-senpou]]。',
    forms: '穴熊・左美濃などの固い囲いを完成させてから仕掛ける',
    tactics: { ibisha: ['iijima-hikikaku', 'gyokutou-kuraidori', 'ibisha-gosuji-kuraidori', 'chikatetsubisya'] },
    castles: { ibisha: ['anaguma', 'hidarimino', 'millennium', 'big4'] },
    when: { kind: 'taikou', ibi: { pace: 'slow', castleFamily: ['anaguma', 'mino'] } },
    sources: [{ ref: 'wj-shogi-yogo', for: '定義' }, { ref: 'wj-shikenbisha', for: '例' }, { ref: 'wj-senpou', for: '分類' }],
  },
  'kakukoukan-furi': {
    name: '角交換振り飛車', reading: 'かくこうかんふりびしゃ', short: '角交換',
    group: 'taikou', axis: 'style',
    desc: '振り飛車側が角道を止めず、または自分から角交換を行ったうえで駒組みを進める戦型[[wj-kakukoukan-furibisha]]。居飛車穴熊の台頭で振り飛車の勝率が下がり、藤井システムで盛り返したあと、ゴキゲン中飛車が「角道を止めずに攻める感覚」を生んだことが背景とされる[[wj-kakukoukan-furibisha]]。2017年の第58期王位戦で菅井竜也が菅井流角交換三間飛車を用いて初タイトルを獲得した、と同記事は記す[[wj-kakukoukan-furibisha]]。',
    forms: '振り飛車側の角道が開いたまま（または角交換後）に飛車を振る。飛車の筋とは別の軸',
    tactics: { furibisha: ['kakukoukan-shiken', 'direct-mukaibisha', 'hirame-senpou'] },
    castles: { furibisha: ['mino', 'katamino'] },
    when: { kind: 'taikou', tag: 'kakukoukan-furi' },
    note: '飛車の筋（axis: rook）とは直交する軸。Wikipedia は各振り飛車の「角交換型」、shogidata.info と shougi.jp は飛車の筋と並ぶ独立項目として扱う[[sj-kakukoukan-furibisya]]。相振り飛車にも現れる（Wikipedia 相振り飛車に「角交換相振り飛車の出現」の節）[[wj-aifuribisha]]。',
    sources: [{ ref: 'wj-kakukoukan-furibisha', for: '解説' }, { ref: 'sj-kakukoukan-furibisya', for: '解説' }, { ref: 'wj-aifuribisha', for: '関連' }],
  },
  // ---------- 相振り飛車 ----------
  'aifuri': {
    name: '相振り飛車', reading: 'あいふりびしゃ', short: '相振',
    group: 'aifuri',
    desc: '双方が振り飛車にする戦型[[wj-aifuribisha]]。従来は振り飛車党どうしなどの限定的な戦型だったが、近年は居飛車党の棋士も指すようになった[[wj-senpou]]。囲いは金無双・美濃・右矢倉・穴熊があり、相手の出方を見てから決めるのが基本とされる[[wj-aifuribisha]]。振り飛車の種類の強弱は「中飛車＜四間飛車＜三間飛車＜向かい飛車」と整理され、後手の向かい飛車は先手の振り飛車にとって強敵とされる[[wj-aifuribisha]]。',
    forms: '双方が飛車を2筋から他の筋へ振る。囲いは相手の出方を見てから決める',
    tactics: ['mukaibisha', 'sankenbisha', 'nakabisha', 'shikenbisha', 'kyukenbisha'],
    castles: ['kinmusou', 'migiyagura', 'mino', 'takamino', 'furianaguma'],
    when: { kind: 'aifuri' },
    sources: [{ ref: 'wj-aifuribisha', for: '解説' }, { ref: 'wj-senpou', for: '分類' }],
  },
  'ai-naka': {
    name: '相中飛車', reading: 'あいなかびしゃ', short: '相中',
    group: 'aifuri', parent: 'aifuri',
    desc: '両者が飛車を5筋に振る相振り飛車[[wj-aifuribisha]]。攻め口が少なく千日手になりやすいため、プロ棋戦ではまれで、アマチュア向けの色合いが強いとされる[[wj-aifuribisha]]。相美濃の囲いが中心で、角交換型や三間飛車への変化などがある[[wj-aifuribisha]]。',
    forms: '双方が飛車を5筋に振る',
    tactics: ['nakabisha'],
    castles: ['mino', 'katamino'],
    when: { kind: 'aifuri', both: { rook: 5 } },
    sources: [{ ref: 'wj-aifuribisha', for: '解説' }],
  },
  'ai-sanken': {
    name: '相三間飛車', reading: 'あいさんげんびしゃ', short: '相三間',
    group: 'aifuri', parent: 'aifuri',
    desc: '両者が飛車を7筋（後手は3筋）に振る相振り飛車[[wj-aifuribisha]]。2010年代から、角道を止めない相三間飛車が多く指されるようになった[[wj-aifuribisha]]。三間飛車には美濃囲いが相性がよいとされる[[wj-aifuribisha]]。',
    forms: '双方が飛車を三間（先手7筋・後手3筋）に振る',
    tactics: ['sankenbisha', 'ishida'],
    castles: ['mino', 'takamino'],
    when: { kind: 'aifuri', both: { rook: 7 } },
    sources: [{ ref: 'wj-aifuribisha', for: '解説' }],
  },
  // ---------- 力戦・転換 ----------
  'rikisen': {
    name: '力戦', reading: 'りきせん', short: '力戦',
    group: 'rikisen',
    desc: '定跡形から著しく外れた将棋[[wj-shogi-yogo]]。通常の戦型の分類に当てはまらない進行を見せる将棋を「力戦型」と呼ぶ[[wj-senpou]]。「力戦」の語は『史記』馮唐伝の用例に結びつけて説明される[[wj-rikisen]]。',
    forms: '相居飛車・対抗形・相振り飛車のどの戦型にも当たらない',
    tactics: [], castles: [],
    when: { kind: 'any', none: true },
    note: '本アプリでは「明示した戦法・囲いの組み合わせが、どの戦型にも当たらない」ときの受け皿。既定値だけの状態や、判定の根拠が足りないときは出さない。',
    sources: [{ ref: 'wj-shogi-yogo', for: '定義' }, { ref: 'wj-senpou', for: '分類' }, { ref: 'wj-rikisen', for: '語源' }],
  },
  'youdou-furi': {
    name: '陽動振り飛車', reading: 'ようどうふりびしゃ', short: '陽動',
    group: 'rikisen',
    desc: '相居飛車の出だしから、相手の出方を見て飛車を振る作戦[[wj-youdou-furibisha]]。広義には相居飛車模様から一方が振り飛車に転じる作戦の総称、狭義には相矢倉の出だしから主に後手が用いる作戦を指し、命名者は加藤治郎とされる[[wj-youdou-furibisha]]。相手が矢倉に囲うのを見届けてから振る狙いがあったが、矢倉の駒組みから居飛車穴熊にも組めるため効果は薄れ、現在はあまり指されない[[wj-youdou-furibisha]]。',
    forms: '居飛車の駒組みから途中で飛車を振る（途中経過を含む手順依存の戦型）',
    tactics: [], castles: ['yagura'],
    note: 'モデル適合△。盤は1局面なので「転換」は表せず、結果の形（振り飛車の戦法＋矢倉囲い）は囲いの side 不一致（compat の SIDE）で ng になる。解説専用エントリにとどめ、判定（when）は持たせない。',
    sources: [{ ref: 'wj-youdou-furibisha', for: '解説' }],
  },
};
// 大分類（coverage-senkei-and-reading.md §2-2）。kinds は matchup.threat().kind との対応
Kakoi.SENKEI_GROUPS = {
  aiibisha: {
    name: '相居飛車', short: '相居', kinds: ['aiibisha'],
    desc: '双方が居飛車の対局。飛車と角の使い方、相手の飛車先の受け方で矢倉・角換わり・相掛かり・横歩取りに分かれる[[wj-senpou]]。近年は雁木も独立した戦型として扱われる[[alsok-column3]]。',
    sources: [{ ref: 'wj-senpou', for: '分類' }, { ref: 'alsok-column3', for: '分類' }],
  },
  taikou: {
    name: '対抗形', short: '対抗', kinds: ['taikou-i', 'taikou-f'],
    desc: '一方が居飛車、他方が振り飛車の対局[[wj-shogi-yogo]]。振り飛車の飛車の筋（中飛車・四間飛車・三間飛車・向かい飛車）で分類し、居飛車側の対応は速攻の急戦と固い囲いを組む持久戦に大別される[[wj-senpou]]。',
    sources: [{ ref: 'wj-shogi-yogo', for: '定義' }, { ref: 'wj-senpou', for: '分類' }],
  },
  aifuri: {
    name: '相振り飛車', short: '相振', kinds: ['aifuri'],
    desc: '双方が振り飛車の対局[[wj-senpou]]。従来は限定的な戦型とされたが、近年は居飛車党の棋士も指すようになった[[wj-senpou]]。',
    sources: [{ ref: 'wj-senpou', for: '分類' }],
  },
  rikisen: {
    name: '力戦', short: '力戦', kinds: [],
    desc: '定跡形から著しく外れた将棋[[wj-shogi-yogo]]。どの戦型にも当たらない進行の受け皿で、積極的な戦型としては定義されない[[wj-senpou]]。',
    sources: [{ ref: 'wj-shogi-yogo', for: '定義' }, { ref: 'wj-senpou', for: '分類' }],
  },
};
// senkeiLabels() のラベルid → SENKEI エントリid（相矢倉は矢倉に含める）
Kakoi.SENKEI_RESOLVE = { aiyagura: 'yagura' };
