// アプリの組み立て: 状態・共有の部品・画面ごとのモードを結び、状態の変化を有効なモードへ伝える
// 状態は制約リスト（constraints）＋選択（selected）が中核。旧形式（castleId/tacticId/matchup）の
// 保存値・ハッシュは起動時に制約へ変換する（計画書 §2）
(() => {
  'use strict';
  const K = window.Kakoi;
  const $ = id => document.getElementById(id);
  const VIEWS = ['board', 'cluster'];
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

  const DOCK_DEFAULT = { split: 0.5, top: { who: 'opp', tab: 'tactic' }, bottom: { who: 'me', tab: 'castle' } };

  const store = new K.Store(
    {
      view: 'board',
      constraints: [],                      // [{who:'me'|'opp', kind:'strategy'|'tactic'|'castle', id}] 並び順＝優先度
      selected: null,                       // 'me.castle' 形式（`{who}.{kind}`）
      dock: DOCK_DEFAULT,
      mode: 'dim', heat: false, skeleton: false, heatScope: 'core',
      attackId: null, clusterFamily: null, showThreat: true,
    },
    ['view', 'constraints', 'selected', 'dock', 'mode', 'heat', 'skeleton', 'heatScope', 'attackId', 'clusterFamily', 'showThreat'],
    'shogi-castle',
  );
  // URLハッシュを保存値に重ねる（正規化より先。貼られたURLが最優先）
  const hashPatch = K.hashLink.read(store.state);
  const hashView = hashPatch && hashPatch.view;   // ハッシュが view を指定済みなら移行で潰さない

  // ---- 旧形式の保存値（localStorage の shogi-castle:*）を制約へ変換する。
  // persist キーから外したので Store は読まない。ハッシュが制約を与えていないときだけ適用する
  const lg = k => {
    try {
      const v = localStorage.getItem(`shogi-castle:${k}`);
      return v == null ? undefined : JSON.parse(v);
    } catch { return undefined; }
  };
  const validId = (kind, id) =>
    kind === 'strategy' ? !!K.STRATEGIES[id]
      : kind === 'tactic' ? repo.hasTactic(id)
      : kind === 'castle' ? repo.has(id) : false;
  {
    const st = store.state;
    // 制約が空 かつ ハッシュが制約を指定していない（k= の空リストは「明示的に空」なので移行しない）
    const empty = (!Array.isArray(st.constraints) || !st.constraints.length)
      && !(hashPatch && hashPatch.constraints !== undefined);
    const view = lg('view');
    if (empty && view === 'castle') {
      const id = lg('castleId');
      if (validId('castle', id)) {
        st.constraints = [{ who: 'me', kind: 'castle', id }];
        st.selected = 'me.castle';
        if (hashView === undefined) st.view = 'board';
      }
    } else if (empty && view === 'tactic') {
      const id = lg('tacticId');
      if (validId('tactic', id)) {
        const list = [{ who: 'me', kind: 'tactic', id }];
        const c = lg('tacticCastleId');         // 旧戦法画面が保持していた囲い（あれば）
        if (validId('castle', c)) list.push({ who: 'me', kind: 'castle', id: c });
        st.constraints = list;
        st.selected = 'me.tactic';
        if (hashView === undefined) st.view = 'board';
      }
    } else if (empty && view === 'matchup') {
      const mu = lg('matchup');
      if (mu && typeof mu === 'object') {
        const LAYERS = K.constraints.KINDS;
        const sideOf = (s, who) => {
          s = s && typeof s === 'object' ? s : {};
          const pick = Array.isArray(s.pick) ? s.pick.filter(l => LAYERS.includes(l)) : [];
          const order = pick.length ? [...pick, ...LAYERS.filter(l => !pick.includes(l))] : LAYERS;
          return order.map(k => {
            const id = k === 'strategy' ? s.strategy : k === 'tactic' ? s.tacticId : s.castleId;
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
  }

  // ---- 保存値・ハッシュの正規化 ----
  {
    const st = store.state;
    if (!VIEWS.includes(st.view)) st.view = 'board';
    // 制約: 形と id の正当性を確かめ、(who,kind) の重複は末尾優先で整理する
    const valid = e => e && (e.who === 'me' || e.who === 'opp')
      && K.constraints.KINDS.includes(e.kind) && validId(e.kind, e.id);
    st.constraints = K.constraints.apply(
      (Array.isArray(st.constraints) ? st.constraints : []).filter(valid),
      { type: 'remove' },
    ).list;
    // dock: 形だけ整える（UI は U4 が作る）
    const dk = st.dock && typeof st.dock === 'object' ? st.dock : {};
    const pane = (p, fb) => {
      p = p && typeof p === 'object' ? p : {};
      return {
        who: p.who === 'me' || p.who === 'opp' ? p.who : fb.who,
        tab: ['strategy', 'tactic', 'castle'].includes(p.tab) ? p.tab : fb.tab,
      };
    };
    st.dock = {
      split: typeof dk.split === 'number' ? Math.min(.8, Math.max(.2, dk.split)) : DOCK_DEFAULT.split,
      top: pane(dk.top, DOCK_DEFAULT.top),
      bottom: pane(dk.bottom, DOCK_DEFAULT.bottom),
    };
    // selected: 'who.kind' 形式。相手側を指しているのに相手の制約が無いときは握り直す
    if (!/^(me|opp)\.(strategy|tactic|castle)$/.test(st.selected || '')) st.selected = null;
    if (st.selected && st.selected.startsWith('opp.') && !st.constraints.some(e => e.who === 'opp')) {
      st.selected = null;
    }
    if (st.selected == null) {
      const last = [...st.constraints].reverse().find(e => e.who === 'me') || st.constraints[st.constraints.length - 1];
      st.selected = last ? `${last.who}.${last.kind}` : 'me.castle';
    }
    st.showThreat = st.showThreat !== false;
    if (!repo.families().some(f => f.id === st.clusterFamily)) st.clusterFamily = null;
  }

  // 共有の部品: 盤と重ね表示は1組を使い回す
  const board = new K.BoardView({ board: $('board'), files: $('files'), ranks: $('ranks') });
  const overlay = new K.OverlayView($('board'));
  if (debug) window.__kakoi = { overlay, board, repo, store };

  const toolbar = new K.ToolbarView(
    { mode: $('modeSeg'), heat: $('heat'), skeleton: $('skeleton'), heatScope: $('heatScopeSeg'), heatScopeWrap: $('heatScopeWrap') },
    patch => store.set(patch),
  );
  const viewSeg = new K.Segmented($('viewSeg'), view => store.set({ view }));
  new K.ThemeToggle($('themeToggle'));
  new K.ToolsToggle($('toolsToggle'), $('tools'));

  const common = { repo, store, board, overlay };
  const modes = {
    board: new K.ConstraintMode({
      ...common,
      els: {
        bar: $('constraintBar'), stageH: $('stageH'),
        title: $('title'), titleWrap: $('ttl'), reading: $('reading'), setup: $('setup'),
        legend: $('legend'), hand: $('hand'),
        threatWrap: $('threatWrap'), threatSw: $('threatSw'), playBtn: $('playBtn'),
        ptable: $('ptable'), boardwrap: $('boardwrap'), rail: $('pickRail'),
        detail: $('detail'),
      },
    }),
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
  K.hashLink.sync(store);   // 状態の変化を location.hash へ映す

  document.body.dataset.view = store.state.view;
  modes[store.state.view].enter(store.state);
  viewSeg.setValue(store.state.view);
  toolbar.render(store.state);
})();
