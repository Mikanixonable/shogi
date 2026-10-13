// 戦法の周期表: 盤の９つの筋と列をそろえた表。行＝主役の駒の系統、マス＝戦法
// 統合画面では selected が *.tactic のときだけ盤の上に出す。相手側のときは列を
// 10−f に反転し、盤の絶対的な筋にそろえる。見出し行に側を明示する（計画書 §4-5）
// 表示する行はその側の戦略のものだけ。もう一方の戦略の行は「▸ もう一方の戦略の戦法」
// の折りたたみを開くと cascade 見た目で出る（選ぶと戦略が連鎖する。§4-5）
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
    }

    /**
     * @param {{family:object, tactics:object[]}[]} rows その側の戦略の行（呼び側で絞る）
     * @param {string} currentId 選択中の戦法 id（派生選択時は親 id が来る）
     * @param {{ flip?:boolean, sideLabel?:string, offRows?:Array }} [opts]
     *   flip: 相手側のとき true。列を 10−f に反転して絶対座標にそろえる
     *   sideLabel: 見出しの側の明示（'自分の戦法' / '相手の戦法'）
     *   offRows: もう一方の戦略の行。折りたたみボタンの下に cascade 見た目で出す
     */
    render(rows, currentId, { flip = false, sideLabel = '', offRows = null } = {}) {
      this._flip = flip;
      this._offRows = offRows || null;
      this._offOpen = false;
      this._foldRow = rows.length + 2;   // 見出し1行＋本行のあと
      const parts = [
        `<div class="pt-cap" style="grid-row:1;grid-column:1 / -1">${esc(sideLabel)}<small>筋を選ぶとその側の戦法が変わります</small></div>`,
      ];
      rows.forEach((row, i) => parts.push(this._row(row, i + 2, flip)));
      let total = rows.length + 1;
      if (offRows && offRows.length) {
        total += 1;
        parts.push(`<button type="button" class="pt-fold" aria-expanded="false" ` +
          `style="grid-row:${this._foldRow};grid-column:1 / -1">▸ もう一方の戦略の戦法（選ぶと戦略が連鎖します）</button>`);
      }
      this._baseRows = total;
      // 盤の高さの計算（--ptable-h）に使う行数を外枠へ伝える
      this.el.parentElement.style.setProperty('--pt-rows', total);
      this.el.dataset.side = flip ? 'opp' : 'me';
      this.el.innerHTML = parts.join('');
      this.select(currentId);
    }

    /** 選択中の戦法だけを切り替える */
    select(id) {
      this._curId = id;
      for (const b of this.el.querySelectorAll('.pt-cell')) b.setAttribute('aria-current', b.dataset.id === id);
    }

    /** もう一方の戦略の行の開閉。開くと cascade 見た目で末尾の行に並べる（§4-5） */
    _expandOff(on) {
      this._offOpen = on;
      const btn = this.el.querySelector('.pt-fold');
      if (btn) {
        btn.setAttribute('aria-expanded', String(on));
        btn.textContent = `${on ? '▾' : '▸'} もう一方の戦略の戦法（選ぶと戦略が連鎖します）`;
      }
      for (const el of [...this.el.querySelectorAll('[data-offrow]')]) el.remove();
      const off = this._offRows || [];
      const total = this._baseRows + (on ? off.length : 0);
      this.el.parentElement.style.setProperty('--pt-rows', total);
      if (!on) return;
      off.forEach((row, i) => {
        this.el.insertAdjacentHTML('beforeend', this._row(row, this._foldRow + 1 + i, this._flip, true));
      });
      this.select(this._curId);
    }

    _row({ family, tactics }, n, flip, off = false) {
      const covered = new Set(tactics.flatMap(t => t.lead.files));
      // 盤の列: 先手視点は「筋 f → 列 FILES−f+1」。相手（反転）は「筋 f → 列 f」
      // （相手の駒データは先手視点なので、盤の絶対筋は 10−f。その列は 10−(10−f)=f）
      const colOf = f => flip ? f : FILES - f + 1;
      const mark = off ? ' data-offrow="1"' : '';
      let html = '';
      for (let f = FILES; f >= 1; f--) {
        if (!covered.has(f)) html += `<span class="pt-empty${off ? ' pt-off' : ''}"${mark} style="grid-row:${n};grid-column:${colOf(f)}">–</span>`;
      }
      // 1マスに1タイル（§4-3）: variantOf の派生は親に束ね、同じ列の別戦法（石田流と
      // 三間飛車、筋違い角と4五歩早仕掛けなど）は先のものだけ描く。隠れた戦法は一覧から
      // 選べる（束ねタイルと複数候補の表示はドックのタイルが担う）
      const taken = new Set();
      for (const t of tactics) {
        if (t.variantOf) continue;
        const hi = Math.max(...t.lead.files), lo = Math.min(...t.lead.files);
        const span = t.lead.files.length;
        if (taken.has(hi)) continue;
        taken.add(hi);
        const rare = isRare(t) ? ' data-rare="true"' : '';
        html += `<button class="pt-cell${off ? ' pt-off' : ''}" data-id="${esc(t.id)}"${rare}${mark} title="${esc(isRare(t) ? `${t.name}（まれ）` : t.name)}" ` +
          `style="grid-row:${n};grid-column:${flip ? lo : colOf(hi)} / span ${span};--n:${[...t.name].length}"><span>${esc(t.name)}</span></button>`;
      }
      html += `<span class="pt-tile${off ? ' pt-off' : ''}"${mark} title="${esc(family.name)}" style="grid-row:${n};grid-column:${FILES + 1}">${esc(family.piece)}</span>`;
      return html;
    }
  }

  Kakoi.TacticTableView = TacticTableView;
})();
