// 統合画面の「見える半分」（計画書 S6 の BoardScreen）: 盤の駒レイヤ・重ね表示・
// 盤の上の帯・制約バー・右ドックへの描画をまとめる。スロットの読み書き
// （コマンド・ホバー予告）は constraint-mode.js のコントローラが持つ。
// 導出は core/board-model.js の deriveBoard に一本化（S5）。
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';
  const K = window.Kakoi;
  const { parsePieces, KAN, mirrorSq } = K.notation;
  const parseSel = K.constraints.parseSel;
  // 主役の駒の筋道（経路が2マス以上）がある戦法は矢印で示す。
  const hasArrow = t => !!(t && t.route && t.route.length > 1 && t.lead);

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
          p: x.p, ...(mirror ? K.notation.mirrorPt(x) : { f: x.f, r: x.r }),
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
        this._paintRelationships(state, d);
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

    // ---------- 制約バー（盤の上に相手・自分の2本） ----------
    // marks: 層ごとの「相手との相性」（compat.judge().vs）。バーが盤に向く辺に ◎/△ を出す
    _barMarks(state, d, who) {
      const st = d.S[who];
      const other = who === 'me' ? (state.showOpp ? d.S.opp : null) : d.S.me;
      const m = {};
      for (const kind of ['tactic', 'castle']) {
        const id = st[K.lookup.FIELD[kind]];
        if (id == null) continue;
        const j = K.compat.judge(st, kind, id, other);
        const lv = j.vs && j.vs.level;
        m[kind] = lv === 'good' || lv === 'bad' ? lv : null;
      }
      return m;
    }
    _paintBar(state, d) {
      const common = { selected: state.selected, nameOf: this._nameOf };
      this.bars.opp.render({ ...common, st: state.showOpp ? d.S.opp : null, ng: d.ng.opp, marks: this._barMarks(state, d, 'opp') });
      this.bars.me.render({ ...common, st: d.S.me, ng: d.ng.me, marks: this._barMarks(state, d, 'me') });
    }

    _paintRelationships(state, d) {
      const labels = state.showOpp ? d.labels : [];
      const host = this.els.relations;
      host.dataset.empty = String(!labels.length);
      host.setAttribute('aria-hidden', String(!labels.length));
      host.replaceChildren(...labels.map(({ label }) => {
        const chip = document.createElement('span');
        chip.className = 'relation-chip';
        chip.textContent = `#${label}`;
        chip.title = `対局の関係: ${label}`;
        return chip;
      }));
    }

    // ---------- 盤の上の帯（側の表示＋制約バー）・持ち駒 ----------
    // 伝統的な記法の持ち駒: 主語（▲/△）＋駒＋二枚以上は漢数字（歩二・香 など）
    _handText(pos, mark) {
      const h = (pos && pos.hand) || [];
      if (!h.length) return '';
      const cnt = new Map();
      for (const p of h) cnt.set(p, (cnt.get(p) || 0) + 1);
      return mark + [...cnt.entries()].map(([p, n]) => p + (n > 1 ? KAN[n] : '')).join(' ');
    }

    _paintStage(state, d) {
      const e = this.els;
      const sel = parseSel(state.selected);
      const hasOpp = !!state.showOpp;
      // 帯は盤の上に2行（上から相手→自分）。相手 OFF の間も行トラックは残して盤の矩形を
      // 固定し、相手の帯はフェードで出し入れする（F1）。表示 ON/OFF は左ドックの駒の見出しで行う
      e.bandOpp.dataset.empty = hasOpp ? 'false' : 'true';
      if (!hasOpp) e.bandOpp.dataset.sel = 'false';

      for (const who of ['me', 'opp']) {
        if (who === 'opp' && !hasOpp) continue;
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
