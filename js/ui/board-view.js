// 盤の表示: マス・利きヒート・ハイライト（data-tone）の DOM を管理する。
// 駒の対応づけ（どの駒がどこへ動いたか＝移動リスト）はここで1回だけ計算し（pieceMatch.plan）、
// 駒そのものの生成・表示モードは駒レイヤが描くだけ:
//   立体版 js/ui/piece-layer-3d.js（既定。移動リストどおり滑らせる） / DOM版 js/ui/piece-layer-dom.js（?flat・WebGL 非対応時。静止）
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
      els.board.prepend(this._woodLayers());
      this._lasting = { squares: [], tone: null };
      this._pieces = [];    // いま盤に描いている駒（次の移動リストの before。駒レイヤの並びと同じ）
      this.layer = this._pickLayer();
    }

    // 盤の地: 縁まで続く榧の柾目（.board-grain）と、漆を盛った太刀盛りの罫線・星（.board-lines）。
    // 光は左上に固定（Kakoi.kayaArt と css/board.css の --lx/--ly と同じ）
    _woodLayers() {
      const frag = document.createDocumentFragment();
      const NS = 'http://www.w3.org/2000/svg';
      const grain = document.createElementNS(NS, 'svg');
      grain.setAttribute('class', 'board-grain');
      grain.setAttribute('aria-hidden', 'true');
      grain.innerHTML = `<filter id="kaya-grain" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">${
        Kakoi.kayaArt.grainFilter(Kakoi.kayaArt.BOARD_GRAIN)}</filter><rect width="100%" height="100%" fill="#fff" filter="url(#kaya-grain)"/>`;
      // 罫は盤の比率（9:9.6）のまま 90×96 の座標で引く（星が楕円にならない）
      const lines = document.createElementNS(NS, 'svg');
      lines.setAttribute('class', 'board-lines');
      lines.setAttribute('viewBox', '0 0 90 96');
      lines.setAttribute('aria-hidden', 'true');
      let d = '';
      for (let i = 0; i <= 9; i++) d += `M${i * 10} 0V96M0 ${(i * 96 / 9).toFixed(3)}H90`;
      const hoshi = [[3, 3], [6, 3], [3, 6], [6, 6]]
        .map(([x, y]) => `<circle cx="${x * 10}" cy="${(y * 96 / 9).toFixed(3)}" r=".75" fill="url(#kaya-hoshi)"/>`).join('');
      lines.innerHTML = `<radialGradient id="kaya-hoshi" cx="50%" cy="50%" fx="36%" fy="30%" r="50%">
          <stop offset="0" stop-color="#6b4a2a"/><stop offset=".6" style="stop-color:var(--wood-ink)"/></radialGradient>
        <path class="board-rule" d="${d}"/>${hoshi}`;
      frag.append(grain, lines);
      return frag;
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
      const anim = animate && !reducedMotion();
      const after = position.pieces.map(x => ({ p: x.p, owner: x.owner, role: x.role, sq: `${x.f}${x.r}` }));
      const plan = Kakoi.pieceMatch.plan(this._pieces, after, anim ? trace : null);
      this._pieces = plan.after;
      let html = '';
      for (let r = 1; r <= 9; r++) for (let f = 9; f >= 1; f--) {
        const h = heat ? heat[f][r] : 0;
        html += `<div class="sq" data-sq="${f}${r}">`;
        if (h) html += `<span class="h" style="--h:${Math.min(h, 4)}"><b>${h}</b></span>`;
        html += '</div>';
      }
      this.squares.innerHTML = html;
      this._applyTone(this._lasting.squares, this._lasting.tone);
      this.layer.render(plan, { mode, animate: anim });
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
