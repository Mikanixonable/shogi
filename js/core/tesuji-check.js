// 手筋の frames の検算器（coverage-tesuji §5-3・付録A/B）: 各コマの move（▲/△の指し手）を
// 前のコマの局面から再生し、合法手の列になっていて、次のコマの盤面・持ち駒に一致するかを調べる。
// 純関数（DOM 非依存）。駒の動きは pieces.js が単一権威。
//   読むもの: frames[i] = { move?, sente, gote, hand?, handGote?, caption?, mate? }
//   hand=先手の持ち駒、handGote=後手の持ち駒（文字列、1文字1枚）。どのコマにも handGote が
//   無ければ「後手は何でも打てる」として検算する
// 検査: 駒の動き・成り・行き所のない駒・二歩・自玉の王手放置（窓内に玉があるとき）・
//       持ち駒の増減・次コマとの一致・mate:true または caption に「詰み」とあるコマは
//       窓内の駒だけで手番側に合法手が無いこと
// 限界: 窓の外の駒は無いものとして扱う（出典の全局面での詰み・王手放置は別に確認が要る）
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';
  const { PROMOTED: PROM, BASE, STEPS: STEP, SLIDES: SLIDE, HAND_CHARS } = Kakoi.pieces;

  const KAN = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
  const HAND_KINDS = [...HAND_CHARS];
  const inB = (f, r) => f >= 1 && f <= 9 && r >= 1 && r <= 9;

  const sgn = o => (o === 'sente' ? 1 : -1);
  const inZone = (r, o) => (o === 'sente' ? r <= 3 : r >= 7);
  const deadAt = (p, r, o) => {
    const far = o === 'sente' ? r : 10 - r;
    return (p === '桂' && far <= 2) || ((p === '歩' || p === '香') && far <= 1);
  };

  const PIECE_CHARS = '玉飛角金銀桂香歩と杏圭全馬龍';
  /** "玉82 銀72" のような側の駒列を読む。竜は龍に正規化する */
  function parseSide(str, owner) {
    return (str || '').trim().split(/\s+/).filter(Boolean).map(t => {
      const m = t.match(/^([玉飛角金銀桂香歩と杏圭全馬龍竜])([1-9])([1-9])$/);
      if (!m) throw new Error('駒の書式不正: ' + t);
      return { p: m[1] === '竜' ? '龍' : m[1], f: +m[2], r: +m[3], o: owner };
    });
  }
  const handOf = s => { const h = {}; for (const c of s || '') h[c] = (h[c] || 0) + 1; return h; };
  const handStr = h => Object.entries(h).filter(([, n]) => n > 0).map(([p, n]) => p.repeat(n)).join('');
  const sortStr = s => [...(s || '')].sort().join('');

  class State {
    constructor(pieces, hs, hg) { this.pieces = pieces; this.hand = { sente: { ...hs }, gote: { ...hg } }; }
    clone() { return new State(this.pieces.map(x => ({ ...x })), this.hand.sente, this.hand.gote); }
    at(f, r) { return this.pieces.find(x => x.f === f && x.r === r); }
    sig() { return this.pieces.map(x => `${x.o[0]}${x.p}${x.f}${x.r}`).sort().join(' '); }
  }

  /** x が (tf,tr) へ動けるか（成り・不成の別は呼び出し側）。走り駒は途中の駒で止まる */
  function canMove(st, x, tf, tr) {
    const s = sgn(x.o);
    const dfn = (tf - x.f) * s, dr = (tr - x.r) * s;
    const tgt = st.at(tf, tr);
    if (tgt && tgt.o === x.o) return false;
    if ((STEP[x.p] || []).some(([a, b]) => a === dfn && b === dr)) return true;
    for (const [a, b] of SLIDE[x.p] || []) {
      for (let k = 1; k < 9; k++) {
        const f = x.f + a * s * k, r = x.r + b * s * k;
        if (!inB(f, r)) break;
        if (f === tf && r === tr) return true;
        if (st.at(f, r)) break;
      }
    }
    return false;
  }
  const attacked = (st, f, r, by) => st.pieces.some(x => x.o === by && canMove(st, x, f, r));
  function kingSafe(st, owner) {
    const k = st.pieces.find(x => x.o === owner && x.p === '玉');
    return !k || !attacked(st, k.f, k.r, owner === 'sente' ? 'gote' : 'sente');
  }

  /** 「▲2四歩」「△同歩」「▲同角成」「△4二金」「▲2二銀打」を読む。「同」は直前の手（前のコマの最後の手を含む）の行き先 */
  function parseMove(tok, prev) {
    tok = tok.replace(/[（(][^）)]*[）)]/g, '').trim();
    const m = tok.match(/^(▲|△)(同|[1-9][一二三四五六七八九])\s*([玉飛角金銀桂香歩と杏圭全馬龍竜])(成|不成|打)?$/);
    if (!m) return null;
    let f, r;
    if (m[2] === '同') { if (!prev) throw new Error('「同」の直前の手が無い: ' + tok); [f, r] = prev; }
    else { f = +m[2][0]; r = KAN[m[2][1]]; }
    return { owner: m[1] === '▲' ? 'sente' : 'gote', f, r, p: m[3] === '竜' ? '龍' : m[3], flag: m[4] || '' };
  }

  /** 1手を適用して、合法な次状態の一覧を返す（打つ・動かすの両方が成り立てば複数） */
  function apply(st, mv) {
    const outs = [];
    const { owner, f, r, p, flag } = mv;
    // 打つ（成駒・玉は打てない。二歩・行き所のない駒・王手放置は不可）
    if (!BASE[p] && p !== '玉' && !st.at(f, r) && (st.hand[owner][p] || 0) > 0 && flag !== '成' && flag !== '不成') {
      const n = st.clone();
      n.hand[owner][p]--;
      const nifu = p === '歩' && n.pieces.some(x => x.o === owner && x.p === '歩' && x.f === f);
      n.pieces.push({ p, f, r, o: owner });
      if (!deadAt(p, r, owner) && !nifu && kingSafe(n, owner)) outs.push({ st: n, how: `${p}${f}${r}を打つ` });
    }
    if (flag === '打') return outs;
    // 動かす。「歩成」は p の駒が成る手、それ以外は p がそのまま（成駒なら成駒のまま）動いた後の駒種
    for (const x of st.pieces) {
      if (x.o !== owner) continue;
      const promotes = flag === '成' ? (x.p === p && !!PROM[p]) : PROM[x.p] === p;
      const stays = flag === '成' ? false : x.p === p;
      if (!stays && !promotes) continue;
      if (promotes && (flag === '不成' || !(inZone(x.r, owner) || inZone(r, owner)))) continue;
      if (!canMove(st, x, f, r)) continue;
      const result = promotes ? PROM[x.p] : x.p;
      if (!promotes && deadAt(x.p, r, owner)) continue;
      const n = st.clone();
      const cap = n.at(f, r);
      if (cap) { n.pieces = n.pieces.filter(y => y !== cap); const b = BASE[cap.p] || cap.p; n.hand[owner][b] = (n.hand[owner][b] || 0) + 1; }
      const me = n.pieces.find(y => y.f === x.f && y.r === x.r && y.o === owner);
      me.f = f; me.r = r; me.p = result;
      if (kingSafe(n, owner)) outs.push({ st: n, how: `${x.p}${x.f}${x.r}→${result}${f}${r}${cap ? 'x' + cap.p : ''}` });
    }
    return outs;
  }

  /** defender が王手を受けていて、動かす手も打つ手（合駒）も無いか */
  function isMate(st, defender) {
    const k = st.pieces.find(x => x.o === defender && x.p === '玉');
    if (!k) return { mate: false, why: '玉が窓内にいない' };
    if (!attacked(st, k.f, k.r, defender === 'sente' ? 'gote' : 'sente')) return { mate: false, why: '王手がかかっていない' };
    for (const x of st.pieces) {
      if (x.o !== defender) continue;
      for (let f = 1; f <= 9; f++) for (let r = 1; r <= 9; r++) {
        if (!canMove(st, x, f, r)) continue;
        const n = st.clone();
        const cap = n.at(f, r);
        if (cap) n.pieces = n.pieces.filter(y => y !== cap);
        const me = n.pieces.find(y => y.f === x.f && y.r === x.r && y.o === defender);
        me.f = f; me.r = r;
        if (kingSafe(n, defender)) return { mate: false, why: `逃れる手あり: ${x.p}${x.f}${x.r}→${f}${r}` };
      }
    }
    for (const p of HAND_KINDS) {
      if (!(st.hand[defender][p] > 0)) continue;
      for (let f = 1; f <= 9; f++) for (let r = 1; r <= 9; r++) {
        if (st.at(f, r) || deadAt(p, r, defender)) continue;
        if (p === '歩' && st.pieces.some(x => x.o === defender && x.p === '歩' && x.f === f)) continue;
        const n = st.clone(); n.pieces.push({ p, f, r, o: defender });
        if (kingSafe(n, defender)) return { mate: false, why: `合駒・受けあり: ${p}${f}${r}を打つ` };
      }
    }
    return { mate: true };
  }

  /** unknownG: true のとき、handGote 未指定を「後手の持ち駒は不明（何でも打てる）」とみなす */
  function frameState(fr, unknownG) {
    const hg = handOf(fr.handGote !== undefined ? fr.handGote : '');
    if (fr.handGote === undefined && unknownG) for (const p of HAND_KINDS) hg[p] = 9;
    return new State([...parseSide(fr.sente, 'sente'), ...parseSide(fr.gote, 'gote')], handOf(fr.hand), hg);
  }

  function sanity(st, label, issues, win) {
    const seen = new Set(), pawnF = { sente: new Set(), gote: new Set() };
    for (const x of st.pieces) {
      const k = x.f * 10 + x.r;
      if (seen.has(k)) issues.push(`${label}: ${x.f}${x.r} に駒が重なる`);
      seen.add(k);
      if (win && (x.f < win.files[0] || x.f > win.files[1] || x.r < win.ranks[0] || x.r > win.ranks[1])) issues.push(`${label}: ${x.p}${x.f}${x.r} が窓の外`);
      if (x.p === '歩') { if (pawnF[x.o].has(x.f)) issues.push(`${label}: ${x.o === 'sente' ? '先手' : '後手'}の二歩 ${x.f}筋`); pawnF[x.o].add(x.f); }
      if (deadAt(x.p, x.r, x.o)) issues.push(`${label}: 行き所のない ${x.p}${x.f}${x.r}`);
    }
    for (const o of ['sente', 'gote']) if (st.pieces.filter(x => x.o === o && x.p === '玉').length > 1) issues.push(`${label}: 玉が2枚`);
  }

  /** 手筋1件の frames を再生して検算する。@returns {{issues:string[], notes:string[]}} */
  function check(t) {
    const issues = [], notes = [];
    const d = t.diagram;
    if (!d || !d.frames || !d.frames.length) return { issues: ['diagram なし'], notes };
    const anyHG = d.frames.some(f => f.handGote !== undefined);
    let cur;
    try { cur = frameState(d.frames[0], !anyHG); } catch (e) { return { issues: [e.message], notes }; }
    if (!anyHG) notes.push('後手の持ち駒が未指定（何でも打てるとして検算）');
    sanity(cur, 'frame0', issues, d);
    let prevDest = null;
    for (let i = 1; i < d.frames.length; i++) {
      const fr = d.frames[i];
      const toks = (fr.move || '').replace(/（[^）]*）/g, ' ').split(/\s+/).filter(Boolean);
      let states = [{ st: cur, how: [] }], failed = false;
      for (const tk of toks) {
        let mv;
        try { mv = parseMove(tk, prevDest); } catch (e) { issues.push(`frame${i}: ${e.message}`); failed = true; break; }
        if (!mv) { issues.push(`frame${i}: 指し手を読めない「${tk}」`); failed = true; break; }
        const next = [];
        for (const s of states) for (const o of apply(s.st, mv)) next.push({ st: o.st, how: [...s.how, o.how] });
        if (!next.length) { issues.push(`frame${i}: 「${tk}」は合法手でない（駒の動き・持ち駒・二歩・行き所・王手放置のどれか）`); failed = true; break; }
        states = next; prevDest = [mv.f, mv.r];
      }
      let want;
      try { want = frameState(fr, false); } catch (e) { issues.push(`frame${i}: ${e.message}`); break; }
      if (failed) { cur = want; continue; }
      sanity(want, `frame${i}`, issues, d);
      const hit = states.find(s => s.st.sig() === want.sig());
      if (!hit) {
        issues.push(`frame${i}: move「${fr.move}」の結果が次コマの盤面と一致しない。再生結果: ${states[0].st.sig()} / 図: ${want.sig()}`);
      } else {
        const hs = sortStr(handStr(hit.st.hand.sente)), hw = sortStr(fr.hand || '');
        if (hs !== hw) issues.push(`frame${i}: 先手の持ち駒が合わない（再生=${hs || 'なし'} / 図=${hw || 'なし'}）`);
        if (fr.handGote !== undefined) {
          const gs = sortStr(handStr(hit.st.hand.gote)), gw = sortStr(fr.handGote || '');
          if (gs !== gw) issues.push(`frame${i}: 後手の持ち駒が合わない（再生=${gs || 'なし'} / 図=${gw || 'なし'}）`);
        }
        notes.push(`frame${i}: ${hit.how.join(' / ')}`);
        if (fr.mate === true || /詰み/.test(fr.caption || '')) {
          const defender = toks[toks.length - 1].startsWith('▲') ? 'gote' : 'sente';
          const m = isMate(hit.st, defender);
          if (!m.mate) issues.push(`frame${i}: ${fr.mate === true ? 'mate:true' : 'caption に「詰み」'}とあるが詰みでない（${m.why}）`);
          else notes.push(`frame${i}: 詰み（窓内の駒だけで検算）`);
        }
      }
      cur = hit ? hit.st : want;
    }
    return { issues, notes };
  }

  // ---------- onCastle の整合（coverage-tesuji 付録B） ----------
  // ids の囲いの core を（side が 'gote' なら180度回して）requires と集合として一致させる。
  // mirrorIds は筋も反転する。requires は初形の囲い側（onCastle.side）に含まれていることも見る
  function onCastleIssues(t, ctx) {
    const issues = [];
    const oc = t && t.onCastle;
    if (!oc) return issues;
    const side = oc.side === 'gote' ? 'gote' : 'sente';
    const req = new Set((oc.requires || '').trim().split(/\s+/).filter(Boolean));
    const fr0 = t.diagram && t.diagram.frames && t.diagram.frames[0];
    const diag = new Set((fr0 && fr0[side] || '').trim().split(/\s+/).filter(Boolean));
    if (![...req].every(x => diag.has(x))) issues.push('onCastle.requires が初形の囲い側に無い');
    const rot = (c, mirror) => new Set((c.core || '').trim().split(/\s+/).filter(Boolean).map(tk => {
      let f = +tk[1], r = +tk[2];
      if (side === 'gote') { f = 10 - f; r = 10 - r; }
      if (mirror) f = 10 - f;
      return tk[0] + f + r;
    }));
    const same = (a, b) => a.size === b.size && [...a].every(x => b.has(x));
    for (const [ids, mirror] of [[oc.ids || [], false], [oc.mirrorIds || [], true]]) {
      for (const id of ids) {
        const c = (ctx && ctx.CASTLES || []).find(x => x && x.id === id);
        if (!c) issues.push(`onCastle: 囲いが無い ${id}`);
        else if (!same(rot(c, mirror), req)) issues.push(`onCastle: ${id} の core が requires と不一致${mirror ? '（反転）' : ''}`);
      }
    }
    return issues;
  }

  Kakoi.tesujiCheck = { parseSide, parseMove, apply, check, isMate, onCastleIssues };
})();
