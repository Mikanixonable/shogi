// 制約バー: 盤の上下に並ぶ制約チップ。1チップ=1制約。自分側→相手側、それぞれリスト順（先頭ほど古い）。
// who 指定のバーはその側のチップだけを描く（盤の上=相手用・下=自分用）。指定なしは両側を1行に（従来形）。
// 暗黙の層（戦略既定値で補った戦法・囲い・推論した戦略）は破線で薄く表示し、×は付けない。
// 右端には導出ラベル（戦型など。消せない灰色チップ）を並べる。計画書 §0-2 / §1-1 / §1-4。
// ホバー予告用の API として flash(pairs) を持つ（§3-3。呼び出しは左ドック側）。
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';
  const { esc } = Kakoi.html;
  const KIND_JA = { strategy: '戦略', tactic: '戦法', castle: '囲い' };
  const KINDS = ['strategy', 'tactic', 'castle'];
  const FIELD = { strategy: 'strategy', tactic: 'tacticId', castle: 'castleId' };

  class ConstraintBar {
    /**
     * @param {HTMLElement} el `.cbar` の入れ物
     * @param {{ who?:'me'|'opp'|null,
     *   onSelect:(who:'me'|'opp', kind:string)=>void,
     *   onRemove:(who:string, kind:string)=>void }} handlers
     *   who: このバーが受け持つ側。null（省略）なら両側を自分→相手の順に並べる
     */
    constructor(el, { who = null, onSelect, onRemove }) {
      this.who = who;
      this.el = el;
      el.addEventListener('click', e => {
        const x = e.target.closest('.cchip-x');
        if (x) { onRemove(x.dataset.who, x.dataset.kind); return; }
        const b = e.target.closest('.cchip-b');
        if (b) onSelect(b.dataset.who, b.dataset.kind);
      });
      // ←→ でチップを移動する（最低限のキーボード操作。本格化は U4）
      el.addEventListener('keydown', e => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        const chips = [...el.querySelectorAll('.cchip-b')];
        const i = chips.indexOf(document.activeElement);
        if (i < 0 || chips.length < 2) return;
        e.preventDefault();
        const next = chips[(i + (e.key === 'ArrowRight' ? 1 : -1) + chips.length) % chips.length];
        next.focus();
        next.click();
      });
    }

    /**
     * @param {{ list:Array<{who,kind,id}>, me:object, opp:object|null, selected:string|null,
     *   labels:Array<{id:string,label:string}>,
     *   nameOf:(who:string, kind:string, id:string)=>string }} d
     *   me/opp は constraints.sides() の出力（実効値・implied・rank を持つ）
     */
    render({ list, me, opp, selected, labels, nameOf }) {
      const chips = [];
      for (const who of this.who ? [this.who] : ['me', 'opp']) {
        const S = who === 'me' ? me : opp;
        // 明示制約（リスト順）
        for (const e of list.filter(x => x.who === who)) {
          chips.push(this._chip({
            who, kind: e.kind, name: nameOf(who, e.kind, e.id),
            sel: selected === `${who}.${e.kind}`, implied: false,
            removable: list.length > 1,                 // 最後の1個は外せない
          }));
        }
        // 暗黙の層（明示のあとに層順で）。相手の制約が無いときは相手側を出さない
        if (S) {
          for (const kind of KINDS) {
            if (!S.implied[kind]) continue;
            const id = S[FIELD[kind]];
            if (id == null) continue;
            chips.push(this._chip({
              who, kind, name: nameOf(who, kind, id),
              sel: selected === `${who}.${kind}`, implied: true, removable: false,
            }));
          }
        }
      }
      for (const l of labels || []) {
        chips.push(`<span class="cchip cchip-label" data-label="${esc(l.id)}"><span class="cchip-nm">#${esc(l.label)}</span></span>`);
      }
      this.el.innerHTML = chips.join('');
    }

    _chip({ who, kind, name, sel, implied, removable }) {
      const side = who === 'me' ? '▲' : '△';
      const title = `${who === 'me' ? '自分' : '相手'}の${KIND_JA[kind]}${implied ? '（既定値）' : ''}`;
      return `<span class="cchip" data-who="${who}" data-kind="${kind}"${implied ? ' data-implied="true"' : ''}${sel ? ' data-sel="true"' : ''}>` +
        `<button type="button" class="cchip-b" data-who="${who}" data-kind="${kind}" title="${esc(title)}">` +
        `<i class="cchip-side">${side}</i><span class="cchip-nm">#${esc(name)}</span></button>` +
        (removable
          ? `<button type="button" class="cchip-x" data-who="${who}" data-kind="${kind}" aria-label="${esc(title)}を外す" title="${esc(title)}を外す">×</button>`
          : '') +
        `</span>`;
    }

    /**
     * ホバー予告: 指定した (who,kind) のチップを点滅させる。null/[] で消す（§3-3）
     * @param {Array<{who:string,kind:string}>|null} pairs
     */
    flash(pairs) {
      for (const c of this.el.querySelectorAll('.cchip[data-flash]')) c.removeAttribute('data-flash');
      for (const p of pairs || []) {
        const c = this.el.querySelector(`.cchip[data-who="${p.who}"][data-kind="${p.kind}"]`);
        if (c) c.dataset.flash = 'true';
      }
    }
  }

  Kakoi.ConstraintBar = ConstraintBar;
})();
