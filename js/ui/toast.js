// トースト: 画面の下に短く出す通知。自動で消え、「元に戻す」などの操作を1つ載せられる
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';
  let el = null, timer = null;

  function hide() {
    if (el) el.classList.remove('on');
    clearTimeout(timer);
    timer = null;
  }

  /**
   * @param {string} text 通知文
   * @param {{ action?:{label:string, fn:()=>void}, ms?:number }} [opts]
   *   action: 本文の横に置くボタン（押すとトーストを閉じて fn を呼ぶ）
   *   ms: 自動で消えるまでの時間（既定 4500ms）
   */
  function show(text, { action, ms = 4500 } = {}) {
    if (!el) {
      el = document.createElement('div');
      el.className = 'toast';
      el.setAttribute('role', 'status');
      el.setAttribute('aria-live', 'polite');
      document.body.appendChild(el);
    }
    hide(); // 前のトーストを置き換える
    el.replaceChildren();
    const msg = document.createElement('span');
    msg.className = 'toast-msg';
    msg.textContent = text;
    el.appendChild(msg);
    if (action) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'toast-act';
      b.textContent = action.label;
      b.addEventListener('click', () => { hide(); action.fn(); });
      el.appendChild(b);
    }
    // 出現アニメーションを毎回最初から（連続して出ても見直せるように）
    el.classList.add('on');
    timer = setTimeout(hide, ms);
  }

  Kakoi.Toast = { show, hide };
})();
