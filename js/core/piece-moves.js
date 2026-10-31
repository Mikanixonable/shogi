// 駒の動きの単一定義（先手視点。[df, dr] は筋・段の増減で dr<0 が前進）
// piece-match の moveCount（届く判定）と attack-map（利き）が共有するテーブル。
// 成駒を足すときもここだけに定義する（{steps, rays} の併記で馬・竜も表せる）
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';
  const GOLD = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [0, 1]];
  const KING = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];
  const MOVES = {
    歩: { steps: [[0, -1]] },
    香: { rays: [[0, -1]] },
    桂: { steps: [[-1, -2], [1, -2]] },
    銀: { steps: [[-1, -1], [0, -1], [1, -1], [-1, 1], [1, 1]] },
    金: { steps: GOLD },
    玉: { steps: KING },
    角: { rays: [[-1, -1], [1, -1], [-1, 1], [1, 1]] },
    飛: { rays: [[0, -1], [0, 1], [-1, 0], [1, 0]] },
  };

  /** 駒 p の動き（{steps:[], rays:[]}）。未登録の駒は金の動きにフォールバック */
  const movesOf = p => MOVES[p] || MOVES['金'];

  Kakoi.pieceMoves = { MOVES, movesOf };
})();
