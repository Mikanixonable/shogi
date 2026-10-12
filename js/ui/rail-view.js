// 左の一覧: 戦型（居飛車／振り飛車）の切り替え、囲いカード、キーボードでの移動
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';
  const COLS = 3;
  const { esc } = Kakoi.html;

  class RailView {
    /**
     * @param {{ side:HTMLElement, chips:HTMLElement, count:HTMLElement, cards:HTMLElement }} els
     * @param {{ onSelect:(id:string)=>void, onSide:(side:string)=>void, onFilter:(familyId:?string)=>void }} handlers
     */
    constructor(els, handlers) {
      this.els = els;
      this.handlers = handlers;
      this.side = new Kakoi.Segmented(els.side, handlers.onSide);
      this._ids = [];
      this._renderedKey = null;
      this._chipsKey = null;
      els.chips.addEventListener('click', e => {
        const b = e.target.closest('.fchip');
        if (!b) return;
        // 選択中のチップをもう一度押すと解除
        handlers.onFilter(b.getAttribute('aria-pressed') === 'true' ? null : (b.dataset.family || null));
      });
      els.cards.addEventListener('click', e => {
        const c = e.target.closest('.card');
        if (c) handlers.onSelect(c.dataset.id);
      });
      this._bindTilt(els.cards);
      document.addEventListener('keydown', e => this._onKey(e));
    }

    /**
     * @param {object[]} castles 表示する囲い（絞り込み・系統順の済んだもの）
     * @param {object} current 選択中の囲い
     * @param {(castle:object)=>object} positionOf 囲いの局面
     * @param {{ families:{id:string,name:string,glyph:string,count:number}[], filter:?string, total:number }} info 系統チップの情報（count は戦型内の件数）
     */
    render(castles, current, positionOf, info) {
      this.side.setValue(current.side);
      this._ids = castles.map(c => c.id);
      const { families, filter, total } = info;
      const chipsKey = JSON.stringify([current.side, filter, families.map(f => f.id)]);
      if (this._chipsKey !== chipsKey) {
        this._chipsKey = chipsKey;
        this.els.chips.innerHTML =
          `<button class="fchip" data-family="" aria-pressed="${filter === null}">すべて <span class="n">${total}</span></button>` +
          families.map(f => `<button class="fchip" data-family="${esc(f.id)}" aria-pressed="${filter === f.id}">${Kakoi.familyGlyph(f.glyph)}${esc(f.name)} <span class="n">${f.count}</span></button>`).join('');
      }
      const key = `${current.side}|${filter}`;
      if (this._renderedKey !== key) {
        this._renderedKey = key;
        const glyphOf = new Map(families.map(f => [f.id, f.glyph]));
        this.els.cards.innerHTML = castles.map((c, n) =>
          `<button class="card" data-id="${esc(c.id)}" title="${esc(c.name)}" style="--i:${n}"><span class="fg">${Kakoi.familyGlyph(glyphOf.get(c.family))}</span>` +
          (c.refFamily ? `<span class="rf" title="${esc(c.refFamily)}">※</span>` : '') +
          `${Kakoi.miniBoardSVG(positionOf(c), c.side)}<span class="nm">${esc(c.short)}</span></button>`
        ).join('');
      }
      for (const b of this.els.cards.querySelectorAll('.card')) b.setAttribute('aria-current', b.dataset.id === current.id);
      const fam = families.find(f => f.id === filter);
      this.els.count.textContent = `${this._ids.indexOf(current.id) + 1} / ${this._ids.length}${fam ? `・${fam.name}` : ''}`;
      this._current = current.id;
    }

    // ←→ は前後、↑↓ は一段上下（カードの並びと同じ向き）
    _onKey(e) {
      if (document.body.dataset.view !== 'castle') return;
      if (e.metaKey || e.ctrlKey || e.altKey || /input|textarea/i.test(e.target.tagName)) return;
      const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -COLS, ArrowDown: COLS }[e.key];
      if (!step) return;
      e.preventDefault();
      const n = this._ids.length, i = this._ids.indexOf(this._current);
      let j = i + step;
      if (Math.abs(step) === 1) j = (j + n) % n;
      else if (j < 0 || j >= n) return;
      this.handlers.onSelect(this._ids[j]);
      this.els.cards.querySelector(`[data-id="${this._ids[j]}"]`)?.focus({ preventScroll: true });
    }

    _bindTilt(container) {
      container.addEventListener('pointermove', e => {
        const c = e.target.closest('.card');
        if (!c || e.pointerType !== 'mouse') return;
        const r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        c.style.setProperty('--ry', `${(x - .5) * 10}deg`); c.style.setProperty('--rx', `${(.5 - y) * 10}deg`);
        c.style.setProperty('--mx', `${x * 100}%`); c.style.setProperty('--my', `${y * 100}%`);
      });
      container.addEventListener('pointerout', e => {
        const c = e.target.closest('.card');
        if (!c || c.contains(e.relatedTarget)) return;
        c.style.setProperty('--rx', '0deg'); c.style.setProperty('--ry', '0deg');
      });
    }
  }

  Kakoi.RailView = RailView;
})();
