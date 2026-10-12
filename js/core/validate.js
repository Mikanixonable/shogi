// 検証: 囲い・想定配置・出典のデータを検査する純関数群（データは ctx で受け取り、グローバルは読まない）
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';
  const { key, parsePieces } = Kakoi.notation;

  // 先手の駒の総数（盤上＋持ち駒）
  const FULL_SET = { 玉: 1, 飛: 1, 角: 1, 金: 2, 銀: 2, 桂: 2, 香: 2, 歩: 9 };
  const RATING_KEYS = ['hard', 'wide', 'top', 'side', 'quick'];
  const TOKEN = /^[玉飛角金銀桂香歩][1-9][1-9]$/;
  const SQ = /^[1-9][1-9]$/;
  const isStr = v => typeof v === 'string' && v.length > 0;
  const isArr = Array.isArray;
  const result = () => ({ errors: [], warnings: [] });

  /** 駒文字列を分解し、書式が正しい駒だけ返す（不正なトークンは errors に報告） */
  function pieces(str, label, errors, extra) {
    if (str === undefined || str === null || str === '') return [];
    if (typeof str !== 'string') { errors.push(`${label}が文字列でない`); return []; }
    const tokens = str.trim().split(/\s+/).filter(Boolean);
    const good = [];
    for (const t of tokens) {
      if (TOKEN.test(t)) good.push(t);
      else errors.push(`${label}の駒表記が不正: ${t}`);
    }
    return parsePieces(good.join(' '), extra);
  }

  /** 行き場のない駒（先手: 桂は1〜2段・歩香は1段 / 後手: 桂は8〜9段・歩香は9段） */
  function deadSquares(list, owner, label, errors) {
    for (const x of list) {
      const dead = owner === 'sente'
        ? (x.p === '桂' && x.r <= 2) || ((x.p === '歩' || x.p === '香') && x.r === 1)
        : (x.p === '桂' && x.r >= 8) || ((x.p === '歩' || x.p === '香') && x.r === 9);
      if (dead) errors.push(`${label}: 行き場のない${x.p} ${x.f}${x.r}`);
    }
  }

  /** 同じマスの重複と二歩を調べる。成功時のマス集合を返す */
  function dupAndNifu(list, label, errors) {
    const squares = new Set(), pawnFiles = new Set();
    for (const x of list) {
      const k = key(x.f, x.r);
      if (squares.has(k)) errors.push(`${label}同じマスに2枚: ${x.f}${x.r}`);
      squares.add(k);
      if (x.p === '歩') {
        if (pawnFiles.has(x.f)) errors.push(`${label}二歩: ${x.f}筋`);
        pawnFiles.add(x.f);
      }
    }
    return squares;
  }

  function checkSquares(list, label, errors) {
    if (!isArr(list)) { errors.push(`${label}が配列でない`); return; }
    for (const s of list) if (!SQ.test(String(s))) errors.push(`${label}不正: ${s}`);
  }

  function castleBody(c, ctx, errors, warnings) {
    for (const k of ['id', 'name', 'short', 'reading', 'group', 'core', 'support', 'desc'])
      if (!isStr(c[k])) errors.push(`必須項目なし: ${k}`);
    if (!['ibisha', 'furibisha'].includes(c.side)) errors.push(`side不正: ${c.side}`);
    const setup = isStr(c.setup) && ctx.SETUPS ? ctx.SETUPS[c.setup] : undefined;
    if (!setup) errors.push(`setup未登録: ${c.setup}`);
    if (!isArr(c.tags)) errors.push('tagsが配列でない');
    if (!c.ratings || typeof c.ratings !== 'object') errors.push('ratingsなし');
    else for (const k of RATING_KEYS) {
      const v = c.ratings[k];
      if (!Number.isInteger(v) || v < 1 || v > 5) errors.push(`ratings.${k}が1..5の整数でない: ${v}`);
    }
    for (const [name, list] of [['pros', c.pros], ['cons', c.cons]]) {
      if (!isArr(list)) { errors.push(`${name}が配列でない`); continue; }
      list.forEach((x, i) => {
        if (!x || !isStr(x.t)) errors.push(`${name}[${i}].tなし`);
        if (x && x.sq !== undefined) checkSquares(x.sq, `${name}[${i}].sq`, errors);
      });
    }

    // 先手の駒: 想定配置＋補助＋囲い
    const sente = [
      ...(setup ? pieces(setup.pieces, 'setup.pieces', errors, { owner: 'sente', role: 'setup' }) : []),
      ...pieces(c.support, 'support', errors, { owner: 'sente', role: 'support' }),
      ...pieces(c.core, 'core', errors, { owner: 'sente', role: 'core' }),
    ];
    const squares = dupAndNifu(sente, '', errors);
    deadSquares(sente, 'sente', '先手', errors);
    if (setup) {
      const count = {};
      for (const x of sente) count[x.p] = (count[x.p] || 0) + 1;
      // 持ち駒は "角" のような文字列（1文字1枚）
      if (c.hand !== undefined && typeof c.hand !== 'string' && !isArr(c.hand)) errors.push('handが文字列でない');
      else for (const p of c.hand || []) count[p] = (count[p] || 0) + 1;
      for (const [p, n] of Object.entries(FULL_SET)) if (count[p] !== n) errors.push(`${p}の枚数 ${count[p] || 0}/${n}`);
    }

    if (!isArr(c.attacks)) errors.push('attacksが配列でない');
    else {
      const ids = new Set();
      c.attacks.forEach((a, i) => {
        for (const k of ['id', 'name', 't', 'gote']) if (!a || !isStr(a[k])) errors.push(`attacks[${i}].${k}なし`);
        if (!a) return;
        if (ids.has(a.id)) errors.push(`攻め筋idが重複: ${a.id}`);
        ids.add(a.id);
        checkSquares(a.target, `attacks[${i}].target`, errors);
        const gote = pieces(a.gote, `攻め筋「${a.name}」`, errors, { owner: 'gote', role: 'attack' });
        dupAndNifu(gote, `攻め筋「${a.name}」で`, errors);
        deadSquares(gote, 'gote', `攻め筋「${a.name}」`, errors);
        for (const g of gote) if (squares.has(key(g.f, g.r))) errors.push(`攻め筋「${a.name}」の駒が先手と重なる: ${g.f}${g.r}`);
      });
    }

    if (!isArr(c.sources) || c.sources.length === 0) errors.push('sourcesが空');
    else {
      c.sources.forEach((s, i) => {
        if (!s || !isStr(s.ref)) errors.push(`sources[${i}].refなし`);
        else if (!ctx.SOURCES || !ctx.SOURCES[s.ref]) errors.push(`未登録の出典: ${s.ref}`);
        if (!s || !isStr(s.for)) errors.push(`sources[${i}].forなし`);
      });
      if (c.sources.length < 2) warnings.push(`sourcesが${c.sources.length}件（2件以上が望ましい）`);
    }
  }

  /** 囲い1件の検査。ctx = { SETUPS, SOURCES } */
  function castle(c, ctx) {
    const r = result();
    try {
      if (!c || typeof c !== 'object') r.errors.push('囲いがオブジェクトでない');
      else castleBody(c, ctx || {}, r.errors, r.warnings);
    } catch (x) { r.errors.push(`検証中の例外: ${x && x.message}`); }
    return r;
  }

  /** 想定配置1件の検査 */
  function setup(id, s, ctx) {
    const r = result();
    try {
      if (!s || typeof s !== 'object') { r.errors.push('想定配置がオブジェクトでない'); return r; }
      if (!isStr(s.label)) r.errors.push('labelなし');
      const list = pieces(s.pieces, 'pieces', r.errors, { owner: 'sente', role: 'setup' });
      dupAndNifu(list, '', r.errors);
      deadSquares(list, 'sente', '先手', r.errors);
      if (s.sources !== undefined && !isArr(s.sources)) r.errors.push('sourcesが配列でない');
      for (const x of isArr(s.sources) ? s.sources : []) {
        if (!x || !isStr(x.ref)) r.errors.push('sourcesのrefなし');
        else if (!ctx || !ctx.SOURCES || !ctx.SOURCES[x.ref]) r.errors.push(`未登録の出典: ${x.ref}`);
      }
    } catch (x) { r.errors.push(`検証中の例外: ${x && x.message}`); }
    return r;
  }

  /** 出典1件の検査（title / publisher / https の url） */
  function source(ref, s) {
    const r = result();
    try {
      const miss = ['title', 'publisher', 'url'].filter(k => !s || !isStr(s[k]));
      if (s && isStr(s.url) && !/^https:\/\//.test(s.url)) miss.push('url(https://でない)');
      if (miss.length) r.errors.push(miss.join(', '));
    } catch (x) { r.errors.push(`検証中の例外: ${x && x.message}`); }
    return r;
  }

  /** 全データの検査。ctx = { CASTLES, SETUPS, SOURCES } */
  function all(ctx) {
    const results = [], warnings = [];
    const used = new Set(), seen = new Set();
    for (const c of isArr(ctx.CASTLES) ? ctx.CASTLES : []) {
      const r = castle(c, ctx);
      const id = c && c.id;
      if (seen.has(id)) {
        r.errors.push(`idが重複: ${id}`);
        warnings.push(`castle idが重複: ${id}`);
      }
      seen.add(id);
      for (const s of (c && isArr(c.sources) ? c.sources : [])) if (s && s.ref) used.add(s.ref);
      results.push({ kind: 'castle', id, ...r });
    }
    for (const [sid, s] of Object.entries(ctx.SETUPS || {})) {
      for (const x of (s && isArr(s.sources) ? s.sources : [])) if (x && x.ref) used.add(x.ref);
      results.push({ kind: 'setup', id: sid, ...setup(sid, s, ctx) });
    }
    for (const [ref, s] of Object.entries(ctx.SOURCES || {})) {
      results.push({ kind: 'source', id: ref, ...source(ref, s) });
      if (!used.has(ref)) warnings.push(`source:${ref}: どこからも参照されていない`);
    }
    return { results, warnings };
  }

  Kakoi.validate = { castle, setup, source, all };
})();
