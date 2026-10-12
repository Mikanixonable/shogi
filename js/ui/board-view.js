// 盤の表示: マス・利きヒート・ハイライト（data-tone）の DOM を管理する。
// 駒そのものの生成・移動・表示モードは駒レイヤに委譲する:
//   立体版 js/ui/piece-layer-3d.js（既定） / DOM版 js/ui/piece-layer-dom.js（?flat・WebGL 非対応時）
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
      // マスは専用の入れ物に描く（board 直下には重ね表示の SVG や駒キャンバスが同居するため）
      this.squares = document.createElement('div');
      this.squares.className = 'squares';
      els.board.prepend(this.squares);
      this._lasting = { squares: [], tone: null };
      this.layer = this._pickLayer();
    }

    // 既定は立体駒。?flat 指定・three 未読込・WebGL 非対応・初期化失敗は DOM 駒に逃がす
    _pickLayer() {
      const flat = new URLSearchParams(location.search).has('flat');
      const L3d = Kakoi.PieceLayer3d;
      if (!flat && L3d && L3d.supported()) {
        try { return new L3d(this.els.board); } catch (e) { /* 起動に失敗したら DOM 版へ */ }
      }
      return new Kakoi.PieceLayerDom(this.els.board, this.squares);
    }

    /**
     * 盤を描き直す
     * @param {Kakoi.Position} position
     * @param {{ mode:string, heat:number[][]|null, animate:boolean,
     *   trace?:{square:string, piece:string, path:string[]} }} opts
     *   trace: 主役の駒を path の各マスを経由する軌跡で動かす（戦法の筋道）
     */
    render(position, { mode, heat, animate, trace }) {
      this.layer.capture(); // マスの DOM を壊す前に、今いる駒を移動元として記録させる
      let html = '';
      for (let r = 1; r <= 9; r++) for (let f = 9; f >= 1; f--) {
        const h = heat ? heat[f][r] : 0;
        html += `<div class="sq" data-sq="${f}${r}">`;
        if (h) html += `<span class="h" style="--h:${Math.min(h, 4)}"><b>${h}</b></span>`;
        html += '</div>';
      }
      this.squares.innerHTML = html;
      this._applyTone(this._lasting.squares, this._lasting.tone);
      this.layer.render(position, { mode, animate: animate && !reducedMotion(), trace });
    }

    /** 盤を作り直さずに、駒の表示モードだけを切り替える */
    setMode(mode) { this.layer.setMode(mode); }

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
      this._applyTone(this._lasting.squares, this._lasting.tone);
    }

    _clearTone() {
      for (const el of this.squares.querySelectorAll('[data-tone]')) el.removeAttribute('data-tone');
    }

    _applyTone(squares, tone) {
      for (const s of squares) {
        const el = this.squares.querySelector(`[data-sq="${s}"]`);
        if (el) el.dataset.tone = tone;
      }
    }
  }

  Kakoi.BoardView = BoardView;
})();
