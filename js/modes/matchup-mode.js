// 対局図モード: 自分と相手の戦略・戦法・囲いの3層を選び、両軍の駒組みを一つの盤に重ねる。
// ×を選んだときの自動差し替えは compat.resolve、盤の合成は compose.position/merge、
// 戦型・脅威の筋は matchup.threat に任せる（計画書 §4〜§6）
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';
  const K = window.Kakoi;
  const LAYER_JA = { strategy: '戦略', tactic: '戦法', castle: '囲い' };
  const FIELD = { strategy: 'strategy', tactic: 'tacticId', castle: 'castleId' };
  const mirrorSq = s => `${10 - +s[0]}${10 - +s[1]}`; // 相手の経路は先手視点のデータを回転して描く

  class MatchupMode {
    /**
     * @param {{ repo:Kakoi.Repository, store:Kakoi.Store, board:Kakoi.BoardView, overlay:Kakoi.OverlayView,
     *   els:{ rail:HTMLElement, stage:HTMLElement, detail:HTMLElement } }} deps
     */
    constructor({ repo, store, board, overlay, els }) {
      Object.assign(this, { repo, store, board, overlay, els });
      const st = els.stage;
      this.stageEls = {
        ttl: st.querySelector('.ttl'), title: st.querySelector('h2'),
        context: st.querySelector('.setup'), legend: st.querySelector('.legend'), hand: st.querySelector('.hand'),
      };
      this.rail = new K.MatchupRailView(els.rail, {
        onChoose: (side, layer, id) => this.choose(side, layer, id),
        onShow: (key, on) => this._toggleShow(key, on),
        onHover: (squares, tone) => this.board.hover(squares, tone),
      });
      this.detail = new K.MatchupDetailView(els.detail, {
        onHover: (squares, tone) => this.board.hover(squares, tone),
        onUndo: () => this._undoAuto(),
      });
    }

    // 未選択の層は戦略テンプレートの既定値で読み替える（compat.js と同じ規則）
    _tacticOf(st) {
      const id = (st && st.tacticId) || (st && K.STRATEGIES[st.strategy] ? K.STRATEGIES[st.strategy].defaultTactic : null);
      return id ? this.repo.tacticById(id) : null;
    }
    _castleOf(st, opp) {
      if (st && st.castleId) return this.repo.byId(st.castleId);
      const dc = st && K.STRATEGIES[st.strategy] ? K.STRATEGIES[st.strategy].defaultCastle : null;
      const id = typeof dc === 'string' ? dc : dc ? ((opp && opp.strategy === 'furibisha') ? dc.vsFuribisha : dc.vsIbisha) : null;
      return id ? this.repo.byId(id) : null;
    }
    _nameOf(layer, id) {
      if (id == null) return '（未選択）';
      if (layer === 'strategy') return (K.STRATEGIES[id] && K.STRATEGIES[id].label) || id;
      const x = layer === 'tactic' ? this.repo.tacticById(id) : this.repo.byId(id);
      return x ? x.name : id;
    }

    /**
     * 層を選ぶ: 最後に選んだ層を優先し、両立しない他の層は compat.resolve が差し替える。
     * 差し替えはトーストで知らせるほか、右パネルの先頭に記録として残し、どちらからも「元に戻す」で戻せる（計画書 §4-2）
     */
    choose(side, layer, id) {
      const s = this.store.state;
      const prev = s.matchup;
      if (prev[side][FIELD[layer]] === id) return;
      const other = side === 'me' ? prev.opp : prev.me;
      const r = K.compat.resolve(prev[side], layer, id, other);
      if (r.changed.length) {
        const msg = r.changed.map(c => c.unresolved
          ? `${LAYER_JA[c.layer]}は両立する候補がなく「${this._nameOf(c.layer, c.from)}」のまま`
          : `${LAYER_JA[c.layer]}を「${this._nameOf(c.layer, c.from)}」から「${this._nameOf(c.layer, c.to)}」へ`).join('、');
        this._autoNote = { side, changed: r.changed, prevPick: prev[side].pick, msg: `${msg}変更しました` };
      }
      this.store.set({ matchup: { ...prev, [side]: r.next } });
      if (this._autoNote && K.Toast) {
        K.Toast.show(this._autoNote.msg, {
          action: { label: '元に戻す', fn: () => this._undoAuto() },
        });
      }
    }

    // 戻すのは自動差し替えだけ（直前の matchup 全体ではなく、差し替わった層の値と pick 順を復元する）
    _undoAuto() {
      const n = this._autoNote;
      if (!n) return;
      const cur = this.store.state.matchup;
      const side2 = { ...cur[n.side], pick: n.prevPick };
      for (const c of n.changed) if (!c.unresolved) side2[FIELD[c.layer]] = c.from;
      this._autoNote = null;
      this.store.set({ matchup: { ...cur, [n.side]: side2 } });
    }

    _toggleShow(key, on) {
      const m = this.store.state.matchup;
      this.store.set({ matchup: { ...m, show: { ...m.show, [key]: on } } });
    }

    enter(state) { this.update(state, new Set(['initial', ...Object.keys(state)])); }

    /** 共有の盤と重ね表示を片付ける */
    leave() {
      const ov = this.overlay;
      this.board.setLasting([], null);
      ov.clear();
      if (ov.routes) ov.routes(null);
      if (ov.threat) ov.threat(null);
      if (ov.contacts) ov.contacts(null);
      if (K.Toast) K.Toast.hide();
      this._autoNote = null;
    }

    update(state, changed) {
      const m = state.matchup;
      if (!m) return;
      const hard = changed.has('initial') || changed.has('matchup');
      let d = null;
      const compute = () => d || (d = this._compute(m));
      if (hard || changed.has('heat') || changed.has('heatScope')) {
        d = compute();
        const heat = state.heat
          ? K.attackMap(d.merged.position, x => state.heatScope === 'all' || x.role === 'core')
          : null;
        this.board.setLasting(d.merged.contacts.filter(c => c.kind === 'ng').map(c => c.sq), 'bad');
        this.board.render(d.merged.position, {
          mode: state.mode, heat,
          animate: changed.has('matchup') && !changed.has('initial'),
        });
        this._overlays(state, m, d);
        if (hard) {
          // 自動差し替えの記録は、差し替わった値が現在の選択から外れた時点で消す
          if (this._autoNote) {
            const sideNow = m[this._autoNote.side];
            if (this._autoNote.changed.some(c => !c.unresolved && sideNow[FIELD[c.layer]] !== c.to)) this._autoNote = null;
          }
          this._paintStage(m, d);
          this.rail.update(state);
          this.detail.render(this._detailData(m, d));
        }
      } else if (changed.has('mode')) {
        this.board.setMode(state.mode);
      }
      if (changed.has('skeleton')) this._skeleton(state, m, compute());
    }

    // 両軍の駒組みを合成して一つの盤にする。相手を隠すときは自分だけ（戦型・接触は計算しない）
    _compute(m) {
      const mePos = K.compose.position({
        strategy: m.me.strategy, tacticId: m.me.tacticId, castleId: m.me.castleId, side: 'sente',
      });
      const oppPos = m.show.opp ? K.compose.position({
        strategy: m.opp.strategy, tacticId: m.opp.tacticId, castleId: m.opp.castleId, side: 'gote',
      }) : null;
      const merged = oppPos
        ? K.compose.merge(mePos.position, oppPos.position, { late: 'opp' })
        : { position: mePos.position, contacts: [] };
      const threat = oppPos ? K.matchup.threat(m.me, m.opp) : null;
      return { mePos, oppPos, merged, threat };
    }

    // 脅威の帯・主役の経路（墨=自分・朱=相手）・接触の印・囲いの骨格線。
    // 盤レイヤの新しい API（routes/threat/contacts）はあれば使い、無ければ従来の route だけに落ちる
    _overlays(state, m, d) {
      const ov = this.overlay;
      if (ov.threat) ov.threat(m.show.opp && m.show.threat !== false && d.threat ? d.threat.threatFiles : null);
      const meT = this._tacticOf(m.me);
      const oppT = d.oppPos ? this._tacticOf(m.opp) : null;
      const routes = [
        meT && meT.route && meT.route.length > 1 ? { squares: meT.route, tone: 'ink' } : null,
        oppT && oppT.route && oppT.route.length > 1 ? { squares: oppT.route.map(mirrorSq), tone: 'bad' } : null,
      ].filter(Boolean);
      if (ov.routes) ov.routes(routes.length ? routes : null);
      else ov.route(meT && meT.route && meT.route.length > 1 ? meT.route : null, { tone: 'ink' });
      if (ov.contacts) {
        ov.contacts(d.merged.contacts.length
          ? d.merged.contacts.map(c => ({ sq: c.sq, kind: c.kind }))
          : null);
      }
      this._skeleton(state, m, d);
    }

    _skeleton(state, m, d) {
      // 骨格線は実際の合成局面（flex で崩した形も含む）から描く。同じ形なら再フェードさせない
      const pos = state.skeleton && d ? d.mePos.position : null;
      const key = pos ? pos.pieces.filter(x => x.role === 'core').map(x => `${x.p}${x.f}${x.r}`).sort().join(' ') : null;
      if (key === this._skKey) return;
      this._skKey = key;
      this.overlay.skeleton(pos);
    }

    _paintStage(m, d) {
      const e = this.stageEls;
      e.title.textContent = '対局図';
      e.context.textContent = e.context.title = d.threat
        ? `${d.threat.label} ／ ${K.STRATEGIES[m.me.strategy].label} × ${K.STRATEGIES[m.opp.strategy].label}`
        : `${K.STRATEGIES[m.me.strategy].label}（相手は非表示）`;
      e.legend.innerHTML = '<i></i>' + (d.threat
        ? '朱の帯は相手の攻め筋。破線は主役の駒の動き（墨＝自分・朱＝相手）。枠のマスは両軍の接触'
        : '破線は主役の駒の動き');
      // 持ち駒は両軍まとめて盤に置けない分。先後を分けて併記する
      const meH = d.mePos.position.hand || [];
      const oppH = d.oppPos ? d.oppPos.position.hand || [] : [];
      e.hand.textContent = meH.length || oppH.length
        ? `持ち駒：${meH.length ? '▲' + meH.join('・') : ''}${meH.length && oppH.length ? '　' : ''}${oppH.length ? '△' + oppH.join('・') : ''}` : '';
      e.ttl.classList.remove('swap'); void e.ttl.offsetWidth; e.ttl.classList.add('swap');
    }

    // 右パネルへ渡す表示用データを組み立てる
    _detailData(m, d) {
      const oppCtx = m.show.opp ? m.opp : null;
      const meT = this._tacticOf(m.me), meC = this._castleOf(m.me, m.opp);
      const oppT = m.show.opp ? this._tacticOf(m.opp) : null;
      const oppC = m.show.opp ? this._castleOf(m.opp, m.me) : null;
      const pairing = meT && meC
        ? this.repo.pairingsOf(meT).find(p => p.castle.id === meC.id) || null
        : null;
      const trio = ['strategy', 'tactic', 'castle'].map(layer => {
        const id = layer === 'strategy' ? m.me.strategy
          : layer === 'tactic' ? (m.me.tacticId || (meT && meT.id))
          : (m.me.castleId || (meC && meC.id));
        return { layer, id, judge: id ? K.compat.judge(m.me, layer, id, oppCtx) : null };
      });
      return {
        me: m.me, opp: m.opp, show: m.show, threat: d.threat,
        fit: d.threat && meC ? K.matchup.fitness(meC, d.threat) : null,
        meTactic: meT, meCastle: meC, oppTactic: oppT, oppCastle: oppC,
        meLabel: K.STRATEGIES[m.me.strategy].label, oppLabel: K.STRATEGIES[m.opp.strategy].label,
        pairing, trio, contacts: d.merged.contacts, flexed: d.mePos.flexed,
        sources: pairing ? pairing.sources : [],
        autoNote: this._autoNote ? this._autoNote.msg : null,
      };
    }
  }

  K.MatchupMode = MatchupMode;
})();
