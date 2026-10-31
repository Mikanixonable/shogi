// 出典リンクのホバー連動（DOM 操作なので ui/ に置く。計画書 S6: core/html.js から移動）
// 本文の [n] リンクにホバーしたとき、出典リストの該当行を強調する（.cite-on をトグル）。
// コンテナに1回だけ貼る委譲リスナ。描き直し（innerHTML の差し替え）をまたいで有効
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';
  const bindCites = container => {
    const linkOf = t => (t && t.closest) ? t.closest('.cite a[href^="#src-"]') : null;
    const mark = (a, on) => {
      if (!a) return;
      const li = container.querySelector(`#${a.getAttribute('href').slice(1)}`);
      if (li) li.classList.toggle('cite-on', on);
    };
    container.addEventListener('mouseover', e => mark(linkOf(e.target), true));
    // タッチでも連動するよう、タップで出典行を強調する（B3）
    container.addEventListener('click', e => mark(linkOf(e.target), true));
    container.addEventListener('mouseout', e => {
      const a = linkOf(e.target);
      if (a && !(e.relatedTarget && a.contains(e.relatedTarget))) mark(a, false);
    });
  };
  Kakoi.cites = { bind: bindCites };
})();
