// 利き: 先手の駒が各マスに何枚利いているかを数える
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';

  // 先手から見た方向（dr<0 が前）。sliding は盤端か駒にぶつかるまで進む
  const STEPS = {
    玉: [[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]],
    金: [[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[0,1]],
    銀: [[-1,-1],[0,-1],[1,-1],[-1,1],[1,1]],
    桂: [[-1,-2],[1,-2]],
    歩: [[0,-1]],
  };
  const SLIDES = {
    香: [[0,-1]],
    飛: [[0,-1],[0,1],[-1,0],[1,0]],
    角: [[-1,-1],[1,-1],[-1,1],[1,1]],
  };
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
      // df は盤上の右方向。先手から見た右は筋が減る方向
      for (const [df, dr] of STEPS[x.p] || []) {
        const f = x.f - df, r = x.r + dr;
        if (inBoard(f, r)) counts[f][r]++;
      }
      for (const [df, dr] of SLIDES[x.p] || []) {
        for (let f = x.f - df, r = x.r + dr; inBoard(f, r); f -= df, r += dr) {
          counts[f][r]++;
          if (position.has(f, r)) break;
        }
      }
    }
    return counts;
  }

  Kakoi.attackMap = attackMap;
})();
