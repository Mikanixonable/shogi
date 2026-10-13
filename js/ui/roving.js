// roving tabindex（計画書 U3/U8）: 部品の中に Tab で入ったら、そこから矢印キーで
// 項目間を回る。対象は「見えている項目」だけ。左右・上下とも、いまの項目から
// 方向の一致する中で幾何的にいちばん近い項目へ動く（格子でも1列でも同じ仕組み）。
//   - attach(el, sel): el 配下の sel に合う項目を監視し、keydown（矢印/Home/End）を処理
//   - refresh(): DOM の並び替え・選択状態の変化のあとに tabindex を振り直す
//   - 1つだけ tabindex=0 を残し、他は -1（Tab キーは部品ごと1回で抜ける）
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';
  const DIRS = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };

  const visible = x => !x.hidden && !x.disabled && !!(x.offsetParent || x === document.activeElement);

  function nearest(items, cur, dir) {
    const r = cur.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    let best = null, score = Infinity;
    for (const it of items) {
      if (it === cur) continue;
      const b = it.getBoundingClientRect();
      const bx = b.left + b.width / 2, by = b.top + b.height / 2;
      const dx = bx - cx, dy = by - cy;
      let primary = 0, cross = 0;
      if (dir === 'left') { if (dx > -1) continue; primary = -dx; cross = Math.abs(dy); }
      else if (dir === 'right') { if (dx < 1) continue; primary = dx; cross = Math.abs(dy); }
      else if (dir === 'up') { if (dy > -1) continue; primary = -dy; cross = Math.abs(dx); }
      else { if (dy < 1) continue; primary = dy; cross = Math.abs(dx); }
      const s = primary + cross * 3;          // 向きに垂直なズレを重く引く
      if (s < score - 1e-3) { score = s; best = it; }
    }
    return best;
  }

  /**
   * @param {HTMLElement} el コンテナ（keydown を委譲する器）
   * @param {string} sel 項目のセレクタ（button 等。tabindex を書き換える）
   * @param {{ current?:()=>HTMLElement|null, onFocus?:(el:HTMLElement)=>void }} [opt]
   *   current: 優先して tabindex=0 にする項目を返す（既定は aria-current/aria-pressed か先頭）
   */
  function attach(el, sel, opt = {}) {
    const items = () => [...el.querySelectorAll(sel)].filter(visible);
    const tabOf = () => opt.current && opt.current() || null;
    const refresh = () => {
      const xs = items();
      let cur = document.activeElement && xs.includes(document.activeElement) ? document.activeElement : tabOf();
      if (!cur) cur = xs.find(x =>
        x.getAttribute('aria-current') === 'true' || x.getAttribute('aria-pressed') === 'true'
        || x.dataset.sel === 'true') || xs[0];
      for (const x of xs) x.tabIndex = x === cur ? 0 : -1;
      return cur;
    };
    el.addEventListener('keydown', e => {
      const t = e.target && e.target.closest ? e.target.closest(sel) : null;
      if (!t || !el.contains(t)) return;
      const d = DIRS[e.key];
      if (e.key === 'Home' || e.key === 'End') {
        e.preventDefault();
        const xs = items();
        const n = e.key === 'Home' ? xs[0] : xs[xs.length - 1];
        if (n) { n.focus(); if (opt.onFocus) opt.onFocus(n); }
        refresh();
        return;
      }
      if (!d) return;
      e.preventDefault();
      const n = nearest(items(), t, d);
      if (n) { n.focus(); if (opt.onFocus) opt.onFocus(n); }
      refresh();
    });
    // フォーカスが入った項目を新しいタブ位置にする（マウスで押した項目を次の Tab 基点に）
    el.addEventListener('focusin', e => {
      const t = e.target && e.target.closest ? e.target.closest(sel) : null;
      if (!t) return;
      for (const x of items()) x.tabIndex = x === t ? 0 : -1;
    });
    return { refresh, items };
  }

  Kakoi.roving = { attach };
})();
