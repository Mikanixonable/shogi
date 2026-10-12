// 木の図: 平均連結の結合の高さを横軸にした横向きの樹形図（SVG）。k グループに切る位置を破線で示す
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';
  const { esc } = Kakoi.html;
  const DOT = 5, FS = 11.5, PAD = { l: 14, t: 30, b: 12, r: 12 };

  /** 文字列の概算幅（全角は1em、半角は0.58em） */
  const textWidth = s => [...s].reduce((w, ch) => w + (ch.charCodeAt(0) > 255 ? FS : FS * 0.58), 0);

  class ClusterTreeView {
    /** @param {HTMLElement} host @param {{ onSelect:(id:string)=>void, onHover:(key:?string, e:?PointerEvent)=>void }} handlers */
    constructor(host, handlers) {
      this.host = host;
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
      const w = this.host.clientWidth, h = this.host.clientHeight;
      if (!w || !h) return;
      const leaves = model.leaves();
      const labelW = Math.max(...leaves.map(p => Kakoi.clusterTextWidth(p.label))) + DOT + 12;
      const x0 = PAD.l, x1 = Math.max(x0 + 60, w - PAD.r - labelW);
      const rowH = (h - PAD.t - PAD.b) / leaves.length;
      const hx = ht => x0 + (1 - ht / model.maxHeight) * (x1 - x0);   // 根が左、葉（高さ0）が右
      const row = new Map(leaves.map((p, i) => [p.key, PAD.t + rowH * (i + 0.5)]));
      const sel = view.selectedId && model.pointOf(view.selectedId);

      const lines = [], dots = [];
      // 戻り値は { y: 縦位置, x: 横位置 }
      const walk = n => {
        if (n.point) {
          const y = row.get(n.point.key), x = x1;
          const dim = view.family && n.point.family !== view.family;
          dots.push(`<g class="pt${dim ? ' dim' : ''}${n.point === sel ? ' sel' : ''}" data-key="${esc(n.point.key)}" data-id="${esc(n.point.ids[0])}" data-family="${esc(n.point.family)}">`
            + `<rect class="hit" x="${x0}" y="${y - rowH / 2}" width="${w - x0}" height="${rowH}"/>`
            + (n.point === sel ? `<circle class="ring" cx="${x}" cy="${y}" r="${DOT + 4}"/>` : '')
            + `<circle class="dot" cx="${x}" cy="${y}" r="${DOT}"/>`
            + `<text class="lab" x="${x + DOT + 6}" y="${y + 0.5}" dominant-baseline="middle">${esc(n.point.label)}</text></g>`);
          return { x, y };
        }
        const a = walk(n.left), b = walk(n.right), x = hx(n.height);
        lines.push(`<path class="br" d="M${a.x} ${a.y}H${x}V${b.y}H${b.x}"/>`);
        return { x, y: (a.y + b.y) / 2 };
      };
      walk(model.tree);
      const cx = hx(model.cutHeight);
      const cut = `<line class="cut" x1="${cx}" y1="${PAD.t - 8}" x2="${cx}" y2="${h - PAD.b}"/>`
        + `<text class="cut-lab" x="${cx}" y="${PAD.t - 14}" text-anchor="middle">計算上の${model.k}グループ</text>`;
      this.host.innerHTML = `<svg class="cl-svg tree" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="囲いの形の近さの樹形図" style="font-size:${FS}px">${cut}${lines.join('')}${dots.join('')}</svg>`;
    }
  }

  Kakoi.ClusterTreeView = ClusterTreeView;
  Kakoi.clusterTextWidth = textWidth;
})();
