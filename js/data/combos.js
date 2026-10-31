// 定番セット: 戦法と囲いの組み合わせのうち、ひとまとまりで呼ばれる・覚える形
// tactic/castle の両方を明示で選ぶと「完成」になる（既定値で補った層は数えない）
// named: その組み合わせ自体が名前で呼ばれる（false は「戦法＋囲い」の基本の組み合わせ）
// vs: 想定する相手（任意）。プリセットで相手も並べるときに使う
// 組み合わせの根拠は戦法の pairings（level: best）と同じ出典を引く
window.Kakoi = window.Kakoi || {};
Kakoi.COMBOS = [
  {
    id: 'migishiken-hidarimino', name: '右四間飛車左美濃', reading: 'みぎしけんびしゃひだりみの', named: true,
    tactic: 'migishiken', castle: 'hidarimino',
    vs: { tactic: 'shikenbisha', castle: 'mino' },
    desc: '右四間飛車の攻めに、左美濃で玉側を固めた組み合わせ。攻めに駒を回しても玉が薄くなりにくい[[wj-migishiken|wj-hidarimino]]。主に四間飛車を相手に用いる[[wj-migishiken]]。',
    sources: [{ ref: 'wj-migishiken', for: '組み合わせ' }, { ref: 'wj-hidarimino', for: '組み合わせ' }],
  },
  {
    id: 'migishiken-kani', name: 'カニ囲い右四間飛車', reading: 'かにがこいみぎしけんびしゃ', named: true,
    tactic: 'migishiken', castle: 'kani',
    desc: 'カニ囲いに組んで右四間飛車で攻める組み合わせ[[jsf-kakoi87|wj-migishiken]]。',
    sources: [{ ref: 'jsf-kakoi87', for: '組み合わせ' }, { ref: 'wj-migishiken', for: '組み合わせ' }],
  },
  {
    id: 'yagura-bougin', name: '矢倉棒銀', reading: 'やぐらぼうぎん', named: true,
    tactic: 'bougin', castle: 'yagura',
    desc: '相居飛車で矢倉に囲い、棒銀で攻める組み合わせ[[joutatsu-bougin|wj-yagura]]。',
    sources: [{ ref: 'joutatsu-bougin', for: '組み合わせ' }, { ref: 'wj-yagura', for: '組み合わせ' }],
  },
  {
    id: 'shiken-anaguma', name: '四間飛車穴熊', reading: 'しけんびしゃあなぐま', named: true,
    tactic: 'shikenbisha', castle: 'furianaguma',
    desc: '四間飛車に振り、玉を穴熊に囲う持久戦の組み合わせ[[wj-furibisha-anaguma|wj-shikenbisha]]。',
    sources: [{ ref: 'wj-furibisha-anaguma', for: '組み合わせ' }, { ref: 'wj-shikenbisha', for: '組み合わせ' }],
  },
  {
    id: 'sanken-anaguma', name: '三間飛車穴熊', reading: 'さんげんびしゃあなぐま', named: true,
    tactic: 'sankenbisha', castle: 'furianaguma',
    desc: '三間飛車に振り、玉を穴熊に囲う持久戦の組み合わせ[[wj-furibisha-anaguma|wj-sankenbisha]]。',
    sources: [{ ref: 'wj-furibisha-anaguma', for: '組み合わせ' }, { ref: 'wj-sankenbisha', for: '組み合わせ' }],
  },
  {
    id: 'shiken-mino', name: '四間飛車＋美濃囲い', reading: 'しけんびしゃ みのがこい', basic: true,
    tactic: 'shikenbisha', castle: 'mino',
    desc: '振り飛車の基本の組み合わせ。飛車を4筋に振り、玉は反対側の美濃囲いに囲う[[wj-shikenbisha|wj-mino]]。',
    sources: [{ ref: 'wj-shikenbisha', for: '組み合わせ' }, { ref: 'wj-mino', for: '組み合わせ' }],
  },
  {
    id: 'bougin-funa', name: '棒銀＋舟囲い', reading: 'ぼうぎん ふながこい', basic: true,
    tactic: 'bougin', castle: 'funa',
    desc: '対振り飛車の急戦の定番。舟囲いで手早く囲い、棒銀で攻める[[joutatsu-bougin|wj-bougin]]。',
    sources: [{ ref: 'joutatsu-bougin', for: '組み合わせ' }, { ref: 'wj-bougin', for: '組み合わせ' }],
  },
];
