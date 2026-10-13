// 左ドックのスプリッタ（計画書 §4-2 / S6 の Splitter）: 上下2面の分割比。
// role=separator、↑↓キーで5%刻み・ダブルクリックで 0.5・pointer ドラッグ。
// ドラッグ中は CSS 変数だけを書き換え、終了時に store.set({dock:{split}}) で永続化
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';
  const K = window.Kakoi;
  const { MIN_PANE, SPLIT_MIN, SPLIT_MAX } = K.lookup.DOCK;

  /**
   * @param {HTMLElement} sep `.dk-sep`
   * @param {HTMLElement} root `.dk`（--dock-split を持つ入れ物）
   * @param {Kakoi.Store} store dock.split を読み書きする先
   */
  function bind(sep, root, store) {
    const clamp = v => Math.min(SPLIT_MAX, Math.max(SPLIT_MIN, v));
    const ratio = y => {
      const r = root.getBoundingClientRect();
      if (!r.height) return .5;
      const lo = Math.max(SPLIT_MIN, MIN_PANE / r.height);
      const hi = Math.min(SPLIT_MAX, 1 - MIN_PANE / r.height);
      return Math.min(hi, Math.max(lo, (y - r.top) / r.height));
    };
    // ドラッグ中は CSS 変数だけを書き換える（§2: 終了時に store.set）
    const paint = v => {
      root.style.setProperty('--dock-split', +v.toFixed(4));
      sep.setAttribute('aria-valuenow', String(Math.round(v * 100)));
      sep.setAttribute('aria-valuetext', `上 ${Math.round(v * 100)}パーセント、下 ${Math.round(100 - v * 100)}パーセント`);
    };
    const commit = v => store.set({ dock: { ...store.state.dock, split: +clamp(v).toFixed(2) } });
    let drag = null;
    sep.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      // preventDefault しない: click/dblclick（0.5に戻す）とフォーカス（↑↓キー）を殺さないため。
      // ドラッグ中の選択範囲は CSS の user-select:none で抑える
      sep.setPointerCapture(e.pointerId);
      drag = ratio(e.clientY);
      paint(drag);
    });
    sep.addEventListener('pointermove', e => {
      if (drag == null) return;
      drag = ratio(e.clientY);
      paint(drag);
    });
    const end = () => {
      if (drag == null) return;
      const v = drag;
      drag = null;
      commit(v);
    };
    sep.addEventListener('pointerup', end);
    sep.addEventListener('pointercancel', end);
    sep.addEventListener('dblclick', () => commit(.5));
    sep.addEventListener('keydown', e => {
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown' && e.key !== 'Home') return;
      e.preventDefault();
      const cur = +store.state.dock.split || .5;
      commit(e.key === 'Home' ? .5 : cur + (e.key === 'ArrowDown' ? .05 : -.05));
    });
  }

  K.dockSplitter = { bind };
})();
