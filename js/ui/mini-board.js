// ミニ盤: 玉側の6筋×六〜九段、または玉・金・銀の外接矩形で切り出したSVG。
// crop:'king-golds-silvers' は計画書 §4-4 — role==='core' の玉・金・銀の外接矩形へ
// タイトに切り出す（余白も正方形化もしない。範囲内の他駒は .off で薄く）。
// flip で180度回転した向きにできる（駒の字は正立のまま。相手の面用）。タイル間の
// 比較を保つ共通倍率は呼び側が miniCropBox で箱の大きさを取り、要素の幅で調節する（Q3）
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';
  const W = 10, H = 11, COLS = 6, ROWS = 4, TOP_RANK = 6;
  const KGS = new Set(['玉', '金', '銀']);

  /**
   * 玉・金・銀（role==='core'）の外接矩形をそのまま返す（クローズアップ: 余白・正方形化なし）。
   * @param {Kakoi.Position} position
   * @param {boolean} [flip] true なら 180度回転後の座標で求める
   * @returns {?{f0:number, f1:number, r0:number, r1:number, cols:number, rows:number}} 筋・段の範囲（含む両端）
   */
  function miniCropBox(position, flip = false) {
    const pts = (position ? position.pieces : [])
      .filter(x => x.role === 'core' && KGS.has(x.p))
      .map(x => (flip ? { f: 10 - x.f, r: 10 - x.r } : x));
    if (!pts.length) return null;
    let f0 = 9, f1 = 1, r0 = 9, r1 = 1;
    for (const p of pts) {
      if (p.f < f0) f0 = p.f;
      if (p.f > f1) f1 = p.f;
      if (p.r < r0) r0 = p.r;
      if (p.r > r1) r1 = p.r;
    }
    return { f0, f1, r0, r1, cols: f1 - f0 + 1, rows: r1 - r0 + 1 };
  }

  /**
   * @param {Kakoi.Position} position
   * @param {'ibisha'|'furibisha'} side 既定の切り出し（crop なし）で玉側の筋を選ぶ基準
   * @param {{ crop?:'king-golds-silvers', flip?:boolean, box?:?object }} [opts]
   *   crop: 玉・金・銀の外接矩形で切り出す。box（miniCropBox の戻り値）を渡すとその範囲を使う
   *   flip: 位置だけ180度回転して描く（駒の字は正立。crop のとき box も回転後の座標で渡す）
   */
  function miniBoardSVG(position, side, opts = {}) {
    const { crop = null, flip = false, box = null } = opts;
    let f0, f1, r0, r1;
    const kb = crop === 'king-golds-silvers' ? (box || miniCropBox(position, flip)) : null;
    if (kb) ({ f0, f1, r0, r1 } = kb);
    else if (side === 'furibisha') { f0 = 1; f1 = 6; r0 = TOP_RANK; r1 = TOP_RANK + ROWS - 1; }
    else { f0 = 9 - COLS + 1; f1 = 9; r0 = TOP_RANK; r1 = TOP_RANK + ROWS - 1; }
    const cols = f1 - f0 + 1, rows = r1 - r0 + 1;
    let s = `<svg viewBox="0 0 ${cols * W} ${rows * H}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">`
          + `<rect class="mini-bg" width="${cols * W}" height="${rows * H}" rx="1.5"/>`;
    for (let i = 1; i < cols; i++) s += `<line class="mini-ln" x1="${i * W}" y1="0" x2="${i * W}" y2="${rows * H}"/>`;
    for (let j = 1; j < rows; j++) s += `<line class="mini-ln" x1="0" y1="${j * H}" x2="${cols * W}" y2="${j * H}"/>`;
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      // 左の列ほど筋が大きい（盤と同じ向き）。flip は描画位置だけ回転し、字は正立のまま
      let f = f1 - i, r = r0 + j;
      if (flip) { f = 10 - f; r = 10 - r; }
      const x = position.at(f, r);
      if (x) s += `<text class="mini-pc ${x.role === 'core' ? 'core' : 'off'}" x="${i * W + W / 2}" y="${j * H + H / 2 + .5}">${x.p}</text>`;
    }
    return s + '</svg>';
  }

  Kakoi.miniBoardSVG = miniBoardSVG;
  Kakoi.miniCropBox = miniCropBox;
})();
