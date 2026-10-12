// 明暗の切替: ボタンを押すたび <html data-theme> を切り替え、選択を記憶する（既定はライト。
// 初期適用は castles.html 先頭のスクリプトが CSS より前に行うので、ここでは操作だけを受け持つ）
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';
  const KEY = 'shogi-theme';

  class ThemeToggle {
    /** @param {HTMLButtonElement|null} el 切替ボタン（なくてもよい） */
    constructor(el) {
      if (el) el.addEventListener('click', () => this.toggle());
    }

    current() { return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'; }

    toggle() {
      const next = this.current() === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      try { localStorage.setItem(KEY, next); } catch (e) { /* file:// で保存できなくても切替自体は効かせる */ }
    }
  }
  ThemeToggle.KEY = KEY;

  Kakoi.ThemeToggle = ThemeToggle;
})();
