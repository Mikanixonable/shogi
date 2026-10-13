// 戦法の周期表: 盤の９つの筋と列をそろえた表。最上段の系統ピッカーで選んだ系統（主役の駒）の段だけを置く
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';
  const { esc } = Kakoi.html;
  const { isRare } = Kakoi.tacticNav;
  const FILES = 9;

  // ピッカーの短い名札: 「居飛車：銀の筋」→「銀」、「振り飛車：飛車の筋」→「飛車」
  const famLabel = f => f.name.replace(/^[^：]+：/, '').replace(/の筋$/, '');

  class TacticTableView {
    /**
     * @param {HTMLElement} el `#ptable`（盤の外枠 .boardwrap の最初の子）
     * @param {{ onSelect:(id:string)=>void, onFamily:(famId:string)=>void }} handlers
     */
    constructor(el, handlers) {
      this.el = el;
      el.addEventListener('click', e => {
        const b = e.target.closest('.pt-cell');
        if (b) { handlers.onSelect(b.dataset.id); return; }
        const f = e.target.closest('.pt-fam');
        if (f) handlers.onFamily(f.dataset.fam);
      });
    }

    /**
     * @param {{family:object, tactics:object[]}[]} rows 全行
     * @param {string} famId 表示する系統（選択中の戦法の属する系統）
     */
    render(rows, currentId, famId) {
      const row = rows.find(r => r.family.id === famId);
      const fam = row ? row.family : null;
      const siblings = fam ? rows.filter(r => r.family.side === fam.side) : [];
      // 表に置くのは選んだ系統の代表戦法だけ（variantOf を持つ派生は左の一覧から選ぶ）。
      // 列が重なる戦法は下の段へ振り分ける
      const lanes = row ? Kakoi.tacticNav.lanesOf(row.tactics.filter(t => !t.variantOf)) : [];
      // 盤の高さの計算（--ptable-h）に使う行数を外枠へ伝える（ピッカーの1行を含む）
      this.el.parentElement.style.setProperty('--pt-rows', lanes.length + 1);
      let html =
        `<div class="pt-fams" style="grid-row:1;grid-column:1/-1">` +
        siblings.map(r => `<button class="pt-fam" data-fam="${esc(r.family.id)}" aria-pressed="${r.family === fam}" ` +
          `title="${esc(r.family.name)}">${esc(famLabel(r.family))}</button>`).join('') +
        `</div>`;
      if (fam) html += this._row(fam, lanes, 2);
      this.el.innerHTML = html;
      this.select(currentId);
    }

    /** 選択中の戦法だけを切り替える。派生戦法が選ばれたときは代表（親）のセルを光らせる */
    select(id) {
      const t = Kakoi.TACTICS && Kakoi.TACTICS.find(x => x.id === id);
      const shown = t && t.variantOf ? t.variantOf : id;
      for (const b of this.el.querySelectorAll('.pt-cell')) b.setAttribute('aria-current', b.dataset.id === shown);
    }

    _row(family, lanes, n0) {
      let html = '';
      lanes.forEach((tactics, i) => {
        const n = n0 + i, covered = new Set(tactics.flatMap(t => t.lead.files));
        for (let f = FILES; f >= 1; f--) {
          if (!covered.has(f)) html += `<span class="pt-empty" style="grid-row:${n};grid-column:${FILES - f + 1}">–</span>`;
        }
        for (const t of tactics) {
          const hi = Math.max(...t.lead.files), span = t.lead.files.length;
          const rare = isRare(t) ? ' data-rare="true"' : '';
          html += `<button class="pt-cell" data-id="${esc(t.id)}"${rare} title="${esc(isRare(t) ? `${t.name}（まれ）` : t.name)}" ` +
            `style="grid-row:${n};grid-column:${FILES - hi + 1} / span ${span};--n:${[...t.name].length}"><span>${esc(t.name)}</span></button>`;
        }
      });
      // 系統の駒タイルは段のぶん縦にまたぐ
      html += `<span class="pt-tile" title="${esc(family.note ? `${family.name}\n${family.note}` : family.name)}" ` +
        `style="grid-row:${n0} / span ${lanes.length};grid-column:${FILES + 1}">${esc(family.piece)}</span>`;
      return html;
    }
  }

  Kakoi.TacticTableView = TacticTableView;
})();
