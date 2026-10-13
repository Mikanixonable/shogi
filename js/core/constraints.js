// 制約モデル（DOM に依存しない）: 各側の固定スロット {tactic, castle} から、戦略・実効値
// （未選択の層は戦略既定値で補う）と、両立しない選択（✕の理由）・直す候補を導く。
// 選んだものを他の層が勝手に差し替えることはしない: 両立しない組み合わせはそのまま残し、
// conflicts で理由を示し、suggest で両立する候補を返す（選ぶかどうかは使う側が決める）。
// 戦略（居飛車／振り飛車）は制約にしない: 戦法（無ければ囲い）から導く。
// 既定値の解決規則の権威は core/defaults.js、層のスキーマ定数（KINDS/FIELD/WHOS）は
// core/lookup.js が唯一の定義。両立の判定は compat.judge と同じものを使う。
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';

  const { findTactic, findCastle, tacticFamilyOf, castleSides, KINDS, FIELD, WHOS } = Kakoi.lookup;
  const { defaultIdOf } = Kakoi.defaults;

  // ---------- スロット（各側の {tactic, castle}。未選択は null） ----------
  const emptySide = () => ({ tactic: null, castle: null });
  const emptySlots = () => ({ me: emptySide(), opp: emptySide() });
  const isValidId = (kind, id) =>
    typeof id === 'string' && (kind === 'tactic' ? !!findTactic(id) : kind === 'castle' ? !!findCastle(id) : false);

  /** 保存値・ハッシュ由来の slots を、形と id の正当性を確かめて作り直す（不正な値は未選択に戻る） */
  function normalizeSlots(slots) {
    const out = emptySlots();
    for (const who of WHOS) {
      for (const kind of KINDS) {
        const id = slots && slots[who] ? slots[who][kind] : null;
        if (isValidId(kind, id)) out[who][kind] = id;
      }
    }
    return out;
  }

  /** 1つのスロットを置き換えた新しい slots（id=null で外す）。同じ値・不正な id は入力の参照を返す */
  function setSlot(slots, who, kind, id) {
    if (!WHOS.includes(who) || !KINDS.includes(kind)) return slots;
    if (id != null && !isValidId(kind, id)) return slots;
    const v = id == null ? null : id;
    if (slots[who][kind] === v) return slots;
    return { ...slots, [who]: { ...slots[who], [kind]: v } };
  }

  /** その側のスロットを両方外した新しい slots。もともと空なら入力の参照を返す */
  function clearSide(slots, who) {
    if (!WHOS.includes(who) || KINDS.every(k => slots[who][k] == null)) return slots;
    return { ...slots, [who]: emptySide() };
  }

  // ---------- 実効値（戦略の導出と既定値の補完） ----------
  // 戦略は選んだ戦法の系統の side。戦法が無ければ囲いの側、どちらも無ければ居飛車
  function strategyOf(slot) {
    const f = tacticFamilyOf(findTactic(slot.tactic));
    if (f) return f.side;
    const c = findCastle(slot.castle);
    return c ? castleSides(c)[0] : 'ibisha';
  }

  // 未選択の層（戦法→囲いの順）を戦略の既定値で埋め、implied に印を付ける。既定値がいまの
  // 実効状態で ng なら、compat.searchAlternative と同じ規則で両立する値を選ぶ
  // （例: 四枚美濃だけ選んだとき既定戦法では駒が足りない）。明示した層は動かさない
  function fillImplied(s, opp) {
    const eff = { strategy: s.strategy, tacticId: s.tacticId, castleId: s.castleId };
    for (const k of KINDS) {
      if (eff[FIELD[k]] != null) continue;
      s.implied[k] = true;
      const d = defaultIdOf(k, eff.strategy, opp && opp.strategy);
      let v = d;
      if (Kakoi.compat) {
        const base = { ...eff, [FIELD[k]]: d };
        if (d == null || Kakoi.compat.judgeFull(base, k, d, opp).level === 'ng') {
          const rep = Kakoi.compat.searchAlternative(base, k, d, opp);
          if (rep != null) v = rep;
        }
      }
      s[FIELD[k]] = eff[FIELD[k]] = v;
    }
  }

  /**
   * 両側のスロットを実効状態へ展開する。
   * @param {{me:{tactic,castle}, opp:{tactic,castle}}} slots
   * @param {boolean} [showOpp=true] 相手を表示しているか。表示していないとき、自分の既定囲いは
   *   相手の戦略で振り分けず（vsIbisha）、fitness も相手を見ない
   * @returns {{ me:{strategy:string, tacticId:string|null, castleId:string|null,
   *              implied:{tactic?:true, castle?:true}},
   *            opp:Object }}  相手側も常に返す（描くかどうかは showOpp で使う側が決める）
   *   - strategy は戦法の系統の side（無ければ囲いの側、どちらも無ければ居飛車）
   *   - 未選択の層は戦略既定値で補い implied にフラグを立てる（既定の層）
   */
  function sides(slots, showOpp = true) {
    const S = {};
    for (const who of WHOS) {
      const sl = slots[who];
      S[who] = { strategy: strategyOf(sl), tacticId: sl.tactic, castleId: sl.castle, implied: {} };
    }
    // 相手の明示値（既定で補う前）。他方の既定値の振り分けと fitness の相手に使う
    const explicit = who => ({
      strategy: S[who].strategy, tacticId: slots[who].tactic, castleId: slots[who].castle,
    });
    fillImplied(S.me, showOpp ? explicit('opp') : null);
    fillImplied(S.opp, explicit('me'));
    return S;
  }

  // ---------- 両立しない選択（✕の理由）と直す候補 ----------
  const otherOf = (S, who, showOpp) => who === 'me' ? (showOpp ? S.opp : null) : S.me;

  /**
   * 明示した層のうち両立しないものを、その理由つきで返す（既定で補った層は対象外）。
   * @returns {{ me:{tactic?:Array, castle?:Array}, opp:{...} }} ng の層だけキーがある。
   *   値は compat.judge の ng の理由 {code, text, squares?}。表示していない相手は空
   */
  function conflicts(slots, S, showOpp) {
    const out = { me: {}, opp: {} };
    for (const who of WHOS) {
      if (who === 'opp' && !showOpp) continue;
      for (const kind of KINDS) {
        const id = slots[who][kind];
        if (id == null) continue;
        const j = Kakoi.compat.judge(S[who], kind, id, otherOf(S, who, showOpp));
        if (j.level === 'ng') out[who][kind] = j.ng;
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
   * 両立しない選択の直す候補: その層を置き換えたとき ng にならない候補を、
   * 相性表の◎→同じ系統→データ順で並べて返す（自動では差し替えない。選ぶのは使う側）。
   * @returns {string[]} 候補の id（多くても limit 件）
   */
  function suggest(slots, showOpp, who, kind, limit = 6) {
    const cur = slots[who][kind];
    const fam = familyIdOf(kind, cur);
    const all = kind === 'tactic' ? Kakoi.TACTICS : Kakoi.CASTLES;
    const rows = all.filter(x => x.id !== cur)
      .map(x => ({ id: x.id, family: x.family, level: evaluate(slots, showOpp, who, kind, x.id).j.level }))
      .filter(e => e.level !== 'ng');
    const rank = e => (e.level === 'best' ? 0 : 2) + (fam && e.family === fam ? 0 : 1);
    return rows.map((e, i) => ({ id: e.id, i, r: rank(e) }))
      .sort((a, b) => a.r - b.r || a.i - b.i)
      .slice(0, limit).map(e => e.id);
  }

  // ---------- 選択状態の文字列表現（'who.kind'） ----------
  // dock-view / board-screen / board-detail-view / constraint-mode / hash-link で共有する（S2）
  const SEL_RE = /^(me|opp)\.(tactic|castle)$/;
  /** 'me.castle' → {who:'me', kind:'castle'}。形式が違えば null */
  const parseSel = s => {
    const m = SEL_RE.exec(String(s || ''));
    return m ? { who: m[1], kind: m[2] } : null;
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
    return sel.who === 'opp' && !showOpp ? `me.${sel.kind}` : `${sel.who}.${sel.kind}`;
  }

  // ---------- 導出ラベル（戦型は制約にしないで表示だけする） ----------
  const SENKEI_LABELS = {
    kakugawari: '角換わり', yokofudori: '横歩取り', aiyagura: '相矢倉',
    yagura: '矢倉', gangi: '雁木', aigakari: '相掛かり',
  };
  /**
   * 両側の実効状態から戦型ラベルを導出する。
   * @param {Object|null} me  sides() の出力（実効値で渡す）
   * @param {Object|null} opp 同上。null（相手を表示していない）なら戦型ラベルは出ない
   * @returns {Array<{id:string, label:string}>}
   *   #相居飛車/#対抗形/#相振り飛車 は matchup.threat().kind から。
   *   戦型は排他的な決定木（計画書 §2-1）で1つだけ:
   *     1. 両者の戦法が持ち駒に角を持つ → 角換わり
   *     2. 両者の戦法が yokofudori タグを持つ → 横歩取り
   *     3. 両者の囲いが矢倉系 → 相矢倉。片方だけ → 矢倉
   *     4. どちらかの囲いが雁木系 → 雁木（カニ・兜は refFamily があるので判定しない）
   *     5. 両者の戦法が aigakari タグを持つ → 相掛かり
   *     6. どれにも当たらない → 出さない
   */
  function labels(me, opp) {
    const out = [];
    if (!me || !opp || !Kakoi.matchup) return out;
    const th = Kakoi.matchup.threat(me, opp);
    out.push({ id: th.kind, label: th.label });
    if (me.strategy !== 'ibisha' || opp.strategy !== 'ibisha') return out;
    const t1 = findTactic(me.tacticId), t2 = findTactic(opp.tacticId);
    const c1 = findCastle(me.castleId), c2 = findCastle(opp.castleId);
    const has = (t, tag) => !!(t && (t.senkei || []).includes(tag));
    const isYagura = c => !!(c && c.family === 'yagura');
    // カニ囲い・兜囲いは系統上は雁木だが「雁木」戦とは呼ばない（refFamily で除外。計画書 §2-1）
    const isGangi = c => !!(c && c.family === 'gangi' && !c.refFamily);
    let id = null;
    if (t1 && t2 && (t1.hand || '').includes('角') && (t2.hand || '').includes('角')) id = 'kakugawari';
    else if (has(t1, 'yokofudori') && has(t2, 'yokofudori')) id = 'yokofudori';
    else if (isYagura(c1) && isYagura(c2)) id = 'aiyagura';
    else if (isYagura(c1) || isYagura(c2)) id = 'yagura';
    else if (isGangi(c1) || isGangi(c2)) id = 'gangi';
    else if (has(t1, 'aigakari') && has(t2, 'aigakari')) id = 'aigakari';
    if (id) out.push({ id, label: SENKEI_LABELS[id] });
    return out;
  }

  const api = {
    emptySlots, normalizeSlots, setSlot, clearSide,
    sides, conflicts, evaluate, suggest, labels, parseSel, normalizeSelected,
    KINDS, FIELD,
  };
  Kakoi.constraints = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api; // node からの読み込み用
})();
