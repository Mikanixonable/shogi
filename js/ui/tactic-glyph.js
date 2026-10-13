// 戦法アイコン: 主役の駒の経路（route）を5×5程度の格子に写し、折れ線と終点の駒の字で描くSVG。
// 長い筋移動も収めるため、座標は「出現した値の順位」に圧縮する（方角と折れは保たれる）。
// 持ち駒に角を含む戦法（角換わり系）は右上に小さな◇を添える。family-glyph.js と同じ流儀
// （currentColor / stroke 1.6 / round）。計画書 §4-3
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';
  const { parseSquare } = Kakoi.notation;
  const N = 5, PAD = 3, AREA = 22, SIZE = PAD * 2 + AREA;   // 28×28
  const STEP = AREA / (N - 1);

  // 座標 → 描画位置: 出現した値だけを等間隔に並べる（1種類だけのときは中央）
  const axis = vals => {
    const u = [...new Set(vals)].sort((a, b) => a - b);
    const pos = new Map(u.map((v, i) => [v, i]));
    const d = u.length - 1;
    return v => PAD + (d === 0 ? AREA / 2 : (pos.get(v) / d) * AREA);
  };

  /**
   * @param {object} tactic route / lead を持つ戦法データ
   * @returns {string} インライン SVG（currentColor。装飾は css/dock.css の .tglyph 系）
   */
  Kakoi.tacticGlyph = tactic => {
    const sqs = (Array.isArray(tactic.route) && tactic.route.length ? tactic.route : [tactic.lead && tactic.lead.square])
      .filter(Boolean);
    if (!sqs.length) return '<svg class="tglyph" viewBox="0 0 28 28" aria-hidden="true"></svg>';
    const pts = sqs.map(parseSquare);
    // 盤と同じ向きに: 9筋が左・1段が上（駒の字は正立のまま）
    const ax = axis(pts.map(p => 10 - p.f));
    const ay = axis(pts.map(p => p.r));
    const xy = pts.map(p => [ax(10 - p.f), ay(p.r)]);
    let g = '';
    for (let i = 0; i < N; i++) {
      const t = (PAD + i * STEP).toFixed(1);
      g += `<line class="tgl-grid" x1="${t}" y1="${PAD}" x2="${t}" y2="${PAD + AREA}"/>`
         + `<line class="tgl-grid" x1="${PAD}" y1="${t}" x2="${PAD + AREA}" y2="${t}"/>`;
    }
    let body = '';
    if (xy.length > 1) {
      body += `<polyline class="tgl-route" points="${xy.map(p => p.map(v => v.toFixed(1)).join(',')).join(' ')}"/>`;
      body += `<circle class="tgl-start" cx="${xy[0][0].toFixed(1)}" cy="${xy[0][1].toFixed(1)}" r="1.2"/>`;
    }
    const [ex, ey] = xy[xy.length - 1];
    body += `<text class="tgl-pc" x="${ex.toFixed(1)}" y="${(ey + 0.4).toFixed(1)}">${tactic.lead ? tactic.lead.piece : ''}</text>`;
    if ((tactic.hand || '').includes('角')) {
      body += `<path class="tgl-dia" d="M${SIZE - 4.6} 1.6 l1.9 1.9 -1.9 1.9 -1.9 -1.9 Z"/>`;
    }
    return `<svg class="tglyph" viewBox="0 0 ${SIZE} ${SIZE}" fill="none" stroke="currentColor" ` +
      `stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${g}${body}</svg>`;
  };
})();
