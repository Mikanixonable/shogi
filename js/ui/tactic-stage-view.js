// 戦法モードの中央の見出しと足元: 名前・別名・読み・行と文脈、凡例、順に再生ボタン
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';
  const { esc } = Kakoi.html;

  class TacticStageView {
    /**
     * @param {HTMLElement} el `#tacticStage`
     * @param {{ onPlay:()=>void }} handlers
     */
    constructor(el, handlers) {
      el.innerHTML =
        '<div class="stage-h"><div class="ttl"><h2></h2><div class="rd"><span class="rdg"></span><span class="setup"></span></div></div></div>' +
        '<div class="stage-f"><span class="legend"></span><button class="play-btn" type="button">順に再生</button></div>';
      this.els = {
        ttl: el.querySelector('.ttl'), title: el.querySelector('h2'), reading: el.querySelector('.rdg'),
        context: el.querySelector('.setup'), legend: el.querySelector('.legend'), play: el.querySelector('.play-btn'),
      };
      this.els.play.addEventListener('click', handlers.onPlay);
    }

    /** @param {object} tactic @param {object} family 戦法の行 */
    render(tactic, family) {
      const { els } = this;
      const alias = tactic.aliases && tactic.aliases.length ? `<small class="al">別名：${esc(tactic.aliases.join('・'))}</small>` : '';
      els.title.innerHTML = esc(tactic.name) + alias;
      els.reading.textContent = tactic.reading;
      els.context.textContent = els.context.title = `${family.name}${tactic.context ? ` ／ ${tactic.context}` : ''}`;
      const guess = /推定/.test(tactic.note || '') ? '（途中は推定）' : '';
      els.legend.innerHTML = `<i></i>朱色の駒が主役。破線の矢印は主役の駒の動き${guess}`;
      els.ttl.classList.remove('swap'); void els.ttl.offsetWidth; els.ttl.classList.add('swap');
    }

    /** 再生ボタンの表示を切り替える。stepOnly は動きを抑える設定のとき（1つずつ進めるだけ） */
    setPlaying(playing, stepOnly) {
      this.els.play.textContent = stepOnly ? '次の戦法へ' : playing ? '停止' : '順に再生';
      this.els.play.setAttribute('aria-pressed', playing);
    }
  }

  Kakoi.TacticStageView = TacticStageView;
})();
