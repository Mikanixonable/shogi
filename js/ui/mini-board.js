// ミニ盤: 玉側の隅を固定窓（6筋×4段）で切り出したSVG。lab/shogi と同じく歩の壁・
// 香・桂・角など周辺の駒ごと見せて囲いの「形」を読み取れるようにする（core は朱、
// それ以外は .off で薄く）。中住まい・右玉のように玉が中央寄りの囲いは、core 駒が
// 全て入るまで窓を筋方向にずらす（lab/shogi は切り捨てるが、こちらは形を欠かない
// ようずらす。ずれても窓の大きさは常に 6×4 で一定）。flip で180度回転した向きに
// できる（駒の字は正立のまま。窓も対角の隅に取る。相手の面用）
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';
  const W = 10, H = 11, COLS = 6, ROWS = 4, TOP_RANK = 6;

  /**
   * 切り出し窓（筋・段、含む両端。表示座標）。基本は玉側の隅の 6×4 固定。
   * @param {Kakoi.Position} position
   * @param {'ibisha'|'furibisha'} side 玉のいる側（居飛車囲い=筋9側、振り飛車囲い=筋1側）
   * @param {boolean} [flip] true なら 180度回転後の座標で求める（隅が対角に移る）
   * @returns {{f0:number, f1:number, r0:number, r1:number}}
   */
  function miniWindow(position, side, flip = false) {
    const anchorHigh = (side === 'ibisha') !== flip;   // 表示座標で玉側が筋9側にあるか
    let f0 = anchorHigh ? 9 - COLS + 1 : 1;
    const core = (position ? position.pieces : []).filter(x => x.role === 'core');
    if (core.length) {
      const fs = core.map(x => (flip ? 10 - x.f : x.f));
      const lo = Math.min(...fs), hi = Math.max(...fs);
      // 隅に寄せた既定の窓からはみ出す分だけずらす（6筋幅は変えない）
      if (anchorHigh) f0 = Math.max(1, Math.min(9 - COLS + 1, lo));
      else f0 = Math.min(9 - COLS + 1, Math.max(1, hi - COLS + 1));
    }
    const r0 = flip ? 1 : TOP_RANK;
    return { f0, f1: f0 + COLS - 1, r0, r1: r0 + ROWS - 1 };
  }

  /**
   * @param {Kakoi.Position} position
   * @param {'ibisha'|'furibisha'} side 玉のいる側（窓の基準）
   * @param {{ flip?:boolean }} [opts]
   *   flip: 位置だけ180度回転して描く（駒の字は正立。窓は対角の隅に取る）
   */
  function miniBoardSVG(position, side, opts = {}) {
    const { flip = false } = opts;
    const { f0, f1, r0, r1 } = miniWindow(position, side, flip);
    let s = `<svg viewBox="0 0 ${COLS * W} ${ROWS * H}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">`
          + `<rect class="mini-bg" width="${COLS * W}" height="${ROWS * H}" rx="1.5"/>`;
    for (let i = 1; i < COLS; i++) s += `<line class="mini-ln" x1="${i * W}" y1="0" x2="${i * W}" y2="${ROWS * H}"/>`;
    for (let j = 1; j < ROWS; j++) s += `<line class="mini-ln" x1="0" y1="${j * H}" x2="${COLS * W}" y2="${j * H}"/>`;
    for (let j = 0; j < ROWS; j++) for (let i = 0; i < COLS; i++) {
      // 左の列ほど筋が大きい（盤と同じ向き）。flip は描画位置だけ回転し、字は正立のまま
      let f = f1 - i, r = r0 + j;
      if (flip) { f = 10 - f; r = 10 - r; }
      const x = position.at(f, r);
      if (x) s += `<text class="mini-pc ${x.role === 'core' ? 'core' : 'off'}" x="${i * W + W / 2}" y="${j * H + H / 2 + .5}">${x.p}</text>`;
    }
    return s + '</svg>';
  }

  Kakoi.miniBoardSVG = miniBoardSVG;
  Kakoi.miniWindow = miniWindow;
})();
