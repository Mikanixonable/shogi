// 制約モード（統合画面「盤」）: 囲い図鑑・戦法周期表・対局図を、制約リストで描く1つの画面にまとめたもの。
//   - 盤: constraints.sides() の両側を compose.position/merge で合成。相手の制約が無いときは後手を描かない
//   - 制約バー: 制約チップ（×で削除・クリックで選択）＋暗黙の層＋導出ラベル（戦型）
//   - 左ドック（暫定）: 相手／自分の戦略・戦法・囲いの一覧。選択はすべて constraints.apply に通す
//   - 右ドック（暫定）: selected の種類ごとに DetailView / TacticDetailView / 簡易ブロックを出す
//   - 筋ボタン（周期表）: selected が *.tactic のときだけ。相手側は列を反転して「相手の戦法」と出す
//   - state.selected だけの変更では盤の駒を再描画しない（オーバーレイ・周期表・詳細だけ更新）
// 計画書 §1-3/§3-3/§4-5/§5
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';
  const K = window.Kakoi;
  const { esc, plain, rich, makeCiter, sourcesBlock } = K.html;
  const { parsePieces } = K.notation;
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
     *   els: bar, stageH, title, titleWrap, reading, setup, legend, hand,
     *        threatWrap, threatSw, playBtn, ptable, boardwrap, rail, detail{castle,tactic,misc}
     */
    constructor({ repo, store, board, overlay, els }) {
      Object.assign(this, { repo, store, board, overlay, els });
      this.rows = K.tacticNav.tacticRows(repo.tacticFamilies(), repo.tactics());
      this._renderKey = null;
      this._ptKey = null;
      this._meTactic = null;

      this.bar = new K.ConstraintBar(els.bar, {
        onSelect: (w, k) => this._select(w, k),
        onRemove: (w, k) => this._remove(w, k),
      });
      this.table = new K.TacticTableView(els.ptable, { onSelect: id => this._set(this._selWho(), 'tactic', id) });
      this.rail = new K.ConstraintRailView(els.rail, {
        onChoose: (w, k, id) => this._set(w, k, id),
        onRemoveSide: w => this._removeSide(w),
        onShow: (key, on) => this.store.set({ showThreat: on }),
        onPreview: (w, k, id) => this._preview(w, k, id),
        onPreviewEnd: () => { this.bar.flash(null); this.board.hover([], null); },
      });
      this.castleDetail = new K.DetailView(els.detail.castle, {
        onHover: (sqs, tone) => this.board.hover(sqs, tone),
        onAttack: attackId => this.store.set({ attackId }),
        onMatchup: () => this._addOpponent(),   // 「対局図で開く」→「相手を加える」に意味を変える
      });
      this.tacticDetail = new K.TacticDetailView(els.detail.tactic, {
        onHover: (sqs, tone) => this.board.hover(sqs, tone),
        onCastle: id => this._set(this._selWho(), 'castle', id),   // 「→」: その囲いを制約にして選択
        onMatchup: id => this._set(this._selWho(), 'castle', id),  // 「相性のよい囲い」: 同じく制約にして選択
      });
      els.threatSw.addEventListener('change', () => this.store.set({ showThreat: els.threatSw.checked }));
      els.playBtn.addEventListener('click', () => this._onPlay());
      this.player = new K.TacticPlayer({
        onStep: t => this._set(this._selWho(), 'tactic', t.id),
        onChange: playing => this._setPlaying(playing),
      });
      this._playing = false;
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
      this.store.set({ constraints: r.list, selected: `${who}.${kind}` });
      if (r.changed.length) this._toastChanged(r.changed, prev);
    }

    _select(who, kind) { this.store.set({ selected: `${who}.${kind}` }); }

    _remove(who, kind) {
      const r = K.constraints.apply(this.store.state.constraints, { type: 'remove', who, kind });
      const patch = { constraints: r.list };
      // selected は据え置く: 消えた層の暗黙値が同じ (who,kind) のチップとして選択を引き継ぐ。
      // ただし相手側の制約がこれで全部消えたときは、存在しない側を指さないよう握り直す
      const sel = parseSel(this.store.state.selected);
      if (sel && sel.who === 'opp' && !r.list.some(e => e.who === 'opp')) {
        const last = [...r.list].reverse().find(e => e.who === 'me') || r.list[r.list.length - 1];
        patch.selected = last ? `${last.who}.${last.kind}` : 'me.castle';
      }
      this.store.set(patch);
    }

    _removeSide(who) {
      let list = this.store.state.constraints;
      for (const kind of ['strategy', 'tactic', 'castle']) {
        list = K.constraints.apply(list, { type: 'remove', who, kind }).list;
      }
      const patch = { constraints: list };
      const sel = parseSel(this.store.state.selected);
      if (sel && sel.who === who) {
        const last = [...list].reverse().find(e => e.who === 'me') || list[list.length - 1];
        patch.selected = last ? `${last.who}.${last.kind}` : 'me.castle';
      }
      this.store.set(patch);
    }

    /** 「相手を加える」（詳細の .mu-open）: 相手の戦略を暗黙制約として足し、相手を選択する */
    _addOpponent() {
      const s = this.store.state;
      const S = K.constraints.sides(s.constraints);
      if (S.opp) { this.store.set({ selected: 'opp.strategy' }); return; }
      const strategy = S.me.strategy === 'ibisha' ? 'furibisha' : 'ibisha';
      const prev = { list: s.constraints, sel: s.selected };
      const r = K.constraints.apply(s.constraints, { type: 'set', who: 'opp', kind: 'strategy', id: strategy });
      this.store.set({ constraints: r.list, selected: 'opp.strategy' });
      if (r.changed.length) this._toastChanged(r.changed, prev);
    }

    /** ホバー予告（§3-3）: preview の changed に現れる制約チップを点滅させ、関係するマスを盤に示す */
    _preview(who, kind, id) {
      const s = this.store.state;
      const p = K.constraints.preview(s.constraints, { type: 'set', who, kind, id });
      this.bar.flash(p.changed.map(c => ({ who: c.who, kind: c.kind })));
      const S = K.constraints.sides(s.constraints);
      const st = S[who] || {};
      const j = K.compat.judge(st, kind, id, who === 'me' ? S.opp : S.me);
      const sq = [...new Set((j.reasons || []).flatMap(x => x.squares || []))];
      this.board.hover(sq, j.level === 'ng' ? 'bad' : 'focus');
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
          fn: () => this.store.set({ constraints: prev.list, selected: prev.sel }),
        },
      });
    }

    // ---------- 画面遷移 ----------
    enter(state) { this.update(state, new Set(['initial', ...Object.keys(state)])); }

    leave() {
      this.player.stop();
      this.board.setLasting([], null);
      this.overlay.clear();
      this.bar.flash(null);
      if (K.Toast) K.Toast.hide();
    }

    // ---------- 合成 ----------
    _compute(state) {
      const list = Array.isArray(state.constraints) ? state.constraints : [];
      const S = K.constraints.sides(list);
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
      if (hard || changed.has('constraints') || changed.has('showThreat')) this.rail.update(state, d.S);
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

    // ---------- 制約バー ----------
    _paintBar(state, d) {
      this.bar.render({
        list: state.constraints || [], me: d.S.me, opp: d.S.opp,
        selected: state.selected, labels: d.labels,
        nameOf: (w, k, id) => this._nameOf(w, k, id),
      });
    }

    // ---------- 中央の見出し・足元 ----------
    _paintStage(state, d) {
      const e = this.els, { S } = d;
      const sel = parseSel(state.selected);
      const st = sel && (S[sel.who] || S.me);
      let title = '将棋の囲い', reading = '', context = '';
      if (sel && st) {
        const id = st[FIELD[sel.kind]];
        const pre = sel.who === 'opp' ? '相手の' : '';
        if (sel.kind === 'strategy') {
          title = (K.STRATEGIES[id] && K.STRATEGIES[id].label) || '戦略';
          reading = '';
          context = `${pre}戦略`;
        } else {
          const x = sel.kind === 'tactic' ? this.repo.tacticById(id) : this.repo.byId(id);
          if (x) {
            title = `${pre}${x.name}`;
            reading = x.reading || '';
            const fam = sel.kind === 'tactic'
              ? this.repo.tacticFamilies().find(f => f.id === x.family)
              : this.repo.familyOf(x);
            context = [fam && fam.name, sel.kind === 'tactic' ? x.context : null].filter(Boolean).join(' ／ ');
            if (sel.who === 'opp') context = `相手の${LAYER_JA[sel.kind]}${context ? ` ／ ${context}` : ''}`;
          } else {
            title = `${pre}${LAYER_JA[sel.kind]}`;
          }
        }
      }
      e.title.textContent = title;
      e.reading.textContent = reading;
      e.setup.textContent = e.setup.title = context;
      e.legend.innerHTML = '<i></i>' + (d.threat
        ? '朱の帯は相手の攻め筋。破線は主役の駒の動き（墨＝自分・朱＝相手）。枠のマスは両軍の接触'
        : '朱色は囲いの駒と主役の駒。破線は主役の駒の動き');
      const meH = d.mePos.position.hand || [];
      const oppH = d.oppPos ? (d.oppPos.position.hand || []) : [];
      e.hand.textContent = meH.length || oppH.length
        ? `持ち駒：${meH.length ? '▲' + meH.join('・') : ''}${meH.length && oppH.length ? '　' : ''}${oppH.length ? '△' + oppH.join('・') : ''}` : '';
      e.titleWrap.classList.remove('swap'); void e.titleWrap.offsetWidth; e.titleWrap.classList.add('swap');
      e.threatSw.checked = state.showThreat !== false;
      e.threatWrap.hidden = !S.opp;
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
      const key = `${sel.who}:${st.strategy}`;
      if (key !== this._ptKey) {
        this._ptKey = key;
        this.table.render(rows, st.tacticId, { flip: sel.who === 'opp' });
      } else {
        this.table.select(st.tacticId);
      }
    }

    // ---------- 右ドック（暫定。種類ごとの組み立ては U5 で本格化） ----------
    _renderDetail(state, d) {
      const { S } = d;
      const sel = parseSel(state.selected) || { who: 'me', kind: 'castle' };
      const st = S[sel.who] || (sel.who === 'opp' ? null : S.me);
      const els = this.els.detail;
      els.castle.hidden = sel.kind !== 'castle';
      els.tactic.hidden = sel.kind !== 'tactic';
      els.misc.hidden = sel.kind !== 'strategy';
      if (sel.kind === 'castle') {
        const c = st && st.castleId ? this.repo.byId(st.castleId) : null;
        if (!c) { els.misc.hidden = false; els.misc.innerHTML = '<p class="note">囲いが選ばれていません。</p>'; return; }
        const fit = sel.who === 'me' && d.threat ? K.matchup.fitness(c, d.threat) : null;
        this.castleDetail.render(c, {
          attackId: state.attackId,
          sources: this.repo.sourcesOf(c),
          family: this.repo.familyOf(c),
          subtype: this.repo.subtypeOf(c),
          // 相手がいないときは「対局図で開く」を「相手を加える」に変えて出す
          matchup: S.opp ? null : '相手を加えて対局図にする',
          head: fit != null
            ? `<div class="sec"><h3>対戦相性<small>${esc(d.threat.label)}</small></h3>` +
              `<p class="mu-fit">${fit.toFixed(2)}<small>戦型の重み × 囲いの強み</small></p></div>`
            : '',
        });
      } else if (sel.kind === 'tactic') {
        const t = st && st.tacticId ? this.repo.tacticById(st.tacticId) : null;
        if (!t) { els.misc.hidden = false; els.misc.innerHTML = '<p class="note">戦法が選ばれていません。</p>'; return; }
        const family = this.repo.tacticFamilies().find(f => f.id === t.family);
        const castle = st && st.castleId ? this.repo.byId(st.castleId) : null;
        this.tacticDetail.render(t, {
          family,
          castles: this.repo.pairingsOf(t).filter(p => p.level !== 'ng')
            .map(p => ({ id: p.castle.id, name: p.castle.name, familyName: this.repo.familyOf(p.castle).name, level: p.level, why: p.why })),
          sources: this.repo.tacticComboSourcesOf(t, castle),
        });
      } else {
        els.misc.innerHTML = this._strategyBlock(sel, st, d);
      }
    }

    // *.strategy の説明（STRATEGIES[].desc が未整備の間は短文を出す。本格化は U5）
    _strategyBlock(sel, st, d) {
      const whoLabel = sel.who === 'me' ? '自分（先手）' : '相手（後手）';
      const sid = st ? st.strategy : null;
      const s = sid && K.STRATEGIES[sid];
      const citer = makeCiter();
      if (!s) return `<h2 class="cl-d-t">${whoLabel}の戦略</h2><p class="desc">左の一覧から戦略を選びます。</p>`;
      const desc = s.desc || (sid === 'ibisha'
        ? '飛車を初期位置（2筋など盤の左側）に据えて玉を左に囲う戦型。矢倉・角換わり・相掛かり・横歩取りなどに分かれる。'
        : '飛車を盤の右側（1〜6筋）へ振って玉を右に囲う戦型。四間飛車・三間飛車・中飛車・向かい飛車などがある。');
      const items = [
        st.tacticId ? `戦法：${esc(this._nameOf(sel.who, 'tactic', st.tacticId))}` : null,
        st.castleId ? `囲い：${esc(this._nameOf(sel.who, 'castle', st.castleId))}` : null,
      ].filter(Boolean).join('・');
      const labels = (d.labels || []).map(l => `<span class="tag">#${esc(l.label)}</span>`).join('');
      const dist = sel.who === 'me' && d.threat && d.threat.distance != null
        ? `<p class="note">自分の玉と相手の飛車の距離は ${d.threat.distance}筋。` +
          (d.threat.distance <= 2 ? '近い＝縦（上部）から攻められやすい'
            : d.threat.distance >= 4 ? '遠い＝横から回り込まれやすい' : '縦と横の両方を意識する') + '</p>' : '';
      return `<h2 class="cl-d-t">${esc(whoLabel)}：${esc(s.label)}</h2>` +
        `<p class="desc">${rich(desc, citer)}</p>` +
        (items ? `<p class="note">${items}</p>` : '') +
        (labels ? `<div class="sec"><h3>戦型</h3><div class="tags">${labels}</div></div>` : '') + dist;
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
      else this.player.start(list);
    }

    _setPlaying(playing) {
      this._playing = playing;
      this.els.playBtn.textContent = reducedMotion() ? '次の戦法へ' : playing ? '停止' : '順に再生';
      this.els.playBtn.setAttribute('aria-pressed', playing);
    }

    // ---------- キーボード（矢印ナビの最低限。本格化は U4） ----------
    _onKey(e) {
      if (document.body.dataset.view !== 'board') return;
      if (e.metaKey || e.ctrlKey || e.altKey || /input|textarea|select/i.test(e.target.tagName)) return;
      if (!e.key.startsWith('Arrow')) return;
      if (document.activeElement && document.activeElement.closest('.cbar')) return; // バー内は bar 側で処理
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
