// セグメントコントロール: 選択肢ボタン群と、選択位置へ滑るつまみ
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
      el.addEventListener('click', e => {
        const b = e.target.closest('button[data-value]');
        if (b) onSelect(b.dataset.value);
      });
      addEventListener('resize', () => this._placeKnob());
    }

    setValue(value) {
      for (const b of this.el.querySelectorAll('button[data-value]')) b.setAttribute('aria-pressed', b.dataset.value === String(value));
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
