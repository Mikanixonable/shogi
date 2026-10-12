// 地図: MDS座標の散布図（SVG）。同形の点は1点に統合済み。ラベルは決定的にずらして重なりを避ける
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';
  const { esc } = Kakoi.html;
  const FS = 11.5, DOT = 6, PAD = { l: 18, r: 18, t: 16, b: 16 };
  const DISTANCES = [10, 22, 36, 52];
  const DIRS = [[1, 0], [-1, 0], [0, -1], [0, 1], [1, -1], [1, 1], [-1, -1], [-1, 1]];

  /** 文字列の概算幅（全角は1em、半角は0.58em） */
  const textWidth = s => [...s].reduce((w, ch) => w + (ch.charCodeAt(0) > 255 ? FS : FS * 0.58), 0);
  const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

  class ClusterMapView {
    /** @param {HTMLElement} host @param {{ onSelect:(id:string)=>void, onHover:(key:?string, e:?PointerEvent)=>void }} handlers */
    constructor(host, handlers) {
      this.host = host;
      this.handlers = handlers;
      this.model = null;
      this.view = { selectedId: null, family: null };
      host.addEventListener('click', e => {
        const g = e.target.closest('.pt');
        if (g) handlers.onSelect(g.dataset.id);
      });
      host.addEventListener('pointermove', e => {
        const g = e.target.closest('.pt');
        handlers.onHover(g ? g.dataset.key : null, g ? e : null);
      });
      host.addEventListener('pointerleave', () => handlers.onHover(null, null));
    }

    render(model, view) {
      this.model = model;
      this.view = view;
      const w = this.host.clientWidth, h = this.host.clientHeight;
      if (!w || !h) return;
      const pos = this._project(model.points, w, h);
      const labels = this._placeLabels(model.points, pos, w, h);
      const sel = view.selectedId && model.pointOf(view.selectedId);
      const items = model.points.map(p => this._pointSvg(p, pos.get(p.key), labels.get(p.key), view, sel === p)).join('');
      this.host.innerHTML = `<svg class="cl-svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="囲いの形の近さの地図">${items}</svg>`;
    }

    /** 縦横比を保って余白つきで画面へ写す */
    _project(points, w, h) {
      const xs = points.map(p => p.x), ys = points.map(p => p.y);
      const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
      const aw = w - PAD.l - PAD.r, ah = h - PAD.t - PAD.b;
      const s = Math.min(aw / Math.max(x1 - x0, 1e-6), ah / Math.max(y1 - y0, 1e-6));
      const ox = PAD.l + (aw - (x1 - x0) * s) / 2, oy = PAD.t + (ah - (y1 - y0) * s) / 2;
      return new Map(points.map(p => [p.key, { x: ox + (p.x - x0) * s, y: oy + (p.y - y0) * s }]));
    }

    /** ラベルの置き場所: 混み合った点から順に、重ならない候補を近い順に探す */
    _placeLabels(points, pos, w, h) {
      const dots = points.map(p => ({ x: pos.get(p.key).x - DOT - 2, y: pos.get(p.key).y - DOT - 2, w: DOT * 2 + 4, h: DOT * 2 + 4 }));
      const nearGap = p => Math.min(...points.filter(q => q !== p).map(q => Math.hypot(pos.get(p.key).x - pos.get(q.key).x, pos.get(p.key).y - pos.get(q.key).y)));
      const order = [...points].sort((a, b) => nearGap(a) - nearGap(b));
      const placed = [], out = new Map();
      for (const p of order) {
        const { x, y } = pos.get(p.key);
        const tw = textWidth(p.label), th = FS + 2;
        let best = null;
        for (const d of DISTANCES) for (const [ux, uy] of DIRS) {
          const diag = ux && uy ? d * 0.72 : d;
          const ax = x + ux * diag, ay = y + uy * diag;
          const rect = { x: ux > 0 ? ax : ux < 0 ? ax - tw : ax - tw / 2, y: uy > 0 ? ay : uy < 0 ? ay - th : ay - th / 2, w: tw, h: th };
          const out2 = Math.max(0, 4 - rect.x) + Math.max(0, rect.x + tw - (w - 4)) + Math.max(0, 2 - rect.y) + Math.max(0, rect.y + th - (h - 2));
          const hits = placed.filter(r => overlap(rect, r)).length + dots.filter(r => overlap(rect, r)).length;
          const score = hits * 1000 + out2 * 50 + d;
          if (!best || score < best.score) best = { score, rect, ux, uy, d, ax, ay };
        }
        placed.push(best.rect);
        out.set(p.key, {
          x: best.ux > 0 ? best.rect.x : best.ux < 0 ? best.rect.x + best.rect.w : best.rect.x + best.rect.w / 2,
          y: best.rect.y + best.rect.h / 2 + 0.5,
          anchor: best.ux > 0 ? 'start' : best.ux < 0 ? 'end' : 'middle',
          leader: best.d > DISTANCES[0] ? { x: best.ax, y: best.ay } : null,
        });
      }
      return out;
    }

    _pointSvg(p, at, lab, view, selected) {
      const dim = view.family && p.family !== view.family;
      const cls = `pt${dim ? ' dim' : ''}${selected ? ' sel' : ''}`;
      return `<g class="${cls}" data-key="${esc(p.key)}" data-id="${esc(p.ids[0])}" data-family="${esc(p.family)}">`
        + (lab.leader ? `<line class="lead" x1="${at.x}" y1="${at.y}" x2="${lab.leader.x}" y2="${lab.leader.y}"/>` : '')
        + (selected ? `<circle class="ring" cx="${at.x}" cy="${at.y}" r="${DOT + 5}"/>` : '')
        + `<circle class="dot" cx="${at.x}" cy="${at.y}" r="${DOT}"/>`
        + `<text class="lab" x="${lab.x}" y="${lab.y}" text-anchor="${lab.anchor}" dominant-baseline="middle">${esc(p.label)}</text></g>`;
    }
  }

  Kakoi.ClusterMapView = ClusterMapView;
  Kakoi.clusterTextWidth = textWidth;
})();
