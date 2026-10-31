// 囲いの系統: 形による分類（このアプリ独自の分類。文献上の「系統」とは一致しないことがある）
window.Kakoi = window.Kakoi || {};
Kakoi.CASTLE_FAMILIES = [
  { id: 'funa', name: '舟囲い型', shape: '玉が7八。金銀が玉の横から下へ広がる', glyph: 'funa', subtypes: [
    { id: 'base', name: '基本形（7九銀・6八銀・5七銀）' }, { id: 'kin79', name: '7九金型' }, { id: 'kin68', name: '6八金型' },
    { id: 'hako', name: '箱入り娘' },
  ] },
  { id: 'yagura', name: '矢倉型', shape: '逆L字：玉の右上を金銀が囲む', glyph: 'L', subtypes: [
    { id: 'kin', name: '金矢倉' }, { id: 'gin', name: '銀矢倉' }, { id: 'kata', name: '片矢倉系' },
    { id: 'doi', name: '土居矢倉' }, { id: 'kikusui', name: '菊水（一段玉・桂7七）' }, { id: 'millennium', name: 'ミレニアム（一段玉・金銀4枚）' },
    { id: 'migi', name: '右矢倉（右辺の反転形）' },
    { id: 'sou', name: '総矢倉（右銀5七）' }, { id: 'gindachi', name: '銀立ち矢倉（銀7六）' },
    { id: 'hishi', name: '菱矢倉（右銀6六）' }, { id: 'hekomi', name: 'へこみ矢倉' },
    { id: 'fujimi', name: '富士見矢倉（5筋位取り）' }, { id: 'nagare', name: '流れ矢倉' },
    { id: 'ryusen', name: '流線矢倉' }, { id: 'kaku', name: '角矢倉' },
  ] },
  { id: 'gangi', name: '雁木型', shape: '銀が玉の前や横に並んで壁を作る形。前へ出れば逆V字', glyph: 'V', subtypes: [
    { id: 'nimai', name: '二枚銀' }, { id: 'tsuno', name: 'ツノ銀' }, { id: 'heiretsu', name: '並列（横一列）' }, { id: 'hidarimae', name: '左前に銀' },
  ] },
  { id: 'anaguma', name: '穴熊型', shape: '玉を隅にもぐらせ、香で蓋をする', glyph: 'corner', subtypes: [
    { id: 'sanmai', name: '金銀3枚（本穴熊）' }, { id: 'yonmai', name: '金銀4枚（松尾流・ビッグ4など）' },
    { id: 'ginkan', name: '銀冠型（玉頭に冠の銀）' }, { id: 'yaguramae', name: '前面が矢倉の形' },
    { id: 'kushikatsu', name: '串カツ（9八玉・9九香）' },
  ] },
  { id: 'mino', name: '美濃型', shape: '玉・銀・金が斜めにつながる', glyph: 'diag', subtypes: [
    { id: 'kata', name: '片美濃' }, { id: 'hon', name: '本美濃' }, { id: 'taka', name: '高美濃' }, { id: 'gincan', name: '銀冠' }, { id: 'ginmino', name: '銀美濃系' },
    { id: 'tenshu', name: '天守閣（8七玉）' }, { id: 'chonmage', name: 'ちょんまげ美濃（2六歩）' },
    { id: 'bouzu', name: '坊主美濃（玉頭歩なし）' },
  ] },
  { id: 'itidan', name: '一段玉型', shape: '玉が8九に座り（隅の一段内側）、銀・桂が上を覆う', glyph: 'under', subtypes: [] },
  { id: 'nakazumai', name: '中住まい型', shape: '玉が5〜6筋の中央に留まり、金銀が周囲に低く並ぶ', glyph: 'center', subtypes: [] },
  { id: 'chudan', name: '中段玉型', shape: '玉を自陣寄りの中段（主に6段目）に上げる珍形。総称で固定形は複数ある', glyph: 'center', subtypes: [] },
  { id: 'kinmusou', name: '金無双型', shape: '金2枚が横に並び、玉と銀がその前に座る（相振りの右辺）', glyph: 'bars', subtypes: [] },
  { id: 'migigyoku', name: '右玉型', shape: '玉を飛車側の右辺へ寄せ、金銀が左と正面を囲む', glyph: 'migi', subtypes: [] },
  { id: 'quick', name: '簡易囲い型', shape: '玉の移動や少数の金銀で短手数にまとめる形', glyph: 'center', subtypes: [
    { id: 'hayagakoi', name: '早囲い・壁囲い' }, { id: 'sante', name: '三手囲い' },
    { id: 'ichigo', name: 'いちご囲い' }, { id: 'saikyou', name: '最強囲い' }, { id: 'ahiru', name: 'アヒル囲い' },
  ] },
  { id: 'low', name: '低陣型', shape: '玉と金銀を低く広げて大駒の打ち込みを減らす形', glyph: 'center', subtypes: [
    { id: 'hirame', name: '平目' },
  ] },
];
