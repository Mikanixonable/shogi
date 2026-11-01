// ミニ盤: 記号的なSVGの図。core 駒の外接矩形を最小 5筋×3段まで広げた窓で切り出す
// （足りない分は端・自陣の奥へ広げる）ので、玉と金銀が大きく読める。幅を全囲いで
// 揃えるため筋は 5 以上。字で描く駒（玉は朱の駒形に白抜き）以外は小さな点にして
// 「そこに駒がある」ことだけを示す。
//   - miniBoardSVG: 囲いのタイル（左ドック）と記事頭の図に使う配置図
//   - moveBoardSVG: 戦法の記事頭の図。主役の駒の経路と必須の駒を含む窓で切り出し、
//     経路を破線の矢印で示す。必須・主役の駒は字（主役は --tc の系統色）、他は点
// flip で180度回転した向きにできる（駒の字は正立のまま。相手の面用）
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';
  const W = 10, H = 11, MIN_COLS = 5, MIN_ROWS = 3, M = 7;   // M: 座標の余白（動き図）
  const { mirrorPt, mirrorSq, parseSquare, parsePieces, ZEN, KAN } = Kakoi.notation;

  // [lo, hi] を n 以上に広げる。toHigh なら hi 側を先に伸ばし、盤（1..9）の外へ出る分は反対側へ
  const grow = (lo, hi, n, toHigh) => {
    let extra = Math.max(0, n - (hi - lo + 1));
    if (toHigh) { const d = Math.min(extra, 9 - hi); hi += d; lo -= extra - d; }
    else { const d = Math.min(extra, lo - 1); lo -= d; hi += extra - d; }
    return [lo, hi];
  };

  // 玉の駒形（朱の五角形。字は白抜きにする）
  const kingD = (cx, cy) => `M${cx} ${cy - 5.1} L${cx + 4.2} ${cy - 3} ` +
    `L${cx + 5} ${cy + 5.1} L${cx - 5} ${cy + 5.1} L${cx - 4.2} ${cy - 3} Z`;

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
    [f0, f1] = grow(f0, f1, MIN_COLS, edgeHigh);
    [r0, r1] = grow(r0, r1, MIN_ROWS, backHigh);
    return { f0, f1, r0, r1 };
  }

  /**
   * 戦法の動きの窓: 主役の駒の経路 ∪ 必須の駒（essential）∪ 主役のマスの外接矩形を
   * 最小 5筋×3段まで広げる。広げ方は miniWindow と同じ（筋は玉側の端へ・段は自陣の奥へ）
   * @param {Object} tactic route/essential/lead を持つ戦法
   * @param {'ibisha'|'furibisha'} side 玉のいる側（戦法の系統の side）
   * @param {boolean} [flip]
   * @returns {{f0:number, f1:number, r0:number, r1:number}}
   */
  function moveWindow(tactic, side, flip = false) {
    const edgeHigh = (side === 'ibisha') !== flip;
    const backHigh = !flip;
    const pts = [
      ...(tactic && tactic.route || []),
      ...(tactic && tactic.lead && tactic.lead.square ? [tactic.lead.square] : []),
      ...(tactic && tactic.essential ? parsePieces(tactic.essential).map(x => `${x.f}${x.r}`) : []),
    ].map(s => {
      const p = parseSquare(s);
      return flip ? mirrorPt(p) : p;
    });
    let f0, f1, r0, r1;
    if (pts.length) {
      const fs = pts.map(x => x.f), rs = pts.map(x => x.r);
      [f0, f1, r0, r1] = [Math.min(...fs), Math.max(...fs), Math.min(...rs), Math.max(...rs)];
    } else {
      [f0, f1] = edgeHigh ? [9, 9] : [1, 1];
      [r0, r1] = backHigh ? [9, 9] : [1, 1];
    }
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
      if (x.p === '玉') s += `<path class="mini-k" d="${kingD(cx, cy)}"/>`;   // 朱の駒形（五角形）
      s += `<text class="mini-pc core${x.p === '玉' ? ' k' : ''}" x="${cx}" y="${cy + .5}">${x.p}</text>`;
    }
    return s + '</svg>';
  }

  /**
   * 戦法の記事頭の図: 経路と必須の駒を含む窓で盤の一部を切り出し、主役の駒の経路を
   * 破線の矢印で示す。経路の出発点は薄く塗り（駒はもう居ないことが多い）、
   * 必須・主役の駒は字（主役は color の系統色）、他の駒は点。
   * 盤・手筋の図と同じく筋の座標を上・段の座標を右に添える
   * @param {Kakoi.Position} position 戦法の想定配置（Position.fromPieces）
   * @param {Object} tactic
   * @param {{ side?:string, flip?:boolean, color?:string }} [opts]
   *   color: 主役色（系統色 --t-* など。未指定は墨）
   */
  function moveBoardSVG(position, tactic, opts = {}) {
    const { flip = false, side = 'ibisha', color = '' } = opts;
    const { f0, f1, r0, r1 } = moveWindow(tactic, side, flip);
    const cols = f1 - f0 + 1, rows = r1 - r0 + 1;
    const y0 = M;   // 盤の矩形の上端（上に筋の座標の余白、右に段の座標の余白）
    const ess = new Set(tactic.essential ? parsePieces(tactic.essential).map(x => `${x.f}${x.r}`) : []);
    const route = (tactic.route || []).map(s => flip ? mirrorSq(s) : s);
    const center = s => {
      const p = parseSquare(s);
      return { x: (f1 - p.f) * W + W / 2, y: y0 + (p.r - r0) * H + H / 2 };
    };
    let s = `<svg class="mini-mv" viewBox="0 0 ${cols * W + M} ${rows * H + M}" preserveAspectRatio="xMidYMid meet"` +
      ` role="img" aria-label="主役の駒の動き"${color ? ` style="--tc:${color}"` : ''}>`;
    // 経路の矢じり（定義は全て同じなので id は共有。タイルで同じ戦法を複数描いても衝突しない）
    const mid = 'mv-arrow';
    s += `<defs><marker id="${mid}" viewBox="0 0 10 10" refX="8" refY="5" markerUnits="userSpaceOnUse"` +
      ` markerWidth="3.6" markerHeight="3.6" orient="auto"><path class="mini-rth" d="M0 0L10 5L0 10L3 5z"/></marker></defs>`;
    // 座標: 上=筋（左の列ほど大きい）、右=段
    for (let i = 0; i < cols; i++) s += `<text class="mini-co" x="${i * W + W / 2}" y="${M - 2.5}">${ZEN[f1 - i]}</text>`;
    for (let j = 0; j < rows; j++) s += `<text class="mini-co" x="${cols * W + M / 2}" y="${y0 + j * H + H / 2 + 1}">${KAN[r0 + j]}</text>`;
    s += `<rect class="mini-bg" x="0" y="${y0}" width="${cols * W}" height="${rows * H}" rx="1.5"/>`;
    if (route.length > 1) {
      const o = parseSquare(route[0]);
      s += `<rect class="mini-from" x="${(f1 - o.f) * W + 1}" y="${y0 + (o.r - r0) * H + 1}" width="${W - 2}" height="${H - 2}" rx="1.2"/>`;
    }
    for (let i = 1; i < cols; i++) s += `<line class="mini-ln" x1="${i * W}" y1="${y0}" x2="${i * W}" y2="${y0 + rows * H}"/>`;
    for (let j = 1; j < rows; j++) s += `<line class="mini-ln" x1="0" y1="${y0 + j * H}" x2="${cols * W}" y2="${y0 + j * H}"/>`;
    // 経路: 破線の矢印（終点は駒の手前で止める。盤の重ね表示と同じ作法）
    if (route.length > 1) {
      const pts = route.map(center);
      const end = { ...pts[pts.length - 1] }, prev = pts[pts.length - 2];
      const dx = end.x - prev.x, dy = end.y - prev.y, L = Math.hypot(dx, dy);
      if (L) { const inset = Math.min(4, L * .45); end.x -= dx / L * inset; end.y -= dy / L * inset; }
      const pl = [...pts.slice(0, -1), end].map(p => `${+p.x.toFixed(2)},${+p.y.toFixed(2)}`).join(' ');
      s += `<polyline class="mini-rt" points="${pl}" marker-end="url(#${mid})"/>`;
    }
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      let f = f1 - i, r = r0 + j;
      if (flip) ({ f, r } = mirrorPt({ f, r }));
      const x = position.at(f, r);
      if (!x) continue;
      const cx = i * W + W / 2, cy = y0 + j * H + H / 2;
      const lead = x.role === 'lead';
      if (!lead && !ess.has(`${x.f}${x.r}`)) {
        s += `<circle class="mini-dot" cx="${cx}" cy="${cy}" r="1.3"/>`; continue;
      }
      if (x.p === '玉') s += `<path class="mini-k" d="${kingD(cx, cy)}"/>`;
      s += `<text class="mini-pc ${lead ? 'lead' : 'core'}${x.p === '玉' ? ' k' : ''}" x="${cx}" y="${cy + .5}">${x.p}</text>`;
    }
    return s + '</svg>';
  }

  // 動き図の viewBox の縦横比（タイルの幅決め用。囲いの miniAspect に対応）
  Kakoi.moveAspect = (tactic, side, flip = false) => {
    const w = moveWindow(tactic, side, flip);
    return ((w.f1 - w.f0 + 1) * W + M) / ((w.r1 - w.r0 + 1) * H + M);
  };
  Kakoi.miniBoardSVG = miniBoardSVG;
  Kakoi.miniWindow = miniWindow;
  Kakoi.moveBoardSVG = moveBoardSVG;
  Kakoi.moveWindow = moveWindow;
  // 窓の描画アスペクト（幅÷高さ）。タイル幅をサムネの描画幅に合わせる用（rail-grids の --ar）
  Kakoi.miniAspect = w => (w.f1 - w.f0 + 1) * W / ((w.r1 - w.r0 + 1) * H);
})();
