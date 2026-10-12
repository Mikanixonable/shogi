// 盤の重ね表示: 囲いの骨格線と、筋道（手順）の矢印を SVG で盤の上に描く
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';

  /** マス "39" の中心（viewBox は 9×9、1マス=1） */
  const center = sq => ({ x: 9 - +sq[0] + .5, y: +sq[1] - .5 });

  class OverlayView {
    /** @param {HTMLElement} boardEl position:relative の盤。squares の再描画では消えない兄弟として追加する */
    constructor(boardEl) {
      this.svg = document.createElementNS(NS, 'svg');
      this.svg.setAttribute('class', 'overlay');
      this.svg.setAttribute('viewBox', '0 0 9 9');
      this.svg.setAttribute('preserveAspectRatio', 'none');
      this.svg.setAttribute('aria-hidden', 'true');
      this.svg.innerHTML =
        '<defs><marker id="rtHead" viewBox="0 0 10 10" refX="8" refY="5" markerUnits="userSpaceOnUse" markerWidth=".42" markerHeight=".42" orient="auto">' +
        '<path class="rt-head" d="M0 0L10 5L0 10L3 5z"/></marker></defs>' +
        '<g class="sk-g"></g><g class="rt-g"></g>';
      this.skeletonLayer = this.svg.querySelector('.sk-g');
      this.routeLayer = this.svg.querySelector('.rt-g');
      boardEl.appendChild(this.svg);
    }

    /** 囲いの駒（role=core）のうち隣り合うもの同士を線で結ぶ。null で消す */
    skeleton(position) {
      const layer = this.skeletonLayer;
      layer.replaceChildren();
      if (!position) return;
      const core = position.pieces.filter(x => x.role === 'core');
      const at = x => ({ x: 9 - x.f + .5, y: x.r - .5 });
      let html = '';
      core.forEach((a, i) => core.slice(i + 1).forEach(b => {
        if (Math.max(Math.abs(a.f - b.f), Math.abs(a.r - b.r)) !== 1) return;
        const p = at(a), q = at(b);
        html += `<line class="sk sk-line" x1="${p.x}" y1="${p.y}" x2="${q.x}" y2="${q.y}"/>`;
      }));
      for (const x of core) {
        const c = at(x);
        html += x.p === '玉'
          ? `<circle class="sk sk-ring" cx="${c.x}" cy="${c.y}" r=".3"/>`
          : `<circle class="sk sk-dot" cx="${c.x}" cy="${c.y}" r=".11"/>`;
      }
      layer.innerHTML = html;
      layer.style.animation = 'none'; layer.getBoundingClientRect(); layer.style.animation = ''; // フェードインをやり直す
    }

    /**
     * マスの列を結ぶ破線の矢印。null で消す
     * @param {string[]|null} squares 例: ['39','38','27','26']
     * @param {{ tone?: 'good'|'bad' }} [opts]
     */
    route(squares, { tone } = {}) {
      this.routeLayer.replaceChildren();
      if (!squares || squares.length < 2) return;
      const pts = squares.map(center).map(c => `${c.x},${c.y}`).join(' ');
      const color = tone === 'good' ? 'var(--good)' : tone === 'bad' ? 'var(--bad)' : 'var(--accent)';
      this.svg.style.setProperty('--rt', color);
      this.routeLayer.innerHTML = `<polyline class="rt rt-line" points="${pts}" marker-end="url(#rtHead)"/>`;
    }

    clear() { this.skeleton(null); this.route(null); }
  }

  Kakoi.OverlayView = OverlayView;
})();
