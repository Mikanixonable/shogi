// お楽しみのコンテンツ（将棋の言葉・出来事）。図鑑の「お楽しみ」タブの項になる。
// 実在の愛称・言葉・出来事で、発言者・場面・由来を出典で確認できたものだけを載せる。
// 内容は表示だけで制約には関係しない。
// 各項目は id・t・n・sources: [{ ref, for }]（sources.js の id）を必ず持つ。出典を示せない項目は足さない
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';

  const memes = [
    { id: 'hifumin', t: 'ひふみん', reading: 'ひふみん',
      n: '加藤一二三九段の愛称。2017年のユーキャン新語・流行語大賞でトップテンに選ばれた',
      sources: [{ ref: 'wj-kato-hifumi', for: '愛称' }, { ref: 'mdpr-ryuko2017', for: 'トップテン' }] },
    { id: 'hifumin-eye', t: 'ひふみんアイ', reading: 'ひふみんアイ',
      n: '相手の側から盤面を見ること。加藤一二三九段が、相手が席を外した間に相手の席から盤を見て、王将戦で好手を見つけた経験にちなむ',
      sources: [{ ref: 'wj-kato-hifumi', for: '由来' }, { ref: 'daily-hifumi-eye', for: '意味' }] },
    { id: 'kousoku-77', t: '7七の地点が光って見えた', reading: 'ななななのちてんがひかってみえた',
      n: '谷川浩司九段の言葉。平成8年（1996年）の竜王戦第2局で羽生善治を相手に指した△7七桂を、公式戦の中で最高の一手と言えるかもしれないと振り返った。この手は「光速の寄せ」と評された',
      sources: [{ ref: 'jsf-tanigawa-77', for: '発言' }, { ref: 'wj-tanigawa', for: '「光速の寄せ」' }] },
    { id: 'ippo-ryuou', t: '一歩竜王', reading: 'いっぷりゅうおう',
      n: '先崎学が書いた観戦記のタイトル（将棋世界2001年3月号）。第13期竜王戦第7局（藤井猛竜王と羽生善治五冠）で、盤上の一歩が勝敗を決めた局面を描いた',
      sources: [{ ref: 'jsf-ryuou-ippo', for: '観戦記' }, { ref: 'wj-kakugen', for: '「一歩千金」の項' }] },
    { id: 'renshou29', t: '29連勝', reading: 'にじゅうきゅうれんしょう',
      n: '2017年に藤井聡太四段（当時）が達成した連勝。同年のユーキャン新語・流行語大賞で選考委員特別賞に選ばれた',
      sources: [{ ref: 'mdpr-ryuko2017', for: '特別賞' }, { ref: 'daily-hifumi-eye', for: '29連勝の対局に言及' }] },
  ];

  Kakoi.FUN = { memes };
})();
