// 手筋と定番セットの判定（DOM 非依存の純関数。unit-test からも使う）
//   - comboOf: その側の戦法・囲いが定番セット（data/combos.js）にそろったか
//   - forks: 王手飛車の筋。持ち駒の角・桂を1枚打つと玉と飛車に同時に利くマスを探す
//   - sokofu: 下段への飛車打ち（攻め筋）に対する底歩のマス
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';
  const K = window.Kakoi;

  // ---------- 定番セット ----------
  /** 明示で選んだ戦法・囲いがそろった定番セット（既定値で補った層は数えない）。無ければ null。
   *  戦法は複数採用できる（tacticIds）。いずれかの戦法と囲いが一致すれば完成 */
  function comboOf(st, combos = K.COMBOS || []) {
    if (!st || !st.castleId) return null;
    const imp = st.implied || {};
    if (imp.tactic || imp.castle) return null;
    const ids = st.tacticIds || (st.tacticId ? [st.tacticId] : []);
    if (!ids.length) return null;
    return combos.find(c => ids.includes(c.tactic) && c.castle === st.castleId) || null;
  }

  /** 戦法または囲いを含む定番セット（右ドックの「定番セット」に並べる） */
  function combosWith(kind, id, combos = K.COMBOS || []) {
    return combos.filter(c => c[kind] === id);
  }

  // ---------- 利き ----------
  // 動きの定義は pieces.js が単一権威（成駒を含む）。[df, dr] は先手視点の増減（dr<0 が前）
  const { STEPS, SLIDES } = K.pieces;
  const inBoard = (f, r) => f >= 1 && f <= 9 && r >= 1 && r <= 9;
  const sq = (f, r) => `${f}${r}`;

  /** owner の駒 p が (f,r) にいるときに利くマス。has(f,r) で駒の有無を見る（走り駒はぶつかって止まる） */
  function reach(p, f, r, owner, has) {
    const s = owner === 'gote' ? -1 : 1;   // 後手は前後左右が反転する
    const out = [];
    for (const [df, dr] of STEPS[p] || []) {
      const tf = f - df * s, tr = r + dr * s;
      if (inBoard(tf, tr)) out.push(sq(tf, tr));
    }
    for (const [df, dr] of SLIDES[p] || []) {
      for (let tf = f - df * s, tr = r + dr * s; inBoard(tf, tr); tf -= df * s, tr += dr * s) {
        out.push(sq(tf, tr));
        if (has(tf, tr)) break;
      }
    }
    return out;
  }

  /** owner の駒が利いているマスの集合 */
  function covered(position, owner) {
    const has = (f, r) => position.has(f, r);
    const set = new Set();
    for (const x of position.pieces) {
      if (x.owner !== owner) continue;
      for (const t of reach(x.p, x.f, x.r, owner, has)) set.add(t);
    }
    return set;
  }

  // ---------- 王手飛車 ----------
  const other = o => (o === 'sente' ? 'gote' : 'sente');
  // 打てない段（行き所のない駒）。先手は上、後手は下が奥
  const deadRank = (p, r, owner) => {
    const far = owner === 'sente' ? r : 10 - r;
    return (p === '桂' && far <= 2) || ((p === '歩' || p === '香') && far <= 1);
  };

  /** a→b の直線（斜め・縦横）の間にあるマス（両端を含まない）。直線でなければ [] */
  function between(a, b) {
    const df = Math.sign(+b[0] - +a[0]), dr = Math.sign(+b[1] - +a[1]);
    const n = Math.max(Math.abs(+b[0] - +a[0]), Math.abs(+b[1] - +a[1]));
    if (Math.abs(+b[0] - +a[0]) !== Math.abs(+b[1] - +a[1]) && df && dr) return [];
    const out = [];
    for (let i = 1; i < n; i++) out.push(sq(+a[0] + df * i, +a[1] + dr * i));
    return out;
  }

  /**
   * 王手飛車の筋: defender の玉と飛車に、相手が持ち駒を1枚打つだけで同時に利くマス。
   * 打った駒が defender の駒（玉を含む）に取られるマスは除く（取られれば両取りにならない）
   * latent: true なら盤上の歩をすべて取り除いた局面で探し、間をふさいでいた歩を via に返す
   *   （「この歩が動くと筋が通る」。via が空なら今すぐ打てる筋）
   * @param {Kakoi.Position} position 盤全体（両軍）
   * @param {'sente'|'gote'} defender 狙われる側
   * @param {{ pieces?:string[], latent?:boolean }} [opt] 打つ駒の候補（既定は角・桂）
   * @returns {Array<{piece:string, sq:string, king:string, rook:string, via:string[]}>}
   */
  function forks(position, defender, { pieces = ['角', '桂'], latent = false } = {}) {
    const base = latent
      ? new K.Position(position.pieces.filter(x => x.p !== '歩'), position.hand)
      : position;
    const mine = base.pieces.filter(x => x.owner === defender);
    const king = mine.find(x => x.p === '玉');
    const rooks = mine.filter(x => x.p === '飛');
    if (!king || !rooks.length) return [];
    const att = other(defender);
    const guard = covered(base, defender);
    const has = (f, r) => base.has(f, r);
    const kSq = sq(king.f, king.r);
    const pawnAt = s => { const x = position.at(+s[0], +s[1]); return !!(x && x.p === '歩'); };
    // 歩を除いて見つけた筋のうち、間に歩が無いのに今の盤では成り立たないもの
    // （歩が打つマスに利いている・桂の跳び先を歩が守る）は、歩が動いても通るとは言えないので捨てる
    const now = latent ? new Set(forks(position, defender, { pieces }).map(x => x.piece + x.sq)) : null;
    const out = [];
    for (let f = 9; f >= 1; f--) for (let r = 1; r <= 9; r++) {
      const s = sq(f, r);
      if (position.has(f, r) || guard.has(s)) continue;
      for (const p of pieces) {
        if (deadRank(p, r, att)) continue;
        const hits = new Set(reach(p, f, r, att, has));
        if (!hits.has(kSq)) continue;
        const rook = rooks.find(x => hits.has(sq(x.f, x.r)));
        if (!rook) continue;
        const rSq = sq(rook.f, rook.r);
        const via = p === '桂' ? [] : [...between(s, kSq), ...between(s, rSq)].filter(pawnAt);
        if (now && !via.length && !now.has(p + s)) continue;
        out.push({ piece: p, sq: s, king: kSq, rook: rSq, via });
      }
    }
    return out;
  }

  // ---------- 底歩 ----------
  /**
   * 下段（9段目）に打ち込まれた後手の飛車に対する、先手の底歩のマス（先手視点の座標）。
   * 飛車から狙いのマスの方向へ下段をたどり、最初の駒の手前までの空きマスから選ぶ:
   * 先手の駒が利いている（打った歩を取られない）マスのうち、金の真下（金底）→ 玉寄りの順。
   * その筋に先手の歩があるときは nifu: true（二歩。歩を交換した後なら打てる）
   * @param {Kakoi.Position} position 先手の局面（攻め筋の駒は含めない）
   * @param {{ gote:string, target?:string[] }} attack 囲いの攻め筋
   * @returns {{ sq:string, kinzoko:boolean, nifu:boolean }|null}
   */
  function sokofu(position, attack) {
    if (!attack || !attack.gote) return null;
    const rook = K.notation.parsePieces(attack.gote).find(x => x.p === '飛' && x.r === 9);
    if (!rook) return null;
    const targets = (attack.target || []).map(K.notation.parseSquare).filter(t => t.r === 9);
    if (!targets.length) return null;
    // 狙いの重心がある側へ下段をたどる（筋が大きい方向＝先手から見た左）
    const avg = targets.reduce((a, t) => a + t.f, 0) / targets.length;
    const step = avg > rook.f ? 1 : -1;
    const empties = [];
    for (let f = rook.f + step; f >= 1 && f <= 9; f += step) {
      if (position.has(f, 9)) break;
      empties.push(f);
    }
    if (!empties.length) return null;
    const guard = covered(position, 'sente');
    const goldAbove = f => { const x = position.at(f, 8); return !!(x && x.owner === 'sente' && x.p === '金'); };
    const safe = empties.filter(f => guard.has(sq(f, 9)));
    if (!safe.length) return null;
    const pick = safe.find(goldAbove) ?? safe[safe.length - 1];
    const nifu = position.pieces.some(x => x.owner === 'sente' && x.p === '歩' && x.f === pick);
    return { sq: sq(pick, 9), kinzoko: goldAbove(pick), nifu };
  }

  // ---------- frames の投影（coverage-tesuji §5-2） ----------
  // 手筋の図は「技を指す側が下（先手）」に統一。後手の囲いへ重ねるときだけ
  // 180度回して先手・後手を入れ替える（BoardScreen._attackInfo の mirror と同じ変換）
  const flipToken = t => `${t[0]}${10 - +t[1]}${10 - +t[2]}`;
  const flipList = str => (str || '').trim().split(/\s+/).filter(Boolean).map(flipToken).join(' ');

  /** frame を実盤へ投影する。flip:true で座標を180度回し、sente↔gote・hand↔handGote を入れ替える */
  function project(frame, { flip = false } = {}) {
    if (!flip) return { sente: frame.sente, gote: frame.gote, hand: frame.hand, handGote: frame.handGote };
    return {
      sente: flipList(frame.gote), gote: flipList(frame.sente),
      hand: frame.handGote, handGote: frame.hand,
    };
  }

  // ---------- 囲い ↔ 手筋（coverage-tesuji §5-4） ----------
  /**
   * この囲いに結びつく手筋（崩し方）の一覧。
   * 手筋側の onCastle.ids/mirrorIds と、囲い側の attacks[].tesuji の両方から引く
   */
  function forCastle(castle, tesuji = K.TESUJI || []) {
    if (!castle) return [];
    const linked = new Set((castle.attacks || []).flatMap(a => a.tesuji || []));
    return tesuji.filter(t =>
      linked.has(t.id)
      || (t.onCastle && (t.onCastle.ids || []).includes(castle.id))
      || (t.onCastle && (t.onCastle.mirrorIds || []).includes(castle.id)));
  }

  /** この囲いの急所（onCastle.weak。囲いの持ち主＝先手視点の座標）の一覧 */
  function weakSquares(castle, tesuji = K.TESUJI || []) {
    return [...new Set(forCastle(castle, tesuji).flatMap(t => (t.onCastle && t.onCastle.weak) || []))];
  }

  // ---------- 格言（coverage-tesuji §5-9） ----------
  // links.castles の判定式（一覧を持たず式で引く。囲いが増えても追従する）
  function castleWhen(castle, when) {
    if (!castle || typeof when !== 'string' || !when.trim()) return false;
    const core = K.notation.parsePieces(castle.core || '');
    return when.trim().split(/\s+/).every(cond => {
      const [k, v] = cond.split(':');
      switch (k) {
        case 'kingFile': {   // 玉の筋（端玉: '1,9' など）
          const king = core.find(x => x.p === '玉');
          return !!king && String(v).split(',').map(Number).includes(king.f);
        }
        case 'goldRank':     // 金のいる段（先手視点）
          return core.some(x => x.p === '金' && String(v).split(',').map(Number).includes(x.r));
        case 'kingWing':     // 右玉などの構え（castle.kingWing）
          return castle.kingWing === v;
        case 'family':
          return castle.family === v;
        default: return false;
      }
    });
  }

  /**
   * 選択中の囲い・戦法に結びつく格言を引く（§5-9 の links。basis:'source' のみ既定。
   * 囲いは判定式か id 列、戦法は id 列、手筋は手筋 id、攻め筋は攻め筋 id、系統は戦法系統 id）
   * @param {{castle?:Object, tactic?:Object, attackIds?:string[]}} sel
   * @returns {Array<{proverb:Object, basis:string}>}
   */
  function proverbsFor(sel, { basis = 'source' } = {}) {
    const out = [];
    for (const p of K.PROVERBS || []) {
      const L = p.links || {};
      let hit = null;
      for (const l of L.tesuji || []) {
        // 手筋の結びつきは basis を持つ（source ◎ / inferred ○ / weak △）
        if (sel.tesuji && sel.tesuji.id === l.id) hit = l.basis || 'inferred';
      }
      if (!hit && sel.castle && L.castles) {
        const c = L.castles;
        if ((Array.isArray(c) && c.includes(sel.castle.id))
          || (c.ids || []).includes(sel.castle.id)
          || (c.when && castleWhen(sel.castle, c.when))) hit = 'source';
      }
      if (!hit && sel.tactic && (L.tactics || []).includes(sel.tactic.id)) hit = 'source';
      if (!hit && sel.tactic && (L.families || []).includes(sel.tactic.family)) hit = 'source';
      if (!hit && sel.attackIds && (L.attacks || []).some(id => sel.attackIds.includes(id))) hit = 'source';
      if (hit && (basis === 'all' || hit === basis)) out.push({ proverb: p, basis: hit });
    }
    return out;
  }

  // ---------- 登録表（coverage-tesuji §5-4） ----------
  // 受けの手筋 id → 受けの位置を求める関数（BoardScreen._defenses が引く）
  const defenders = { sokofu };
  // 検出器 id → 検出関数（tesuji.detect が指す。'fork' は王手飛車の筋）
  const detectors = { fork: forks };

  K.tesuji = { comboOf, combosWith, reach, covered, between, forks, sokofu,
    project, forCastle, weakSquares, proverbsFor, castleWhen, defenders, detectors };
})();
