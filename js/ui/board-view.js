// 盤の表示: マスと駒の描画、囲い切り替え時の駒の移動、利きとハイライトの重ね表示
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';
  const { ZEN, KAN } = Kakoi.notation;
  const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  class BoardView {
    /** @param {{ board:HTMLElement, files:HTMLElement, ranks:HTMLElement }} els */
    constructor(els) {
      this.els = els;
      els.files.innerHTML = [9,8,7,6,5,4,3,2,1].map(f => `<div>${ZEN[f]}</div>`).join('');
      els.ranks.innerHTML = [1,2,3,4,5,6,7,8,9].map(r => `<div>${KAN[r]}</div>`).join('');
      this._lasting = { squares: [], tone: null };
    }

    /**
     * 盤を描き直す
     * @param {Kakoi.Position} position
     * @param {{ mode:string, heat:number[][]|null, animate:boolean }} opts
     */
    render(position, { mode, heat, animate }) {
      const before = animate && !reducedMotion() ? this._snapshot() : null;
      let html = '';
      for (let r = 1; r <= 9; r++) for (let f = 9; f >= 1; f--) {
        const x = position.at(f, r), h = heat ? heat[f][r] : 0;
        html += `<div class="sq" data-sq="${f}${r}">`;
        if (h) html += `<span class="h" style="--h:${Math.min(h, 4)}"><b>${h}</b></span>`;
        if (x) html += `<div class="pc ${this._pieceClass(x, mode)}" data-p="${x.p}" data-role="${x.role}" data-owner="${x.owner}"><i><span>${x.p}</span></i></div>`;
        html += '</div>';
      }
      this.els.board.innerHTML = html;
      this._applyTone(this._lasting.squares, this._lasting.tone);
      if (before) this._flip(before);
    }

    /** 盤を作り直さずに、駒の表示モードだけを切り替える */
    setMode(mode) {
      for (const el of this.els.board.querySelectorAll('.pc')) {
        el.className = 'pc ' + this._pieceClass({ role: el.dataset.role, owner: el.dataset.owner }, mode);
      }
    }

    /** 一時的なハイライト（マウスを乗せている間）。squares が空なら持続ハイライトに戻す */
    hover(squares, tone) {
      this._clearTone();
      if (squares && squares.length) this._applyTone(squares, tone);
      else this._applyTone(this._lasting.squares, this._lasting.tone);
    }

    /** 持続するハイライト（攻め筋の対象マスなど） */
    setLasting(squares, tone) {
      this._lasting = { squares: squares || [], tone };
      this._clearTone();
      this._applyTone(this._lasting.squares, tone);
    }

    _pieceClass(x, mode) {
      if (x.owner === 'gote') return 'gote';
      if (x.role === 'core') return 'core';
      return mode === 'core' ? 'hidden' : mode === 'dim' ? 'off' : '';
    }

    _clearTone() {
      for (const el of this.els.board.querySelectorAll('[data-tone]')) el.removeAttribute('data-tone');
    }

    _applyTone(squares, tone) {
      for (const s of squares) {
        const el = this.els.board.querySelector(`[data-sq="${s}"]`);
        if (el) el.dataset.tone = tone;
      }
    }

    _snapshot() {
      return [...this.els.board.querySelectorAll('.pc[data-owner="sente"]')].map(el => ({ p: el.dataset.p, r: el.getBoundingClientRect() }));
    }

    // 同じ種類の駒を近い順に対応づけ、元の位置から新しいマスへ滑らせる
    _flip(before) {
      const after = [...this.els.board.querySelectorAll('.pc[data-owner="sente"]')].map(el => ({ p: el.dataset.p, r: el.getBoundingClientRect(), el }));
      const pairs = [];
      after.forEach((n, ni) => before.forEach((o, oi) => {
        if (o.p === n.p) pairs.push({ ni, oi, d: Math.hypot(o.r.x - n.r.x, o.r.y - n.r.y) });
      }));
      pairs.sort((a, b) => a.d - b.d);
      const usedN = new Set(), usedO = new Set();
      for (const { ni, oi, d } of pairs) {
        if (usedN.has(ni) || usedO.has(oi)) continue;
        usedN.add(ni); usedO.add(oi);
        if (d < 1) continue;
        const n = after[ni], o = before[oi];
        n.el.animate([{ transform: `translate(${o.r.x - n.r.x}px,${o.r.y - n.r.y}px)` }, { transform: 'none' }],
                     { duration: 560, easing: 'cubic-bezier(.2,.8,.2,1)', delay: Math.min(d, 400) * .25 });
      }
      after.forEach((n, ni) => { if (!usedN.has(ni)) n.el.animate([{ opacity: 0, transform: 'scale(.7)' }, {}], { duration: 380, easing: 'ease-out' }); });
    }
  }

  Kakoi.BoardView = BoardView;
})();
