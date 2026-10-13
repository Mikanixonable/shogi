// ヘッダーの表示設定ポップオーバー: 駒の表示方法、守りの利き、脅威の帯、リセット
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';

  class ToolbarView {
    /**
     * @param {{ mode:HTMLElement, heat:HTMLInputElement, threat:HTMLInputElement, reset?:HTMLButtonElement }} els
     * @param {(patch:object) => void} onChange
     * @param {(() => void)|null} onReset リセットボタンの処理
     */
    constructor(els, onChange, onReset = null) {
      this.els = els;
      this.mode = new Kakoi.Segmented(els.mode, v => onChange({ mode: v }));
      els.heat.addEventListener('change', () => onChange({ heat: els.heat.checked }));
      els.threat.addEventListener('change', () => onChange({ showThreat: els.threat.checked }));
      if (els.reset) els.reset.addEventListener('click', () => { if (onReset) onReset(); });
    }

    render(state) {
      this.mode.setValue(state.mode);
      this.els.heat.checked = state.heat;
      this.els.threat.checked = state.showThreat !== false;
    }
  }

  Kakoi.ToolbarView = ToolbarView;
})();
