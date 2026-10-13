// 統合画面の「見える半分」（計画書 S6 の BoardScreen）: 盤の駒レイヤ・重ね表示・
// 盤の上下の帯・制約バー・右ドックへの描画をまとめる。スロットの読み書き
// （コマンド・ホバー予告）は constraint-mode.js のコントローラが持つ。
// 導出は core/board-model.js の deriveBoard に一本化（S5）。
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
     *   repo:Kakoi.Repository, rows:Array,
     *   nameOf:(who:string,kind:string,id:string)=>string }} deps
     */
    constructor({ els, board, overlay, bars, detail, repo, rows, nameOf }) {
      Object.assign(this, { els, board, overlay, bars, detail, repo, rows });
      this._nameOf = nameOf;
      this._renderKey = null;
      this._meTactic = null;
      this._stageKeys = {};
      this._derived = null;
    }

    // ---------- 合成（導出は deriveBoard に一本化。S5） ----------
    _compute(state) {
      const slots = state.slots;
      // update() のたびに作り直さない: slots の参照と相手の表示をキーに再利用（S6）
      const k = state.showOpp;
      if (this._derived && this._derived.slots === slots && this._derived.k === k) return this._derived.d;
      const d = K.deriveBoard(slots, state.showOpp);
      this._derived = { slots, k, d };
      return d;
    }

    // 選択中の囲いの攻め筋。相手を表示しているときは後手の駒を置かず、狙われるマスだけ示す（§5）
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
        showPieces: !state.showOpp,
      };
    }

    // 駒レイヤに効く入力だけを見る（selected の変更では再描画しない）
    _renderKeyOf(state, d, attack) {
      const { S } = d;
      return JSON.stringify({
        me: [S.me.strategy, S.me.tacticId, S.me.castleId],
        opp: state.showOpp ? [S.opp.strategy, S.opp.tacticId, S.opp.castleId] : null,
        heat: !!state.heat,
        atk: attack ? [attack.who, attack.attack.id, !!state.showOpp] : 0,
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
        this._renderBoard(state, d, attack, !hard && changed.has('slots'));
      } else if (changed.has('mode')) {
        this.board.setMode(state.mode);
      }
      // 脅威の帯スイッチは駒レイヤに触らず、重ね表示だけ更新する
      if (!redraw && changed.has('showThreat')) this._overlays(state, d);

      if (hard || changed.has('slots') || changed.has('selected') || changed.has('showOpp')
          || changed.has('attackId') || changed.has('showThreat')) {
        this._paintBar(state, d);
        this._paintStage(state, d);
        this._renderDetail(state, d);
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
        ? K.attackMap(position, x => x.role === 'core' || x.role === 'lead')
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
      // 脅威の帯は相手を表示しているときだけ（表示設定の showThreat で切り替える）
      ov.threat(state.showThreat !== false && threat ? threat.threatFiles : null);
      const meT = this.repo.tacticById(S.me.tacticId);
      const oppT = state.showOpp ? this.repo.tacticById(S.opp.tacticId) : null;
      const routes = [
        hasArrow(meT) ? { squares: meT.route, tone: 'ink' } : null,
        hasArrow(oppT) ? { squares: oppT.route.map(mirrorSq), tone: 'bad' } : null,
      ].filter(Boolean);
      ov.routes(routes.length ? routes : null);
      ov.contacts(merged.contacts.length
        ? merged.contacts.map(c => ({ sq: c.sq, kind: c.kind }))
        : null);
    }

    // ---------- 制約バー（盤の上=相手・下=自分の2本。導出ラベルは自分側の右端） ----------
    _paintBar(state, d) {
      const common = { selected: state.selected, nameOf: this._nameOf };
      this.bars.opp.render({ ...common, st: state.showOpp ? d.S.opp : null, ng: d.ng.opp, labels: null });
      this.bars.me.render({ ...common, st: d.S.me, ng: d.ng.me, labels: d.labels });
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
      const hasOpp = !!state.showOpp;
      // 相手 OFF 時も行トラックは確保して盤の矩形を固定し、自分の帯を盤の上へ移す（F1）。
      // 表示 ON/OFF は左ドックの駒の見出しで行う
      e.bandOpp.dataset.empty = hasOpp ? 'false' : 'true';
      if (!hasOpp) {
        const stageKey = 'opp|(なし)';
        if (stageKey !== this._stageKeys.opp) {
          this._stageKeys.opp = stageKey;
          e.nameOpp.textContent = '（非表示）';
          e.subOpp.textContent = e.subOpp.title = '';
        }
        e.bandOpp.dataset.sel = 'false';
      }

      for (const who of ['me', 'opp']) {
        const st = S[who];
        if (who === 'opp' && !hasOpp) continue;
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

      // 持ち駒は盤の左右（相手=左・自分=右）
      e.handMe.textContent = this._handText(d.mePos.position, '▲');
      e.handOpp.textContent = d.oppPos ? this._handText(d.oppPos.position, '△') : '';
    }

    // ---------- 右ドック（U5）: selected の種類に応じた組み立ては BoardDetailView に委譲 ----------
    // 選んだ層が他の層と両立しないときは、理由と直す候補（constraints.suggest）も渡す
    _renderDetail(state, d) {
      const sel = parseSel(state.selected) || { who: 'me', kind: 'castle' };
      const ng = d.ng[sel.who][sel.kind] || null;
      this.detail.render({
        sel,
        st: d.S[sel.who],
        S: d.S,
        showOpp: state.showOpp,
        threat: d.threat,
        attackId: state.attackId,
        contacts: d.merged.contacts,   // merge 済みの接触を共有する（S5: 再計算しない）
        ng,
        suggest: ng ? K.constraints.suggest(state.slots, state.showOpp, sel.who, sel.kind)
          .map(id => ({ id, name: this._nameOf(sel.who, sel.kind, id) })) : [],
      });
    }
  }

  K.BoardScreen = BoardScreen;
})();
