// 駒の動きの単一定義への入口。テーブル本体は pieces.js が単一権威（成駒を含む）。
// piece-match の moveCount（届く判定）と attack-map（利き）が共有する。
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';
  const { STEPS, SLIDES, movesOf } = Kakoi.pieces;

  // {steps, rays} の併記で馬・龍も表せる
  const MOVES = {};
  for (const p of new Set([...Object.keys(STEPS), ...Object.keys(SLIDES)]))
    MOVES[p] = { steps: STEPS[p] || [], rays: SLIDES[p] || [] };

  Kakoi.pieceMoves = { MOVES, movesOf };
})();
