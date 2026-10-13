// 両立判定（対局図用。DOM に依存しない）: 「いまの他の層」と候補を compose して、
// 盤上の衝突（SQUARE/PAWN/COUNT/CONTACT）と将棋の原則（玉飛接近・同翼・戦略の整合・手数）
// から3段階（best/ok/ng）で判定する。連動による自動差し替えは constraints.apply が担う
// （searchAlternative/cleanBase はそのために公開している内部API）。計画書 §3-2 / §4-2。
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';
  const { parsePieces, parseSquare, label } = Kakoi.notation;
  const { findTactic, findCastle, tacticFamilyOf: familyOf, strategyLabel, FIELD } = Kakoi.lookup;
  const NG_CONFLICT = new Set(['SQUARE', 'PAWN', 'COUNT', 'CONTACT', 'HAND']); // compose の衝突のうち × にするもの
  // 相性表の overrides では消せない理由（計画書 L2: 戦略の不一致・玉飛接近・同翼は原則なので
  // データの明示的な上書きの対象から外す）
  const NO_OVERRIDE = new Set(['SIDE', 'KING_ROOK', 'SAME_WING']);
  // 端筋（1・9筋）の飛車は玉飛接近・同翼の判定対象外。端に構えた飛車は玉の逃げ道を実質塞がず、
  // 一間飛車＋美濃・一間飛車穴熊は定番の組み合わせとして成立するため
  const edgeRook = rf => rf === 1 || rf === 9;
  const normSide = st => ({
    strategy: (st && st.strategy) || null,
    tacticId: (st && st.tacticId) || null,
    castleId: (st && st.castleId) || null,
  });

  // 未選択の層は戦略テンプレートの既定値で補う。既定値の解決規則の権威は Kakoi.defaults
  // （js/core/defaults.js。起動時ではなく判定時に参照するので読み込み順は問わない）
  const tacticIdOf = st => Kakoi.defaults.tacticIdOf(st);
  const castleIdOf = (st, opp) => Kakoi.defaults.castleIdOf(st, opp);
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
  // ngReasons（×の理由）と notes（○のまま付ける注記）を分けて返す。結果は選択状態をキーに
  // 共有 LRU でメモ化（S4: 長時間のセッションでメモが際限なく増えないよう上限を設ける）
  const evalMemo = new (Kakoi.LRU || Map)(512);
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
      side: 'sente', priority: 'tactic', oppStrategy: opp && opp.strategy,
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
    // SIDE（囲い）: 囲いの side と戦略が食い違う。castle.strategies があるときは
    // そのリストだけを見る（相振り用の囲いなど側を限定するデータ。§6-3）
    if (castle && st.strategy) {
      const okSide = Array.isArray(castle.strategies)
        ? castle.strategies.includes(st.strategy)
        : castle.side === st.strategy;
      if (!okSide) {
        const names = Array.isArray(castle.strategies)
          ? castle.strategies.map(strategyLabel).join('・') : strategyLabel(castle.side);
        ng.push({ code: 'SIDE', text: `${castle.name}は${names}の囲い（戦略は${strategyLabel(st.strategy)}）` });
      }
    }
    if (tactic && castle) {
      const rp = rookPiece(tactic), kp = kingPiece(castle);
      const rf = rp ? rp.f : rookFile(tactic);
      const kf = kp ? kp.f : null;
      if (rf != null && kf != null) {
        const squares = [rp && `${rp.f}${rp.r}`, kp && `${kp.f}${kp.r}`].filter(Boolean);
        if (castle.kingWing === 'rook') {
          // 右玉など玉を飛車側に囲う意図的な構え: SAME_WING / KING_ROOK は判定せず注記だけ（§6-3）
          const close = Math.abs(rf - kf) <= 1;
          const sameWing = wing(rf) === wing(kf) && wing(rf) !== 'center';
          if (close || sameWing) {
            notes.push({ code: 'KING_ROOK_EXEMPT', squares,
              text: `飛車（${rf}筋）と玉（${kf}筋）が近いが、玉を飛車側に囲う意図的な構え（バランスで受ける）` });
          }
        } else if (edgeRook(rf)) {
          // 端筋の飛車は玉飛接近・同翼の対象外（一間飛車＋美濃・一間飛車穴熊は定番の形。
          // 端に構えた飛車は玉の逃げ道を実質塞がない）
          if (Math.abs(rf - kf) <= 1 || (wing(rf) === wing(kf) && wing(rf) !== 'center')) {
            notes.push({ code: 'KING_ROOK_EXEMPT', squares,
              text: `飛車（${rf}筋）と玉（${kf}筋）が近いが、端筋の飛車は玉飛接近・同翼の対象外` });
          }
        } else if (Math.abs(rf - kf) <= 1) {
          // KING_ROOK: 玉と飛車の筋の差が1以下（玉飛接近すべからず。§1-3）
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
    // composed（合成済みの局面）はメモに入れない（S4: 大きいので共有 LRU の枠を食わない）
    return { ng, notes, moved: composed.moved, tactic, castle };
  }

  // ---------- 囲いの対戦相性スコアの上位帯（§3-2: 上位2件 または 最高点−0.5 以内） ----------
  // 両立する候補だけを対象に、全囲いの fitness を (strategy,tacticId,opp) 単位で1回だけ計算する
  const bandMemo = new (Kakoi.LRU || Map)(128);
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
  const judgeMemo = new (Kakoi.LRU || Map)(512);
  // 同じ内容を別の言い回しで2度言う理由をまとめる（U6: 穴熊の「手数がかかる」が
  // 自動生成の TEMPO 注記と相性表の why で二重に出ていたのを防ぐ）。
  // 記号・括弧・空白を除いた正規形で一方が他方を含むとき、情報量の多い側を残す
  const normTxt = s => String(s || '').replace(/[⚠（）()、。・\s]/g, '');
  function dedupeReasons(reasons) {
    const keep = [];
    for (const r of reasons) {
      const n = normTxt(r.text);
      if (!n) { keep.push({ n, r }); continue; }
      const i = keep.findIndex(k => k.n && (k.n.includes(n) || n.includes(k.n)));
      if (i < 0) keep.push({ n, r });
      else if (n.length > keep[i].n.length) keep[i] = { n, r };
    }
    return keep.map(k => k.r);
  }

  function judgeFull(me, layer, candidateId, opp) {
    me = me || {};
    const st = { ...me, [FIELD[layer]]: candidateId };
    const ev = evaluate(st, opp);
    const reasons = [...ev.ng, ...ev.notes];
    const ngAll = [...ev.ng];
    let level = ngAll.length ? 'ng' : 'ok';
    let fitness = null;
    let cappedOk = false;
    // 相性表（pairings）: 戦法×囲いの関係。全ての層に同じ規則を適用する（L8）
    if (ev.tactic && ev.castle) {
      const p = pairingOf(ev.tactic, ev.castle.id);
      if (p) {
        reasons.push({ code: 'PAIRING', text: p.why || '相性表の評価' });
        if (p.level === 'ng') {
          const r = { code: 'PAIRING', text: p.why || '相性表で×' };
          ngAll.push(r); level = 'ng';
        } else {
          // ○/◎ が上書きできるのは overrides で宣言した理由だけ（L2）。
          // SIDE / KING_ROOK / SAME_WING は宣言しても消えない。消した ng の理由は
          // reasons に残り、注意として表示される（中飛車×本美濃など「浮き飛車の形」）
          const ov = new Set(Array.isArray(p.overrides) ? p.overrides : []);
          const keep = ngAll.filter(r => NO_OVERRIDE.has(r.code) || !ov.has(r.code));
          ngAll.length = 0; ngAll.push(...keep);
          level = keep.length ? 'ng' : p.level;
          if (p.level === 'ok') cappedOk = true;   // ○指定は best への昇格を止める
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
    // 相手との相性軸（計画書 §3-1）: 層ごとに違う尺度で「相手に対して候補が合うか」を出す。
    //   castle:   その候補の fitness の帯。上位帯（◎昇格と同じ: 上位2件または最高点−0.5以内）
    //             を good、最高点から1.0以上低いを bad。候補ごとに値が変わる軸になる
    //   strategy: 候補の戦略の実効戦法（既定値）が相手に持つ適性
    //   tactic:   tactic.against[相手の戦略] ＋ againstTactic[相手の実効戦法id]（§6-3）
    // 同じ側の整合（level）とは別の軸なので level には混ぜない
    // （相性が悪くても選べる・連動は起きない＝要件5）。UI の相手との相性バッジ用に返すだけ
    let vs = null;
    if (opp && Kakoi.matchup) {
      if (layer === 'castle' && ev.castle) {
        const band = fitnessBand(st, opp);
        if (band && fitness != null) {
          const good = band.top2.has(candidateId) || fitness >= band.max - 0.5 - 1e-9;
          const bad = fitness <= band.max - 1.0 - 1e-9;
          vs = {
            level: good ? 'good' : bad ? 'bad' : 'neutral',
            reasons: [{ code: 'FITNESS',
              text: `対${strategyLabel(opp.strategy)}の攻めへの相性スコア ${fitness.toFixed(2)}（この組み合わせの最高は ${band.max.toFixed(2)}）` }],
          };
        }
      } else if (ev.tactic) {
        const oppT = tacticOf(opp);   // 相手の実効戦法（未選択なら戦略既定値）
        const g = Kakoi.matchup.tacticFit(ev.tactic, opp.strategy || null);  // 'good'|'ok'|'ng'
        const at = oppT && ev.tactic.againstTactic ? ev.tactic.againstTactic[oppT.id] : null;
        const vReasons = [];
        const gp = g === 'good' ? 'good' : g === 'ng' ? 'bad' : 'neutral';
        const ap = at === 'best' || at === 'good' ? 'good' : at === 'ng' ? 'bad' : at === 'ok' ? 'neutral' : null;
        if (g !== 'ok') vReasons.push({ code: 'AGAINST', text: `対${strategyLabel(opp.strategy)}は${g === 'good' ? '得意' : '苦手'}` });
        if (ap != null && at) vReasons.push({ code: 'AGAINST_TACTIC', text: `対${oppT.name}は${ap === 'good' ? '得意' : ap === 'bad' ? '苦手' : '五分'}` });
        vs = {
          strategy: g, tactic: at || null,
          level: (gp === 'bad' || ap === 'bad') ? 'bad' : (gp === 'good' || ap === 'good') ? 'good' : 'neutral',
          reasons: vReasons,
        };
      }
    }
    return { level, reasons: dedupeReasons(reasons), moved: ev.moved, fitness, vs, _ng: ngAll };
  }

  /**
   * 候補と「いまの他の層」の両立判定。
   * @param {{strategy:string, tacticId?:string|null, castleId?:string|null}} me 選択状態
   * @param {'strategy'|'tactic'|'castle'} layer 候補の層
   * @param {string} candidateId 戦略キー / 戦法id / 囲いid
   * @param {Object|null} [opp] 相手の選択状態（あると fitness と上位帯の ◎ 昇格が働く）
   * @returns {{level:'best'|'ok'|'ng', reasons:Array<{code:string, squares?:string[], text:string}>, moved:number, fitness:number|null}}
   */
  function judge(me, layer, candidateId, opp = null) {
    const k = JSON.stringify([normSide(me), layer, candidateId, normSide(opp)]);
    if (judgeMemo.has(k)) return judgeMemo.get(k);
    const f = judgeFull(me, layer, candidateId, opp);
    const out = { level: f.level, reasons: f.reasons, moved: f.moved, fitness: f.fitness, vs: f.vs };
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
  // 戦略テンプレートの既定値（§4-2.3）。解決規則は core/defaults.js が唯一の権威
  const defaultOf = (L, strategy, opp) => Kakoi.defaults.defaultIdOf(L, strategy, opp && opp.strategy);
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
  // まだ処理していない層がいま ng なら、あとで差し替わる前提で未選択（＝戦略既定）に戻した評価用ベース。
  // さもないと古い ng の値のせいで、本来両立する候補まで全て × に見えてしまう
  function cleanBase(next, L, others, done, opp) {
    const base = { ...next };
    for (const O of others) {
      if (O === L || done.has(O)) continue;
      const v = base[FIELD[O]];
      if (v == null) continue;
      if (judgeFull(base, O, v, opp).level === 'ng') base[FIELD[O]] = null;
    }
    return base;
  }

  // 代替候補を探す。順番は「戦略の既定値 → 相性表の◎ → fitness → 同じ系統 → 動く駒が最小」
  // （§4-2 / L12。既定値は最も自然な差し替え先なので最初に試す。
  //   同点は TACTICS/CASTLES/STRATEGIES のデータ順で決定的）
  function searchAlternative(next, L, cur, others, done, opp) {
    const base = cleanBase(next, L, others, done, opp);
    const ok = candidatesOf(L).filter(c => c !== cur)
      .map(cid => ({ id: cid, j: judgeFull(base, L, cid, opp) }))
      .filter(e => e.j.level !== 'ng');
    if (!ok.length) return null;
    // 0. 戦略の既定値（L12）
    const d = defaultOf(L, base.strategy, opp);
    if (d != null && d !== cur && ok.some(e => e.id === d)) return d;
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

  // judgeFull / searchAlternative / cleanBase は constraints.apply の連動解決が
  // 同じ規則を再利用するための内部API（メモ化を通さない生の評価）
  const api = { judge, judgeFull, searchAlternative, cleanBase };
  Kakoi.compat = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api; // node からの読み込み用
})();
