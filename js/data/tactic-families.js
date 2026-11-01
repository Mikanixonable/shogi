// 戦法の駒棚の行: 主役の駒ごとに1行。行は正直に lead.piece で分ける
// （旧「角・桂・歩の筋」は解体。label はドックの行見出し、name は注記・タグ用の正式名）
// note: その駒が主役になる理由（系統見出しのツールチップと戦法の解説に出す）
window.Kakoi = window.Kakoi || {};
Kakoi.TACTIC_FAMILIES = [
  { id: 'furibisha-rook', name: '振り飛車：飛車の筋', label: '飛の筋', side: 'furibisha', piece: '飛', note: '飛車を左へ振って攻めの筋を決め、玉は反対の右側へ寄せて囲う' },
  { id: 'furibisha-silver', name: '振り飛車：銀の筋', label: '銀の筋', side: 'furibisha', piece: '銀', note: '銀を左右に開いて形を整える持久戦型。飛車の位置とは別の層として選べる' },
  { id: 'furibisha-kaku', name: '振り飛車：角の筋', label: '角の筋', side: 'furibisha', piece: '角', note: '角道を止めず（6六歩を突かず）角を自陣に生かして戦う' },
  { id: 'furibisha-fu', name: '振り飛車：歩の筋', label: '歩の筋', side: 'furibisha', piece: '歩', note: '位取りや筋の突きで形を決める指し方' },
  { id: 'furibisha-kin', name: '振り飛車：金の筋', label: '金の筋', side: 'furibisha', piece: '金', note: '金の置き方で陣形の輪郭を決める' },
  { id: 'furibisha-gyoku', name: '振り飛車：玉の筋', label: '玉の筋', side: 'furibisha', piece: '玉', note: '玉を囲いに収めず早めに定位置へ進める構え' },
  { id: 'ibisha-rook', name: '居飛車：飛車の筋', label: '飛の筋', side: 'ibisha', piece: '飛' },
  { id: 'ibisha-silver', name: '居飛車：銀の筋', label: '銀の筋', side: 'ibisha', piece: '銀', note: '桂は前にしか進めず戻れない消耗品なので、早く跳ねるのは非常時に限られる。攻めの駒は後退もできる銀を繰り出すのが正攻法で、銀をどの筋に進めるかで戦法が分かれる' },
  { id: 'ibisha-kaku', name: '居飛車：角の筋', label: '角の筋', side: 'ibisha', piece: '角' },
  { id: 'ibisha-kei', name: '居飛車：桂の筋', label: '桂の筋', side: 'ibisha', piece: '桂' },
  { id: 'ibisha-fu', name: '居飛車：歩の筋', label: '歩の筋', side: 'ibisha', piece: '歩' },
  { id: 'ibisha-kin', name: '居飛車：金の筋', label: '金の筋', side: 'ibisha', piece: '金' },
  { id: 'ibisha-gyoku', name: '居飛車：玉の筋', label: '玉の筋', side: 'ibisha', piece: '玉' },
];
