// 表示設定の開閉（狭い画面用）: 歯車ボタンで .tools の開閉だけを受け持つ。
// 中身の設定項目は ToolbarView が管理するので、ここでは見せる・隠すだけに徹する
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';

  class ToolsToggle {
    /** @param {HTMLButtonElement|null} btn 開閉ボタン @param {HTMLElement|null} panel 開閉される側（.tools） */
    constructor(btn, panel) {
      if (!btn || !panel) return;
      const setOpen = open => {
        panel.classList.toggle('open', open);
        btn.setAttribute('aria-expanded', String(open));
        // 狭い画面ではボトムシートとして開く。スクリムの表示を body の属性で知らせる（M5）
        if (open) document.body.dataset.tools = 'open';
        else delete document.body.dataset.tools;
      };
      btn.addEventListener('click', () => setOpen(!panel.classList.contains('open')));
      document.addEventListener('pointerdown', e => {
        if (panel.classList.contains('open') && !panel.contains(e.target) && !btn.contains(e.target)) setOpen(false);
      });
      document.addEventListener('keydown', e => {
        if (e.key !== 'Escape' || !panel.classList.contains('open')) return;
        setOpen(false);
        btn.focus();
      });
      // ボトムシートの定石: 上端から下へ引くと閉じる（M5）
      let sy = null;
      panel.addEventListener('touchstart', e => { sy = e.touches.length === 1 ? e.touches[0].clientY : null; }, { passive: true });
      panel.addEventListener('touchmove', e => {
        if (sy != null && e.touches[0].clientY - sy > 48) { sy = null; setOpen(false); }
      }, { passive: true });
      panel.addEventListener('touchend', () => { sy = null; }, { passive: true });
    }
  }

  Kakoi.ToolsToggle = ToolsToggle;
})();
