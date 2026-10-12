// 分類マップの左: 系統ごとのまとまりと所属する囲い。系統の絞り込みと囲いの選択を受け持つ
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';
  const { esc } = Kakoi.html;

  class ClusterRailView {
    /** @param {HTMLElement} el @param {{ onFamily:(id:string)=>void, onSelect:(id:string)=>void }} handlers */
    constructor(el, handlers) {
      this.el = el;
      el.addEventListener('click', e => {
        const chip = e.target.closest('.cl-chip');
        if (chip) return handlers.onSelect(chip.dataset.id);
        const fam = e.target.closest('.cl-fam-h');
        if (fam) handlers.onFamily(fam.dataset.family);
      });
    }

    /** @param {{ id, name, shape, glyph }[]} families @param {(familyId:string)=>object[]} membersOf @param {{ family:?string, selectedId:?string }} view */
    render(families, membersOf, view) {
      this.el.innerHTML = `<h3 class="cl-rail-t">系統（作者の分類）</h3>` + families.map(f => {
        const members = membersOf(f.id);
        const on = view.family === f.id;
        return `<section class="cl-fam" data-family="${esc(f.id)}" aria-current="${on}">
          <button class="cl-fam-h" data-family="${esc(f.id)}" aria-pressed="${on}">
            <i class="cl-dot"></i><span class="g">${Kakoi.familyGlyph(f.glyph)}</span><b>${esc(f.name)}</b><span class="n">${members.length}</span>
          </button>
          <p class="cl-shape">${esc(f.shape)}</p>
          <div class="cl-chips">${members.map(c =>
            `<button class="cl-chip" data-id="${esc(c.id)}" aria-pressed="${view.selectedId === c.id}">${esc(c.short)}</button>`).join('')}</div>
        </section>`;
      }).join('');
      this.el.classList.toggle('filtered', !!view.family);
    }
  }

  Kakoi.ClusterRailView = ClusterRailView;
})();
