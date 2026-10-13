// 戦法の周期表: 盤の９つの筋と列をそろえた表。行＝主役の駒の系統、マス＝戦法
// 統合画面では selected が *.tactic のときだけ盤の上に出す。相手側のときは列を
// 10−f に反転し、盤の絶対的な筋にそろえる。見出し行に側を明示する（計画書 §4-5）
// 表示する行はその側の戦略のものだけ。もう一方の戦略の行は、見出し行の「⇄ もう一方」
// ボタンが開くポップオーバーに出す（盤の高さを行数で変えない。選ぶと戦略が連動する。§4-5/F1）
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
        const fold = e.target.closest('.pt-fold');
        if (fold) { this._expandOff(fold.getAttribute('aria-expanded') !== 'true'); return; }
        const b = e.target.closest('.pt-cell');
        if (b) handlers.onSelect(b.dataset.id);
      });
      // ポップオーバーの外を押したら閉じる
      document.addEventListener('pointerdown', e => {
        if (this._pop && !e.target.closest('.pt-pop') && !e.target.closest('.pt-fold')) this._expandOff(false);
      });
      // セルは roving tabindex（U8）。矢印で盤の筋どおりにフォーカスを移し Enter で選ぶ
      this._roving = Kakoi.roving.attach(el, '.pt-cell',
        { current: () => this.el.querySelector('.pt-cell[aria-current="true"]') });
    }

    /**
     * @param {{family:object, tactics:object[]}[]} rows その側の戦略の行（呼び側で絞る）
     * @param {string} currentId 選択中の戦法 id（派生選択時は親 id が来る）
     * @param {{ flip?:boolean, sideLabel?:string, offRows?:Array }} [opts]
     *   flip: 相手側のとき true。列を 10−f に反転して絶対座標にそろえる
     *   sideLabel: 見出しの側の明示（'自分の戦法' / '相手の戦法'）
     *   offRows: もう一方の戦略の行。「⇄ もう一方」ボタンのポップオーバーに cascade 見た目で出す
     */
    render(rows, currentId, { flip = false, sideLabel = '', offRows = null } = {}) {
      this._flip = flip;
      this._offRows = offRows && offRows.length ? offRows : null;
      this._offOpen = false;
      if (this._pop) { this._pop.remove(); this._pop = null; }
      const hasOff = !!this._offRows;
      const parts = [
        `<div class="pt-cap" style="grid-row:1;grid-column:1 / ${hasOff ? 8 : -1}">${esc(sideLabel)}<small>筋を選ぶとその側の戦法が変わります</small></div>`,
      ];
      if (hasOff) {
        parts.push(`<button type="button" class="pt-fold" aria-expanded="false" title="もう一方の戦略の戦法（選ぶと戦略が連動して変わります）" ` +
          `style="grid-row:1;grid-column:8 / -1">⇄ もう一方</button>`);
      }
      rows.forEach((row, i) => parts.push(this._row(row, i + 2, flip)));
      this.el.dataset.side = flip ? 'opp' : 'me';
      this.el.innerHTML = parts.join('');
      this.select(currentId);
    }

    /** 選択中の戦法だけを切り替える */
    select(id) {
      this._curId = id;
      for (const b of this.el.querySelectorAll('.pt-cell')) b.setAttribute('aria-current', b.dataset.id === id);
      if (this._roving) this._roving.refresh();
    }

    /** 「もう一方の戦略」の行の開閉。開くとポップオーバーに cascade 見た目で並べる（§4-5/F1） */
    _expandOff(on) {
      this._offOpen = on;
      const btn = this.el.querySelector('.pt-fold');
      if (btn) btn.setAttribute('aria-expanded', String(on));
      if (this._pop) { this._pop.remove(); this._pop = null; }
      if (!on) return;
      const pop = document.createElement('div');
      pop.className = 'pt-pop';
      pop.innerHTML = (this._offRows || []).map((row, i) => this._row(row, i + 1, this._flip, true)).join('');
      this.el.appendChild(pop);
      this._pop = pop;
      this.select(this._curId);
    }

    _row({ family, tactics }, n, flip, off = false) {
      const mark = off ? ' data-offrow="1"' : '';
      let html = '';
      // 列の配置は tacticNav.placeTactics（ドックのタイルと共有の純関数。S6）。
      // 1マスに1タイル（§4-3）: 同じ右端の筋の別戦法（石田流と三間飛車、筋違い角と
      // 4五歩早仕掛けなど）は先のものだけ描く（group:'file'＋collide:'drop'）。
      // 隠れた戦法は一覧から選べる。セルは短縮名（F4）
      const { cells, dots } = Kakoi.tacticNav.placeTactics(
        tactics.filter(t => !t.variantOf), { flip, group: 'file', collide: 'drop' });
      for (const d of dots) {
        html += `<span class="pt-empty${off ? ' pt-off' : ''}"${mark} style="grid-row:${n};grid-column:${d.col}">–</span>`;
      }
      for (const { col, span, tactics: ts } of cells) {
        const t = ts[0];   // 束ねた先頭の戦法を描く（隠れた側は一覧へ）
        const rare = isRare(t) ? ' data-rare="true"' : '';
        const short = t.short || t.name;
        html += `<button class="pt-cell${off ? ' pt-off' : ''}" data-id="${esc(t.id)}"${rare}${mark} title="${esc(isRare(t) ? `${t.name}（まれ）` : t.name)}" ` +
          `style="grid-row:${n};grid-column:${col} / span ${span};--n:${[...short].length}"><span>${esc(short)}</span></button>`;
      }
      html += `<span class="pt-tile${off ? ' pt-off' : ''}"${mark} title="${esc(family.name)}" style="grid-row:${n};grid-column:${FILES + 1}">${esc(family.piece)}</span>`;
      return html;
    }
  }

  Kakoi.TacticTableView = TacticTableView;
})();
