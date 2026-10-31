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
// core/lookup.js が唯一の定義。両立の判定は compat.judge と同じものを使う。
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';

  const { findTactic, findCastle, tacticFamilyOf, castleSides, KINDS, FIELD, WHOS } = Kakoi.lookup;
  const { defaultIdOf, primaryTacticId } = Kakoi.defaults;

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
    const eff = { strategy: s.strategy, tacticId: s.tacticId, tacticIds: s.tacticIds, castleId: s.castleId };
    for (const k of KINDS) {
      if (k === 'tactic' ? s.tacticIds.length : eff[FIELD[k]] != null) continue;
      s.implied[k] = true;
      const d = defaultIdOf(k, eff.strategy, opp && opp.strategy);
      let v = d;
      if (Kakoi.compat) {
        const base = k === 'tactic'
          ? { ...eff, tacticId: d, tacticIds: d == null ? [] : [d] }
          : { ...eff, [FIELD[k]]: d };
        if (d == null || Kakoi.compat.judgeFull(base, k, d, opp).level === 'ng') {
          const rep = Kakoi.compat.searchAlternative(base, k, d, opp);
          if (rep != null) v = rep;
        }
      }
      if (k === 'tactic') {
        s.tacticIds = v == null ? [] : [v];
        s.tacticId = v;
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
   * @returns {{ me:{strategy:string, tacticId:string|null, tacticIds:string[],
   *              castleId:string|null, implied:{tactic?:true, castle?:true}}, opp:Object }}
   *   - tacticId は主の戦法（飛車優先）。tacticIds が全リスト
   *   - 戦法が1つも無ければ戦略既定値で1つだけ補い implied.tactic を立てる
   */
  function sides(slots, showOpp = true) {
    const S = {};
    for (const who of WHOS) {
      const sl = slots[who];
      const ids = tacticList(sl.tactic);
      S[who] = {
        strategy: strategyOf(sl), tacticIds: ids,
        tacticId: primaryTacticId(ids), castleId: sl.castle, implied: {},
      };
    }
    // 相手の明示値（既定で補う前）。他方の既定値の振り分けと fitness の相手に使う
    const explicit = who => ({
      strategy: S[who].strategy, tacticId: S[who].tacticId,
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

  // ---------- 候補の評価: ドックのバッジ・ホバー予告・直す候補で共有する窓口 ----------
  // 「候補を置いた後」の側を土台に compat.judge するので、その側のスロットが空でも
  // 候補から導いた戦略で評価され、「駒が足りない」といった嘘の ng 理由が出ない
  const evalCache = new (Kakoi.LRU || Map)(512);
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
    const S = sides(next, showOpp);
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
  // dock-view / board-screen / board-detail-view / constraint-mode / hash-link で共有する（S2）
  // strategy はスロットを持たない（sides() が導く値）が、選択はできる。
  // tactic は駒ごとの枠が複数あるので、第3要素に戦法の id を持てる（'me.tactic.bougin'）
  const SEL_RE = /^(me|opp)\.(tactic|castle|strategy)(?:\.([^\s.]+))?$/;
  /** 'me.tactic.bougin' → {who:'me', kind:'tactic', id:'bougin'}。形式が違えば null */
  const parseSel = s => {
    const m = SEL_RE.exec(String(s || ''));
    return m ? { who: m[1], kind: m[2], ...(m[3] ? { id: m[3] } : {}) } : null;
  };
  /**
   * 選択を握り直す: 形式不正なら 'me.{kind}'、相手を表示していないのに相手側を指すなら自分側の同じ層
   * @param {string|null} selected
   * @param {boolean} showOpp
   * @param {string} [fallbackKind='castle'] 形式不正のときの層
   */
  function normalizeSelected(selected, showOpp, fallbackKind = 'castle') {
    const sel = parseSel(selected);
    if (!sel) return `me.${fallbackKind}`;
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
  /**
   * 両側の実効状態から戦型ラベルを導出する。
   * @param {Object|null} me  sides() の出力（実効値で渡す）
   * @param {Object|null} opp 同上。null（相手を表示していない）なら戦型ラベルは出ない
   * @returns {Array<{id:string, label:string}>}
   *   #相居飛車/#対抗形/#相振り飛車 は matchup.threat().kind から。
   *   戦型は排他的な決定木（計画書 §2-1）で1つだけ。複数戦法のときは
   *   「どれか1つでも条件を満たす戦法がある」で判定する:
   *     1. 両者のいずれかの戦法が持ち駒に角を持つ → 角換わり
   *     2. 両者のいずれかの戦法が yokofudori タグを持つ → 横歩取り
   *     3. 両者の囲いが矢倉系 → 相矢倉。片方だけ → 矢倉
   *     4. どちらかの囲いが雁木系 → 雁木（カニ・兜は refFamily があるので判定しない）
   *     5. 両者のいずれかの戦法が aigakari タグを持つ → 相掛かり
   *     6. どれにも当たらない → 出さない
   */
  function labels(me, opp) {
    const out = [];
    if (!me || !opp || !Kakoi.matchup) return out;
    const th = Kakoi.matchup.threat(me, opp);
    out.push({ id: th.kind, label: th.label });
    if (me.strategy !== 'ibisha' || opp.strategy !== 'ibisha') return out;
    const ts = st => (st.tacticIds && st.tacticIds.length ? st.tacticIds : [st.tacticId])
      .map(findTactic).filter(Boolean);
    const t1 = ts(me), t2 = ts(opp);
    const c1 = findCastle(me.castleId), c2 = findCastle(opp.castleId);
    const has = (list, tag) => list.some(t => (t.senkei || []).includes(tag));
    const handKaku = list => list.some(t => (t.hand || '').includes('角'));
    const isYagura = c => !!(c && c.family === 'yagura');
    // カニ囲い・兜囲いは系統上は雁木だが「雁木」戦とは呼ばない（refFamily で除外。計画書 §2-1）
    const isGangi = c => !!(c && c.family === 'gangi' && !c.refFamily);
    let id = null;
    if (handKaku(t1) && handKaku(t2)) id = 'kakugawari';
    else if (has(t1, 'yokofudori') && has(t2, 'yokofudori')) id = 'yokofudori';
    else if (isYagura(c1) && isYagura(c2)) id = 'aiyagura';
    else if (isYagura(c1) || isYagura(c2)) id = 'yagura';
    else if (isGangi(c1) || isGangi(c2)) id = 'gangi';
    else if (has(t1, 'aigakari') && has(t2, 'aigakari')) id = 'aigakari';
    if (id) out.push({ id, label: senkeiName(id) });
    return out;
  }

  const api = {
    emptySlots, normalizeSlots, setSlot, setTactic, removeTactic, clearSide,
    sides, conflicts, evaluate, suggest, labels, parseSel, normalizeSelected,
    tacticList, KINDS, FIELD,
  };
  Kakoi.constraints = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api; // node からの読み込み用
})();
