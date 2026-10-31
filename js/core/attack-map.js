// 利き: 先手の駒が各マスに何枚利いているかを数える
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';

  // 動きの定義は piece-moves.js が単一権威。[df, dr] は盤座標の増減（dr<0 が前）。
  // sliding（rays）は盤端か駒にぶつかるまで進む
  const { movesOf } = Kakoi.pieceMoves;
  const inBoard = (f, r) => f >= 1 && f <= 9 && r >= 1 && r <= 9;

  /**
   * @param {Kakoi.Position} position
   * @param {(piece) => boolean} include 数える駒の条件
   * @returns {number[][]} counts[f][r]
   */
  function attackMap(position, include) {
    const counts = Array.from({ length: 10 }, () => Array(10).fill(0));
    for (const x of position.pieces) {
      if (x.owner !== 'sente' || !include(x)) continue;
      const mv = movesOf(x.p);
      for (const [df, dr] of mv.steps || []) {
        const f = x.f + df, r = x.r + dr;
        if (inBoard(f, r)) counts[f][r]++;
      }
      for (const [df, dr] of mv.rays || []) {
        for (let f = x.f + df, r = x.r + dr; inBoard(f, r); f += df, r += dr) {
          counts[f][r]++;
          if (position.has(f, r)) break;
        }
      }
    }
    return counts;
  }

  Kakoi.attackMap = attackMap;
})();
