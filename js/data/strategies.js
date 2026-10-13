// 戦略: 居飛車/振り飛車の既定テンプレート。対局図で戦法・囲いが未選択のときの土台にする
// ※計画 §2-3 からの変更: furibisha.defaultCastle は文字列だったが、両戦略とも { vsIbisha, vsFuribisha } のオブジェクト形に統一した
window.Kakoi = window.Kakoi || {};
Kakoi.STRATEGIES = {
  ibisha: {
    label: '居飛車',
    desc: '飛車を初期位置の2筋（盤の右側）に据えたまま戦い、玉は反対側の左翼（7〜9筋）に囲う戦型。お互いが居飛車の相居飛車では矢倉・角換わり・相掛かり・横歩取り・雁木などに分かれ、振り飛車を相手にすると対抗形になる。',
    defaultTactic: 'ibisha-base',
    defaultCastle: { vsIbisha: 'yagura', vsFuribisha: 'funa' },
  },
  furibisha: {
    label: '振り飛車',
    desc: '飛車を初期位置の2筋から別の筋（5〜9筋や1筋）へ振り、玉を右翼（1〜3筋）に囲う戦型。美濃囲い系が土台で、四間飛車・三間飛車・中飛車・向かい飛車など振った筋がそのまま戦法名になる。相手も振り飛車なら相振り飛車になる。',
    defaultTactic: 'shikenbisha',
    defaultCastle: { vsIbisha: 'mino', vsFuribisha: 'mino' },
  },
};
