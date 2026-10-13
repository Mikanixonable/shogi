// 対局図（唯一の画面）のコントローラ（計画書 S6 の ConstraintController）:
// コマンド（スロットの選択・解除・相手の表示・リセット）とホバー予告、トーストを持つ。
// 描画は board-screen.js の BoardScreen、盤上の矢印は keyboard-nav.js、
// 再生は tactic-playback.js（store.play）へ分けた。
//   - 盤: constraints.sides() の両側を compose.position/merge で合成。相手の表示が OFF のときは後手を描かない
//   - 制約バー: 各側の戦法・囲いのチップ（×で解除・クリックで選択）＋既定の層＋導出ラベル（戦型）
//   - 左ドック: 自分／相手のタブで1枚の面を切り替える DockView。選択はすべてスロットの置き換え
//     （他の層は自動では変わらない。両立しないものは✕と理由で示す）
//   - 右ドック（U5）: BoardDetailView が selected の {who,kind} に応じて detail-sections の部品を組み立てる
//   - 戦法の選択は左ドックの筋タイル（1〜9筋にプロット）。盤の上に別の表は置かない
//   - state.selected だけの変更では盤の駒を再描画しない（オーバーレイ・詳細だけ更新）
// 盤面の状態（slots・showOpp・selected）は URL ハッシュが正で、履歴に積まれる（hash-link.js）。
// 計画書 §1-3/§3-3/§4-5/§5
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';
  const K = window.Kakoi;
  const { mirrorSq } = K.notation;
  const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const parseSel = K.constraints.parseSel;

  class ConstraintMode {
    /**
     * @param {{ repo:Kakoi.Repository, store:Kakoi.Store, board:Kakoi.BoardView, overlay:Kakoi.OverlayView, els:object }} deps
     *   els: stage, bandOpp, bandMe, barOpp, barMe, nameOpp, subOpp, nameMe, subMe,
     *        legend, handOpp, handMe, playBtn, showOpp, boardwrap, rail, detail
     */
    constructor({ repo, store, board, overlay, els }) {
      Object.assign(this, { repo, store, board, overlay, els });
      this.rows = K.tacticNav.tacticRows(repo.tacticFamilies(), repo.tactics());
      this._pvKey = null;
      this._pvRaf = null;

      // 制約バーは盤の上（相手）と下（自分）の2本
      const barHandlers = {
        onSelect: (w, k) => this._select(w, k),
        onRemove: (w, k) => this._remove(w, k),
      };
      this.bars = {
        opp: new K.ConstraintBar(els.barOpp, { who: 'opp', ...barHandlers }),
        me: new K.ConstraintBar(els.barMe, { who: 'me', ...barHandlers }),
      };
      // 左ドック: 自分／相手のタブで切り替える1枚の面。見ている側・層は state.selected が持つ
      this.dock = new K.DockView(els.rail /* #pickRail */, {
        onSelect: (w, k) => this._select(w, k),
        onChoose: (w, k, id) => this._set(w, k, id),
        onClear: w => this._clearSide(w),
        onPreview: (w, k, id) => this._preview(w, k, id),
        onPreviewEnd: () => {
          this._pvKey = null;
          if (this._pvRaf) { cancelAnimationFrame(this._pvRaf); this._pvRaf = null; }
          this.board.hover([], null);
        },
      });
      // 右ドック（U5）: selected の種類に応じて部品を組み立てる自己完結ビュー。
      // Repository は共有のものを渡す（S5: 内部で作り直さない）
      this.detail = new K.BoardDetailView(els.detail, {
        repo: this.repo,
        onHover: (sqs, tone) => this.board.hover(sqs, tone),
        onAttack: attackId => this.store.set({ attackId }),
        onSetConstraint: (w, k, id) => this._set(w, k, id),
      });
      // 再生（S6）: 状態は store.play（非永続）に昇格。ボタンの見た目だけここで面倒を見る
      this.playback = new K.TacticPlayback(store, {
        onChange: playing => this._paintPlayBtn(playing),
      });
      // 「見える半分」は BoardScreen に委譲（S6）
      this.screen = new K.BoardScreen({
        els, board, overlay,
        bars: this.bars, detail: this.detail,
        repo, rows: this.rows, playback: this.playback,
        nameOf: (w, k, id) => K.lookup.nameOf(k, id),
      });
      els.playBtn.addEventListener('click', () => this._onPlay());
      els.showOpp.addEventListener('change', () => this._setShowOpp(els.showOpp.checked));
      document.addEventListener('keydown', e => this._onKey(e));
    }

    // ---------- スロットの操作（他の層は自動では変わらない） ----------
    _set(who, kind, id) {
      const s = this.store.state;
      this.store.set({
        slots: K.constraints.setSlot(s.slots, who, kind, id),
        selected: `${who}.${kind}`, dockTab: kind,
      });
      this._openDrawer();
    }

    _select(who, kind) {
      this.store.set({ selected: `${who}.${kind}`, dockTab: kind });
      // 中くらいの幅では右ドックはドロワー。制約チップを選んだら開く（§4-6）
      this._openDrawer();
      // 左ドックも連動する（U5: 選んだ側・層の一覧で項目までスクロールして送る）
      const s = this.store.state;
      this.dock.reveal(kind, K.constraints.sides(s.slots, s.showOpp)[who]);
    }

    _openDrawer() {
      if (matchMedia('(min-width:980px) and (max-width:1180px)').matches) {
        document.body.dataset.drawer = 'open';
      }
    }

    // 選択を保ったまま1つ外す。外したあとは戦略既定値の既定チップに変わる
    _remove(who, kind) {
      this.store.set({ slots: K.constraints.setSlot(this.store.state.slots, who, kind, null) });
    }

    /** ドックの「はずす」: 見ている側の戦法・囲いを両方外す。履歴に積むので「戻る」で元に戻せる */
    _clearSide(who) {
      const s = this.store.state;
      const slots = K.constraints.clearSide(s.slots, who);
      if (slots === s.slots) return;
      this.store.set({ slots });
      this._toastUndo(`${who === 'opp' ? '相手' : '自分'}の戦法・囲いを外しました`);
    }

    /** 相手の表示 ON/OFF（スロットは消さない）。OFF にしたとき選択が相手側なら自分側へ戻す */
    _setShowOpp(on) {
      const s = this.store.state;
      this.store.set({ showOpp: on, selected: K.constraints.normalizeSelected(s.selected, on) });
    }

    /** 表示設定の「リセット」: 盤面の状態を初期状態へ（ハッシュが空になる。表示の好みは残す） */
    reset() {
      const s = this.store.state;
      if (!s.showOpp && !hasAny(s.slots)) return;
      this.playback.stop();
      this.store.set({
        slots: K.constraints.emptySlots(), showOpp: false, attackId: null,
        selected: K.constraints.normalizeSelected(null, false, s.dockTab),
      });
      this._toastUndo('盤を初期状態に戻しました');
    }

    // 元に戻す: 盤面の変更は履歴に積まれるので、ブラウザの「戻る」と同じ
    _toastUndo(text) {
      if (K.Toast) K.Toast.show(text, { host: this.els.stage, action: { label: '元に戻す', fn: () => history.back() } });
    }

    /** ホバー予告（§3-3）: 理由のマスと「動く予定の駒」のマスを盤に示す。
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
      // 評価は constraints.evaluate に一本化（S3: judge の土台は「候補を置いた後」の側＝
      // その側が空でも候補から戦略が導かれる）
      const { next, j } = K.constraints.evaluate(s.slots, s.showOpp, who, kind, id);
      const mir = who === 'opp';
      // 理由マスは sente 座標で返るので、相手側は絶対座標に反転する（駒差分と同じ扱い）
      const sq = new Set((j.reasons || []).flatMap(x => x.squares || [])
        .map(q => mir ? mirrorSq(q) : q));
      // 動く予定の駒のマス（§3-3）: いまの実効局面と候補の合成局面を比べて、
      // core/lead の駒が増減・移動するマスを拾う（相手側は絶対座標に反転する）
      const cur = K.constraints.sides(s.slots, s.showOpp)[who];
      const after = K.constraints.sides(next, s.showOpp)[who];
      const posOf = x => K.compose.position({
        strategy: x.strategy, tacticId: x.tacticId, castleId: x.castleId, side: 'sente',
      }).position;
      const a = posOf(cur), b = posOf(after);
      for (const x of [...a.pieces, ...b.pieces]) {
        if (x.role !== 'core' && x.role !== 'lead') continue;
        const ya = a.at(x.f, x.r), yb = b.at(x.f, x.r);
        if ((ya && ya.p) !== (yb && yb.p)) sq.add(mir ? mirrorSq(`${x.f}${x.r}`) : `${x.f}${x.r}`);
      }
      this.board.hover([...sq], j.level === 'ng' ? 'bad' : 'focus');
    }

    // ---------- 画面遷移 ----------
    enter(state) { this.update(state, new Set(['initial', ...Object.keys(state)])); }

    /** 描画は BoardScreen に委譲し、戻りの導出 vm で左ドックを更新する */
    update(state, changed) {
      const d = this.screen.update(state, changed);
      const hard = changed.has('initial');
      if (hard || changed.has('slots') || changed.has('selected') || changed.has('showOpp')
          || changed.has('play')) {
        this.dock.update(state, d.S);
      }
    }

    // ---------- 再生（状態は store.play。ボタンは play が消えると描き直される） ----------
    _tacticListFor(who) {
      const s = this.store.state;
      const st = K.constraints.sides(s.slots, s.showOpp)[who];
      return this.rows.filter(r => r.family.side === st.strategy).flatMap(r => r.tactics);
    }

    _onPlay() {
      const sel = parseSel(this.store.state.selected);
      if (!sel || sel.kind !== 'tactic') return;
      const list = this._tacticListFor(sel.who);
      if (reducedMotion()) {
        const s = this.store.state;
        const st = K.constraints.sides(s.slots, s.showOpp)[sel.who];
        const i = list.findIndex(t => t.id === (st && st.tacticId));
        if (list.length) this._set(sel.who, 'tactic', list[(i + 1 + list.length) % list.length].id);
      } else if (this.playback.playing) this.playback.stop();
      else this.playback.start(sel.who, list);
    }

    _paintPlayBtn(playing) {
      this.els.playBtn.textContent = reducedMotion() ? '次の戦法へ' : playing ? '停止' : '順に再生';
      this.els.playBtn.setAttribute('aria-pressed', playing);
    }

    // ---------- キーボード（U3） ----------
    _onKey(e) {
      // Esc はトーストとホバー予告を閉じる（U2）
      if (e.key === 'Escape') {
        if (K.Toast) K.Toast.hide();
        this.board.hover([], null);
        return;
      }
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || /input|textarea|select/i.test(e.target.tagName)) return;
      if (!e.key.startsWith('Arrow')) return;
      // 矢印の役割はフォーカスのある部品の中で閉じる（U3）。制約バー・ドック・
      // 詳細は各部品が処理するので、盤（中央）にフォーカスがあるときだけ
      // 「選択中の制約の隣の候補へ」が効く。フォーカスが無いときも中央扱いにする
      const ae = document.activeElement;
      const central = !ae || ae === document.body || ae === document.documentElement
        || ae.closest('.boardwrap, .boardarea');
      if (!central) return;
      const sel = parseSel(this.store.state.selected);
      if (!sel) return;
      const s = this.store.state;
      const st = K.constraints.sides(s.slots, s.showOpp)[sel.who];
      // 移動先は keyboard-nav.js の純関数（S6）
      const next = K.keyboardNav.arrowTarget(sel, st, { rows: this.rows, repo: this.repo }, e.key);
      if (next) { e.preventDefault(); this._set(sel.who, next.kind, next.id); }
    }
  }

  const hasAny = slots => ['me', 'opp'].some(w => K.constraints.KINDS.some(k => slots[w][k] != null));

  K.ConstraintMode = ConstraintMode;
})();
