// 統合画面の「見える半分」（計画書 S6 の BoardScreen）: 盤の駒レイヤ・重ね表示・
// 盤の上下の帯・制約バー・右ドックへの描画をまとめる。制約の読み書き
// （コマンド・元に戻す・ホバー予告）は constraint-mode.js のコントローラが持つ。
// 導出は core/board-model.js の deriveBoard に一本化（S5）。state.play（再生中の
// 表示専用の差し替え）は制約を書き換えずに実効戦法だけを変える（§4-5）
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';
  const K = window.Kakoi;
  const { parsePieces, KAN, mirrorSq } = K.notation;
  const FIELD = K.constraints.FIELD;
  const { LAYER_JA } = K.lookup;
  const parseSel = K.constraints.parseSel;
  // 主役が飛車ではなく筋道（経路が2マス以上）のある戦法だけ矢印を引く。
  // 飛車の経路は盤の筋そのものなので矢印が冗長（駒の移動アニメ trace は残す）
  const hasArrow = t => !!(t && t.route && t.route.length > 1 && t.lead && t.lead.piece !== '飛');

  class BoardScreen {
    /**
     * @param {{ els:object, board:Kakoi.BoardView, overlay:Kakoi.OverlayView,
     *   bars:{opp:Kakoi.ConstraintBar, me:Kakoi.ConstraintBar},
     *   detail:Kakoi.BoardDetailView,
     *   repo:Kakoi.Repository, rows:Array, playback:Kakoi.TacticPlayback,
     *   nameOf:(who:string,kind:string,id:string)=>string }} deps
     */
    constructor({ els, board, overlay, bars, detail, repo, rows, playback, nameOf }) {
      Object.assign(this, { els, board, overlay, bars, detail, repo, rows, playback });
      this._nameOf = nameOf;
      this._renderKey = null;
      this._meTactic = null;
      this._stageKeys = {};
      this._skKey = null;
      this._derived = null;
    }

    // ---------- 合成（導出は deriveBoard に一本化。S5） ----------
    _compute(state) {
      const list = Array.isArray(state.constraints) ? state.constraints : [];
      // update() のたびに作り直さない: 制約リストの参照と再生差し替えをキーに再利用（S6）
      const p = state.play || null;
      const k = p ? `${p.who}|${p.tacticId}` : '';
      if (this._derived && this._derived.list === list && this._derived.k === k) return this._derived.d;
      const d = K.deriveBoard(list, p ? { tactic: p.tacticId, who: p.who } : {});
      this._derived = { list, k, d };
      return d;
    }

    // 選択中の囲いの攻め筋。相手の制約があるときは後手の駒を置かず、狙われるマスだけ示す（§5）
    _attackInfo(state, S) {
      const sel = parseSel(state.selected);
      if (!sel || sel.kind !== 'castle' || !state.attackId) return null;
      const st = S[sel.who];
      const castle = st && st.castleId ? this.repo.byId(st.castleId) : null;
      const a = castle ? this.repo.attackOf(castle, state.attackId) : null;
      if (!a) return null;
      const mirror = sel.who === 'opp'; // 相手の囲いへの攻め筋は先手（自分）の駒になる
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

    /**
     * 描画の統括。changed に 'play' が入るときは再生中の差し替え＝表示だけの
     * 再描画なので、制約変更と同じ絵の組み立てを走らせる（constraints/attackId 相当）
     * @param {Array|null} lastChanged 直近の apply の changed（詳細の連動ノート用）
     */
    update(state, changed, lastChanged) {
      // 再生差し替えは「制約が変わった」絵として描く（S6: play は非永続の別キー）
      const ch = changed.has('play') ? new Set([...changed, 'constraints', 'attackId']) : changed;
      const d = this._compute(state);
      const attack = this._attackInfo(state, d.S);
      const hard = ch.has('initial');
      const key = this._renderKeyOf(state, d, attack);
      const redraw = key !== this._renderKey;
      if (hard || redraw) {
        this._renderKey = key;
        this._renderBoard(state, d, attack, !hard && ch.has('constraints'));
      } else if (ch.has('mode')) {
        this.board.setMode(state.mode);
      }
      if (!redraw && ch.has('skeleton')) this._skeleton(state, d);
      // 脅威の帯スイッチは駒レイヤに触らず、重ね表示だけ更新する
      if (!redraw && ch.has('showThreat')) this._overlays(state, d);

      if (hard || ch.has('constraints') || ch.has('selected')
          || ch.has('attackId') || ch.has('showThreat')) {
        this._paintBar(state, d);
        this._paintStage(state, d);
        this._renderDetail(state, d, lastChanged);
      }
      return d;   // 呼び出し側（コントローラ）が dock.update などに使う
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
        hasArrow(meT) ? { squares: meT.route, tone: 'ink' } : null,
        hasArrow(oppT) ? { squares: oppT.route.map(mirrorSq), tone: 'bad' } : null,
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
        selected: state.selected, nameOf: this._nameOf,
      };
      this.bars.opp.render({ ...common, labels: null });
      this.bars.me.render({ ...common, labels: d.labels });
    }

    /** 制約チップの点滅（ホバー予告の連動表示） */
    flash(pairs) { this.bars.me.flash(pairs); this.bars.opp.flash(pairs); }

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
      // 帯の行は常に確保する（盤の矩形を動かさない。F1）。相手がいない間、
      // 相手の帯は盤の下で「＋相手を加える」の幽霊行になる
      e.bandOpp.dataset.empty = hasOpp ? 'false' : 'true';
      e.addOpp.hidden = hasOpp;
      e.clearOpp.hidden = !hasOpp;
      if (!hasOpp) {
        const stageKey = 'opp|(なし)';
        if (stageKey !== this._stageKeys.opp) {
          this._stageKeys.opp = stageKey;
          e.nameOpp.textContent = '（相手なし）';
          e.subOpp.textContent = e.subOpp.title = '';
        }
        e.bandOpp.dataset.sel = 'false';
      }

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

      // 凡例は1行に縮める（F4）: 色見本＋短い名札だけにして全文は title に持つ。
      // 盤に出ている要素だけを説明する（飛車が主役の戦法では矢印を引かないので言及もしない）
      const arrow = hasArrow(this.repo.tacticById(S.me.tacticId))
        || (S.opp ? hasArrow(this.repo.tacticById(S.opp.tacticId)) : false);
      e.legend.innerHTML = '<i></i><span class="lg-t">図の見方</span>';
      e.legend.title = d.threat
        ? `朱の帯は相手の攻め筋。${arrow ? '破線は主役の駒の動き（墨＝自分・朱＝相手）。' : ''}枠のマスは両軍の接触`
        : `朱色は囲いの駒と主役の駒${arrow ? '。破線は主役の駒の動き' : ''}`;
      // 持ち駒は盤の左右（相手=左・自分=右）
      e.handMe.textContent = this._handText(d.mePos.position, '▲');
      e.handOpp.textContent = d.oppPos ? this._handText(d.oppPos.position, '△') : '';
      // 「すべてはずす」は中央の最上部=上の帯のヘッダに置く。帯は相手の有無で
      // 上下が入れ替わるので追従させる。各帯自身の「はずす」は常に右端に残し、
      // その左に差し込む（並び: すべてはずす・○○をはずす）
      const topH = (hasOpp ? e.bandOpp : e.bandMe).querySelector('.sband-h');
      const anchor = hasOpp ? e.clearOpp : e.clearMe;
      if (e.clearAll.parentNode !== topH || e.clearAll.nextElementSibling !== anchor) {
        topH.insertBefore(e.clearAll, anchor);
      }
      e.clearAll.hidden = !(state.constraints || []).length;
      const selTactic = sel && sel.kind === 'tactic';
      e.playBtn.hidden = !selTactic;
      if (!selTactic && this.playback.playing) this.playback.stop();
    }

    // ---------- 右ドック（U5）: selected の種類に応じた組み立ては BoardDetailView に委譲 ----------
    _renderDetail(state, d, lastChanged) {
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
        contacts: d.merged.contacts,   // merge 済みの接触を共有する（S5: 再計算しない）
        changed: lastChanged || null,
      });
    }
  }

  K.BoardScreen = BoardScreen;
})();
