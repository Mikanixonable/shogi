// 戦型（senkei.js）: 相居飛車の将棋が分岐する「形」の実体データ。
// constraints.labels() が導出する id をキーに、解説・成立形・代表戦法・代表囲いを持つ。
//   - group: 'aiibisha'（相居飛車内の分岐。対抗形では発生しない）
//   - forms: 成立する駒組み・手順の概形
//   - tactics/castles: この戦型に属する・誘導する代表の戦法id・囲いid（補助表示用）
//   - aiyagura（相矢倉）は labels() のラベルidで、本体は yagura エントリ
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
};
// labels() のラベルid → SENKEI エントリid（相矢倉は矢倉に含める）
Kakoi.SENKEI_RESOLVE = { aiyagura: 'yagura' };
