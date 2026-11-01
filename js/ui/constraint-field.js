// 制約フィールド: 盤の上に1枚だけ敷く「駒つぎ」の帯（design-refs/design-refs-constraint-puzzle-v6 案C）。
// 囲いは core の実座標そのままのポリオミノ（5:6の縦長ピース＋浅い継ぎ目。玉=四辺突起、
// 金・銀=上凸/後凹/左凹/右凸）、戦型は左端の大きな六角胞、戦法は囲いの右に置く
// 「屋形の星座」（飛車を中核、銀・角が上辺の翼、桂・歩が下辺、金・玉が外翼）。
// 多角形の大きさは駒の格（飛車>角・玉≫銀>他）、中に戦法名・背後に薄い駒名。
// ×は多角形の斜め上の辺の中央に乗せる（自分=右上・相手=左下）。
//
//   上の帯=相手（駒は筋・段とも反転して180°裏返し）・下の帯=自分。あいだを河とし、
//   河を向いた多角形の頂点/辺に相性（compat.judge().vs と同じ意味）を緑/赤で付ける。
//   左端には各側の戦型の大きな胞＋側ラベル。戦型は導出値だが押すと右ドックに情報が出る。
//
// 戦法は駒（lead.piece）ごとの席がある（複数同時に採用できる）。まだ選ばれていない
// 系統は「＋駒」の幽霊を一つだけ出し（追加するたび次の席へ移る）、押すと一覧を開く。
// 明示した層はいつでも×で外せる。既定値で補った層（implied）は網掛けで薄く、×は付けない。
// 両立しない明示した囲いは群れごとずらして傾け、✕と理由（title）を付ける。
// 操作は透明な <button> の重なり（roving tabindex・Delete/Backspace・title）が受ける。
// 計画書 §0-2 / §1-1 / §1-4 / U3 / U5。
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';
  const { findTactic, findCastle, tacticFamilyOf, strategyLabel } = Kakoi.catalog;
  const { parsePieces } = Kakoi.notation;
  const { plain } = Kakoi.html;
  const KIND_LABEL = { strategy: '戦型', castle: '囲い', tactic: '戦法' };

  // ---------- 幾何（v6 案C「屋形」） ----------
  const BAR_SCALE = .9;
  const ELEMENT_SCALE = 1.3;
  const STRATEGY_SCALE = ELEMENT_SCALE / BAR_SCALE;
  const UW = 22 * ELEMENT_SCALE, UH = UW * 6 / 5; // 囲いのピース（5:6のわずかな縦長）
  const SX = 64;                                  // 戦型の胞の列
  const STR_R = 26.5 * STRATEGY_SCALE, STR_DY = 14.6 * STRATEGY_SCALE;
  const X0 = SX + STR_R + 6.9;                    // 戦型・囲い間は前案の約6割
  const XR = X0 + 3 * UW;                         // 囲い群の基準右端
  const colX = (f, maxF) => X0 + (maxF - f) * UW;
  const SVGNS = 'http://www.w3.org/2000/svg';
  const M2 = Math.sqrt(3) / 2;
  const svg$ = (tag, attrs, parent) => {
    const n = document.createElementNS(SVGNS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  };
  // 上に頂点を持つ正六角形の頂点（v0=上 → 時計回り）
  const hexV = (ccx, ccy, r) => [90, 150, 210, 270, 330, 30]
    .map(a => [ccx + r * Math.cos(a * Math.PI / 180), ccy + r * Math.sin(a * Math.PI / 180)]);
  // 角をわずかに丸めた多角形のパス
  const roundPath = (pts, r = 2) => {
    const n = pts.length, out = [];
    for (let i = 0; i < n; i++) {
      const p = pts[i], a = pts[(i + n - 1) % n], b = pts[(i + 1) % n];
      const toward = q => {
        const dx = q[0] - p[0], dy = q[1] - p[1], d = Math.hypot(dx, dy) || 1;
        return [p[0] + dx / d * r, p[1] + dy / d * r];
      };
      const e1 = toward(a), e2 = toward(b);
      out.push(`${i ? 'L' : 'M'}${e1.map(x => x.toFixed(2)).join(' ')}Q${p.map(x => x.toFixed(2)).join(' ')} ${e2.map(x => x.toFixed(2)).join(' ')}`);
    }
    return out.join('') + 'Z';
  };
  const f1 = n => +n.toFixed(2);

  // ---------- 継ぎ手（「首が絞れて頭が膨らむ」突起。深さはセル高の約13%=案A） ----------
  function jEdge(p0, p1, s = 0, d = 7, w = 1) {
    if (!s) return `L${f1(p1[0])} ${f1(p1[1])}`;
    const dx = p1[0] - p0[0], dy = p1[1] - p0[1], L = Math.hypot(dx, dy);
    const ux = dx / L, uy = dy / L, nx = uy, ny = -ux;
    const P = (t, o = 0) => {
      const tt = .5 + (t - .5) * w;
      return [p0[0] + ux * tt * L + nx * o * s, p0[1] + uy * tt * L + ny * o * s];
    };
    const pt = q => `${f1(q[0])} ${f1(q[1])}`;
    return `L${pt(P(.30))}` +
      `C${pt(P(.315, -.09 * d))} ${pt(P(.355, -.08 * d))} ${pt(P(.395, .18 * d))}` +
      `C${pt(P(.415, .38 * d))} ${pt(P(.425, .52 * d))} ${pt(P(.40, .68 * d))}` +
      `C${pt(P(.375, .88 * d))} ${pt(P(.36, 1.02 * d))} ${pt(P(.42, 1.13 * d))}` +
      `C${pt(P(.45, 1.19 * d))} ${pt(P(.55, 1.19 * d))} ${pt(P(.58, 1.13 * d))}` +
      `C${pt(P(.64, 1.02 * d))} ${pt(P(.625, .88 * d))} ${pt(P(.60, .68 * d))}` +
      `C${pt(P(.575, .52 * d))} ${pt(P(.585, .38 * d))} ${pt(P(.605, .18 * d))}` +
      `C${pt(P(.645, -.08 * d))} ${pt(P(.685, -.09 * d))} ${pt(P(.70))}` +
      `L${pt(p1)}`;
  }
  function cellPath(x, y, w, h, e, d = 7, jw = 1) {
    return `M${f1(x)} ${f1(y)}` +
      jEdge([x, y], [x + w, y], e.n, d, jw) +
      jEdge([x + w, y], [x + w, y + h], e.e, d, jw) +
      jEdge([x + w, y + h], [x, y + h], e.s, d, jw) +
      jEdge([x, y + h], [x, y], e.w, d, jw) + 'Z';
  }
  // 駒ごとの凹凸の決まり（玉=四辺突起 / 金銀=方向凹凸 / 他=交互）。up=自分の向き
  function edgeOf(cl, occ, up) {
    const PAT = up ? { n: 1, s: -1, e: 1, w: -1 } : { n: -1, s: 1, e: -1, w: 1 };
    const OPPD = { n: 's', s: 'n', e: 'w', w: 'e' };
    const NB = { n: [0, -1], s: [0, 1], e: [-1, 0], w: [1, 0] };
    const roleOf = c => c.p === '玉' ? 'gyoku' : (c.p === '金' || c.p === '銀') ? 'kg' : 'other';
    const p = (f, r) => (f + r) % 2 ? 1 : -1;
    const e = { n: 0, s: 0, e: 0, w: 0 };
    const ro = roleOf(cl);
    for (const d of ['n', 's', 'e', 'w']) {
      const nb = occ.get((cl.f + NB[d][0]) + ',' + (cl.r + NB[d][1]));
      if (!nb) {
        if (ro === 'gyoku') e[d] = 1;
        else if (ro === 'kg') e[d] = PAT[d];
        continue;
      }
      const rn = roleOf(nb);
      if (ro === 'gyoku') e[d] = 1;
      else if (rn === 'gyoku') e[d] = -1;
      else if (ro === 'kg') e[d] = PAT[d];
      else if (rn === 'kg') e[d] = -PAT[OPPD[d]];
      else {
        e[d] = d === 'n' ? -p(cl.f, cl.r - 1) : d === 's' ? p(cl.f, cl.r)
             : d === 'e' ? p(cl.f - 1, cl.r) : -p(cl.f, cl.r);
      }
    }
    return e;
  }

  // ---------- 戦法の多角形（駒の格で大きさ。飛車>角・玉≫銀>他の駒） ----------
  const FAMR = {
    '飛': 25 * ELEMENT_SCALE, '角': 21 * ELEMENT_SCALE, '玉': 21 * ELEMENT_SCALE,
    '銀': 17 * ELEMENT_SCALE, '金': 15 * ELEMENT_SCALE,
    '桂': 19 * ELEMENT_SCALE, '歩': 20 * ELEMENT_SCALE,
  };
  const FAMPOLY = { '玉': 8, '飛': 6, '角': 5, '銀': 7, '金': 'sq', '桂': 'dm', '歩': 'dmS' };
  const FAMC = {
    '飛': '--t-rook', '銀': '--t-silver', '角': '--t-kaku',
    '桂': '--t-kei', '歩': '--t-fu', '金': '--t-kin', '玉': '--t-gyoku',
  };
  const famRX = p => FAMPOLY[p] === 'sq' ? FAMR[p] * .82
                   : FAMPOLY[p] === 'dm' ? FAMR[p] * .68
                   : FAMPOLY[p] === 'dmS' ? FAMR[p] * .92 : FAMR[p];
  const famRY = p => FAMPOLY[p] === 'sq' ? FAMR[p] * .82
                   : FAMPOLY[p] === 'dm' ? FAMR[p]
                   : FAMPOLY[p] === 'dmS' ? FAMR[p] * .66 : FAMR[p];
  // 多角形の内側に収まる文字幅の目安（戦法名を中に入れるため）
  const famFitW = p => FAMPOLY[p] === 'sq' ? FAMR[p] * 1.55
                     : FAMPOLY[p] === 'dm' ? famRX(p) * 1.5
                     : FAMPOLY[p] === 'dmS' ? famRX(p) * 1.45 : FAMR[p] * 1.5;
  const polyV = (ccx, ccy, n, r, up) => {
    const a0 = up ? -90 : 90;
    return Array.from({ length: n }, (_, i) => {
      const a = (a0 + i * 360 / n) * Math.PI / 180;
      return [ccx + r * Math.cos(a), ccy + r * Math.sin(a)];
    });
  };
  const famShapeV = (ccx, ccy, p, up) => {
    const def = FAMPOLY[p] || 6, r = FAMR[p] || 18;
    if (def === 'sq') { const a = r * .82; return [[ccx - a, ccy - a], [ccx + a, ccy - a], [ccx + a, ccy + a], [ccx - a, ccy + a]]; }
    if (def === 'dm') return [[ccx, ccy - r], [ccx + r * .68, ccy], [ccx, ccy + r], [ccx - r * .68, ccy]];
    if (def === 'dmS') return [[ccx, ccy - r * .66], [ccx + r * .92, ccy], [ccx, ccy + r * .66], [ccx - r * .92, ccy]];
    return polyV(ccx, ccy, def, r, up);
  };
  // ×は多角形の斜め上の辺の中央に乗せる。自分=右上(-45°)・相手=左下(+135°)。
  // 辺の中点が目標角に最も近いものを選ぶ。頂点が辺より明確に近い場合は角に乗せる（正方形用）
  function edgeRide(verts, ccx, ccy, tgtDeg) {
    const tgt = tgtDeg * Math.PI / 180;
    const angOf = p => Math.atan2(p[1] - ccy, p[0] - ccx);
    const diff = a => Math.abs(Math.atan2(Math.sin(a - tgt), Math.cos(a - tgt)));
    let best = { d: 1e9, p: null, edge: null };
    verts.forEach((v, i) => {
      const w = verts[(i + 1) % verts.length];
      const m = [(v[0] + w[0]) / 2, (v[1] + w[1]) / 2];
      const d = diff(angOf(m));
      if (d < best.d) best = { d, p: m, edge: [v, w] };
    });
    verts.forEach(v => {
      const d = diff(angOf(v));
      if (d < best.d - Math.PI / 18) best = { d, p: v, edge: null };
    });
    if (best.edge) {   // 辺の外法線方向へわずかに押し出して「乗る」感じに
      const [v, w] = best.edge;
      const L = Math.hypot(w[0] - v[0], w[1] - v[1]);
      let nx = (w[1] - v[1]) / L, ny = -(w[0] - v[0]) / L;
      const mx = best.p[0] - ccx, my = best.p[1] - ccy;
      if (nx * mx + ny * my < 0) { nx = -nx; ny = -ny; }
      best.p = [
        best.p[0] + nx * 1.4 * ELEMENT_SCALE,
        best.p[1] + ny * 1.4 * ELEMENT_SCALE,
      ];
    }
    return best.p;
  }

  // ---------- 星座の席（案C「屋形」+金・玉の外翼。席は駒に固有=追加で既存駒は動かない） ----------
  // 飛車が中核、銀・角が上辺の翼、桂・歩が下辺、金・玉が外翼の礎
  const SEAT = {
    '飛': [0, 0], '銀': [48, -30], '角': [-48, -30],
    '桂': [24, 46], '歩': [-24, 46], '金': [78, 8], '玉': [-78, 8],
  };
  const SEAT_SCALE = 1.1;
  const MINOR = '香桂';
  const WHO_JA = { me: '自分', opp: '相手' };
  const WHO_MARK = { me: '▲', opp: '△' };
  const STR_SHORT = { ibisha: '居飛車', furibisha: '振飛車' };
  const FAM_RANK = { '飛': 0, '銀': 1, '角': 2, '桂': 3, '歩': 4, '金': 5, '玉': 6 };

  class ConstraintField {
    /**
     * @param {HTMLElement} el `.cfield` の入れ物（1枚の帯。両側を1つのSVGに描く）
     * @param {{ onSelect:(who:'me'|'opp', kind:string, id:?string)=>void,
     *   onRemove:(who:string, kind:string, id:?string)=>void,
     *   onOpp:(on:boolean)=>void }} handlers
     *   onSelect: モジュールの選択（tactic の空き枠は id=系統の id）
     *   onRemove: 明示した層を外す（tactic はその id だけ、castle はその側）
     *   onOpp: 「＋相手」の胞で相手の表示を ON にする
     */
    constructor(el, { onSelect, onRemove, onOpp, onClear }) {
      this.el = el;
      this._onClear = onClear;
      this._nodes = new Map();   // 'who.kind.id' → .cf-hit 要素（差分更新でフォーカスを保つ。U3）
      this._lastRender = null;
      el.classList.add('cfield');
      this.svg = svg$('svg', { class: 'cf-svg', viewBox: '0 0 400 200', 'aria-hidden': 'true' });
      this.hits = document.createElement('span');
      this.hits.className = 'cf-hits';
      el.append(this.svg, this.hits);
      this._bindEvents({ onSelect, onRemove, onOpp, onClear });
      if (window.ResizeObserver) {
        this._resizeObserver = new ResizeObserver(() => {
          if (this._lastRender) this.render(this._lastRender);
        });
        this._resizeObserver.observe(el);
      }
    }

    _bindEvents({ onSelect, onRemove, onOpp, onClear }) {
      this.el.addEventListener('click', e => {
        const x = e.target.closest('.cf-x');
        if (x) { onRemove(x.dataset.who, x.dataset.kind, x.dataset.id || null); return; }
        const c = e.target.closest('.cf-clear');
        if (c) { onClear(c.dataset.who); return; }
        const g = e.target.closest('.cf-opp');
        if (g) { onOpp(true); return; }
        const b = e.target.closest('.cf-hit');
        if (b) onSelect(b.dataset.who, b.dataset.kind, b.dataset.id || null);
      });
      // Delete/Backspace でその層の制約を外す（U3）。矢印は roving がフォーカスだけを動かす
      this.el.addEventListener('keydown', e => {
        if (e.key !== 'Delete' && e.key !== 'Backspace') return;
        const b = e.target.closest('.cf-hit');
        if (!b || b.dataset.kind === 'strategy' || b.dataset.kind === 'senkei'
          || b.dataset.empty === 'true' || b.dataset.implied === 'true') return;
        e.preventDefault();
        onRemove(b.dataset.who, b.dataset.kind, b.dataset.id || null);
      });
      this._roving = Kakoi.roving.attach(this.hits, '.cf-hit');
    }

    /**
     * @param {{ S:{me:Object, opp:Object}, slots:Object, ng:Object, marks:Object,
     *   labels:Array<{label:string}>, selected:string|null, showOpp:boolean,
     *   nameOf:(who:string, kind:string, id:string)=>string }} d
     */
    render({ S, slots, ng, marks, labels, selected, showOpp, nameOf }) {
      this._lastRender = { S, slots, ng, marks, labels, selected, showOpp, nameOf };
      this._slots = slots;
      const sel = Kakoi.constraints.parseSel(selected) || {};
      const mods = this._collectMods(S, showOpp);
      this._layout(mods, S, sel, ng, marks, labels, showOpp, nameOf);
      this._syncClears(mods, showOpp);
      this._roving.refresh();
    }

    _collectMods(S, showOpp) {
      const mods = [];   // モジュールの実体（SVGに描くもの＋当たり判定）
      for (const who of ['opp', 'me']) {
        if (who === 'opp' && !showOpp) continue;
        const st = S[who];
        mods.push({ who, kind: 'strategy', id: st.strategy, st });
        const castle = findCastle(st.castleId);
        mods.push({ who, kind: 'castle', id: st.castleId, castle, st });
        // 戦法: 選ばれたものは系統の席へ。まだ選ばれていない系統は先頭の一つだけ幽霊に
        const fams = this._familiesOf(st.strategy);
        const used = new Set();
        for (const id of st.tacticIds) {
          const t = findTactic(id);
          const fam = t && tacticFamilyOf(t);
          if (fam) used.add(fam.id);
          mods.push({ who, kind: 'tactic', id, famId: fam ? fam.id : `x-${id}`, t, fam, st });
        }
        const ghost = fams.find(f => !used.has(f.id));
        if (ghost) mods.push({ who, kind: 'tactic', id: null, famId: ghost.id, fam: ghost, st, empty: true });
      }
      return mods;
    }

    // その戦型で取りうる戦法の系統（駒）をランク順に並べる
    _familiesOf(side) {
      return (Kakoi.TACTIC_FAMILIES || []).filter(f => f.side === side)
        .sort((a, b) => (FAM_RANK[a.piece] ?? 9) - (FAM_RANK[b.piece] ?? 9));
    }

    // ---------- 幾何: 囲いのポリオミノと戦法の星座の座標を決め、帯の大きさを測る ----------
    _layout(mods, S, sel, ng, marks, labels, showOpp, nameOf) {
      const lay = who => {
        const st = S[who], up = who === 'me';
        const castle = findCastle(st.castleId);
        const cells = castle ? parsePieces(castle.core).map(p =>
          up ? { p: p.p, f: p.f, r: p.r } : { p: p.p, f: 10 - p.f, r: 10 - p.r }) : [];
        return {
          st, castle, up, cells,
          minR: cells.length ? Math.min(...cells.map(cl => cl.r)) : 0,
          nRows: cells.length ? Math.max(...cells.map(cl => cl.r)) - Math.min(...cells.map(cl => cl.r)) + 1 : 0,
          maxF: cells.length ? Math.max(...cells.map(cl => cl.f)) : 9,
          fams: this._familiesOf(st.strategy),
        };
      };
      const L = { me: lay('me'), opp: lay('opp') };

      // 星座の実配置: 囲いの右端を原点に飛車中心で置く。席は駒に固有（左端は最大の駒が囲いにかぶらないよう測る）
      const place = who => {
        const { cells, fams, up, maxF } = L[who], out = [];
        const cx1 = cells.length ? Math.max(...cells.map(cl => colX(cl.f, maxF) + UW)) : X0;
        const leftMost = Math.max(...fams.map(f =>
          -((SEAT[f.piece][0] || 0) * SEAT_SCALE - famRX(f.piece))), 0);
        const tx0 = cx1 + 4.2 + leftMost; // 囲いと星座の間は前案の6割
        for (const fam of fams) {
          const seat = SEAT[fam.piece] || [0, 0];
          out.push({ fam, piece: fam.piece, x: tx0 + seat[0] * SEAT_SCALE,
            dy: (up ? seat[1] : -seat[1]) * SEAT_SCALE });
        }
        return out;
      };
      const PL = { me: place('me'), opp: place('opp') };
      const extent = (who, xPad) => {
        let top = 0, bot = 0;
        for (const t of PL[who]) {
          const ry = famRY(t.piece) + xPad;
          top = Math.max(top, -t.dy + ry);
          bot = Math.max(bot, t.dy + ry);
        }
        return { top, bot };
      };
      const coreH = who => L[who].nRows * UH;
      const coreHalf = who => Math.max(coreH(who) / 2, STR_R);
      // ng / implied は mods ではなく st から: _applyState より前に高さを決める必要があるため
      // ここでは ng[who] の有無で先読みする
      const ngOf = who => !!(ng[who] && (ng[who].castle && ng[who].castle.length));
      const lblOf = who => {
        const st = L[who].st;
        if (!L[who].cells.length) return 0;
        const imp = !!(st.implied && st.implied.castle);
        return ngOf(who) ? 44 : imp ? 34 : 21;
      };
      const upE = who => Math.max(coreHalf(who), E[who].top);
      const dnE = who => Math.max(coreHalf(who), E[who].bot, coreH(who) / 2 + lblOf(who));

      // Reserve enough river space for relation-label hit targets without overlapping either band.
      let clusterR = XR;
      for (const who of ['me', 'opp']) {
        if (who === 'opp' && !showOpp) continue;
        for (const t of PL[who]) clusterR = Math.max(clusterR, t.x + famRX(t.piece));
      }
      const W = Math.max(XR + 45, clusterR + 36);
      const scale = (this.el.clientWidth || W) / W;
      const E = { me: extent('me', 7 / scale), opp: extent('opp', 7 / scale) };
      const targetUnits = 46 / scale;
      const nPill = Math.min((labels && labels.length) || 0, 2);
      const pillGap = 3.6 / scale;
      const pillWidths = (labels || []).slice(0, 2).map(l =>
        Math.max(l.label.length * 13 + 21, targetUnits));
      const pillTotal = pillWidths.reduce((sum, width) => sum + width, 0)
        + Math.max(0, pillWidths.length - 1) * pillGap;
      let pillX = nPill > 1 ? Math.max(6, SX - pillTotal / 2) : SX - (pillWidths[0] || 0) / 2;
      this._pillLayout = pillWidths.map((hitW, i) => {
        const layout = { x: pillX, hitW, labelW: (labels[i].label.length * 13 + 21) };
        pillX += hitW + pillGap;
        return layout;
      });
      const pad = 1.2;
      const GAP = nPill ? targetUnits / 2 + 1.6 : 3.5;
      const oMidY = pad + upE('opp');
      const rivY = oMidY + dnE('opp') + GAP;
      const soloHead = showOpp ? 0 : 10.8;
      const mMidY = showOpp ? rivY + GAP + upE('me') : pad + soloHead + upE('me');
      const H = mMidY + dnE('me') + pad;
      const midYOf = who => who === 'opp' ? oMidY : mMidY;
      const casY = (who, r) => midYOf(who) - coreH(who) / 2 + (r - L[who].minR) * UH;
      this._rivY = rivY; this._midY = { me: mMidY, opp: oMidY };

      this._view = { y0: 0, h: H, w: W, scale };
      this.svg.setAttribute('viewBox', `0 0 ${f1(W)} ${f1(H)}`);
      this.el.style.aspectRatio = `${f1(W)} / ${f1(H)}`;

      // モジュールへ座標を振り、状態を反映させる
      for (const m of mods) {
        const who = m.who, midY = midYOf(who);
        if (m.kind === 'strategy') {
          m.cx = SX; m.cy = midY;
          m.x0 = SX - STR_R; m.x1 = SX + STR_R; m.y0 = midY - STR_R; m.y1 = midY + STR_R;
          m._castleMod = mods.find(x => x.who === who && x.kind === 'castle');
        } else if (m.kind === 'castle') {
          const { cells } = L[who];
          m.cells = cells.map(cl => ({ ...cl, x: colX(cl.f, L[who].maxF), y: casY(who, cl.r) }));
          if (m.cells.length) {
            m.x0 = Math.min(...m.cells.map(c => c.x));
            m.x1 = Math.max(...m.cells.map(c => c.x + UW));
            m.y0 = Math.min(...m.cells.map(c => c.y));
            m.y1 = Math.max(...m.cells.map(c => c.y + UH));
          } else { m.x0 = X0; m.x1 = X0 + UW * 3; m.y0 = midY - UH; m.y1 = midY + UH; }
        } else {   // tactic（席は fam.piece で決まる）
          const t = PL[who].find(p => p.fam.id === m.famId);
          if (!t) { m.x0 = m.x1 = m.y0 = m.y1 = 0; m.hidden = true; continue; }
          m.cx = t.x; m.cy = midY + t.dy; m.piece = t.piece;
          m.verts = famShapeV(m.cx, m.cy, m.piece, who === 'me');
          m.x0 = m.cx - famRX(m.piece); m.x1 = m.cx + famRX(m.piece);
          m.y0 = m.cy - famRY(m.piece); m.y1 = m.cy + famRY(m.piece);
          m._xPt = edgeRide(m.verts, m.cx, m.cy, who === 'me' ? -45 : 135);
          m._mPt = edgeRide(m.verts, m.cx, m.cy, who === 'me' ? -90 : 90);
        }
        this._applyState(m, sel, ng, marks);
      }
      if (labels) for (const lab of labels)
        lab.sel = sel.who === 'me' && sel.kind === 'senkei' && sel.id === lab.id;
      this._draw(mods, L, S, marks, labels, showOpp, nameOf, W, rivY);
      this._syncHits(mods);
      this._syncPills(labels, sel, showOpp);
      this._syncOppBtn(showOpp);
    }

    // 状態の反映: 選択・既定・両立しない・相性
    _applyState(m, sel, ng, marks) {
      if (m.kind === 'tactic') {
        m.sel = sel.who === m.who && sel.kind === 'tactic'
          && (sel.id ? sel.id === (m.id || m.famId) : m.id === Kakoi.defaults.primaryOf(m.st));
        m.implied = !m.empty && !!m.st.implied.tactic;
        m.removable = !m.empty && !m.implied;
        const reasons = !m.empty && !m.implied && ng[m.who] && ng[m.who].tactic
          ? ng[m.who].tactic[m.id] : null;
        m.ng = reasons && reasons.length ? reasons.map(r => plain(r.text)).join('／') : '';
        m.mark = m.empty ? null : (marks[m.who] && marks[m.who].tactic
          ? marks[m.who].tactic[m.id] : null) || null;
      } else if (m.kind === 'castle') {
        m.sel = sel.who === m.who && sel.kind === 'castle';
        m.implied = !!m.st.implied.castle;
        m.removable = !m.implied;
        const reasons = !m.implied && ng[m.who] ? ng[m.who].castle : null;
        m.ng = reasons && reasons.length ? reasons.map(r => plain(r.text)).join('／') : '';
        m.mark = (marks[m.who] && marks[m.who].castle) || null;
      } else {
        m.sel = sel.who === m.who && sel.kind === 'strategy';
        m.implied = false; m.removable = false; m.ng = ''; m.mark = null;
      }
    }

    // ---------- 描画 ----------
    _draw(mods, L, S, marks, labels, showOpp, nameOf, W, rivY) {
      const svg = this.svg;
      while (svg.lastChild) svg.lastChild.remove();
      const defs = svg$('defs', {}, svg);
      const p = svg$('pattern', { id: 'cf-hatch', width: 5, height: 5, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, defs);
      svg$('rect', { width: 5, height: 5, class: 'cf-imp-bg' }, p);
      svg$('line', { x1: 0, y1: 0, x2: 0, y2: 5, class: 'cf-imp-ln' }, p);

      for (const who of ['opp', 'me']) {
        const ms = mods.filter(m => m.who === who && !m.hidden);
        if (!ms.length) continue;
        const gRow = svg$('g', { class: `cf-row cf-${who}` }, svg);
        const midY = this._midY[who];
        for (const m of ms) {
          if (m.kind === 'strategy') this._drawStrategy(gRow, m, L[who]);
          else if (m.kind === 'castle') this._drawCastle(gRow, m, nameOf);
          else this._drawTactic(gRow, m, nameOf);
        }
        // 側ラベル（左端。選択中の側は強調する）
        const selSide = ms.some(m => m.sel);
        svg$('text', { x: 2, y: midY - 6 * ELEMENT_SCALE, class: `cf-who${selSide ? ' sel' : ''}` }, gRow)
          .textContent = WHO_JA[who];
        svg$('text', { x: 2, y: midY + 9 * ELEMENT_SCALE, class: 'cf-who cf-who-mark' }, gRow)
          .textContent = WHO_MARK[who];
      }
      this._drawOppGhost(svg, showOpp);
      this._drawSeamPills(labels, showOpp, svg);
      this._drawMarks(mods, showOpp, svg);
    }

    // 「＋相手」の胞（相手 OFF の間だけ。帯の上の左端に浮かべ、押すと相手を表示する）
    _drawOppGhost(svg, showOpp) {
      if (showOpp) return;
      const y = 22 * ELEMENT_SCALE;
      const g = svg$('g', { class: 'cf-opp-inv' }, svg);
      svg$('path', {
        d: roundPath(hexV(SX, y, 15 * ELEMENT_SCALE), 3 * ELEMENT_SCALE),
        class: 'cf-cell cf-ghost' }, g);
      svg$('text', {
        x: SX, y: y + 3.5 * ELEMENT_SCALE, class: 'cf-opp-t', 'text-anchor': 'middle' }, g).textContent = '＋相手';
      this._oppY = y;
    }

    // 関係ラベル（河の左端に浮くピル。最大2枚=大分類＋葉。implied は既定胞と同じ網掛け）
    _drawSeamPills(labels, showOpp, svg) {
      if (!showOpp || !labels || !labels.length) return;
      labels.slice(0, 2).forEach((lab, i) => {
        const sel2 = lab.sel ? ' sel' : '';
        const g = svg$('g', { class: `cf-seam${lab.implied ? ' imp' : ''}${sel2}` }, svg);
        const p = this._pillLayout[i], y = this._rivY;
        svg$('rect', {
          x: p.x + (p.hitW - p.labelW) / 2, y: y - 8.5 * ELEMENT_SCALE,
          width: p.labelW, height: 17 * ELEMENT_SCALE, rx: 8.5 * ELEMENT_SCALE }, g);
        svg$('text', { x: p.x + p.hitW / 2, y, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, g)
          .textContent = `#${lab.label}`;
      });
    }

    // 相性印: 河を向いた頂点/辺に緑の輝き・赤のひびを直接乗せる（星座は縦に詰まるので線は引かない）
    _drawMarks(mods, showOpp, svg) {
      if (!showOpp) return;
      const draw = (mark, x, y, up) => {
        if (mark === 'good') {
          svg$('circle', {
            cx: f1(x), cy: f1(y), r: 4.2 * ELEMENT_SCALE,
            class: 'cf-sm cf-sm-good cf-glint' }, svg);
        } else {
          const z = ELEMENT_SCALE;
          svg$('path', {
            d: `M${f1(x - 5 * z)} ${f1(y + (up ? -7 : -1) * z)}l${3 * z} ${3 * z}l${3 * z} ${-3.5 * z}l${3.5 * z} ${4 * z}l${3.5 * z} ${-2.5 * z}`,
            class: 'cf-sm cf-sm-bad cf-crack' }, svg);
        }
      };
      for (const m of mods.filter(m => m.kind === 'tactic' && !m.empty && !m.hidden && m.mark)) {
        const e = m._mPt, up = m.who === 'me';
        draw(m.mark, e[0], e[1], up);
      }
      // 囲いの相性も残すが、ピース上に横線は引かず河向きの外側に小さく置く
      for (const m of mods.filter(m => m.kind === 'castle' && m.mark && m.cells && m.cells.length)) {
        const up = m.who === 'me';
        const x = (m.x0 + m.x1) / 2;
        const y = up ? m.y0 - 3 * ELEMENT_SCALE : m.y1 + 3 * ELEMENT_SCALE;
        draw(m.mark, x, y, up);
      }
    }

    _drawStrategy(g, m, lay) {
      const cls = `cf-cell cf-str st-${m.st.strategy}${m.sel ? ' sel' : ''}`;
      svg$('path', { d: roundPath(hexV(m.cx, m.cy, STR_R), 5 * STRATEGY_SCALE), class: cls }, g);
      const name = [...(STR_SHORT[m.st.strategy] || strategyLabel(m.st.strategy))];
      const y0 = m.cy - (name.length - 1) * STR_DY / 2;
      name.forEach((ch, i) => {
        svg$('text', {
          x: m.cx, y: f1(y0 + i * STR_DY + 3 * STRATEGY_SCALE),
          class: 'cf-str-t', 'text-anchor': 'middle' }, g)
          .textContent = ch;
      });
      // 茎: 六角形の右頂点から囲いの各行へ扇状に開く
      const cm = m._castleMod;
      if (cm && cm.cells && cm.cells.length) {
        const x1 = Math.min(...cm.cells.map(c => c.x)) - 3;
        const ox = m.cx + STR_R * M2 - 1;
        const rows = [...new Set(cm.cells.map(c => c.r))].sort((a, b) => a - b);
        for (const r of rows) {
          svg$('line', {
            x1: f1(ox), y1: f1(m.cy), x2: f1(x1), y2: f1(
              cm.cells.find(c => c.r === r).y + UH / 2),
            class: 'cf-stem' }, g);
        }
        svg$('circle', { cx: f1(ox), cy: f1(m.cy), r: 1.6 * ELEMENT_SCALE, fill: 'var(--muted)' }, g);
      }
    }

    _drawCastle(g, m, nameOf) {
      if (!m.cells || !m.cells.length) return;
      const up = m.who === 'me';
      const cls = ['cf-mod', 'cf-castle', 'cf-castle-mod'];
      if (m.implied) cls.push('imp');
      if (m.ng) cls.push('ng');
      if (m.sel) cls.push('sel');
      const gg = svg$('g', { class: cls.join(' '), style: `--kc:var(--f-${(m.castle && m.castle.family) || 'funa'})` }, g);
      let dx = 0, dy = 0, angle = 0;
      const bcx = (m.x0 + m.x1) / 2, bcy = m.y1;
      if (m.ng) {
        dx = (up ? 10 : -10) * ELEMENT_SCALE;
        dy = (up ? -8 : 8) * ELEMENT_SCALE;
        angle = up ? 2.6 : -2.6;
        gg.setAttribute('transform', `translate(${dx} ${dy}) rotate(${angle} ${f1(bcx)} ${f1(bcy)})`);
      }
      const occ = new Map(m.cells.map(cl => [cl.f + ',' + cl.r, cl]));
      const jd = UH * .13;
      const jointD = [];
      for (const cl of m.cells) {
        const minor = MINOR.includes(cl.p);
        const d = cellPath(cl.x, cl.y, UW, UH, edgeOf(cl, occ, up), jd, 1);
        jointD.push(d);
        const clsP = `pk-${cl.p === '玉' ? 'gyoku' : minor ? 'shell' : 'core'}`;
        const impCls = m.implied ? ' imp' : '';
        const piecePath = svg$('path', {
          d, class: `cf-cell cf-castle pk-skin ${clsP}${cl.p === '玉' ? ' gy' : ''}${impCls}` }, gg);
        if (m.implied) {
          piecePath.style.fill = 'url(#cf-hatch)';
          piecePath.style.strokeDasharray = '2.5 2';
        }
        svg$('text', {
          x: f1(cl.x + UW / 2), y: f1(cl.y + UH / 2),
          class: `cf-t pk-kanji${minor ? ' minor' : ''}${cl.p === '玉' ? ' gy' : ''}`,
          'dominant-baseline': 'central', 'text-anchor': 'middle' }, gg).textContent = cl.p;
      }
      for (const d of jointD) svg$('path', { d, class: 'cf-j pk-joint' }, gg);

      // 囲い名と注記は、両側とも囲いの形の中央直下に置く（文字は正立）
      const name = m.castle ? nameOf(m.who, 'castle', m.id) : '';
      const short = (m.castle && m.castle.short) || name;
      const cx = (m.x0 + m.x1) / 2;
      svg$('text', { x: f1(cx), y: f1(m.y1 + 12 * ELEMENT_SCALE), class: 'cf-cname', 'text-anchor': 'middle' }, gg)
        .textContent = `${short}${m.implied ? '（既定）' : ''}`;
      if (m.implied) {
        svg$('text', { x: f1(cx), y: f1(m.y1 + 22 * ELEMENT_SCALE), class: 'cf-csub', 'text-anchor': 'middle' }, gg)
          .textContent = '既定・押して確定';
      } else if (m.ng) {
        svg$('text', { x: f1(cx), y: f1(m.y1 + 24 * ELEMENT_SCALE), class: 'cf-cng', 'text-anchor': 'middle' }, gg)
          .textContent = '✕ 配置不整合';
        svg$('path', {
          d: `M${f1(m.x0 - 12 * ELEMENT_SCALE)} ${f1((m.y0 + m.y1) / 2 - 8 * ELEMENT_SCALE)}l${4 * ELEMENT_SCALE} ${5 * ELEMENT_SCALE}l${-2 * ELEMENT_SCALE} ${5 * ELEMENT_SCALE}l${5 * ELEMENT_SCALE} ${4 * ELEMENT_SCALE}l${-3 * ELEMENT_SCALE} ${5 * ELEMENT_SCALE}`,
          class: 'cf-crack' }, gg);
      }
      const px = m.x1 + 4 * ELEMENT_SCALE, py = m.y0 - 4 * ELEMENT_SCALE;
      const a = angle * Math.PI / 180;
      m._xPt = [
        bcx + Math.cos(a) * (px - bcx) - Math.sin(a) * (py - bcy) + dx,
        bcy + Math.sin(a) * (px - bcx) + Math.cos(a) * (py - bcy) + dy,
      ];
    }

    _drawTactic(g, m, nameOf) {
      const up = m.who === 'me';
      const skinD = roundPath(m.verts, 3 * ELEMENT_SCALE);
      if (m.empty) {
        const gfs = Math.min(9 * ELEMENT_SCALE, famFitW(m.piece) / 2.6);
        const gg = svg$('g', { class: 'cf-mod cf-slot', 'data-piece': m.piece }, g);
        svg$('path', { d: skinD, class: 'cf-cell cf-ghost cf-tac' }, gg);
        svg$('text', { x: f1(m.cx), y: f1(m.cy + gfs * .36), class: 'cf-add', 'text-anchor': 'middle', 'font-size': f1(gfs) }, gg)
          .textContent = `＋${m.fam.piece}`;
        return;
      }
      const cls = ['cf-mod', 'cf-tactic', 'cf-tactic-mod'];
      if (m.sel) cls.push('sel');
      if (m.implied) cls.push('imp');
      if (m.ng) cls.push('ng');
      const gg = svg$('g', {
        class: cls.join(' '), 'data-id': m.id || '', 'data-piece': m.piece,
        style: `--kc:var(${FAMC[m.piece] || '--t-silver'})`,
      }, g);
      const impCls = m.implied ? ' imp' : '';
      const shape = svg$('path', { d: skinD, class: `cf-cell cf-tac tc-skin glyph${impCls}` }, gg);
      if (m.implied) {
        shape.style.fill = 'url(#cf-hatch)';
        shape.style.strokeDasharray = '2.5 2';
      }
      // 背後に薄い駒名、手前に戦法名（長い名前は2行で多角形の内側に収める）
      const r = FAMR[m.piece] || 18, fitW = famFitW(m.piece);
      const wfs = Math.min(r * .92, fitW * .82);
      svg$('text', { x: f1(m.cx), y: f1(m.cy), class: 'cf-t tc-wm', 'font-size': f1(wfs), 'dominant-baseline': 'central' }, gg)
        .textContent = m.piece;
      const fullName = (m.t && m.t.name) || nameOf(m.who, 'tactic', m.id) || '';
      const nm = [...(fullName.length <= 8 ? fullName : (m.t && m.t.short) || fullName)];
      const two = nm.length > 4;
      const l1 = two ? nm.slice(0, 4).join('') : nm.join(''), l2 = two ? nm.slice(4).join('') : '';
      const nfs = two ? Math.min(7.6 * ELEMENT_SCALE, fitW / Math.max([...l1].length, [...l2].length) * 1.02)
                      : Math.min(9.5 * ELEMENT_SCALE, fitW / [...l1].length * 1.02);
      if (two) {
        svg$('text', { x: f1(m.cx), y: f1(m.cy - nfs * .52), class: 'cf-tname tc-nm', 'font-size': f1(nfs) }, gg).textContent = l1;
        svg$('text', { x: f1(m.cx), y: f1(m.cy + nfs * 1.38), class: 'cf-tname tc-nm', 'font-size': f1(nfs) }, gg).textContent = l2;
      } else {
        svg$('text', { x: f1(m.cx), y: f1(m.cy + nfs * .36), class: 'cf-tname tc-nm', 'font-size': f1(nfs) }, gg).textContent = l1;
      }
      // 両立しない戦法: ×（外す側）と反対の辺にひび
      if (m.ng) {
        const q = edgeRide(m.verts, m.cx, m.cy, up ? 135 : -45);
        const z = ELEMENT_SCALE;
        svg$('path', {
          d: `M${f1(q[0] - 4 * z)} ${f1(q[1] - 3 * z)}l${2.5 * z} ${2.5 * z}l${2.5 * z} ${-2.5 * z}l${3 * z} ${3 * z}l${3 * z} ${-2 * z}`,
          class: 'cf-crack' }, gg);
      }
    }

    // ---------- 当たり判定: 図形の上に透明な <button> を重ねる（viewBox 座標→%） ----------
    _syncHits(mods) {
      const want = new Map();
      for (const m of mods) {
        if (m.hidden) continue;
        const box = this._hitBox(m);
        want.set(box.key, { m, ...box });
      }
      const seen = new Set();
      for (const [key, w2] of want) {
        seen.add(key);
        let b = this._nodes.get(key);
        if (!b) {
          b = document.createElement('button');
          b.type = 'button';
          b.className = 'cf-hit';
          this._nodes.set(key, b);
        }
        this._applyHit(b, w2.m);
        this._positionHit(b, w2);
        this.hits.appendChild(b);
        this._xButton(w2.m);
      }
      for (const [k, b] of this._nodes) {
        if (!seen.has(k)) {
          const x = this.hits.querySelector(`.cf-x[data-key="${k}"]`);
          if (x) x.remove();
          b.remove(); this._nodes.delete(k);
        }
      }
    }

    // Keep a 44px minimum target while centering it on the responsive SVG geometry.
    _positionHit(b, box) {
      const v = this._view;
      const left = (box.x + box.w / 2) / v.w * 100;
      const top = (box.y + box.h / 2 - v.y0) / v.h * 100;
      const halfW = box.w / v.w * 50;
      const halfH = box.h / v.h * 50;
      b.style.left = `calc(${left.toFixed(3)}% - max(${halfW.toFixed(3)}%, 23px))`;
      b.style.top = `calc(${top.toFixed(3)}% - max(${halfH.toFixed(3)}%, 23px))`;
      b.style.width = `max(${(box.w / v.w * 100).toFixed(3)}%, 46px)`;
      b.style.height = `max(${(box.h / v.h * 100).toFixed(3)}%, 46px)`;
    }

    // 当たり判定は図形の外接矩形より余白ぶん広く取る（R-2: 狭い画面の実効タップ領域。
    // 囲いは名前のあたりまで、戦法は隣の席と接する程度に留める）
    _hitBox(m) {
      const key = `${m.who}.${m.kind}.${m.id || m.famId || ''}`;
      if (m.kind === 'castle') {
        const extra = m.ng ? 44 : m.implied ? 34 : 21;
        const pad = 5.4;
        const shapeW = m.x1 - m.x0;
        const labelW = [...((m.castle && (m.castle.short || m.castle.name)) || '')].length
          * 13 * ELEMENT_SCALE + 12;
        const hitW = Math.max(shapeW, labelW) + pad * 2;
        return {
          key, x: (m.x0 + m.x1 - hitW) / 2, y: m.y0 - pad,
          w: hitW, h: m.y1 - m.y0 + pad + extra,
        };
      }
      if (m.kind === 'tactic') {
        const pad = 3.6;
        return { key, x: m.x0 - pad, y: m.y0 - pad, w: m.x1 - m.x0 + pad * 2, h: m.y1 - m.y0 + pad * 2 };
      }
      const pad = 4.8;
      return { key, x: m.x0 - pad, y: m.y0 - pad, w: m.x1 - m.x0 + pad * 2, h: m.y1 - m.y0 + pad * 2 };
    }

    // 河のピル（関係ラベル）の当たり判定
    _syncPills(labels, sel, showOpp) {
      const seen = new Set();
      if (showOpp && labels && labels.length) {
        labels.slice(0, 2).forEach((lab, i) => {
          const p = this._pillLayout[i], y = this._rivY;
          const key = `senkei.${i}.${lab.id}`;
          seen.add(key);
          let b = this._nodes.get(key);
          if (!b) {
            b = document.createElement('button');
            b.type = 'button';
            b.className = 'cf-hit cf-pill';
            this._nodes.set(key, b);
          }
          const sig = `${lab.id}|${lab.label}|${lab.implied}|${lab.sel}`;
          if (b._sig !== sig) {
            b._sig = sig;
            b.dataset.who = 'me';
            b.dataset.kind = 'senkei';
            b.dataset.id = lab.id;
            b.dataset.empty = 'false';
            b.dataset.implied = lab.implied ? 'true' : 'false';
            b.dataset.sel = lab.sel ? 'true' : 'false';
            const t = `戦型のラベル「#${lab.label}」${lab.implied ? '（既定からの導出）' : ''}（押すと情報を見る）`;
            b.title = t;
            b.setAttribute('aria-label', t);
          }
          this._positionHit(b, {
            x: p.x, y: y - 8.5 * ELEMENT_SCALE,
            w: p.hitW, h: 17 * ELEMENT_SCALE });
          this.hits.appendChild(b);
        });
      }
      for (const [k, b] of this._nodes) {
        if (k.startsWith('senkei.') && !seen.has(k)) { b.remove(); this._nodes.delete(k); }
      }
    }

    // 「＋相手」の胞の当たり判定
    _syncOppBtn(showOpp) {
      let b = this.hits.querySelector('.cf-opp');
      if (showOpp) { if (b) b.remove(); return; }
      if (!b) {
        b = document.createElement('button');
        b.type = 'button';
        b.className = 'cf-hit cf-opp';
        b.dataset.who = 'opp';
        const t = '相手を盤に表示する';
        b.title = t; b.setAttribute('aria-label', t);
        this.hits.append(b);
      }
      const r = 19 * ELEMENT_SCALE, y = this._oppY || 22 * ELEMENT_SCALE;
      this._positionHit(b, { x: SX - r, y: y - r, w: 2 * r, h: 2 * r });
    }

    // 側ごとの「リセット」: 帯の右端に × を立てる。明示したスロットが無い側は出さない
    _syncClears(mods, showOpp) {
      const sl = this._slots || {};
      for (const who of ['me', 'opp']) {
        let b = this.hits.querySelector(`.cf-clear[data-who="${who}"]`);
        const side = sl[who] || {};
        const hasTac = Array.isArray(side.tactic) ? side.tactic.length > 0 : side.tactic != null;
        const has = (who !== 'opp' || showOpp) && (hasTac || side.castle != null);
        if (!has) { if (b) b.remove(); continue; }
        if (!b) {
          b = document.createElement('button');
          b.type = 'button';
          b.className = 'cf-clear';
          b.dataset.who = who;
          b.tabIndex = -1;
          b.textContent = '×';
          this.hits.append(b);
        }
        const t = `${WHO_JA[who]}の戦法・囲いをリセット`;
        b.title = t; b.setAttribute('aria-label', t);
        const v = this._view || { y0: 0, h: 200, w: 400 };
        const x = (v.w || 400) - 12 / (v.scale || 1);
        const y = this._midY ? this._midY[who] : 100;
        b.style.left = `calc(${(x / v.w * 100).toFixed(3)}% - 9.9px)`;
        b.style.top = `calc(${((y - v.y0) / v.h * 100).toFixed(3)}% - 9.9px)`;
      }
    }

    _applyHit(b, m) {
      const sig = `${m.who}|${m.kind}|${m.id || ''}|${m.sel}|${m.implied}|${m.removable}|${m.ng}|${m.empty}`;
      if (b._sig === sig) return;
      b._sig = sig;
      b.dataset.who = m.who;
      b.dataset.kind = m.kind;
      b.dataset.id = m.kind === 'strategy' ? '' : (m.id || m.famId || '');
      b.dataset.empty = m.empty ? 'true' : 'false';
      b.dataset.implied = m.implied ? 'true' : 'false';
      b.dataset.sel = m.sel ? 'true' : 'false';
      b.dataset.ng = m.ng ? 'true' : 'false';
      const base = `${WHO_JA[m.who]}の${KIND_LABEL[m.kind]}`;
      if (m.kind === 'strategy') {
        b.title = `${base}（押すと情報を見る）`;
        b.setAttribute('aria-label', `${base}「${strategyLabel(m.st.strategy)}」`);
      } else if (m.empty) {
        b.title = `${base}: ${m.fam.name}（空きの枠。押すとこの系統の一覧を開く）`;
        b.setAttribute('aria-label', b.title);
      } else {
        const t = m.kind === 'tactic' ? m.t : m.castle;
        const name = t ? t.name : '';
        const imp = m.implied ? '（既定値。押して確定）' : '';
        b.title = `${name}${imp}${m.ng ? `。両立しない: ${m.ng}` : ''}`;
        b.setAttribute('aria-label', `${base}「${name}」${imp}${m.ng ? `。両立しない: ${m.ng}` : ''}`);
      }
    }

    _xButton(m) {
      const key = `${m.who}.${m.kind}.${m.id || m.famId || ''}`;
      let x = this.hits.querySelector(`.cf-x[data-key="${key}"]`);
      if (!m.removable || !m._xPt) { if (x) x.remove(); return; }
      if (!x) {
        x = document.createElement('button');
        x.type = 'button';
        x.className = 'cf-x';
        x.dataset.key = key;
        x.tabIndex = -1;                    // キー操作は層の Delete/Backspace で（U3）
        x.textContent = '×';
        this.hits.append(x);
      }
      x.dataset.who = m.who; x.dataset.kind = m.kind; x.dataset.id = m.id || '';
      const t = m.kind === 'tactic' ? m.t : m.castle;
      const xt = `${WHO_JA[m.who]}の${KIND_LABEL[m.kind]}「${t ? t.name : ''}」を外す`;
      x.title = xt; x.setAttribute('aria-label', xt);
      const v = this._view;
      x.style.left = `calc(${(m._xPt[0] / v.w * 100).toFixed(3)}% - 8.1px)`;
      x.style.top = `calc(${((m._xPt[1] - v.y0) / v.h * 100).toFixed(3)}% - 8.1px)`;
    }
  }

  Kakoi.ConstraintField = ConstraintField;
})();
