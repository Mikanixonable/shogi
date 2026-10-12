// アプリの組み立て: 状態とビューを結び、状態が変わったら必要な部分だけを描き直す
(() => {
  'use strict';
  const K = window.Kakoi;
  const $ = id => document.getElementById(id);

  const byId = new Map(K.CASTLES.map(c => [c.id, c]));
  const castlesOf = side => K.CASTLES.filter(c => c.side === side);

  // ?debug のときだけデータを検証して console に出す
  if (new URLSearchParams(location.search).has('debug')) {
    const report = K.validate.all({ CASTLES: K.CASTLES, SETUPS: K.SETUPS, SOURCES: K.SOURCES });
    for (const r of report.results) {
      if (r.errors.length || r.warnings.length) console.warn(`[${r.kind}:${r.id}]`, [...r.errors, ...r.warnings].join(' / '));
    }
    for (const w of report.warnings) console.warn(w);
  }

  const store = new K.Store(
    { castleId: K.CASTLES[0].id, mode: 'dim', heat: false, heatScope: 'core', attackId: null, lastBySide: {} },
    ['castleId', 'mode', 'heat', 'heatScope', 'lastBySide'],
    'shogi-castle',
  );
  if (!byId.has(store.state.castleId)) store.state.castleId = K.CASTLES[0].id;
  // 保存値の検証: 既知の城かつ side が一致するものだけ残す
  const savedLast = store.state.lastBySide;
  store.state.lastBySide = Object.fromEntries(
    Object.entries(savedLast && typeof savedLast === 'object' && !Array.isArray(savedLast) ? savedLast : {})
      .filter(([side, id]) => byId.has(id) && byId.get(id).side === side),
  );

  const selectCastle = id => {
    if (!byId.has(id)) return;
    const c = byId.get(id);
    store.set({ castleId: id, attackId: null, lastBySide: { ...store.state.lastBySide, [c.side]: id } });
  };

  const toolbar = new K.ToolbarView(
    { mode: $('modeSeg'), heat: $('heat'), heatScope: $('heatScopeSeg'), heatScopeWrap: $('heatScopeWrap') },
    patch => store.set(patch),
  );
  const rail = new K.RailView(
    { side: $('sideSeg'), count: $('railCount'), cards: $('cards') },
    {
      onSelect: selectCastle,
      onSide: side => selectCastle(store.state.lastBySide[side] || castlesOf(side)[0].id),
    },
  );
  const board = new K.BoardView({ board: $('board'), files: $('files'), ranks: $('ranks') });
  const stage = new K.StageView({ title: $('title'), titleWrap: $('ttl'), reading: $('reading'), setup: $('setup'), legend: $('legend'), hand: $('hand') });
  const detail = new K.DetailView({ body: $('detail'), tabs: $('detailTabs') }, {
    onHover: (squares, tone) => board.hover(squares, tone),
    onAttack: attackId => store.set({ attackId }),
  });

  function update(state, changed) {
    const castle = byId.get(state.castleId);
    const attack = castle.attacks?.find(a => a.id === state.attackId) || null;
    const castleChanged = changed.has('castleId');

    if (castleChanged || ['heat', 'heatScope', 'attackId'].some(k => changed.has(k))) {
      const position = K.Position.fromCastle(castle, attack);
      const heat = state.heat ? K.attackMap(position, x => state.heatScope === 'all' || x.role === 'core') : null;
      board.render(position, { mode: state.mode, heat, animate: castleChanged && !changed.has('initial') });
      board.setLasting(attack ? attack.target : [], 'bad');
    } else if (changed.has('mode')) {
      board.setMode(state.mode);
    }

    if (castleChanged) {
      rail.render(castlesOf(castle.side), castle);
      stage.renderCastle(castle);
      detail.render(castle, state);
    } else if (changed.has('attackId')) {
      detail.setAttack(state.attackId);
    }
    stage.renderLegend(state);
    toolbar.render(state);
  }

  store.subscribe(update);
  update(store.state, new Set(['initial', ...Object.keys(store.state)]));
})();
