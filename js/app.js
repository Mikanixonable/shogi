// アプリの組み立て: 状態・共有の部品・画面ごとのモードを結び、状態の変化を有効なモードへ伝える
// 対局図（board）は制約リスト（constraints）＋選択（selected）が中核。囲い（castle）・戦法（tactic）は
// 独立した閲覧状態（castleId/tacticId など）を持つ図鑑タブ。旧形式（matchup 等）の保存値は起動時に制約へ変換する
(() => {
  'use strict';
  const K = window.Kakoi;
  const $ = id => document.getElementById(id);
  const VIEWS = ['castle', 'tactic', 'board', 'cluster'];
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

  const DOCK_DEFAULT = { split: K.lookup.DOCK.SPLIT_DEFAULT, opp: { tab: 'tactic', open: true }, me: { tab: 'castle', open: true } };

  const store = new K.Store(
    {
      view: 'board',
      constraints: [],                      // [{who:'me'|'opp', kind:'strategy'|'tactic'|'castle', id}] 並び順＝優先度
      selected: null,                       // 'me.castle' 形式（`{who}.{kind}`）
      dock: DOCK_DEFAULT,
      mode: 'dim', heat: false, skeleton: false, heatScope: 'core',
      attackId: null, clusterFamily: null, showThreat: true,
      // 囲い・戦法タブの閲覧状態（制約リストとは独立。旧囲い図鑑と同じキー名なので保存値もそのまま引き継ぐ）
      castleId: repo.castles()[0].id, familyFilter: null, lastBySide: {},
      tacticId: repo.tactics()[0]?.id ?? null, tacticLastBySide: {}, tacticLastByFam: {},
    },
    ['view', 'constraints', 'selected', 'dock', 'mode', 'heat', 'skeleton', 'heatScope', 'attackId', 'clusterFamily', 'showThreat',
      'castleId', 'familyFilter', 'lastBySide', 'tacticId', 'tacticLastBySide', 'tacticLastByFam'],
    'shogi-castle',
  );
  // URLハッシュを保存値に重ねる（正規化より先。貼られたURLが最優先）
  const hashPatch = K.hashLink.read(store.state);
  const hashView = hashPatch && hashPatch.view;   // ハッシュが view を指定済みなら移行で潰さない

  // ---- 旧形式の保存値（localStorage の shogi-castle:*）のうち、対局図（matchup）だけを制約へ変換する。
  // 囲い・戦法の閲覧状態（castleId/familyFilter/tacticId/lastBySide 等）は persist キーに復帰したので、
  // Store が旧保存値をそのまま読み、各タブへそのまま復元される（view:'castle'/'tactic' も今は実ビュー）。
  // ハッシュが制約を与えているときは matchup も移行しない
  const lg = k => {
    try {
      const v = localStorage.getItem(`shogi-castle:${k}`);
      return v == null ? undefined : JSON.parse(v);
    } catch { return undefined; }
  };
  const validId = K.constraints.isValidId;
  {
    const st = store.state;
    // 制約が空 かつ ハッシュが制約を指定していない（k= の空リストは「明示的に空」なので移行しない）
    const empty = (!Array.isArray(st.constraints) || !st.constraints.length)
      && !(hashPatch && hashPatch.constraints !== undefined);
    const view = lg('view');
    if (empty && view === 'matchup') {
      const mu = lg('matchup');
      if (mu && typeof mu === 'object') {
        const sideOf = (s, who) => {
          s = s && typeof s === 'object' ? s : {};
          return K.constraints.orderFromPick(s.pick).map(k => {
            const id = s[K.constraints.FIELD[k]];
            return validId(k, id) ? { who, kind: k, id } : null;
          }).filter(Boolean);
        };
        const me = sideOf(mu.me, 'me');
        const opp = mu.show && mu.show.opp === false ? [] : sideOf(mu.opp, 'opp');
        const list = [...me, ...opp];
        if (list.length) {
          st.constraints = list;
          const lastMe = [...list].reverse().find(e => e.who === 'me') || list[list.length - 1];
          st.selected = `${lastMe.who}.${lastMe.kind}`;
        }
        if (mu.show && mu.show.threat === false) st.showThreat = false;
        if (hashView === undefined) st.view = 'board';
      }
    }
    // 囲い・戦法タブの閲覧状態: 旧保存値・ハッシュ由来の不正値をここで丸める
    // （各モードの _sanitize でも同じ確認をするが、ハッシュ書き換えより先に済ませる）
    if (!repo.has(st.castleId)) st.castleId = repo.castles()[0].id;
    if (!repo.hasTactic(st.tacticId)) st.tacticId = repo.tactics()[0]?.id ?? null;
  }

  // ---- 保存値・ハッシュの正規化 ----
  {
    const st = store.state;
    if (!VIEWS.includes(st.view)) st.view = 'board';
    // 制約: 形と id の正当性を確かめ、先頭から順に apply(set) し直す。
    // 重複の整理だけでなく連動による解決まで起動時に済ませる（計画書 L4。
    // 旧形式からの変換もこの同じ経路を通る）
    st.constraints = K.constraints.normalizeList(st.constraints);
    // dock: 上=相手・下=自分の固定2面（面ごとに tab と開閉）。旧 {top,bottom}.{who,tab} は tab だけ引き継ぐ
    const dk = st.dock && typeof st.dock === 'object' ? st.dock : {};
    const dkPane = (p, oldP, fb) => {
      p = p && typeof p === 'object' ? p : {};
      const tab = p.tab || (oldP && oldP.tab);
      return {
        tab: tab === 'tactic' || tab === 'castle' ? tab : fb.tab,
        open: p.open !== false,
      };
    };
    st.dock = {
      split: typeof dk.split === 'number'
        ? Math.min(K.lookup.DOCK.SPLIT_MAX, Math.max(K.lookup.DOCK.SPLIT_MIN, dk.split)) : DOCK_DEFAULT.split,
      opp: dkPane(dk.opp, dk.top, DOCK_DEFAULT.opp),
      me: dkPane(dk.me, dk.bottom, DOCK_DEFAULT.me),
    };
    // selected: 'who.kind' 形式。相手側を指しているのに相手の制約が無いときは握り直す
    st.selected = K.constraints.normalizeSelected(st.constraints, st.selected);
    st.showThreat = st.showThreat !== false;
    if (!repo.families().some(f => f.id === st.clusterFamily)) st.clusterFamily = null;
  }

  // 旧形式のハッシュで開いたときは、起動時に新形式へ書き換える（U9。
  // k= が無い＝旧形式。replaceState なので履歴と hashchange は汚さない）
  {
    const h = location.hash.replace(/^#/, '');
    if (h && !new URLSearchParams(h).has('k')) {
      history.replaceState(null, '', '#' + K.hashLink.buildQuery(store.state));
    }
  }

  // 共有の部品: 盤と重ね表示は1組を使い回す
  const board = new K.BoardView({ board: $('board'), files: $('files'), ranks: $('ranks') });
  const overlay = new K.OverlayView($('board'));
  if (debug) window.__kakoi = { overlay, board, repo, store };

  const toolbar = new K.ToolbarView(
    { mode: $('modeSeg'), heat: $('heat'), skeleton: $('skeleton'), heatScope: $('heatScopeSeg'), heatScopeWrap: $('heatScopeWrap'), reset: $('resetSettings') },
    patch => store.set(patch),
    // リセット: URL引数（クエリ・ハッシュ）と保存済みの状態を捨て、初期状態で読み込み直す
    () => { store.clearPersisted(); location.replace(location.pathname); },
  );
  const viewSeg = new K.Segmented($('viewSeg'), view => store.set({ view }));
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

  const common = { repo, store, board, overlay };
  const modes = {
    board: new K.ConstraintMode({
      ...common,
      els: {
        stage: $('stageMain'), bandOpp: $('bandOpp'), bandMe: $('bandMe'),
        barOpp: $('cbarOpp'), barMe: $('cbarMe'),
        nameOpp: $('nameOpp'), subOpp: $('subOpp'), nameMe: $('nameMe'), subMe: $('subMe'),
        legend: $('legend'), handOpp: $('handOpp'), handMe: $('handMe'),
        playBtn: $('playBtn'),
        addOpp: $('addOpp'),
        clearOpp: $('clearOpp'), clearMe: $('clearMe'), clearAll: $('clearAll'),
        boardwrap: $('boardwrap'), rail: $('pickRail'),
        detail: $('detail'),
      },
    }),
    castle: new K.CastleMode({
      ...common,
      els: {
        side: $('castleSideSeg'), chips: $('familyChips'), count: $('railCount'), cards: $('cards'),
        title: $('castleTitle'), titleWrap: $('castleTtl'), reading: $('castleReading'), setup: $('castleSetup'),
        legend: $('castleLegend'), hand: $('castleHand'), detailBody: $('castleDetail'),
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
  K.hashLink.attach(store); // 状態の変化を location.hash へ映し、アドレスバーの編集も受け取る（U9）
  new K.UndoHistory(store); // 元に戻す履歴（U2: Ctrl/⌘+Z、Shift+⌘+Z。最大50件）

  document.body.dataset.view = store.state.view;
  modes[store.state.view].enter(store.state);
  viewSeg.setValue(store.state.view);
  toolbar.render(store.state);
})();
