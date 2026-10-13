// アプリの組み立て: 状態・共有の部品・唯一の画面（対局図）を結び、状態の変化を画面へ伝える。
// 盤面の状態（slots=各側の戦法・囲い、showOpp=相手の表示、selected=選択中の層）は
// URL ハッシュだけが正（hash-link.js）。表示の好み（駒の表示・利き・脅威の帯・左ドックの層）は
// localStorage に持つ。起動時は ハッシュ → 好み の順に重ね、不正な値は初期値へ丸める
(() => {
  'use strict';
  const K = window.Kakoi;
  const $ = id => document.getElementById(id);
  const debug = new URLSearchParams(location.search).has('debug');

  const DATA = {
    CASTLES: K.CASTLES, SETUPS: K.SETUPS, SOURCES: K.SOURCES, CASTLE_FAMILIES: K.CASTLE_FAMILIES,
    TACTICS: K.TACTICS, TACTIC_FAMILIES: K.TACTIC_FAMILIES,
  };

  // ?debug のときだけデータを検証して console に出す
  function debugValidate() {
    const report = K.validate.all(DATA);
    for (const r of report.results) {
      if (r.errors.length || r.warnings.length) console.warn(`[${r.kind}:${r.id}]`, [...r.errors, ...r.warnings].join(' / '));
    }
    for (const w of report.warnings) console.warn(w);
  }
  if (debug) debugValidate();

  const repo = new K.Repository(DATA);

  const store = new K.Store(
    {
      slots: K.constraints.emptySlots(),    // {me:{tactic,castle}, opp:{tactic,castle}} 未選択は null
      showOpp: false,                       // 相手を盤に出すか（OFF でも相手のスロットは持ち続ける）
      selected: null,                       // 'me.castle' 形式（`{who}.{kind}`）。起動時に握り直す
      attackId: null,
      mode: 'dim', heat: false, showThreat: true,
      dockTab: 'castle',                    // 左ドックで最後に見ていた層（ハッシュに選択が無いときの既定）
    },
    ['mode', 'heat', 'showThreat', 'dockTab'],
    'shogi-castle',
  );

  // ---- 起動時の正規化: 保存した好み → URLハッシュ（貼られたURLが最優先）の順に重ねる ----
  {
    const st = store.state;
    if (st.mode !== 'all' && st.mode !== 'dim') st.mode = 'dim';   // 旧「囲いのみ」などは既定に戻す
    st.showThreat = st.showThreat !== false;
    if (st.dockTab !== 'tactic' && st.dockTab !== 'castle') st.dockTab = 'castle';
    Object.assign(st, K.hashLink.read(st.dockTab));
  }

  // 共有の部品: 盤と重ね表示は1組を使う
  const board = new K.BoardView({ board: $('board'), files: $('files'), ranks: $('ranks') });
  const overlay = new K.OverlayView($('board'));
  if (debug) window.__kakoi = { overlay, board, repo, store };

  const mode = new K.ConstraintMode({
    repo, store, board, overlay,
    els: {
      stage: $('stageMain'), bandOpp: $('bandOpp'), bandMe: $('bandMe'),
      barOpp: $('cbarOpp'), barMe: $('cbarMe'),
      nameOpp: $('nameOpp'), subOpp: $('subOpp'), nameMe: $('nameMe'), subMe: $('subMe'),
      handOpp: $('handOpp'), handMe: $('handMe'),
      showOpp: $('showOpp'),
      rail: $('pickRail'),
      detail: $('detail'),
    },
  });
  const toolbar = new K.ToolbarView(
    { mode: $('modeSeg'), heat: $('heat'), threat: $('threat'), reset: $('resetSettings') },
    patch => store.set(patch),
    () => mode.reset(),   // リセット: 盤面の状態を初期状態へ（ハッシュが空になる）
  );
  new K.ThemeToggle($('themeToggle'));
  new K.ToolsToggle($('toolsToggle'), $('tools'));
  new K.AboutModal($('aboutOpen'), $('aboutDialog'));
  // 中くらいの幅（≤1180px）で右ドックはドロワー。タブで開閉する（§4-6）
  {
    const t = $('detailToggle');
    const sync = () => t.setAttribute('aria-expanded', String(document.body.dataset.drawer === 'open'));
    t.addEventListener('click', () => {
      document.body.dataset.drawer = document.body.dataset.drawer === 'open' ? '' : 'open';
      sync();
    });
    new MutationObserver(sync).observe(document.body, { attributes: true, attributeFilter: ['data-drawer'] });
  }

  store.subscribe((state, changed) => {
    mode.update(state, changed);
    toolbar.render(state);
  });
  K.hashLink.attach(store); // 盤面の状態の変化を location.hash へ映し、「戻る」・アドレスバーの編集も受け取る

  mode.enter(store.state);
  toolbar.render(store.state);
})();
