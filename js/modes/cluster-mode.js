// 分類マップモード（仮）: 後続で本実装する。盤は使わず、準備中の表示だけ出す
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';

  class ClusterMode {
    /** @param {{ repo, store, board, overlay, els:{ rail:HTMLElement, stage:HTMLElement, detail:HTMLElement } }} deps */
    constructor({ repo, store, board, overlay, els }) {
      Object.assign(this, { repo, store, board, overlay, els });
    }

    enter() {
      const { els } = this;
      els.rail.innerHTML = '';
      els.stage.innerHTML = '<p class="placeholder">分類マップ（準備中）</p>';
      els.detail.innerHTML = '';
    }

    leave() {}

    update() {}
  }

  Kakoi.ClusterMode = ClusterMode;
})();
