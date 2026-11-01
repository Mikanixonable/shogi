// 右 detail の組み立て本体（計画書 §5 / U5）: 選択中の制約 {who, kind} の種類に応じて、
// detail-sections（js/ui/detail-sections.js）の部品を組み立てて描く。
//   - *.tactic: 戦法の詳細（タグ・説明・長所短所・主役の駒の動き）＋派生の切替
//     ＋相性のよい囲い（◎/○・いまの囲い）＋相手との相性の相性（judge の vs 軸）
//   - *.castle: 囲いの詳細（ペンタグラム・#タグ・発展・長所短所・攻め筋）。相手がいれば
//     ペンタグラムに戦型の重みを重ね、castleFit と効いている軸を表示する
//   - *.strategy: 戦型の詳細（説明・導出元・その戦型の既定の戦法/囲いと囲い一覧）。
//     戦型はスロットを持たない導出値だが、制約条件の情報として右 detail で見られる
//   - 選んだ層が他の層と両立しないとき: 先頭近くに理由と、直す候補（1クリックで差し替え）
//   - 共通の末尾: 両軍の接触 → 出典
// render は self-contained: データは Kakoi.*（CASTLES/TACTICS/…）と呼び出し側の共有
// Repository で解決する。盤への反映はハンドラ経由。
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';
  const K = window.Kakoi;
  const { esc, makeCiter } = K.html;
  const bindCites = (K.cites && K.cites.bind) || (() => {});   // ui/cites.js（S6 で core から移動）
  const Sec = () => K.detailSections; // 読み込み順に依存しないよう呼び出し時に引く

  const { LAYER_JA, FIELD, findTactic, findCastle, tacticFamilyOf, castleFamilyOf, castleSides, strategyLabel } = K.catalog;
  const WHO_JA = { me: '▲自分', opp: '△相手' };
  const SHORT_WHO = { me: '自分', opp: '相手' };
  // 戦法の多角形の色は主役の駒の系統色（左レールのタイルの --t-* と同じ）
  const TACTIC_COLOR = { 'furibisha-rook': 'var(--t-rook)', 'ibisha-rook': 'var(--t-rook)',
    'ibisha-silver': 'var(--t-silver)', 'ibisha-kaku': 'var(--t-kaku)', 'ibisha-kei': 'var(--t-kei)',
    'ibisha-fu': 'var(--t-fu)', 'ibisha-kin': 'var(--t-kin)', 'ibisha-gyoku': 'var(--t-gyoku)' };

  // ---------- データ参照（Kakoi.* 直読み＋共有 Repository） ----------
  const subtypeOf = c => {
    const f = castleFamilyOf(c);
    return (f && (f.subtypes || []).find(s => s.id === c.subtype)) || null;
  };
  const parseSel = K.constraints.parseSel;

  class DetailView {
    /**
     * @param {HTMLElement} el `#detail`（.detail-body）
     * @param {{ onHover:(squares:string[], tone:?string)=>void,
     *   onAttack:(attackId:string|null)=>void,
     *   onSetConstraint:(who:'me'|'opp', kind:'tactic'|'castle', id:string)=>void }} handlers
     *   onHover: data-sq のある要素に乗ったとき盤のマスを光らせる
     *   onAttack: 攻め筋ボタンの選択/解除。onSetConstraint: 囲い行・派生チップ・直す候補で制約を立てる
     */
    constructor(el, handlers = {}) {
      this.el = el;
      this.h = handlers;
      this._sel = K.constraints.DEFAULT_SEL;
      // 詳細の data-sq は選択側の先手視点。相手（opp）の詳細では盤上の駒が回転済みなので
      // mirrorSq で反転してから照らす。両軍の接触（data-abs）は絶対座標なので反転しない
      const sqsOf = t => {
        const list = t.dataset.sq.split(' ');
        return this._sel.who === 'opp' && !t.dataset.abs
          ? list.map(s => K.notation.mirrorSq(s)) : list;
      };
      el.addEventListener('mouseover', e => {
        const t = e.target.closest('[data-sq]');
        if (t && handlers.onHover) handlers.onHover(sqsOf(t), t.dataset.tone || 'focus');
      });
      el.addEventListener('mouseout', e => {
        const t = e.target.closest('[data-sq]');
        if (t && !t.contains(e.relatedTarget) && handlers.onHover) handlers.onHover([], null);
      });
      el.addEventListener('click', e => {
        // 定番セット・受けの手筋・手筋の図（.attack の見た目を借りる受けの手筋は先に拾う）
        const act = e.target.closest('[data-act="combo"], [data-act="defense"], [data-act="tesuji"]');
        if (act) {
          const id = act.dataset.id;
          if (act.dataset.act === 'combo' && handlers.onCombo) handlers.onCombo(this._sel.who, id, act.dataset.vs === '1');
          if (act.dataset.act === 'defense' && handlers.onDefense) handlers.onDefense(act.getAttribute('aria-pressed') === 'true' ? null : id);
          if (act.dataset.act === 'tesuji' && handlers.onOpenTesuji) handlers.onOpenTesuji(id);
          return;
        }
        const atk = e.target.closest('.attack');
        if (atk) {
          if (handlers.onAttack) handlers.onAttack(atk.getAttribute('aria-pressed') === 'true' ? null : atk.dataset.id);
          return;
        }
        // ホバーのない画面（タッチ）では、点線の項目をタップで盤のハイライトを切り替える（B3。
        // 盤は sticky で見えているので、光ったマスがそのまま見える）
        if (!matchMedia('(hover:hover)').matches) {
          const sq = e.target.closest('[data-sq]');
          if (sq && handlers.onHover) {
            if (this._tapSq === sq) { this._tapSq = null; handlers.onHover([], null); }
            else { this._tapSq = sq; handlers.onHover(sqsOf(sq), sq.dataset.tone || 'focus'); }
          }
        }
        const c = e.target.closest('[data-act="castle"]');
        if (c) {
          if (handlers.onSetConstraint) handlers.onSetConstraint(this._sel.who, 'castle', c.dataset.id);
          return;
        }
        // 戦型の切替（制約を他方の戦型へ。前の選択は記憶して戻せる）
        const sw = e.target.closest('[data-act="strategy"]');
        if (sw) {
          if (handlers.onSwitchStrategy) handlers.onSwitchStrategy(sw.dataset.who || this._sel.who, sw.dataset.target);
          return;
        }
        // 戦型への導線（制約ではなく情報の選択。'me.senkei.<id>' に寄せる）
        const sk = e.target.closest('[data-act="senkei"]');
        if (sk) {
          if (handlers.onSenkei) handlers.onSenkei(sk.dataset.id);
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
     *   st:Object, S:{me:Object, opp:Object}, showOpp:boolean,
     *   threat:?Object, attackId:?string, contacts:Array,
     *   ng:?Array, suggest?:Array<{id:string, name:string}> }} p
     *   sel: 選択中の制約（'who.kind' 文字列も可）
     *   st: その側の constraints.effectiveSides() 出力（implied を持つ）
     *   S:  effectiveSides() の全体。showOpp: 相手を表示しているか。threat: matchup.threat(S.me, S.opp)（表示中のみ）
     *   ng: 選択中の層が他の層と両立しないときの理由 {code,text,squares?}（無ければ null）
     *   suggest: そのとき直す候補（押すとその層を差し替える）
     */
    render(p = {}) {
      if (!Sec()) {
        this.el.innerHTML = '<p class="note">js/ui/detail-sections.js が読み込まれていません。</p>';
        return;
      }
      const S = p.S || {};
      const sel = (typeof p.sel === 'string' ? parseSel(p.sel) : p.sel)
        || K.constraints.DEFAULT_SEL;
      const who = sel.who === 'opp' ? 'opp' : 'me';
      const kind = sel.kind === 'tactic' ? 'tactic' : 'castle';
      const norm = { who, kind, id: sel.id };
      this._sel = norm;
      const st = p.st !== undefined ? p.st : S[who];
      const citer = makeCiter();
      const b = sel.kind === 'senkei' ? this._senkei(sel, S, p.showOpp, citer, p)
        : sel.kind === 'strategy' ? this._strategy(sel, st, S, p.showOpp, citer, p)
        : kind === 'tactic' ? this._tactic(norm, st, S, p.showOpp, citer, p)
        : this._castle(norm, st, S, p.showOpp, p.attackId, citer, p);
      this._tapSq = null;   // 描き直しでタップ中の data-sq 要素は取り替わる
      // 戦法・囲いの面: 定番セット（その層を含むもの）と王手飛車の筋を足す
      const extra = [];
      let tail = '';
      if (K.catalog.KINDS.includes(sel.kind) && st) {
        const ids = kind === 'tactic' ? (st.tacticIds || []) : (st.castleId ? [st.castleId] : []);
        const done = K.tesuji ? K.tesuji.comboOf(st) : null;
        const rows = [...new Set(ids.flatMap(id => K.tesuji ? K.tesuji.combosWith(kind, id) : []))]
          .map(c => ({ combo: c, done: done === c }));
        tail += Sec().combos(rows, citer, { canVs: who === 'me' });
        extra.push(...rows.flatMap(r => r.combo.sources || []));
      }
      if (p.forks && p.forks.list.length) tail += Sec().forks(p.forks.list, p.forks);
      // 共通の末尾: 両軍の接触 → 出典。
      // 接触は呼び出し側の導出（merge 済み）を受け取る（S5: 再計算しない）。
      // extra は定番セットの生の出典宣言。本文側（b.sources）と同じ ref は既出なので落とす
      const have = new Set(b.sources.map(s => s.ref));
      const more = this._mergedSources(extra).filter(s => !have.has(s.ref));
      this.el.innerHTML = [b.body, tail, Sec().contacts(p.contacts, citer),
        Sec().sources([...b.sources, ...more], citer)]
        .filter(Boolean).join('');
    }

    // ---------- パネル先頭: 側の表示名＋項目名＋既定の層の注記 ----------
    _head(sel, name, implied, reading) {
      return Sec().head(`${WHO_JA[sel.who]}の${LAYER_JA[sel.kind]}`, name, { reading, implied });
    }

    // 両立しない選択: 理由と、直す候補（自動では差し替えない。押すとその層を差し替える）
    _conflict(sel, p, citer) {
      return p.ng && p.ng.length ? Sec().conflict(p.ng, p.suggest || [], sel.kind, citer) : '';
    }

    // ---------- *.tactic ----------
    // 戦法は駒ごとの枠が複数ある: 選択中の枠（sel.id、無ければ主の戦法）の詳細を出す
    _tactic(sel, st, S, showOpp, citer, p) {
      const t = findTactic(sel.id || K.defaults.primaryOf(st));
      if (!t) {
        return {
          body: this._head(sel, '（未選択）', st.implied && st.implied.tactic)
            + '<p class="note">戦法が選ばれていません。左ドックで選びます。</p>',
          sources: [],
        };
      }
      const other = this._other(sel, S, showOpp);
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
      // 相性のよい囲い: pairings の ng 以外。いまの囲いつき
      const rows = this._pairingsOf(t).filter(pp => pp.level !== 'ng').map(pp => ({
        id: pp.castle.id,
        name: pp.castle.name,
        familyName: (castleFamilyOf(pp.castle) || {}).name || '',
        level: pp.level,
        why: pp.why,
        current: pp.castle.id === st.castleId,
      }));
      // 相手との相性（against / againstTactic。judge の vs 軸に理由が入っている）
      const j = other && K.compat ? K.compat.judge(st, 'tactic', t.id, other) : null;
      const vsRows = j ? Sec().vsRows(j.vs) : [];
      const body = [
        this._head(sel, t.name, implied, t.reading),
        Sec().figRow(
          Sec().tacticFigure(t, { flip: sel.who === 'opp', color: TACTIC_COLOR[t.family] || '' }),
          Sec().tacticPenta(t, t.variantOf ? findTactic(t.variantOf) : null, TACTIC_COLOR[t.family] || '')),
        this._conflict(sel, p, citer),
        Sec().tacticTags(t, family),
        Sec().desc(t.desc, citer),
        Sec().note(t.note, citer),
        family && family.note ? Sec().note(`${family.piece}が主役の理由：${family.note}`, citer) : '',
        Sec().pcList('長所', t.pros, { small: '' }, citer),
        Sec().pcList('短所', t.cons, { cls: 'cons', small: '' }, citer),
        Sec().route(t),
        Sec().variants(variantRows),
        Sec().pairingCastles(rows),
        other && j && j.vs ? Sec().vsSection(vsRows, SHORT_WHO[sel.who === 'me' ? 'opp' : 'me']) : '',
      ].filter(Boolean).join('');
      return { body, sources: this._tacticSources(t, castle) };
    }

    // ---------- *.castle ----------
    // threat（呼び出し側が持つ threat(S.me,S.opp)）はここでは使わず、選択側の向きで引き直す
    _castle(sel, st, S, showOpp, attackId, citer, p) {
      const c = findCastle(st.castleId);
      if (!c) {
        return {
          body: this._head(sel, '（未選択）', st.implied && st.implied.castle)
            + '<p class="note">囲いが選ばれていません。左ドックで選びます。</p>',
          sources: [],
        };
      }
      const other = this._other(sel, S, showOpp);
      const family = castleFamilyOf(c);
      const subtype = subtypeOf(c);
      const implied = st.implied && st.implied.castle;
      // 相手がいるとき: その側から見た脅威を引き直し（opp の囲いは threat(S.opp,S.me)）、
      // ペンタグラムに戦型の重みを重ね、castleFit と効いている軸を出す（§5）
      const th = other && K.matchup ? K.matchup.threat(st, other) : null;
      const fit = th ? K.matchup.castleFit(c, th) : null;
      const j = K.compat ? K.compat.judge(st, 'castle', c.id, other) : null;
      // 出典: 囲い＋想定配置に加え、「組み合わせの理由」で出す相性表（pairing.why）の出典も併記する
      // （[[ref]] を本文に引く文を出す以上、その ref はパネルの出典リストに載っている必要がある）
      const tactic = findTactic(K.defaults.primaryOf(st));
      const pairing = tactic && (tactic.pairings || []).find(pp => pp.castle === c.id);
      const setupSrc = this.h.repo.setupOf(c).sources;
      const defs = p.defenses || [];
      // この囲いの崩され方: 手筋側の onCastle・囲い側の attacks[].tesuji の両方から引く（§5-4）
      const kuz = K.tesuji && K.tesuji.forCastle ? K.tesuji.forCastle(c) : [];
      const sources = this._mergedSources(
        c.sources || [], setupSrc || [], pairing ? pairing.sources || [] : [],
        ...defs.map(r => r.tesuji.sources || []), ...kuz.map(t => t.sources || []));
      const ngTexts = new Set((p.ng || []).map(r => r.text));
      const body = [
        this._head(sel, c.name, implied, c.reading),
        Sec().figRow(
          Sec().castleFigure(c, { flip: sel.who === 'opp' }),
          Sec().penta(c.ratings, th
            ? { weights: th.weights, small: '朱の破線＝この戦型で効く軸' }
            : {})),
        this._conflict(sel, p, citer),
        fit != null ? Sec().fitness(fit, th, c) : '',
        th ? Sec().distanceNote(th.distance, SHORT_WHO[sel.who], SHORT_WHO[sel.who === 'me' ? 'opp' : 'me']) : '',
        Sec().castleTags(c, family, subtype),
        Sec().refFamily(c.refFamily),
        Sec().desc(c.desc, citer),
        Sec().note(c.note, citer),
        Sec().coreChips(c),
        Sec().lineage(this._lineageOf(c)),
        Sec().pcList('長所', c.pros, { tone: 'good' }, citer),
        Sec().pcList('短所', c.cons, { tone: 'bad', cls: 'cons' }, citer),
        Sec().attacks(c, attackId, citer, { hasOpp: !!other }),
        Sec().kuzushi(kuz.map(t => ({ tesuji: t, weak: (t.onCastle && t.onCastle.weak) || [] })), citer),
        Sec().defenses(defs, citer),
        j ? Sec().reasons(
          j.reasons.filter(r => !ngTexts.has(r.text)).map(r => ({ level: 'ok', text: r.text, squares: r.squares })),
          citer) : '',
      ].filter(Boolean).join('');
      return { body, sources };
    }

    // ---------- *.strategy ----------
    // 戦型はスロットを持たない導出値（戦法の系統→囲いの側→既定の居飛車）。説明と、
    // この戦型を実際の制約として立てる入口（既定の戦法・囲い／この戦型の囲い一覧）を出す
    _strategy(sel, st, S, showOpp, citer, p) {
      const s = K.STRATEGIES[st.strategy];
      const name = s ? s.label : strategyLabel(st.strategy);
      const other = this._other(sel, S, showOpp);
      const t = findTactic(K.defaults.primaryOf(st)), c = findCastle(st.castleId);
      const imp = st.implied || {};
      // 導出元（constraints の strategyOf と同じ順序）: 明示した戦法の系統→明示した囲いの側→既定
      const from = t && !imp.tactic ? `戦法「${t.name}」の系統から導いています`
        : c && !imp.castle ? `囲い「${c.name}」の側から導いています`
        : '戦法も囲いも未選択のため、既定になっています';
      let note = `戦型は制約スロットを持たず、戦法（無ければ囲い）から導きます。いまは${from}。`;
      if (c && !imp.castle && !castleSides(c).includes(st.strategy)) {
        note += `なお囲い「${c.name}」はこの戦型のものではありません（制約バーの ✕ を参照）。`;
      }
      // 既定の戦法・囲い: 押すとその層を制約にする（既定囲いは相手の戦略で振り分けられる）
      const oppStrategy = other ? other.strategy : null;
      const defs = [
        { kind: 'tactic', id: K.defaults.defaultTacticId(st.strategy) },
        { kind: 'castle', id: K.defaults.defaultCastleId(st.strategy, oppStrategy) },
      ].filter(d => d.id);
      const defChips = Sec().vchips(defs.map(d => {
        const it = d.kind === 'tactic' ? findTactic(d.id) : findCastle(d.id);
        // 戦法は実効値が配列（tacticIds）なので主の戦法と比べ、囲いは単一値と比べる
        const cur = d.kind === 'tactic' ? K.defaults.primaryOf(st) : st[FIELD[d.kind]];
        return Sec().setChip({ kind: d.kind, id: d.id,
          text: `${LAYER_JA[d.kind]}：${it ? it.name : d.id}`, pressed: cur === d.id });
      }).join(''));
      // この戦型の囲い（系統順。押すとその囲いを制約にする）
      const castles = this.h.repo.ofSideByFamily(st.strategy);
      const castleChips = Sec().vchips(castles.map(x =>
        Sec().setChip({ kind: 'castle', id: x.id, text: x.name, pressed: st.castleId === x.id })).join(''));
      // もう一方の戦型への切替ボタン: 押すと制約を切り替える（いまの選択は戦型ごとに
      // 覚えておき、戻すと復元される。左レールの切替面と同じ操作）
      const otherSide = st.strategy === 'ibisha' ? 'furibisha' : 'ibisha';
      const otherStrat = K.STRATEGIES[otherSide];
      const switchBtn = otherStrat ? Sec().sec('戦型の切り替え',
        `${SHORT_WHO[sel.who]}の制約を${otherStrat.label}にする。前の選択は記憶して戻せる`,
        `<div class="vchips"><button type="button" class="vchip bd-strat-sw" data-act="strategy" ` +
        `data-who="${esc(sel.who)}" data-target="${esc(otherSide)}">⇄ ${esc(otherStrat.label)}に切り替える</button></div>`) : '';
      const body = [
        this._head(sel, name || '（不明）'),
        this._conflict(sel, p, citer),
        Sec().note(note, citer),
        s && s.desc ? Sec().desc(s.desc, citer) : '',
        switchBtn,
        defs.length ? Sec().sec('この戦型の既定', '押すとその層を制約にする', defChips) : '',
        castles.length ? Sec().sec('この戦型の囲い', '押すとその囲いを制約にする', castleChips) : '',
        other && p.threat ? Sec().note(`相手と合わせた戦型は ${Sec().senkeiChip(this._senkeiLabelId(S, showOpp) || p.threat.kind, '#' + p.threat.label)} です（帯の間の #${esc(p.threat.label)} と同じ区分）。`) : '',
      ].filter(Boolean).join('');
      return { body, sources: [] };
    }

    // ---------- *.senkei ----------
    // 戦型（SENKEI / SENKEI_GROUPS）の解説面。大分類（threat().kind やその束ね）か、
    // 細分類のエントリを出す。戦型は両側共通の情報なので選択は 'me.senkei.<id>' に寄せる
    // いまの組み合わせで導かれた葉のラベルの id（無ければ null）
    _senkeiLabelId(S, showOpp) {
      const ls = showOpp && K.constraints ? K.constraints.senkeiLabels(S.me, S.opp) : [];
      return ls.length > 1 ? ls[ls.length - 1].id : null;
    }
    _senkei(sel, S, showOpp, citer, p) {
      const SK = K.SENKEI || {}, GR = K.SENKEI_GROUPS || {}, RES = K.SENKEI_RESOLVE || {};
      const flatBySide = v => Array.isArray(v) ? [['', v]] : [['ibisha', v && v.ibisha || []], ['furibisha', v && v.furibisha || []]];
      // id なしの選択（相手を下げて 'me.senkei' になったときなど）はいまの組み合わせへ握り直す
      const id = RES[sel.id] || sel.id || this._senkeiLabelId(S, showOpp) || (p.threat && p.threat.kind);
      const e = SK[id];
      const groupOf = gid => GR[gid] || Object.values(GR).find(g => (g.kinds || []).includes(gid)) || null;
      // 側別のリストは、その戦略を採っている側へ立てる（両側が無ければ自分へ）
      const whoFor = side => (S.me.strategy === side ? 'me'
        : (showOpp && S.opp.strategy === side) ? 'opp' : 'me');
      const chip = (kind, cid, who) => {
        const x = kind === 'tactic' ? findTactic(cid) : findCastle(cid);
        return Sec().setChip({ who, kind, id: cid, text: x ? x.name : cid });
      };
      // tactics/castles: 配列は両側共通（自分側へ）、側別は居飛車/振り飛車のラベルつきで併記
      const chipsSec = (title, v, kind) => {
        const rows = flatBySide(v).filter(([, ids]) => ids.length).map(([side, ids]) =>
          Sec().vchips((side ? `<span class="sk-side">${side === 'ibisha' ? '居飛車側' : '振り飛車側'}</span>` : '') +
            ids.map(cid => chip(kind, cid, whoFor(side || null))).join(''))).join('');
        return rows ? Sec().sec(title, '押すとその層を制約にする', rows) : '';
      };
      // 大分類の面（戦型のエントリでない id。'taikou-i' 'aiibisha' など）
      if (!e) {
        const g = groupOf(id);
        if (!g) {
          return { body: Sec().head(LAYER_JA.senkei, '（不明な戦型）') +
            `<p class="note">戦型「${esc(sel.id || '')}」は登録されていません。</p>`, sources: [] };
        }
        const members = Object.entries(SK).filter(([, x]) => x.group === id);
        const memberChips = members.length
          ? Sec().sec('この大分類の戦型', '押すとその戦型の解説へ',
              Sec().vchips(members.map(([mid, x]) => Sec().senkeiChip(mid, x.name)).join('')))
          : '';
        const body = [
          Sec().head('対戦形式（大分類）', g.name),
          Sec().desc(g.desc, citer),
          memberChips,
        ].filter(Boolean).join('');
        return { body, sources: this._mergedSources(g.sources || []) };
      }
      // 戦型エントリの面: パンくず（大分類 › 親 › この戦型）
      const group = groupOf(e.group);
      const parent = e.parent ? SK[e.parent] : null;
      const crumbs = [group && group.name, parent && parent.name, e.name]
        .filter((x, i, a) => x && x !== a[i - 1]).join(' › ');
      // いまの組み合わせでの出方（葉のラベルの sub/style への導線つき）
      const labs = showOpp && K.constraints ? K.constraints.senkeiLabels(S.me, S.opp) : [];
      const cur = labs.find(l => l.id === id || (l.sub && l.sub.id === id) || (l.style && l.style.id === id));
      const curNote = cur ? Sec().note(
        `いまの組み合わせでは「#${esc(cur.label)}」と出ています。` +
        [cur.id, cur.sub && cur.sub.id, cur.style && cur.style.id]
          .filter(x => x && x !== id).map(x => Sec().senkeiChip(x, '#' + ((SK[x] || {}).name || x))).join(' ')) : '';
      const body = [
        Sec().head(crumbs || LAYER_JA.senkei, e.name, { reading: e.reading }),
        Sec().desc(e.desc, citer),
        e.forms ? Sec().sec('成立の形', '', `<p class="desc">${esc(e.forms)}</p>`) : '',
        Sec().note(e.note, citer),
        chipsSec('代表の戦法', e.tactics, 'tactic'),
        chipsSec('代表の囲い', e.castles, 'castle'),
        curNote,
      ].filter(Boolean).join('');
      return { body, sources: this._mergedSources(e.sources || []) };
    }

    // 選択中の側と向かい合う側（相手を表示していないとき、自分の向かいは無い）
    _other(sel, S, showOpp) {
      return sel.who === 'me' ? (showOpp ? S.opp : null) : S.me;
    }

    // ---------- 出典（呼び出し側の共有 Repository） ----------
    // 生の sources 宣言（{ref,for}）を複数束ねて解決する（同じ ref は for を「・」で連結）
    _mergedSources(...lists) { return this.h.repo.resolveSources(lists.flat()); }
    _tacticSources(t, castle) { return t ? this.h.repo.tacticComboSourcesOf(t, castle) : []; }
    _lineageOf(c) { return this.h.repo.lineageOf(c); }
    _pairingsOf(t) { return this.h.repo.pairingsOf(t); }
  }

  K.DetailView = DetailView;
})();
