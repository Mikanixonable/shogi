// 左ドックの面（計画書 S6 の DockPane）: who 固定（上=相手・下=自分）の1面。
// ヘッダ（fold ボタン・側の名前・タブ・「＋ 相手を加える」・はずす）と戦略セグと
// 本体（.dk-body。roving tabindex の領域）を組み立てる
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';
  const K = window.Kakoi;
  const { esc } = K.html;
  const STRATEGY_IDS = ['ibisha', 'furibisha'];

  /** @param {'me'|'opp'} who @returns {string} 面の outerHTML */
  function html(who) {
    return `<section class="dk-pane" data-who="${who}">
      <header class="dk-pane-h">
        <button type="button" class="dk-fold" aria-expanded="true"
          title="${who === 'me' ? '自分' : '相手'}の面を畳む／開く"><i class="caret" aria-hidden="true"></i></button>
        <span class="dk-who-l">${who === 'me' ? '自分 ▲' : '相手 △'}</span>
        <div class="seg dk-tab" role="group" aria-label="一覧（戦法／囲い）">
          <button type="button" data-value="tactic">戦法</button><button type="button" data-value="castle">囲い</button>
        </div>
        ${who === 'opp' ? '<button type="button" class="dk-addopp">＋ 相手を加える</button>' : ''}
        <button type="button" class="dk-clear" data-clear="${who}"
          title="${who === 'me' ? '自分' : '相手'}の制約をすべて外す">はずす</button>
      </header>
      <div class="seg small wide dk-strategy" role="group" aria-label="${who === 'me' ? '自分' : '相手'}の戦略">
        ${STRATEGY_IDS.map(id =>
          `<button type="button" data-value="${id}" data-kind="strategy" data-id="${id}">${esc(K.STRATEGIES[id].label)}</button>`).join('')}
      </div>
      <div class="dk-body" tabindex="0" role="region"
        aria-label="${who === 'me' ? '自分' : '相手'}の一覧"></div>
    </section>`;
  }

  /**
   * 面の DOM を束ねる。タブ・戦略セグ・fold・roving を配線し、更新用の pane オブジェクトを返す
   * @param {HTMLElement} el `_paneHtml` で作った section
   * @param {'me'|'opp'} who
   * @param {{ store:Kakoi.Store,
   *   setPane:(who:string, patch:object)=>void,
   *   onChoose:(who:string,kind:string,id:string)=>void,
   *   onAddOpponent?:()=>void }} ctx
   */
  function init(el, who, ctx) {
    const pane = {
      who, el, body: el.querySelector('.dk-body'), views: {}, cur: null, cfgKey: null,
      fold: el.querySelector('.dk-fold'), strategySeg: el.querySelector('.dk-strategy'),
      addopp: el.querySelector('.dk-addopp'), clear: el.querySelector('.dk-clear'),
    };
    pane.segTab = new K.Segmented(el.querySelector('.dk-tab'), v => ctx.setPane(who, { tab: v }));
    pane.segStrategy = new K.Segmented(el.querySelector('.dk-strategy'),
      v => ctx.onChoose(who, 'strategy', v));
    // タイル・チップは roving tabindex（U3）。矢印でフォーカスを移し Enter で選ぶ
    pane.roving = K.roving.attach(el.querySelector('.dk-body'), '.dk-item');
    pane.fold.addEventListener('click', () => {
      const cfg = (ctx.store.state.dock || {})[who] || {};
      ctx.setPane(who, { open: cfg.open === false }); // 既定は開。閉じている時だけ true
    });
    if (pane.addopp) pane.addopp.addEventListener('click', () => ctx.onAddOpponent && ctx.onAddOpponent());
    return pane;
  }

  K.dockPane = { html, init };
})();
