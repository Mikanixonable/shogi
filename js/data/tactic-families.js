// 戦法の駒棚の行: 主役の駒ごとに1行。行は正直に lead.piece で分ける
// （旧「角・桂・歩の筋」は解体。label はドックの行見出し、name は注記・タグ用の正式名）
// note: その駒が主役になる理由（系統見出しのツールチップと戦法の解説に出す）
window.Kakoi = window.Kakoi || {};
Kakoi.TACTIC_FAMILIES = [
  { id: 'furibisha-rook', name: '振り飛車：飛車の筋', label: '飛の筋', side: 'furibisha', piece: '飛', note: '飛車を左へ振って攻めの筋を決め、玉は反対の右側へ寄せて囲う' },
  { id: 'ibisha-rook', name: '居飛車：飛車の筋', label: '飛の筋', side: 'ibisha', piece: '飛' },
  { id: 'ibisha-silver', name: '居飛車：銀の筋', label: '銀の筋', side: 'ibisha', piece: '銀', note: '桂は前にしか進めず戻れない消耗品なので、早く跳ねるのは非常時に限られる。攻めの駒は後退もできる銀を繰り出すのが正攻法で、銀をどの筋に進めるかで戦法が分かれる' },
  { id: 'ibisha-kaku', name: '居飛車：角の筋', label: '角の筋', side: 'ibisha', piece: '角' },
  { id: 'ibisha-kei', name: '居飛車：桂の筋', label: '桂の筋', side: 'ibisha', piece: '桂' },
  { id: 'ibisha-fu', name: '居飛車：歩の筋', label: '歩の筋', side: 'ibisha', piece: '歩' },
  { id: 'ibisha-kin', name: '居飛車：金の筋', label: '金の筋', side: 'ibisha', piece: '金' },
  { id: 'ibisha-gyoku', name: '居飛車：玉の筋', label: '玉の筋', side: 'ibisha', piece: '玉' },
];
