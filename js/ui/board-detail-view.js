// 右ドックの組み立て本体（計画書 §5 / U5）: 選択中の制約 {who, kind} の種類に応じて、
// detail-sections（js/ui/detail-sections.js）の部品を組み立てて描く。
//   - *.strategy: 戦略の説明（STRATEGIES[].desc）＋その側の戦法・囲いの要約
//     ＋相手がいれば導出ラベル（戦型）と「どちらからの攻めが主になるか」
//   - *.tactic: 戦法の詳細（タグ・説明・長所短所・主役の駒の動き）＋派生の切替
//     ＋相性のよい囲い（◎/○・いまの囲い・連動の予告）＋相手との相性の相性（judge の vs 軸）
//   - *.castle: 囲いの詳細（ペンタグラム・#タグ・発展・長所短所・攻め筋）。相手がいれば
//     ペンタグラムに戦型の重みを重ね、fitness と効いている軸を表示する
//   - 共通の末尾: 両軍の接触 → 直近の連動 → 出典
// render は self-contained: データは Kakoi.*（CASTLES/TACTICS/…）と内部の Repository で
// 解決し、接触は compose.position/merge をここで引き直す。盤への反映はハンドラ経由。
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';
  const K = window.Kakoi;
  const { esc, makeCiter } = K.html;
  const bindCites = (K.cites && K.cites.bind) || (() => {});   // ui/cites.js（S6 で core から移動）
  const Sec = () => K.detailSections; // 読み込み順に依存しないよう呼び出し時に引く

  const KINDS = ['strategy', 'tactic', 'castle'];
  const { LAYER_JA, findTactic, findCastle, tacticFamilyOf, castleFamilyOf } = K.lookup;
  const WHO_JA = { me: '自分（先手・▲）', opp: '相手（後手・△）' };
  const SHORT_WHO = { me: '自分', opp: '相手' };

  // ---------- データ参照（Kakoi.* 直読み＋内部 Repository） ----------
  const subtypeOf = c => {
    const f = castleFamilyOf(c);
    return (f && (f.subtypes || []).find(s => s.id === c.subtype)) || null;
  };
  const nameOf = (kind, id) => {
    if (id == null) return '（未選択）';
    if (kind === 'strategy') return (K.STRATEGIES[id] && K.STRATEGIES[id].label) || id;
    const x = kind === 'tactic' ? findTactic(id) : findCastle(id);
    return x ? x.name : id;
  };
  const parseSel = K.constraints.parseSel;

  class BoardDetailView {
    /**
     * @param {HTMLElement} el `#detail`（.detail-body）
     * @param {{ onHover:(squares:string[], tone:?string)=>void,
     *   onAttack:(attackId:string|null)=>void,
     *   onSetConstraint:(who:'me'|'opp', kind:'strategy'|'tactic'|'castle', id:string)=>void,
     *   onAddOpponent?:()=>void }} handlers
     *   onHover: data-sq のある要素に乗ったとき盤のマスを光らせる
     *   onAttack: 攻め筋ボタンの選択/解除。onSetConstraint: 囲い行・派生チップで制約を立てる
     *   onAddOpponent: 相手がいないときの「相手を加えて対局図にする」
     */
    constructor(el, handlers = {}) {
      this.el = el;
      this.h = handlers;
      this._sel = { who: 'me', kind: 'castle' };
      this.__repo = null;
      el.addEventListener('mouseover', e => {
        const t = e.target.closest('[data-sq]');
        if (t && handlers.onHover) handlers.onHover(t.dataset.sq.split(' '), t.dataset.tone || 'focus');
      });
      el.addEventListener('mouseout', e => {
        const t = e.target.closest('[data-sq]');
        if (t && !t.contains(e.relatedTarget) && handlers.onHover) handlers.onHover([], null);
      });
      el.addEventListener('click', e => {
        const mu = e.target.closest('[data-act="add-opp"]');
        if (mu) { if (handlers.onAddOpponent) handlers.onAddOpponent(); return; }
        const atk = e.target.closest('.attack');
        if (atk) {
          if (handlers.onAttack) handlers.onAttack(atk.getAttribute('aria-pressed') === 'true' ? null : atk.dataset.id);
          return;
        }
        const c = e.target.closest('[data-act="castle"]');
        if (c) {
          if (handlers.onSetConstraint) handlers.onSetConstraint(this._sel.who, 'castle', c.dataset.id);
          return;
        }
        const s = e.target.closest('[data-act="set"]');
        if (s && handlers.onSetConstraint) {
          handlers.onSetConstraint(s.dataset.who || this._sel.who, s.dataset.kind, s.dataset.id);
        }
      });
      bindCites(el); // 本文の [n] ホバーで出典リストの行を強調
    }

    // ---------- render ----------
    /**
     * @param {{ sel:{who:'me'|'opp', kind:string}|string,
     *   st:Object|null, S:{me:Object, opp:Object|null},
     *   threat:?Object, labels:Array<{id,label}>,
     *   attackId:?string, showThreat?:boolean, constraints:Array,
     *   changed?:Array }} p
     *   sel: 選択中の制約（'who.kind' 文字列も可）
     *   st: その側の constraints.sides() 出力（opp が無いとき null。implied/rank を持つ）
     *   S:  sides() の全体。threat: matchup.threat(S.me, S.opp)（相手がいるとき）
     *   changed: 直近の apply の changed（連動の履歴。無ければ省略）
     */
    render(p = {}) {
      if (!Sec()) {
        this.el.innerHTML = '<p class="note">js/ui/detail-sections.js が読み込まれていません。</p>';
        return;
      }
      const S = p.S || {};
      const sel = (typeof p.sel === 'string' ? parseSel(p.sel) : p.sel)
        || { who: 'me', kind: 'castle' };
      const who = sel.who === 'opp' ? 'opp' : 'me';
      const kind = KINDS.includes(sel.kind) ? sel.kind : 'castle';
      const norm = { who, kind };
      this._sel = norm;
      // st は防御的に: opp が null のとき opp.* が selected になることは正規化で排除される
      const st = p.st !== undefined ? p.st : (S[who] || null);
      const citer = makeCiter();
      const parts = [];
      if (!st) {
        parts.push(this._head(norm, '（なし）', false));
        parts.push(`<p class="note">${who === 'opp'
          ? '相手の制約がまだありません。左ドックで相手を選ぶと説明が出ます。'
          : '制約が選ばれていません。'}</p>`);
      } else {
        const b = kind === 'strategy' ? this._strategy(norm, st, S, p.labels, citer)
          : kind === 'tactic' ? this._tactic(norm, st, S, p.constraints, citer)
          : this._castle(norm, st, S, p.threat, p.attackId, citer);
        parts.push(b.body);
        // 共通の末尾: 両軍の接触 → 直近の連動 → 出典。
        // 接触は呼び出し側の導出（merge 済み）を受け取る。渡されないときだけここで引き直す（S5）
        parts.push(Sec().contacts(
          p.contacts !== undefined ? p.contacts : this._contacts(S, p.constraints), citer));
        parts.push(Sec().history(p.changed, nameOf));
        parts.push(Sec().sources(b.sources, citer));
      }
      this.el.innerHTML = parts.filter(Boolean).join('');
    }

    // ---------- パネル先頭: 側の表示名＋項目名＋既定の層の注記 ----------
    _head(sel, name, implied) {
      return `<div class="bd-h"><p class="bd-who">${WHO_JA[sel.who]}の${LAYER_JA[sel.kind]}</p>` +
        `<h2 class="bd-t">${esc(name)}${implied ? ' <small class="bd-imp">既定</small>' : ''}</h2>` +
        (implied
          ? '<p class="note">明示の制約ではなく、戦略の既定値（または他の制約からの推論）で補っている値です。左ドックで選び直すと制約になります。</p>'
          : '') +
        `</div>`;
    }

    // ---------- *.strategy ----------
    _strategy(sel, st, S, labels, citer) {
      const s = K.STRATEGIES[st.strategy] || null;
      const other = S[sel.who === 'me' ? 'opp' : 'me'] || null;
      const tactic = findTactic(st.tacticId);
      const castle = findCastle(st.castleId);
      // 「どちらからの攻めが主になるか」: その側から見た脅威（opp 選択時は向きを反転して引き直す）
      const th = other && K.matchup ? K.matchup.threat(st, other) : null;
      const mine = SHORT_WHO[sel.who];
      const body = [
        this._head(sel, s ? s.label : '（未選択）', st.implied && st.implied.strategy),
        s && s.desc
          ? Sec().desc(s.desc, citer)
          : '<p class="desc">左の一覧から戦略を選びます。</p>',
        this._sideSummary(st),
        other ? Sec().senkei(labels) : '',
        th ? Sec().distanceNote(th.distance, mine, sel.who === 'me' ? '相手' : '自分') : '',
      ].filter(Boolean).join('');
      return { body, sources: this._tacticSources(tactic, castle) };
    }

    // その側の実効値の要約（戦法・囲い。既定の層は△＋小さい注記）
    _sideSummary(st) {
      const row = (kind, id, implied) =>
        `<li data-level="ok"><span class="mk">${implied ? '△' : '＋'}</span>` +
        `<span>${LAYER_JA[kind]}：${esc(nameOf(kind, id))}${implied ? '<small class="bd-imp">（既定値）</small>' : ''}</span></li>`;
      const items = [
        st.tacticId ? row('tactic', st.tacticId, st.implied && st.implied.tactic) : '',
        st.castleId ? row('castle', st.castleId, st.implied && st.implied.castle) : '',
      ].filter(Boolean).join('');
      return items ? Sec().sec('いまの組み合わせ', 'この側の実効値', `<ul class="mu-reasons">${items}</ul>`) : '';
    }

    // ---------- *.tactic ----------
    _tactic(sel, st, S, constraints, citer) {
      const t = findTactic(st.tacticId);
      if (!t) {
        return {
          body: this._head(sel, '（未選択）', st.implied && st.implied.tactic)
            + '<p class="note">戦法が選ばれていません。左ドックで選びます。</p>',
          sources: [],
        };
      }
      const other = S[sel.who === 'me' ? 'opp' : 'me'] || null;
      const family = tacticFamilyOf(t);
      const castle = findCastle(st.castleId);
      const implied = st.implied && st.implied.tactic;
      // 派生の切替: variantOf の親＋兄弟（親を先頭に、データ順）
      const parentId = t.variantOf || t.id;
      const groupIds = [parentId,
        ...(K.TACTICS || []).filter(x => x.variantOf === parentId).map(x => x.id)];
      const variantRows = groupIds.map(id => {
        const x = findTactic(id);
        return x ? { id, name: x.name, current: id === t.id } : null;
      }).filter(Boolean);
      // 相性のよい囲い: pairings の ng 以外。いまの囲いと、選ぶと連動する層の予告つき
      const rows = this._pairingsOf(t).filter(pp => pp.level !== 'ng').map(pp => ({
        id: pp.castle.id,
        name: pp.castle.name,
        familyName: (castleFamilyOf(pp.castle) || {}).name || '',
        level: pp.level,
        why: pp.why,
        current: pp.castle.id === st.castleId,
        cascade: this._cascadeLabel(constraints, sel.who, 'castle', pp.castle.id),
      }));
      // 相手との相性（against / againstTactic。judge の vs 軸に理由が入っている）
      const j = other && K.compat ? K.compat.judge(st, 'tactic', t.id, other) : null;
      const vsRows = j ? Sec().vsRows(j.vs) : [];
      const body = [
        this._head(sel, t.name, implied),
        Sec().tacticTags(t, family),
        Sec().desc(t.desc, citer),
        Sec().note(t.note, citer),
        family && family.note ? Sec().note(`${family.piece}が主役の理由：${family.note}`, citer) : '',
        Sec().pcList('長所', t.pros, { small: '' }, citer),
        Sec().pcList('短所', t.cons, { cls: 'cons', small: '' }, citer),
        Sec().route(t),
        Sec().variants(variantRows),
        Sec().pairingCastles(rows),
        other && j && j.vs ? Sec().vsSection(vsRows, other === S.me ? '自分' : '相手') : '',
      ].filter(Boolean).join('');
      return { body, sources: this._tacticSources(t, castle) };
    }

    // ---------- *.castle ----------
    // threat（呼び出し側が持つ threat(S.me,S.opp)）はここでは使わず、選択側の向きで引き直す
    _castle(sel, st, S, _threat, attackId, citer) {
      const c = findCastle(st.castleId);
      if (!c) {
        return {
          body: this._head(sel, '（未選択）', st.implied && st.implied.castle)
            + '<p class="note">囲いが選ばれていません。左ドックで選びます。</p>',
          sources: [],
        };
      }
      const other = S[sel.who === 'me' ? 'opp' : 'me'] || null;
      const family = castleFamilyOf(c);
      const subtype = subtypeOf(c);
      const implied = st.implied && st.implied.castle;
      // 相手がいるとき: その側から見た脅威を引き直し（opp の囲いは threat(S.opp,S.me)）、
      // ペンタグラムに戦型の重みを重ね、fitness と効いている軸を出す（§5）
      const th = other && K.matchup ? K.matchup.threat(st, other) : null;
      const fit = th ? K.matchup.fitness(c, th) : null;
      const j = K.compat ? K.compat.judge(st, 'castle', c.id, other) : null;
      // 出典: 囲い＋想定配置に加え、「組み合わせの理由」で出す相性表（pairing.why）の出典も併記する
      // （[[ref]] を本文に引く文を出す以上、その ref はパネルの出典リストに載っている必要がある）
      const tactic = findTactic(st.tacticId);
      const pairing = tactic && (tactic.pairings || []).find(pp => pp.castle === c.id);
      const r0 = this._repo();
      const setupSrc = r0 && r0.setupOf(c) ? r0.setupOf(c).sources : [];
      const sources = this._mergedSources(
        c.sources || [], setupSrc || [], pairing ? pairing.sources || [] : []);
      const body = [
        this._head(sel, c.name, implied),
        !other ? '<button class="mu-open" data-act="add-opp">相手を加えて対局図にする</button>' : '',
        Sec().penta(c.ratings, th
          ? { weights: th.weights, small: '朱の破線＝この戦型で効く軸' }
          : {}),
        fit != null ? Sec().fitness(fit, th, c) : '',
        Sec().castleTags(c, family, subtype),
        Sec().refFamily(c.refFamily),
        Sec().desc(c.desc, citer),
        Sec().note(c.note, citer),
        Sec().coreChips(c),
        Sec().lineage(this._lineageOf(c)),
        Sec().pcList('長所', c.pros, { tone: 'good' }, citer),
        Sec().pcList('短所', c.cons, { tone: 'bad', cls: 'cons' }, citer),
        Sec().attacks(c, attackId, citer, { hasOpp: !!other }),
        j ? Sec().reasons(
          j.reasons.map(r => ({ level: j.level === 'ng' ? 'ng' : 'ok', text: r.text, squares: r.squares })),
          citer) : '',
      ].filter(Boolean).join('');
      return { body, sources };
    }

    // ---------- 共通の末尾: 両軍の接触（contacts が渡されないときの保険。deriveBoard で引く） ----------
    _contacts(S, constraints) {
      if (!S || !S.opp || !K.deriveBoard) return [];
      try {
        return K.deriveBoard(constraints || []).merged.contacts;
      } catch (e) {
        return [];
      }
    }

    // 「この囲いを制約にする」と連動する層の予告（「→戦法も変わる」）
    _cascadeLabel(list, who, kind, id) {
      if (!K.constraints || !Array.isArray(list)) return '';
      const cur = list.find(e => e.who === who && e.kind === kind);
      if (cur && cur.id === id) return '';
      const r = K.constraints.preview(list, { type: 'set', who, kind, id });
      if (!r.changed.length) return '';
      const names = [...new Set(r.changed.map(c => LAYER_JA[c.kind] || c.kind))].join('・');
      return `→${names}も変わる`;
    }

    // ---------- 出典（共有 Repository を受け取る。渡されないときだけ内部で持つ） ----------
    _repo() {
      if (this.h.repo) return this.h.repo;   // S5: 呼び出し側の Repository を使う
      if (!this.__repo && K.Repository && K.CASTLES && K.SETUPS) {
        this.__repo = new K.Repository({
          CASTLES: K.CASTLES, SETUPS: K.SETUPS, SOURCES: K.SOURCES || {},
          CASTLE_FAMILIES: K.CASTLE_FAMILIES || [], TACTICS: K.TACTICS || [], TACTIC_FAMILIES: K.TACTIC_FAMILIES || [],
        });
      }
      return this.__repo;
    }
    // 生の sources 宣言（{ref,for}）を複数束ねて解決する（同じ ref は for を「・」で連結）
    _mergedSources(...lists) {
      const r = this._repo();
      return r ? r._resolveSources(lists.flat()) : [];
    }
    _tacticSources(t, castle) {
      const r = this._repo();
      return r && t ? r.tacticComboSourcesOf(t, castle) : [];
    }
    // 発展の前後: from（発展元）と、この囲いを from に持つ囲いの一覧。
    // Repository.lineageOf があれば使い、なければ findCastle と全CASTLES走査で組み立てる
    _lineageOf(c) {
      const r = this._repo();
      if (r && r.lineageOf) return r.lineageOf(c);
      return {
        from: c.from ? findCastle(c.from) : null,
        to: (K.CASTLES || []).filter(x => x.from === c.id),
      };
    }
    _pairingsOf(t) {
      const r = this._repo();
      if (r) return r.pairingsOf(t);
      return (t.pairings || [])
        .map(pp => ({ castle: findCastle(pp.castle), level: pp.level, why: pp.why, sources: [] }))
        .filter(pp => pp.castle);
    }
  }

  K.BoardDetailView = BoardDetailView;
})();
