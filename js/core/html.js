// HTML文字列の補助: テンプレートに埋め込む文字列のエスケープと data-sq 属性
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';

  const ENT = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = s => String(s).replace(/[&<>"']/g, c => ENT[c]);
  /** マスの配列を data-sq 属性にする（空なら空文字） */
  const sqAttr = sq => sq && sq.length ? ` data-sq="${sq.join(' ')}"` : '';

  Kakoi.html = { esc, sqAttr };
})();
