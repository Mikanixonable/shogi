// 戦法の周期表: 盤の９つの筋と列をそろえた表。行＝主役の駒の系統、マス＝戦法
// 統合画面では selected が *.tactic のときだけ盤の上に出す。相手側のときは列を
// 10−f に反転し、盤の絶対的な筋にそろえる（計画書 §4-5）
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';
  const { esc } = Kakoi.html;
  const { isRare } = Kakoi.tacticNav;
  const FILES = 9;

  class TacticTableView {
    /**
     * @param {HTMLElement} el `#ptable`（盤の外枠 .boardwrap の最初の子）
     * @param {{ onSelect:(id:string)=>void }} handlers
     */
    constructor(el, handlers) {
      this.el = el;
      el.addEventListener('click', e => {
        const b = e.target.closest('.pt-cell');
        if (b) handlers.onSelect(b.dataset.id);
      });
    }

    /**
     * @param {{family:object, tactics:object[]}[]} rows 表示する行（呼び側で側の戦略の行に絞る）
     * @param {string} currentId 選択中の戦法 id
     * @param {{ flip?:boolean }} [opts] 相手側のとき true。列を 10−f に反転して絶対座標にそろえる
     */
    render(rows, currentId, { flip = false } = {}) {
      // 盤の高さの計算（--ptable-h）に使う行数を外枠へ伝える
      this.el.parentElement.style.setProperty('--pt-rows', rows.length);
      this.el.dataset.side = flip ? 'opp' : 'me';
      this.el.innerHTML = rows.map((row, i) => this._row(row, i + 1, flip)).join('');
      this.select(currentId);
    }

    /** 選択中の戦法だけを切り替える */
    select(id) {
      for (const b of this.el.querySelectorAll('.pt-cell')) b.setAttribute('aria-current', b.dataset.id === id);
    }

    _row({ family, tactics }, n, flip) {
      const covered = new Set(tactics.flatMap(t => t.lead.files));
      // 盤の列: 先手視点は「筋 f → 列 FILES−f+1」。相手（反転）は「筋 f → 列 f」
      // （相手の駒データは先手視点なので、盤の絶対筋は 10−f。その列は 10−(10−f)=f）
      const colOf = f => flip ? f : FILES - f + 1;
      let html = '';
      for (let f = FILES; f >= 1; f--) {
        if (!covered.has(f)) html += `<span class="pt-empty" style="grid-row:${n};grid-column:${colOf(f)}">–</span>`;
      }
      // 1マスに1タイル（§4-3）: variantOf の派生は親に束ね、同じ列の別戦法（石田流と
      // 三間飛車、筋違い角と4五歩早仕掛けなど）は先のものだけ描く。隠れた戦法は一覧から
      // 選べる（束ねタイルと複数候補の表示は U4 で作る）
      const taken = new Set();
      for (const t of tactics) {
        if (t.variantOf) continue;
        const hi = Math.max(...t.lead.files), lo = Math.min(...t.lead.files);
        const span = t.lead.files.length;
        if (taken.has(hi)) continue;
        taken.add(hi);
        const rare = isRare(t) ? ' data-rare="true"' : '';
        html += `<button class="pt-cell" data-id="${esc(t.id)}"${rare} title="${esc(isRare(t) ? `${t.name}（まれ）` : t.name)}" ` +
          `style="grid-row:${n};grid-column:${flip ? lo : colOf(hi)} / span ${span};--n:${[...t.name].length}"><span>${esc(t.name)}</span></button>`;
      }
      html += `<span class="pt-tile" title="${esc(family.name)}" style="grid-row:${n};grid-column:${FILES + 1}">${esc(family.piece)}</span>`;
      return html;
    }
  }

  Kakoi.TacticTableView = TacticTableView;
})();
