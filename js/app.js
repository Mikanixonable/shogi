// アプリの組み立て: 状態・共有の部品・画面（対局図 ＋ 手筋と格言の全画面モード）を結び、状態の変化を画面へ伝える。
// 盤面の状態（slots=各側の戦法・囲い、showOpp=相手の表示、selected=選択中の層）と画面モード
// （view・tesujiId=手筋モードで開いている章・節）は URL ハッシュだけが正（hash-link.js）。
// 表示の好み（駒の表示・利き・脅威の帯・左レールの層）は localStorage に持つ。
// 起動時は ハッシュ → 好み の順に重ね、不正な値は初期値へ丸める
(() => {
  'use strict';
  const K = window.Kakoi;
  const $ = id => document.getElementById(id);
  const debug = new URLSearchParams(location.search).has('debug');

  const DATA = {
    CASTLES: K.CASTLES, SETUPS: K.SETUPS, SOURCES: K.SOURCES, CASTLE_FAMILIES: K.CASTLE_FAMILIES,
    TACTICS: K.TACTICS, TACTIC_FAMILIES: K.TACTIC_FAMILIES,
    SENKEI: K.SENKEI, SENKEI_RESOLVE: K.SENKEI_RESOLVE, SENKEI_GROUPS: K.SENKEI_GROUPS,
    TESUJI: K.TESUJI, PROVERBS: K.PROVERBS, COMBOS: K.COMBOS, FUN: K.FUN,
    STRATEGIES: K.STRATEGIES,
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
      view: 'board',                        // 'board'（対局図）| 'tesuji'（手筋と格言の全画面モード）
      tesujiId: null,                       // 手筋モードで開いている章・節の id（ハッシュの tj=）
      attackId: null,
      mode: 'dim', heat: false, showThreat: true,
      dockTab: 'castle',                    // 左レールで最後に見ていた層（ハッシュに選択が無いときの既定）
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
    if (st.view !== 'tesuji') st.view = 'board';
    Object.assign(st, K.hashLink.read(st.dockTab));
  }

  // 共有の部品: 盤と重ね表示は1組を使う
  const board = new K.BoardView({ board: $('board'), files: $('files'), ranks: $('ranks') });
  const overlay = new K.OverlayView($('board'));
  if (debug) window.__kakoi = { overlay, board, repo, store };

  // 狭い画面: 左（選ぶ）・右（読む）の面を下端タブ＋横スワイプで切り替える
  const mobileTabs = new K.MobileTabs(document.querySelector('.mtabs'), {
    rail: document.querySelector('.rail'),
    detail: document.querySelector('.detail'),
    stage: $('stageMain'),
  });

  // 図鑑: 盤面と排他の全画面モード（ヘッダーのボタン・右 detail の「図と格言を見る」から開く）。
  // 目次からの遷移・モードの出入りは store 経由でハッシュに積む（「戻る」で戻れる）
  const tesujiMode = new K.TesujiMode($('tesujiView'), repo, {
    onGo: id => store.set({ view: 'tesuji', tesujiId: id }),
    onExit: () => store.set({ view: 'board', tesujiId: null }),
    // 図鑑の項に置いた右 detail 部品の動き: 制約を立てる系は盤面へ戻して適用する
    onSet: (w, k, id) => { mode._set(w, k, id); store.set({ view: 'board' }); },
    onCombo: (w, id, vs) => { mode._combo(w, id, vs); store.set({ view: 'board' }); },
    onAttack: id => store.set({ view: 'board', attackId: id, defense: null }),
    onDefense: id => store.set({ view: 'board', defense: id }),
  });
  // ヘッダーのモード切替は1つのトグル（盤面 ⇄ 図鑑。押すともう片方へ）
  const viewTabs = $('viewTabs');
  viewTabs.addEventListener('click', () =>
    store.set({ view: store.state.view === 'tesuji' ? 'board' : 'tesuji' }));
  const mode = new K.ScreenController({
    repo, store, board, overlay, mobileTabs,
    openTesuji: id => store.set({ view: 'tesuji', tesujiId: id }),
    els: {
      stage: $('stageMain'), field: $('cfield'),
      handOpp: $('handOpp'), handMe: $('handMe'),
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
  // 右 detail のドロワー開閉（中くらいの幅では右端から開く。§4-6）
  {
    const t = $('detailToggle');
    const sync = () => t.setAttribute('aria-expanded', String(document.body.dataset.drawer === 'open'));
    t.addEventListener('click', () => {
      document.body.dataset.drawer = document.body.dataset.drawer === 'open' ? '' : 'open';
      sync();
    });
    new MutationObserver(sync).observe(document.body, { attributes: true, attributeFilter: ['data-drawer'] });
    sync();
  }
  // 盤の収納/展開（モバイル。手動の帯＋面のほうへ流れたときの自動畳み）は MobileTabs._bindFold が持つ

  // 画面モードの反映: body.tj で対局図と手筋モードを切り替える（CSS が面を出し分ける）
  const syncView = (state, instant) => {
    const on = state.view === 'tesuji';
    document.body.classList.toggle('tj', on);
    viewTabs.setAttribute('aria-checked', String(on));
    viewTabs.setAttribute('aria-label', on ? '盤面に戻る' : '図鑑を開く');
    if (on) tesujiMode.open(state.tesujiId, instant);
    else window.scrollTo(0, 0);
  };
  store.subscribe((state, changed) => {
    mode.update(state, changed);
    toolbar.render(state);
    if (changed.has('view') || changed.has('tesujiId')) syncView(state);
  });
  K.hashLink.attach(store); // 盤面の状態の変化を location.hash へ映し、「戻る」・アドレスバーの編集も受け取る

  mode.enter(store.state);
  toolbar.render(store.state);
  syncView(store.state, true);   // #tj= で開いたときはアニメ無しでその章・節へ
})();
