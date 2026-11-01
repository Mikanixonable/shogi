// 想定配置: 囲いと反対側の駒を戦型ごとに共通化し、囲い同士の比較で余計な差が出ないようにする
window.Kakoi = window.Kakoi || {};
Kakoi.SETUPS = {
  ibisha: {
    label: '居飛車（2五歩・2八飛）想定・比較用に統一',
    pieces: '香19 桂29 飛28 歩25 歩17',
    sources: [{ ref: 'joutatsu-bougin', for: '周辺の駒' }, { ref: 'wj-gangi', for: '周辺の駒' }],
  },
  // 左桂が3七へ跳んだあとの居飛車（桂37は桂29からしか来られないので29は空く）。
  // 桂29を盤上に残すと桂89からは届かず、宣言局面が初期配置から到達不能になる
  ibisha37: {
    label: '居飛車（2五歩・2八飛、左桂は3七へ）想定・比較用に統一',
    pieces: '香19 飛28 歩25 歩17',
    sources: [{ ref: 'joutatsu-bougin', for: '周辺の駒' }, { ref: 'wj-gangi', for: '周辺の駒' }],
  },
  furibisha: {
    label: '四間飛車（6八飛・7七角）想定・比較用に統一',
    pieces: '香99 桂89 角77 飛68 歩97 歩87 歩76 歩66 歩56',
    sources: [{ ref: 'wj-shikenbisha', for: '周辺の駒' }, { ref: 'we-fourth-file-rook', for: '周辺の駒' }],
  },
  hirame: {
    label: '平目（5八飛・7七角）想定',
    pieces: '飛58 角77',
    sources: [{ ref: 'sj-hirame', for: '基本配置' }, { ref: 'wj-nakabisha', for: '中飛車' }],
  },
  empty: {
    label: '囲い側で全駒を指定',
    pieces: '',
  },
  // 角落ち上手（角を除いた1組）: missing の駒は全駒チェックの期待枚数から差し引く
  kakuochi: {
    label: '角落ち上手想定（角なし）',
    pieces: '',
    missing: '角',
  },
};
