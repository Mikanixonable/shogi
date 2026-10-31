// 戦法の特徴の目安（右ドックのペンタグラム）。5段階・主観。囲いの ratings に当たるもので、
// tactics.js 本体は触らず、読み込み時に各戦法の ratings へ流し込む。
// 軸: attack 攻撃力 / speed 速さ（pace と矛盾させない: rapid=4〜5, both=3, slow=1〜2）/
//     flex 柔軟性（急戦・持久戦や相手の作戦への対応幅）/ safety 玉の安全 / easy 覚えやすさ
window.Kakoi = window.Kakoi || {};
Kakoi.TACTIC_RATING_KEYS = ['attack', 'speed', 'flex', 'safety', 'easy'];
(() => {
  const R = {
    // id: [attack, speed, flex, safety, easy]
    'kyukenbisha': [3, 4, 2, 3, 2],
    'mukaibisha': [5, 3, 3, 3, 3],
    'sankenbisha': [4, 3, 4, 3, 4],
    'ishida': [4, 3, 4, 3, 3],
    'hayaisida': [4, 5, 2, 2, 2],
    'masuda-ishida': [4, 2, 3, 3, 2],
    'tateishi': [4, 3, 2, 2, 2],
    'shin-ishida': [4, 5, 2, 2, 2],
    'shikenbisha': [3, 3, 4, 4, 4],
    'fujiisystem': [4, 5, 3, 1, 1],
    'kakukoukan-shiken': [3, 3, 3, 3, 3],
    'nakabisha': [4, 3, 3, 3, 4],
    'gokigen': [4, 4, 3, 3, 3],
    'tsunogin-nakabisha': [3, 2, 3, 4, 3],
    'gosuji-kuraidori': [3, 3, 2, 3, 2],
    'ikkenbisha': [2, 1, 1, 3, 2],
    'koshikakegin': [4, 2, 4, 4, 2],
    'hayakurigin': [4, 4, 3, 3, 3],
    'chousoku37gin': [4, 5, 3, 3, 3],
    'gin46-hidari': [4, 4, 2, 3, 2],
    'yamada-jouseki': [4, 4, 2, 3, 2],
    'kanikanigin': [3, 4, 2, 3, 3],
    'bougin': [4, 4, 2, 3, 5],
    'genshibougin': [3, 5, 1, 2, 5],
    'hineribisha': [3, 3, 3, 3, 2],
    'hineri-76hi': [3, 3, 2, 3, 2],
    'naka-ibisha': [4, 4, 2, 2, 2],
    'migishiken': [5, 4, 2, 3, 4],
    'sodebisha': [3, 4, 2, 3, 3],
    'saginomiya': [4, 4, 2, 3, 2],
    'ibisha-base': [3, 3, 4, 4, 5],
    'kinmino': [2, 1, 3, 4, 3],
    'suzumezashi': [4, 2, 2, 4, 2],
    'onigoroshi': [4, 4, 1, 2, 2],
    'sujichigaikaku': [3, 3, 3, 3, 2],
    'shigofu-hayajikake': [4, 4, 2, 2, 2],
    'ureshino': [4, 4, 2, 3, 2],
    'shin-ureshino': [4, 4, 2, 3, 2],
    'maid-system': [3, 3, 3, 3, 2],
    'torisashi': [4, 4, 1, 2, 2],
    'iijima-hikikaku': [3, 2, 3, 4, 2],
    'morishita-system': [3, 2, 3, 4, 3],
  };
  const keys = Kakoi.TACTIC_RATING_KEYS;
  for (const t of Kakoi.TACTICS || []) {
    const v = R[t.id];
    if (v) t.ratings = Object.fromEntries(keys.map((k, i) => [k, v[i]]));
  }
})();
