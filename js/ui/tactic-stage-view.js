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
        '<div class="stage-f"><span class="legend"></span><span class="hand"></span><button class="play-btn" type="button">順に再生</button></div>';
      this.els = {
        ttl: el.querySelector('.ttl'), title: el.querySelector('h2'), reading: el.querySelector('.rdg'),
        context: el.querySelector('.setup'), legend: el.querySelector('.legend'), hand: el.querySelector('.hand'),
        play: el.querySelector('.play-btn'),
      };
      this.els.play.addEventListener('click', handlers.onPlay);
    }

    /**
     * @param {object} tactic @param {object} family 戦法の行
     * @param {?object} castle 盤に重ねている囲い（見出しを「戦法 × 囲い」の併記にする）
     */
    render(tactic, family, castle = null) {
      const { els } = this;
      const alias = tactic.aliases && tactic.aliases.length ? `<small class="al">別名：${esc(tactic.aliases.join('・'))}</small>` : '';
      els.title.innerHTML = esc(tactic.name) + (castle ? ` <span class="x">×</span> ${esc(castle.name)}` : '') + alias;
      els.reading.textContent = castle ? `${tactic.reading} かける ${castle.reading}` : tactic.reading;
      els.context.textContent = els.context.title = `${family.name}${tactic.context ? ` ／ ${tactic.context}` : ''}`;
      const guess = /推定/.test(tactic.note || '') ? '（途中は推定）' : '';
      const who = castle ? '朱色は主役の駒と囲いの駒' : '朱色の駒が主役';
      els.legend.innerHTML = `<i></i>${who}。破線の矢印は主役の駒の動き${guess}`;
      els.ttl.classList.remove('swap'); void els.ttl.offsetWidth; els.ttl.classList.add('swap');
    }

    /** 持ち駒の表示（合成であぶれた駒がここに出る。空なら隠れる） */
    setHand(hand) {
      this.els.hand.textContent = hand && hand.length ? `持ち駒：${hand.join('')}` : '';
    }

    /** 再生ボタンの表示を切り替える。stepOnly は動きを抑える設定のとき（1つずつ進めるだけ） */
    setPlaying(playing, stepOnly) {
      this.els.play.textContent = stepOnly ? '次の戦法へ' : playing ? '停止' : '順に再生';
      this.els.play.setAttribute('aria-pressed', playing);
    }
  }

  Kakoi.TacticStageView = TacticStageView;
})();
