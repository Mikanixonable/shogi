// 戦法の順に再生コントローラ（計画書 S6 の tactic-playback）:
// 再生中の状態は store の非永続キー `play`（{who, tacticId}）に昇格させる。
// persistKeys に入っていないので保存にもハッシュにも出ない。TacticPlayer は
// タイマーだけを担い、「いま見せている戦法」はこのキーが持つ＝表示の差し替えは
// スロットを書き換えない（履歴・ハッシュにも出ない）
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';
  const K = window.Kakoi;

  class TacticPlayback {
    /**
     * @param {Kakoi.Store} store play キーを書き込む先
     * @param {{ onChange?:(playing:boolean)=>void }} [opts] 再生状態の変化（ボタン表示用）
     */
    constructor(store, { onChange } = {}) {
      this.store = store;
      this.onChange = onChange || (() => {});
      this.player = new K.TacticPlayer({
        onStep: t => {
          const p = store.state.play;
          if (p) store.set({ play: { ...p, tacticId: t.id } });
        },
        onChange: playing => {
          // 終了・停止で差し替えを解除する（次の update で本来の制約が戻る）
          if (!playing && store.state.play) store.set({ play: null });
          this.onChange(playing);
        },
      });
    }

    get playing() { return this.player.playing; }
    /** @returns {{who:string, tacticId:string|null}|null} いまの再生差し替え */
    get current() { return this.store.state.play || null; }

    /**
     * @param {'me'|'opp'} who 再生する側（開始時に固定）
     * @param {object[]} list 順に再生する戦法
     */
    start(who, list) {
      if (list.length < 2) return;
      this.store.set({ play: { who, tacticId: null } });
      this.player.start(list);   // 1手目の onStep が同期で走り tacticId が入る
    }

    stop() {
      this.player.stop();
      if (this.store.state.play) this.store.set({ play: null });
    }
  }

  K.TacticPlayback = TacticPlayback;
})();
