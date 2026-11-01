// 制約フィールド: 盤の上に1枚だけ敷く蜂の巣（多角形モジュール。design-refs-binder-chain-v2a B2案）。
// 両側を同じ六角グリッドに並べるので、自分の戦法の胞と相手の囲いの胞が河を隔てて
// 辺を共有する。共有辺には「相手との相性」（compat.judge().vs の◎/△と同じ意味）を
// 緑/赤で描き、同じ持ち主の胞どうしの継ぎ目は淡い目地にする。
//
//   上の段=相手（先が下向き。胞の漢字は相手に向けて180°回転する）
//     Y0: 相手の戦法ドミノ → Y1..3: 相手の囲いポリへックス
//   ── 河（関係ラベルのピルが左端に浮く）──
//     Y4: 自分の戦法ドミノ → Y5..7: 自分の囲いポリへックス
//   左端には各側の戦型の大きな胞（根元）＋側ラベル。戦型はスロットを持たない
//   導出値だが、押すと右ドックにその戦型の情報が出る。
//
// 戦法は駒（lead.piece）ごとの枠が複数ある（囲いと違い、駒が違えば複数同時に採用
// できる）。系統の列は戦型ごとに決まる（居飛車: 飛/銀/角、振り飛車: 飛）。空きの枠は
// 「＋駒」の薄いドミノで示し、押すとその系統の一覧を開く。
// 明示した層はいつでも×で外せる（外すと戦略既定値の既定胞に変わる）。既定値で
// 補った胞（implied）は網掛けで薄く、×は付けない。両立しない明示胞は群れごと
// ずらして傾け、✕と理由（title）を付ける（自動では差し替えない）。
// 操作は透明な <button> の重なり（roving tabindex・Delete/Backspace・title）が受ける。
// 計画書 §0-2 / §1-1 / §1-4 / U3 / U5。
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';
  const { findTactic, findCastle, tacticFamilyOf, castleSides, strategyLabel } = Kakoi.lookup;
  const { parsePieces } = Kakoi.notation;
  const { plain } = Kakoi.html;
  const KIND_LABEL = { strategy: '戦型', castle: '囲い', tactic: '戦法' };

  // ---------- 六角グリッドの幾何（リファレンス hexScene。胞を読める大きさにするため
  // 中身の幅いっぱいに viewBox を切る: 左=戦型の胞＋側ラベル、右=囲い/戦法の群れ） ----------
  const W = 395, H = 224;
  const s = 15, w = Math.sqrt(3) * s, rowH = 1.5 * s;
  const X0 = 130, Y0 = 26, SX = 68;              // 胞フィールドの原点・戦型の胞の列
  const STR_R = s * 1.3;                          // 戦型の胞の半径
  const cy = Y => Y0 + Y * rowH;
  const cx = (c, Y) => X0 + c * w + (Y % 2 ? w / 2 : 0);
  const SVGNS = 'http://www.w3.org/2000/svg';
  const M2 = Math.sqrt(3) / 2;
  const svg$ = (tag, attrs, parent) => {
    const n = document.createElementNS(SVGNS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  };
  // 上に頂点を持つ正六角形の頂点（v0=上 → 時計回り）
  const hexV = (ccx, ccy, r = s) => [90, 150, 210, 270, 330, 30]
    .map(a => [ccx + r * Math.cos(a * Math.PI / 180), ccy + r * Math.sin(a * Math.PI / 180)]);
  // 角をわずかに丸めた六角形のパス
  const roundPath = (pts, r = 2) => {
    const n = pts.length, out = [];
    for (let i = 0; i < n; i++) {
      const p = pts[i], a = pts[(i + n - 1) % n], b = pts[(i + 1) % n];
      const toward = q => {
        const dx = q[0] - p[0], dy = q[1] - p[1], d = Math.hypot(dx, dy);
        return [p[0] + dx / d * r, p[1] + dy / d * r];
      };
      const e1 = toward(a), e2 = toward(b);
      out.push(`${i ? 'L' : 'M'}${e1.map(x => x.toFixed(2)).join(' ')}Q${p.map(x => x.toFixed(2)).join(' ')} ${e2.map(x => x.toFixed(2)).join(' ')}`);
    }
    return out.join('') + 'Z';
  };
  const segPath = segs => segs.map(([a, b]) =>
    `M${a[0].toFixed(2)} ${a[1].toFixed(2)}L${b[0].toFixed(2)} ${b[1].toFixed(2)}`).join('');
  const f1 = n => +n.toFixed(2);
  // 頂点・辺のキー（共有辺の検出用。座標は丸めて一致させる）
  const vk = p => p.map(n => n.toFixed(1)).join(',');
  const ek = (a, b) => [vk(a), vk(b)].sort().join('|');

  // ---------- 行の割り当て（河=自分の戦法段と相手の囲い下段の間） ----------
  const Y_TACTIC = { me: 4, opp: 0 };
  // 囲いの胞の行: 自分=5+r / 相手=1+(2-r)（r は囲いの段 0..2。相手は上下反転）
  const YCastle = (who, r) => who === 'opp' ? 1 + (2 - r) : 5 + r;
  // 戦法の系統の列（リファレンス FAMCOL。駒の漢字→2胞の左端の列）
  const FAMCOL = { ibisha: { '飛': 0, '銀': 2, '角': 4, '桂': 6, '歩': 8, '金': 10, '玉': 12 },
                   furibisha: { '飛': 2 } };
  const FAM_RANK = { '飛': 0, '銀': 1, '角': 2, '桂': 3, '歩': 4, '金': 5, '玉': 6 };
  // 囲いの陣形を胞の列・段にする。盤の筋・段の関係を残す（先手の座標のまま。
  // 相手は段だけを反転し、駒の漢字を180°回す = 盤と同じ向き）。
  // 窓は「玉のいる筋」で決める（囲いの side は戦型属性なので、左美濃のような
  // 居飛車側の左陣形は L 窓に入る）。前線=最も低い段を胞の段0に揃える
  const WINC = { R: f => 9 - f, L: f => 5 - f, C: f => 7 - f };
  function castleCells(castle) {
    const pcs = parsePieces((castle && castle.core) || '');
    const king = pcs.find(x => x.p === '玉');
    const win = !king || king.f >= 6 ? 'R' : king.f <= 4 ? 'L' : 'C';
    const r0 = Math.min(7, ...pcs.map(x => x.r));
    const cells = pcs.map(x => ({ p: x.p, col: WINC[win](x.f), row: x.r - r0 }));
    // 群れは形のまま右へ寄せ、最左の列を -1 に抑える（左の戦型の胞に重ならない範囲）
    const cmin = Math.min(...cells.map(c => c.col));
    if (cmin < -1) for (const c of cells) c.col += -1 - cmin;
    return cells;
  }

  const MINOR = '香桂歩';
  const WHO_JA = { me: '自分', opp: '相手' };
  const WHO_MARK = { me: '▲', opp: '△' };

  class ConstraintField {
    /**
     * @param {HTMLElement} el `.cfield` の入れ物（1枚の帯。両側を1つのSVGに描く）
     * @param {{ onSelect:(who:'me'|'opp', kind:string, id:?string)=>void,
     *   onRemove:(who:string, kind:string, id:?string)=>void,
     *   onOpp:(on:boolean)=>void }} handlers
     *   onSelect: 胞の選択（tactic の空き枠は id=系統の id）
     *   onRemove: 明示した層を外す（tactic はその id だけ、castle はその側）
     *   onOpp: 「＋相手」の胞で相手の表示を ON にする
     */
    constructor(el, { onSelect, onRemove, onOpp, onClear }) {
      this.el = el;
      this._onClear = onClear;
      this._nodes = new Map();   // 'who.kind.id' → .cf-hit 要素（差分更新でフォーカスを保つ。U3）
      el.classList.add('cfield');
      this.svg = svg$('svg', { class: 'cf-svg', viewBox: `0 0 ${W} ${H}`, 'aria-hidden': 'true' });
      this.hits = document.createElement('span');
      this.hits.className = 'cf-hits';
      el.append(this.svg, this.hits);
      el.addEventListener('click', e => {
        const x = e.target.closest('.cf-x');
        if (x) { onRemove(x.dataset.who, x.dataset.kind, x.dataset.id || null); return; }
        const c = e.target.closest('.cf-clear');
        if (c) { onClear(c.dataset.who); return; }
        const g = e.target.closest('.cf-opp');
        if (g) { onOpp(true); return; }
        const b = e.target.closest('.cf-hit');
        if (b) onSelect(b.dataset.who, b.dataset.kind, b.dataset.id || null);
      });
      // Delete/Backspace でその胞の制約を外す（U3）。矢印は roving がフォーカスだけを動かす
      el.addEventListener('keydown', e => {
        if (e.key !== 'Delete' && e.key !== 'Backspace') return;
        const b = e.target.closest('.cf-hit');
        if (!b || b.dataset.kind === 'strategy' || b.dataset.empty === 'true'
          || b.dataset.implied === 'true') return;
        e.preventDefault();
        onRemove(b.dataset.who, b.dataset.kind, b.dataset.id || null);
      });
      this._roving = Kakoi.roving.attach(this.hits, '.cf-hit');
    }

    /**
     * @param {{ S:{me:Object, opp:Object}, slots:Object, ng:Object, marks:Object,
     *   labels:Array<{label:string}>, selected:string|null, showOpp:boolean,
     *   nameOf:(who:string, kind:string, id:string)=>string }} d
     *   S: constraints.sides() の出力（実効値・implied）。
     *   ng: conflicts() の出力 {who:{tactic:{id:[reason]}, castle:[reason]}}
     *   marks: 層ごとの相手との相性 {who:{tactic:{id:'good'|'bad'|null}, castle:level}}
     *   labels: 関係ラベル（河に浮くピル）
     */
    render({ S, slots, ng, marks, labels, selected, showOpp, nameOf }) {
      this._slots = slots;
      const sel = Kakoi.constraints.parseSel(selected) || {};
      const mods = [];   // 胞モジュールの実体（SVGに描くもの＋当たり判定）
      for (const who of ['opp', 'me']) {
        if (who === 'opp' && !showOpp) continue;
        const st = S[who];
        const side = st.strategy;
        const Yc = YCastle(who, 1);                     // 囲いの中段の行（縦の中心）
        const midY = cy(Yc);
        // 戦型の大きな胞（根元）＋胞の群れへの茎
        mods.push({ who, kind: 'strategy', id: side, cx: SX, cy: midY, st });
        // 囲いのポリへックス
        const castle = findCastle(st.castleId);
        mods.push({ who, kind: 'castle', id: st.castleId, castle, st });
        // 戦法の枠: 系統（駒）ごとに1ドミノ。使われていない系統は空き枠
        const fams = this._familiesOf(side);
        const used = new Set();
        for (const id of st.tacticIds) {
          const t = findTactic(id);
          const fam = t && tacticFamilyOf(t);
          const famId = fam ? fam.id : `x-${id}`;
          used.add(famId);
          mods.push({ who, kind: 'tactic', id, famId, t, fam, st });
        }
        for (const fam of fams) {
          if (used.has(fam.id)) continue;
          mods.push({ who, kind: 'tactic', id: null, famId: fam.id, fam, st, empty: true });
        }
      }
      this._layout(mods, sel, ng, marks, labels, showOpp, nameOf);
      this._syncClears(mods, showOpp);
      this._roving.refresh();
    }

    // 側ごとの「リセット」: その側のアンカー（囲いモジュール）の右上に × を立てる。
    // 明示したスロットが無い側は出さない
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
        const v = this._view || { y0: 0, h: H };
        const cm = mods.find(m => m.who === who && m.kind === 'castle' && m.x1 != null);
        const x = cm ? cm.x1 + 6 : (v.w || W) - 26;
        const y = cm ? cm.y0 + 12 : cy(YCastle(who, 1)) - 11;
        b.style.left = `${(x / (v.w || W) * 100).toFixed(3)}%`;
        b.style.top = `${((y - v.y0) / v.h * 100).toFixed(3)}%`;
      }
    }

    // その戦型で取りうる戦法の系統（駒）を FAMCOL の順に並べる
    _familiesOf(side) {
      return (Kakoi.TACTIC_FAMILIES || []).filter(f => f.side === side)
        .sort((a, b) => (FAM_RANK[a.piece] ?? 9) - (FAM_RANK[b.piece] ?? 9));
    }

    // ---------- 幾何: モジュールへ座標を振り、共有辺（河の継ぎ目）を見つける ----------
    _layout(mods, sel, ng, marks, labels, showOpp, nameOf) {
      // 深い囲い（段6以下まで降りる）がグリッドをはみ出す分、上下を広げる。
      // 相手側は戦法の段を上へずらして胞の衝突を避ける
      const ext = { top: 0, bot: 0 };
      for (const m of mods) {
        if (m.kind !== 'castle') continue;
        m._rows = castleCells(m.castle);
        const over = Math.max(0, ...m._rows.map(p => p.row - 2));
        if (m.who === 'opp') ext.top = Math.max(ext.top, over);
        else ext.bot = Math.max(ext.bot, over);
      }
      const cells = [];   // {key, pts, ccx, ccy} 共有辺検出に登録する全部の胞
      const addCell = (key, ccx, ccy, r = s) => cells.push({ key, pts: hexV(ccx, ccy, r), ccx, ccy, r });
      // 戦法ドミノの列の割り当て: 系統の既定列→重なるときは右へずらす
      const usedCols = { me: new Set(), opp: new Set() };
      const colOf = m => {
        const base = (FAMCOL[m.st.strategy] || {})[(m.fam && m.fam.piece) || '飛'] ?? 0;
        let c0 = base;
        while (usedCols[m.who].has(c0)) c0 += 2;
        usedCols[m.who].add(c0); usedCols[m.who].add(c0 + 1);
        return c0;
      };
      for (const m of mods) {
        if (m.kind === 'castle') {
          m.cells = m._rows.map(p => {
            const Y = YCastle(m.who, p.row);
            const ccx = cx(p.col, Y), ccy = cy(Y);
            return { ...p, ccx, ccy };
          });
          for (const c of m.cells) addCell(`${m.who}.castle`, c.ccx, c.ccy);
          const xs = m.cells.map(c => c.ccx), ys = m.cells.map(c => c.ccy);
          m.x0 = Math.min(...xs) - w / 2; m.x1 = Math.max(...xs) + w / 2;
          m.y0 = Math.min(...ys) - s; m.y1 = Math.max(...ys) + s;
          // 戦型の胞→囲いの群れの茎を引くため、戦型側に囲いモジュールを持たせる
          const str = mods.find(x => x.who === m.who && x.kind === 'strategy');
          if (str) str._castleMod = m;
        } else if (m.kind === 'tactic') {
          const c0 = colOf(m), Y = m.who === 'opp' ? -ext.top : Y_TACTIC.me;
          m.cells = [0, 1].map(i => ({ ccx: cx(c0 + i, Y), ccy: cy(Y) }));
          for (const c of m.cells) addCell(`${m.who}.tactic.${m.famId}`, c.ccx, c.ccy);
          m.c0 = c0; m.Y = Y;
          m.x0 = m.cells[0].ccx - w / 2; m.x1 = m.cells[1].ccx + w / 2;
          m.y0 = m.cells[0].ccy - s; m.y1 = m.cells[0].ccy + s;
        } else {   // strategy
          addCell(`${m.who}.strategy`, m.cx, m.cy, STR_R);
          m.x0 = m.cx - STR_R; m.x1 = m.cx + STR_R; m.y0 = m.cy - STR_R; m.y1 = m.cy + STR_R;
        }
        // 状態の反映: 選択・既定・両立しない・相性
        if (m.kind === 'tactic') {
          m.sel = sel.who === m.who && sel.kind === 'tactic'
            && (sel.id ? sel.id === (m.id || m.famId) : m.id === m.st.tacticId);
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
      // 共有辺: 同じ持ち主の中は細い目地、河をまたぐ（自分の戦法×相手の囲い）は相性の印に
      const emap = new Map();
      for (const cl of cells) cl.pts.forEach((a, k) => {
        const b = cl.pts[(k + 1) % 6];
        if (vk(a) === vk(b)) return;
        const u = ek(a, b);
        if (!emap.has(u)) emap.set(u, []);
        emap.get(u).push({ key: cl.key, a, b });
      });
      const joints = {}, seams = [];
      for (const L of emap.values()) {
        if (L.length !== 2) continue;
        const [e0, e1] = L;
        if (e0.key === e1.key) { (joints[e0.key] = joints[e0.key] || []).push([e0.a, e0.b]); continue; }
        const meT = [e0, e1].find(e => /^me\.tactic\./.test(e.key));
        const oc = [e0, e1].find(e => e.key === 'opp.castle');
        if (meT && oc) seams.push({ famId: meT.key.slice(10), a: e0.a, b: e0.b });
        else {
          (joints[e0.key] = joints[e0.key] || []).push([e0.a, e0.b]);
          (joints[e1.key] = joints[e1.key] || []).push([e1.a, e1.b]);
        }
      }
      // viewBox ははみ出し分だけ上下に広げる（ヒット層の % 座標も同じ枠で換算する）。
      // 横方向も同じく: 系統の多い戦型（居飛車=7系統）では戦法のドミノが W を
      // 越えるので、最右の胞＋余白まで viewBox を広げる。さもないと右端の空き枠が
      // 切れて押せないままになる
      const rightEdge = Math.max(W, ...mods.map(m => (m.x1 || 0) + 8));
      const yCut = showOpp ? 0 : cy(3) + s * .45;
      const y0 = yCut - ext.top * rowH, hEff = (H - yCut) + (ext.top + ext.bot) * rowH;
      this._view = { y0, h: hEff, w: rightEdge };
      this.svg.setAttribute('viewBox', `0 ${f1(y0)} ${f1(rightEdge)} ${f1(hEff)}`);
      this.el.style.aspectRatio = `${f1(rightEdge)} / ${f1(hEff)}`;
      this._draw(mods, joints, seams, marks, labels, showOpp, nameOf);
      this._syncHits(mods);
      this._syncOppBtn(showOpp);
    }

    // 「＋相手」の胞の当たり判定（SVG の幽霊胞の上に透明ボタンを重ねる）
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
      const v = this._view, r = s * 1.4 + 4, y = cy(3.6);
      b.style.left = `${((SX - r) / v.w * 100).toFixed(3)}%`;
      b.style.top = `${((y - r - v.y0) / v.h * 100).toFixed(3)}%`;
      b.style.width = `${(2 * r / v.w * 100).toFixed(3)}%`;
      b.style.height = `${(2 * r / v.h * 100).toFixed(3)}%`;
    }

    // ---------- 描画 ----------
    _draw(mods, joints, seams, marks, labels, showOpp, nameOf) {
      const svg = this.svg;
      while (svg.lastChild) svg.lastChild.remove();
      const defs = svg$('defs', {}, svg);
      // 既定値（implied）の網掛けパターン（svg 内で1つ）
      const p = svg$('pattern', { id: 'cf-hatch', width: 5, height: 5, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, defs);
      svg$('rect', { width: 5, height: 5, class: 'cf-imp-bg' }, p);
      svg$('line', { x1: 0, y1: 0, x2: 0, y2: 5, class: 'cf-imp-ln' }, p);

      for (const who of ['opp', 'me']) {
        const ms = mods.filter(m => m.who === who);
        if (!ms.length) continue;
        const gRow = svg$('g', { class: `cf-row cf-${who}` }, svg);
        for (const m of ms) {
          if (m.kind === 'strategy') this._drawStrategy(gRow, m);
          else if (m.kind === 'castle') this._drawCastle(gRow, m, joints[`${who}.castle`], nameOf);
          else this._drawTactic(gRow, m, joints[`${who}.tactic.${m.famId}`], nameOf);
        }
        // 側ラベル（左端。選択中の側は強調する）
        const midY = cy(YCastle(who, 1));
        svg$('text', { x: 10, y: midY - 7, class: `cf-who${ms.some(m => m.sel) ? ' sel' : ''}` }, gRow)
          .textContent = WHO_JA[who];
        svg$('text', { x: 10, y: midY + 9, class: 'cf-who cf-who-mark' }, gRow)
          .textContent = WHO_MARK[who];
      }
      // 「＋相手」の胞（相手 OFF の間だけ。河の左端に浮かべ、押すと相手を表示する）
      if (!showOpp) {
        const g = svg$('g', { class: 'cf-opp-inv' }, svg);
        const y = cy(3.6);
        svg$('path', { d: roundPath(hexV(SX, y, s * 1.4), 3), class: 'cf-cell cf-ghost' }, g);
        svg$('text', { x: SX, y: y + 4, class: 'cf-opp-t', 'text-anchor': 'middle' }, g).textContent = '＋相手';
      }
      // 関係ラベル（河の左端。戦型どうし・戦型の名前）
      if (showOpp && labels && labels.length) {
        const yMid = (cy(3) + s + cy(4) - s) / 2;
        labels.forEach((lab, i) => {
          const g = svg$('g', { class: 'cf-seam' }, svg);
          const y = yMid + (i - (labels.length - 1) / 2) * 19;
          const w2 = lab.label.length * 10 + 16;
          svg$('rect', { x: SX - w2 / 2, y: y - 8.5, width: w2, height: 17, rx: 8.5 }, g);
          svg$('text', { x: SX, y: y + 0.5, 'text-anchor': 'middle' }, g).textContent = `#${lab.label}`;
        });
      }
      // 共有辺の相性の印（河をまたぐ辺）。辺が取れない戦法は胞の上の目地に短く
      for (const m of mods.filter(m => m.kind === 'tactic' && m.who === 'me' && m.mark)) {
        const es = seams.filter(se => se.famId === m.famId).map(se => [se.a, se.b]);
        if (es.length) {
          svg$('path', { d: segPath(es), class: `cf-sm cf-sm-${m.mark}` }, svg);
          if (m.mark === 'good') {
            const [a, b] = es[Math.floor(es.length / 2)];
            svg$('circle', { cx: f1((a[0] + b[0]) / 2), cy: f1((a[1] + b[1]) / 2), r: 6, class: 'cf-glint' }, svg);
          } else {
            const [a, b] = es[0];
            const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
            svg$('path', { d: `M${f1(mx - 6)} ${f1(my + 5)}l3 3l3 -3.5l3.5 4l3.5 -2.5`, class: 'cf-crack' }, svg);
          }
        } else {
          // 相手の囲いと辺を共有しない戦法: ドミノの上辺の目地に短い印
          const mid = (m.cells[0].ccx + m.cells[1].ccx) / 2;
          svg$('line', {
            x1: mid, y1: f1(m.y0 - 5), x2: mid, y2: f1(m.y0 + 2),
            class: `cf-sm cf-sm-${m.mark}` }, svg);
        }
      }
      // 相手の戦法は河をまたぐ辺を持たない: ドミノの下辺（河側）の目地に短い印
      for (const m of mods.filter(m => m.kind === 'tactic' && m.who === 'opp' && m.mark)) {
        const mid = (m.cells[0].ccx + m.cells[1].ccx) / 2;
        svg$('line', {
          x1: mid, y1: f1(m.y1 - 2), x2: mid, y2: f1(m.y1 + 5),
          class: `cf-sm cf-sm-${m.mark}` }, svg);
      }
      // 囲いの河側の目地にも相性を出す（前線の胞の河向きの辺）
      for (const m of mods.filter(m => m.kind === 'castle' && m.mark)) {
        const front = m.cells.filter(c => c.row === 0);   // 段7=河側の最前線
        for (const c of front) {
          const v = hexV(c.ccx, c.ccy, s);
          for (const e of (m.who === 'me' ? [5, 0] : [2, 3])) {
            const [a, b] = [v[e], v[(e + 1) % 6]];
            svg$('line', {
              x1: f1(a[0]), y1: f1(a[1]), x2: f1(b[0]), y2: f1(b[1]),
              class: `cf-sm cf-sm-${m.mark}` }, svg);
          }
        }
      }
    }

    _drawStrategy(g, m) {
      const st = m.st;
      const cls = `cf-cell cf-str st-${st.strategy}${m.sel ? ' sel' : ''}`;
      svg$('path', { d: roundPath(hexV(m.cx, m.cy, STR_R), 4), class: cls }, g);
      const name = [...strategyLabel(st.strategy)];
      const dy = name.length > 3 ? 8 : 11, y0 = m.cy - (name.length - 1) * dy / 2;
      name.forEach((ch, i) => {
        svg$('text', { x: m.cx, y: f1(y0 + i * dy), class: 'cf-str-t', 'text-anchor': 'middle', ...{} }, g)
          .textContent = ch;
      });
      // 胞の群れへの茎（点線）
      const castle = m._castleMod;
      if (castle && castle.cells.length) {
        const x1 = Math.min(...castle.cells.map(c => c.ccx)) - w / 2 - 4;
        const ys = [castle.y0 + s, m.cy, castle.y1 - s];
        const segs = ys.map((y, i) => [
          [m.cx + STR_R * M2 * (i === 1 ? 1 : .82), m.cy + (i - 1) * 14],
          [x1, y],
        ]);
        svg$('path', { d: segPath(segs), class: 'cf-stem' }, g);
      }
    }

    _drawCastle(g, m, jointSegs, nameOf) {
      const cls = [`cf-mod cf-castle`];
      if (m.implied) cls.push('imp');
      if (m.ng) cls.push('ng');
      if (m.sel) cls.push('sel');
      // 嵌まらない時は群れごとずらして傾ける
      const bcx = (m.x0 + m.x1) / 2;
      const gg = svg$('g', { class: cls.join(' ') }, g);
      if (m.ng) gg.setAttribute('transform', `translate(9 -7) rotate(3 ${f1(bcx)} ${f1(m.y1 - 20)})`);
      for (const c of m.cells) {
        const cell = svg$('path', {
          d: roundPath(hexV(c.ccx, c.ccy), 2),
          class: `cf-cell cf-castle${c.p === '玉' ? ' gy' : ''}${m.implied ? ' imp' : ''}${m.ng ? ' ng' : ''}` }, gg);
        if (m.implied) { cell.style.fill = 'url(#cf-hatch)'; cell.style.strokeDasharray = '2.5 2'; }
        const minor = MINOR.includes(c.p);
        svg$('text', {
          x: c.ccx, y: c.ccy + (minor ? 1 : 0), class: `cf-t${minor ? ' minor' : ''}`,
          'font-size': minor ? 8.5 : 11, 'text-anchor': 'middle',
          ...(m.who === 'opp' ? { transform: `rotate(180 ${f1(c.ccx)} ${f1(c.ccy)})` } : {}),
        }, gg).textContent = c.p;
      }
      if (jointSegs && jointSegs.length) {
        svg$('path', { d: segPath(jointSegs), class: 'cf-j cf-j-castle' }, gg);
      }
      // 囲いの名前と注記（自分=群れの右下の角に左詰め。相手=河の右端。戦法の段と
      // 横方向が重ならない場所だけを使う）
      const name = m.castle ? nameOf(m.who, 'castle', m.id) : '';
      const tx = m.who === 'me' ? m.x1 + 2 : ((this._view && this._view.w) || W) - 8;
      const ty = m.who === 'me' ? m.y1 + 4 : (cy(3) + cy(4)) / 2;
      // 相手の文字は 180° 回す（回転で向きが変わるので start で置くと右端に揃う）
      const rot = m.who === 'opp' ? { transform: `rotate(180 ${f1(tx)} ${f1(ty)})` } : {};
      const anchor = m.who === 'opp' ? 'start' : 'end';
      svg$('text', { x: tx, y: f1(ty), class: 'cf-cname', 'text-anchor': anchor, ...rot }, gg).textContent = name;
      if (m.implied) {
        const y2 = m.who === 'me' ? ty + 10 : ty - 10;
        svg$('text', { x: tx, y: f1(y2), class: 'cf-csub', 'text-anchor': anchor, ...rot }, gg).textContent = '既定・押して確定';
      } else if (m.ng) {
        const y2 = m.who === 'me' ? ty + 10 : ty - 10;
        svg$('text', { x: tx, y: f1(y2), class: 'cf-cng', 'text-anchor': anchor, ...rot }, gg).textContent = `✕ ${m.ng.split('／')[0]}`;
        // 茎のあたりにひび
        svg$('path', { d: `M${f1(m.x0 - 12)} ${f1((m.y0 + m.y1) / 2 - 10)}l4 5l-2 5l5 4l-3 5`, class: 'cf-crack' }, gg);
      }
    }

    _drawTactic(g, m, jointSegs, nameOf) {
      const cls = ['cf-mod cf-tactic'];
      if (m.sel) cls.push('sel');
      const gg = svg$('g', { class: cls.join(' '), style: `--tc:var(${this._famColor(m)})` }, g);
      const mid = (m.cells[0].ccx + m.cells[1].ccx) / 2, ccy = m.cells[0].ccy;
      if (m.empty) {
        // 空き枠: 「＋駒」の薄い2胞
        for (const c of m.cells) {
          svg$('path', { d: roundPath(hexV(c.ccx, c.ccy), 2), class: 'cf-cell cf-ghost' }, gg);
        }
        svg$('text', { x: mid, y: ccy + 3, class: 'cf-add', 'text-anchor': 'middle' }, gg)
          .textContent = `＋${m.fam.piece}`;
        return;
      }
      if (m.implied) cls.push('imp');
      if (m.ng) cls.push('ng');
      const t = m.t, name = t ? nameOf(m.who, 'tactic', m.id) : '';
      const chars = [...(t && (t.short || t.name)) || name];
      const lines = chars.length > 4 ? [chars.slice(0, 4).join(''), chars.slice(4).join('')] : [chars.join('')];
      m.cells.forEach((c, i) => {
        const cell = svg$('path', {
          d: roundPath(hexV(c.ccx, c.ccy), 2),
          class: `cf-cell cf-tac${i ? ' name' : ' glyph'}${m.implied ? ' imp' : ''}${m.ng ? ' ng' : ''}` }, gg);
        if (m.implied) { cell.style.fill = 'url(#cf-hatch)'; cell.style.strokeDasharray = '2.5 2'; }
      });
      // 左胞=系統の駒、右胞=戦法名
      svg$('text', {
        x: m.cells[0].ccx, y: ccy + 4, class: 'cf-t', 'font-size': 13, 'text-anchor': 'middle',
        ...(m.who === 'opp' ? { transform: `rotate(180 ${f1(m.cells[0].ccx)} ${f1(ccy)})` } : {}),
      }, gg).textContent = (m.fam && m.fam.piece) || '・';
      lines.forEach((ln, j) => {
        const attrs = {
          x: m.cells[1].ccx, y: ccy + (lines.length > 1 ? (j ? 5 : -4) : 3),
          class: 'cf-tname', 'font-size': 7.2, 'text-anchor': 'middle',
          ...(m.who === 'opp' ? { transform: `rotate(180 ${f1(m.cells[1].ccx)} ${f1(ccy)})` } : {}),
        };
        if ([...ln].length > 3) attrs.textLength = '20';
        svg$('text', attrs, gg).textContent = ln;
      });
      // ドミノ中央の継ぎ目
      svg$('line', {
        x1: mid, y1: f1(ccy - s * .48), x2: mid, y2: f1(ccy + s * .48),
        class: 'cf-j cf-j-tactic' }, gg);
      if (m.implied) {
        svg$('text', { x: mid, y: f1(ccy + s + 10), class: 'cf-csub', 'text-anchor': 'middle' }, gg)
          .textContent = '既定';
      } else if (m.ng) {
        svg$('text', { x: mid, y: f1(ccy - s - 4), class: 'cf-cng', 'text-anchor': 'middle' }, gg)
          .textContent = '✕';
      }
    }

    _famColor(m) {
      const p = (m.fam && m.fam.piece) || '';
      return { '飛': '--t-rook', '銀': '--t-silver', '角': '--t-kaku' }[p] || '--accent-2';
    }

    // ---------- 当たり判定: 胞の上に透明な <button> を重ねる（viewBox 座標→%） ----------
    _syncHits(mods) {
      const want = new Map();
      // 当たり判定は胞の外接矩形より余白ぶん広く取る（R-2: 狭い画面の実効タップ領域。
      // 胞同士の隙間は互いの矩形が重なり合い、先に来た胞が勝つ。これ以上広げると
      // 隣の胞の中心を覆うのでこの程度に留める）
      const PAD = 9;
      for (const m of mods) {
        const key = `${m.who}.${m.kind}.${m.id || m.famId || ''}`;
        // 囲いは外角の名前のあたりまで当たる範囲に含める
        const x1 = m.kind === 'castle' ? m.x1 + 8 : m.x1;
        want.set(key, { m, key, x: m.x0 - PAD, y: m.y0 - PAD, w: x1 - m.x0 + PAD * 2, h: m.y1 - m.y0 + PAD * 2 });
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
        const v = this._view;
        b.style.left = `${(w2.x / v.w * 100).toFixed(3)}%`;
        b.style.top = `${((w2.y - v.y0) / v.h * 100).toFixed(3)}%`;
        b.style.width = `${(w2.w / v.w * 100).toFixed(3)}%`;
        b.style.height = `${(w2.h / v.h * 100).toFixed(3)}%`;
        this.hits.appendChild(b);
        // 明示した層だけ × を持つ（要素自体を出し分ける）
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

    _applyHit(b, m) {
      const sig = `${m.who}|${m.kind}|${m.id || ''}|${m.sel}|${m.implied}|${m.removable}|${m.ng}|${m.empty}`;
      if (b._sig === sig) return;
      b._sig = sig;
      b.dataset.who = m.who;
      b.dataset.kind = m.kind;
      // 戦型はスロットではないので id は持たない（選択は「who.strategy」だけ）
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
      if (!m.removable) { if (x) x.remove(); return; }
      if (!x) {
        x = document.createElement('button');
        x.type = 'button';
        x.className = 'cf-x';
        x.dataset.key = key;
        x.tabIndex = -1;                    // キー操作は胞の Delete/Backspace で（U3）
        x.textContent = '×';
        this.hits.append(x);
      }
      x.dataset.who = m.who; x.dataset.kind = m.kind; x.dataset.id = m.id || '';
      const t = m.kind === 'tactic' ? m.t : m.castle;
      const xt = `${WHO_JA[m.who]}の${KIND_LABEL[m.kind]}「${t ? t.name : ''}」を外す`;
      x.title = xt; x.setAttribute('aria-label', xt);
      const v = this._view;
      x.style.left = `${((m.x1 - 7) / v.w * 100).toFixed(3)}%`;
      x.style.top = `${(Math.max(0, m.y0 - 13 - v.y0) / v.h * 100).toFixed(3)}%`;
    }
  }

  Kakoi.ConstraintField = ConstraintField;
})();
