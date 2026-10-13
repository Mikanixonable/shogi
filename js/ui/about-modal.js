// 「このサイトについて」モーダル: ロゴ横のボタンで <dialog> を開閉するだけの小さな部品。
// Esc・フォーカスの閉じ込めはブラウザの dialog 機能に任せ、背景クリックで閉じる分だけ自分で受け持つ
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';

  class AboutModal {
    /** @param {HTMLButtonElement|null} openBtn 開くボタン @param {HTMLDialogElement|null} dlg モーダル本体 */
    constructor(openBtn, dlg) {
      if (!openBtn || !dlg) return;
      openBtn.addEventListener('click', () => dlg.showModal());
      // dialog 自身がクリックされた=中身の外（backdrop 相当）なので閉じる
      dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
      for (const b of dlg.querySelectorAll('[data-close]')) b.addEventListener('click', () => dlg.close());
    }
  }

  Kakoi.AboutModal = AboutModal;
})();
