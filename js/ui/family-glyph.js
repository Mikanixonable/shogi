// 系統の記号: 形の特徴を表す小さな線画（16x16、currentColor）
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';

  const SHAPES = {
    funa: '<path d="M2 6 Q8 15 14 6"/>',                                   // 浅い舟形
    L: '<path d="M12 2.5 V13 H3"/>',                                       // 逆L: 右の縦線と下の横線
    V: '<path d="M2 12 L8 4 L14 12"/>',                                    // 逆V
    corner: '<rect x="2" y="2" width="12" height="12"/><rect x="2" y="9" width="5" height="5"/>', // 隅の小さな四角
    diag: '<path d="M3 13 L13 3"/><circle cx="3" cy="13" r=".9"/><circle cx="8" cy="8" r=".9"/><circle cx="13" cy="3" r=".9"/>',
  };

  /** @param {string} glyphId taxonomy の glyph @returns {string} インライン SVG 文字列 */
  Kakoi.familyGlyph = glyphId =>
    `<svg class="fglyph" viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${SHAPES[glyphId] || ''}</svg>`;
})();
