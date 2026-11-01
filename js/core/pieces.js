// 駒の動きの単一権威（coverage-tesuji §5-1・§5-6）: 通常駒と成駒（1字の 馬・龍・全・杏・圭・と）を
// 1か所にまとめる。piece-moves.js の MOVES・core/tesuji.js の reach・core/tesuji-check.js の
// 検算器がすべてここから引く。
//   [df, dr] は盤座標の増減（dr<0 が先手の前進）。後手は上下左右を反転して使う
//   「竜」はデータ読み込み時に「龍」へ正規化する（parseSide / validate 側の約束）
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';

  // 成りの対応。取った成駒は元の駒（BASE）として持ち駒に入る
  const PROMOTED = { 歩: 'と', 香: '杏', 桂: '圭', 銀: '全', 角: '馬', 飛: '龍' };
  const BASE = Object.fromEntries(Object.entries(PROMOTED).map(([a, b]) => [b, a]));
  // 成駒の字（竜は正規化して龍に畳む）と、持ち駒になり得る駒（玉・成駒は含まない）
  const PROM_CHARS = 'と杏圭全馬龍';
  const HAND_CHARS = '歩香桂銀金角飛';

  const GOLD = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [0, 1]];
  const KING = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];
  const DIAG = [[-1, -1], [1, -1], [-1, 1], [1, 1]], ORTH = [[0, -1], [0, 1], [-1, 0], [1, 0]];

  const STEPS = {
    玉: KING,
    金: GOLD, と: GOLD, 杏: GOLD, 圭: GOLD, 全: GOLD,
    銀: [[-1, -1], [0, -1], [1, -1], [-1, 1], [1, 1]],
    桂: [[-1, -2], [1, -2]],
    歩: [[0, -1]],
    馬: ORTH,   // 馬 = 角の滑走 + 玉の縦横
    龍: DIAG,   // 龍 = 飛の滑走 + 玉の斜め
  };
  const SLIDES = {
    香: [[0, -1]],
    飛: ORTH,
    角: DIAG,
    馬: DIAG,
    龍: ORTH,
  };

  /** 駒 p の動き（{steps, rays}。piece-moves.js の movesOf と同じ形）。
   *  未登録の駒は金の動きごとフォールバック（香・角のように滑走だけ持つ駒に金の歩みは足さない） */
  const movesOf = p => (STEPS[p] || SLIDES[p]
    ? { steps: STEPS[p] || [], rays: SLIDES[p] || [] }
    : { steps: STEPS['金'], rays: [] });

  Kakoi.pieces = { PROMOTED, BASE, PROM_CHARS, HAND_CHARS, STEPS, SLIDES, movesOf };
})();
