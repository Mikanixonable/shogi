// 戦法モード: 周期表（盤と筋をそろえる）・左の一覧・中央の見出しと再生・右の解説と、共有の盤の戦法向け更新をまとめる
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';
  const K = window.Kakoi;
  const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  class TacticMode {
    /**
     * @param {{ repo:Kakoi.Repository, store:Kakoi.Store, board:Kakoi.BoardView, overlay:Kakoi.OverlayView,
     *   els:{ rail:HTMLElement, stage:HTMLElement, detail:HTMLElement, ptable:HTMLElement } }} deps
     */
    constructor({ repo, store, board, overlay, els }) {
      Object.assign(this, { repo, store, board, overlay, els });
      this.rows = K.tacticNav.tacticRows(repo.tacticFamilies(), repo.tactics());
      const select = id => this.selectTactic(id);
      this.table = new K.TacticTableView(els.ptable, { onSelect: select });
      this.rail = new K.TacticRailView(els.rail, { onSelect: select });
      this.stage = new K.TacticStageView(els.stage, { onPlay: () => this._onPlay() });
      this.detail = new K.TacticDetailView(els.detail, {
        onHover: (squares, tone) => this.board.hover(squares, tone),
        onCastle: id => this._openCastle(id),
        onToggle: id => this._toggleCastle(id),
      });
      this.player = new K.TacticPlayer({
        onStep: t => this._autoSelect(t.id),
        onChange: playing => this.stage.setPlaying(playing, reducedMotion()),
      });
      this._auto = false;
      document.addEventListener('keydown', e => this._onKey(e));
    }

    /** 利用者の操作による選択（再生は止める） */
    selectTactic(id) {
      if (!this.repo.hasTactic(id)) return;
      this.player.stop();
      this.store.set({ tacticId: id });
    }

    _autoSelect(id) {
      this._auto = true;
      try { this.store.set({ tacticId: id }); } finally { this._auto = false; }
    }

    _current() {
      return this.repo.tacticById(this.store.state.tacticId) || this.repo.tactics()[0];
    }

    _rowOf(tactic) {
      return this.rows.find(r => r.tactics.includes(tactic));
    }

    // 再生: 動きを抑える設定のときは自動で進めず、押すたびに次の戦法へ
    _onPlay() {
      const row = this._rowOf(this._current());
      if (reducedMotion()) {
        const list = row.tactics, i = list.indexOf(this._current());
        this.selectTactic(list[(i + 1) % list.length].id);
      } else if (this.player.playing) this.player.stop();
      else this.player.start(row.tactics);
    }

    // 矢印キー: ←→ 同じ行で前後、↑↓ 隣の行
    _onKey(e) {
      if (document.body.dataset.view !== 'tactic') return;
      if (e.metaKey || e.ctrlKey || e.altKey || /input|textarea/i.test(e.target.tagName)) return;
      if (!e.key.startsWith('Arrow')) return;
      e.preventDefault();
      const next = K.tacticNav.neighbor(this.rows, this._current(), e.key);
      if (next) this.selectTactic(next.id);
    }

    /** 囲いを盤に重ねる／外す */
    _toggleCastle(id) {
      if (!this.repo.has(id)) return;
      const s = this.store.state;
      this.store.set({ tacticCastleId: s.tacticCastleId === id ? null : id });
    }

    /** 相性のよい囲いへ移る。戦型の違う囲いは、系統の絞り込みが合わなければ解除して選ぶ */
    _openCastle(id) {
      const castle = this.repo.byId(id);
      if (!castle) return;
      const s = this.store.state;
      this.store.set({
        view: 'castle', castleId: id, attackId: null,
        familyFilter: s.familyFilter === castle.family ? s.familyFilter : null,
        lastBySide: { ...s.lastBySide, [castle.side]: id },
      });
    }

    /** 入るたびに全部描き直す（盤の駒は滑らせない） */
    enter(state) {
      this.update(state, new Set(['initial', ...Object.keys(state)]));
    }

    /** 共有の盤に残した戦法の表示を片付ける */
    leave() {
      this.player.stop();
      this.board.setLasting([], null);
      this.overlay.clear();
    }

    update(state, changed) {
      const { repo, board, overlay } = this;
      const tactic = this._current();
      if (!tactic) return;
      // 戦法が変わったら重ねていた囲いは外す（古い組み合わせを持ち越さない）。
      // tacticCastleId の変更でもう一度 update が来るので、描き直しはそちらに任せる
      if (changed.has('tacticId') && !changed.has('initial') && state.tacticCastleId) {
        this.store.set({ tacticCastleId: null });
        return;
      }
      const castle = state.tacticCastleId && repo.has(state.tacticCastleId) ? repo.byId(state.tacticCastleId) : null;
      const hard = changed.has('initial') || changed.has('tacticId') || changed.has('tacticCastleId');
      if (hard || changed.has('heat') || changed.has('heatScope')) {
        if (changed.has('tacticId') && !this._auto && !changed.has('initial')) this.player.stop();
        if (hard) {
          const family = repo.tacticFamilies().find(f => f.id === tactic.family);
          if (changed.has('initial')) {
            this.table.render(this.rows, tactic.id);
            this.rail.render(this.rows, tactic.id);
            this.stage.setPlaying(false, reducedMotion());
          } else {
            this.table.select(tactic.id);
            this.rail.select(tactic.id);
          }
          this.stage.render(tactic, family, castle);
          this.detail.render(tactic, {
            family,
            castles: repo.castlesOfTactic(tactic).map(c => ({ id: c.id, name: c.name, familyName: repo.familyOf(c).name, desc: c.desc })),
            castleId: castle && castle.id,
            sources: repo.tacticComboSourcesOf(tactic, castle),
          });
        }
        const position = castle
          ? K.combinePosition(repo.tacticPositionOf(tactic), repo.positionOf(castle))
          : repo.tacticPositionOf(tactic);
        const heat = castle && state.heat
          ? K.attackMap(position, x => state.heatScope === 'all' || x.role === 'core')
          : null;
        board.setLasting([], null);
        board.render(position, {
          mode: state.mode, heat, animate: hard && !changed.has('initial'),
          trace: { square: tactic.lead.square, piece: tactic.lead.piece, path: tactic.route },
        });
        this.stage.setHand(position.hand);
        overlay.skeleton(castle ? repo.positionOf(castle) : null);
        overlay.route(tactic.route);
      } else if (changed.has('mode')) {
        board.setMode(state.mode);
      }
    }
  }

  K.TacticMode = TacticMode;
})();
