// 本榧と彫駒の絵（design-refs-board/kaya.html を本番に移したもの）。
// ・盤: 柾目の SVG フィルタ（Kakoi.kayaArt.grainFilter）
// ・駒: 黄楊の一木から切り出した彫駒を canvas に焼く（paint）。光は左上に固定し、
//   面取り5面の明暗・字の彫りの影と照り・盤に落ちる2段の影（shadow）をすべてこの光から決める。
// 立体駒レイヤ（piece-layer-3d）は焼いた絵を真上から見た板として貼り、DOM 版（piece-layer-dom）は画像として置く
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';

  // ---- 光（css/board.css の --lx/--ly/--len と同じ値） ----
  const LX = -.55, LY = -.8;                       // 光の来る向き（画面座標。左上）
  const M = Math.hypot(LX, LY);                    // 光源の低さ（1 に近いほど低い）
  const LEN = .25 + M * .95;                       // 影の長さの係数
  const U = [LX / M, LY / M];
  const HZ = M * .85, LZ = Math.sqrt(1 - HZ * HZ); // 光の水平成分・鉛直成分

  // ---- 駒の形（単位系 88×100。先手の向き＝先端が上） ----
  const W = 88, H = 100, TARGET_Y = 57;            // TARGET_Y: 字の墨の中心（駒の重心）
  const OUT = [[44, 1], [77, 20], [86, 99], [2, 99], [11, 20]];
  const BEV = [3.2, 3.4, 1.4, 3.4, 3.2];           // 各辺の面取りの見え幅（下辺は立っているので細い）
  const SLOPE = [52, 58, 70, 58, 52];              // 各面取りの傾き（度）
  // 駒の大きさ（マスの高さ比）。実物の順: 玉 > 飛角 > 金銀 > 桂 > 香 > 歩。成駒は元の駒の大きさ
  const SCALE = { 玉: .97, 王: .97, 飛: .93, 角: .93, 龍: .93, 馬: .93, 金: .9, 銀: .9, 全: .9, 桂: .87, 圭: .87, 香: .85, 杏: .85, 歩: .82, と: .82 };
  const FONT = '"Yuji Syuku", "Shippori Mincho B1", serif';
  // 盤に落ちる影（kaya.html の drop-shadow 2段。px はマス幅 54px のときの値）
  const SHADOWS = [
    { d: 6 * LEN, blur: 3.5, alpha: .32 },         // 光の反対へ伸びる柔らかい影
    { d: 1.6 * LEN, blur: .7, alpha: .55 },        // 接地の濃い影
  ];
  const REF_SQ = 54, REF_PIECE_H = REF_SQ * 9.6 / 9 * .9; // 参照の駒の高さ（px）→ 単位系との換算

  const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
  const nrm = v => { const l = Math.hypot(v[0], v[1]); return [v[0] / l, v[1] / l]; };

  // 内側へ辺ごとに D[i] だけ寄せた多角形（隣り合う辺の交点）と、各辺の外向き法線
  const inset = (P, D) => {
    const n = P.length, cx = P.reduce((s, p) => s + p[0], 0) / n, cy = P.reduce((s, p) => s + p[1], 0) / n;
    const lines = P.map((p, i) => {
      const t = nrm(sub(P[(i + 1) % n], p));
      let nv = [-t[1], t[0]];
      if ((cx - p[0]) * nv[0] + (cy - p[1]) * nv[1] < 0) nv = [-nv[0], -nv[1]];
      return { p: [p[0] + nv[0] * D[i], p[1] + nv[1] * D[i]], t, out: [-nv[0], -nv[1]] };
    });
    const pts = P.map((_, i) => {
      const a = lines[(i + n - 1) % n], b = lines[i];
      const s = ((b.p[0] - a.p[0]) * b.t[1] - (b.p[1] - a.p[1]) * b.t[0]) / (a.t[0] * b.t[1] - a.t[1] * b.t[0]);
      return [a.p[0] + a.t[0] * s, a.p[1] + a.t[1] * s];
    });
    return { pts, outs: lines.map(l => l.out) };
  };
  // 角を少し丸めた輪郭
  const roundedPath = (P, r) => {
    const path = new Path2D();
    P.forEach((v, i) => {
      const a = P[(i + P.length - 1) % P.length], b = P[(i + 1) % P.length];
      const ua = nrm(sub(a, v)), ub = nrm(sub(b, v));
      const A = [v[0] + ua[0] * r, v[1] + ua[1] * r], B = [v[0] + ub[0] * r, v[1] + ub[1] * r];
      if (i) path.lineTo(A[0], A[1]); else path.moveTo(A[0], A[1]);
      path.quadraticCurveTo(v[0], v[1], B[0], B[1]);
    });
    path.closePath();
    return path;
  };
  // 斜面の明暗: 斜面の法線と光の内積を、平らな面との差で（正=照り、負=陰）
  const shade = (nx, ny, deg) => {
    const a = deg * Math.PI / 180;
    return Math.sin(a) * HZ * (nx * U[0] + ny * U[1]) + Math.cos(a) * LZ - LZ;
  };

  // 後手は形を上下左右に反転する（字だけ回す。光の向きは盤の座標のまま）
  const GEO = {};
  for (const side of ['s', 'g']) {
    const P = side === 's' ? OUT : OUT.map(([x, y]) => [W - x, H - y]);
    const { pts, outs } = inset(P, BEV);
    GEO[side] = { P, I: pts, outs, path: roundedPath(P, 2.2), tip: side === 's' ? -1 : 1 };
  }

  /** 木目: 異方性ノイズを帯状に量子化して柾目の線にする SVG フィルタ（中身だけ。<filter> は呼び出し側） */
  const grainFilter = ({ fx = .2, fy = .004, oct = 3, seed = 3, bands = 9, rgb = [120, 70, 20], a = .5, fine = .25, warp = 0 } = {}) => {
    const tbl = Array.from({ length: bands * 2 + 1 }, (_, i) => (i % 2 ? (.55 + ((i * 37) % 9) / 20).toFixed(2) : 0)).join(' ');
    const [r, g, b] = rgb.map(v => (v / 255).toFixed(3));
    const disp = warp ? `<feTurbulence type="fractalNoise" baseFrequency="${fy * 3} ${fy * 2}" numOctaves="2" seed="${seed + 9}" result="w"/>
      <feDisplacementMap in="n0" in2="w" scale="${warp}" xChannelSelector="R" yChannelSelector="G" result="n"/>` : '<feOffset in="n0" result="n"/>';
    return `<feTurbulence type="fractalNoise" baseFrequency="${fx} ${fy}" numOctaves="${oct}" seed="${seed}" result="n0"/>${disp}
      <feColorMatrix in="n" type="matrix" values="0 0 0 0 ${r}  0 0 0 0 ${g}  0 0 0 0 ${b}  1.6 0 0 0 -.3" result="c"/>
      <feComponentTransfer in="c" result="rings"><feFuncA type="table" tableValues="${tbl}"/></feComponentTransfer>
      <feTurbulence type="fractalNoise" baseFrequency="${fx * 6} ${fy * 40}" numOctaves="2" seed="${seed + 2}" result="f0"/>
      <feColorMatrix in="f0" type="matrix" values="0 0 0 0 ${r}  0 0 0 0 ${g}  0 0 0 0 ${b}  0 0 0 ${fine * 2.2} ${-fine}" result="fibre"/>
      <feComposite in="rings" in2="fibre" operator="over" result="g"/>
      <feComponentTransfer in="g"><feFuncA type="linear" slope="${a}"/></feComponentTransfer>`;
  };
  // 盤の柾目（kaya.html の boardTex と同じ）
  const BOARD_GRAIN = { fx: .16, fy: .0035, oct: 3, seed: 11, bands: 14, rgb: [150, 92, 30], a: .55, fine: .3, warp: 18 };

  // 黄楊の柾目（模様なし・細い縦目だけ）。駒ごとに取り位置をずらして描く
  const grainImg = new Image();
  const grainReady = new Promise(res => { grainImg.onload = res; grainImg.onerror = res; });
  grainImg.src = `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='260' height='110'><filter id='f' x='0' y='0' width='100%' height='100%'>${
      grainFilter({ fx: .17, fy: .005, oct: 2, seed: 12, bands: 9, rgb: [170, 115, 40], a: .45, fine: .3, warp: 5 })
    }</filter><rect width='100%' height='100%' fill='#fff' filter='url(#f)'/></svg>`)}`;
  const fontReady = document.fonts && document.fonts.load
    ? document.fonts.load(`100px ${FONT}`, '玉王飛角金銀桂香歩龍馬全圭杏と').catch(() => {})
    : Promise.resolve();
  /** 木目の画像と駒書体がそろったら解決（それまでの焼き付けは代替で描かれる） */
  const ready = Promise.all([grainReady, fontReady]);

  const scratch = () => document.createElement('canvas');
  const measureCtx = scratch().getContext('2d');
  const hash = s => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

  /** 字を彫りで描いた透明なレイヤ（単位系 × s の大きさ） */
  const engrave = (ch, side, ink, s) => {
    const w = Math.ceil(W * s), h = Math.ceil(H * s);
    const glyph = scratch(); glyph.width = w; glyph.height = h;
    const g = glyph.getContext('2d');
    // 墨の範囲を実測して、駒の重心に墨の中心を合わせる（墨の高さ 50・幅 60 に収める）
    measureCtx.font = `100px ${FONT}`; measureCtx.textAlign = 'center'; measureCtx.textBaseline = 'alphabetic';
    const m = measureCtx.measureText(ch);
    const inkW = (m.actualBoundingBoxLeft + m.actualBoundingBoxRight) || 80;
    const inkH = (m.actualBoundingBoxAscent + m.actualBoundingBoxDescent) || 80;
    const fs = Math.min(50 / (inkH / 100), 60 / (inkW / 100));
    const offX = (m.actualBoundingBoxRight - m.actualBoundingBoxLeft) / 2 * fs / 100;
    const offY = (m.actualBoundingBoxDescent - m.actualBoundingBoxAscent) / 2 * fs / 100;
    const cy = side === 's' ? TARGET_Y : H - TARGET_Y;
    g.scale(s, s);
    g.translate(W / 2, cy);
    if (side === 'g') g.rotate(Math.PI);
    g.font = `${fs}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    g.fillStyle = ink;
    g.fillText(ch, -offX, -offY);
    g.setTransform(1, 0, 0, 1, 0, 0);
    // 彫りの壁: 光の側の壁は影、奥の壁は木地が照る
    const k = (.6 + HZ * 1.1) * s;
    const wall = (dx, dy, color, alpha, blur) => {
      const c = scratch(); c.width = w; c.height = h;
      const x = c.getContext('2d');
      x.drawImage(glyph, 0, 0);
      x.globalCompositeOperation = 'destination-out';
      x.drawImage(glyph, dx, dy);
      x.globalCompositeOperation = 'source-in';
      x.globalAlpha = alpha; x.fillStyle = color; x.fillRect(0, 0, w, h);
      if (blur) { const b = scratch(); b.width = w; b.height = h; const bx = b.getContext('2d'); bx.filter = `blur(${blur}px)`; bx.drawImage(c, 0, 0); return b; }
      return c;
    };
    const lit = wall(U[0] * k * .8, U[1] * k * .8, '#c99a55', .9, 0);
    const dark = wall(-U[0] * k, -U[1] * k, '#000', .8, .35 * s);
    g.globalCompositeOperation = 'source-atop';
    g.drawImage(lit, 0, 0);
    g.drawImage(dark, 0, 0);
    return glyph;
  };

  /**
   * 駒を1枚焼く（ctx の (x, y) から幅 W*s・高さ H*s）
   * @param {string} ch 駒の字 / @param {'s'|'g'} side 向き（後手は先端が下）
   * @param {{ ink:string, wood1:string, wood2:string }} col
   */
  const paint = (ctx, x, y, s, ch, side, col) => {
    const geo = GEO[side];
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.save();
    ctx.clip(geo.path);
    const base = ctx.createLinearGradient(0, 0, 0, H);
    base.addColorStop(0, col.wood1); base.addColorStop(1, col.wood2);
    ctx.fillStyle = base; ctx.fillRect(0, 0, W, H);
    if (grainImg.complete && grainImg.naturalWidth) {
      const hs = hash(ch + side);
      ctx.drawImage(grainImg, -(hs % 150), -(hs % 10), 240, H + 12);
    }
    const poly = pts => { ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); };
    const fillShade = v => {
      ctx.fillStyle = v > 0 ? `rgba(255,250,240,${Math.min(.72, v * 1.15)})` : `rgba(58,32,0,${Math.min(.72, -v * 1.35)})`;
      ctx.fill();
    };
    geo.P.forEach((p, i) => {   // 面取りの5面
      poly([p, geo.P[(i + 1) % 5], geo.I[(i + 1) % 5], geo.I[i]]);
      fillShade(shade(geo.outs[i][0], geo.outs[i][1], SLOPE[i]));
    });
    poly(geo.I);                // 駒面: 尻が厚いのでわずかに先へ傾く
    fillShade(shade(0, geo.tip, 5));
    ctx.restore();
    ctx.lineWidth = .6; ctx.strokeStyle = 'rgba(90,55,15,.35)';
    ctx.stroke(geo.path);
    ctx.restore();
    ctx.drawImage(engrave(ch, side, col.ink, s), x, y);
  };

  /** 駒の影（形のシルエットをぼかしたもの）。pad: 単位系での余白 */
  const SHADOW_PAD = 16;
  const shadow = (side, s, blurUnits) => {
    const c = scratch();
    c.width = Math.ceil((W + SHADOW_PAD * 2) * s); c.height = Math.ceil((H + SHADOW_PAD * 2) * s);
    const x = c.getContext('2d');
    // canvas の filter が使えない環境でも効くよう、画面外に描いた形の shadowBlur だけを写す
    const far = c.width + 50;
    x.shadowColor = '#2d1600';
    x.shadowBlur = blurUnits * s;
    x.shadowOffsetX = far;
    x.translate(SHADOW_PAD * s - far, SHADOW_PAD * s);
    x.scale(s, s);
    x.fillStyle = '#000';
    x.fill(GEO[side].path);
    return c;
  };

  /** 参照（マス幅 54px）の px を、駒の単位系へ換算する係数（駒の高さ k のとき） */
  const pxToUnits = k => H / (REF_PIECE_H * k / .9);

  Kakoi.kayaArt = {
    W, H, SCALE, SHADOWS, SHADOW_PAD, LIGHT: { x: LX, y: LY, len: LEN },
    paint, shadow, pxToUnits, grainFilter, BOARD_GRAIN, ready,
    scaleOf: ch => SCALE[ch] || .9,
  };
})();
