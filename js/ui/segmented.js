// セグメントコントロール: 選択肢ボタン群と、選択位置へ滑るつまみ。
// セマンティクスは radiogroup（U3）: 子の button[data-value] に role=radio を付け、
// 矢印キーは「移動＝選択」。Tab で入るのは選択中の1つだけ（roving tabindex）
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';

  class Segmented {
    /**
     * @param {HTMLElement} el `.seg` 要素。子の button[data-value] が選択肢
     * @param {(value:string) => void} onSelect
     */
    constructor(el, onSelect) {
      this.el = el;
      this.knob = el.querySelector('.knob') || el.insertAdjacentElement('afterbegin', Object.assign(document.createElement('span'), { className: 'knob' }));
      el.setAttribute('role', 'radiogroup');
      for (const b of el.querySelectorAll('button[data-value]')) {
        b.setAttribute('role', 'radio');
        b.tabIndex = -1;
      }
      el.addEventListener('click', e => {
        const b = e.target.closest('button[data-value]');
        if (b) onSelect(b.dataset.value);
      });
      // radiogroup の流儀: 矢印は選択を回す（移動した時点で選ばれる）
      el.addEventListener('keydown', e => {
        if (!e.key.startsWith('Arrow')) return;
        const xs = [...el.querySelectorAll('button[data-value]:not(:disabled)')];   // 無効な選択肢は飛ばす
        const i = xs.indexOf(e.target.closest('button[data-value]'));
        if (i < 0) return;
        e.preventDefault();
        const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1;
        const n = xs[(i + d + xs.length) % xs.length];
        if (n) { n.focus(); onSelect(n.dataset.value); }
      });
      this._ac = new AbortController();
      addEventListener('resize', () => this._placeKnob(), { signal: this._ac.signal });
    }

    /** グローバルの resize 監視を外す */
    dispose() { this._ac.abort(); }

    setValue(value) {
      for (const b of this.el.querySelectorAll('button[data-value]')) {
        const on = b.dataset.value === String(value);
        b.setAttribute('aria-pressed', on);   // つまみ・CSS は従来どおり pressed を見る
        b.setAttribute('aria-checked', on);
        b.tabIndex = on ? 0 : -1;             // Tab は選択中の1つだけに入る
      }
      this._placeKnob();
    }

    _placeKnob() {
      const b = this.el.querySelector('[aria-pressed="true"]');
      if (!b) return;
      this.knob.style.width = b.offsetWidth + 'px';
      this.knob.style.transform = `translateX(${b.offsetLeft}px)`;
    }
  }

  Kakoi.Segmented = Segmented;
})();
