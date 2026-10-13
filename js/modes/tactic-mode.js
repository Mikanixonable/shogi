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
      this._sanitize();
      this.rows = K.tacticNav.tacticRows(repo.tacticFamilies(), repo.tactics());
      const select = id => this.selectTactic(id);
      this.table = new K.TacticTableView(els.ptable, { onSelect: select, onFamily: famId => this._onFamily(famId) });
      this.rail = new K.TacticRailView(els.rail, { onSelect: select, onSide: side => this._onSide(side) });
      this.stage = new K.TacticStageView(els.stage, { onPlay: () => this._onPlay() });
      this.detail = new K.TacticDetailView(els.detail, {
        onHover: (squares, tone) => this.board.hover(squares, tone),
        onCastle: id => this._openCastle(id),
        onMatchup: id => this._openMatchup(id),
      });
      this.player = new K.TacticPlayer({
        onStep: t => this._autoSelect(t.id),
        onChange: playing => this.stage.setPlaying(playing, reducedMotion()),
      });
      this._auto = false;
      document.addEventListener('keydown', e => this._onKey(e));
    }

    /** 保存値の検証: tacticLastBySide / tacticLastByFam の未知の戦法・属する側が合わないものを取り除く */
    _sanitize() {
      const st = this.store.state;
      const saved = st.tacticLastBySide;
      st.tacticLastBySide = Object.fromEntries(
        Object.entries(saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {})
          .filter(([side, id]) => this.repo.hasTactic(id) && this._sideOf(this.repo.tacticById(id)) === side),
      );
      const savedF = st.tacticLastByFam;
      st.tacticLastByFam = Object.fromEntries(
        Object.entries(savedF && typeof savedF === 'object' && !Array.isArray(savedF) ? savedF : {})
          .filter(([fam, id]) => this.repo.hasTactic(id) && this.repo.tacticById(id).family === fam),
      );
    }

    /** 戦法が属する戦型（系統の side） */
    _sideOf(tactic) {
      const fam = this.repo.tacticFamilies().find(f => f.id === tactic.family);
      return fam ? fam.side : null;
    }

    /** 利用者の操作による選択（再生は止める）。最後に見た戦法を戦型・系統ごとに覚える */
    selectTactic(id) {
      if (!this.repo.hasTactic(id)) return;
      this.player.stop();
      this.store.set({ tacticId: id, ...this._remember(this.repo.tacticById(id)) });
    }

    _remember(tactic) {
      const s = this.store.state;
      const side = this._sideOf(tactic);
      return {
        tacticLastBySide: { ...s.tacticLastBySide, [side]: tactic.id },
        tacticLastByFam: { ...s.tacticLastByFam, [tactic.family]: tactic.id },
      };
    }

    // 居飛車／振り飛車のタブ: 囲いの一覧と同じく、その戦型で最後に見ていた戦法へ移る。
    // 未訪なら飛車系統の先頭へ（周期表の既定も飛車）
    _onSide(side) {
      const s = this.store.state;
      const saved = s.tacticLastBySide && s.tacticLastBySide[side];
      if (saved && this.repo.hasTactic(saved)) { this.selectTactic(saved); return; }
      const rookFam = this.repo.tacticFamilies().find(f => f.side === side && f.piece === '飛');
      if (rookFam) { this._onFamily(rookFam.id); return; }
      const t = this.repo.tactics().find(x => this._sideOf(x) === side);
      if (t) this.selectTactic(t.id);
    }

    // 周期表の系統ピッカー: その系統で最後に見た戦法、なければ代表の先頭へ
    _onFamily(famId) {
      const s = this.store.state;
      const saved = s.tacticLastByFam && s.tacticLastByFam[famId];
      const row = this.rows.find(r => r.family.id === famId);
      const t = saved && this.repo.hasTactic(saved) && this.repo.tacticById(saved).family === famId
        ? this.repo.tacticById(saved)
        : row && (row.tactics.find(x => !x.variantOf) || row.tactics[0]);
      if (t) this.selectTactic(t.id);
    }

    _autoSelect(id) {
      this._auto = true;
      try { this.store.set({ tacticId: id, ...this._remember(this.repo.tacticById(id)) }); }
      finally { this._auto = false; }
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

    /** 「対局図で開く」: この戦法と選んだ囲いを自分側の制約にして対局図へ移る（計画書 §3 の導線。
        strategy → tactic → castle の順に apply し、連動解決は apply に任せる） */
    _openMatchup(castleId) {
      if (!this.repo.has(castleId)) return;
      const tactic = this._current();
      const fam = this.repo.tacticFamilies().find(f => f.id === tactic.family);
      const s = this.store.state;
      let list = s.constraints || [];
      for (const [kind, id] of [['strategy', fam ? fam.side : 'ibisha'], ['tactic', tactic.id], ['castle', castleId]]) {
        list = K.constraints.apply(list, { type: 'set', who: 'me', kind, id }).list;
      }
      this.store.set({ view: 'board', constraints: list, selected: 'me.tactic', attackId: null });
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
      const hard = changed.has('initial') || changed.has('tacticId');
      if (hard || changed.has('heat') || changed.has('heatScope')) {
        if (changed.has('tacticId') && !this._auto && !changed.has('initial')) this.player.stop();
        const family = repo.tacticFamilies().find(f => f.id === tactic.family);
        const side = this._sideOf(tactic);
        // 周期表は選択中の戦法の系統だけを置く（系統が替わったら作り直す。戦型の切替も系統の切替を伴う）
        if (changed.has('initial')) {
          this._tableFam = tactic.family;
          this.table.render(this.rows, tactic.id, tactic.family);
          this.rail.render(this.rows, tactic.id, side);
          this.stage.setPlaying(false, reducedMotion());
        } else {
          // 一覧は側が替わったときだけ作り直す（rail.select 内で判定。同じ側ではスクロールを保つ）
          if (tactic.family !== this._tableFam) {
            this._tableFam = tactic.family;
            this.table.render(this.rows, tactic.id, tactic.family);
          } else this.table.select(tactic.id);
          this.rail.select(tactic.id, side);
        }
        this.stage.render(tactic, family);
        this.detail.render(tactic, {
          family,
          castles: repo.pairingsOf(tactic).filter(p => p.level !== 'ng')
            .map(p => ({ id: p.castle.id, name: p.castle.name, familyName: repo.familyOf(p.castle).name, level: p.level, why: p.why })),
          sources: repo.tacticComboSourcesOf(tactic, null),
        });
        const position = repo.tacticPositionOf(tactic);
        // 「囲いの駒」に相当するのは戦法では必須の駒＋主役。利きはその駒だけ、または全ての駒で数える
        const ess = new Set(K.notation.parsePieces(tactic.essential || '').map(x => `${x.f}${x.r}`));
        const heat = state.heat
          ? K.attackMap(position, x => state.heatScope === 'all' || x.role === 'lead' || ess.has(`${x.f}${x.r}`))
          : null;
        board.setLasting([], null);
        board.render(position, {
          mode: state.mode, heat, animate: hard && !changed.has('initial'),
          trace: { square: tactic.lead.square, piece: tactic.lead.piece, path: tactic.route },
        });
        this.stage.setHand(position.hand);
        overlay.skeleton(null);
        // 飛車が主役の戦法では矢印を引かない（銀など、歩みのある主役の筋道だけを示す）
        overlay.route(tactic.lead && tactic.lead.piece === '飛' ? null : tactic.route);
      } else if (changed.has('mode')) {
        board.setMode(state.mode);
      }
    }
  }

  K.TacticMode = TacticMode;
})();
