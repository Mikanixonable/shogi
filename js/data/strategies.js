// 戦略: 居飛車/振り飛車の既定テンプレート。対局図で戦法・囲いが未選択のときの土台にする
// kingWing: 玉を囲う翼（居飛車は左＝7〜9筋、振り飛車は右＝1〜3筋。「玉飛接近すべからず」）
// ※計画 §2-3 からの変更: furibisha.defaultCastle は文字列だったが、両戦略とも { vsIbisha, vsFuribisha } のオブジェクト形に統一した
window.Kakoi = window.Kakoi || {};
Kakoi.STRATEGIES = {
  ibisha: {
    label: '居飛車', kingWing: 'left',
    defaultTactic: 'ibisha-base',
    defaultCastle: { vsIbisha: 'yagura', vsFuribisha: 'funa' },
  },
  furibisha: {
    label: '振り飛車', kingWing: 'right',
    defaultTactic: 'shikenbisha',
    defaultCastle: { vsIbisha: 'mino', vsFuribisha: 'mino' },
  },
};
