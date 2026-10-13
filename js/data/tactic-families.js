// 戦法の周期表の行: 主役の駒と、それを置く筋で戦法を並べる
window.Kakoi = window.Kakoi || {};
Kakoi.TACTIC_FAMILIES = [
  { id: 'furibisha-rook', name: '振り飛車：飛車の筋', side: 'furibisha', piece: '飛' },
  { id: 'ibisha-silver', name: '居飛車：銀の筋', side: 'ibisha', piece: '銀' },
  { id: 'ibisha-rook', name: '居飛車：飛車の筋', side: 'ibisha', piece: '飛' },
  // 角・桂・歩を主役にする戦法を1行にまとめる（駒の区別はタイルのアイコンで。代表駒として角を置く）
  { id: 'ibisha-kakukeifu', name: '居飛車：角・桂・歩の筋', side: 'ibisha', piece: '角', mixed: true },
];
