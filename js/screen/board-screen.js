// 統合画面の「見える半分」（計画書 S6 の BoardScreen）: 盤の駒レイヤ・重ね表示・
// 盤の上の帯・制約バー・右 detail への描画をまとめる。スロットの読み書き
// （コマンド・ホバー予告）は controller.js のコントローラが持つ。
// 導出は core/derive-board.js の deriveBoard に一本化（S5）。
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
     *   field:Kakoi.ConstraintField,
     *   detail:Kakoi.DetailView,
     *   repo:Kakoi.Repository, rows:Array,
     *   nameOf:(who:string,kind:string,id:string)=>string }} deps
     */
    constructor({ els, board, overlay, field, detail, repo, rows, nameOf }) {
      Object.assign(this, { els, board, overlay, field, detail, repo, rows });
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
      // 王手飛車の筋（両軍の合成局面で。相手は表示しているときだけ）
      if (K.tesuji) {
        const pos = d.merged.position;
        d.forks = {
          me: K.tesuji.forks(pos, 'sente', { latent: true }),
          opp: state.showOpp ? K.tesuji.forks(pos, 'gote', { latent: true }) : [],
        };
      }
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
        tesuji: (a.tesuji || []),   // 図示したい手筋への参照（囲い側 attacks[].tesuji）
        showPieces: !state.showOpp,
        defenses: this._defenses(state, st, a, mirror),
      };
    }

    // 選択中の攻め筋に対する受けの手筋（底歩）。囲いの側の局面（先手視点）で求め、相手側は反転する
    _defenses(state, st, attack, mirror) {
      const list = (K.TESUJI || []).filter(t => (t.counters || []).includes(attack.id));
      if (!list.length || !K.tesuji) return [];
      const pos = K.compose.build({
        strategy: st.strategy, tacticIds: st.tacticIds, castleId: st.castleId, side: 'sente',
      }).position;
      return list.map(t => {
        // 受けの位置を求める関数は手筋ごとの登録表 K.tesuji.defenders[id]（§5-4。sokofu 固定の解消）
        const fn = K.tesuji.defenders && K.tesuji.defenders[t.id];
        const r = fn ? fn(pos, attack) : null;
        return r && {
          tesuji: t, sq: mirror ? mirrorSq(r.sq) : r.sq, mark: mirror ? '△' : '▲',
          kinzoko: r.kinzoko, nifu: r.nifu, on: state.defense === t.id,
        };
      }).filter(Boolean);
    }

    // 選択中の囲いの急所のマス（onCastle.weak → K.tesuji.weakSquares。相手の囲いなら反転）
    _castleWeak(state, S) {
      const sel = parseSel(state.selected);
      if (!sel || sel.kind !== 'castle' || !K.tesuji || !K.tesuji.weakSquares) return [];
      const st = S[sel.who];
      const castle = st && st.castleId ? this.repo.byId(st.castleId) : null;
      if (!castle) return [];
      const ws = K.tesuji.weakSquares(castle);
      return sel.who === 'opp' ? ws.map(mirrorSq) : ws;
    }

    // 駒レイヤに効く入力だけを見る（selected の変更では再描画しない。急所は囲い id で決まる）
    _renderKeyOf(state, d, attack) {
      const { S } = d;
      return JSON.stringify({
        me: [S.me.strategy, S.me.tacticIds, S.me.castleId],
        opp: state.showOpp ? [S.opp.strategy, S.opp.tacticIds, S.opp.castleId] : null,
        heat: !!state.heat,
        atk: attack ? [attack.who, attack.attack.id, !!state.showOpp] : 0,
        def: attack ? attack.defenses.filter(x => x.on).map(x => x.sq) : 0,
      });
    }

    update(state, changed) {
      const d = this._compute(state);
      const attack = this._attackInfo(state, d.S);
      const weak = this._castleWeak(state, d.S);
      const hard = changed.has('initial');
      const key = this._renderKeyOf(state, d, attack);
      const redraw = key !== this._renderKey;
      if (hard || redraw) {
        this._renderKey = key;
        this._renderBoard(state, d, attack, weak, !hard && changed.has('slots'));
      } else if (changed.has('mode')) {
        this.board.setMode(state.mode);
      }
      // 脅威の帯スイッチは駒レイヤに触らず、重ね表示だけ更新する
      if (!redraw && changed.has('showThreat')) this._overlays(state, d);

      if (hard || changed.has('slots') || changed.has('selected') || changed.has('showOpp')
          || changed.has('attackId') || changed.has('showThreat') || changed.has('defense')) {
        this._paintField(state, d);
        this._paintStage(state, d);
        this._renderDetail(state, d);
      }
      return d;   // 呼び出し側（コントローラ）が rail.update などに使う
    }

    // 盤の駒レイヤ＋重ね表示。selected のみの更新では来ない
    _renderBoard(state, d, attack, weak, animate) {
      const { S, merged } = d;
      // 受けの手筋を押しているときは、手筋の駒を盤に置く（主役の駒と同じ朱で強調）
      const defPieces = attack ? attack.defenses.filter(x => x.on).map(x => ({
        p: x.tesuji.piece, f: +x.sq[0], r: +x.sq[1], owner: attack.who === 'opp' ? 'gote' : 'sente', role: 'lead',
      })) : [];
      const position = attack && (attack.showPieces || defPieces.length)
        ? new K.Position([...merged.position.pieces, ...(attack.showPieces ? attack.pieces : []), ...defPieces],
          [...merged.position.hand])
        : merged.position;
      const heat = state.heat
        ? K.attackMap(position, x => x.role === 'core' || x.role === 'lead')
        : null;
      this.board.setLasting([
        ...merged.contacts.filter(c => c.kind === 'ng').map(c => c.sq),
        ...(attack ? attack.target : []),
        ...(weak || []),   // この囲いの急所（onCastle.weak）を朱で示す（§5-8）
      ], 'bad');
      // 自分の戦法が変わったときは主役の駒を経路どおりに滑らせる（旧戦法画面と同じ。
      // 複数採用では主の戦法=飛車優先を動かす）
      const meT = this.repo.tacticById(K.defaults.primaryOf(S.me));
      const trace = animate && meT && this._meTactic !== meT.id && meT.route && meT.route.length > 1
        ? { square: meT.lead.square, piece: meT.lead.piece, path: meT.route } : null;
      this._meTactic = meT ? meT.id : null;
      this.board.render(position, { mode: state.mode, heat, animate, trace });
      this._overlays(state, d);
    }

    _overlays(state, d) {
      const { S, merged, threat } = d;
      const ov = this.overlay;
      // 脅威の帯は相手を表示しているときだけ（表示設定の showThreat で切り替える）
      ov.threat(state.showThreat !== false && threat ? threat.threatFiles : null);
      // 採用した全戦法の主役の経路を引く（自分=墨・相手=朱）
      const routes = [
        ...S.me.tacticIds.map(id => this.repo.tacticById(id))
          .filter(hasArrow).map(t => ({ squares: t.route, tone: 'ink' })),
        ...(state.showOpp ? S.opp.tacticIds.map(id => this.repo.tacticById(id)) : [])
          .filter(hasArrow).map(t => ({ squares: t.route.map(mirrorSq), tone: 'bad' })),
      ];
      ov.routes(routes.length ? routes : null);
      ov.contacts(merged.contacts.length
        ? merged.contacts.map(c => ({ sq: c.sq, kind: c.kind }))
        : null);
      // 王手飛車の筋: 自分が狙われる筋は朱、相手を狙える筋は緑
      if (d.forks) {
        ov.forks([
          ...d.forks.me.map(x => ({ ...x, tone: 'bad' })),
          ...d.forks.opp.map(x => ({ ...x, tone: 'good' })),
        ]);
      }
    }

    // ---------- 制約フィールド（盤の上の1枚の蜂の巣。両側を同じグリッドに並べる） ----------
    // marks: 層ごとの「相手との相性」（compat.judge().vs）。戦法は id ごと。
    //   自分の戦法の胞と相手の囲いの胞が河を隔てて共有する辺に ◎（緑）/△（赤）を出す
    _fieldMarks(state, d, who) {
      const st = d.S[who];
      const other = who === 'me' ? (state.showOpp ? d.S.opp : null) : d.S.me;
      const m = { tactic: {}, castle: null };
      for (const id of st.tacticIds) {
        const j = K.compat.judge(st, 'tactic', id, other);
        const lv = j.vs && j.vs.level;
        m.tactic[id] = lv === 'good' || lv === 'bad' ? lv : null;
      }
      if (st.castleId != null) {
        const j = K.compat.judge(st, 'castle', st.castleId, other);
        const lv = j.vs && j.vs.level;
        m.castle = lv === 'good' || lv === 'bad' ? lv : null;
      }
      return m;
    }
    _paintField(state, d) {
      this.field.render({
        S: d.S, slots: state.slots, ng: d.ng,
        marks: { me: this._fieldMarks(state, d, 'me'), opp: this._fieldMarks(state, d, 'opp') },
        labels: state.showOpp ? d.labels : [],
        selected: state.selected, showOpp: state.showOpp, nameOf: this._nameOf,
      });
    }

    // ---------- 持ち駒（盤の左右。伝統的な記法: 主語＋駒＋二枚以上は漢数字） ----------
    _handText(pos, mark) {
      const h = (pos && pos.hand) || [];
      if (!h.length) return '';
      const cnt = new Map();
      for (const p of h) cnt.set(p, (cnt.get(p) || 0) + 1);
      return mark + [...cnt.entries()].map(([p, n]) => p + (n > 1 ? KAN[n] : '')).join(' ');
    }

    _paintStage(state, d) {
      const e = this.els;
      // 持ち駒は盤の左右（相手=左・自分=右）
      e.handMe.textContent = this._handText(d.mePos.position, '▲');
      e.handOpp.textContent = d.oppPos ? this._handText(d.oppPos.position, '△') : '';
    }

    // ---------- 右 detail（U5）: selected の種類に応じた組み立ては DetailView に委譲 ----------
    // 選んだ層が他の層と両立しないときは、理由と直す候補（constraints.suggest）も渡す
    _renderDetail(state, d) {
      const sel = parseSel(state.selected) || K.constraints.DEFAULT_SEL;
      const attack = this._attackInfo(state, d.S);
      // 戦法は駒ごとの枠: 選択中の駒枠（無ければ主の戦法）の ng を取る
      const tacId = sel.id || K.defaults.primaryOf(d.S[sel.who]);
      const ng = sel.kind === 'tactic'
        ? ((d.ng[sel.who].tactic || {})[tacId] || null)
        : (d.ng[sel.who][sel.kind] || null);
      this.detail.render({
        sel: sel.id ? sel : { who: sel.who, kind: sel.kind, id: sel.kind === 'tactic' ? tacId : undefined },
        st: d.S[sel.who],
        S: d.S,
        showOpp: state.showOpp,
        threat: d.threat,
        attackId: state.attackId,
        contacts: d.merged.contacts,   // merge 済みの接触を共有する（S5: 再計算しない）
        defenses: sel.kind === 'castle' && attack ? attack.defenses : [],
        forks: (sel.kind === 'tactic' || sel.kind === 'castle') ? {
          list: (d.forks && d.forks[sel.who]) || [], attacker: sel.who === 'me' ? '△' : '▲', mine: sel.who === 'me',
        } : null,
        ng,
        suggest: ng ? K.constraints.suggest(state.slots, state.showOpp, sel.who, sel.kind, 6,
            sel.kind === 'tactic' ? tacId : null)
          .map(id => ({ id, name: this._nameOf(sel.who, sel.kind, id) })) : [],
      });
    }
  }

  K.BoardScreen = BoardScreen;
})();
