// 制約バー: 盤の上下に並ぶ制約チップ。1チップ=1層（戦略→戦法→囲いの固定順。U5）。
// 優先度（リスト順）は表示に出さず内部だけで持つ。who 指定のバーはその側のチップだけを描く
// （盤の上=相手用・下=自分用）。指定なしは両側を自分→相手の順に並べる（従来形）。
// 明示制約はいつでも×で外せる（U5: 最後の1個も。外すと戦略既定値の既定チップに変わる）。
// 既定値で補った層（implied）は破線で薄く、×は付けない。
// 右端には導出ラベル（戦型など。消せない灰色の文字。押すと右ドックで説明を出す）を並べる。
// 計画書 §0-2 / §1-1 / §1-4 / U3 / U5。
// ホバー予告用の API として flash(pairs)、既定値に戻った示唆として markImplied(pairs) を持つ。
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';
  const KIND_JA = Kakoi.lookup.LAYER_JA;
  const KINDS = ['strategy', 'tactic', 'castle'];
  const FIELD = { strategy: 'strategy', tactic: 'tacticId', castle: 'castleId' };
  const CHIP_SEL = '.cchip-b, .cchip-label';

  class ConstraintBar {
    /**
     * @param {HTMLElement} el `.cbar` の入れ物
     * @param {{ who?:'me'|'opp'|null,
     *   onSelect:(who:'me'|'opp', kind:string)=>void,
     *   onRemove:(who:string, kind:string)=>void,
     *   onLabel?:(id:string)=>void }} handlers
     *   who: このバーが受け持つ側。null（省略）なら両側を自分→相手の順に並べる
     *   onLabel: 導出ラベルを押したとき（既定は onSelect('me','strategy') 相当の案内）
     */
    constructor(el, { who = null, onSelect, onRemove, onLabel }) {
      this.who = who;
      this.el = el;
      this._nodes = new Map();   // 'who.kind' → .cchip 要素（差分更新でフォーカスを保つ。U3）
      this._labNodes = new Map();// label id → 要素
      this._impliedMarks = new Set();
      el.addEventListener('click', e => {
        const x = e.target.closest('.cchip-x');
        if (x) { onRemove(x.dataset.who, x.dataset.kind); return; }
        const lab = e.target.closest('.cchip-label');
        if (lab) { if (onLabel) onLabel(lab.dataset.label); return; }
        const b = e.target.closest('.cchip-b');
        if (b) onSelect(b.dataset.who, b.dataset.kind);
      });
      // Delete/Backspace でそのチップの制約を外す（U3）。矢印は roving がフォーカスだけを動かす
      el.addEventListener('keydown', e => {
        if (e.key !== 'Delete' && e.key !== 'Backspace') return;
        const b = e.target.closest('.cchip-b');
        if (!b || !b.parentElement || b.parentElement.dataset.implied === 'true') return;
        e.preventDefault();
        onRemove(b.dataset.who, b.dataset.kind);
      });
      // チップ間を矢印で回る（roving tabindex。U3）。×は常に tabindex=-1（キー操作は Delete で代替）
      this._roving = Kakoi.roving.attach(el, CHIP_SEL);
    }

    /**
     * @param {{ list:Array<{who,kind,id}>, me:object, opp:object|null, selected:string|null,
     *   labels:Array<{id:string,label:string}>|null,
     *   nameOf:(who:string, kind:string, id:string)=>string }} d
     *   me/opp は constraints.sides() の出力（実効値・implied・rank を持つ）
     */
    render({ me, opp, selected, labels, nameOf }) {
      // 表示は戦略→戦法→囲いの固定順（U5）。各層は明示（rank>=0）なら×つき、
      // 既定値で補った層（implied）なら破線で×なし
      const want = [];
      for (const who of this.who ? [this.who] : ['me', 'opp']) {
        const S = who === 'me' ? me : opp;
        if (!S) continue;
        for (const kind of KINDS) {
          const id = S[FIELD[kind]];
          if (id == null) continue;
          const implied = !!S.implied[kind];
          want.push({
            key: `${who}.${kind}`, who, kind, id,
            name: nameOf(who, kind, id),
            sel: selected === `${who}.${kind}`,
            implied,
            removable: !implied,    // 明示制約は最後の1個でも外せる（U5）
          });
        }
      }
      this._syncChips(want);

      const labWant = (labels || []).map(l => ({ key: l.id, ...l }));
      this._syncLabels(labWant);
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
          c = this._buildChip();
          this._nodes.set(w.key, c);
        }
        this._applyChip(c, w);
        host.appendChild(c); // 既に入っていても末尾へ移る＝並び替え
      }
      for (const [k, c] of this._nodes) {
        if (!seen.has(k)) { c.remove(); this._nodes.delete(k); }
      }
    }

    _syncLabels(want) {
      const host = this._labHost();
      const seen = new Set();
      for (const w of want) {
        seen.add(w.key);
        let b = this._labNodes.get(w.key);
        if (!b) {
          b = document.createElement('button');
          b.type = 'button';
          b.className = 'cchip cchip-label';
          this._labNodes.set(w.key, b);
        }
        const sig = `${w.id}|${w.label}`;
        if (b._sig !== sig) {
          b._sig = sig;
          b.dataset.label = w.id;
          b.textContent = `#${w.label}`;      // チップと同じく # を冠する
          b.title = `戦型「${w.label}」。押すと右の解説に出ます`;
        }
        host.appendChild(b);
      }
      for (const [k, b] of this._labNodes) {
        if (!seen.has(k)) { b.remove(); this._labNodes.delete(k); }
      }
    }

    _buildChip() {
      const c = document.createElement('span');
      c.className = 'cchip';
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'cchip-b';
      const side = document.createElement('i');
      side.className = 'cchip-side';
      const nm = document.createElement('span');
      nm.className = 'cchip-nm';
      b.append(side, nm);
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
      const sig = `${w.who}|${w.kind}|${w.id}|${w.name}|${w.implied}|${w.sel}|${w.removable}|${this._impliedMarks.has(w.key)}`;
      if (c._sig === sig) return;
      c._sig = sig;
      c.dataset.who = w.who;
      c.dataset.kind = w.kind;
      c.dataset.implied = w.implied ? 'true' : 'false';
      c.dataset.sel = w.sel ? 'true' : 'false';
      c.dataset.impliedIn = this._impliedMarks.has(w.key) ? 'true' : 'false';
      const b = c.querySelector('.cchip-b');
      b.dataset.who = w.who;
      b.dataset.kind = w.kind;
      const title = `${w.who === 'me' ? '自分' : '相手'}の${KIND_JA[w.kind]}${w.implied ? '（既定値）' : ''}`;
      b.title = title;
      b.setAttribute('aria-label', title);
      b.querySelector('.cchip-side').textContent = w.who === 'me' ? '▲' : '△';
      b.querySelector('.cchip-nm').textContent = `#${w.name}`;
      this._xButton(c, w.removable, title);
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
    _labHost() {
      let h = this.el.querySelector('.cbar-lab');
      if (!h) {
        h = document.createElement('span');
        h.className = 'cbar-lab';
        this.el.append(h);
      }
      return h;
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

    /**
     * 既定値に戻った層の印（U5: 外しても盤が変わらなかったとき、破線への移行を
     * アニメーションで示す）。次回 render 時に data-implied-in を1度だけ立てる
     */
    markImplied(pairs) {
      for (const p of pairs || []) this._impliedMarks.add(`${p.who}.${p.kind}`);
      setTimeout(() => {
        for (const p of pairs || []) {
          const k = `${p.who}.${p.kind}`;
          this._impliedMarks.delete(k);
          const c = this._nodes.get(k);
          if (c) { delete c.dataset.impliedIn; c._sig = null; } // 次の _applyChip で正規化する
        }
      }, 1200);
    }
  }

  Kakoi.ConstraintBar = ConstraintBar;
})();
