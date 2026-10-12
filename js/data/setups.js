// 想定配置: 囲いと反対側の駒を戦型ごとに共通化し、囲い同士の比較で余計な差が出ないようにする
window.Kakoi = window.Kakoi || {};
Kakoi.SETUPS = {
  ibisha: {
    label: '居飛車（2五歩・2八飛）想定・比較用に統一',
    pieces: '香19 桂29 飛28 歩25 歩17',
    sources: [{ ref: 'joutatsu-bougin', for: '周辺の駒' }, { ref: 'wj-gangi', for: '周辺の駒' }],
  },
  furibisha: {
    label: '四間飛車（6八飛・7七角）想定・比較用に統一',
    pieces: '香99 桂89 角77 飛68 歩97 歩87 歩76 歩66 歩56',
    sources: [{ ref: 'wj-shikenbisha', for: '周辺の駒' }, { ref: 'we-fourth-file-rook', for: '周辺の駒' }],
  },
};
