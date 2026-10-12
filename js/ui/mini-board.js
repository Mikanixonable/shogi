// ミニ盤: 玉側の6筋×六〜九段を切り出したSVG
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';
  const W = 10, H = 11, COLS = 6, ROWS = 4, TOP_RANK = 6;

  /** @param {Kakoi.Position} position @param {'ibisha'|'furibisha'} side */
  function miniBoardSVG(position, side) {
    const leftFile = side === 'furibisha' ? 6 : 9;
    let s = `<svg viewBox="0 0 ${COLS * W} ${ROWS * H}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">`
          + `<rect class="mini-bg" width="${COLS * W}" height="${ROWS * H}" rx="1.5"/>`;
    for (let i = 1; i < COLS; i++) s += `<line class="mini-ln" x1="${i * W}" y1="0" x2="${i * W}" y2="${ROWS * H}"/>`;
    for (let j = 1; j < ROWS; j++) s += `<line class="mini-ln" x1="0" y1="${j * H}" x2="${COLS * W}" y2="${j * H}"/>`;
    for (let j = 0; j < ROWS; j++) for (let i = 0; i < COLS; i++) {
      const x = position.at(leftFile - i, TOP_RANK + j);
      if (x) s += `<text class="mini-pc ${x.role === 'core' ? 'core' : 'off'}" x="${i * W + W / 2}" y="${j * H + H / 2 + .5}">${x.p}</text>`;
    }
    return s + '</svg>';
  }

  Kakoi.miniBoardSVG = miniBoardSVG;
})();
