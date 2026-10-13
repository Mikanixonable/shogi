// 駒レイヤ（DOM版）: 五角形 clip-path の .pc 要素を .sq の中に置く静止表示（アニメーションなし）。
// ?flat が付いているとき・WebGL が使えないときのフォールバックとして BoardView から選ばれる。
// 駒の移動リストは BoardView が1回だけ計算する（pieceMatch.plan）が、静止表示なので使わない
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';

  class PieceLayerDom {
    /**
     * @param {HTMLElement} boardEl 盤（--rt-d の設定先）
     * @param {HTMLElement} squaresEl マスの入れ物（.sq を含む .squares）
     */
    constructor(boardEl, squaresEl) {
      this.kind = 'flat';
      this.animates = false;
      this.board = boardEl;
      this.squares = squaresEl;
    }

    /**
     * 駒を描く（.sq は BoardView が先に作り直してある）
     * @param {{ after:Array<{p:string, owner:string, role:string, sq:string}> }} plan pieceMatch.plan の結果
     * @param {{ mode:string }} opts
     */
    render(plan, { mode }) {
      for (const x of plan.after) {
        const sq = this.squares.querySelector(`.sq[data-sq="${x.sq}"]`);
        if (!sq) continue;
        const el = document.createElement('div');
        el.className = 'pc ' + this._pieceClass(x, mode);
        el.dataset.p = x.p;
        el.dataset.role = x.role;
        el.dataset.owner = x.owner;
        el.innerHTML = `<i><span>${x.p}</span></i>`;
        sq.appendChild(el);
      }
      this.board.style.removeProperty('--rt-d');   // 駒は滑らないので経路の矢印は待たずに出す
    }

    /** 盤を作り直さずに、駒の表示モードだけを切り替える */
    setMode(mode) {
      for (const el of this.squares.querySelectorAll('.pc')) {
        el.className = 'pc ' + this._pieceClass({ role: el.dataset.role, owner: el.dataset.owner }, mode);
      }
    }

    dispose() {}

    _pieceClass(x, mode) {
      if (x.owner === 'gote') return 'gote';
      if (x.role === 'core' || x.role === 'lead') return 'core';
      return mode === 'dim' ? 'off' : '';
    }
  }

  Kakoi.PieceLayerDom = PieceLayerDom;
})();
