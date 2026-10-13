/* 将棋盤の質感リファレンス — 共通の組み立て。
   各案は <style> で材質を決め、最後に Ref.init({...}) を呼ぶ。
   ここがやること: 上部の帯（案の切替・明暗）/ 光源パッド・視点・重ね表示の操作 / 盤・駒台・駒の DOM / ルーペ */
(() => {
  'use strict';
  const PLANS = [
    { f: 'kaya.html',    no: '01', name: '本榧と盛上げ駒' },
    { f: 'toy.html',     no: '02', name: '積み木の盤' },
    { f: 'machine.html', no: '03', name: '削り出し' },
    { f: 'urushi.html',  no: '04', name: '溜塗と蒔絵' },
    { f: 'paper.html',   no: '05', name: '活版と板紙' },
  ];
  // 角換わり腰掛け銀の手前くらい（両者 角・歩 を持つ）
  const SFEN = 'ln1g3nl/1r3kgs1/p1sppp2p/2p3p2/1p7/2P1P4/PPSP1PP1P/2GS3R1/LN2KG1NL b BPbp 1';
  const CH = { k: '玉', r: '飛', b: '角', g: '金', s: '銀', n: '桂', l: '香', p: '歩' };
  const PR = { r: '龍', b: '馬', s: '全', n: '圭', l: '杏', p: 'と' };
  const RANK = '一二三四五六七八九';
  const SIZE = { k: 'sz-k', p: 'sz-s' };

  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

  /** SVG フィルタを1枚の背景画像にする（駒の面など、多数並ぶ小さな面の肌理用） */
  const tex = (w, h, filter, fill = '#fff') =>
    `url("data:image/svg+xml,${encodeURIComponent(
      `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}'><filter id='f' x='0' y='0' width='100%' height='100%'>${filter}</filter><rect width='100%' height='100%' fill='${fill}' filter='url(#f)'/></svg>`)}")`;

  /** 木目: 異方性ノイズを帯状に量子化して年輪の線にする。
      fx,fy: 周波数（fx>fy で縦目）/ bands: 帯の数 / rgb: 線の色 / a: 濃さ / warp: 揺らぎ */
  const grain = ({ fx = .2, fy = .004, oct = 3, seed = 3, bands = 9, rgb = [120, 70, 20], a = .5, fine = .25, warp = 0 } = {}) => {
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

  /** 角を丸めた五角形の clip-path（r: 角の丸みを辺長に対する比で）。後手は上下反転 */
  const roundClip = (r = .12, flip = false) => {
    const P = [[50, 0], [86, 14], [100, 100], [0, 100], [14, 14]].map(([x, y]) => [x, flip ? 100 - y : y]);
    const out = [];
    P.forEach((v, i) => {
      const a = P[(i + P.length - 1) % P.length], b = P[(i + 1) % P.length];
      const A = [v[0] + (a[0] - v[0]) * r, v[1] + (a[1] - v[1]) * r], B = [v[0] + (b[0] - v[0]) * r, v[1] + (b[1] - v[1]) * r];
      for (let k = 0; k <= 6; k++) {
        const t = k / 6, u = 1 - t;
        out.push([u * u * A[0] + 2 * u * t * v[0] + t * t * B[0], u * u * A[1] + 2 * u * t * v[1] + t * t * B[1]]);
      }
    });
    return `polygon(${out.map(([x, y]) => `${x.toFixed(2)}% ${y.toFixed(2)}%`).join(',')})`;
  };

  const parse = sfen => {
    const [rows, , hand] = sfen.split(' ');
    const sq = [];
    rows.split('/').forEach((row, r) => {
      let c = 0, pro = false;
      for (const ch of row) {
        if (ch === '+') { pro = true; continue; }
        if (/\d/.test(ch)) { c += +ch; continue; }
        const low = ch.toLowerCase();
        sq.push({ r, c, t: low, side: ch === low ? 'g' : 's', pro });
        c++; pro = false;
      }
    });
    const hands = { s: [], g: [] };
    for (const ch of hand.replace(/\d/g, '')) { if (ch === '-') continue; const low = ch.toLowerCase(); hands[ch === low ? 'g' : 's'].push(low); }
    return { sq, hands };
  };

  let customPiece = null;   // cfg.piece があれば駒の DOM はそちらが作る
  const piece = (t, side, pro) => {
    if (customPiece) return customPiece(t, side, pro, pro ? PR[t] : (t === 'k' && side === 'g' ? '王' : CH[t]));
    const p = el('div', `pc ${side} ${SIZE[t] || ''}`);
    p.append(el('i', 'sh'));
    const n = +getComputedStyle(document.documentElement).getPropertyValue('--PT') || 3;
    for (let i = 0; i < n; i++) { const s = el('i', 'sl'); s.style.transform = `translateZ(calc(var(--pstep) * ${i} + .6px))`; p.append(s); }
    const fc = el('i', 'fc');
    const ch = pro ? PR[t] : (t === 'k' && side === 'g' ? '王' : CH[t]);
    fc.append(el('span', pro ? 'pr' : '', ch));
    p.append(fc);
    return p;
  };

  const block = (cls, cfg, key) => {
    const b = el('div', cls);
    const top = el('div', 'topf');
    if (cfg[key + 'Tex']) top.append(svgFill(`f-${key}`));
    b.append(top);
    const front = el('div', 'front');
    const edge = el('div', 'edge');
    if (cfg[key + 'EdgeTex']) edge.append(svgFill(`f-${key}Edge`));
    front.append(edge, el('div', 'legs', cfg[key + 'Legs'] || ''));
    b.append(front, el('div', 'ground'));
    return b;
  };
  const svgFill = id => {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('class', 'tex'); s.setAttribute('preserveAspectRatio', 'none');
    s.innerHTML = `<rect width="100%" height="100%" fill="#fff" filter="url(#${id})"/>`;
    return s;
  };

  const buildRig = cfg => {
    const { sq, hands } = parse(cfg.sfen || SFEN);
    const rig = el('div', 'rig');
    const board = block('slab', cfg, 'board');
    const top = board.querySelector('.topf');
    const fl = el('div', 'flab'), rl = el('div', 'rlab');
    for (let i = 9; i >= 1; i--) fl.append(el('span', '', cfg.fileDigits ? cfg.fileDigits[i - 1] : String(i)));
    for (const k of RANK) rl.append(el('span', '', k));
    // 罫線は1枚の SVG（線の盛り上げ・彫り・墨のにじみは各案がこの要素に filter で付ける）
    const ln = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    ln.setAttribute('class', 'lines'); ln.setAttribute('viewBox', '0 0 9 9'); ln.setAttribute('preserveAspectRatio', 'none');
    let d = '';
    for (let i = 0; i <= 9; i++) d += `M${i} 0V9M0 ${i}H9`;
    ln.innerHTML = `<path d="${d}" vector-effect="non-scaling-stroke"/>`;
    top.append(ln);
    const grid = el('div', 'grid');
    const cells = [];
    for (let i = 0; i < 81; i++) { const c = el('div', 'sq'); cells.push(c); grid.append(c); }
    for (const p of sq) cells[p.r * 9 + p.c].append(piece(p.t, p.side, p.pro));
    for (const [x, y] of [[3, 3], [6, 3], [3, 6], [6, 6]]) {
      const h = el('i', 'hoshi');
      h.style.left = `calc(var(--M) + var(--S) * ${x})`; h.style.top = `calc(var(--M) + var(--SH) * ${y})`;
      top.append(h);
    }
    top.append(fl, rl, grid);
    // 重ね表示: 飛車先の筋道（2八→2三）・注目の枠（2二）・直前の手（2八）
    const ov = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    ov.setAttribute('class', 'ov'); ov.setAttribute('viewBox', '0 0 9 9'); ov.setAttribute('preserveAspectRatio', 'none');
    // 直前の手の色は駒の下、筋道と枠は駒の上
    const ovu = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    ovu.setAttribute('class', 'ov ov-under'); ovu.setAttribute('viewBox', '0 0 9 9'); ovu.setAttribute('preserveAspectRatio', 'none');
    ovu.innerHTML = '<rect class="lastmv" x="7" y="7" width="1" height="1"/>';
    grid.prepend(ovu);
    ov.innerHTML = `<rect class="focus" x="7.06" y="1.06" width=".88" height=".88" vector-effect="non-scaling-stroke"/>
      <path class="rt-line" d="M7.5 7.2 L7.5 2.75" vector-effect="non-scaling-stroke"/>
      <path class="rt-head" d="M7.5 2.45 L7.72 2.95 L7.28 2.95Z"/>`;
    grid.append(ov);
    const mk = side => {
      const d = block(`dai ${side}`, cfg, 'dai');
      const h = el('div', 'hand');
      for (const t of hands[side]) { const w = el('div'); w.append(piece(t, side, false)); h.append(w); }
      d.querySelector('.topf').append(h);
      return d;
    };
    if (cfg.topDown) {
      // アプリの盤と同じ並び: 上に筋・右に段、持ち駒は縦書きで 相手=左上（△）・自分=右下（▲）
      const KAN = ['', '', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
      const handText = (h, mark) => {
        if (!h.length) return '';
        const cnt = new Map();
        for (const t of h) cnt.set(CH[t], (cnt.get(CH[t]) || 0) + 1);
        return mark + [...cnt.entries()].map(([c, n]) => c + (n > 1 ? KAN[n] : '')).join(' ');
      };
      const bw = el('div', 'bwrap');
      fl.className = 'flabels'; rl.className = 'rlabels';
      bw.append(fl, el('div'), board, rl,
        el('div', 'handcol opp', handText(hands.g, '△')), el('div', 'handcol me', handText(hands.s, '▲')));
      rig.append(bw);
    } else rig.append(mk('g'), board, mk('s'));
    if (cfg.decorate) cfg.decorate(rig);
    return rig;
  };

  /* ---- 光と視点 ---- */
  const root = document.documentElement;
  let onLight = null;
  const setLight = (x, y) => {   // x,y: パッド内の位置（中心 0, 縁 1）
    const m = Math.min(1, Math.hypot(x, y));
    const k = m > 1e-3 ? m / Math.hypot(x, y) : 0;
    const lx = x * k, ly = y * k;
    root.style.setProperty('--lx', lx.toFixed(3));
    root.style.setProperty('--ly', ly.toFixed(3));
    root.style.setProperty('--len', (.25 + m * .95).toFixed(3));
    root.style.setProperty('--la', `${(Math.atan2(-lx, ly) * 180 / Math.PI).toFixed(1)}deg`);
    if (onLight) onLight(lx, ly, m);
    const dot = document.querySelector('.lpad i');
    if (dot) { dot.style.left = `${50 + lx * 50}%`; dot.style.top = `${50 + ly * 50}%`; }
  };

  const controls = cfg => {
    const c = el('div', 'ctrl');
    c.innerHTML = `
      <label><span class="lab">光源</span><span class="lpad" title="ドラッグで光の向き・高さ（中心＝真上）／ダブルクリックで戻す"><i></i></span></label>
      ${cfg.topDown ? '' : `<label><span class="lab">視点</span><input type="range" min="0" max="48" step="1" value="${cfg.tilt ?? 16}" aria-label="盤の傾き"><output></output></label>`}
      <button class="tbtn" data-k="sun" aria-pressed="false">日の巡り</button>
      <button class="tbtn" data-k="ov" aria-pressed="true">重ね表示</button>
      ${cfg.topDown ? '<span class="lab">アプリと同じ真上視点</span>' : '<span class="lab">0° がアプリと同じ真上視点</span>'}`;
    const pad = c.querySelector('.lpad');
    const def = cfg.light || [-.55, -.8];
    let cur = [...def];
    const fromEvt = e => {
      const r = pad.getBoundingClientRect();
      cur = [(e.clientX - r.left) / r.width * 2 - 1, (e.clientY - r.top) / r.height * 2 - 1];
      setLight(...cur);
    };
    pad.addEventListener('pointerdown', e => { pad.setPointerCapture(e.pointerId); stopSun(); fromEvt(e); });
    pad.addEventListener('pointermove', e => { if (pad.hasPointerCapture(e.pointerId)) fromEvt(e); });
    pad.addEventListener('dblclick', () => { cur = [...def]; setLight(...cur); });
    const range = c.querySelector('input[type=range]'), out = c.querySelector('output');
    if (!range) root.style.setProperty('--tilt', '0deg');
    else {
    const setTilt = v => { root.style.setProperty('--tilt', `${v}deg`); out.textContent = `${v}°`; };
    range.addEventListener('input', () => { document.querySelector('.stage .rig')?.classList.add('dragging'); setTilt(range.value); });
    range.addEventListener('change', () => document.querySelector('.stage .rig')?.classList.remove('dragging'));
    setTilt(range.value);
    }
    let raf = 0;
    const sunBtn = c.querySelector('[data-k="sun"]');
    const stopSun = () => { cancelAnimationFrame(raf); raf = 0; sunBtn.setAttribute('aria-pressed', 'false'); };
    sunBtn.addEventListener('click', () => {
      if (raf) { stopSun(); return; }
      sunBtn.setAttribute('aria-pressed', 'true');
      const t0 = performance.now(), a0 = Math.atan2(cur[1], cur[0]);
      const tick = t => {
        const a = a0 + (t - t0) / 2600;
        cur = [Math.cos(a) * .85, Math.sin(a) * .85]; setLight(...cur);
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    });
    const ovBtn = c.querySelector('[data-k="ov"]');
    ovBtn.addEventListener('click', () => {
      const on = ovBtn.getAttribute('aria-pressed') !== 'true';
      ovBtn.setAttribute('aria-pressed', String(on)); document.body.dataset.ov = on ? 'on' : 'off';
    });
    setLight(...def);
    return c;
  };

  const topbar = cfg => {
    const here = location.pathname.split('/').pop();
    const t = el('header', 'top');
    t.innerHTML = `<h1>盤の質感</h1><nav>${PLANS.map(p => `<a href="${p.f}"${p.f === here ? ' aria-current="page"' : ''}><b>${p.no}</b>${p.name}</a>`).join('')}</nav>
      <span class="sp"></span><button class="tbtn" data-k="theme">明 / 暗</button>`;
    t.querySelector('[data-k="theme"]').addEventListener('click', () => {
      const v = root.dataset.theme === 'dark' ? 'light' : 'dark';
      root.dataset.theme = v; try { localStorage.setItem('shogi-theme', v); } catch (e) {}
    });
    return t;
  };

  /* ---- ルーペ: 同じ盤を真上から拡大（cfg.loupe = 盤上の注視点, マス座標） ---- */
  const loupe = (cfg, rig) => {
    const wrap = el('div');
    const lp = el('div', 'loupe'), inner = el('div', 'inner');
    const clone = rig.cloneNode(true);
    inner.append(clone); lp.append(inner);
    wrap.append(lp, el('p', 'loupe-cap', cfg.loupeCap || '真上から 2.6 倍'));
    const place = () => {
      const slab = rig.querySelector('.slab');
      const Z = cfg.loupeZoom || 2.6;
      const g = slab.querySelector('.grid');
      const sqW = g.offsetWidth / 9, SH = g.offsetHeight / 9;
      let ox = 0, oy = 0;   // rig から見た罫の左上（offsetParent をたどる）
      for (let e = g; e && e !== rig; e = e.offsetParent) { ox += e.offsetLeft; oy += e.offsetTop; }
      const [fx, fy] = cfg.loupe || [7.5, 6.6];
      const px = ox + fx * sqW, py = oy + fy * SH;
      inner.style.width = `${rig.offsetWidth}px`;
      inner.style.transform = `translate(${lp.clientWidth / 2 - px * Z}px, ${lp.clientHeight / 2 - py * Z}px) scale(${Z})`;
    };
    requestAnimationFrame(place);
    addEventListener('resize', place);
    document.fonts?.ready.then(place);
    return wrap;
  };

  const init = cfg => {
    try { root.dataset.theme = localStorage.getItem('shogi-theme') || 'light'; } catch (e) {}
    // フィルタ定義（盤・木口・駒台）。クローンからも参照するので id は一度だけ置く
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    defs.setAttribute('aria-hidden', 'true');
    defs.style.cssText = 'position:absolute;width:0;height:0';
    defs.innerHTML = ['board', 'boardEdge', 'dai', 'daiEdge'].filter(k => cfg[k + 'Tex'])
      .map(k => `<filter id="f-${k}" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">${cfg[k + 'Tex']}</filter>`).join('');
    document.body.prepend(defs);
    for (const [k, v] of Object.entries(cfg.vars || {})) root.style.setProperty(k, v);
    customPiece = cfg.piece || null;
    onLight = cfg.onLight || null;
    if (cfg.topDown) document.body.classList.add('topdown');
    document.body.prepend(topbar(cfg));
    const stage = document.querySelector('.stage');
    stage.before(controls(cfg));
    const env = el('div', 'env');
    const rig = buildRig(cfg);
    env.append(rig);
    stage.append(env);
    const det = document.querySelector('.details');
    if (det) det.prepend(loupe(cfg, rig));
    if (onLight) setLight(...(cfg.light || [-.55, -.8]));   // 盤とルーペができてから光を当て直す
  };

  window.Ref = { init, tex, grain, roundClip };
})();
