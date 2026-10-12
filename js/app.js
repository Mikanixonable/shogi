// アプリの組み立て: 状態とビューを結び、状態が変わったら必要な部分だけを描き直す
(() => {
  'use strict';
  const K = window.Kakoi;
  const $ = id => document.getElementById(id);

  const repo = new K.Repository({ CASTLES: K.CASTLES, SETUPS: K.SETUPS, SOURCES: K.SOURCES, CASTLE_FAMILIES: K.CASTLE_FAMILIES });

  // ?debug のときだけデータを検証して console に出す
  if (new URLSearchParams(location.search).has('debug')) {
    const report = K.validate.all({ CASTLES: K.CASTLES, SETUPS: K.SETUPS, SOURCES: K.SOURCES, CASTLE_FAMILIES: K.CASTLE_FAMILIES });
    for (const r of report.results) {
      if (r.errors.length || r.warnings.length) console.warn(`[${r.kind}:${r.id}]`, [...r.errors, ...r.warnings].join(' / '));
    }
    for (const w of report.warnings) console.warn(w);
  }

  const store = new K.Store(
    { castleId: repo.castles()[0].id, mode: 'dim', heat: false, skeleton: false, heatScope: 'core', attackId: null, lastBySide: {}, familyFilter: null },
    ['castleId', 'mode', 'heat', 'skeleton', 'heatScope', 'lastBySide', 'familyFilter'],
    'shogi-castle',
  );
  if (!repo.has(store.state.castleId)) store.state.castleId = repo.castles()[0].id;
  // 保存値の検証: 既知の囲いかつ side が一致するものだけ残す
  const savedLast = store.state.lastBySide;
  store.state.lastBySide = Object.fromEntries(
    Object.entries(savedLast && typeof savedLast === 'object' && !Array.isArray(savedLast) ? savedLast : {})
      .filter(([side, id]) => repo.has(id) && repo.byId(id).side === side),
  );

  // 系統の絞り込み: 保存値が未知の系統なら解除
  if (!repo.families().some(f => f.id === store.state.familyFilter)) store.state.familyFilter = null;

  // 左の一覧に出す囲い: 戦型内を系統順に並べ、絞り込みがあればその系統だけ
  const railList = (side, filter) => repo.ofSideByFamily(side).filter(c => !filter || c.family === filter);
  // 絞り込み後の一覧に選択中の囲いがなければ先頭を選ぶための差分
  const withinFilter = (side, filter, id) => {
    const list = railList(side, filter);
    const target = list.some(c => c.id === id) ? id : list[0].id;
    return { castleId: target, attackId: target === id ? store.state.attackId : null, lastBySide: { ...store.state.lastBySide, [side]: target } };
  };
  if (store.state.familyFilter) {
    const cur = repo.byId(store.state.castleId);
    if (!railList(cur.side, store.state.familyFilter).length) store.state.familyFilter = null;
    else Object.assign(store.state, withinFilter(cur.side, store.state.familyFilter, cur.id));
  }

  const selectCastle = id => {
    if (!repo.has(id)) return;
    const c = repo.byId(id);
    store.set({ castleId: id, attackId: null, lastBySide: { ...store.state.lastBySide, [c.side]: id } });
  };

  const toolbar = new K.ToolbarView(
    { mode: $('modeSeg'), heat: $('heat'), skeleton: $('skeleton'), heatScope: $('heatScopeSeg'), heatScopeWrap: $('heatScopeWrap') },
    patch => store.set(patch),
  );
  const rail = new K.RailView(
    { side: $('sideSeg'), chips: $('familyChips'), count: $('railCount'), cards: $('cards') },
    {
      onSelect: selectCastle,
      onSide: side => {
        // 新しい戦型に絞り込み中の系統がなければ解除
        const f = railList(side, store.state.familyFilter).length ? store.state.familyFilter : null;
        store.set({ familyFilter: f, ...withinFilter(side, f, store.state.lastBySide[side] || railList(side, null)[0].id) });
      },
      onFilter: f => {
        const cur = repo.byId(store.state.castleId);
        store.set({ familyFilter: f, ...withinFilter(cur.side, f, cur.id) });
      },
    },
  );
  const board = new K.BoardView({ board: $('board'), files: $('files'), ranks: $('ranks') });
  const overlay = new K.OverlayView($('board'));
  if (new URLSearchParams(location.search).has('debug')) window.__kakoi = { overlay };
  const stage = new K.StageView({ title: $('title'), titleWrap: $('ttl'), reading: $('reading'), setup: $('setup'), legend: $('legend'), hand: $('hand') });
  const detail = new K.DetailView({ body: $('detail'), tabs: $('detailTabs') }, {
    onHover: (squares, tone) => board.hover(squares, tone),
    onAttack: attackId => store.set({ attackId }),
  });

  function update(state, changed) {
    const castle = repo.byId(state.castleId);
    const attack = repo.attackOf(castle, state.attackId);
    const castleChanged = changed.has('castleId');

    if (castleChanged || ['heat', 'heatScope', 'attackId'].some(k => changed.has(k))) {
      const position = repo.positionOf(castle, state.attackId);
      const heat = state.heat ? K.attackMap(position, x => state.heatScope === 'all' || x.role === 'core') : null;
      board.render(position, { mode: state.mode, heat, animate: castleChanged && !changed.has('initial') });
      board.setLasting(attack ? attack.target : [], 'bad');
    } else if (changed.has('mode')) {
      board.setMode(state.mode);
    }

    if (castleChanged || changed.has('familyFilter')) {
      const sideAll = repo.ofSide(castle.side);
      rail.render(railList(castle.side, state.familyFilter), castle, c => repo.positionOf(c), {
        families: repo.families().map(f => ({ id: f.id, name: f.name, glyph: f.glyph, count: sideAll.filter(c => c.family === f.id).length })).filter(f => f.count),
        filter: state.familyFilter, total: sideAll.length,
      });
    }
    if (castleChanged || changed.has('skeleton')) {
      overlay.skeleton(state.skeleton ? repo.positionOf(castle) : null);
    }

    if (castleChanged) {
      stage.renderCastle(castle, repo.setupOf(castle));
      detail.render(castle, {
        attackId: state.attackId, sources: repo.sourcesOf(castle),
        family: repo.familyOf(castle), subtype: repo.subtypeOf(castle),
      });
    } else if (changed.has('attackId')) {
      detail.setAttack(state.attackId);
    }
    stage.renderLegend(state);
    toolbar.render(state);
  }

  store.subscribe(update);
  update(store.state, new Set(['initial', ...Object.keys(store.state)]));
})();
