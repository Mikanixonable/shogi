// 戦法モード（仮）: 後続で本実装する。今は準備中の表示と、共有の盤に先頭の戦法の配置を出すだけ
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';

  class TacticMode {
    /** @param {{ repo, store, board, overlay, els:{ rail:HTMLElement, stage:HTMLElement, detail:HTMLElement } }} deps */
    constructor({ repo, store, board, overlay, els }) {
      Object.assign(this, { repo, store, board, overlay, els });
    }

    enter(state) {
      const { els } = this;
      els.rail.innerHTML = '<p class="placeholder">戦法モード（準備中）</p>';
      els.stage.innerHTML = '<div class="stage-h"><div class="ttl"><h2>戦法</h2></div></div><div class="stage-f"></div>';
      els.detail.innerHTML = '';
      this._renderBoard(state);
    }

    leave() {
      this.board.setLasting([], null);
      this.overlay.clear();
    }

    update(state, changed) {
      if (changed.has('tacticId')) this._renderBoard(state);
      else if (changed.has('mode')) this.board.setMode(state.mode);
    }

    _renderBoard(state) {
      const { repo, board, overlay } = this;
      const tactic = repo.tacticById(state.tacticId) || repo.tactics()[0];
      overlay.clear();
      board.setLasting([], null);
      if (tactic) board.render(repo.tacticPositionOf(tactic), { mode: state.mode, heat: null, animate: false });
    }
  }

  Kakoi.TacticMode = TacticMode;
})();
