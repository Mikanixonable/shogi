// 制約モード（統合画面「盤」）: 囲い図鑑・戦法周期表・対局図を、制約リストで描く1つの画面にまとめたもの。
//   - 盤: constraints.sides() の両側を compose.position/merge で合成。相手の制約が無いときは後手を描かない
//   - 制約バー: 制約チップ（×で削除・クリックで選択）＋暗黙の層＋導出ラベル（戦型）
//   - 左ドック（U4）: 上下2面の DockView。各面は who×tab を独立に切り替え、選択はすべて constraints.apply に通す
//   - 右ドック（U5）: BoardDetailView が selected の {who,kind} に応じて detail-sections の部品を組み立てる
//   - 筋ボタン（周期表）: selected が *.tactic のときだけ。相手側は列を反転して「相手の戦法」と出す
//   - state.selected だけの変更では盤の駒を再描画しない（オーバーレイ・周期表・詳細だけ更新）
// 計画書 §1-3/§3-3/§4-5/§5
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';
  const K = window.Kakoi;
  const { plain } = K.html;
  const { parsePieces, KAN } = K.notation;
  const FIELD = K.constraints.FIELD;
  const LAYER_JA = { strategy: '戦略', tactic: '戦法', castle: '囲い' };
  const mirrorSq = s => `${10 - +s[0]}${10 - +s[1]}`;
  const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const parseSel = s => {
    const m = /^(me|opp)\.(strategy|tactic|castle)$/.exec(String(s || ''));
    return m ? { who: m[1], kind: m[2] } : null;
  };

  class ConstraintMode {
    /**
     * @param {{ repo:Kakoi.Repository, store:Kakoi.Store, board:Kakoi.BoardView, overlay:Kakoi.OverlayView, els:object }} deps
     *   els: stage, bandOpp, bandMe, barOpp, barMe, nameOpp, subOpp, nameMe, subMe, stageH,
     *        legend, handOpp, handMe, threatWrap, threatSw, playBtn,
     *        clearOpp, clearMe, clearAll, ptable, boardwrap, rail, detail
     */
    constructor({ repo, store, board, overlay, els }) {
      Object.assign(this, { repo, store, board, overlay, els });
      this.rows = K.tacticNav.tacticRows(repo.tacticFamilies(), repo.tactics());
      this._renderKey = null;
      this._ptKey = null;
      this._meTactic = null;
      this._lastChanged = null;
      this._stageKeys = {};

      // 制約バーは盤の上（相手）と下（自分）の2本。相手がいないときは自分の帯が盤の上に回る
      this.bars = {
        opp: new K.ConstraintBar(els.barOpp, { who: 'opp', onSelect: (w, k) => this._select(w, k), onRemove: (w, k) => this._remove(w, k) }),
        me: new K.ConstraintBar(els.barMe, { who: 'me', onSelect: (w, k) => this._select(w, k), onRemove: (w, k) => this._remove(w, k) }),
      };
      this.table = new K.TacticTableView(els.ptable, { onSelect: id => this._set(this._selWho(), 'tactic', id) });
      // 左ドック: 上下2面の分割ペイン（U4）。面の {who,tab} と分割比は dock が store に書く
      this.dock = new K.DockView(els.rail /* #pickRail */, {
        store,
        onChoose: (w, k, id) => this._set(w, k, id),
        onRemoveSide: w => this._removeSide(w),
        onPreview: (w, k, id) => this._preview(w, k, id),
        onPreviewEnd: () => { this._flash(null); this.board.hover([], null); },
        onAddOpponent: () => this._addOpponent(),
      });
      // 右ドック（U5）: selected の種類に応じて部品を組み立てる自己完結ビュー
      this.detail = new K.BoardDetailView(els.detail, {
        onHover: (sqs, tone) => this.board.hover(sqs, tone),
        onAttack: attackId => this.store.set({ attackId }),
        onSetConstraint: (w, k, id) => this._set(w, k, id),
        onAddOpponent: () => this._addOpponent(),
      });
      els.threatSw.addEventListener('change', () => this.store.set({ showThreat: els.threatSw.checked }));
      els.playBtn.addEventListener('click', () => this._onPlay());
      els.clearOpp.addEventListener('click', () => this._removeSide('opp'));
      els.clearMe.addEventListener('click', () => this._removeSide('me'));
      els.clearAll.addEventListener('click', () => this._removeAll());
      this.player = new K.TacticPlayer({
        onStep: t => this._applyPlayStep(t),
        onChange: playing => this._setPlaying(playing),
      });
      this._playing = false;
      this._playTactic = null;   // 再生中の表示専用の差し替え（制約は書き換えない）
      this._playWho = null;
      document.addEventListener('keydown', e => this._onKey(e));
    }

    // ---------- 名前まわり ----------
    _nameOf(who, kind, id) {
      if (id == null) return '（未選択）';
      if (kind === 'strategy') return (K.STRATEGIES[id] && K.STRATEGIES[id].label) || id;
      const x = kind === 'tactic' ? this.repo.tacticById(id) : this.repo.byId(id);
      return x ? x.name : id;
    }
    _selWho() { return (parseSel(this.store.state.selected) || { who: 'me' }).who; }

    // ---------- 制約の操作（すべて apply に通す） ----------
    _set(who, kind, id) {
      const s = this.store.state;
      const prev = { list: s.constraints, sel: s.selected };
      const r = K.constraints.apply(s.constraints, { type: 'set', who, kind, id });
      this._lastChanged = r.changed;
      this.store.set({ constraints: r.list, selected: `${who}.${kind}` });
      if (r.changed.length) this._toastChanged(r.changed, prev);
    }

    _select(who, kind) { this.store.set({ selected: `${who}.${kind}` }); }

    _flash(pairs) { this.bars.me.flash(pairs); this.bars.opp.flash(pairs); }

    _remove(who, kind) {
      const s = this.store.state;
      const prev = { list: s.constraints, sel: s.selected };
      const r = K.constraints.apply(s.constraints, { type: 'remove', who, kind });
      this._lastChanged = r.changed;
      const patch = { constraints: r.list };
      // selected は据え置く: 消えた層の暗黙値が同じ (who,kind) のチップとして選択を引き継ぐ。
      // ただし相手側の制約がこれで全部消えたときは、存在しない側を指さないよう握り直す
      const sel = parseSel(s.selected);
      if (sel && sel.who === 'opp' && !r.list.some(e => e.who === 'opp')) {
        const last = [...r.list].reverse().find(e => e.who === 'me') || r.list[r.list.length - 1];
        patch.selected = last ? `${last.who}.${last.kind}` : 'me.castle';
      }
      this.store.set(patch);
      // 明示制約の除去も元に戻せるようにする（実効値は既定値に落ちるだけだが選んだ履歴は消える）
      const had = prev.list.find(e => e.who === who && e.kind === kind);
      if (K.Toast && had) {
        K.Toast.show(`${who === 'opp' ? '相手の' : ''}${LAYER_JA[kind]}「${this._nameOf(who, kind, had.id)}」を外しました`, {
          host: this.els.stageH,
          action: { label: '元に戻す', fn: () => { this._lastChanged = null; this.store.set({ constraints: prev.list, selected: prev.sel }); } },
        });
      }
    }

    _removeSide(who) {
      this._lastChanged = null;
      const s = this.store.state;
      const prev = { list: s.constraints, sel: s.selected };
      let list = s.constraints;
      for (const kind of ['strategy', 'tactic', 'castle']) {
        list = K.constraints.apply(list, { type: 'remove', who, kind }).list;
      }
      const patch = { constraints: list };
      const sel = parseSel(s.selected);
      if (sel && sel.who === who) {
        const last = [...list].reverse().find(e => e.who === 'me') || list[list.length - 1];
        patch.selected = last ? `${last.who}.${last.kind}` : 'me.castle';
      }
      this.store.set(patch);
      if (K.Toast && prev.list.length !== list.length) {
        K.Toast.show(`${who === 'opp' ? '相手' : '自分'}の制約を全部外しました`, {
          host: this.els.stageH,
          action: { label: '元に戻す', fn: () => { this._lastChanged = null; this.store.set({ constraints: prev.list, selected: prev.sel }); } },
        });
      }
    }

    /** 「すべてはずす」: 両側の制約を全部消す（盤は自分側の既定値だけが残る） */
    _removeAll() {
      this._lastChanged = null;
      const s = this.store.state;
      if (!s.constraints.length) return;
      const prev = { list: s.constraints, sel: s.selected };
      this.store.set({ constraints: [], selected: 'me.castle' });
      if (K.Toast) {
        K.Toast.show('制約を全部外しました', {
          host: this.els.stageH,
          action: { label: '元に戻す', fn: () => { this._lastChanged = null; this.store.set({ constraints: prev.list, selected: prev.sel }); } },
        });
      }
    }

    /** 「相手を加える」（詳細の .mu-open）: 相手の戦略を暗黙制約として足し、相手を選択する */
    _addOpponent() {
      const s = this.store.state;
      const S = K.constraints.sides(s.constraints);
      if (S.opp) { this.store.set({ selected: 'opp.strategy' }); return; }
      const strategy = S.me.strategy === 'ibisha' ? 'furibisha' : 'ibisha';
      const prev = { list: s.constraints, sel: s.selected };
      const r = K.constraints.apply(s.constraints, { type: 'set', who: 'opp', kind: 'strategy', id: strategy });
      this._lastChanged = r.changed;
      this.store.set({ constraints: r.list, selected: 'opp.strategy' });
      if (r.changed.length) this._toastChanged(r.changed, prev);
    }

    /** ホバー予告（§3-3）: preview の changed に現れる制約チップを点滅させ、
     *  理由のマスと「動く予定の駒」のマスを盤に示す */
    _preview(who, kind, id) {
      const s = this.store.state;
      const p = K.constraints.preview(s.constraints, { type: 'set', who, kind, id });
      this._flash(p.changed.map(c => ({ who: c.who, kind: c.kind })));
      // judge の土台は「候補を置いた後」の側（その側が空でも候補から戦略が推論される）
      const Sp = K.constraints.sides(p.list);
      const st = Sp[who] || {};
      const j = K.compat.judge(st, kind, id, who === 'me' ? Sp.opp : Sp.me);
      const sq = new Set((j.reasons || []).flatMap(x => x.squares || []));
      // 動く予定の駒のマス（§3-3）: いまの実効局面と候補の合成局面を比べて、
      // core/lead の駒が増減・移動するマスを拾う（相手側は絶対座標に反転する）
      const S = K.constraints.sides(s.constraints);
      const cur = S[who];
      if (cur && Sp[who]) {
        const mir = who === 'opp';
        const posOf = x => K.compose.position({
          strategy: x.strategy, tacticId: x.tacticId, castleId: x.castleId, side: 'sente',
        }).position;
        const a = posOf(cur), b = posOf(Sp[who]);
        for (const x of [...a.pieces, ...b.pieces]) {
          if (x.role !== 'core' && x.role !== 'lead') continue;
          const ya = a.at(x.f, x.r), yb = b.at(x.f, x.r);
          if ((ya && ya.p) !== (yb && yb.p)) sq.add(mir ? mirrorSq(`${x.f}${x.r}`) : `${x.f}${x.r}`);
        }
      }
      this.board.hover([...sq], j.level === 'ng' ? 'bad' : 'focus');
    }

    _toastChanged(changed, prev) {
      if (!K.Toast) return;
      const name = (kind, id) => this._nameOf('me', kind, id);
      const msg = changed.map(c => c.dropped
        ? `${LAYER_JA[c.kind]}「${name(c.kind, c.from)}」を外しました（${plain(c.why)}）`
        : `${LAYER_JA[c.kind]}を「${name(c.kind, c.from)}」から「${name(c.kind, c.to)}」へ変更しました`
      ).join('、');
      K.Toast.show(msg, {
        host: this.els.stageH,
        action: {
          label: '元に戻す',
          fn: () => { this._lastChanged = null; this.store.set({ constraints: prev.list, selected: prev.sel }); },
        },
      });
    }

    // ---------- 画面遷移 ----------
    enter(state) { this.update(state, new Set(['initial', ...Object.keys(state)])); }

    leave() {
      this._playTactic = null; this._playWho = null;
      this.player.stop();
      this.board.setLasting([], null);
      this.overlay.clear();
      this._flash(null);
      if (K.Toast) K.Toast.hide();
    }

    // ---------- 合成 ----------
    _compute(state) {
      const list = Array.isArray(state.constraints) ? state.constraints : [];
      const S = K.constraints.sides(list);
      // 再生中は制約を書き換えず、表示の実効戦法だけを差し替える（§4-5: 連鎖・トーストを出さない）
      if (this._playTactic && this._playWho && S[this._playWho]) {
        S[this._playWho] = { ...S[this._playWho], tacticId: this._playTactic };
      }
      const mePos = K.compose.position({
        strategy: S.me.strategy, tacticId: S.me.tacticId, castleId: S.me.castleId, side: 'sente',
      });
      const oppPos = S.opp ? K.compose.position({
        strategy: S.opp.strategy, tacticId: S.opp.tacticId, castleId: S.opp.castleId, side: 'gote',
      }) : null;
      const merged = oppPos
        ? K.compose.merge(mePos.position, oppPos.position, { late: K.constraints.lateOf(list) })
        : { position: mePos.position, contacts: [] };
      const threat = S.opp ? K.matchup.threat(S.me, S.opp) : null;
      const labels = K.constraints.labels(S.me, S.opp);
      return { S, mePos, oppPos, merged, threat, labels };
    }

    // 選択中の囲いの攻め筋。相手の制約があるときは後手の駒を置かず、狙われるマスだけ示す（§5）
    _attackInfo(state, S) {
      const sel = parseSel(state.selected);
      if (!sel || sel.kind !== 'castle' || !state.attackId) return null;
      const st = S[sel.who];
      const castle = st && st.castleId ? this.repo.byId(st.castleId) : null;
      const a = castle ? this.repo.attackOf(castle, state.attackId) : null;
      if (!a) return null;
      const mirror = sel.who === 'opp'; // 相手の囲いへの攻め筋は先手（こちら）の駒になる
      return {
        attack: a, who: sel.who,
        pieces: parsePieces(a.gote).map(x => ({
          p: x.p, f: mirror ? 10 - x.f : x.f, r: mirror ? 10 - x.r : x.r,
          owner: mirror ? 'sente' : 'gote', role: 'attack',
        })),
        target: (a.target || []).map(s => mirror ? mirrorSq(s) : s),
        showPieces: !S.opp,
      };
    }

    // 駒レイヤに効く入力だけを見る（selected の変更では再描画しない）
    _renderKeyOf(state, d, attack) {
      const { S } = d;
      return JSON.stringify({
        me: [S.me.strategy, S.me.tacticId, S.me.castleId],
        opp: S.opp ? [S.opp.strategy, S.opp.tacticId, S.opp.castleId] : null,
        late: K.constraints.lateOf(state.constraints),
        heat: state.heat ? state.heatScope : 0,
        atk: attack ? [attack.who, attack.attack.id, !!S.opp] : 0,
      });
    }

    update(state, changed) {
      const d = this._compute(state);
      const attack = this._attackInfo(state, d.S);
      const hard = changed.has('initial');
      const key = this._renderKeyOf(state, d, attack);
      const redraw = key !== this._renderKey;
      if (hard || redraw) {
        this._renderKey = key;
        this._renderBoard(state, d, attack, !hard && changed.has('constraints'));
      } else if (changed.has('mode')) {
        this.board.setMode(state.mode);
      }
      if (!redraw && changed.has('skeleton')) this._skeleton(state, d);
      // 脅威の帯スイッチは駒レイヤに触らず、重ね表示だけ更新する
      if (!redraw && changed.has('showThreat')) this._overlays(state, d);

      if (hard || changed.has('constraints') || changed.has('selected')
          || changed.has('attackId') || changed.has('showThreat')) {
        this._paintBar(state, d);
        this._paintStage(state, d);
        this._paintTable(state, d);
        this._renderDetail(state, d);
      }
      if (hard || changed.has('constraints') || changed.has('showThreat') || changed.has('dock')
          || changed.has('attackId')) this.dock.update(state, d.S);
    }

    // 盤の駒レイヤ＋重ね表示。selected のみの更新では来ない
    _renderBoard(state, d, attack, animate) {
      const { S, merged } = d;
      const position = attack && attack.showPieces
        ? new K.Position([...merged.position.pieces, ...attack.pieces], [...merged.position.hand])
        : merged.position;
      const heat = state.heat
        ? K.attackMap(position, x => state.heatScope === 'all' || x.role === 'core' || x.role === 'lead')
        : null;
      this.board.setLasting([
        ...merged.contacts.filter(c => c.kind === 'ng').map(c => c.sq),
        ...(attack ? attack.target : []),
      ], 'bad');
      // 自分の戦法が変わったときは主役の駒を経路どおりに滑らせる（旧戦法画面と同じ）
      const meT = this.repo.tacticById(S.me.tacticId);
      const trace = animate && meT && this._meTactic !== meT.id && meT.route && meT.route.length > 1
        ? { square: meT.lead.square, piece: meT.lead.piece, path: meT.route } : null;
      this._meTactic = S.me.tacticId;
      this.board.render(position, { mode: state.mode, heat, animate, trace });
      this._overlays(state, d);
    }

    _overlays(state, d) {
      const { S, merged, threat } = d;
      const ov = this.overlay;
      // 脅威の帯は相手がいるときだけ（showThreat スイッチも残す）
      ov.threat(S.opp && state.showThreat !== false && threat ? threat.threatFiles : null);
      const meT = this.repo.tacticById(S.me.tacticId);
      const oppT = S.opp ? this.repo.tacticById(S.opp.tacticId) : null;
      const routes = [
        meT && meT.route && meT.route.length > 1 ? { squares: meT.route, tone: 'ink' } : null,
        oppT && oppT.route && oppT.route.length > 1 ? { squares: oppT.route.map(mirrorSq), tone: 'bad' } : null,
      ].filter(Boolean);
      ov.routes(routes.length ? routes : null);
      ov.contacts(merged.contacts.length
        ? merged.contacts.map(c => ({ sq: c.sq, kind: c.kind }))
        : null);
      this._skeleton(state, d);
    }

    _skeleton(state, d) {
      // 骨格線は自分の囲いだけ（実際の合成局面から描く）
      const pos = state.skeleton ? d.mePos.position : null;
      const key = pos ? pos.pieces.filter(x => x.role === 'core').map(x => `${x.p}${x.f}${x.r}`).sort().join(' ') : null;
      if (key === this._skKey) return;
      this._skKey = key;
      this.overlay.skeleton(pos);
    }

    // ---------- 制約バー（盤の上=相手・下=自分の2本。導出ラベルは自分側の右端） ----------
    _paintBar(state, d) {
      const common = {
        list: state.constraints || [], me: d.S.me, opp: d.S.opp,
        selected: state.selected, nameOf: (w, k, id) => this._nameOf(w, k, id),
      };
      this.bars.opp.render({ ...common, labels: null });
      this.bars.me.render({ ...common, labels: d.labels });
    }

    // ---------- 盤の上下の帯（状態の名前＋制約バー）・足元 ----------
    // 帯の名前: 選択中の側はその制約の名前（旧見出しと同じ）、もう一方の側は実効の組み合わせ
    _sideName(who, st, sel) {
      const strat = (K.STRATEGIES[st.strategy] || {}).label || '';
      const combo = ['tactic', 'castle']
        .map(k => st[FIELD[k]] ? this._nameOf(who, k, st[FIELD[k]]) : null)
        .filter(Boolean).join('・');
      if (sel && sel.who === who) {
        const id = st[FIELD[sel.kind]];
        if (sel.kind === 'strategy') return { name: strat || '戦略', sub: '戦略' };
        const x = sel.kind === 'tactic' ? this.repo.tacticById(id) : this.repo.byId(id);
        if (x) {
          const fam = sel.kind === 'tactic'
            ? this.repo.tacticFamilies().find(f => f.id === x.family)
            : this.repo.familyOf(x);
          const sub = [x.reading, fam && fam.name, sel.kind === 'tactic' ? x.context : null]
            .filter(Boolean).join('　／　');
          return { name: x.name, sub };
        }
        return { name: LAYER_JA[sel.kind], sub: strat };
      }
      return { name: combo || strat || '（未選択）', sub: strat };
    }

    // 伝統的な記法の持ち駒: 主語（▲/△）＋駒＋二枚以上は漢数字（歩二・香 など）
    _handText(pos, mark) {
      const h = (pos && pos.hand) || [];
      if (!h.length) return '';
      const cnt = new Map();
      for (const p of h) cnt.set(p, (cnt.get(p) || 0) + 1);
      return mark + [...cnt.entries()].map(([p, n]) => p + (n > 1 ? KAN[n] : '')).join(' ');
    }

    _paintStage(state, d) {
      const e = this.els, { S } = d;
      const sel = parseSel(state.selected);
      const hasOpp = !!S.opp;
      e.stage.dataset.opp = hasOpp ? 'true' : 'false';
      e.bandOpp.hidden = !hasOpp;

      for (const who of ['me', 'opp']) {
        const st = S[who];
        if (!st) continue;
        const nameEl = who === 'me' ? e.nameMe : e.nameOpp;
        const subEl = who === 'me' ? e.subMe : e.subOpp;
        const { name, sub } = this._sideName(who, st, sel);
        const stageKey = `${who}|${name}|${sub}`;
        if (stageKey !== this._stageKeys[who]) {
          this._stageKeys[who] = stageKey;
          nameEl.textContent = name;
          subEl.textContent = subEl.title = sub;
          const ttl = nameEl.closest('.ttl');
          if (ttl) { ttl.classList.remove('swap'); void ttl.offsetWidth; ttl.classList.add('swap'); }
        }
        (who === 'me' ? e.bandMe : e.bandOpp).dataset.sel = sel && sel.who === who ? 'true' : 'false';
      }

      e.legend.innerHTML = '<i></i>' + (d.threat
        ? '朱の帯は相手の攻め筋。破線は主役の駒の動き（墨＝自分・朱＝相手）。枠のマスは両軍の接触'
        : '朱色は囲いの駒と主役の駒。破線は主役の駒の動き');
      // 持ち駒は盤の左右（敵=左・味方=右）
      e.handMe.textContent = this._handText(d.mePos.position, '▲');
      e.handOpp.textContent = d.oppPos ? this._handText(d.oppPos.position, '△') : '';
      e.threatSw.checked = state.showThreat !== false;
      e.threatWrap.hidden = !S.opp;
      e.clearAll.hidden = !(state.constraints || []).length;
      const selTactic = sel && sel.kind === 'tactic';
      e.playBtn.hidden = !selTactic;
      if (!selTactic && this._playing) this.player.stop();
    }

    // ---------- 筋ボタン（周期表。selected が *.tactic のときだけ） ----------
    _paintTable(state, d) {
      const sel = parseSel(state.selected);
      const on = !!(sel && sel.kind === 'tactic' && (d.S[sel.who] || d.S.me));
      this.els.boardwrap.dataset.pt = on ? 'on' : 'off';
      if (!on) { this._ptKey = null; return; }
      const st = d.S[sel.who] || d.S.me;
      const rows = this.rows.filter(r => r.family.side === st.strategy);
      const offRows = this.rows.filter(r => r.family.side !== st.strategy);
      // 選択中が派生戦法のときは親のセルを current にする（§4-3: 派生は親に束ねる）
      const selT = this.repo.tacticById(st.tacticId);
      const selId = (selT && selT.variantOf) || st.tacticId;
      const key = `${sel.who}:${st.strategy}`;
      if (key !== this._ptKey) {
        this._ptKey = key;
        this.table.render(rows, selId, {
          flip: sel.who === 'opp',
          sideLabel: sel.who === 'opp' ? '相手の戦法' : '自分の戦法',
          offRows,
        });
      } else {
        this.table.select(selId);
      }
    }

    // ---------- 右ドック（U5）: selected の種類に応じた組み立ては BoardDetailView に委譲 ----------
    _renderDetail(state, d) {
      const sel = parseSel(state.selected) || { who: 'me', kind: 'castle' };
      this.detail.render({
        sel,
        st: d.S[sel.who] || null,
        S: d.S,
        threat: d.threat,
        labels: d.labels,
        attackId: state.attackId,
        showThreat: state.showThreat,
        constraints: state.constraints,
        changed: this._lastChanged || null,
      });
    }

    // ---------- 再生 ----------
    _tacticListFor(who) {
      const S = K.constraints.sides(this.store.state.constraints);
      const st = S[who] || S.me;
      return this.rows.filter(r => r.family.side === st.strategy).flatMap(r => r.tactics);
    }

    _onPlay() {
      const sel = parseSel(this.store.state.selected);
      if (!sel || sel.kind !== 'tactic') return;
      const list = this._tacticListFor(sel.who);
      if (reducedMotion()) {
        const st = K.constraints.sides(this.store.state.constraints)[sel.who];
        const i = list.findIndex(t => t.id === (st && st.tacticId));
        if (list.length) this._set(sel.who, 'tactic', list[(i + 1 + list.length) % list.length].id);
      } else if (this.player.playing) this.player.stop();
      else {
        this._playWho = sel.who;   // 再生開始時の側を固定（途中で選択を変えても外れない）
        this._lastChanged = null;  // 再生中の差し替え表示は連鎖ではないので、詳細の連鎖ノートは消す
        this.player.start(list);
      }
    }

    // 再生は表示専用: 制約リスト（＝ユーザの選んだ形）を書き換えない。
    // _set 経由だと、再生中の戦法に合わせて囲いが静かに差し替わり・毎ステップトーストが出る
    _applyPlayStep(t) {
      this._playTactic = t.id;
      // 'constraints' 相当の再描画（駒の滑走アニメ・ドック・詳細）を直接呼ぶ。store は触らない
      if (document.body.dataset.view === 'board') this.update(this.store.state, new Set(['constraints', 'attackId']));
    }

    _setPlaying(playing) {
      this._playing = playing;
      this.els.playBtn.textContent = reducedMotion() ? '次の戦法へ' : playing ? '停止' : '順に再生';
      this.els.playBtn.setAttribute('aria-pressed', playing);
      if (!playing && this._playTactic) {
        this._playTactic = null; this._playWho = null;
        if (document.body.dataset.view === 'board') this.update(this.store.state, new Set(['attackId']));
      }
    }

    // ---------- キーボード（矢印ナビの最低限。本格化は U4） ----------
    _onKey(e) {
      if (document.body.dataset.view !== 'board') return;
      if (e.metaKey || e.ctrlKey || e.altKey || /input|textarea|select/i.test(e.target.tagName)) return;
      if (!e.key.startsWith('Arrow')) return;
      if (document.activeElement && document.activeElement.closest('.cbar')) return; // バー内は bar 側で処理
      if (document.activeElement && document.activeElement.closest('.dk-sep')) return; // ドックのスプリッタは ↑↓ で比率を動かす
      const sel = parseSel(this.store.state.selected);
      if (!sel) return;
      const S = K.constraints.sides(this.store.state.constraints);
      const st = S[sel.who] || S.me;
      if (sel.kind === 'tactic') {
        const rows = this.rows.filter(r => r.family.side === st.strategy);
        const cur = this.repo.tacticById(st.tacticId);
        const next = cur && K.tacticNav.neighbor(rows, cur, e.key);
        if (next) { e.preventDefault(); this._set(sel.who, 'tactic', next.id); }
      } else if (sel.kind === 'castle') {
        const list = this.repo.ofSideByFamily(st.strategy);
        const i = list.findIndex(c => c.id === st.castleId);
        if (i < 0 || list.length < 2) return;
        const dir = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1;
        e.preventDefault();
        this._set(sel.who, 'castle', list[(i + dir + list.length) % list.length].id);
      } else {
        e.preventDefault();
        this._set(sel.who, 'strategy', st.strategy === 'ibisha' ? 'furibisha' : 'ibisha');
      }
    }
  }

  K.ConstraintMode = ConstraintMode;
})();
