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
  // [[ref]] / [[ref1|ref2]] の出典トークン（html.js の TOKEN と同じ形）
  const CITE = /\[\[([^\][|]+(?:\|[^\][|]+)*)\]\]/g;
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
    if (typeof text !== 'string' || text.indexOf('[[') < 0) return out;
    for (const m of text.matchAll(CITE))
      for (const ref of m[1].split('|').map(r => r.trim()).filter(Boolean)) {
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

  /** 先手の駒（盤上＋持ち駒）が全部で1組と一致するか。持ち駒は "角" のような文字列（1文字1枚）か配列 */
  function fullSet(list, hand, errors) {
    const count = {};
    for (const x of list) count[x.p] = (count[x.p] || 0) + 1;
    if (hand !== undefined && typeof hand !== 'string' && !isArr(hand)) errors.push('handが文字列でない');
    else for (const p of hand || []) count[p] = (count[p] || 0) + 1;
    for (const [p, n] of Object.entries(FULL_SET)) if (count[p] !== n) errors.push(`${p}の枚数 ${count[p] || 0}/${n}`);
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

    // 先手の駒: 想定配置＋囲いの周辺(shell)＋比較用の補完(filler)＋囲い本体(core)
    const coreList = pieces(c.core, 'core', errors, { owner: 'sente', role: 'core' });
    const sente = [
      ...(setup ? pieces(setup.pieces, 'setup.pieces', errors, { owner: 'sente', role: 'setup' }) : []),
      ...pieces(c.shell, 'shell', errors, { owner: 'sente', role: 'shell' }),
      ...pieces(c.filler, 'filler', errors, { owner: 'sente', role: 'filler' }),
      ...coreList,
    ];
    const squares = dupAndNifu(sente, '', errors);
    deadSquares(sente, 'sente', '先手', errors);
    if (setup) fullSet(sente, c.hand, errors);

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

    // leave: 「この囲いではその駒がいない」の宣言。「金58」= マス指定、「角」= 盤上全体
    if (c.leave !== undefined) {
      if (typeof c.leave !== 'string') errors.push('leaveが文字列でない');
      else {
        const onBoard = new Set(sente.map(x => x.p));
        for (const t of c.leave.trim().split(/\s+/).filter(Boolean)) {
          if (t.length === 1) {                          // 駒種指定: 盤上に置かない
            if (!/^[玉飛角金銀桂香歩]$/.test(t)) errors.push(`leaveの駒表記が不正: ${t}`);
            else {
              if (onBoard.has(t)) errors.push(`leaveの「${t}」: その駒種が図（setup/shell/filler/core）の中にある`);
              if (!(c.hand || '').includes(t)) warnings.push(`leaveの「${t}」は hand にもあるべき`);
            }
          } else if (!TOKEN.test(t)) errors.push(`leaveの駒表記が不正: ${t}`);
          else if (sente.some(x => x.p === t[0] && x.f === +t[1] && x.r === +t[2]))
            errors.push(`leaveの駒が図（setup/shell/filler/core）の中にある: ${t}`);
        }
      }
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

  /** 囲い1件の検査。ctx = { SETUPS, SOURCES, CASTLE_FAMILIES } */
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
    } catch (x) { r.errors.push(`検証中の例外: ${x && x.message}`); }
    return r;
  }

  function tacticBody(t, ctx, errors, warnings) {
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

  /** 全データの検査。ctx = { CASTLES, SETUPS, SOURCES, CASTLE_FAMILIES, TACTICS, TACTIC_FAMILIES, STRATEGIES? } */
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
      results.push({ kind: 'setup', id: sid, ...setup(sid, s, ctx) });
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
    for (const [ref, s] of Object.entries(ctx.SOURCES || {})) {
      results.push({ kind: 'source', id: ref, ...source(ref, s) });
      if (!used.has(ref)) warnings.push(`source:${ref}: どこからも参照されていない`);
    }
    return { results, warnings };
  }

  Kakoi.validate = { castle, family, tacticFamily, tactic, setup, source, all };
})();
