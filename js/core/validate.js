// 検証: 囲い・想定配置・出典のデータを検査する純関数群（データは ctx で受け取り、グローバルは読まない）
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';
  const { key, parsePieces } = Kakoi.notation;

  // 先手の駒の総数（盤上＋持ち駒）
  const FULL_SET = { 玉: 1, 飛: 1, 角: 1, 金: 2, 銀: 2, 桂: 2, 香: 2, 歩: 9 };
  const RATING_KEYS = ['hard', 'wide', 'top', 'side', 'quick'];
  const TACTIC_RATING_KEYS = ['attack', 'speed', 'flex', 'safety', 'easy'];
  const TOKEN = /^[玉飛角金銀桂香歩][1-9][1-9]$/;
  // 手筋の図（diagram.frames）だけ成駒（と杏圭全馬龍・竜は龍に正規化）を認める
  const DIAGRAM_TOKEN = /^[玉飛角金銀桂香歩と杏圭全馬龍竜][1-9][1-9]$/;
  const HAND_TOKEN = /^[歩香桂銀金角飛]+$/;
  const SQ = /^[1-9][1-9]$/;
  // [[ref]] / [[ref1|ref2]] の出典トークンの形は html.js が唯一の権威（Kakoi.html.citeRefs を使う）
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

  /**
   * 本文中の [[ref]] トークンを取り出して検査する（計画書 §7）。
   * 各 ref は SOURCES に登録済みで、かつ declared（その項目の sources の ref 集合）に含まれること。
   * 返り値は引用された ref の集合（照合は呼び側で未引用の警告に使う）
   */
  function cites(ctx, text, declared, label, errors) {
    const out = new Set();
    for (const ref of Kakoi.html.citeRefs(text)) {
      out.add(ref);
      if (!ctx.SOURCES || !ctx.SOURCES[ref]) errors.push(`${label}: 未登録の出典トークン ${ref}`);
      else if (!declared.has(ref)) errors.push(`${label}: 出典トークンがsourcesに宣言されていない ${ref}`);
    }
    return out;
  }

  /** sources 配列から ref の集合を作る（壊れた要素はスキップ。本体の検査が別途エラーにする） */
  function declaredRefs(sources) {
    return new Set((isArr(sources) ? sources : []).filter(s => s && isStr(s.ref)).map(s => s.ref));
  }

  /** 格言 id の集合。ctx.PROVERBS（tesuji.js の台帳）を優先し、無ければ ctx.TESUJI の proverbs から集める */
  function proverbIds(ctx) {
    const ids = new Set();
    for (const p of isArr(ctx && ctx.PROVERBS) ? ctx.PROVERBS : []) if (p && isStr(p.id)) ids.add(p.id);
    if (!ids.size) for (const t of isArr(ctx && ctx.TESUJI) ? ctx.TESUJI : []) {
      for (const id of (t && isArr(t.proverbs) ? t.proverbs : [])) ids.add(id);
    }
    return ids;
  }
  // proverbs の要素が格言 id か自由文かを分ける簡易判定（台帳の id は小文字英数とハイフン）
  const PROVERB_ID = /^[a-z0-9-]+$/;

  /**
   * 読み物フィールド（README §3-2）: history / origin / steps / players / proverbs。
   * 任意項目なので欠落はエラーにせず、形式が違うものだけを報告する。
   *   history・origin: 文字列
   *   steps: 文字列（'▲7六歩 ▲6八銀 …'。各手は ▲ か △ で始まる。coverage-tesuji §5-7）
   *   players: 配列（各要素は文字列、または { name, games? }）
   *   proverbs: 配列（各要素は格言 id（PROVERBS 台帳）か自由文の文字列）
   */
  function readingFields(o, ctx, errors) {
    if (o.history !== undefined && !isStr(o.history)) errors.push('historyが文字列でない');
    if (o.origin !== undefined && !isStr(o.origin)) errors.push('originが文字列でない');
    if (o.steps !== undefined) {
      if (!isStr(o.steps)) errors.push('stepsが文字列でない');
      else for (const m of o.steps.trim().split(/\s+/).filter(Boolean))
        if (!/^[▲△]/.test(m)) errors.push(`stepsの手が▲/△で始まらない: ${m}`);
    }
    if (o.players !== undefined) {
      const ok = isArr(o.players) && o.players.every(p =>
        isStr(p) || (p && !isArr(p) && typeof p === 'object' && isStr(p.name) && (p.games === undefined || isStr(p.games))));
      if (!ok) errors.push('playersが文字列または{name, games?}の配列でない');
    }
    if (o.proverbs !== undefined) {
      if (!isArr(o.proverbs) || !o.proverbs.every(isStr)) errors.push('proverbsが文字列の配列でない');
      else {
        const ids = proverbIds(ctx);
        o.proverbs.forEach((p, i) => {
          if (PROVERB_ID.test(p) && !ids.has(p)) errors.push(`proverbs[${i}]は未登録の格言idに見える: ${p}`);
        });
      }
    }
  }

  /** 読み物フィールド内の [[ref]] を desc などと同じく登録・宣言済みの出典か検査し、引用 ref を cited に集める */
  function citeReading(o, ctx, declared, cited, errors) {
    const add = s => { for (const r of s) cited.add(r); };
    add(cites(ctx, o.history, declared, 'history', errors));
    add(cites(ctx, o.origin, declared, 'origin', errors));
    add(cites(ctx, o.steps, declared, 'steps', errors));
    (isArr(o.players) ? o.players : []).forEach((p, i) => {
      if (isStr(p)) add(cites(ctx, p, declared, `players[${i}]`, errors));
      else if (p && typeof p === 'object' && !isArr(p)) {
        add(cites(ctx, p.name, declared, `players[${i}].name`, errors));
        add(cites(ctx, p.games, declared, `players[${i}].games`, errors));
      }
    });
    (isArr(o.proverbs) ? o.proverbs : []).forEach((p, i) => {
      if (isStr(p) && !PROVERB_ID.test(p)) add(cites(ctx, p, declared, `proverbs[${i}]`, errors));
    });
  }

  /** 先手の駒（盤上＋持ち駒）が全部で1組と一致するか。持ち駒は "角" のような文字列（1文字1枚）か配列。
      setup.missing（駒落ちで欠ける駒）があれば期待枚数から差し引く */
  function fullSet(list, hand, errors, missing) {
    const expected = { ...FULL_SET };
    for (const p of missing || '') if (expected[p] !== undefined) expected[p] -= 1;
    const count = {};
    for (const x of list) count[x.p] = (count[x.p] || 0) + 1;
    if (hand !== undefined && typeof hand !== 'string' && !isArr(hand)) errors.push('handが文字列でも配列でもない');
    else for (const p of hand || []) count[p] = (count[p] || 0) + 1;
    for (const [p, n] of Object.entries(FULL_SET)) if ((count[p] || 0) !== expected[p]) errors.push(`${p}の枚数 ${count[p] || 0}/${expected[p]}`);
  }

  function castleBody(c, ctx, errors, warnings) {
    for (const k of ['id', 'name', 'short', 'reading', 'core', 'shell', 'desc'])
      if (!isStr(c[k])) errors.push(`必須項目なし: ${k}`);
    if (typeof c.filler !== 'string') errors.push('必須項目なし: filler（空文字可の文字列）');
    const fam = isArr(ctx.CASTLE_FAMILIES) ? ctx.CASTLE_FAMILIES.find(f => f && f.id === c.family) : undefined;
    if (!fam) errors.push(`family未登録: ${c.family}`);
    else if (c.subtype !== undefined && !(isArr(fam.subtypes) && fam.subtypes.some(s => s && s.id === c.subtype)))
      errors.push(`subtype未登録: ${c.subtype}`);
    if (c.refFamily !== undefined && !isStr(c.refFamily)) errors.push('refFamilyが空文字または文字列でない');
    // basic: 初心者向けに強調する基本の囲い（左ドックで目立たせる）
    if (c.basic !== undefined && c.basic !== true) errors.push('basicはtrueだけを書く');
    if (c.from !== undefined) {
      const src = isArr(ctx.CASTLES) && isStr(c.from) ? ctx.CASTLES.find(x => x && x.id === c.from) : undefined;
      if (!src) errors.push(`from未登録: ${c.from}`);
      else if (src.id === c.id) errors.push('fromが自分自身');
      else if (src.side !== c.side) errors.push(`fromの戦型が異なる: ${c.from}`);
    }
    // 追加の任意フィールド（§6-3）: aliases / note / kingWing / strategies
    if (c.aliases !== undefined && !(isArr(c.aliases) && c.aliases.every(isStr))) errors.push('aliasesが文字列の配列でない');
    if (c.note !== undefined) {
      if (typeof c.note !== 'string') errors.push('noteが文字列でない');
      else if (c.note.includes('【要確認】')) warnings.push(`要確認: ${c.note}`); // エラーではなく警告で残す（§6-1）
    }
    // kingWing:'rook' は「玉飛接近だが意図的な構え」（右玉）の印（§6-3）
    if (c.kingWing !== undefined && !['rook', 'left', 'right', 'center'].includes(c.kingWing)) errors.push(`kingWing不正: ${c.kingWing}`);
    if (c.strategies !== undefined && !(isArr(c.strategies) && c.strategies.length > 0 && c.strategies.every(s => s === 'ibisha' || s === 'furibisha')))
      errors.push('strategiesがibisha/furibishaの空でない配列でない');
    // 読み物フィールド（README §3-2）: history / origin / steps / players / proverbs は任意。形式だけ検査
    readingFields(c, ctx, errors);
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

    // 先手の駒: 想定配置＋囲いの周辺(shell)＋比較用の補完(filler)＋残りの守り駒(rest)＋囲い本体(core)
    const coreList = pieces(c.core, 'core', errors, { owner: 'sente', role: 'core' });
    const restList = pieces(c.rest, 'rest', errors, { owner: 'sente', role: 'rest' });
    const sente = [
      ...(setup ? pieces(setup.pieces, 'setup.pieces', errors, { owner: 'sente', role: 'setup' }) : []),
      ...pieces(c.shell, 'shell', errors, { owner: 'sente', role: 'shell' }),
      ...pieces(c.filler, 'filler', errors, { owner: 'sente', role: 'filler' }),
      ...restList,
      ...coreList,
    ];
    const squares = dupAndNifu(sente, '', errors);
    deadSquares(sente, 'sente', '先手', errors);
    if (setup) fullSet(sente, c.hand, errors, setup.missing);

    // flex: 戦法に貸し出せる core の駒。sq は core の駒があるマス、to は行き先のマス
    if (c.flex !== undefined) {
      if (!isArr(c.flex)) errors.push('flexが配列でない');
      else {
        const coreSq = new Set(coreList.map(x => key(x.f, x.r)));
        c.flex.forEach((fx, i) => {
          if (!fx || !SQ.test(String(fx.sq))) { errors.push(`flex[${i}].sq不正: ${fx && fx.sq}`); return; }
          if (!coreSq.has(Number(fx.sq))) errors.push(`flex[${i}].sq(${fx.sq})にcoreの駒がない`);
          if (!isArr(fx.to) || fx.to.length === 0) errors.push(`flex[${i}].toが空または配列でない`);
          else checkSquares(fx.to, `flex[${i}].to`, errors);
        });
      }
    }

    // rest: core に含まれない守り駒の置き場所（計画書 §2 L1）。囲いは守り駒すべての
    // 行き先を core+rest で指定する。玉・金・銀・桂・香のみ、マスは core と重複しない
    if (c.rest !== undefined) {
      if (typeof c.rest !== 'string') errors.push('restが文字列でない');
      else {
        const coreSq = new Set(coreList.map(x => key(x.f, x.r)));
        for (const x of restList) {
          if (!'玉金銀桂香'.includes(x.p)) errors.push(`restに守り駒以外の駒がある: ${x.p}${x.f}${x.r}`);
          if (coreSq.has(key(x.f, x.r))) errors.push(`restのマスがcoreと重複: ${x.f}${x.r}`);
        }
      }
    }
    // leave は rest＋castle.hand 処理へ移行した（旧フィールドは残さない）
    if (c.leave !== undefined) errors.push('leaveはrestへ移行した（旧フィールドは残さない）');

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

    // [[ref]] トークンの整合（§7）: 引用は登録・宣言済みの ref のみ。
    // 宣言済みで未引用の ref は警告として1行に集約する（逆方向は移行中も許容）
    {
      const declared = declaredRefs(c.sources);
      const cited = new Set();
      const add = s => { for (const r of s) cited.add(r); };
      add(cites(ctx, c.desc, declared, 'desc', errors));
      add(cites(ctx, c.note, declared, 'note', errors));
      (isArr(c.pros) ? c.pros : []).forEach((x, i) => add(cites(ctx, x && x.t, declared, `pros[${i}]`, errors)));
      (isArr(c.cons) ? c.cons : []).forEach((x, i) => add(cites(ctx, x && x.t, declared, `cons[${i}]`, errors)));
      (isArr(c.attacks) ? c.attacks : []).forEach((a, i) => add(cites(ctx, a && a.t, declared, `attacks[${i}]`, errors)));
      citeReading(c, ctx, declared, cited, errors);
      const uncited = [...declared].filter(r => !cited.has(r));
      if (uncited.length) warnings.push(`宣言済みだが本文で未引用の出典: ${uncited.join(', ')}`);
    }
  }

  /** 系統1件の検査（id / name / shape、subtype の id は重複なし） */
  function family(f) {
    const r = result();
    try {
      if (!f || typeof f !== 'object') { r.errors.push('系統がオブジェクトでない'); return r; }
      const miss = ['id', 'name', 'shape'].filter(k => !isStr(f[k]));
      if (miss.length) r.errors.push(`必須項目なし: ${miss.join(', ')}`);
      if (!isArr(f.subtypes)) r.errors.push('subtypesが配列でない');
      else {
        const ids = new Set();
        f.subtypes.forEach((s, i) => {
          if (!s || !isStr(s.id) || !isStr(s.name)) r.errors.push(`subtypes[${i}]のid/nameなし`);
          else if (ids.has(s.id)) r.errors.push(`subtype idが重複: ${s.id}`);
          else ids.add(s.id);
        });
      }
    } catch (x) { r.errors.push(`検証中の例外: ${x && x.message}`); }
    return r;
  }

  /** 囲い1件の検査。ctx = { SETUPS, SOURCES, CASTLE_FAMILIES, CASTLES? }（CASTLES は from の参照先） */
  function castle(c, ctx) {
    const r = result();
    try {
      if (!c || typeof c !== 'object') r.errors.push('囲いがオブジェクトでない');
      else castleBody(c, ctx || {}, r.errors, r.warnings);
    } catch (x) { r.errors.push(`検証中の例外: ${x && x.message}`); }
    return r;
  }

  /** 想定配置1件の検査 */
  function setup(s, ctx) {
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

  const PIECE_CHARS = '飛銀角金桂香歩玉';

  /** 戦法の系統1件の検査（id / name / side / piece） */
  function tacticFamily(f) {
    const r = result();
    try {
      if (!f || typeof f !== 'object') { r.errors.push('系統がオブジェクトでない'); return r; }
      const miss = ['id', 'name'].filter(k => !isStr(f[k]));
      if (miss.length) r.errors.push(`必須項目なし: ${miss.join(', ')}`);
      if (!['ibisha', 'furibisha'].includes(f.side)) r.errors.push(`side不正: ${f.side}`);
      if (!(isStr(f.piece) && f.piece.length === 1 && PIECE_CHARS.includes(f.piece))) r.errors.push(`piece不正: ${f.piece}`);
      if (f.note !== undefined && !isStr(f.note)) r.errors.push('noteが空文字または文字列でない');
    } catch (x) { r.errors.push(`検証中の例外: ${x && x.message}`); }
    return r;
  }

  function tacticBody(t, ctx, errors, warnings) {
    if (t.basic !== undefined && t.basic !== true) errors.push('basicはtrueだけを書く');
    if (t.basic && t.variantOf) errors.push('派生（variantOf）はbasicにしない');
    // turn: 後手番専用の表示フラグ（§4-4。書くなら 'gote' だけ）
    if (t.turn !== undefined && t.turn !== 'gote') errors.push(`turnは'gote'だけを書く: ${t.turn}`);
    for (const k of ['id', 'name', 'reading', 'pieces', 'context', 'desc'])
      if (!isStr(t[k])) errors.push(`必須項目なし: ${k}`);
    const fam = isArr(ctx.TACTIC_FAMILIES) ? ctx.TACTIC_FAMILIES.find(f => f && f.id === t.family) : undefined;
    if (!fam) errors.push(`family未登録: ${t.family}`);
    if (t.aliases !== undefined && !(isArr(t.aliases) && t.aliases.every(isStr))) errors.push('aliasesが文字列の配列でない');
    if (t.note !== undefined) {
      if (typeof t.note !== 'string') errors.push('noteが文字列でない');
      else if (t.note.includes('【要確認】')) warnings.push(`要確認: ${t.note}`); // エラーではなく警告で残す（§6-1）
    }
    // senkei: 戦型判定用のタグ（角換わり・相掛かりなど。§1-4 / §6-2）
    if (t.senkei !== undefined && !(isArr(t.senkei) && t.senkei.every(isStr))) errors.push('senkeiが文字列の配列でない');
    // 読み物フィールド（README §3-2）: history / origin / steps / players / proverbs は任意。形式だけ検査
    readingFields(t, ctx, errors);
    for (const [name, list] of [['pros', t.pros], ['cons', t.cons]]) {
      if (!isArr(list)) { errors.push(`${name}が配列でない`); continue; }
      list.forEach((x, i) => { if (!x || !isStr(x.t)) errors.push(`${name}[${i}].tなし`); });
    }

    const lead = t.lead;
    let leadOk = false;
    if (!lead || typeof lead !== 'object') errors.push('leadなし');
    else {
      leadOk = true;
      if (!(isStr(lead.piece) && lead.piece.length === 1 && PIECE_CHARS.includes(lead.piece))) { errors.push(`lead.piece不正: ${lead.piece}`); leadOk = false; }
      if (!isArr(lead.files) || lead.files.length === 0 || !lead.files.every(n => Number.isInteger(n) && n >= 1 && n <= 9)) { errors.push('lead.filesが1..9の整数の空でない配列でない'); leadOk = false; }
      if (!(typeof lead.square === 'string' && SQ.test(lead.square))) { errors.push(`lead.square不正: ${lead.square}`); leadOk = false; }
      if (fam && leadOk && !fam.mixed && fam.piece !== lead.piece) errors.push(`系統の駒(${fam.piece})とlead.piece(${lead.piece})が違う`);
      if (leadOk && !lead.files.includes(Number(lead.square[0]))) errors.push(`lead.square(${lead.square})の筋がlead.filesにない`);
    }

    if (!isArr(t.route) || t.route.length === 0) errors.push('routeが空または配列でない');
    else {
      checkSquares(t.route, 'route', errors);
      if (lead && t.route[t.route.length - 1] !== lead.square) errors.push(`routeの最後(${t.route[t.route.length - 1]})がlead.square(${lead.square})でない`);
    }

    // againstTactic: 相手の戦法idごとの相性（§3-1）。{戦法id: 評価} のオブジェクトか {tactic, level, why?} の配列
    const tacticIds = new Set((isArr(ctx.TACTICS) ? ctx.TACTICS : []).map(x => x && x.id));
    if (t.againstTactic !== undefined) {
      const okLevel = v => ['good', 'ok', 'ng'].includes(v);
      if (isArr(t.againstTactic)) {
        t.againstTactic.forEach((a, i) => {
          if (!a || typeof a !== 'object' || isArr(a)) { errors.push(`againstTactic[${i}]がオブジェクトでない`); return; }
          if (!isStr(a.tactic)) errors.push(`againstTactic[${i}].tacticなし`);
          else if (!tacticIds.has(a.tactic)) errors.push(`againstTactic[${i}].tactic未登録: ${a.tactic}`);
          if (!okLevel(a.level)) errors.push(`againstTactic[${i}].level不正: ${a.level}`);
        });
      } else if (t.againstTactic && typeof t.againstTactic === 'object') {
        for (const [k, v] of Object.entries(t.againstTactic)) {
          if (!tacticIds.has(k)) errors.push(`againstTacticのキー未登録: ${k}`);
          if (!okLevel(v)) errors.push(`againstTactic.${k}の値不正: ${v}`);
        }
      } else errors.push('againstTacticがオブジェクトでも配列でもない');
    }

    // variantOf: 派生戦法は親と同じ「主役の最終マス」（lead.square）を持つ（§4-3 / §6-2）
    if (t.variantOf !== undefined) {
      if (!isStr(t.variantOf)) errors.push('variantOfが文字列でない');
      else if (!tacticIds.has(t.variantOf)) errors.push(`variantOfの親が未登録: ${t.variantOf}`);
      else if (t.variantOf === t.id) errors.push('variantOfが自分自身を指している');
      else if (leadOk) {
        const parent = (ctx.TACTICS || []).find(x => x && x.id === t.variantOf);
        const pSq = parent && parent.lead && parent.lead.square;
        if (pSq && pSq !== t.lead.square)
          errors.push(`variantOf(${t.variantOf})と主役の最終マスが違う: ${t.lead.square} vs ${pSq}`);
      }
    }

    if (t.ratings !== undefined) {
      if (!t.ratings || typeof t.ratings !== 'object') errors.push('ratingsがオブジェクトでない');
      else for (const k of TACTIC_RATING_KEYS) {
        const v = t.ratings[k];
        if (!Number.isInteger(v) || v < 1 || v > 5) errors.push(`ratings.${k}が1..5の整数でない: ${v}`);
      }
    }
    const sente = pieces(t.pieces, 'pieces', errors, { owner: 'sente', role: 'tactic' });
    dupAndNifu(sente, '', errors);
    deadSquares(sente, 'sente', '先手', errors);
    fullSet(sente, t.hand, errors);
    if (leadOk) {
      const on = sente.find(x => x.f === Number(lead.square[0]) && x.r === Number(lead.square[1]));
      if (!on) errors.push(`lead.square(${lead.square})に駒がない`);
      else if (on.p !== lead.piece) errors.push(`lead.square(${lead.square})の駒が${on.p}で、lead.piece(${lead.piece})でない`);
    }

    if (t.castles !== undefined) errors.push('castlesはpairingsへ移行した（旧フィールドは残さない）');

    // essential: 戦法が手放せない駒。pieces の部分集合（同じ駒表記）
    const pieceTokens = new Set(isStr(t.pieces) ? t.pieces.trim().split(/\s+/).filter(Boolean) : []);
    let essentialList = [];
    if (!isStr(t.essential)) errors.push('必須項目なし: essential');
    else {
      essentialList = pieces(t.essential, 'essential', errors, { owner: 'sente', role: 'essential' });
      for (const tok of t.essential.trim().split(/\s+/).filter(Boolean))
        if (TOKEN.test(tok) && !pieceTokens.has(tok)) errors.push(`essentialの駒がpiecesにない: ${tok}`);
    }

    if (!['rapid', 'slow', 'both'].includes(t.pace)) errors.push(`pace不正: ${t.pace}`);
    if (!t.against || typeof t.against !== 'object' || isArr(t.against)) errors.push('againstがオブジェクトでない');
    else for (const [k, v] of Object.entries(t.against)) {
      if (!['ibisha', 'furibisha'].includes(k)) errors.push(`againstのキー不正: ${k}`);
      if (!['good', 'ok', 'ng'].includes(v)) errors.push(`against.${k}の値不正: ${v}`);
    }

    // pairings: { castle, level, why, sources }。◎(best) は why と出典が必須
    const castleById = new Map((isArr(ctx.CASTLES) ? ctx.CASTLES : []).filter(c => c && isStr(c.id)).map(c => [c.id, c]));
    if (!isArr(t.pairings)) errors.push('pairingsが配列でない');
    else {
      const seenCastles = new Set();
      t.pairings.forEach((p, i) => {
        if (!p || typeof p !== 'object') { errors.push(`pairings[${i}]がオブジェクトでない`); return; }
        const c = castleById.get(p.castle);
        if (!c) errors.push(`pairings[${i}].castle未登録: ${p.castle}`);
        if (seenCastles.has(p.castle)) errors.push(`pairingsのcastleが重複: ${p.castle}`);
        else seenCastles.add(p.castle);
        if (!['best', 'ok', 'ng'].includes(p.level)) errors.push(`pairings[${i}].level不正: ${p.level}`);
        if (p.level === 'best' && !isStr(p.why)) errors.push(`pairings[${i}]（◎）にwhyがない`);
        // overrides: ○/◎ が上書きできる衝突コードの明示（L2）。
        // SIDE / KING_ROOK / SAME_WING は原則なので上書き対象から外す
        if (p.overrides !== undefined) {
          const OK = new Set(['SQUARE', 'PAWN', 'COUNT', 'HAND']);
          if (!isArr(p.overrides) || !p.overrides.length) errors.push(`pairings[${i}].overridesが空の配列`);
          else for (const code of p.overrides) {
            if (!isStr(code) || !OK.has(code)) errors.push(`pairings[${i}].overrides不正: ${code}`);
          }
          if (p.level === 'ng') errors.push(`pairings[${i}](×) にoverridesがある（×は上書きしない）`);
        }
        if (p.sources !== undefined && !isArr(p.sources)) errors.push(`pairings[${i}].sourcesが配列でない`);
        if (p.level === 'best' && !(isArr(p.sources) && p.sources.length > 0)) errors.push(`pairings[${i}]（◎）に出典がない`);
        for (const s of isArr(p.sources) ? p.sources : []) {
          if (!s || !isStr(s.ref)) errors.push(`pairings[${i}].sourcesのrefなし`);
          else if (!ctx.SOURCES || !ctx.SOURCES[s.ref]) errors.push(`未登録の出典: ${s.ref}`);
          if (!s || !isStr(s.for)) errors.push(`pairings[${i}].sourcesのforなし`);
        }
        // why の [[ref]] はこの pairing の sources に宣言された ref のみ（§7）
        {
          const pDecl = declaredRefs(p.sources);
          const pCited = cites(ctx, p.why, pDecl, `pairings[${i}].why`, errors);
          const pUncited = [...pDecl].filter(r => !pCited.has(r));
          if (pUncited.length) warnings.push(`pairings[${i}](${p.castle}): 宣言済みだが未引用の出典: ${pUncited.join(', ')}`);
        }
        // 「◎が実は×」の検出: essential の駒と囲いの core が同じマスを要求していないか
        if (p.level === 'best' && c && essentialList.length) {
          const coreSq = new Set(pieces(c.core, `castle:${c.id}.core`, [], {}).map(x => key(x.f, x.r)));
          if (essentialList.some(e => coreSq.has(key(e.f, e.r))))
            errors.push(`◎だが必須の駒と囲いが同じマスを要求: ${t.id}×${c.id}`);
        }
      });
    }

    if (!isArr(t.sources) || t.sources.length === 0) errors.push('sourcesが空');
    else {
      t.sources.forEach((s, i) => {
        if (!s || !isStr(s.ref)) errors.push(`sources[${i}].refなし`);
        else if (!ctx.SOURCES || !ctx.SOURCES[s.ref]) errors.push(`未登録の出典: ${s.ref}`);
        if (!s || !isStr(s.for)) errors.push(`sources[${i}].forなし`);
      });
      if (t.sources.length < 2) warnings.push(`sourcesが${t.sources.length}件（2件以上が望ましい）`);
    }

    // [[ref]] トークンの整合（§7）: 引用は登録・宣言済みの ref のみ。
    // 宣言済みで未引用の ref は警告として1行に集約する（逆方向は移行中も許容）
    {
      const declared = declaredRefs(t.sources);
      const cited = new Set();
      const add = s => { for (const r of s) cited.add(r); };
      add(cites(ctx, t.desc, declared, 'desc', errors));
      add(cites(ctx, t.context, declared, 'context', errors));
      add(cites(ctx, t.note, declared, 'note', errors));
      (isArr(t.pros) ? t.pros : []).forEach((x, i) => add(cites(ctx, x && x.t, declared, `pros[${i}]`, errors)));
      (isArr(t.cons) ? t.cons : []).forEach((x, i) => add(cites(ctx, x && x.t, declared, `cons[${i}]`, errors)));
      citeReading(t, ctx, declared, cited, errors);
      const uncited = [...declared].filter(r => !cited.has(r));
      if (uncited.length) warnings.push(`宣言済みだが本文で未引用の出典: ${uncited.join(', ')}`);
    }
  }

  /** 戦法1件の検査。ctx = { TACTIC_FAMILIES, SOURCES, CASTLES } */
  function tactic(t, ctx) {
    const r = result();
    try {
      if (!t || typeof t !== 'object') r.errors.push('戦法がオブジェクトでない');
      else tacticBody(t, ctx || {}, r.errors, r.warnings);
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

  /** お楽しみ（fun.js）: proverbs / memes は t・n・src(登録済みの ref)が必須。videos は t・n と YouTube 検索の u */
  function fun(F, ctx) {
    const r = result();
    for (const [name, needSrc] of [['proverbs', true], ['memes', true], ['videos', false]]) {
      const list = F && F[name];
      if (!isArr(list) || !list.length) { r.errors.push(`${name}が空または配列でない`); continue; }
      const seen = new Set();
      list.forEach((x, i) => {
        if (!x || !isStr(x.t) || !isStr(x.n)) { r.errors.push(`${name}[${i}]にt/nがない`); return; }
        if (seen.has(x.t)) r.errors.push(`${name}[${i}]が重複: ${x.t}`);
        seen.add(x.t);
        if (needSrc) {
          if (!isArr(x.src) || !x.src.length) r.errors.push(`${name}[${i}](${x.t})にsrcがない`);
          else for (const s of x.src) if (!s || !ctx.SOURCES || !ctx.SOURCES[s.ref]) r.errors.push(`${name}[${i}](${x.t})の出典が未登録: ${s && s.ref}`);
        } else if (!/^https:\/\/www\.youtube\.com\/results\?search_query=/.test(x.u || '')) r.errors.push(`${name}[${i}](${x.t})のuがYouTube検索のURLでない`);
      });
    }
    return r;
  }

  /** 戦型（senkei.js）1件の検査（coverage-senkei §3-5）。
      tactics/castles（側別 {ibisha,furibisha} も平坦化）・group・parent・[[ref]] の整合。
      axis/when は任意。when はデータ保持の形だけ見る（評価器は作らない） */
  function senkeiEntry(e, ctx) {
    const r = result();
    try {
      if (!e || typeof e !== 'object') { r.errors.push('戦型がオブジェクトでない'); return r; }
      for (const k of ['name', 'desc']) if (!isStr(e[k])) r.errors.push(`必須項目なし: ${k}`);
      const SK = ctx.SENKEI || {}, GR = ctx.SENKEI_GROUPS || {};
      const flat = v => Array.isArray(v) ? v : [...(v && v.ibisha || []), ...(v && v.furibisha || [])];
      const tIds = new Set((isArr(ctx.TACTICS) ? ctx.TACTICS : []).map(t => t && t.id));
      const cIds = new Set((isArr(ctx.CASTLES) ? ctx.CASTLES : []).map(c => c && c.id));
      if (e.group !== undefined && !GR[e.group]) r.errors.push(`group未登録: ${e.group}`);
      if (e.parent !== undefined && !SK[e.parent]) r.errors.push(`parent未登録: ${e.parent}`);
      if (e.axis !== undefined && !['rook', 'approach', 'style'].includes(e.axis)) r.errors.push(`axis不正: ${e.axis}`);
      if (e.when !== undefined && (typeof e.when !== 'object' || e.when === null || isArr(e.when)))
        r.errors.push('whenがオブジェクトでない');
      for (const [k, v] of [['tactics', e.tactics], ['castles', e.castles]]) {
        if (v === undefined) continue;
        const shapeOk = isArr(v) || (v && typeof v === 'object'
          && Object.keys(v).every(x => x === 'ibisha' || x === 'furibisha')
          && Object.values(v).every(x => x === undefined || isArr(x)));
        if (!shapeOk) { r.errors.push(`${k}が配列でも側別オブジェクトでもない`); continue; }
        const ids = k === 'tactics' ? tIds : cIds;
        for (const id of flat(v)) if (!ids.has(id)) r.errors.push(`${k}未登録: ${id}`);
      }
      if (!isArr(e.sources) || e.sources.length === 0) r.errors.push('sourcesが空');
      else e.sources.forEach((s, i) => {
        if (!s || !isStr(s.ref)) r.errors.push(`sources[${i}].refなし`);
        else if (!ctx.SOURCES || !ctx.SOURCES[s.ref]) r.errors.push(`未登録の出典: ${s.ref}`);
      });
      const declared = declaredRefs(e.sources);
      const cited = new Set([
        ...cites(ctx, e.desc, declared, 'desc', r.errors),
        ...cites(ctx, e.note, declared, 'note', r.errors),
      ]);
      const uncited = [...declared].filter(x => !cited.has(x));
      if (uncited.length) r.warnings.push(`宣言済みだが本文で未引用の出典: ${uncited.join(', ')}`);
    } catch (x) { r.errors.push(`検証中の例外: ${x && x.message}`); }
    return r;
  }

  /** 戦型の大分類（SENKEI_GROUPS）1件の検査。name・desc の [[ref]] を見る */
  function senkeiGroup(g, ctx) {
    const r = result();
    try {
      if (!g || typeof g !== 'object') { r.errors.push('大分類がオブジェクトでない'); return r; }
      for (const k of ['name', 'desc']) if (!isStr(g[k])) r.errors.push(`必須項目なし: ${k}`);
      for (const s of (isArr(g.sources) ? g.sources : [])) {
        if (!s || !isStr(s.ref)) r.errors.push('sourcesのrefなし');
        else if (!ctx.SOURCES || !ctx.SOURCES[s.ref]) r.errors.push(`未登録の出典: ${s.ref}`);
      }
      const declared = declaredRefs(g.sources);
      cites(ctx, g.desc, declared, 'desc', r.errors);
    } catch (x) { r.errors.push(`検証中の例外: ${x && x.message}`); }
    return r;
  }

  // ---------- 手筋・格言・定番セット（coverage-tesuji §5-3〜§5-9） ----------
  // 図の駒列を DIAGRAM_TOKEN で読む（pieces() の成駒対応版）
  function diaPieces(str, label, errors, extra) {
    if (str === undefined || str === null || str === '') return [];
    if (typeof str !== 'string') { errors.push(`${label}が文字列でない`); return []; }
    const good = [];
    for (const t of str.trim().split(/\s+/).filter(Boolean)) {
      if (DIAGRAM_TOKEN.test(t)) good.push(t);
      else errors.push(`${label}の駒表記が不正: ${t}`);
    }
    return parsePieces(good.join(' '), extra);
  }
  const PIECE_CHARS_ALL = '玉飛角金銀桂香歩と杏圭全馬龍';
  const PROVERB_GROUPS = ['opening', 'pieces', 'defense', 'endgame'];

  /** 手筋1件の検査。ctx = { CASTLES, SOURCES, TESUJI?, PROVERBS? }（coverage-tesuji §5-3） */
  function tesuji(t, ctx) {
    const r = result();
    const errors = r.errors, warnings = r.warnings;
    try {
      if (!t || typeof t !== 'object') { errors.push('手筋がオブジェクトでない'); return r; }
      for (const k of ['id', 'name', 'reading', 'desc']) if (!isStr(t[k])) errors.push(`必須項目なし: ${k}`);
      if (!['attack', 'defense', 'both'].includes(t.role)) errors.push(`role不正: ${t.role}`);
      if (!(isStr(t.piece) && t.piece.length === 1 && PIECE_CHARS_ALL.includes(t.piece))) errors.push(`piece不正: ${t.piece}`);
      if (t.aliases !== undefined && !(isArr(t.aliases) && t.aliases.every(isStr))) errors.push('aliasesが文字列の配列でない');
      if (t.note !== undefined) {
        if (typeof t.note !== 'string') errors.push('noteが文字列でない');
        else if (t.note.includes('【要確認】')) warnings.push(`要確認: ${t.note}`);
      }
      // counters: 受けの手筋→攻め筋 id（どれかの囲いの attacks にある id であること）
      if (t.counters !== undefined) {
        if (!isArr(t.counters) || !t.counters.every(isStr)) errors.push('countersが文字列の配列でない');
        else {
          const atkIds = new Set((isArr(ctx.CASTLES) ? ctx.CASTLES : []).flatMap(c => (c.attacks || []).map(a => a.id)));
          for (const id of t.counters) if (!atkIds.has(id)) errors.push(`countersの攻め筋idがどの囲いにも無い: ${id}`);
        }
      }
      // detect: 検出器の登録表（K.tesuji.detectors）にある id だけ
      if (t.detect !== undefined && !(Kakoi.tesuji && Kakoi.tesuji.detectors && Kakoi.tesuji.detectors[t.detect]))
        errors.push(`detect未登録の検出器: ${t.detect}`);
      // proverbs: 格言 id（PROVERBS 台帳）
      if (t.proverbs !== undefined) {
        if (!isArr(t.proverbs) || !t.proverbs.every(isStr)) errors.push('proverbsが文字列の配列でない');
        else {
          const ids = proverbIds(ctx);
          for (const id of t.proverbs) if (!ids.has(id)) errors.push(`proverbs未登録: ${id}`);
        }
      }
      // onCastle（任意）: 崩し方が対象とする囲い（§5-4）
      if (t.onCastle !== undefined) {
        const oc = t.onCastle;
        if (!oc || typeof oc !== 'object' || isArr(oc)) errors.push('onCastleがオブジェクトでない');
        else {
          if (!['sente', 'gote'].includes(oc.side)) errors.push(`onCastle.side不正: ${oc.side}`);
          const cIds = new Set((isArr(ctx.CASTLES) ? ctx.CASTLES : []).map(c => c && c.id));
          for (const k of ['ids', 'mirrorIds']) {
            if (oc[k] !== undefined && !(isArr(oc[k]) && oc[k].every(isStr))) errors.push(`onCastle.${k}が文字列の配列でない`);
            else for (const id of oc[k] || []) if (!cIds.has(id)) errors.push(`onCastle.${k}未登録: ${id}`);
          }
          if (!isStr(oc.requires)) errors.push('onCastle.requiresなし');
          else diaPieces(oc.requires, 'onCastle.requires', errors);
          checkSquares(oc.weak || [], 'onCastle.weak', errors);
          if (oc.note !== undefined && !isStr(oc.note)) errors.push('onCastle.noteが文字列でない');
        }
      }
      // diagram: 窓とコマ送り（§5-0〜§5-3。handGote/turn/mate は任意の拡張）
      const d = t.diagram;
      if (!d || typeof d !== 'object') errors.push('diagramなし');
      else {
        const win = (v, name) => {
          if (!(isArr(v) && v.length === 2 && v.every(n => Number.isInteger(n) && n >= 1 && n <= 9))) errors.push(`${name}が1..9の2要素でない`);
          else if (v[0] > v[1]) errors.push(`${name}の範囲が逆`);
        };
        win(d.files, 'diagram.files'); win(d.ranks, 'diagram.ranks');
        // turn: 後手番専用の表示フラグ（書くなら 'gote' だけ。'sente' は既定なので省略する）
        if (d.turn !== undefined && d.turn !== 'gote') errors.push(`diagram.turnは'gote'だけを書く: ${d.turn}`);
        if (d.full !== undefined && d.full !== true) errors.push('diagram.fullはtrueだけを書く');
        if (!isArr(d.frames) || d.frames.length === 0) errors.push('diagram.framesが空または配列でない');
        else {
          d.frames.forEach((fr, i) => {
            if (!fr || typeof fr !== 'object') { errors.push(`frames[${i}]がオブジェクトでない`); return; }
            const list = [
              ...diaPieces(fr.sente, `frames[${i}].sente`, errors, { owner: 'sente' }),
              ...diaPieces(fr.gote, `frames[${i}].gote`, errors, { owner: 'gote' }),
            ];
            // 二歩は side ごとの禁則（先手と後手の歩が同じ筋に居てもよい）
            dupAndNifu(list.filter(x => x.owner === 'sente'), `frames[${i}].sente`, errors);
            dupAndNifu(list.filter(x => x.owner === 'gote'), `frames[${i}].gote`, errors);
            deadSquares(list.filter(x => x.owner === 'sente'), 'sente', `frames[${i}].sente`, errors);
            deadSquares(list.filter(x => x.owner === 'gote'), 'gote', `frames[${i}].gote`, errors);
            if (isArr(d.files) && isArr(d.ranks)) for (const x of list)
              if (x.f < d.files[0] || x.f > d.files[1] || x.r < d.ranks[0] || x.r > d.ranks[1])
                errors.push(`frames[${i}]: ${x.p}${x.f}${x.r} が窓の外`);
            for (const k of ['hand', 'handGote'])
              if (fr[k] !== undefined && !(typeof fr[k] === 'string' && (fr[k] === '' || HAND_TOKEN.test(fr[k]))))
                errors.push(`frames[${i}].${k}が持ち駒の書式でない: ${fr[k]}`);
            if (fr.move !== undefined) {
              if (!isStr(fr.move)) errors.push(`frames[${i}].moveが文字列でない`);
              else for (const m of fr.move.replace(/（[^）]*）/g, ' ').trim().split(/\s+/).filter(Boolean))
                if (!/^[▲△]/.test(m)) errors.push(`frames[${i}].moveの手が▲/△で始まらない: ${m}`);
            }
            if (fr.mate !== undefined && fr.mate !== true) errors.push(`frames[${i}].mateはtrueだけを書く`);
            if (fr.caption !== undefined && typeof fr.caption !== 'string') errors.push(`frames[${i}].captionが文字列でない`);
          });
        }
      }
      // 手順の合法性の検算（core/tesuji-check.js）
      if (Kakoi.tesujiCheck) {
        for (const i of Kakoi.tesujiCheck.check(t).issues) errors.push(`検算: ${i}`);
        for (const i of Kakoi.tesujiCheck.onCastleIssues(t, ctx)) errors.push(i);
      }
      // sources と [[ref]] の整合
      if (!isArr(t.sources) || t.sources.length === 0) errors.push('sourcesが空');
      else {
        t.sources.forEach((s, i) => {
          if (!s || !isStr(s.ref)) errors.push(`sources[${i}].refなし`);
          else if (!ctx.SOURCES || !ctx.SOURCES[s.ref]) errors.push(`未登録の出典: ${s.ref}`);
          if (!s || !isStr(s.for)) errors.push(`sources[${i}].forなし`);
        });
        const declared = declaredRefs(t.sources);
        const cited = new Set([...cites(ctx, t.desc, declared, 'desc', errors), ...cites(ctx, t.note, declared, 'note', errors)]);
        const uncited = [...declared].filter(x => !cited.has(x));
        if (uncited.length) warnings.push(`宣言済みだが本文で未引用の出典: ${uncited.join(', ')}`);
      }
    } catch (x) { errors.push(`検証中の例外: ${x && x.message}`); }
    return r;
  }

  /** 格言1件の検査（§5-9。id/group/text/reading/desc・任意の alt/links/fun/sources） */
  function proverb(p, ctx) {
    const r = result();
    try {
      if (!p || typeof p !== 'object') { r.errors.push('格言がオブジェクトでない'); return r; }
      for (const k of ['id', 'group', 'text', 'reading', 'desc']) if (!isStr(p[k])) r.errors.push(`必須項目なし: ${k}`);
      const groups = isArr(ctx.PROVERB_GROUPS) ? ctx.PROVERB_GROUPS.map(g => isArr(g) ? g[0] : g) : PROVERB_GROUPS;
      if (!groups.includes(p.group)) r.errors.push(`group未登録: ${p.group}`);
      if (p.alt !== undefined && !(isArr(p.alt) && p.alt.every(isStr))) r.errors.push('altが文字列の配列でない');
      if (p.fun !== undefined && typeof p.fun !== 'boolean') r.errors.push('funが真偽値でない');
      if (p.links !== undefined) {
        const L = p.links;
        if (!L || typeof L !== 'object' || isArr(L)) r.errors.push('linksがオブジェクトでない');
        else {
          for (const l of L.tesuji || []) {
            if (!l || !isStr(l.id)) r.errors.push('links.tesujiの要素にidがない');
            if (!['source', 'inferred', 'weak'].includes(l.basis)) r.errors.push(`links.tesujiのbasis不正: ${l.basis}`);
          }
          for (const k of ['attacks', 'families', 'tactics'])
            if (L[k] !== undefined && !(isArr(L[k]) && L[k].every(isStr))) r.errors.push(`links.${k}が文字列の配列でない`);
          if (L.castles !== undefined) {
            const c = L.castles, cIds = new Set((isArr(ctx.CASTLES) ? ctx.CASTLES : []).map(x => x && x.id));
            if (isArr(c)) for (const id of c) { if (!cIds.has(id)) r.errors.push(`links.castles未登録: ${id}`); }
            else if (c && typeof c === 'object') {
              for (const id of c.ids || []) if (!cIds.has(id)) r.errors.push(`links.castles未登録: ${id}`);
              if (c.when !== undefined && !isStr(c.when)) r.errors.push('links.castles.whenが文字列でない');
            } else r.errors.push('links.castlesが配列でもオブジェクトでもない');
          }
        }
      }
      if (p.sources !== undefined) {
        if (!isArr(p.sources)) r.errors.push('sourcesが配列でない');
        else {
          for (const s of p.sources) {
            if (!s || !isStr(s.ref)) r.errors.push('sourcesのrefなし');
            else if (!ctx.SOURCES || !ctx.SOURCES[s.ref]) r.errors.push(`未登録の出典: ${s.ref}`);
            if (!s || !isStr(s.for)) r.errors.push('sourcesのforなし');
          }
        }
      }
      // [[ref]] は登録済みであること（台帳の desc は sources 宣言なしで引用してよい）
      for (const ref of Kakoi.html.citeRefs(p.desc))
        if (!ctx.SOURCES || !ctx.SOURCES[ref]) r.errors.push(`desc: 未登録の出典トークン ${ref}`);
    } catch (x) { r.errors.push(`検証中の例外: ${x && x.message}`); }
    return r;
  }

  /** 定番セット1件の検査（combos.js: tactic×castle の両方が登録済みの id であること） */
  function combo(c, ctx) {
    const r = result();
    try {
      if (!c || typeof c !== 'object') { r.errors.push('定番セットがオブジェクトでない'); return r; }
      for (const k of ['id', 'name', 'reading', 'desc']) if (!isStr(c[k])) r.errors.push(`必須項目なし: ${k}`);
      const tIds = new Set((isArr(ctx.TACTICS) ? ctx.TACTICS : []).map(t => t && t.id));
      const cIds = new Set((isArr(ctx.CASTLES) ? ctx.CASTLES : []).map(x => x && x.id));
      if (!tIds.has(c.tactic)) r.errors.push(`tactic未登録: ${c.tactic}`);
      if (!cIds.has(c.castle)) r.errors.push(`castle未登録: ${c.castle}`);
      for (const k of ['named', 'basic']) if (c[k] !== undefined && c[k] !== true) r.errors.push(`${k}はtrueだけを書く`);
      if (c.vs !== undefined) {
        if (!c.vs || typeof c.vs !== 'object' || isArr(c.vs)) r.errors.push('vsがオブジェクトでない');
        else {
          if (!tIds.has(c.vs.tactic)) r.errors.push(`vs.tactic未登録: ${c.vs.tactic}`);
          if (!cIds.has(c.vs.castle)) r.errors.push(`vs.castle未登録: ${c.vs.castle}`);
        }
      }
      if (!isArr(c.sources) || c.sources.length === 0) r.errors.push('sourcesが空');
      else {
        for (const s of c.sources) {
          if (!s || !isStr(s.ref)) r.errors.push('sourcesのrefなし');
          else if (!ctx.SOURCES || !ctx.SOURCES[s.ref]) r.errors.push(`未登録の出典: ${s.ref}`);
          if (!s || !isStr(s.for)) r.errors.push('sourcesのforなし');
        }
        const declared = declaredRefs(c.sources);
        const cited = cites(ctx, c.desc, declared, 'desc', r.errors);
        const uncited = [...declared].filter(x => !cited.has(x));
        if (uncited.length) r.warnings.push(`宣言済みだが本文で未引用の出典: ${uncited.join(', ')}`);
      }
    } catch (x) { r.errors.push(`検証中の例外: ${x && x.message}`); }
    return r;
  }

  /** 全データの検査。ctx = { CASTLES, SETUPS, SOURCES, CASTLE_FAMILIES, TACTICS, TACTIC_FAMILIES, STRATEGIES?, SENKEI?, SENKEI_GROUPS? } */
  function all(ctx) {
    const results = [], warnings = [];
    const used = new Set(), seen = new Set(), tseen = new Set();
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
    const famIds = new Set();
    for (const f of isArr(ctx.CASTLE_FAMILIES) ? ctx.CASTLE_FAMILIES : []) {
      const r = family(f);
      if (f && famIds.has(f.id)) r.errors.push(`idが重複: ${f.id}`);
      if (f) famIds.add(f.id);
      results.push({ kind: 'family', id: f && f.id, ...r });
    }
    for (const [sid, s] of Object.entries(ctx.SETUPS || {})) {
      for (const x of (s && isArr(s.sources) ? s.sources : [])) if (x && x.ref) used.add(x.ref);
      results.push({ kind: 'setup', id: sid, ...setup(s, ctx) });
    }
    for (const t of isArr(ctx.TACTICS) ? ctx.TACTICS : []) {
      const r = tactic(t, ctx);
      const id = t && t.id;
      if (tseen.has(id)) r.errors.push(`idが重複: ${id}`);
      tseen.add(id);
      for (const s of (t && isArr(t.sources) ? t.sources : [])) if (s && s.ref) used.add(s.ref);
      for (const p of (t && isArr(t.pairings) ? t.pairings : []))
        for (const s of (p && isArr(p.sources) ? p.sources : [])) if (s && s.ref) used.add(s.ref);
      results.push({ kind: 'tactic', id, ...r });
    }
    const tfamIds = new Set();
    for (const f of isArr(ctx.TACTIC_FAMILIES) ? ctx.TACTIC_FAMILIES : []) {
      const r = tacticFamily(f);
      if (f && tfamIds.has(f.id)) r.errors.push(`idが重複: ${f.id}`);
      if (f) tfamIds.add(f.id);
      results.push({ kind: 'tacticFamily', id: f && f.id, ...r });
    }
    // 戦略テンプレート（対局図の既定値）。id は ibisha/furibisha、defaultTactic/defaultCastle は登録済みであること
    if (ctx.STRATEGIES !== undefined) {
      const tIds = new Set((isArr(ctx.TACTICS) ? ctx.TACTICS : []).map(t => t && t.id));
      const cIds = new Set((isArr(ctx.CASTLES) ? ctx.CASTLES : []).map(c => c && c.id));
      if (!ctx.STRATEGIES || typeof ctx.STRATEGIES !== 'object' || isArr(ctx.STRATEGIES)) {
        results.push({ kind: 'strategy', id: 'STRATEGIES', errors: ['STRATEGIESがオブジェクトでない'], warnings: [] });
      } else for (const [sid, s] of Object.entries(ctx.STRATEGIES)) {
        const r = result();
        try {
          if (!['ibisha', 'furibisha'].includes(sid)) r.errors.push(`戦略id不正: ${sid}`);
          if (!s || typeof s !== 'object') r.errors.push('戦略がオブジェクトでない');
          else {
            if (!tIds.has(s.defaultTactic)) r.errors.push(`defaultTactic未登録: ${s.defaultTactic}`);
            const dc = s.defaultCastle;
            if (typeof dc === 'string') { if (!cIds.has(dc)) r.errors.push(`defaultCastle未登録: ${dc}`); }
            else if (dc && typeof dc === 'object' && !isArr(dc)) {
              for (const k of ['vsIbisha', 'vsFuribisha']) if (!cIds.has(dc[k])) r.errors.push(`defaultCastle.${k}未登録: ${dc[k]}`);
            } else r.errors.push('defaultCastleが文字列でも{vsIbisha,vsFuribisha}でもない');
          }
        } catch (x) { r.errors.push(`検証中の例外: ${x && x.message}`); }
        results.push({ kind: 'strategy', id: sid, ...r });
      }
    }
    // 戦型（senkei.js。coverage-senkei §3-5）: エントリと大分類の参照整合
    for (const [sid, e] of Object.entries(ctx.SENKEI || {}))
      results.push({ kind: 'senkei', id: sid, ...senkeiEntry(e, ctx) });
    for (const [gid, g] of Object.entries(ctx.SENKEI_GROUPS || {}))
      results.push({ kind: 'senkeiGroup', id: gid, ...senkeiGroup(g, ctx) });
    // 手筋・格言・定番セット（tesuji.js / combos.js。coverage-tesuji §5-3〜§5-9）
    {
      const tjIds = new Set();
      for (const t of isArr(ctx.TESUJI) ? ctx.TESUJI : []) {
        const r = tesuji(t, ctx);
        if (t && tjIds.has(t.id)) r.errors.push(`idが重複: ${t.id}`);
        if (t) tjIds.add(t.id);
        results.push({ kind: 'tesuji', id: t && t.id, ...r });
      }
      const pvIds = new Set();
      for (const p of isArr(ctx.PROVERBS) ? ctx.PROVERBS : []) {
        const r = proverb(p, ctx);
        if (p && pvIds.has(p.id)) r.errors.push(`idが重複: ${p.id}`);
        if (p) pvIds.add(p.id);
        results.push({ kind: 'proverb', id: p && p.id, ...r });
      }
      const cbIds = new Set();
      for (const c of isArr(ctx.COMBOS) ? ctx.COMBOS : []) {
        const r = combo(c, ctx);
        if (c && cbIds.has(c.id)) r.errors.push(`idが重複: ${c.id}`);
        if (c) cbIds.add(c.id);
        results.push({ kind: 'combo', id: c && c.id, ...r });
      }
    }
    // 手筋・格言・定番セット（tesuji.js / combos.js）と戦型（senkei.js・SENKEI_GROUPS）の出典も参照済みとして数える
    for (const t of [...(isArr(ctx.TESUJI) ? ctx.TESUJI : []), ...(isArr(ctx.COMBOS) ? ctx.COMBOS : []),
        ...(isArr(ctx.PROVERBS) ? ctx.PROVERBS : []),
        ...Object.values(ctx.SENKEI || {}), ...Object.values(ctx.SENKEI_GROUPS || {})]) {
      for (const s of (t && isArr(t.sources) ? t.sources : [])) if (s && s.ref) used.add(s.ref);
    }
    // お楽しみ（fun.js）: proverbs / memes の src の ref も参照済みとして数える
    if (ctx.FUN) {
      results.push({ kind: 'fun', id: 'FUN', ...fun(ctx.FUN, ctx) });
      for (const x of [...(isArr(ctx.FUN.proverbs) ? ctx.FUN.proverbs : []),
          ...(isArr(ctx.FUN.memes) ? ctx.FUN.memes : [])]) {
        for (const s of (x && isArr(x.src) ? x.src : [])) if (s && s.ref) used.add(s.ref);
      }
    }
    for (const [ref, s] of Object.entries(ctx.SOURCES || {})) {
      results.push({ kind: 'source', id: ref, ...source(ref, s) });
      if (!used.has(ref)) warnings.push(`source:${ref}: どこからも参照されていない`);
    }
    return { results, warnings };
  }

  Kakoi.validate = { castle, family, tacticFamily, tactic, setup, source, fun, tesuji, proverb, combo, all };
})();
