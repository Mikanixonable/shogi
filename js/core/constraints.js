// 制約モデル（統合画面用。DOM に依存しない）: 制約リストを両側の選択状態に正規化し、
// 未指定の層を戦略既定値で補う。既定値の解決規則（{vsIbisha,vsFuribisha} 振り分けを
// 含む）の権威は core/defaults.js で、層のスキーマ定数（KINDS/FIELD/WHOS）は
// core/lookup.js が唯一の定義。
// 追加・削除と自動差し替えは compat.judge と同じ判定を使い、
// 解が無い古い制約は削除する（unresolved を残さない）。計画書 §1-1〜§1-4 / §3-2。
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';

  const { findTactic, findCastle, tacticFamilyOf: familyOf, KINDS, FIELD, WHOS } = Kakoi.lookup;
  const tacticSideOf = t => { const f = familyOf(t); return f ? f.side : null; };

  // ---------- 既定値の解決は core/defaults.js に集約（S6: compat↔constraints の相互参照を一方向に） ----------
  const { defaultIdOf } = Kakoi.defaults;

  // ---------- 正規化（§1-1 / §1-2） ----------
  // Object.hasOwn: 'constructor' や '__proto__' を有効な戦略 id として通さない（L6）
  const isEntry = e => e && WHOS.includes(e.who) && KINDS.includes(e.kind) && typeof e.id === 'string';
  const isValidId = (kind, id) =>
    kind === 'strategy' ? !!(Kakoi.STRATEGIES && Object.hasOwn(Kakoi.STRATEGIES, id))
      : kind === 'tactic' ? !!findTactic(id) : !!findCastle(id);
  // 同じ (who,kind) が複数あるときは末尾（＝最新）だけを残す。位置＝優先度を保つ
  function dedupe(list) {
    const out = [];
    for (const e of Array.isArray(list) ? list : []) {
      if (!isEntry(e)) continue;
      const i = out.findIndex(x => x.who === e.who && x.kind === e.kind);
      if (i >= 0) out.splice(i, 1);
      out.push({ who: e.who, kind: e.kind, id: e.id });
    }
    return out;
  }

  // 既定の層（戦法→囲い）を埋める。既定値がいまの実効状態で ng なら、
  // compat.searchAlternative と同じ規則で両立する値を選ぶ（sides() が規則の唯一の権威）。
  // 明示制約は固定コンテキスト（cleanBase で清掃しない）として評価する
  function fillImplied(s, oppId) {
    const opp = { strategy: oppId.strategy, tacticId: oppId.tacticId, castleId: oppId.castleId };
    const eff = { strategy: s.id.strategy, tacticId: s.id.tacticId, castleId: s.id.castleId };
    for (const k of ['tactic', 'castle']) {
      if (eff[FIELD[k]] != null) continue;
      s.implied[k] = true;
      const d = defaultIdOf(k, eff.strategy, opp.strategy);
      let v = d;
      if (Kakoi.compat && Kakoi.compat.judgeFull) {
        const base = { ...eff, [FIELD[k]]: d };
        const others = KINDS.filter(x => x !== k);
        const done = new Set(others);                      // 明示・既定済みの層は清掃しない
        if (d == null || Kakoi.compat.judgeFull(base, k, d, opp).level === 'ng') {
          const rep = Kakoi.compat.searchAlternative(base, k, d, others, done, opp);
          if (rep != null) v = rep;
        }
      }
      s.id[FIELD[k]] = eff[FIELD[k]] = v;
    }
  }

  /**
   * 制約リストを両側の選択状態へ正規化する。
   * @param {Array<{who:'me'|'opp', kind:'strategy'|'tactic'|'castle', id:string}>} list 並び順＝優先度（末尾ほど新しい）
   * @returns {{ me:{strategy:string, tacticId:string|null, castleId:string|null,
   *              implied:{strategy?:true,tactic?:true,castle?:true},
   *              rank:{strategy:number,tactic:number,castle:number}},
   *            opp:Object|null }}
   *   - (who,kind) ごとに制約は最大1件。rank は（重複除去後の）リスト内の位置、無い層は -1
   *   - 未指定の層は戦略既定値で補い implied にフラグを立てる（既定の制約）
   *   - 戦略が未指定のときは、より新しい明示制約の側（戦法=系統の side / 囲い=side）から推論し、
   *     どちらも無ければ 'ibisha'。推論・既定で埋めた層も implied に入る
   *   - 相手の制約が1つも無いとき opp は null（相手の駒を描かない旧画面の再現用）
   */
  function sides(list) {
    const norm = dedupe(list);
    const acc = {};
    for (const who of WHOS) {
      const rank = { strategy: -1, tactic: -1, castle: -1 };
      const id = { strategy: null, tacticId: null, castleId: null };
      norm.forEach((e, i) => { if (e.who === who) { rank[e.kind] = i; id[FIELD[e.kind]] = e.id; } });
      acc[who] = { rank, id, implied: {}, any: KINDS.some(k => rank[k] >= 0) };
    }
    // 先に両側の戦略を決める（既定囲いの {vsIbisha,vsFuribisha} 振り分けに相手の戦略が要る）
    for (const who of WHOS) {
      const s = acc[who];
      if (s.id.strategy != null) continue;
      s.implied.strategy = true;
      // より新しい明示制約から側を推論する（戦法→系統の side、囲い→castle.side）
      let inferred = null;
      for (const k of KINDS.slice(1).sort((a, b) => s.rank[b] - s.rank[a])) {
        if (s.rank[k] < 0) continue;
        inferred = k === 'tactic' ? tacticSideOf(findTactic(s.id.tacticId))
          : (c => (c && (Array.isArray(c.strategies) ? c.strategies[0] : c.side)) || null)(findCastle(s.id.castleId));
        if (inferred) break;
      }
      s.id.strategy = inferred || 'ibisha';
    }
    // 戦法→囲いの順に既定の層を埋める。既定値が実効状態で ng なら、既定値から始めて
    // compat.resolve/searchAlternative と同じ規則（a:相性表の◎ b:fitness c:同系統 d:動く駒最小）で
    // 両立する既定値を選ぶ（例: 四枚美濃だけ指定したとき既定戦法では駒が足りない）。
    // ここで埋め直すので apply 側に「既定の層が ng で残る」状態は来ない
    for (const who of WHOS) fillImplied(acc[who], acc[who === 'me' ? 'opp' : 'me'].id);
    const pack = who => {
      const s = acc[who];
      return {
        strategy: s.id.strategy, tacticId: s.id.tacticId, castleId: s.id.castleId,
        implied: s.implied, rank: s.rank,
      };
    };
    return { me: pack('me'), opp: acc.opp.any ? pack('opp') : null };
  }

  // ---------- 追加・削除と自動解決（§1-3） ----------
  // 盤上の衝突コード（compose 由来）。戦略層がこれを原因に落ちるとき、理由は
  // 「戦略のせい」ではなく戦法×囲いの衝突なので、落ちる層に帰属させる（U2）
  const CONFLICT_CODES = new Set(['SQUARE', 'PAWN', 'COUNT', 'CONTACT', 'HAND']);
  const whyOf = (L, ng) => {
    const xs = ng.map(r =>
      (L === 'strategy' && CONFLICT_CODES.has(r.code)) ? `戦法と囲いが${r.text}` : r.text);
    return xs.join('、') || '新しい選択と両立しない';
  };

  // 同じ側の中だけで連動する（相手の制約は変えない）。ng の古い制約は
  // compat.searchAlternative と同じ規則（既定値 → 相性表の◎ → fitness → 同系統 → 動く駒最小）で
  // 差し替え、解が無ければ削除する（dropped:true）
  function cascade(work, who, setKind, changed) {
    const other = who === 'me' ? 'opp' : 'me';
    let S = sides(work);
    let st = S[who];
    if (!st) return; // その側の制約が残っていない（remove で空になった側など）
    let eff = { strategy: st.strategy, tacticId: st.tacticId, castleId: st.castleId };
    let opp = S[other];
    const entryOf = k => work.find(e => e.who === who && e.kind === k);
    // 同じ側の他の明示制約を優先度の低い順に。既定の層は固定コンテキスト扱い（done 初期値）
    const others = KINDS.filter(k => k !== setKind && entryOf(k)).sort((a, b) => st.rank[a] - st.rank[b]);
    const othersAll = KINDS.filter(k => k !== setKind);      // cleanBase の走査対象
    const done = new Set(KINDS.filter(k => k !== setKind && !entryOf(k)));
    for (const L of others) {
      const ent = entryOf(L);
      done.add(L);
      const j = Kakoi.compat.judgeFull(eff, L, ent.id, opp);
      if (j.level !== 'ng') continue;
      const why = whyOf(L, j._ng);
      // 差し替え候補の順番は「戦略の既定値 → 相性表の◎ → fitness → 同じ系統 → 動く駒最小」
      // （searchAlternative が既定値を最初に試す。計画書 L12）
      const rep = Kakoi.compat.searchAlternative(eff, L, ent.id, othersAll, done, opp);
      if (rep != null && rep !== ent.id) {
        const from = ent.id;
        ent.id = rep;
        changed.push({ who, kind: L, from, to: rep, why });
      } else {
        // 差し替え先が無い → 古い制約を削除する（unresolved は残さない。戦略既定値どうしは必ず ok）
        work.splice(work.indexOf(ent), 1);
        changed.push({ who, kind: L, from: ent.id, to: null, why, dropped: true });
      }
      // 差し替え・削除で既定の層（推論戦略・既定値）が変わりうるので実効値を取り直す
      S = sides(work);
      st = S[who];
      eff = { strategy: st.strategy, tacticId: st.tacticId, castleId: st.castleId };
      opp = S[other];
    }
    // 安全網: それでも残った ng（既定の層と衝突している場合を含む）を、
    // 優先度の低い明示制約から順に落とす。通常の操作列では到達しない
    for (let guard = 0; guard < 8; guard++) {
      const S2 = sides(work);
      const st2 = S2[who], opp2 = S2[other];
      const eff2 = { strategy: st2.strategy, tacticId: st2.tacticId, castleId: st2.castleId };
      const isNg = k => Kakoi.compat.judgeFull(eff2, k, eff2[FIELD[k]], opp2).level === 'ng';
      let target = null, targetIdx = -1;
      work.forEach((e, i) => {
        if (e.who !== who || e.kind === setKind || target) return;
        if (isNg(e.kind)) { target = e; targetIdx = i; }
      });
      if (!target) {
        // 明示制約は全部 ok だが既定の層が ng → 衝突相手になりうる最古の明示制約を落とす
        if (!KINDS.some(k => st2.rank[k] < 0 && isNg(k))) break;
        targetIdx = work.findIndex(e => e.who === who && e.kind !== setKind);
        if (targetIdx < 0) break; // 落とせるものが無い（新しい選択と既定値だけの衝突）
        target = work[targetIdx];
      }
      const why = whyOf(target.kind,
        Kakoi.compat.judgeFull(eff2, target.kind, target.id, opp2)._ng) || '両立する候補がありません';
      work.splice(targetIdx, 1);
      changed.push({ who, kind: target.kind, from: target.id, to: null, why, dropped: true });
    }
  }

  /**
   * 制約リストへの操作。
   * @param {Array} list 制約リスト
   * @param {{type:'set', who:'me'|'opp', kind:string, id:string} | {type:'remove', who:string, kind:string}} op
   * @returns {{list:Array, changed:Array<{who:string, kind:string, from:string, to:string|null, why:string, dropped?:boolean}>}}
   *   set: 同じ (who,kind) を除き末尾へ追加し、同じ側の古い制約を優先度の低い順に調整する。
   *       同じ値を選び直しても末尾へ移す（優先度の更新。計画書 L11）
   *   remove: 取り除いたあとも連動解決をかける（残った制約の ng を残さない。L7）
   */
  function apply(list, op) {
    const norm = dedupe(list);
    if (!op || typeof op !== 'object') return { list: norm, changed: [] };
    if (op.type === 'remove') {
      const had = norm.some(e => e.who === op.who && e.kind === op.kind);
      const work = norm.filter(e => !(e.who === op.who && e.kind === op.kind));
      if (!had) {
        // 除去対象が無かった＆dedupe でも変わらなかった入力は参照を返す（dedupe 目的の呼び出しでは
        // norm が短くなるので素通りで新配列を返す）
        return { list: work.length === norm.length && norm.length === (list || []).length && Array.isArray(list) ? list : work, changed: [] };
      }
      // L7: 取り除いた層を推論・既定値の根拠にしていた残りの制約が ng になることがあるので、
      // 古い順に連動解決する（setKind=null = 保護する層なし。新しい制約ほど優先度が高い）
      const changed = [];
      cascade(work, op.who, null, changed);
      return { list: work, changed };
    }
    if (op.type !== 'set' || !isEntry(op) || !isValidId(op.kind, op.id)) return { list: norm, changed: [] };

    // 同じ値を選び直しても末尾へ移す（優先度の更新。L11）: 同じ (who,kind) を外して末尾へ
    // 追加する通常経路にそのまま乗せる。末尾にある場合だけ早期 return で無操作になる
    const prev = norm.find(e => e.who === op.who && e.kind === op.kind);
    if (prev && prev.id === op.id && norm[norm.length - 1] === prev) {
      return { list: norm.length === (list || []).length && Array.isArray(list) ? list : norm, changed: [] };
    }

    const work = norm.filter(e => !(e.who === op.who && e.kind === op.kind));
    work.push({ who: op.who, kind: op.kind, id: op.id });
    const changed = [];
    cascade(work, op.who, op.kind, changed);
    // 連動も起きず中身が変わらなかったときは入力の参照を返す（dedupe が常に新配列を
    // 作るため、同値でも store.set が 'constraints' の変更として再描画を走らせるのを防ぐ）
    if (!changed.length
      && work.length === norm.length
      && work.every((e, i) => e.who === norm[i].who && e.kind === norm[i].kind && e.id === norm[i].id)) {
      return { list: norm.length === (list || []).length && Array.isArray(list) ? list : norm, changed };
    }
    return { list: work, changed };
  }

  // ---------- 連動プレビュー（§3-2） ----------
  // apply と同じ結果を返すが、呼び出し側の状態を変えない用途向けに結果をキャッシュする。
  // キーは JSON.stringify(list)+JSON.stringify(op)。キャッシュは共有 LRU（S4）
  const previewCache = new (Kakoi.LRU || Map)(256);
  function preview(list, op) {
    const k = JSON.stringify(list) + '|' + JSON.stringify(op);
    if (previewCache.has(k)) return previewCache.get(k);
    const v = apply(list, op);                              // apply は入力を変更しない
    previewCache.set(k, v);
    return v;
  }

  // ---------- 候補の評価（S3）: ドックのバッジとホバー予告で共有する「preview→judge」一本化窓口。
  // 「候補を置いた後の側」を土台に compat.judge するので、その側に制約が無くても
  // 候補から推論した戦略で評価され「駒が足りない」といった嘘の ng 理由が出ない
  const evalCache = new (Kakoi.LRU || Map)(256);
  /**
   * @param {Array} list 制約リスト
   * @param {'me'|'opp'} who 候補を置く側
   * @param {string} kind 'strategy'|'tactic'|'castle'
   * @param {string} id 候補の id
   * @returns {{ pv:{list:Array, changed:Array}, j:Object }} preview 結果と compat.judge 結果
   */
  function evaluate(list, who, kind, id) {
    const k = `${JSON.stringify(list)}|${who}|${kind}|${id}`;
    if (evalCache.has(k)) return evalCache.get(k);
    const pv = preview(list, { type: 'set', who, kind, id });
    const Sp = sides(pv.list);
    const st = Sp[who] || { strategy: null, tacticId: null, castleId: null };
    const j = Kakoi.compat.judge(st, kind, id, Sp[who === 'me' ? 'opp' : 'me']);
    const v = { pv, j };
    evalCache.set(k, v);
    return v;
  }

  // ---------- 選択状態の文字列表現（'who.kind'） ----------
  // constraint-mode / board-detail-view / hash-link で共有する（S2）
  const SEL_RE = /^(me|opp)\.(strategy|tactic|castle)$/;
  /** 'me.castle' → {who:'me', kind:'castle'}。形式が違えば null */
  const parseSel = s => {
    const m = SEL_RE.exec(String(s || ''));
    return m ? { who: m[1], kind: m[2] } : null;
  };
  /** {who,kind} または who,kind → 'me.castle'。形式が違えば null */
  const encodeSel = (a, b) => {
    const s = b === undefined && a && typeof a === 'object' ? `${a.who}.${a.kind}` : `${a}.${b}`;
    return SEL_RE.test(s) ? s : null;
  };

  // ---------- 保存値・ハッシュの正規化（起動時の app.js と hash-link.js で共有。計画書 L4） ----------
  // 形と id の正当性を確かめ、先頭から順に apply(set) し直す。
  // 重複の整理だけでなく連動による解決まで済ませる（旧形式からの変換も同じ経路を通る）
  function normalizeList(list) {
    const valid = e => isEntry(e) && isValidId(e.kind, e.id);
    return (Array.isArray(list) ? list : []).filter(valid)
      .reduce((acc, e) => apply(acc, { type: 'set', who: e.who, kind: e.kind, id: e.id }).list, []);
  }

  // 'who.kind' の選択を制約リストへ握り直す: 形式不正・または存在しない側を指す
  // （opp.* だが相手の制約が無い）ときは、自分側の末尾の制約 → 末尾の制約 → 'me.castle'
  function normalizeSelected(list, selected) {
    const sel = parseSel(selected);
    if (sel && !(sel.who === 'opp' && !list.some(e => e.who === 'opp'))) return encodeSel(sel);
    const last = [...list].reverse().find(e => e.who === 'me') || list[list.length - 1];
    return last ? `${last.who}.${last.kind}` : 'me.castle';
  }

  // 旧形式の「いじった層の順」pick から制約の並び順を復元する（L5）:
  // pick に無い層が先頭（古い・既定順）、pick の順が末尾（新しい）。
  // app.js の localStorage 移行と hash-link.js の旧ハッシュ移行で共有する
  const orderFromPick = pick => {
    const p = [...new Set(Array.isArray(pick) ? pick : [])].filter(l => KINDS.includes(l));
    return p.length ? [...KINDS.filter(l => !p.includes(l)), ...p] : KINDS;
  };

  // ---------- merge の late（§1-3.5） ----------
  // 歩同士の接触で1段下げる側: リスト末尾の制約の who（＝最後に選んだ側が遅れて下がる）
  function lateOf(list) {
    const n = dedupe(list);
    return n.length ? n[n.length - 1].who : 'opp';
  }

  // ---------- 導出ラベル（§1-4。戦型は制約にしないで表示だけする） ----------
  const SENKEI_LABELS = {
    kakugawari: '角換わり', yokofudori: '横歩取り', aiyagura: '相矢倉',
    yagura: '矢倉', gangi: '雁木', aigakari: '相掛かり',
  };
  /**
   * 両側の選択状態から戦型ラベルを導出する。
   * @param {Object|null} me  sides() の出力または従来の sideState（実効値で渡す）
   * @param {Object|null} opp 同上。null（相手の制約なし）なら戦型ラベルは出ない
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
    sides, apply, preview, evaluate, lateOf, labels, parseSel, encodeSel,
    isValidId, normalizeList, normalizeSelected, orderFromPick,
    KINDS, FIELD,
  };
  Kakoi.constraints = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api; // node からの読み込み用
})();
