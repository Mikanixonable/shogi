// 制約バー: 盤の上に2行で並ぶ導出戦型・囲い・戦法のチップ。
// who 指定のバーはその側のチップだけを描く（上の行=相手用・下の行=自分用。相手は一段小さい）。
// 明示した層はいつでも×で外せる（外すと戦略既定値の既定チップに変わる）。
// 既定値で補った層（implied）は破線で薄く、×は付けない。
// 他の層と両立しない明示チップには ✕ と理由（title）を付ける（自動では差し替えない）。
// 導出ラベル（戦型など）は帯の間の関係行（#relationshipLabels）に出る。
// 計画書 §0-2 / §1-1 / §1-4 / U3 / U5。
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';
  const { FIELD, findTactic, findCastle, tacticFamilyOf, castleSides, strategyLabel } = Kakoi.lookup;
  const { plain } = Kakoi.html;
  const CHIP_LABEL = { strategy: '戦型', castle: '囲い', tactic: '戦法' };
  const CHIP_SEL = '.cchip-b:not([data-kind="strategy"])';
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
        if (b && b.dataset.kind !== 'strategy') onSelect(b.dataset.who, b.dataset.kind);
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
     *   nameOf:(who:string, kind:string, id:string)=>string }} d
     *   st: この側の constraints.sides() の出力（実効値・implied）。null（相手を表示していない）なら空
     *   ng: この側の両立しない明示層 {tactic?:Array, castle?:Array}（理由は {code,text}）
     */
    render({ st, ng, selected, nameOf }) {
      // 戦型→囲い→戦法の順に並べ、既定値で補った層は破線で示す
      const who = this.who;
      const want = [];
      if (st) {
        const strategy = st.strategy;
        want.push({
          key: `${who}.strategy`, who, kind: 'strategy', id: strategy,
          name: strategyLabel(strategy), strategy, sel: false, implied: false, removable: false, ng: '',
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
      const b = document.createElement(kind === 'strategy' ? 'span' : 'button');
      if (kind !== 'strategy') b.type = 'button';
      b.className = 'cchip-b';
      const type = document.createElement('span');
      type.className = 'cchip-type';
      const ng = document.createElement('i');
      ng.className = 'cchip-ng';
      const nm = document.createElement('span');
      nm.className = 'cchip-nm';
      b.append(type, ng, nm);
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
      const sig = `${w.who}|${w.kind}|${w.id}|${w.name}|${w.strategy}|${w.position}|${w.implied}|${w.sel}|${w.removable}|${w.ng}`;
      if (c._sig === sig) return;
      c._sig = sig;
      c.dataset.who = w.who;
      c.dataset.kind = w.kind;
      c.dataset.implied = w.implied ? 'true' : 'false';
      c.dataset.sel = w.sel ? 'true' : 'false';
      c.dataset.ng = w.ng ? 'true' : 'false';
      c.dataset.strategy = w.strategy;
      c.dataset.position = w.position;
      const b = c.querySelector('.cchip-b');
      b.dataset.who = w.who;
      b.dataset.kind = w.kind;
      const base = `${w.who === 'me' ? '自分' : '相手'}の${CHIP_LABEL[w.kind]}${w.implied ? '（既定値）' : ''}`;
      const title = w.ng ? `${base}。両立しない: ${w.ng}` : base;
      b.title = w.ng ? title : '';
      if (w.kind === 'strategy') b.removeAttribute('aria-label');
      else b.setAttribute('aria-label', `${base}「${w.name}」${w.ng ? `。両立しない: ${w.ng}` : ''}`);
      b.querySelector('.cchip-type').textContent = CHIP_LABEL[w.kind];
      b.querySelector('.cchip-ng').textContent = w.ng ? '✕' : '';
      b.querySelector('.cchip-nm').textContent = w.name;
      this._xButton(c, w.removable, `${base}「${w.name}」`);
      const x = c.querySelector('.cchip-x');
      if (x) { x.dataset.who = w.who; x.dataset.kind = w.kind; }
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
