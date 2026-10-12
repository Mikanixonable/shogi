// アプリの組み立て: 状態・共有の部品・画面ごとのモードを結び、状態の変化を有効なモードへ伝える
(() => {
  'use strict';
  const K = window.Kakoi;
  const $ = id => document.getElementById(id);
  const VIEWS = ['castle', 'tactic', 'cluster'];
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
      view: 'castle', castleId: repo.castles()[0].id, mode: 'dim', heat: false, skeleton: false, heatScope: 'core', attackId: null,
      lastBySide: {}, familyFilter: null, tacticId: repo.tactics()[0]?.id ?? null, clusterFamily: null,
    },
    ['view', 'castleId', 'mode', 'heat', 'skeleton', 'heatScope', 'lastBySide', 'familyFilter', 'tacticId', 'clusterFamily'],
    'shogi-castle',
  );
  // 保存値の検証（囲い固有のものは CastleMode が行う）
  if (!VIEWS.includes(store.state.view)) store.state.view = 'castle';
  if (!repo.hasTactic(store.state.tacticId)) store.state.tacticId = repo.tactics()[0]?.id ?? null;

  // 共有の部品: 盤と重ね表示は囲い・戦法で1組を使い回す
  const board = new K.BoardView({ board: $('board'), files: $('files'), ranks: $('ranks') });
  const overlay = new K.OverlayView($('board'));
  if (debug) window.__kakoi = { overlay, board, repo, store };

  const toolbar = new K.ToolbarView(
    { mode: $('modeSeg'), heat: $('heat'), skeleton: $('skeleton'), heatScope: $('heatScopeSeg'), heatScopeWrap: $('heatScopeWrap') },
    patch => store.set(patch),
  );
  const viewSeg = new K.Segmented($('viewSeg'), view => store.set({ view }));
  new K.ThemeToggle($('themeToggle'));

  const common = { repo, store, board, overlay };
  const modes = {
    castle: new K.CastleMode({
      ...common,
      els: {
        side: $('sideSeg'), chips: $('familyChips'), count: $('railCount'), cards: $('cards'),
        title: $('title'), titleWrap: $('ttl'), reading: $('reading'), setup: $('setup'), legend: $('legend'), hand: $('hand'),
        detailBody: $('detail'), detailTabs: $('detailTabs'),
      },
    }),
    tactic: new K.TacticMode({ ...common, els: { rail: $('tacticRail'), ptable: $('ptable'), stage: $('tacticStage'), detail: $('tacticDetail') } }),
    cluster: new K.ClusterMode({ ...common, els: { rail: $('clusterRail'), stage: $('clusterStage'), detail: $('clusterDetail') } }),
  };

  store.subscribe((state, changed, prev) => {
    if (changed.has('view')) {
      modes[prev.view].leave();
      document.body.dataset.view = state.view;
      modes[state.view].enter(state);
    } else {
      modes[state.view].update(state, changed);
    }
    viewSeg.setValue(state.view);
    toolbar.render(state);
  });

  document.body.dataset.view = store.state.view;
  modes[store.state.view].enter(store.state);
  viewSeg.setValue(store.state.view);
  toolbar.render(store.state);
})();
