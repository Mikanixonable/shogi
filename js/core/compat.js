// 両立判定（対局図用。DOM に依存しない）: 「いまの他の層」と候補を compose して、
// 盤上の衝突（SQUARE/PAWN/COUNT/CONTACT）と将棋の原則（玉飛接近・同翼・戦略の整合・手数）
// から3段階（best/ok/ng）で判定する。×を選んだときの自動差し替え resolve もここ。
// 計画書 §3-2（judge）/ §4-2（resolve）。
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';
  const { parsePieces, parseSquare, label } = Kakoi.notation;

  const LAYERS = ['strategy', 'tactic', 'castle'];            // 層の既定順（pick に無い層の並び替え用）
  const FIELD = { strategy: 'strategy', tactic: 'tacticId', castle: 'castleId' };
  const NG_CONFLICT = new Set(['SQUARE', 'PAWN', 'COUNT', 'CONTACT']); // compose の衝突のうち × にするもの
  const findTactic = id => (Kakoi.TACTICS || []).find(t => t && t.id === id) || null;
  const findCastle = id => (Kakoi.CASTLES || []).find(c => c && c.id === id) || null;
  const familyOf = t => t ? (Kakoi.TACTIC_FAMILIES || []).find(f => f && f.id === t.family) || null : null;
  const strategyLabel = s => (Kakoi.STRATEGIES && Kakoi.STRATEGIES[s] && Kakoi.STRATEGIES[s].label) || s || '';
  const normSide = st => ({
    strategy: (st && st.strategy) || null,
    tacticId: (st && st.tacticId) || null,
    castleId: (st && st.castleId) || null,
  });

  // 未選択の層は戦略テンプレートの既定値で補う（matchup.js の _resolveTactic/_resolveCastle と同じ規則）
  const tacticIdOf = st => st.tacticId
    || (st.strategy && Kakoi.STRATEGIES && Kakoi.STRATEGIES[st.strategy]
      ? Kakoi.STRATEGIES[st.strategy].defaultTactic : null);
  function castleIdOf(st, opp) {
    if (st.castleId) return st.castleId;
    const s = st.strategy && Kakoi.STRATEGIES && Kakoi.STRATEGIES[st.strategy];
    const dc = s && s.defaultCastle;
    if (typeof dc === 'string') return dc;
    if (dc) return (opp && opp.strategy === 'furibisha') ? dc.vsFuribisha : dc.vsIbisha;
    return null;
  }
  const tacticOf = st => findTactic(tacticIdOf(st));
  const castleOf = (st, opp) => findCastle(castleIdOf(st, opp));

  // 戦法の飛車（先手視点）。銀が主役の戦法でも盤上の飛車を見る。盤上に無ければ lead.files[0]
  const rookPiece = t => parsePieces(t && t.pieces).find(x => x.p === '飛') || null;
  function rookFile(t) {
    const r = rookPiece(t);
    if (r) return r.f;
    const fs = t && t.lead && t.lead.files;
    return Array.isArray(fs) ? fs[0] : (fs != null ? fs : null);
  }
  const kingPiece = c => parsePieces(c && c.core).find(x => x.p === '玉') || null;
  const wing = f => f <= 3 ? 'right' : f >= 7 ? 'left' : 'center'; // 計画書 §1-3 の翼分け
  const wingName = w => w === 'right' ? '右' : w === 'left' ? '左' : '中央';
  const isFile5 = t => !!(t && t.lead && Array.isArray(t.lead.files) && t.lead.files.includes(5));
  const sqLabel = s => { const { f, r } = parseSquare(s); return label(f, r); };
  const pairingOf = (tactic, castleId) => (tactic && castleId)
    ? (tactic.pairings || []).find(p => p && p.castle === castleId) || null
    : null;

  // ---------- 盤上の評価: 候補を代入した状態 st を compose し、衝突と原則を集める ----------
  // ngReasons（×の理由）と notes（○のまま付ける注記）を分けて返す。結果は選択状態をキーにメモ化
  const evalMemo = new Map();
  function evaluate(st, opp) {
    const k = JSON.stringify([normSide(st), normSide(opp)]);
    if (evalMemo.has(k)) return evalMemo.get(k);
    const v = evaluateInner(st, opp);
    evalMemo.set(k, v);
    return v;
  }
  function evaluateInner(st, opp) {
    if (!Kakoi.compose) throw new Error('Kakoi.compose が未定義（js/core/compose.js を先に読み込むこと）');
    const tactic = tacticOf(st), castle = castleOf(st, opp);
    // 両立判定は常に「戦法優先」で合成する（崩し形の救済を含む実際の形で両立できるか見るため。
    // castle 優先だと essential が持ち駒に移され、貸し出せる組み合わせまで × になる）
    const composed = Kakoi.compose.position({
      strategy: st.strategy, tacticId: st.tacticId, castleId: st.castleId,
      side: 'sente', priority: 'tactic',
    });
    const ng = [], notes = [];
    for (const c of composed.conflicts || []) {
      const r = { code: c.code, text: c.text || String(c.code) };
      if (c.squares) r.squares = c.squares;
      (NG_CONFLICT.has(c.code) ? ng : notes).push(r);
    }
    // flex で貸し出せた駒は × にせず「崩し形」の注記にする（§3-2）
    for (const fx of composed.flexed || []) {
      notes.push({
        code: 'FLEX', squares: [fx.from, fx.to].filter(Boolean),
        text: `${fx.piece}を${sqLabel(fx.from)}から${sqLabel(fx.to)}へ回す崩し形`,
      });
    }
    // SIDE（戦法）: 系統の side と戦略が食い違う。ただし飛車が5筋の戦法は
    // 現在の戦略の中飛車として読み替えるので × にせず注記だけ（§3-2 の例外）
    if (tactic && st.strategy) {
      const fam = familyOf(tactic);
      if (fam && fam.side !== st.strategy) {
        if (isFile5(tactic)) {
          notes.push({ code: 'SIDE', text: `飛車が5筋なので${strategyLabel(st.strategy)}の中飛車として扱う` });
        } else {
          ng.push({ code: 'SIDE', text: `${tactic.name}は${strategyLabel(fam.side)}系の戦法（戦略は${strategyLabel(st.strategy)}）` });
        }
      }
    }
    // SIDE（囲い）: 囲いの side と戦略が食い違う（例外なし）
    if (castle && st.strategy && castle.side !== st.strategy) {
      ng.push({ code: 'SIDE', text: `${castle.name}は${strategyLabel(castle.side)}の囲い（戦略は${strategyLabel(st.strategy)}）` });
    }
    if (tactic && castle) {
      const rp = rookPiece(tactic), kp = kingPiece(castle);
      const rf = rp ? rp.f : rookFile(tactic);
      const kf = kp ? kp.f : null;
      if (rf != null && kf != null) {
        const squares = [rp && `${rp.f}${rp.r}`, kp && `${kp.f}${kp.r}`].filter(Boolean);
        // KING_ROOK: 玉と飛車の筋の差が1以下（玉飛接近すべからず。§1-3）
        if (Math.abs(rf - kf) <= 1) {
          ng.push({ code: 'KING_ROOK', squares, text: `飛車（${rf}筋）と玉（${kf}筋）が隣り合う（玉飛接近）` });
        } else {
          // SAME_WING: 玉と飛車が同じ翼にいる。中央（4〜6筋）は中飛車・右玉の例外で対象外
          const w1 = wing(rf), w2 = wing(kf);
          if (w1 === w2 && w1 !== 'center') {
            ng.push({ code: 'SAME_WING', squares, text: `飛車と玉が同じ${wingName(w1)}側にいる` });
          }
        }
      }
      // TEMPO: 急戦の戦法に手数のかかる囲いは盤上は両立するが間に合いにくい（注記のみ。§1-3）
      if (tactic.pace === 'rapid' && castle.ratings && castle.ratings.quick <= 2) {
        notes.push({ code: 'TEMPO', text: '組むのに手数がかかり、急戦の仕掛けに間に合いにくい' });
      }
    }
    return { ng, notes, moved: composed.moved, composed, tactic, castle };
  }

  // ---------- 囲いの対戦相性スコアの上位帯（§3-2: 上位2件 または 最高点−0.5 以内） ----------
  // 両立する候補だけを対象に、全囲いの fitness を (strategy,tacticId,opp) 単位で1回だけ計算する
  const bandMemo = new Map();
  function fitnessBand(st, opp) {
    const ctx = { strategy: st.strategy || null, tacticId: st.tacticId || null };
    const k = JSON.stringify([ctx, normSide(opp)]);
    if (bandMemo.has(k)) return bandMemo.get(k);
    const tactic = tacticOf(ctx);
    const rows = (Kakoi.CASTLES || []).map(c => {
      const st2 = { ...ctx, castleId: c.id };
      const ev = evaluate(st2, opp);
      const p = pairingOf(tactic, c.id);
      const ng = ev.ng.length > 0 || !!(p && p.level === 'ng');
      const fit = Kakoi.matchup.fitness(c, Kakoi.matchup.threat(st2, opp));
      return { id: c.id, ng, fit };
    });
    const ok = rows.filter(r => !r.ng).sort((a, b) => b.fit - a.fit); // 安定ソート: 同点はデータ順
    const band = ok.length
      ? { top2: new Set(ok.slice(0, 2).map(r => r.id)), max: ok[0].fit }
      : null;
    bandMemo.set(k, band);
    return band;
  }

  // ---------- judge ----------
  const judgeMemo = new Map();
  function judgeFull(me, layer, candidateId, opp) {
    me = me || {};
    const st = { ...me, [FIELD[layer]]: candidateId };
    const ev = evaluate(st, opp);
    const reasons = [...ev.ng, ...ev.notes];
    const ngAll = [...ev.ng];
    let level = ngAll.length ? 'ng' : 'ok';
    let fitness = null;
    let cappedOk = false;
    // 相性表（pairings）: 戦法×囲いの関係。strategy 層の判定には適用しない
    if (layer !== 'strategy' && ev.tactic && ev.castle) {
      const p = pairingOf(ev.tactic, ev.castle.id);
      if (p) {
        reasons.push({ code: 'PAIRING', text: p.why || '相性表の評価' });
        if (p.level === 'ng') {
          const r = { code: 'PAIRING', text: p.why || '相性表で×' };
          ngAll.push(r); level = 'ng';
        } else if (p.level === 'ok') {
          cappedOk = true;                    // ○指定は best への昇格を止める
        } else if (p.level === 'best' && level !== 'ng') {
          level = 'best';
        }
      }
    }
    // fitness: 囲い層かつ相手がいるときだけ。上位帯に入れば ok → best に昇格（§3-2）
    if (layer === 'castle' && opp && ev.castle && Kakoi.matchup) {
      fitness = Kakoi.matchup.fitness(ev.castle, Kakoi.matchup.threat(st, opp));
      if (level === 'ok' && !cappedOk) {
        const band = fitnessBand(st, opp);
        if (band && (band.top2.has(candidateId) || fitness >= band.max - 0.5 - 1e-9)) level = 'best';
      }
    }
    return { level, reasons, moved: ev.moved, fitness, _ng: ngAll };
  }

  /**
   * 候補と「いまの他の層」の両立判定。
   * @param {{strategy:string, tacticId?:string|null, castleId?:string|null, pick?:string[]}} me 選択状態
   * @param {'strategy'|'tactic'|'castle'} layer 候補の層
   * @param {string} candidateId 戦略キー / 戦法id / 囲いid
   * @param {Object|null} [opp] 相手の選択状態（あると fitness と上位帯の ◎ 昇格が働く）
   * @returns {{level:'best'|'ok'|'ng', reasons:Array<{code:string, squares?:string[], text:string}>, moved:number, fitness:number|null}}
   */
  function judge(me, layer, candidateId, opp = null) {
    const k = JSON.stringify([normSide(me), layer, candidateId, normSide(opp)]);
    if (judgeMemo.has(k)) return judgeMemo.get(k);
    const f = judgeFull(me, layer, candidateId, opp);
    const out = { level: f.level, reasons: f.reasons, moved: f.moved, fitness: f.fitness };
    judgeMemo.set(k, out);
    return out;
  }

  // ---------- resolve: ×を選んだときの自動差し替え（§4-2） ----------
  function candidatesOf(L) {
    if (L === 'strategy') return Object.keys(Kakoi.STRATEGIES || {});
    if (L === 'tactic') return (Kakoi.TACTICS || []).map(t => t.id);
    return (Kakoi.CASTLES || []).map(c => c.id);
  }
  function familyIdOf(L, id) {
    if (L === 'tactic') { const t = findTactic(id); return t ? t.family : null; }
    if (L === 'castle') { const c = findCastle(id); return c ? c.family : null; }
    return null; // strategy 層に系統は無い
  }
  // 戦略テンプレートの既定値（§4-2.3）。defaultCastle は {vsIbisha,vsFuribisha} を相手の戦略で振り分ける
  function defaultOf(L, strategy, opp) {
    const s = strategy && Kakoi.STRATEGIES && Kakoi.STRATEGIES[strategy];
    if (!s) return null;
    if (L === 'tactic') return s.defaultTactic || null;
    if (L === 'castle') {
      const dc = s.defaultCastle;
      if (typeof dc === 'string') return dc;
      if (dc) return (opp && opp.strategy === 'furibisha') ? dc.vsFuribisha : dc.vsIbisha;
    }
    return null;
  }
  // a. 新しい選択との pairings で ◎ の候補（データ順）
  function pairingBestOf(st, L, ok) {
    if (L === 'castle') {
      const t = tacticOf(st);
      if (!t) return null;
      const hit = ok.find(e => (t.pairings || []).some(p => p && p.castle === e.id && p.level === 'best'));
      return hit ? hit.id : null;
    }
    if (L === 'tactic') {
      const cid = st.castleId || castleIdOf(st, null);
      if (!cid) return null;
      const hit = ok.find(e => {
        const t = findTactic(e.id);
        return t && (t.pairings || []).some(p => p && p.castle === cid && p.level === 'best');
      });
      return hit ? hit.id : null;
    }
    return null;
  }
  // 代替候補を探す（§4-2 の a→b→c→d の順。同点は TACTICS/CASTLES/STRATEGIES のデータ順で決定的）
  function searchAlternative(next, L, cur, others, done, opp) {
    // まだ処理していない層がいま ng なら、あとで差し替わる前提で未選択（＝戦略既定）に戻して評価する。
    // さもないと古い ng の値のせいで、本来両立する候補まで全て × に見えて差し替え先が見つからない
    const base = { ...next };
    for (const O of others) {
      if (O === L || done.has(O)) continue;
      const v = base[FIELD[O]];
      if (v == null) continue;
      if (judgeFull(base, O, v, opp).level === 'ng') base[FIELD[O]] = null;
    }
    const ok = candidatesOf(L).filter(c => c !== cur)
      .map(cid => ({ id: cid, j: judgeFull(base, L, cid, opp) }))
      .filter(e => e.j.level !== 'ng');
    if (!ok.length) return null;
    // a. pairings で ◎ のもの
    const pa = pairingBestOf(base, L, ok);
    if (pa != null) return pa;
    // b. 囲いは fitness 最大の ok、戦法は tacticFit が good のもの（先頭。相手不明なら飛ばす）
    if (L === 'castle' && opp) {
      let best = null, bf = -Infinity;
      for (const e of ok) {
        if (e.j.fitness != null && e.j.fitness > bf + 1e-9) { bf = e.j.fitness; best = e.id; }
      }
      if (best != null) return best;
    }
    if (L === 'tactic' && opp && opp.strategy) {
      const hit = ok.find(e => Kakoi.matchup.tacticFit(findTactic(e.id), opp.strategy) === 'good');
      if (hit) return hit.id;
    }
    // c. 元の値と同じ系統（family）
    const fam = familyIdOf(L, cur);
    if (fam) {
      const hit = ok.find(e => familyIdOf(L, e.id) === fam);
      if (hit) return hit.id;
    }
    // d. compose の moved が最小（同点はデータ順＝先頭）
    let best = null, bm = Infinity;
    for (const e of ok) {
      const m = e.j.moved == null ? Infinity : e.j.moved;
      if (m < bm) { bm = m; best = e.id; }
    }
    return best;
  }

  /**
   * 層を選び直したときの自動解決。最後に選んだ層を優先し、両立しない他の層を差し替える。
   * @param {{strategy:string, tacticId?:string|null, castleId?:string|null, pick?:string[]}} side 選択状態
   * @param {'strategy'|'tactic'|'castle'} layer いま選んだ層
   * @param {string} id 新しい値
   * @param {Object|null} [opp] 相手の選択状態
   * @returns {{next:Object, changed:Array<{layer:string, from:string, to:string, why:string}>}}
   */
  function resolve(side, layer, id, opp = null) {
    side = side || {};
    const pick = (Array.isArray(side.pick) ? side.pick : []).filter(l => l !== layer);
    const next = { ...side, [FIELD[layer]]: id, pick: [...pick, layer] }; // 最後に選んだ層が最優先
    const changed = [];
    // 他の層を優先度の低い順（pick の古い順。pick に無い層は最古扱い）に並べる
    const others = LAYERS.filter(l => l !== layer).sort((a, b) => {
      const ia = next.pick.indexOf(a), ib = next.pick.indexOf(b);
      return (ia === -1 ? -1 : ia) - (ib === -1 ? -1 : ib) || LAYERS.indexOf(a) - LAYERS.indexOf(b);
    });
    const done = new Set();
    for (const L of others) {
      const cur = next[FIELD[L]];
      done.add(L);
      if (cur == null) continue;                    // 未選択の層は差し替え対象にしない
      const j = judgeFull(next, L, cur, opp);        // いまの値が新しい選択のもとで ng か
      if (j.level !== 'ng') continue;
      let rep = null;
      // 戦略を変えた直後は、まずテンプレートの既定値に戻す（§4-2.3）
      if (layer === 'strategy') {
        const d = defaultOf(L, next.strategy, opp);
        if (d && d !== cur && judgeFull(next, L, d, opp).level !== 'ng') rep = d;
      }
      if (rep == null) rep = searchAlternative(next, L, cur, others, done, opp);
      if (rep != null && rep !== cur) {
        next[FIELD[L]] = rep;
        changed.push({
          layer: L, from: cur, to: rep,
          why: j._ng.map(r => r.text).join('、') || '新しい選択と両立しない',
        });
      }
    }
    return { next, changed };
  }

  const api = { judge, resolve };
  Kakoi.compat = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api; // node からの読み込み用
})();
