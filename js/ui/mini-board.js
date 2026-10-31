// ミニ盤: 囲いの駒（core）だけを切り出した記号的なSVG。窓は core 駒の外接矩形を
// 最小 5筋×3段まで広げたもの（足りない分は端・自陣の奥へ広げる）なので、玉と金銀が
// 大きく読める。幅を全囲いで揃えるため筋は 5 以上。core は駒の字（玉は朱の駒形に白抜き）、
// それ以外の駒は小さな点にして「そこに駒がある」ことだけを示す。
// flip で180度回転した向きにできる（駒の字は正立のまま。相手の面用）
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';
  const W = 10, H = 11, MIN_COLS = 5, MIN_ROWS = 3;
  const { mirrorPt } = Kakoi.notation;

  /**
   * 切り出し窓（筋・段、含む両端。表示座標）。core 駒の外接矩形を最小 5筋×3段まで広げる。
   * 筋は玉側の端へ、段は自陣の奥へ先に広げ、盤の外に出る分は反対側へ回す。
   * @param {Kakoi.Position} position
   * @param {'ibisha'|'furibisha'} side 玉のいる側（居飛車囲い=筋9側、振り飛車囲い=筋1側）
   * @param {boolean} [flip] true なら 180度回転後の座標で求める（隅が対角に移る）
   * @returns {{f0:number, f1:number, r0:number, r1:number}}
   */
  function miniWindow(position, side, flip = false) {
    const edgeHigh = (side === 'ibisha') !== flip;   // 表示座標で玉側が筋9側にあるか
    const backHigh = !flip;                          // 表示座標で自陣の奥が段9側にあるか
    const core = (position ? position.pieces : []).filter(x => x.role === 'core')
      .map(x => (flip ? mirrorPt(x) : x));
    // core が無ければ玉側の隅
    let f0, f1, r0, r1;
    if (core.length) {
      const fs = core.map(x => x.f), rs = core.map(x => x.r);
      [f0, f1, r0, r1] = [Math.min(...fs), Math.max(...fs), Math.min(...rs), Math.max(...rs)];
    } else {
      [f0, f1] = edgeHigh ? [9, 9] : [1, 1];
      [r0, r1] = backHigh ? [9, 9] : [1, 1];
    }
    // [lo, hi] を n 以上に広げる。toHigh なら hi 側を先に伸ばし、盤（1..9）の外へ出る分は反対側へ
    const grow = (lo, hi, n, toHigh) => {
      let extra = Math.max(0, n - (hi - lo + 1));
      if (toHigh) { const d = Math.min(extra, 9 - hi); hi += d; lo -= extra - d; }
      else { const d = Math.min(extra, lo - 1); lo -= d; hi += extra - d; }
      return [lo, hi];
    };
    [f0, f1] = grow(f0, f1, MIN_COLS, edgeHigh);
    [r0, r1] = grow(r0, r1, MIN_ROWS, backHigh);
    return { f0, f1, r0, r1 };
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
    const cols = f1 - f0 + 1, rows = r1 - r0 + 1;
    let s = `<svg viewBox="0 0 ${cols * W} ${rows * H}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">`
          + `<rect class="mini-bg" width="${cols * W}" height="${rows * H}" rx="1.5"/>`;
    for (let i = 1; i < cols; i++) s += `<line class="mini-ln" x1="${i * W}" y1="0" x2="${i * W}" y2="${rows * H}"/>`;
    for (let j = 1; j < rows; j++) s += `<line class="mini-ln" x1="0" y1="${j * H}" x2="${cols * W}" y2="${j * H}"/>`;
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      // 左の列ほど筋が大きい（盤と同じ向き）。flip は描画位置だけ回転し、字は正立のまま
      let f = f1 - i, r = r0 + j;
      if (flip) ({ f, r } = mirrorPt({ f, r }));
      const x = position.at(f, r);
      if (!x) continue;
      const cx = i * W + W / 2, cy = j * H + H / 2;
      if (x.role !== 'core') { s += `<circle class="mini-dot" cx="${cx}" cy="${cy}" r="1.3"/>`; continue; }
      if (x.p === '玉') s += `<path class="mini-k" d="M${cx} ${cy - 5.1} L${cx + 4.2} ${cy - 3} ` +
        `L${cx + 5} ${cy + 5.1} L${cx - 5} ${cy + 5.1} L${cx - 4.2} ${cy - 3} Z"/>`;   // 朱の駒形（五角形）
      s += `<text class="mini-pc core${x.p === '玉' ? ' k' : ''}" x="${cx}" y="${cy + .5}">${x.p}</text>`;
    }
    return s + '</svg>';
  }

  Kakoi.miniBoardSVG = miniBoardSVG;
  Kakoi.miniWindow = miniWindow;
  // 窓の描画アスペクト（幅÷高さ）。タイル幅をサムネの描画幅に合わせる用（dock-grids の --ar）
  Kakoi.miniAspect = w => (w.f1 - w.f0 + 1) * W / ((w.r1 - w.r0 + 1) * H);
})();
