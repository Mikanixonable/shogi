// 戦法モードの左の一覧: 居飛車／振り飛車のタブで系統を絞り、主役の駒の行ごとに戦法を筋の順に並べる
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';
  const { esc } = Kakoi.html;
  const { fileBadge, isRare } = Kakoi.tacticNav;

  class TacticRailView {
    /**
     * @param {HTMLElement} el `#tacticRail`
     * @param {{ onSelect:(id:string)=>void, onSide:(side:string)=>void }} handlers
     */
    constructor(el, { onSelect, onSide }) {
      this.el = el;
      el.innerHTML =
        `<div class="seg wide" data-role="seg">
          <button data-value="ibisha">居飛車</button><button data-value="furibisha">振り飛車</button>
        </div>
        <div class="tr-list" data-role="list"></div>`;
      this.seg = new Kakoi.Segmented(el.querySelector('[data-role="seg"]'), onSide);
      this.list = el.querySelector('[data-role="list"]');
      this.list.addEventListener('click', e => {
        const b = e.target.closest('.tr-item');
        if (b) onSelect(b.dataset.id);
      });
    }

    /**
     * @param {{family:object, tactics:object[]}[]} rows 全行
     * @param {string} side 表示する戦型（選択中の戦法の属する側）
     */
    render(rows, currentId, side) {
      this._rows = rows;
      this._side = side;
      this.seg.setValue(side);
      this.list.innerHTML = rows.filter(r => r.family.side === side).map(({ family, tactics }) =>
        `<section class="tr-row"><h3><span class="pt-tile">${esc(family.piece)}</span>${esc(family.name)}</h3>` +
        tactics.map(t =>
          `<button class="tr-item" data-id="${esc(t.id)}"${isRare(t) ? ' data-rare="true"' : ''}><span class="nm">${esc(t.name)}</span><span class="fb">${fileBadge(t)}</span></button>`
        ).join('') + '</section>'
      ).join('');
      this.select(currentId);
    }

    /** 選択中だけを書き換える。タブは選択中の戦法の戦型を映すので、側が替わったときは render で作り直す */
    select(id, side) {
      if (side && side !== this._side) { this.render(this._rows, id, side); return; }
      this.seg.setValue(this._side);
      for (const b of this.list.querySelectorAll('.tr-item')) b.setAttribute('aria-current', b.dataset.id === id);
    }
  }

  Kakoi.TacticRailView = TacticRailView;
})();
