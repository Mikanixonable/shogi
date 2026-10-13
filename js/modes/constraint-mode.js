// 制約モード（統合画面「盤」）のコントローラ（計画書 S6 の ConstraintController）:
// コマンド（制約の選択・除去・元に戻す）とホバー予告、トーストを持つ。
// 描画は board-screen.js の BoardScreen、盤上の矢印は keyboard-nav.js、
// 再生は tactic-playback.js（store.play）へ分けた。
//   - 盤: constraints.sides() の両側を compose.position/merge で合成。相手の制約が無いときは後手を描かない
//   - 制約バー: 制約チップ（×で削除・クリックで選択）＋既定の層＋導出ラベル（戦型）
//   - 左ドック（U4）: 上下2面の DockView。各面は who×tab を独立に切り替え、選択はすべて constraints.apply に通す
//   - 右ドック（U5）: BoardDetailView が selected の {who,kind} に応じて detail-sections の部品を組み立てる
//   - 筋ボタン（周期表）: selected が *.tactic のときだけ。相手側は列を反転して「相手の戦法」と出す
//   - state.selected だけの変更では盤の駒を再描画しない（オーバーレイ・周期表・詳細だけ更新）
// 計画書 §1-3/§3-3/§4-5/§5
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';
  const K = window.Kakoi;
  const { mirrorSq } = K.notation;
  const FIELD = K.constraints.FIELD;
  const { LAYER_JA } = K.lookup;
  const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const parseSel = K.constraints.parseSel;

  class ConstraintMode {
    /**
     * @param {{ repo:Kakoi.Repository, store:Kakoi.Store, board:Kakoi.BoardView, overlay:Kakoi.OverlayView, els:object }} deps
     *   els: stage, bandOpp, bandMe, barOpp, barMe, nameOpp, subOpp, nameMe, subMe, stageH,
     *        legend, handOpp, handMe, playBtn,
     *        addOpp, clearOpp, clearMe, clearAll, ptable, boardwrap, rail, detail
     */
    constructor({ repo, store, board, overlay, els }) {
      Object.assign(this, { repo, store, board, overlay, els });
      this.rows = K.tacticNav.tacticRows(repo.tacticFamilies(), repo.tactics());
      this._lastChanged = null;
      this._pvKey = null;
      this._pvRaf = null;

      // 制約バーは盤の上（相手）と下（自分）の2本。相手がいないときは自分の帯が盤の上に回る
      const barHandlers = {
        onSelect: (w, k) => this._select(w, k),
        onRemove: (w, k) => this._remove(w, k),
        // 導出ラベル（戦型）は自分の戦略の解説へ（U5: 押すと右ドックで説明を出す）
        onLabel: () => this._select('me', 'strategy'),
      };
      this.bars = {
        opp: new K.ConstraintBar(els.barOpp, { who: 'opp', ...barHandlers }),
        me: new K.ConstraintBar(els.barMe, { who: 'me', ...barHandlers }),
      };
      this.table = new K.TacticTableView(els.ptable, { onSelect: id => this._set(this._selWho(), 'tactic', id) });
      // 左ドック: 上下2面の分割ペイン（U4）。面の {who,tab} と分割比は dock が store に書く
      this.dock = new K.DockView(els.rail /* #pickRail */, {
        store,
        onChoose: (w, k, id) => this._set(w, k, id),
        onRemoveSide: w => this._removeSide(w),
        onPreview: (w, k, id) => this._preview(w, k, id),
        onPreviewEnd: () => {
          this._pvKey = null;
          if (this._pvRaf) { cancelAnimationFrame(this._pvRaf); this._pvRaf = null; }
          this._flash(null); this.board.hover([], null);
        },
        onAddOpponent: () => this._addOpponent(),
      });
      // 右ドック（U5）: selected の種類に応じて部品を組み立てる自己完結ビュー。
      // Repository は共有のものを渡す（S5: 内部で作り直さない）
      this.detail = new K.BoardDetailView(els.detail, {
        repo: this.repo,
        onHover: (sqs, tone) => this.board.hover(sqs, tone),
        onAttack: attackId => this.store.set({ attackId }),
        onSetConstraint: (w, k, id) => this._set(w, k, id),
        onAddOpponent: () => this._addOpponent(),
      });
      // 再生（S6）: 状態は store.play（非永続）に昇格。ボタンの見た目だけここで面倒を見る
      this.playback = new K.TacticPlayback(store, {
        onChange: playing => this._paintPlayBtn(playing),
      });
      // 「見える半分」は BoardScreen に委譲（S6）
      this.screen = new K.BoardScreen({
        els, board, overlay,
        bars: this.bars, table: this.table, detail: this.detail,
        repo, rows: this.rows, playback: this.playback,
        nameOf: (w, k, id) => this._nameOf(w, k, id),
      });
      els.playBtn.addEventListener('click', () => this._onPlay());
      els.addOpp.addEventListener('click', () => this._addOpponent());
      els.clearOpp.addEventListener('click', () => this._removeSide('opp'));
      els.clearMe.addEventListener('click', () => this._removeSide('me'));
      els.clearAll.addEventListener('click', () => this._removeAll());
      document.addEventListener('keydown', e => this._onKey(e));
    }

    // ---------- 名前まわり ----------
    _nameOf(who, kind, id) {
      if (id == null) return '（未選択）';
      if (kind === 'strategy') return (K.STRATEGIES[id] && K.STRATEGIES[id].label) || id;
      const x = kind === 'tactic' ? this.repo.tacticById(id) : this.repo.byId(id);
      return x ? x.name : id;
    }
    // トースト用の短い名前（short があればそれ。長い正式名で3行以上になるのを防ぐ）
    _shortOf(kind, id) {
      if (id == null) return '既定値';
      if (kind === 'strategy') return (K.STRATEGIES[id] && K.STRATEGIES[id].label) || id;
      const x = kind === 'tactic' ? this.repo.tacticById(id) : this.repo.byId(id);
      return x ? (x.short || x.name) : id;
    }
    // 変更1件を「層 前→後」の短い形にする（dropped: 自分=既定値に戻る・相手=外れる）。
    // 長文にしない・理由は詳細パネルに任せる（トーストは最大2行を目安に）
    _toastPart(c) {
      const side = c.who === 'opp' ? '相手の' : '';
      const to = c.dropped ? (c.who === 'me' ? '既定値' : '外れ') : this._shortOf(c.kind, c.to);
      return `${side}${LAYER_JA[c.kind]} ${this._shortOf(c.kind, c.from)}→${to}`;
    }
    _selWho() { return (parseSel(this.store.state.selected) || { who: 'me' }).who; }

    // ---------- 制約の操作（すべて apply に通す） ----------
    _set(who, kind, id) {
      const s = this.store.state;
      const prev = { list: s.constraints, sel: s.selected };
      const r = K.constraints.apply(s.constraints, { type: 'set', who, kind, id });
      this._lastChanged = r.changed;
      this.store.set({ constraints: r.list, selected: `${who}.${kind}` });
      this._openDrawer();
      if (r.changed.length) this._toastChanged(r.changed, prev);
    }

    _select(who, kind) {
      this.store.set({ selected: `${who}.${kind}` });
      // 中くらいの幅では右ドックはドロワー。制約チップを選んだら開く（§4-6）
      this._openDrawer();
      // 左ドックも連動する（U5: その側の面を開き、種類のタブへ切り替えて項目まで送る）
      this.dock.reveal(who, kind);
    }

    _openDrawer() {
      if (matchMedia('(min-width:980px) and (max-width:1180px)').matches) {
        document.body.dataset.drawer = 'open';
      }
    }

    _flash(pairs) { this.screen.flash(pairs); }

    _remove(who, kind) {
      const s = this.store.state;
      const prev = { list: s.constraints, sel: s.selected };
      const r = K.constraints.apply(s.constraints, { type: 'remove', who, kind });
      this._lastChanged = r.changed;
      const patch = { constraints: r.list };
      // selected は据え置く: 消えた層の既定値が同じ (who,kind) のチップとして選択を引き継ぐ。
      // ただし相手側の制約がこれで全部消えたときは、存在しない側を指さないよう握り直す
      const sel = parseSel(s.selected);
      if (sel && sel.who === 'opp' && !r.list.some(e => e.who === 'opp')) {
        const last = [...r.list].reverse().find(e => e.who === 'me') || r.list[r.list.length - 1];
        patch.selected = last ? `${last.who}.${last.kind}` : 'me.castle';
      }
      this.store.set(patch);
      // 明示 → 既定値（既定の層）へ戻った層を、チップの破線への移行で示す（U5）
      const pre = K.constraints.sides(prev.list)[who];
      const post = K.constraints.sides(r.list)[who];
      if (pre && post) {
        const marks = ['strategy', 'tactic', 'castle'].filter(k =>
          !pre.implied[k] && pre[FIELD[k]] != null && post.implied[k] && post[FIELD[k]] != null);
        if (marks.length) this.bars[who].markImplied(marks.map(k => ({ who, kind: k })));
      }
      // 明示制約の除去も元に戻せるようにする（実効値は既定値に落ちるだけだが選んだ履歴は消える）。
      // L7: 除去で連動した制約の差し替え・除去もあわせて通知する。文言は「層 前→後」の短い形に揃える
      const had = prev.list.find(e => e.who === who && e.kind === kind);
      if (K.Toast && had) {
        const parts = [{ who, kind, from: had.id, dropped: true }, ...r.changed].map(c => this._toastPart(c));
        K.Toast.show(parts.join('、'), {
          host: this.els.stage,
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
        K.Toast.show(`${who === 'opp' ? '相手' : '自分'}の制約を外しました`, {
          host: this.els.stage,
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
        K.Toast.show('制約をすべて外しました', {
          host: this.els.stage,
          action: { label: '元に戻す', fn: () => { this._lastChanged = null; this.store.set({ constraints: prev.list, selected: prev.sel }); } },
        });
      }
    }

    /** 「相手を加える」（詳細の .mu-open）: 相手の戦略を既定制約として足し、相手を選択する */
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
     *  理由のマスと「動く予定の駒」のマスを盤に示す。
     *  同じ候補の連続発火は捨て、評価は rAF で1フレームにまとめる（S6） */
    _preview(who, kind, id) {
      const key = `${who}|${kind}|${id}`;
      if (this._pvKey === key && this._pvRaf) return;
      this._pvKey = key;
      if (this._pvRaf) cancelAnimationFrame(this._pvRaf);
      this._pvRaf = requestAnimationFrame(() => { this._pvRaf = null; this._previewNow(who, kind, id); });
    }

    _previewNow(who, kind, id) {
      const s = this.store.state;
      // 評価は constraints.evaluate に一本化（S3: preview→judge。judge の土台は
      // 「候補を置いた後」の側＝その側が空でも候補から戦略が推論される）
      const { pv, j } = K.constraints.evaluate(s.constraints, who, kind, id);
      this._flash(pv.changed.map(c => ({ who: c.who, kind: c.kind })));
      const Sp = K.constraints.sides(pv.list);
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
      // 「連動: 層 前→後」の短い形に揃える（相手側は「相手の」を頭に付ける。
      // 理由の詳細は詳細パネルで読めるのでトーストには畳まない）
      const msg = `連動: ${changed.map(c => this._toastPart(c)).join('、')}`;
      K.Toast.show(msg, {
        host: this.els.stage,
        action: {
          label: '元に戻す',
          fn: () => { this._lastChanged = null; this.store.set({ constraints: prev.list, selected: prev.sel }); },
        },
      });
    }

    // ---------- 画面遷移 ----------
    enter(state) { this.update(state, new Set(['initial', ...Object.keys(state)])); }

    leave() {
      this.playback.stop();
      this.board.setLasting([], null);
      this.overlay.clear();
      this._flash(null);
      if (K.Toast) K.Toast.hide();
    }

    /** 描画は BoardScreen に委譲し、戻りの導出 vm で左ドックを更新する */
    update(state, changed) {
      const d = this.screen.update(state, changed, this._lastChanged);
      const hard = changed.has('initial');
      if (hard || changed.has('constraints') || changed.has('showThreat') || changed.has('dock')
          || changed.has('play')) {
        this.dock.update(state, d.S);
      }
    }

    // ---------- 再生（状態は store.play。ボタンは play が消えると描き直される） ----------
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
      } else if (this.playback.playing) this.playback.stop();
      else {
        this._lastChanged = null;  // 再生中の差し替え表示は連動ではないので、詳細の連動ノートは消す
        this.playback.start(sel.who, list);
      }
    }

    _paintPlayBtn(playing) {
      this.els.playBtn.textContent = reducedMotion() ? '次の戦法へ' : playing ? '停止' : '順に再生';
      this.els.playBtn.setAttribute('aria-pressed', playing);
    }

    // ---------- キーボード（U3） ----------
    _onKey(e) {
      if (document.body.dataset.view !== 'board') return;
      // Esc はトーストとホバー予告を閉じる（U2）
      if (e.key === 'Escape') {
        if (K.Toast) K.Toast.hide();
        this._flash(null);
        this.board.hover([], null);
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey || /input|textarea|select/i.test(e.target.tagName)) return;
      if (!e.key.startsWith('Arrow')) return;
      // 矢印の役割はフォーカスのある部品の中で閉じる（U3）。制約バー・ドック・周期表・
      // 詳細は各部品が処理するので、盤（中央）にフォーカスがあるときだけ
      // 「選択中の制約の隣の候補へ」が効く。フォーカスが無いときも中央扱いにする
      const ae = document.activeElement;
      const central = !ae || ae === document.body || ae === document.documentElement
        || ae.closest('.boardwrap, .boardarea');
      if (!central) return;
      const sel = parseSel(this.store.state.selected);
      if (!sel) return;
      const S = K.constraints.sides(this.store.state.constraints);
      const st = S[sel.who] || S.me;
      // 移動先は keyboard-nav.js の純関数（S6）
      const next = K.keyboardNav.arrowTarget(sel, st, { rows: this.rows, repo: this.repo }, e.key);
      if (next) { e.preventDefault(); this._set(sel.who, next.kind, next.id); }
    }
  }

  K.ConstraintMode = ConstraintMode;
})();
