// 表示設定の開閉（狭い画面用）: 歯車ボタンで .tools の開閉だけを受け持つ。
// 中身の設定項目は ToolbarView が管理するので、ここでは見せる・隠すだけに徹する
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';

  class ToolsToggle {
    /** @param {HTMLButtonElement|null} btn 開閉ボタン @param {HTMLElement|null} panel 開閉される側（.tools） */
    constructor(btn, panel) {
      if (!btn || !panel) return;
      btn.addEventListener('click', () => {
        const open = panel.classList.toggle('open');
        btn.setAttribute('aria-expanded', String(open));
      });
    }
  }

  Kakoi.ToolsToggle = ToolsToggle;
})();
