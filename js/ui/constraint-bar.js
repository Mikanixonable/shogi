// 制約バー: 盤の上に2行で並ぶ導出戦型・囲い・戦法のチップ（多角形モジュール表示）。
// 戦型はスロットを持たない導出値（×は付かない）だが、押すと右ドックにその戦型の情報が出る。
// who 指定のバーはその側のチップだけを描く（上の行=相手用・下の行=自分用。相手は一段小さい）。
// 明示した層はいつでも×で外せる（外すと戦略既定値の既定チップに変わる）。
// 既定値で補った層（implied）は網掛けで薄く、×は付けない。
// 他の層と両立しない明示チップには ✕ と理由（title）を付ける（自動では差し替えない）。
// 導出ラベル（戦型など）は帯の間の関係行（#relationshipLabels）に出る。
//
// 内部は六角モジュール（B2案）: 囲いはコアの駒を漢字入りセルのクラスタ、戦法は
// 主役の駒＋筋の2セルドミノ、戦型は大きな六角の根。相手との相性は「盤に向く辺」
// （自分=上・相手=下）に緑/赤の線で示す（compat.judge().vs と同じ◎/△の意味）。
// 計画書 §0-2 / §1-1 / §1-4 / U3 / U5。
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';
  const { FIELD, findTactic, findCastle, tacticFamilyOf, castleSides, strategyLabel } = Kakoi.lookup;
  const { parsePieces } = Kakoi.notation;
  const { plain } = Kakoi.html;
  const CHIP_LABEL = { strategy: '戦型', castle: '囲い', tactic: '戦法' };
  const CHIP_SEL = '.cchip-b';

  // ---------- 六角モジュールの幾何 ----------
  const SVGNS = 'http://www.w3.org/2000/svg';
  const M2 = Math.sqrt(3) / 2;
  const svg$ = (tag, attrs, parent) => {
    const n = document.createElementNS(SVGNS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  };
  // 上に頂点を持つ正六角形の頂点（v0=上 → 時計回り）
  const hexV = (cx, cy, r) => {
    const w = M2 * r;
    return [[cx, cy - r], [cx + w, cy - r / 2], [cx + w, cy + r / 2], [cx, cy + r], [cx - w, cy + r / 2], [cx - w, cy - r / 2]];
  };
  const hexPts = (cx, cy, r) => hexV(cx, cy, r).map(p => p.map(n => +n.toFixed(2)).join(',')).join(' ');
  // 盤（敵）に向く2辺: 自分の帯は盤の下にあるので上の2辺、相手の帯は盤の上なので下の2辺
  const FACING = { me: [5, 0], opp: [2, 3] };
  function edgeMark(g, cx, cy, r, side, cls) {
    const v = hexV(cx, cy, r);
    for (const e of FACING[side]) {
      const [a, b] = [v[e], v[(e + 1) % 6]];
      svg$('line', { x1: +a[0].toFixed(2), y1: +a[1].toFixed(2), x2: +b[0].toFixed(2), y2: +b[1].toFixed(2), class: `hx-em ${cls}` }, g);
    }
  }

  // 囲いのコア駒を offset 座標のセルにする。相手の囲いは180°回して、帯の下端（盤側）が
  // 前線になる向きにする（盤上の見え方と同じ）。外接矩形は左上を (0,0) に正規化する
  function castleCells(core, who) {
    const cells = parsePieces(core || '').map(x => who === 'opp'
      ? { p: x.p, col: x.f - 1, row: 9 - x.r }
      : { p: x.p, col: 9 - x.f, row: x.r - 7 });
    const minC = Math.min(...cells.map(c => c.col));
    const minR = Math.min(...cells.map(c => c.row));
    cells.forEach(c => { c.col -= minC; c.row -= minR; });
    return cells;
  }

  // 奇数行オフセット（pointy-top）でセル中心を返す
  const cellXY = (col, row, s, x0, y0) => {
    const w = Math.sqrt(3) * s;
    return [x0 + col * w + (row & 1) * w / 2, y0 + row * 1.5 * s];
  };

  const pieceStrategy = (kind, id, fallback) => {
    if (kind === 'tactic') {
      const family = tacticFamilyOf(findTactic(id));
      return family ? family.side : fallback;
    }
    const castle = findCastle(id);
    const sides = castle ? castleSides(castle) : [];
    return sides.includes(fallback) ? fallback : sides[0] || fallback;
  };

  class ConstraintBar {
    /**
     * @param {HTMLElement} el `.cbar` の入れ物
     * @param {{ who:'me'|'opp',
     *   onSelect:(who:'me'|'opp', kind:string)=>void,
     *   onRemove:(who:string, kind:string)=>void }} handlers
     *   who: このバーが受け持つ側
     */
    constructor(el, { who, onSelect, onRemove }) {
      this.who = who;
      this.el = el;
      this._nodes = new Map();   // 'who.kind' → .cchip 要素（差分更新でフォーカスを保つ。U3）
      el.addEventListener('click', e => {
        const x = e.target.closest('.cchip-x');
        if (x) { onRemove(x.dataset.who, x.dataset.kind); return; }
        const b = e.target.closest('.cchip-b');
        if (b) onSelect(b.dataset.who, b.dataset.kind);
      });
      // Delete/Backspace でそのチップの制約を外す（U3）。矢印は roving がフォーカスだけを動かす
      el.addEventListener('keydown', e => {
        if (e.key !== 'Delete' && e.key !== 'Backspace') return;
        const b = e.target.closest('.cchip-b');
        if (!b || b.dataset.kind === 'strategy' || !b.parentElement || b.parentElement.dataset.implied === 'true') return;
        e.preventDefault();
        onRemove(b.dataset.who, b.dataset.kind);
      });
      // チップ間を矢印で回る（roving tabindex。U3）。×は常に tabindex=-1（キー操作は Delete で代替）
      this._roving = Kakoi.roving.attach(el, CHIP_SEL);
    }

    /**
     * @param {{ st:object|null, ng:object, selected:string|null,
     *   marks:object|null,
     *   nameOf:(who:string, kind:string, id:string)=>string }} d
     *   st: この側の constraints.sides() の出力（実効値・implied）。null（相手を表示していない）なら空
     *   ng: この側の両立しない明示層 {tactic?:Array, castle?:Array}（理由は {code,text}）
     *   marks: この側の層ごとの相手との相性 {tactic?:'good'|'bad'|null, castle?:...}
     *     （compat.judge().vs.level。盤に向く辺に出す。◎/△ のバッジと同じ意味）
     */
    render({ st, ng, selected, marks, nameOf }) {
      // 戦型→囲い→戦法の順に並べ、既定値で補った層は破線で示す
      const who = this.who;
      const want = [];
      if (st) {
        const strategy = st.strategy;
        want.push({
          key: `${who}.strategy`, who, kind: 'strategy', id: strategy,
          name: strategyLabel(strategy), strategy,
          sel: selected === `${who}.strategy`, implied: false, removable: false, ng: '', mark: null,
        });
        for (const kind of ['castle', 'tactic']) {
          const id = st[FIELD[kind]];
          if (id == null) continue;
          const implied = !!st.implied[kind];
          want.push({
            key: `${who}.${kind}`, who, kind, id,
            name: nameOf(who, kind, id),
            strategy: pieceStrategy(kind, id, strategy),
            sel: selected === `${who}.${kind}`,
            implied,
            removable: !implied,    // 明示した層はいつでも外せる（U5）
            ng: !implied && ng && ng[kind] ? ng[kind].map(r => plain(r.text)).join('／') : '',
            mark: (marks && marks[kind]) || null,
          });
        }
      }
      want.forEach((w, i) => { w.position = i === 0 ? 'first' : i === want.length - 1 ? 'last' : 'middle'; });
      this._syncChips(want);
      this._roving.refresh();
    }

    // チップを key で使い回して並べ直す（innerHTML を捨ててフォーカスを保つ。U3/U5）
    _syncChips(want) {
      const host = this._xHost();
      const seen = new Set();
      for (const w of want) {
        seen.add(w.key);
        let c = this._nodes.get(w.key);
        if (!c) {
          c = this._buildChip(w.kind);
          this._nodes.set(w.key, c);
        }
        this._applyChip(c, w);
        host.appendChild(c); // 既に入っていても末尾へ移る＝並び替え
      }
      for (const [k, c] of this._nodes) {
        if (!seen.has(k)) { c.remove(); this._nodes.delete(k); }
      }
    }

    _buildChip(kind) {
      const c = document.createElement('span');
      c.className = 'cchip';
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'cchip-b';
      const type = document.createElement('span');
      type.className = 'cchip-type';
      const ng = document.createElement('i');
      ng.className = 'cchip-ng';
      const nm = document.createElement('span');
      nm.className = 'cchip-nm';
      const txt = document.createElement('span');
      txt.className = 'cchip-txt';
      txt.append(type, ng, nm);
      b.append(txt);
      c.append(b);
      return c;
    }

    // ×ボタンは明示制約だけに出す（U5: 最後の1個でも外せる。既定の層は×を持たない＝外せない）。
    // hidden ではなく要素自体を出し分ける（.cchip-x の display が [hidden] を上書きするため）
    _xButton(c, removable, title) {
      let x = c.querySelector('.cchip-x');
      if (!removable) { if (x) x.remove(); return; }
      if (!x) {
        x = document.createElement('button');
        x.type = 'button';
        x.className = 'cchip-x';
        x.tabIndex = -1;                    // キー操作はチップの Delete/Backspace で（U3）
        x.textContent = '×';
        c.append(x);
      }
      const xt = `${title}を外す`;
      x.title = xt;
      x.setAttribute('aria-label', xt);
    }

    _applyChip(c, w) {
      const sig = `${w.who}|${w.kind}|${w.id}|${w.name}|${w.strategy}|${w.position}|${w.implied}|${w.sel}|${w.removable}|${w.ng}|${w.mark}`;
      if (c._sig === sig) return;
      c._sig = sig;
      c.dataset.who = w.who;
      c.dataset.kind = w.kind;
      c.dataset.implied = w.implied ? 'true' : 'false';
      c.dataset.sel = w.sel ? 'true' : 'false';
      c.dataset.ng = w.ng ? 'true' : 'false';
      c.dataset.strategy = w.strategy;
      c.dataset.position = w.position;
      c.dataset.mark = w.mark || '';
      const b = c.querySelector('.cchip-b');
      b.dataset.who = w.who;
      b.dataset.kind = w.kind;
      const base = `${w.who === 'me' ? '自分' : '相手'}の${CHIP_LABEL[w.kind]}${w.implied ? '（既定値）' : ''}`;
      const title = w.ng ? `${base}。両立しない: ${w.ng}` : base;
      b.title = w.ng ? `${w.name}。${title}` : w.name;   // 行が狭いと名前が省略されるので全名を添える
      b.setAttribute('aria-label', `${base}「${w.name}」${w.ng ? `。両立しない: ${w.ng}` : ''}`);
      b.querySelector('.cchip-type').textContent = CHIP_LABEL[w.kind];
      b.querySelector('.cchip-ng').textContent = w.ng ? '✕' : '';
      b.querySelector('.cchip-nm').textContent = w.name;
      this._hex(b, w);   // 六角モジュール（B2）を作り直す
      this._xButton(c, w.removable, `${base}「${w.name}」`);
      const x = c.querySelector('.cchip-x');
      if (x) { x.dataset.who = w.who; x.dataset.kind = w.kind; }
    }

    // ---------- 六角モジュール（B2: 蜂の巣） ----------
    // 囲い=漢字入りセルのクラスタ（実際の形）、戦法=主役の駒＋筋の2セルドミノ、戦型=大きな根。
    // 相手との相性は盤に向く辺（自分=上・相手=下）の線で、両立しない選択は傾けて示す
    _hex(b, w) {
      let svg = b.querySelector('.hx');
      if (svg) svg.remove();
      svg = svg$('svg', { class: `hx hx-${w.kind}`, 'aria-hidden': 'true' });
      b.prepend(svg);
      const imp = w.implied;
      const ng = !!w.ng;
      const g = svg$('g', { class: `hx-g${imp ? ' imp' : ''}${ng ? ' ng' : ''}` }, svg);
      if (w.kind === 'strategy') this._hexStrategy(svg, g, w);
      else if (w.kind === 'castle') this._hexCastle(svg, g, w);
      else this._hexTactic(svg, g, w);
      if (imp) this._hatch(svg, g, `hxh-${w.who}-${w.kind}`);
    }

    _hatch(svg, g, id) {
      // 既定値（implied）のセルは斜線の網掛けにする。pattern は svg ごとに固有の id が要る
      const defs = svg$('defs', {}, svg);
      const p = svg$('pattern', { id, width: 5, height: 5, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, defs);
      svg$('rect', { width: 5, height: 5, class: 'hx-imp-bg' }, p);
      svg$('line', { x1: 0, y1: 0, x2: 0, y2: 5, class: 'hx-imp-ln' }, p);
      for (const cell of g.querySelectorAll('.hx-cell')) {
        cell.style.fill = `url(#${id})`;   // CSS の fill 規則に負けないようインラインで
        cell.style.strokeDasharray = '2.5 2';
      }
    }

    // 戦型=大きな根の六角。縦書きの戦型名（居飛車/振り飛車）を中に入れる
    _hexStrategy(svg, g, w) {
      const R = 16, cx = R * M2 + 2.5, cy = R + 2.5;
      svg.setAttribute('viewBox', `0 0 ${(2 * R * M2 + 5).toFixed(1)} ${(2 * R + 5).toFixed(1)}`);
      svg.setAttribute('width', (2 * R * M2 + 5).toFixed(1));
      svg.setAttribute('height', (2 * R + 5).toFixed(1));
      svg$('polygon', { points: hexPts(cx, cy, R), class: `hx-cell hx-str st-${w.strategy}` }, g);
      const chars = (w.name || '').replace('り', '').split('');  // 振り飛車→振飛車 の3文字に収める
      const fs = chars.length > 3 ? 8.5 : 10;
      const y0 = cy - (chars.length - 1) * fs * 1.12 / 2 + fs * 0.36;
      chars.forEach((ch, i) => {
        svg$('text', { x: cx, y: y0 + i * fs * 1.12, class: 'hx-str-t', 'font-size': fs, 'text-anchor': 'middle' }, g)
          .textContent = ch;
      });
    }

    // 囲い=コアの駒を載せたセルクラスタ。自分は玉が左下・相手は180°回して前線が盤側になる
    _hexCastle(svg, g, w) {
      const castle = findCastle(w.id);
      const cells = castleCells(castle ? castle.core : '', w.who);
      const s = 8.6, wdt = Math.sqrt(3) * s, pad = 2;
      const cols = Math.max(...cells.map(c => c.col)) + 1;
      const rows = Math.max(...cells.map(c => c.row)) + 1;
      const vw = cols * wdt + wdt / 2 + pad * 2, vh = rows * 1.5 * s + s / 2 + pad * 2;
      svg.setAttribute('viewBox', `0 0 ${vw.toFixed(1)} ${vh.toFixed(1)}`);
      svg.setAttribute('width', vw.toFixed(1));
      svg.setAttribute('height', vh.toFixed(1));
      const front = w.who === 'me' ? 0 : rows - 1;   // 盤に面する前線の段（自分=上・相手=下）
      const seen = new Set();
      const markCells = [];
      for (const cell of cells) {
        const key = `${cell.col},${cell.row}`;
        if (seen.has(key)) continue;                 // 同じマスに2駒は来ないが念のため
        seen.add(key);
        const [cx, cy] = cellXY(cell.col, cell.row, s, pad + wdt / 2, pad + s);
        svg$('polygon', { points: hexPts(cx, cy, s), class: `hx-cell st-${w.strategy}${cell.p === '玉' ? ' gy' : ''}` }, g);
        svg$('text', { x: cx, y: cy + s * 0.36, class: 'hx-t', 'font-size': s * 0.95, 'text-anchor': 'middle' }, g)
          .textContent = cell.p;
        // 相手との相性は前線セルの盤向きの2辺に出す
        if (w.mark && cell.row === front) markCells.push([cx, cy]);
      }
      // 接続線は全セルを描いてから重ねる（隣のセルに塗り潰されないよう最後に）
      for (const [cx, cy] of markCells) edgeMark(g, cx, cy, s, w.who, `em-${w.mark}`);
    }

    // 戦法=主役の駒と筋の2セルドミノ。自分は帯の上端（盤側）、相手は下端に寄せる
    _hexTactic(svg, g, w) {
      const t = findTactic(w.id);
      const fam = tacticFamilyOf(t);
      const s = 8.6, wdt = Math.sqrt(3) * s, pad = 2;
      const vw = 2 * wdt + pad * 2, vh = 2.5 * s + pad * 2;   // ドミノ＋上下に余白（名前側）
      svg.setAttribute('viewBox', `0 0 ${vw.toFixed(1)} ${vh.toFixed(1)}`);
      svg.setAttribute('width', vw.toFixed(1));
      svg.setAttribute('height', vh.toFixed(1));
      const cy = w.who === 'me' ? pad + s : vh - pad - s;     // 盤側に寄せる
      const pieces = [
        (t && t.lead && t.lead.piece) || (fam && fam.piece) || '・',
        t && t.lead && Array.isArray(t.lead.files) ? String(t.lead.files[0]) : '',
      ];
      const at = [];
      pieces.forEach((p, i) => {
        const cx = pad + wdt / 2 + i * wdt;
        at.push(cx);
        svg$('polygon', { points: hexPts(cx, cy, s), class: `hx-cell st-${w.strategy}${i ? ' aux' : ''}` }, g);
        svg$('text', { x: cx, y: cy + s * 0.36, class: `hx-t${i ? ' aux' : ''}`, 'font-size': s * (i ? 0.8 : 0.95), 'text-anchor': 'middle' }, g)
          .textContent = p;
      });
      // 相手との相性は盤向きの辺に出す（セルを全部置いてから重ねる）
      if (w.mark) for (const cx of at) edgeMark(g, cx, cy, s, w.who, `em-${w.mark}`);
    }

    _xHost() {
      let h = this.el.querySelector('.cbar-x');
      if (!h) {
        h = document.createElement('span');
        h.className = 'cbar-x';
        this.el.prepend(h);
      }
      return h;
    }
  }

  Kakoi.ConstraintBar = ConstraintBar;
})();
