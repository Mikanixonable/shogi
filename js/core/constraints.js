// 制約モデル（DOM に依存しない）: 各側の固定スロットから、戦略・実効値
// （未選択の層は戦略既定値で補う）と、両立しない選択（✕の理由）・直す候補を導く。
//   戦法: 駒（lead.piece）ごと1枠で、駒が違えば複数同時に採用できる（囲いと違う点）。
//         slots[who].tactic = null | [id, …]（同じ駒の戦法は1つだけ。旧来の単独 id も読める）
//   囲い: いつも1つ。slots[who].castle = null | id
// 選んだものを他の層が勝手に差し替えることはしない: 両立しない組み合わせはそのまま残し、
// conflicts で理由を示し、suggest で両立する候補を返す（選ぶかどうかは使う側が決める）。
// 戦略（居飛車／振り飛車）は制約にしない: 主の戦法（defaults.primaryTacticId。飛車の戦法を優先。
// 無ければ囲い）から導く。ただし選択（'who.strategy'）としては受ける。
// 既定値の解決規則の権威は core/defaults.js、層のスキーマ定数（KINDS/FIELD/WHOS）は
// core/catalog.js が唯一の定義。両立の判定は compat.judge と同じものを使う。
// 依存方向（計画書 1-6）: 参照先は compat・matchup・defaults・catalog・共有 LRU と
// データ（Kakoi.TACTICS 等）だけ。逆向きの参照は持たない
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';

  const { findTactic, findCastle, tacticFamilyOf, castleSides, KINDS, FIELD, WHOS } = Kakoi.catalog;
  const { defaultIdOf, primaryTacticId, primaryOf } = Kakoi.defaults;

  // ---------- スロット（tactic: null | [id,…] / castle: null | id） ----------
  const emptySide = () => ({ tactic: null, castle: null });
  const emptySlots = () => ({ me: emptySide(), opp: emptySide() });
  const isValidId = (kind, id) =>
    typeof id === 'string' && (kind === 'tactic' ? !!findTactic(id) : kind === 'castle' ? !!findCastle(id) : false);

  // 戦法スロットの読み取り: 配列・単独 id（旧形式）・null を [id,…] に揃える
  const tacticList = t => (Array.isArray(t) ? t : (t != null ? [t] : [])).filter(id => isValidId('tactic', id));
  const leadPieceOf = id => { const t = findTactic(id); return (t && t.lead && t.lead.piece) || null; };

  /** 保存値・ハッシュ由来の slots を、形と id の正当性を確かめて作り直す（不正な値は未選択に戻る） */
  function normalizeSlots(slots) {
    const out = emptySlots();
    for (const who of WHOS) {
      // 戦法: 同じ駒は1枠（先に来たものを残す）
      const seen = new Set(), list = [];
      for (const id of tacticList(slots && slots[who] ? slots[who].tactic : null)) {
        const p = leadPieceOf(id);
        if (!p || seen.has(p)) continue;
        seen.add(p); list.push(id);
      }
      out[who].tactic = list.length ? list : null;
      const cid = slots && slots[who] ? slots[who].castle : null;
      if (isValidId('castle', cid)) out[who].castle = cid;
    }
    return out;
  }

  /** 1つのスロットを置き換えた新しい slots。戦法は駒ごとの枠（id=null で全部外す） */
  function setSlot(slots, who, kind, id) {
    if (!WHOS.includes(who) || !KINDS.includes(kind)) return slots;
    if (kind === 'tactic') {
      if (id == null) {
        if (slots[who].tactic == null) return slots;
        return { ...slots, [who]: { ...slots[who], tactic: null } };
      }
      return setTactic(slots, who, id);
    }
    if (id != null && !isValidId(kind, id)) return slots;
    const v = id == null ? null : id;
    if (slots[who][kind] === v) return slots;
    return { ...slots, [who]: { ...slots[who], [kind]: v } };
  }

  /** 戦法を1つ入れる（同じ駒の枠があれば差し替え、なければ末尾に足す）。他の駒の戦法は残る */
  function setTactic(slots, who, id) {
    if (!WHOS.includes(who) || !isValidId('tactic', id)) return slots;
    const p = leadPieceOf(id);
    const cur = tacticList(slots[who].tactic);
    const i = cur.findIndex(x => leadPieceOf(x) === p);
    const next = i < 0 ? [...cur, id] : cur.map((x, j) => (j === i ? id : x));
    if (i >= 0 && cur[i] === id) return slots;
    return { ...slots, [who]: { ...slots[who], tactic: next } };
  }

  /** その id の戦法だけを外す（他の駒の戦法は残る）。含まれていなければ入力の参照を返す */
  function removeTactic(slots, who, id) {
    if (!WHOS.includes(who)) return slots;
    const cur = tacticList(slots[who].tactic);
    if (!cur.includes(id)) return slots;
    const next = cur.filter(x => x !== id);
    return { ...slots, [who]: { ...slots[who], tactic: next.length ? next : null } };
  }

  /** その側のスロットを全部外した新しい slots。もともと空なら入力の参照を返す */
  function clearSide(slots, who) {
    if (!WHOS.includes(who) || KINDS.every(k => slots[who][k] == null)) return slots;
    return { ...slots, [who]: emptySide() };
  }

  // ---------- 実効値（戦略の導出と既定値の補完） ----------
  // 戦略は主の戦法の系統の side（飛車の戦法がいればそれ）。戦法が無ければ囲いの側、どちらも無ければ居飛車
  function strategyOf(slot) {
    const f = tacticFamilyOf(findTactic(primaryTacticId(tacticList(slot.tactic))));
    if (f) return f.side;
    const c = findCastle(slot.castle);
    return c ? castleSides(c)[0] : 'ibisha';
  }

  // 未選択の層を戦略の既定値で埋め、implied に印を付ける。既定値がいまの
  // 実効状態で ng なら、compat.searchAlternative と同じ規則で両立する値を選ぶ
  // （例: 四枚美濃だけ選んだとき既定戦法では駒が足りない）。明示した層は動かさない
  function fillImplied(s, opp) {
    const eff = { strategy: s.strategy, tacticIds: s.tacticIds, castleId: s.castleId };
    for (const k of KINDS) {
      if (k === 'tactic' ? s.tacticIds.length : eff[FIELD[k]] != null) continue;
      s.implied[k] = true;
      const d = defaultIdOf(k, eff.strategy, opp && opp.strategy);
      let v = d;
      if (Kakoi.compat) {
        // 戦法の候補は「既定値と併存する別枠」ではなく、補った1枠そのものとして評価する
        // （base に既定値を残すと、駒の違う候補が既定との2枠で ok と誤判定され得る）
        const base = k === 'tactic'
          ? { ...eff, tacticIds: [] }
          : { ...eff, [FIELD[k]]: d };
        if (d == null || Kakoi.compat.judgeFull(base, k, d, opp).level === 'ng') {
          const rep = Kakoi.compat.searchAlternative(base, k, d, opp);
          if (rep != null) v = rep;
        }
      }
      if (k === 'tactic') {
        s.tacticIds = v == null ? [] : [v];
      } else {
        s[FIELD[k]] = eff[FIELD[k]] = v;
      }
    }
  }

  /**
   * 両側のスロットを実効状態へ展開する。
   * @param {{me:{tactic,castle}, opp:{tactic,castle}}} slots  tactic は [id,…] または単独 id
   * @param {boolean} [showOpp=true] 相手を表示しているか。表示していないとき、自分の既定囲いは
   *   相手の戦略で振り分けず（vsIbisha）、fitness も相手を見ない
   * @returns {{ me:{strategy:string, tacticIds:string[],
   *              castleId:string|null, implied:{tactic?:true, castle?:true}}, opp:Object }}
   *   - 主の戦法（飛車優先）は tacticIds の導出値なので出力には持たない。
   *     必要な読み側は defaults.primaryOf(st) で取る
   *   - 戦法が1つも無ければ戦略既定値で1つだけ補い implied.tactic を立てる
   */
  function effectiveSides(slots, showOpp = true) {
    const S = {};
    for (const who of WHOS) {
      const sl = slots[who];
      const ids = tacticList(sl.tactic);
      S[who] = {
        strategy: strategyOf(sl), tacticIds: ids,
        castleId: sl.castle, implied: {},
      };
    }
    // 相手の明示値（既定で補う前）。他方の既定値の振り分けと castleFit の相手に使う
    const explicit = who => ({
      strategy: S[who].strategy,
      tacticIds: S[who].tacticIds.slice(), castleId: slots[who].castle,
    });
    fillImplied(S.me, showOpp ? explicit('opp') : null);
    fillImplied(S.opp, explicit('me'));
    return S;
  }

  // ---------- 両立しない選択（✕の理由）と直す候補 ----------
  const otherOf = (S, who, showOpp) => who === 'me' ? (showOpp ? S.opp : null) : S.me;
  // 理由の layers（なに同士の衝突か）: tactic の id か 'castle' の配列。空/なしは共有（全体）
  const hitsLayer = (r, tag) => !r.layers || !r.layers.length || r.layers.includes(tag);

  /**
   * 明示した層のうち両立しないものを、その理由つきで返す（既定で補った層は対象外）。
   * @returns {{ me:{tactic:{[id]:Array}, castle?:Array}, opp:{...} }}
   *   tactic は戦法の id ごとの ng の理由 {code, text, squares?}。表示していない相手は空
   */
  function conflicts(slots, S, showOpp) {
    const out = { me: { tactic: {} }, opp: { tactic: {} } };
    for (const who of WHOS) {
      if (who === 'opp' && !showOpp) continue;
      const ev = Kakoi.compat.sideEval(S[who], otherOf(S, who, showOpp));
      for (const r of ev.ng) {
        for (const tid of tacticList(slots[who].tactic)) {
          if (hitsLayer(r, tid)) (out[who].tactic[tid] = out[who].tactic[tid] || []).push(r);
        }
        if (slots[who].castle != null && hitsLayer(r, 'castle')) {
          (out[who].castle = out[who].castle || []).push(r);
        }
      }
    }
    return out;
  }

  // ---------- 候補の評価: レールのバッジ・ホバー予告・直す候補で共有する窓口 ----------
  // 「候補を置いた後」の側を土台に compat.judge するので、その側のスロットが空でも
  // 候補から導いた戦略で評価され、「駒が足りない」といった嘘の ng 理由が出ない
  const evalCache = Kakoi.newLRU(512);
  /**
   * @param {{me:Object, opp:Object}} slots
   * @param {boolean} showOpp
   * @param {'me'|'opp'} who 候補を置く側
   * @param {string} kind 'tactic'|'castle'
   * @param {string} id 候補の id
   * @returns {{ next:Object, j:Object }} 置いた後の slots と compat.judge の結果
   */
  function evaluate(slots, showOpp, who, kind, id) {
    const k = `${JSON.stringify(slots)}|${showOpp}|${who}|${kind}|${id}`;
    if (evalCache.has(k)) return evalCache.get(k);
    const next = setSlot(slots, who, kind, id);
    const S = effectiveSides(next, showOpp);
    const v = { next, j: Kakoi.compat.judge(S[who], kind, id, otherOf(S, who, showOpp)) };
    evalCache.set(k, v);
    return v;
  }

  const familyIdOf = (kind, id) => {
    const x = kind === 'tactic' ? findTactic(id) : findCastle(id);
    return x ? x.family : null;
  };
  /**
   * 両立しない選択の直す候補: ng にならない候補を、
   * 相性表の◎→同じ系統→データ順で並べて返す（自動では差し替えない。選ぶのは使う側）。
   * 戦法は駒ごとの枠なので、候補は targetId と同じ駒の戦法に限る（他の駒の枠は動かさない）。
   * @param {string} [targetId] 戦法のとき差し替え対象の id（無ければ先頭の枠）
   * @returns {string[]} 候補の id（多くても limit 件）
   */
  function suggest(slots, showOpp, who, kind, limit = 6, targetId = null) {
    const raw = slots[who][kind];
    const cur = kind === 'tactic'
      ? (targetId || (tacticList(raw)[0] || null))
      : raw;
    const fam = familyIdOf(kind, cur);
    const piece = kind === 'tactic' ? leadPieceOf(cur) : null;
    const all = kind === 'tactic'
      ? Kakoi.TACTICS.filter(t => leadPieceOf(t.id) === piece)
      : Kakoi.CASTLES;
    const rows = all.filter(x => x.id !== cur)
      .map(x => ({ id: x.id, family: x.family, level: evaluate(slots, showOpp, who, kind, x.id).j.level }))
      .filter(e => e.level !== 'ng');
    const rank = e => (e.level === 'best' ? 0 : 2) + (fam && e.family === fam ? 0 : 1);
    return rows.map((e, i) => ({ id: e.id, i, r: rank(e) }))
      .sort((a, b) => a.r - b.r || a.i - b.i)
      .slice(0, limit).map(e => e.id);
  }

  // ---------- 選択状態の文字列表現（'who.kind[.id]'） ----------
  // rail-view / board-screen / detail-view / controller / hash-link で共有する（S2）
  // strategy はスロットを持たない（effectiveSides() が導く値）が、選択はできる。
  // tactic は駒ごとの枠が複数あるので、第3要素に戦法の id を持てる（'me.tactic.bougin'）
  // SEL_RE は内部表現（'me.tactic.bougin'。側・層はフル名）の文法。
  // js/ui/hash-link.js の decodeSel が使う /[mo][tcsk]/ は URL ハッシュの短縮形
  // （'mt.bougin'。側・層は1文字コード）で、同じ概念の別文法 —— 末尾の id 部は
  // どちらも [^\s.]+。両者を行き来する対応表は hash-link の WHO_CHAR/KIND_CHAR が持つ
  const SEL_RE = /^(me|opp)\.(tactic|castle|strategy|senkei)(?:\.([^\s.]+))?$/;
  // 既定の選択（形式不正・初期状態・相手 OFF 時の握り直し先）: 自分の囲い。
  // 文字列 'me.castle' と {who,kind} オブジェクトの両方で参照されるのでここに置く
  const DEFAULT_SEL = Object.freeze({ who: 'me', kind: 'castle' });
  /** 'me.tactic.bougin' → {who:'me', kind:'tactic', id:'bougin'}。形式が違えば null */
  const parseSel = s => {
    const m = SEL_RE.exec(String(s || ''));
    return m ? { who: m[1], kind: m[2], ...(m[3] ? { id: m[3] } : {}) } : null;
  };
  /**
   * 選択を握り直す: 形式不正なら 'me.{kind}'、相手を表示していないのに相手側を指すなら自分側の同じ層
   * @param {string|null} selected
   * @param {boolean} showOpp
   * @param {string} [fallbackKind=DEFAULT_SEL.kind] 形式不正のときの層
   */
  function normalizeSelected(selected, showOpp, fallbackKind = DEFAULT_SEL.kind) {
    const sel = parseSel(selected);
    if (!sel) return `${DEFAULT_SEL.who}.${fallbackKind}`;
    if (sel.who === 'opp' && !showOpp) return `me.${sel.kind}`;
    return sel.id ? `${sel.who}.${sel.kind}.${sel.id}` : `${sel.who}.${sel.kind}`;
  }

  // ---------- 導出ラベル（戦型は制約にしないで表示だけする） ----------
  // 表示名は js/data/senkei.js の Kakoi.SENKEI に寄せる（SENKEI_RESOLVE で
  // 相矢倉 → 矢倉 を解決）。データが無いときは下のフォールバック名を使う
  const SENKEI_FALLBACK = {
    kakugawari: '角換わり', yokofudori: '横歩取り', aiyagura: '相矢倉',
    yagura: '矢倉', gangi: '雁木', aigakari: '相掛かり',
  };
  const senkeiName = id => {
    const S = Kakoi.SENKEI || {};
    const e = S[id] || S[(Kakoi.SENKEI_RESOLVE || {})[id]];
    return (e && e.name) || SENKEI_FALLBACK[id];
  };
  // ---------- 戦型の細分類（coverage-senkei-and-reading.md §3-3 Phase 1） ----------
  // 対抗形は3つの直交軸で表す: 振り飛車の種類（rook）× 居飛車側の方針（approach）×
  // 振り飛車の型（style=角交換振り飛車）。同じ軸は排他、違う軸は葉のラベルに「・」で併記
  const ROOK_KIND = { 5: 'naka', 6: 'shiken', 7: 'sanken', 8: 'mukai' };   // 先手視点の飛車の筋 → 振り飛車の種類
  const ROOK_NAME = { naka: '中飛車', shiken: '四間飛車', sanken: '三間飛車', mukai: '向かい飛車' };
  const SLOW_CASTLE = new Set(['anaguma', 'mino']);   // 居飛車側で手数がかかる囲いの系統（持久戦の目安）
  // 主の戦法（飛車優先）の筋。明示層優先: useImplied=false のパスでは暗示の層を根拠にしない。
  // 主役が飛車以外の戦法（ツノ銀中飛車・耀龍四間飛車など）でも、盤上の飛車の筋が種類を示す
  const rookFileOf = (st, useImplied) => {
    if (!useImplied && st.implied && st.implied.tactic) return null;
    const t = findTactic(primaryOf(st));
    if (!t) return null;
    if (t.lead && t.lead.piece === '飛') return t.lead.files[0];
    const hi = (t.pieces || '').split(/\s+/).find(x => x[0] === '飛');
    const f = hi ? parseInt(hi[1], 10) : NaN;
    return f >= 1 && f <= 9 ? f : null;
  };
  // 居飛車側の方針: 明示した戦法の pace（rapid→急戦 / slow→持久戦）、
  // なければ明示した囲いの系統（穴熊・美濃系→持久戦）。境界は曖昧なので代理指標（§3-3）
  const paceOf = (st, useImplied) => {
    const ids = (!useImplied && st.implied && st.implied.tactic) ? [] : (st.tacticIds || []);
    const p = ids.map(findTactic).filter(Boolean).map(t => t.pace)
      .find(x => x === 'rapid' || x === 'slow');
    if (p) return p;
    const c = (!useImplied && st.implied && st.implied.castle) ? null : findCastle(st.castleId);
    return c && SLOW_CASTLE.has(c.family) ? 'slow' : null;
  };
  // 明示した戦法の senkei タグに id があるか（useImplied なら暗示の層も見る）
  const hasTag = (st, tag, useImplied) => {
    const ids = (!useImplied && st.implied && st.implied.tactic) ? [] : (st.tacticIds || []);
    return ids.map(findTactic).filter(Boolean).some(t => (t.senkei || []).includes(tag));
  };
  const explicitTactics = st => !(st.implied && st.implied.tactic) && (st.tacticIds || []).length > 0;
  // 葉のラベルに別軸の項目を「・」で連結する。sub/style は右ドックでの導線に使う
  const leafJoin = (leaf, seg, extra) => leaf
    ? { ...leaf, label: `${leaf.label}・${seg}`, ...extra }
    : { id: extra.sub ? extra.sub.id : extra.style.id, label: extra.sub ? extra.sub.label : extra.style.label, ...extra };
  // 対抗形の葉: 振り飛車の種類 → 居飛車側の方針 → 振り飛車の型（角交換）の順に連結
  const taikouLeaf = (furi, ibi, useImplied) => {
    let leaf = null;
    const rk = ROOK_KIND[rookFileOf(furi, useImplied)];
    if (rk) leaf = { id: `taikou-${rk}`, label: senkeiName(`taikou-${rk}`) };
    const pace = paceOf(ibi, useImplied);
    if (pace) {
      const subId = pace === 'rapid' ? 'kyusen' : 'jikyusen';
      leaf = leafJoin(leaf, senkeiName(subId), { sub: { id: subId, label: senkeiName(subId) } });
    }
    if (hasTag(furi, 'kakukoukan-furi', useImplied)) {
      const e = Kakoi.SENKEI['kakukoukan-furi'] || {};
      leaf = leafJoin(leaf, e.short || '角交換', { style: { id: 'kakukoukan-furi', label: senkeiName('kakukoukan-furi') } });
    }
    if (leaf && leaf.sub && leaf.sub.id === leaf.id) delete leaf.sub;
    if (leaf && leaf.style && leaf.style.id === leaf.id) delete leaf.style;
    return leaf;
  };
  // 相振り飛車の葉: 両側の ROOK_KIND が同じなら 相中飛車・相三間飛車のエントリ
  // （無い種類は「相四間飛車」）、違う筋は「三間飛車×向かい飛車」型の自由文（id は親の aifuri）。
  // style 軸（角交換振り飛車）は相振りにも現れる
  const aifuriLeaf = (me, opp, useImplied) => {
    const ka = ROOK_KIND[rookFileOf(me, useImplied)], kb = ROOK_KIND[rookFileOf(opp, useImplied)];
    let leaf = null;
    if (ka && kb) {
      const eid = `ai-${ka}`;
      leaf = ka === kb && Kakoi.SENKEI[eid]
        ? { id: eid, label: senkeiName(eid) }
        : ka === kb
          ? { id: 'aifuri', label: `相${ROOK_NAME[ka]}` }
          : { id: 'aifuri', label: `${ROOK_NAME[ka]}×${ROOK_NAME[kb]}` };
    }
    if (hasTag(me, 'kakukoukan-furi', useImplied) || hasTag(opp, 'kakukoukan-furi', useImplied)) {
      const e = Kakoi.SENKEI['kakukoukan-furi'] || {};
      leaf = leafJoin(leaf, e.short || '角交換', { style: { id: 'kakukoukan-furi', label: senkeiName('kakukoukan-furi') } });
    }
    return leaf;
  };
  // 力戦: 両側が戦法を明示していてもどの戦型・細分類にも当たらないときの受け皿。
  // 既定値だけの状態では出さない（§3-3）。点線のピルにするため implied:true を付ける
  const rikisenLeaf = (me, opp) => (explicitTactics(me) && explicitTactics(opp))
    ? { id: 'rikisen', label: senkeiName('rikisen') || '力戦' } : null;
  /**
   * 両側の実効状態から戦型ラベルを導出する。
   * @param {Object|null} me  effectiveSides() の出力（実効値で渡す）
   * @param {Object|null} opp 同上。null（相手を表示していない）なら戦型ラベルは出ない
   * @returns {Array<{id:string, label:string, implied?:true}>}
   *   #相居飛車/#対抗形/#相振り飛車 は matchup.threat().kind から。
   *   葉のラベルは1つだけ（大分類と合わせてピル2枚が上限。§3-4-2）。
   *   細分類（対抗形の種類×方針×型・相振りの筋）は §3-3 Phase 1。
   *   まず明示した層だけを根拠に判定し、決まらなければ既定値で補った層（implied）も
   *   含めて再判定し implied:true を付ける。両側が戦法を明示していてもどの戦型にも
   *   当たらないときだけ #力戦 を implied で出す（既定値だけの状態では出さない）。
   *   相居飛車の判定（計画書 §2-3 C 修正案 v2）:
   *     1. 両者の戦法が持ち駒に角を持つ（盤の事実） → 角換わり
   *     2. どちらかの戦法が yokofudori タグを持つ → 横歩取り（横歩を取るのは片側だけ）
   *     3. 両側の戦法の senkei タグの交差が1つに絞れる → その戦型
   *        （複数残るときだけ矢倉系・雁木系の囲いで絞る。片側だけタグがあればそれを使う）
   *     4. タグで決まらなければ囲いだけが根拠: 矢倉系 → 矢倉、雁木系 → 雁木
   *        （カニ・兜は refFamily があるので雁木戦とは呼ばない。計画書 §2-1）
   *     5. 両側に矢倉の根拠（矢倉系の囲いか yagura タグ）がある → 相矢倉
   *     6. どれにも当たらない → 力戦（両側明示のとき）/ 出さない
   */
  function senkeiLabels(me, opp) {
    const out = [];
    if (!me || !opp || !Kakoi.matchup) return out;
    const th = Kakoi.matchup.threat(me, opp);
    out.push({ id: th.kind, label: th.label });
    // ---------- 対抗形・相振り飛車の葉（§3-3 Phase 1 の細分類） ----------
    if (th.kind === 'taikou-i' || th.kind === 'taikou-f' || th.kind === 'aifuri') {
      const furi = th.kind === 'taikou-f' ? me : opp;
      const ibi = th.kind === 'taikou-i' ? me : opp;
      let leaf = th.kind === 'aifuri'
        ? aifuriLeaf(me, opp, false)
        : taikouLeaf(furi, ibi, false);
      let implied = false;
      if (!leaf) {
        leaf = th.kind === 'aifuri' ? aifuriLeaf(me, opp, true) : taikouLeaf(furi, ibi, true);
        implied = !!leaf;
      }
      if (!leaf && (leaf = rikisenLeaf(me, opp))) implied = true;
      if (leaf && !out.some(x => x.id === leaf.id && x.label === leaf.label))
        out.push({ ...leaf, ...(implied ? { implied: true } : {}) });
      return out;
    }
    if (me.strategy !== 'ibisha' || opp.strategy !== 'ibisha') return out;
    const evidence = (st, useImplied) => {                    // その側の根拠。useImplied=false なら明示した層だけ
      const ids = st.tacticIds && st.tacticIds.length ? st.tacticIds : [primaryOf(st)].filter(Boolean);
      const ts = (useImplied || !(st.implied && st.implied.tactic) ? ids : []).map(findTactic).filter(Boolean);
      const c = (useImplied || !(st.implied && st.implied.castle)) ? findCastle(st.castleId) : null;
      return { tags: new Set(ts.flatMap(t => t.senkei || [])),
               kaku: ts.some(t => (t.hand || '').includes('角')),
               yagura: !!(c && c.family === 'yagura'),
               gangi: !!(c && c.family === 'gangi' && !c.refFamily) };   // カニ・兜は雁木戦と呼ばない
    };
    const decide = useImplied => {
      const A = evidence(me, useImplied), B = evidence(opp, useImplied);
      if (A.kaku && B.kaku) return 'kakugawari';                                      // 盤の事実: 両者の持ち駒に角
      if (A.tags.has('yokofudori') || B.tags.has('yokofudori')) return 'yokofudori';  // 横歩を取るのは片側だけ
      let cand = A.tags.size && B.tags.size ? [...A.tags].filter(x => B.tags.has(x))  // 戦法タグは交差
               : [...(A.tags.size ? A.tags : B.tags)];
      if (cand.length > 1) {                                                          // 複数残れば囲いで絞る
        const by = cand.filter(x => (x === 'yagura' && (A.yagura || B.yagura)) || (x === 'gangi' && (A.gangi || B.gangi)));
        cand = by.length === 1 ? by : [];
      }
      let id = cand.length === 1 ? cand[0] : null;
      if (!id) id = (A.yagura || B.yagura) ? 'yagura' : (A.gangi || B.gangi) ? 'gangi' : null;  // 囲いだけが根拠
      if (id === 'yagura' && (A.yagura || A.tags.has('yagura')) && (B.yagura || B.tags.has('yagura'))) return 'aiyagura';
      return id;
    };
    let id = decide(false), implied = false;
    // 両側が戦法を明示していてもどの戦型にも当たらない → 力戦（受け皿。点線で出す）
    if (!id && rikisenLeaf(me, opp)) { id = 'rikisen'; implied = true; }
    if (!id) { id = decide(true); implied = !!id; }
    if (id) out.push({ id, label: id === 'aiyagura' ? '相矢倉' : senkeiName(id), ...(implied ? { implied: true } : {}) });
    return out;
  }

  const api = {
    emptySlots, normalizeSlots, setSlot, setTactic, removeTactic, clearSide,
    effectiveSides, conflicts, evaluate, suggest, senkeiLabels, parseSel, normalizeSelected,
    tacticList, KINDS, FIELD, DEFAULT_SEL,
  };
  Kakoi.constraints = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api; // node からの読み込み用
})();
