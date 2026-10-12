// 盤の表示: マスと駒の描画、囲い切り替え時の駒の移動、利きとハイライトの重ね表示
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';
  const { ZEN, KAN } = Kakoi.notation;
  const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  // 滑らせるペアのコスト上限（マス単位）。これを超える組み合わせは「消滅＋出現」にする
  const MAX_COST = 4.6;

  /**
   * 駒を from → to へ滑らせる不自然さ（マス単位）。null は滑らせない（消滅＋出現にする）
   * 筋 f=1..9（右→左）、段 r=1..9（上→下）。先手の前進は r が減る向き。
   * 一つの局面から複数手進んだ差分もあるので、合法手そのものではなく緩い罰則に留める
   * @param {string} p 駒の字（data-p）
   * @param {string} from マス 例 '39'
   * @param {string} to マス 例 '56'
   * @returns {number|null}
   */
  const moveCost = (p, from, to) => {
    const dF = +to[0] - +from[0], dR = +to[1] - +from[1];
    const dist = Math.hypot(dF, dR);
    const side = dF !== 0, back = dR > 0;
    let c = dist;
    switch (p) {
      case '歩':
      case '香': // 前へしか進めない: 同じ筋で前進する組み合わせだけ滑らせる
        if (side || back) return null;
        break;
      case '桂': // 前に跳ぶ駒: 後退・横滑りはさせない。桂らしい跳び方を優遇
        if (dR >= 0) return null;
        if (!(Math.abs(dF) === 1 && dR === -2)) c += .8;
        break;
      case '銀': // 真横・真後ろは一手では行けないので緩く罰則（斜め後退は可）
        if (back !== side) c += .9;
        break;
      case '飛': // 縦横の直線上は自然な滑走（長距離も可）、それ以外は回り道として罰則
        c = (side && dR !== 0) ? dist + 1.6 : dist * .55;
        break;
      case '角': // 斜めの直線上は自然な滑走、それ以外は回り道として罰則
        c = (side && Math.abs(dF) === Math.abs(dR)) ? dist * .55 : dist + 1.6;
        break;
      // 玉・金・その他: どの向きにも進めるので距離だけ
    }
    return c <= MAX_COST ? c : null;
  };

  class BoardView {
    /** @param {{ board:HTMLElement, files:HTMLElement, ranks:HTMLElement }} els */
    constructor(els) {
      this.els = els;
      els.files.innerHTML = [9,8,7,6,5,4,3,2,1].map(f => `<div>${ZEN[f]}</div>`).join('');
      els.ranks.innerHTML = [1,2,3,4,5,6,7,8,9].map(r => `<div>${KAN[r]}</div>`).join('');
      // マスは専用の入れ物に描く（board 直下には重ね表示の SVG が同居するため）
      this.squares = document.createElement('div');
      this.squares.className = 'squares';
      els.board.prepend(this.squares);
      this._lasting = { squares: [], tone: null };
    }

    /**
     * 盤を描き直す
     * @param {Kakoi.Position} position
     * @param {{ mode:string, heat:number[][]|null, animate:boolean,
     *   trace?:{square:string, piece:string, path:string[]} }} opts
     *   trace: 主役の駒を path の各マスを経由する軌跡で動かす（戦法の筋道）
     */
    render(position, { mode, heat, animate, trace }) {
      const before = this._snapshot();
      let html = '';
      for (let r = 1; r <= 9; r++) for (let f = 9; f >= 1; f--) {
        const x = position.at(f, r), h = heat ? heat[f][r] : 0;
        html += `<div class="sq" data-sq="${f}${r}">`;
        if (h) html += `<span class="h" style="--h:${Math.min(h, 4)}"><b>${h}</b></span>`;
        if (x) html += `<div class="pc ${this._pieceClass(x, mode)}" data-p="${x.p}" data-role="${x.role}" data-owner="${x.owner}"><i><span>${x.p}</span></i></div>`;
        html += '</div>';
      }
      this.squares.innerHTML = html;
      this._settleGote(before);
      this._applyTone(this._lasting.squares, this._lasting.tone);
      if (animate && !reducedMotion()) this._flip(before, trace);
      else this.els.board.style.removeProperty('--rt-d');
    }

    /** 盤を作り直さずに、駒の表示モードだけを切り替える */
    setMode(mode) {
      for (const el of this.squares.querySelectorAll('.pc')) {
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
      if (x.role === 'core' || x.role === 'lead') return 'core';
      return mode === 'core' ? 'hidden' : mode === 'dim' ? 'off' : '';
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

    /** 描き直す前の駒の一覧。受け皿（.pc-ghost）に移した消えゆく駒は含めない */
    _snapshot() {
      return [...this.squares.querySelectorAll('.sq > .pc')].map(el => ({
        el, p: el.dataset.p, owner: el.dataset.owner, sq: el.parentElement.dataset.sq,
        r: el.getBoundingClientRect(), qr: el.parentElement.getBoundingClientRect(),
        op: +getComputedStyle(el).opacity || 0,
      }));
    }

    // 描き直し前から同じマスにいた後手の駒は、入場アニメ（goteIn）を再生しない
    _settleGote(before) {
      const prev = new Set(before.filter(x => x.owner === 'gote').map(x => x.sq));
      for (const el of this.squares.querySelectorAll('.pc.gote')) {
        const sq = el.closest('.sq');
        if (sq && prev.has(sq.dataset.sq)) el.classList.add('no-enter');
      }
    }

    // 同じ種類の駒を、駒の動きとして自然な組み合わせ（moveCost が小さい順）で対応づけ、
    // 元の位置から新しいマスへ滑らせる。対応しない駒は出現・消滅で切り替える
    _flip(before, trace) {
      const after = [...this.squares.querySelectorAll('.sq > .pc[data-owner="sente"]')]
        .map(el => ({ el, p: el.dataset.p, sq: el.parentElement.dataset.sq, r: el.getBoundingClientRect() }));
      // 戦法の主役の駒は筋道をたどる専用の動きにするので、通常の対応づけからは外す
      const lead = trace && trace.path && trace.path.length > 1
        ? after.find(n => n.sq === trace.square && n.p === trace.piece) : null;
      const pairs = [];
      after.forEach((n, ni) => before.forEach((o, oi) => {
        if (o.owner !== 'sente' || o.p !== n.p || (lead && n.el === lead.el)) return;
        const cost = moveCost(o.p, o.sq, n.sq);
        if (cost != null) pairs.push({ ni, oi, cost });
      }));
      pairs.sort((a, b) => a.cost - b.cost);
      const usedN = new Set(), usedO = new Set();
      for (const { ni, oi } of pairs) {
        if (usedN.has(ni) || usedO.has(oi)) continue;
        usedN.add(ni); usedO.add(oi);
        const n = after[ni], o = before[oi];
        const d = Math.hypot(o.r.x - n.r.x, o.r.y - n.r.y);
        if (d < 1) continue;
        n.el.animate([{ transform: `translate(${o.r.x - n.r.x}px,${o.r.y - n.r.y}px)` }, { transform: 'none' }],
                     { duration: 560, easing: 'cubic-bezier(.2,.8,.2,1)', delay: Math.min(d, 400) * .25 });
      }
      after.forEach((n, ni) => {
        if (!usedN.has(ni) && !(lead && n.el === lead.el))
          n.el.animate([{ opacity: 0, transform: 'scale(.7)' }, {}], { duration: 380, easing: 'ease-out' });
      });
      before.forEach((o, oi) => {
        if (usedO.has(oi)) return;
        // 同じマスに同じ駒が残っているものは消さない（後手の駒は対応づけの対象外なのでここで救う）
        if (this.squares.querySelector(`.sq[data-sq="${o.sq}"] > .pc[data-p="${o.p}"][data-owner="${o.owner}"]`)) return;
        this._ghost(o);
      });
      if (lead) this._route(lead.el, trace.path);
      else this.els.board.style.removeProperty('--rt-d');
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
      if (frames.length < 2) { this.els.board.style.removeProperty('--rt-d'); return; }
      frames[frames.length - 1] = { transform: 'none' };
      const dur = Math.min(280 * (frames.length - 1), 1500);
      el.animate(frames, { duration: dur, easing: 'cubic-bezier(.3,.65,.3,1)' });
      this.els.board.style.setProperty('--rt-d', `${Math.round(dur + 60)}ms`);
    }
  }

  Kakoi.BoardView = BoardView;
})();
