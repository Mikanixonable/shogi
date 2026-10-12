// 戦法モードの左の一覧: 主役の駒の行ごとに見出しを付け、戦法を筋の順に並べる
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';
  const { esc } = Kakoi.html;
  const { fileBadge, isRare } = Kakoi.tacticNav;

  class TacticRailView {
    /**
     * @param {HTMLElement} el
     * @param {{ onSelect:(id:string)=>void }} handlers
     */
    constructor(el, handlers) {
      this.el = el;
      el.addEventListener('click', e => {
        const b = e.target.closest('.tr-item');
        if (b) handlers.onSelect(b.dataset.id);
      });
    }

    /** @param {{family:object, tactics:object[]}[]} rows */
    render(rows, currentId) {
      this.el.innerHTML = rows.map(({ family, tactics }) =>
        `<section class="tr-row"><h3><span class="pt-tile">${esc(family.piece)}</span>${esc(family.name)}</h3>` +
        tactics.map(t =>
          `<button class="tr-item" data-id="${esc(t.id)}"${isRare(t) ? ' data-rare="true"' : ''}><span class="nm">${esc(t.name)}</span><span class="fb">${fileBadge(t)}</span></button>`
        ).join('') + '</section>'
      ).join('');
      this.select(currentId);
    }

    select(id) {
      for (const b of this.el.querySelectorAll('.tr-item')) b.setAttribute('aria-current', b.dataset.id === id);
    }
  }

  Kakoi.TacticRailView = TacticRailView;
})();
