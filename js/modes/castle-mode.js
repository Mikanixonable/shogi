// 囲いモード: 左の一覧・中央の見出しと凡例・右の解説と、共有の盤・重ね表示の囲い向け更新をまとめる
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';
  const K = window.Kakoi;

  class CastleMode {
    /**
     * @param {{ repo:Kakoi.Repository, store:Kakoi.Store, board:Kakoi.BoardView, overlay:Kakoi.OverlayView, els:object }} deps
     *   els: side, chips, count, cards, title, titleWrap, reading, setup, legend, hand, detailBody, detailTabs
     */
    constructor({ repo, store, board, overlay, els }) {
      this.repo = repo;
      this.store = store;
      this.board = board;
      this.overlay = overlay;
      this._sanitize();

      this.rail = new K.RailView(
        { side: els.side, chips: els.chips, count: els.count, cards: els.cards },
        {
          onSelect: id => this.selectCastle(id),
          onSide: side => {
            // 新しい戦型に絞り込み中の系統がなければ解除
            const s = this.store.state;
            const f = this.railList(side, s.familyFilter).length ? s.familyFilter : null;
            this.store.set({ familyFilter: f, ...this.withinFilter(side, f, s.lastBySide[side] || this.railList(side, null)[0].id) });
          },
          onFilter: f => {
            const cur = this.repo.byId(this.store.state.castleId);
            this.store.set({ familyFilter: f, ...this.withinFilter(cur.side, f, cur.id) });
          },
        },
      );
      this.stage = new K.StageView({ title: els.title, titleWrap: els.titleWrap, reading: els.reading, setup: els.setup, legend: els.legend, hand: els.hand });
      this.detail = new K.DetailView({ body: els.detailBody, tabs: els.detailTabs }, {
        onHover: (squares, tone) => this.board.hover(squares, tone),
        onAttack: attackId => this.store.set({ attackId }),
      });
    }

    /** 保存値の検証: 未知の囲い・系統、side が合わない lastBySide を取り除く */
    _sanitize() {
      const { repo, store } = this;
      const st = store.state;
      if (!repo.has(st.castleId)) st.castleId = repo.castles()[0].id;
      const saved = st.lastBySide;
      st.lastBySide = Object.fromEntries(
        Object.entries(saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {})
          .filter(([side, id]) => repo.has(id) && repo.byId(id).side === side),
      );
      if (!repo.families().some(f => f.id === st.familyFilter)) st.familyFilter = null;
      if (st.familyFilter) {
        const cur = repo.byId(st.castleId);
        if (!this.railList(cur.side, st.familyFilter).length) st.familyFilter = null;
        else Object.assign(st, this.withinFilter(cur.side, st.familyFilter, cur.id));
      }
    }

    /** 左の一覧に出す囲い: 戦型内を系統順に並べ、絞り込みがあればその系統だけ */
    railList(side, filter) {
      return this.repo.ofSideByFamily(side).filter(c => !filter || c.family === filter);
    }

    /** 絞り込み後の一覧に選択中の囲いがなければ先頭を選ぶための差分 */
    withinFilter(side, filter, id) {
      const st = this.store.state;
      const list = this.railList(side, filter);
      const target = list.some(c => c.id === id) ? id : list[0].id;
      return { castleId: target, attackId: target === id ? st.attackId : null, lastBySide: { ...st.lastBySide, [side]: target } };
    }

    selectCastle(id) {
      if (!this.repo.has(id)) return;
      const c = this.repo.byId(id);
      this.store.set({ castleId: id, attackId: null, lastBySide: { ...this.store.state.lastBySide, [c.side]: id } });
    }

    /** 入るたびに盤も含めて全部描き直す（アニメーションなし） */
    enter(state) {
      this.update(state, new Set(['initial', ...Object.keys(state)]));
    }

    /** 共有の盤に残した囲いの表示を片付ける */
    leave() {
      this.board.setLasting([], null);
      this.overlay.clear();
    }

    update(state, changed) {
      const { repo, board, overlay, rail, stage, detail } = this;
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
        rail.render(this.railList(castle.side, state.familyFilter), castle, c => repo.positionOf(c), {
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
    }
  }

  K.CastleMode = CastleMode;
})();
