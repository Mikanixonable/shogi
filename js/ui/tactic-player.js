// 順に再生: 与えられた戦法の列を一定間隔で1つずつ進め、最後まで行ったら止める
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';

  class TacticPlayer {
    /**
     * @param {{ interval?:number, onStep:(tactic:object)=>void, onChange:(playing:boolean)=>void }} opts
     */
    constructor({ interval = 1200, onStep, onChange }) {
      this.interval = interval;
      this.onStep = onStep;
      this.onChange = onChange;
      this._timer = null;
    }

    get playing() { return this._timer !== null; }

    /** list の先頭から再生を始める */
    start(list) {
      this.stop();
      if (list.length < 2) return;
      let i = 0;
      this.onStep(list[0]);
      this._timer = setInterval(() => {
        i += 1;
        this.onStep(list[i]);
        if (i >= list.length - 1) this.stop();
      }, this.interval);
      this.onChange(true);
    }

    stop() {
      if (this._timer === null) return;
      clearInterval(this._timer);
      this._timer = null;
      this.onChange(false);
    }
  }

  Kakoi.TacticPlayer = TacticPlayer;
})();
