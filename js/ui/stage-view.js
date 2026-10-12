// 中央の見出しと足元: 囲いの名前・読み・想定配置、凡例、持ち駒
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';

  const LEGEND = {
    castle: ['var(--core)', '赤字が囲いを構成する駒'],
    heatCore: ['rgba(var(--heat),.55)', '数字は囲いの駒（赤字）が利いている数'],
    heatAll: ['rgba(var(--heat),.55)', '数字は先手の全ての駒が利いている数'],
    attack: ['var(--bad)', '紺色の逆さの駒は攻めてくる後手の駒（例示）。枠のマスが狙われる'],
  };

  class StageView {
    /** @param {{ title, titleWrap, reading, setup, legend, hand }} els */
    constructor(els) { this.els = els; }

    renderCastle(castle) {
      const { els } = this;
      els.title.textContent = castle.name;
      els.reading.textContent = castle.reading;
      els.setup.textContent = `周辺の駒：${Kakoi.SETUPS[castle.setup].label}`;
      els.hand.textContent = castle.hand ? `持ち駒：${castle.hand}` : '';
      els.titleWrap.classList.remove('swap'); void els.titleWrap.offsetWidth; els.titleWrap.classList.add('swap');
    }

    renderLegend(state) {
      const key = state.attackId ? 'attack' : state.heat ? (state.heatScope === 'all' ? 'heatAll' : 'heatCore') : 'castle';
      const [color, text] = LEGEND[key];
      this.els.legend.innerHTML = `<i style="background:${color}"></i>${text}`;
    }
  }

  Kakoi.StageView = StageView;
})();
