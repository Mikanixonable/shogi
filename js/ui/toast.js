// トースト: 画面の下に短く出す通知。自動で消え、「元に戻す」などの操作を1つ載せられる。
// ホバー（フォーカス）中はタイマーを止める。表示時間は8秒（計画書 U2）
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';
  let el = null, timer = null, left = 0;

  const arm = ms => { clearTimeout(timer); left = ms; timer = setTimeout(hide, ms); };
  const pause = () => { if (timer) { clearTimeout(timer); timer = null; } }; // left は残したまま保持
  const resume = () => { if (!timer && left > 0) arm(left); };

  function hide() {
    if (el) el.classList.remove('on');
    clearTimeout(timer);
    timer = null;
    left = 0;
  }

  /**
   * @param {string} text 通知文
   * @param {{ action?:{label:string, fn:()=>void}, ms?:number, host?:Element|string }} [opts]
   *   action: 本文の横に置くボタン（押すとトーストを閉じて fn を呼ぶ）
   *   ms: 自動で消えるまでの時間（既定 8000ms。ホバー・フォーカス中は停止）
   *   host: 置き場所（要素またはセレクタ。省略時は body の末尾＝画面への重ね表示）
   */
  function show(text, { action, ms = 8000, host } = {}) {
    if (!el) {
      el = document.createElement('div');
      el.className = 'toast';
      el.setAttribute('role', 'status');
      el.setAttribute('aria-live', 'polite');
      // ホバー中・ボタンにフォーカス中は自動消去を止める（U2）
      el.addEventListener('mouseenter', pause);
      el.addEventListener('focusin', pause);
      el.addEventListener('mouseleave', resume);
      el.addEventListener('focusout', resume);
    }
    const target = host instanceof Element ? host
      : (host && document.querySelector(host)) || document.body;
    if (el.parentNode !== target) target.appendChild(el);
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
    arm(ms);
  }

  Kakoi.Toast = { show, hide };
})();
