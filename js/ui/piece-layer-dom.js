// 駒レイヤ（DOM版）: Kakoi.kayaArt が焼いた彫駒の絵を .sq の中に画像で置く静止表示（アニメーションなし）。
// ?flat が付いているとき・WebGL が使えないときのフォールバックとして BoardView から選ばれる。
// 盤に落ちる影は CSS の drop-shadow（css/board.css .pc）。
// 駒の移動リストは BoardView が1回だけ計算する（pieceMatch.plan）が、静止表示なので使わない
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';
  const ART = Kakoi.kayaArt;
  const TILE_S = 2.6;

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
      this._urls = new Map();   // "字:色" → 焼いた絵の data URL
      // 木目と書体がそろったら・明暗を切り替えたら焼き直す
      const refresh = () => { this._urls.clear(); this._repaint(); };
      ART.ready.then(refresh);
      this._themeObs = new MutationObserver(refresh);
      this._themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
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
        el.style.setProperty('--k', ART.scaleOf(x.p));
        const img = document.createElement('img');
        img.alt = ''; img.draggable = false;
        img.src = this._url(x);
        el.appendChild(img);
        sq.appendChild(el);
      }
      this.board.style.removeProperty('--rt-d');   // 駒は滑らないので経路の矢印は待たずに出す
    }

    /** 盤を作り直さずに、駒の表示モードだけを切り替える */
    setMode(mode) {
      for (const el of this.squares.querySelectorAll('.pc')) {
        el.className = 'pc ' + this._pieceClass({ role: el.dataset.role, owner: el.dataset.owner }, mode);
        el.querySelector('img').src = this._url(el.dataset);
      }
    }

    dispose() { this._themeObs.disconnect(); }

    _repaint() {
      for (const el of this.squares.querySelectorAll('.pc')) el.querySelector('img').src = this._url(el.dataset);
    }

    _url(x) {
      const cls = x.owner === 'gote' ? 'g' : (x.role === 'core' || x.role === 'lead') ? 'c' : 'i';
      const key = `${x.p}:${cls}`;
      let url = this._urls.get(key);
      if (!url) {
        const cs = getComputedStyle(this.board);
        const v = (n, d) => cs.getPropertyValue(n).trim() || d;
        const ink = cls === 'c' ? v('--core', '#c8371f') : cls === 'g' ? v('--gote-ink', '#33507a') : v('--ink', '#1b1a17');
        const c = document.createElement('canvas');
        c.width = Math.ceil(ART.W * TILE_S); c.height = Math.ceil(ART.H * TILE_S);
        ART.paint(c.getContext('2d'), 0, 0, TILE_S, x.p, cls === 'g' ? 'g' : 's',
          { ink, wood1: v('--piece-1', '#f6e2ad'), wood2: v('--piece-2', '#ebcb88') });
        url = c.toDataURL();
        this._urls.set(key, url);
      }
      return url;
    }

    _pieceClass(x, mode) {
      if (x.owner === 'gote') return 'gote';
      if (x.role === 'core' || x.role === 'lead') return 'core';
      return mode === 'dim' ? 'off' : '';
    }
  }

  Kakoi.PieceLayerDom = PieceLayerDom;
})();
