// 制約モデル（統合画面用。DOM に依存しない）: 制約リストを両側の選択状態に正規化し、
// 未指定の層を戦略既定値で補う。既定値の解決規則（defaultTactic / defaultCastle の
// {vsIbisha,vsFuribisha} 振り分けを含む）はこのファイルが唯一の権威で、
// compat.js / matchup.js / compose.js / matchup-mode.js / matchup-rail-view.js の
// 重複実装はここへ委譲する。追加・削除と自動差し替えは compat.judge と同じ判定を使い、
// 解が無い古い制約は削除する（unresolved を残さない）。計画書 §1-1〜§1-4 / §3-2。
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';

  const KINDS = ['strategy', 'tactic', 'castle'];            // 層の既定順
  const FIELD = { strategy: 'strategy', tactic: 'tacticId', castle: 'castleId' };
  const WHOS = ['me', 'opp'];
  const findTactic = id => (Kakoi.TACTICS || []).find(t => t && t.id === id) || null;
  const findCastle = id => (Kakoi.CASTLES || []).find(c => c && c.id === id) || null;
  const familyOf = t => t ? (Kakoi.TACTIC_FAMILIES || []).find(f => f && f.id === t.family) || null : null;
  const tacticSideOf = t => { const f = familyOf(t); return f ? f.side : null; };

  // ---------- 既定値の解決（唯一の権威。計画書 §1-2） ----------
  function defaultTacticId(strategy) {
    const s = strategy && Kakoi.STRATEGIES && Kakoi.STRATEGIES[strategy];
    return (s && s.defaultTactic) || null;
  }
  // defaultCastle は文字列または { vsIbisha, vsFuribisha }。相手の戦略が分かるときはそれで振り分ける
  function defaultCastleId(strategy, oppStrategy) {
    const s = strategy && Kakoi.STRATEGIES && Kakoi.STRATEGIES[strategy];
    const dc = s && s.defaultCastle;
    if (typeof dc === 'string') return dc;
    if (dc) return (oppStrategy === 'furibisha' ? dc.vsFuribisha : dc.vsIbisha) || dc.vsIbisha || dc.vsFuribisha || null;
    return null;
  }
  function defaultIdOf(kind, strategy, oppStrategy) {
    if (kind === 'tactic') return defaultTacticId(strategy);
    if (kind === 'castle') return defaultCastleId(strategy, oppStrategy);
    return null; // strategy 層の既定値は無い（欠けた戦略は sides() が制約から推論する）
  }
  // 従来の sideState（{strategy, tacticId?, castleId?}）から実効 id を返す薄い窓口。
  // matchup-mode の _tacticOf/_castleOf、matchup-rail-view の effTacticId/effCastleId、
  // compat.js / matchup.js 内部の既定値補完はすべてこれに委譲する
  const tacticIdOf = st => (st && st.tacticId) || defaultTacticId(st && st.strategy);
  const castleIdOf = (st, opp) => (st && st.castleId) || defaultCastleId(st && st.strategy, opp && opp.strategy);

  // ---------- 正規化（§1-1 / §1-2） ----------
  const isEntry = e => e && WHOS.includes(e.who) && KINDS.includes(e.kind) && typeof e.id === 'string';
  const isValidId = (kind, id) =>
    kind === 'strategy' ? !!(Kakoi.STRATEGIES && Kakoi.STRATEGIES[id])
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

  // 暗黙の層（戦法→囲い）を埋める。既定値がいまの実効状態で ng なら、
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
   *              rank:{strategy:number,tactic:number,castle:number}, pick:string[]},
   *            opp:Object|null }}
   *   - (who,kind) ごとに制約は最大1件。rank は（重複除去後の）リスト内の位置、無い層は -1
   *   - 未指定の層は戦略既定値で補い implied にフラグを立てる（暗黙の制約）
   *   - 戦略が未指定のときは、より新しい明示制約の側（戦法=系統の side / 囲い=side）から推論し、
   *     どちらも無ければ 'ibisha'。推論・既定で埋めた層も implied に入る
   *   - 相手の制約が1つも無いとき opp は null（相手の駒を描かない旧画面の再現用）
   *   - 戻り値の各側は従来の sideState と互換（strategy/tacticId/castleId/pick を持つ）
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
    // 戦法→囲いの順に暗黙の層を埋める。既定値が実効状態で ng なら、既定値から始めて
    // compat.resolve/searchAlternative と同じ規則（a:相性表の◎ b:fitness c:同系統 d:動く駒最小）で
    // 両立する暗黙値を選ぶ（例: 四枚美濃だけ指定したとき既定戦法では駒が足りない）。
    // ここで埋め直すので apply 側に「暗黙の層が ng で残る」状態は来ない
    for (const who of WHOS) fillImplied(acc[who], acc[who === 'me' ? 'opp' : 'me'].id);
    const pack = who => {
      const s = acc[who];
      return {
        strategy: s.id.strategy, tacticId: s.id.tacticId, castleId: s.id.castleId,
        implied: s.implied, rank: s.rank,
        pick: KINDS.filter(k => s.rank[k] >= 0).sort((a, b) => s.rank[a] - s.rank[b]), // 互換: 古い順の層名
      };
    };
    return { me: pack('me'), opp: acc.opp.any ? pack('opp') : null };
  }

  // ---------- 追加・削除と自動解決（§1-3） ----------
  // 同じ側の中だけで連鎖する（相手の制約は変えない）。ng の古い制約は
  // compat.resolve/searchAlternative と同じ規則（a:相性表の◎ b:fitness c:同系統 d:動く駒最小）で
  // 差し替え、解が無ければ削除する（dropped:true）
  function cascade(work, who, setKind, changed) {
    const other = who === 'me' ? 'opp' : 'me';
    let S = sides(work);
    let st = S[who];
    let eff = { strategy: st.strategy, tacticId: st.tacticId, castleId: st.castleId };
    let opp = S[other];
    const entryOf = k => work.find(e => e.who === who && e.kind === k);
    // 同じ側の他の明示制約を優先度の低い順に。暗黙の層は固定コンテキスト扱い（done 初期値）
    const others = KINDS.filter(k => k !== setKind && entryOf(k)).sort((a, b) => st.rank[a] - st.rank[b]);
    const othersAll = KINDS.filter(k => k !== setKind);      // cleanBase の走査対象
    const done = new Set(KINDS.filter(k => k !== setKind && !entryOf(k)));
    for (const L of others) {
      const ent = entryOf(L);
      done.add(L);
      const j = Kakoi.compat.judgeFull(eff, L, ent.id, opp);
      if (j.level !== 'ng') continue;
      const why = j._ng.map(r => r.text).join('、') || '新しい選択と両立しない';
      let rep = null;
      // 戦略を選び直した直後は、まずテンプレートの既定値に戻す（compat.resolve §4-2.3 と同じ）
      if (setKind === 'strategy') {
        const d = defaultIdOf(L, eff.strategy, opp && opp.strategy);
        if (d && d !== ent.id
          && Kakoi.compat.judgeFull(Kakoi.compat.cleanBase(eff, L, othersAll, done, opp), L, d, opp).level !== 'ng') {
          rep = d;
        }
      }
      if (rep == null) rep = Kakoi.compat.searchAlternative(eff, L, ent.id, othersAll, done, opp);
      if (rep != null && rep !== ent.id) {
        const from = ent.id;
        ent.id = rep;
        changed.push({ who, kind: L, from, to: rep, why });
      } else {
        // 差し替え先が無い → 古い制約を削除する（unresolved は残さない。戦略既定値どうしは必ず ok）
        work.splice(work.indexOf(ent), 1);
        changed.push({ who, kind: L, from: ent.id, to: null, why, dropped: true });
      }
      // 差し替え・削除で暗黙の層（推論戦略・既定値）が変わりうるので実効値を取り直す
      S = sides(work);
      st = S[who];
      eff = { strategy: st.strategy, tacticId: st.tacticId, castleId: st.castleId };
      opp = S[other];
    }
    // 安全網: それでも残った ng（暗黙の層と衝突している場合を含む）を、
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
        // 明示制約は全部 ok だが暗黙の層が ng → 衝突相手になりうる最古の明示制約を落とす
        if (!KINDS.some(k => st2.rank[k] < 0 && isNg(k))) break;
        targetIdx = work.findIndex(e => e.who === who && e.kind !== setKind);
        if (targetIdx < 0) break; // 落とせるものが無い（新しい選択と暗黙値だけの衝突）
        target = work[targetIdx];
      }
      const why = Kakoi.compat.judgeFull(eff2, target.kind, target.id, opp2)._ng
        .map(r => r.text).join('、') || '両立する候補がありません';
      work.splice(targetIdx, 1);
      changed.push({ who, kind: target.kind, from: target.id, to: null, why, dropped: true });
    }
  }

  /**
   * 制約リストへの操作。
   * @param {Array} list 制約リスト
   * @param {{type:'set', who:'me'|'opp', kind:string, id:string} | {type:'remove', who:string, kind:string}} op
   * @returns {{list:Array, changed:Array<{who:string, kind:string, from:string, to:string|null, why:string, dropped?:boolean}>}}
   *   set: 同じ (who,kind) を除き末尾へ追加し、同じ側の古い制約を優先度の低い順に調整する
   *   remove: 取り除くのみ（連鎖しない）
   */
  function apply(list, op) {
    const norm = dedupe(list);
    if (!op || typeof op !== 'object') return { list: norm, changed: [] };
    if (op.type === 'remove') {
      const out = norm.filter(e => !(e.who === op.who && e.kind === op.kind));
      // 除去対象が無かった＆dedupe でも変わらなかった入力は参照を返す（dedupe 目的の呼び出しでは
      // norm が短くなるので素通りで新配列を返す）
      return { list: out.length === norm.length && norm.length === (list || []).length && Array.isArray(list) ? list : out, changed: [] };
    }
    if (op.type !== 'set' || !isEntry(op) || !isValidId(op.kind, op.id)) return { list: norm, changed: [] };
    const prev = norm.find(e => e.who === op.who && e.kind === op.kind);
    // 同じ値への set は無操作。入力が既に正規形（dedupe で変わらない）ならその参照を返す
    if (prev && prev.id === op.id) {
      return { list: norm.length === (list || []).length && Array.isArray(list) ? list : norm, changed: [] };
    }

    const work = norm.filter(e => !(e.who === op.who && e.kind === op.kind));
    work.push({ who: op.who, kind: op.kind, id: op.id });
    const changed = [];
    cascade(work, op.who, op.kind, changed);
    // 連鎖も起きず中身が変わらなかったときは入力の参照を返す（dedupe が常に新配列を
    // 作るため、同値でも store.set が 'constraints' の変更として再描画を走らせるのを防ぐ）
    if (!changed.length
      && work.length === norm.length
      && work.every((e, i) => e.who === norm[i].who && e.kind === norm[i].kind && e.id === norm[i].id)) {
      return { list: norm.length === (list || []).length && Array.isArray(list) ? list : norm, changed };
    }
    return { list: work, changed };
  }

  // ---------- 連鎖プレビュー（§3-2） ----------
  // apply と同じ結果を返すが、呼び出し側の状態を変えない用途向けに結果をキャッシュする。
  // キーは JSON.stringify(list)+JSON.stringify(op)。簡易 LRU（上限を超えたら最古を捨てる）
  const PREVIEW_MAX = 256;
  const previewCache = new Map();
  function preview(list, op) {
    const k = JSON.stringify(list) + '' + JSON.stringify(op);
    if (previewCache.has(k)) {
      const v = previewCache.get(k);
      previewCache.delete(k); previewCache.set(k, v);       // LRU: 使ったものを末尾へ
      return v;
    }
    const v = apply(list, op);                              // apply は入力を変更しない
    previewCache.set(k, v);
    if (previewCache.size > PREVIEW_MAX) previewCache.delete(previewCache.keys().next().value);
    return v;
  }

  // ---------- merge の late（§1-3.5） ----------
  // 歩同士の接触で1段下げる側: リスト末尾の制約の who（＝最後に選んだ側が遅れて下がる）
  function lateOf(list) {
    const n = dedupe(list);
    return n.length ? n[n.length - 1].who : 'opp';
  }

  // ---------- 導出ラベル（§1-4。戦型は制約にしないで表示だけする） ----------
  const SENKEI_LABELS = [
    ['kakugawari', '角換わり'], ['aigakari', '相掛かり'], ['yokofudori', '横歩取り'],
    ['yagura', '矢倉'], ['gangi', '雁木'],
  ];
  // 自分の囲いの系統でも判定するもの（矢倉・雁木）
  const CASTLE_FAMILY_SENKEI = { yagura: 'yagura', gangi: 'gangi' };
  /**
   * 両側の選択状態から戦型ラベルを導出する。
   * @param {Object|null} me  sides() の出力または従来の sideState（実効値で渡す）
   * @param {Object|null} opp 同上。null（相手の制約なし）なら戦型ラベルは出ない
   * @returns {Array<{id:string, label:string}>}
   *   #相居飛車/#対抗形/#相振り飛車 は matchup.threat().kind から。
   *   #角換わり/#相掛かり/#横歩取り/#矢倉/#雁木 は両者居飛車かつ両戦法の senkei 共通タグから。
   *   （senkei 未整備の戦法では出ないだけ）。矢倉・雁木は自分の囲い系統でも判定する。
   *   角換わりは、両者の戦法が持ち駒に角を含む場合も補助条件として認める。
   */
  function labels(me, opp) {
    const out = [];
    if (!me || !opp || !Kakoi.matchup) return out;
    const th = Kakoi.matchup.threat(me, opp);
    out.push({ id: th.kind, label: th.label });
    if (me.strategy !== 'ibisha' || opp.strategy !== 'ibisha') return out;
    const t1 = findTactic(me.tacticId), t2 = findTactic(opp.tacticId);
    const s1 = (t1 && t1.senkei) || [], s2 = (t2 && t2.senkei) || [];
    const common = new Set(s1.filter(x => s2.includes(x)));
    const famTag = (c => c && CASTLE_FAMILY_SENKEI[c.family] || null)(findCastle(me.castleId));
    for (const [id, label] of SENKEI_LABELS) {
      let hit = common.has(id) || famTag === id;
      if (!hit && id === 'kakugawari') {
        // 補助条件: 両者の戦法が持ち駒に角を持つ（腰掛け銀など角交換済みの形）
        hit = !!(t1 && t2 && (t1.hand || '').includes('角') && (t2.hand || '').includes('角'));
      }
      if (hit) out.push({ id, label });
    }
    return out;
  }

  const api = {
    sides, apply, preview, lateOf, labels,
    tacticIdOf, castleIdOf, defaultTacticId, defaultCastleId, defaultIdOf,
    KINDS, FIELD,
  };
  Kakoi.constraints = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api; // node からの読み込み用
})();
