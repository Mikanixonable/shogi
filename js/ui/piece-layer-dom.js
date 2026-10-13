// 駒レイヤ（DOM版）: 五角形 clip-path の .pc 要素を .sq の中に置く従来の描画。
// ?flat が付いているとき・WebGL が使えないときのフォールバックとして BoardView から選ばれる
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
      this.board = boardEl;
      this.squares = squaresEl;
      this._before = [];
    }

    /** マスの DOM が作り直される前に呼ぶ。今いる駒の位置を記録する */
    capture() { this._before = this._snapshot(); }

    /**
     * 駒を描く（.sq は BoardView が先に作り直してある）
     * @param {Kakoi.Position} position
     * @param {{ mode:string, animate:boolean,
     *   trace?:{square:string, piece:string, path:string[]} }} opts
     */
    render(position, { mode, animate, trace }) {
      const before = this._before;
      this._before = [];
      for (const x of position.pieces) {
        const sq = this.squares.querySelector(`.sq[data-sq="${x.f}${x.r}"]`);
        if (!sq) continue;
        const el = document.createElement('div');
        el.className = 'pc ' + this._pieceClass(x, mode);
        el.dataset.p = x.p;
        el.dataset.role = x.role;
        el.dataset.owner = x.owner;
        el.innerHTML = `<i><span>${x.p}</span></i>`;
        sq.appendChild(el);
      }
      // アニメなしの描き直しでは後手の入場（goteIn）も抑える（立体版は即表示なので挙動を揃える）
      if (!animate) for (const el of this.squares.querySelectorAll('.pc.gote')) el.classList.add('no-enter');
      if (animate) this._flip(before, trace);
      else this.board.style.removeProperty('--rt-d');
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
      return mode === 'core' ? 'hidden' : mode === 'dim' ? 'off' : '';
    }

    /** 描き直す前の駒の一覧。受け皿（.pc-ghost）に移した消えゆく駒は含めない */
    _snapshot() {
      return [...this.squares.querySelectorAll('.sq > .pc')].map(el => ({
        el, p: el.dataset.p, owner: el.dataset.owner, sq: el.parentElement.dataset.sq,
        r: el.getBoundingClientRect(), qr: el.parentElement.getBoundingClientRect(),
        op: +getComputedStyle(el).opacity || 0,
      }));
    }

    // 同じ種類の駒を、駒の動きとして自然な組み合わせ（pieceMatch.pair）で対応づけ、
    // 元の位置から新しいマスへ滑らせる。対応しない駒は出現・消滅で切り替える
    _flip(before, trace) {
      const after = [...this.squares.querySelectorAll('.sq > .pc')]
        .map(el => ({
          el, p: el.dataset.p, owner: el.dataset.owner, sq: el.parentElement.dataset.sq,
          r: el.getBoundingClientRect(),
        }));
      // 戦法の主役の駒は筋道をたどる専用の動きにするので、通常の対応づけからは外す
      const lead = trace && trace.path && trace.path.length > 1
        ? after.find(n => n.owner === 'sente' && n.sq === trace.square && n.p === trace.piece) : null;
      if (lead) lead.skip = 'lead';
      const m = Kakoi.pieceMatch.pair(before, after);
      // 後手の入場演出（goteIn）は新しく現れた駒だけにする。
      // 対応づいて滑る駒・同じマスに居続ける駒は入場しない（以前は全後手が毎回入場していた）
      const appearing = new Set(m.appear);
      after.forEach((n, ni) => { if (n.owner === 'gote' && !appearing.has(ni)) n.el.classList.add('no-enter'); });
      for (const { o, n } of m.pairs) {
        const nw = after[n], ow = before[o];
        const d = Math.hypot(ow.r.x - nw.r.x, ow.r.y - nw.r.y);
        if (d < 1) continue;
        // 後手の駒は rotate(180deg) が剥がれないよう、キーフレームの両端に付けておく
        const rot = nw.owner === 'gote' ? ' rotate(180deg)' : '';
        nw.el.animate([{ transform: `translate(${ow.r.x - nw.r.x}px,${ow.r.y - nw.r.y}px)${rot}` }, { transform: rot || 'none' }],
                      { duration: 560, easing: 'cubic-bezier(.2,.8,.2,1)', delay: Math.min(d, 400) * .25 });
      }
      for (const ni of m.appear) {
        const n = after[ni];
        // 後手の出現は CSS の goteIn（回りながら沈み込む）に任せ、先手は縮小フェードにする
        if (!n.skip && n.owner !== 'gote')
          n.el.animate([{ opacity: 0, transform: 'scale(.7)' }, {}], { duration: 380, easing: 'ease-out' });
      }
      for (const oi of m.gone) this._ghost(before[oi]);
      if (lead) this._route(lead.el, trace.path);
      else this.board.style.removeProperty('--rt-d');
    }

    // 対応先のなかった駒を、元の位置に浮かせて薄めながら消す（新しい駒の出現と対称）
    _ghost(o) {
      if (o.op <= .01) return;
      const host = this.squares.getBoundingClientRect();
      // 駒の字の大きさは .sq のコンテナで決まるので、同じ大きさの受け皿に入れて浮かせる
      const w = document.createElement('div');
      w.className = 'pc-ghost';
      Object.assign(w.style, {
        position: 'absolute', zIndex: 1, margin: '0', pointerEvents: 'none', containerType: 'size',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        left: `${o.qr.x - host.x}px`, top: `${o.qr.y - host.y}px`,
        width: `${o.qr.width}px`, height: `${o.qr.height}px`,
      });
      o.el.classList.add('no-enter');
      w.appendChild(o.el);
      this.squares.appendChild(w);
      w.animate([{ opacity: o.op }, { opacity: 0 }], { duration: 380, easing: 'ease-out', fill: 'forwards' })
        .onfinish = () => w.remove();
      setTimeout(() => w.remove(), 500); // onfinish が取りこぼされても残さない
    }

    // 主役の駒を、筋道の各マスの中心を経由する折れ曲がった軌跡で動かす。
    // 所要時間は区画数に比例させ、経路の矢印（--rt-d）は駒が着くころに現れるように合わせる
    _route(el, path) {
      const dest = el.getBoundingClientRect();
      const cx = dest.x + dest.width / 2, cy = dest.y + dest.height / 2;
      const frames = [];
      for (const s of path) {
        const sq = this.squares.querySelector(`.sq[data-sq="${s}"]`);
        if (!sq) continue;
        const q = sq.getBoundingClientRect();
        frames.push({ transform: `translate(${q.x + q.width / 2 - cx}px,${q.y + q.height / 2 - cy}px)` });
      }
      if (frames.length < 2) { this.board.style.removeProperty('--rt-d'); return; }
      frames[frames.length - 1] = { transform: 'none' };
      const dur = Math.min(280 * (frames.length - 1), 1500);
      el.animate(frames, { duration: dur, easing: 'cubic-bezier(.3,.65,.3,1)' });
      this.board.style.setProperty('--rt-d', `${Math.round(dur + 60)}ms`);
    }
  }

  Kakoi.PieceLayerDom = PieceLayerDom;
})();
