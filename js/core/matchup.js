// 対戦相性: 相手（後手）の飛車の筋と自分の玉の筋の距離から、
// 効く強み（ratings の5軸）の重みと脅威の筋を計算する（対局図用。DOM に依存しない）
// 座標はすべて先手から見た絶対座標。相手の駒データは先手用なので、筋は 10-f で鏡写しにする
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';
  const { parsePieces } = Kakoi.notation;

  const AXES = ['top', 'side', 'hard', 'wide', 'quick'];   // 囲いの強みの5軸

  // 戦型ごとの重みの初期値（計画書 §3-3 の表）。戦型は距離で決めるのでラベルは表示用
  const BASE_WEIGHTS = {
    'aiibisha': { top: .35, side: .10, hard: .25, wide: .15, quick: .15 }, // 相居飛車: 縦が主
    'taikou-i': { top: .10, side: .35, hard: .30, wide: .10, quick: .15 }, // 対抗形・自分が居飛車: 横が主
    'taikou-f': { top: .20, side: .30, hard: .25, wide: .10, quick: .15 }, // 対抗形・自分が振り飛車: 横＋上部
    'aifuri':   { top: .40, side: .15, hard: .20, wide: .15, quick: .10 }, // 相振り飛車: 縦が主
  };
  const KIND_LABEL = {
    'aiibisha': '相居飛車', 'taikou-i': '対抗形', 'taikou-f': '対抗形', 'aifuri': '相振り飛車',
  };
  const EDGE_FILES = new Set([1, 9]);       // 端筋（端攻めが効く筋）
  const EDGE_LEADS = new Set(['香', '桂']);  // 経路の終点が玉の筋に迫りやすい主役（端攻めの前兆）

  const findTactic = id => (Kakoi.TACTICS || []).find(t => t.id === id) || null;
  const findCastle = id => (Kakoi.CASTLES || []).find(c => c.id === id) || null;

  // その側の戦法を解決する。未選択なら戦略テンプレートの既定戦法
  function _resolveTactic(side) {
    if (side && side.tacticId) return findTactic(side.tacticId);
    const s = side && Kakoi.STRATEGIES && Kakoi.STRATEGIES[side.strategy];
    return s ? findTactic(s.defaultTactic) : null;
  }

  // その側の囲いを解決する。未選択なら戦略テンプレートの既定囲い
  // （defaultCastle が {vsIbisha, vsFuribisha} の形なら相手の戦略で選ぶ。相手不明なら vsIbisha）
  function _resolveCastle(me, oppStrategy) {
    if (me && me.castleId) return findCastle(me.castleId);
    const s = me && Kakoi.STRATEGIES && Kakoi.STRATEGIES[me.strategy];
    if (!s) return null;
    const dc = s.defaultCastle;
    const id = typeof dc === 'string' ? dc
      : dc ? (oppStrategy === 'furibisha' ? dc.vsFuribisha : dc.vsIbisha)
      : null;
    return id ? findCastle(id) : null;
  }

  /**
   * 自分（先手）の玉の筋を返す。囲い未選択なら戦略テンプレートの既定囲いの玉を使う
   * @param {{strategy:string, castleId?:string}} me 自分の選択状態
   * @param {string} [oppStrategy] 相手の戦略（既定囲いの振り分けに使う）
   * @returns {number|null}
   */
  function _resolveKingFile(me, oppStrategy = null) {
    const castle = _resolveCastle(me, oppStrategy);
    if (!castle || !castle.core) return null;
    const king = parsePieces(castle.core).find(x => x.p === '玉');
    return king ? king.f : null;
  }

  /**
   * 相手（後手）の飛車の筋を絶対座標で返す。戦法未選択なら戦略テンプレートの既定戦法を使う。
   * データは先手視点で保存されているので、後手の実際の筋は 10-f の鏡写しになる
   * （居飛車の飛2筋 → 絶対8筋、四間飛車の飛6筋 → 絶対4筋）
   * @param {{strategy:string, tacticId?:string}} opp 相手の選択状態
   * @returns {number|null}
   */
  function _oppRookFileAbs(opp) {
    const t = _resolveTactic(opp);
    if (!t) return null;
    const rook = parsePieces(t.pieces).find(x => x.p === '飛');
    let dataFile = rook ? rook.f : null;
    if (dataFile == null && t.lead) {
      const files = t.lead.files;                    // lead.files は配列または数値
      dataFile = Array.isArray(files) ? files[0] : files;
    }
    return dataFile == null ? null : 10 - dataFile;
  }

  // 戦法の主役の経路の終点の筋（絶対座標）。経路が無ければ null
  function _routeEndFileAbs(tactic) {
    const route = tactic && tactic.route;
    if (!route || !route.length) return null;
    const last = route[route.length - 1];
    const dataFile = typeof last === 'string' ? +last[0] : last && last.f;
    return dataFile == null || isNaN(dataFile) ? null : 10 - dataFile;
  }

  /**
   * 脅威の評価: 戦型・玉飛の距離・強みの重み・脅威の筋を計算する（計画書 §1-2 / §3-3）
   * @param {{strategy:string, tacticId?:string, castleId?:string}} me  自分（先手）の選択状態
   * @param {{strategy:string, tacticId?:string, castleId?:string}} opp 相手（後手）の選択状態
   * @returns {{kind:string, label:string, distance:number|null, weights:Object, threatFiles:number[]}}
   */
  function threat(me, opp) {
    me = me || {}; opp = opp || {};
    // 戦型: 自分と相手の戦略の組み合わせ
    const kind = me.strategy === 'ibisha'
      ? (opp.strategy === 'furibisha' ? 'taikou-i' : 'aiibisha')
      : (opp.strategy === 'ibisha' ? 'taikou-f' : 'aifuri');

    const oppTactic = _resolveTactic(opp);
    const kingFile = _resolveKingFile(me, opp.strategy);
    const rookFile = _oppRookFileAbs(opp);
    const routeEndFile = _routeEndFileAbs(oppTactic);
    const distance = (kingFile != null && rookFile != null) ? Math.abs(kingFile - rookFile) : null;

    // 重み: 戦型の初期値に、相手の戦法の pace と玉飛の距離で補正する
    const weights = { ...BASE_WEIGHTS[kind] };
    if (oppTactic && oppTactic.pace === 'rapid') { weights.quick += .1; weights.side += .1; } // 急戦には間に合う囲い
    if (oppTactic && oppTactic.pace === 'slow')  { weights.hard  += .1; weights.top  += .1; } // 持久戦には堅さと上部
    if (distance != null && distance <= 2) weights.top  += .1;   // 近い＝縦から攻められる
    if (distance != null && distance >= 4) weights.side += .1;   // 遠い＝横から回り込まれる

    // 脅威の筋: 相手の飛車の筋＋主役の経路の終点の筋（重複は除く）。盤の脅威の帯に使う
    const threatFiles = [...new Set([rookFile, routeEndFile].filter(f => f != null))];

    return {
      kind, label: KIND_LABEL[kind], distance, weights, threatFiles,
      // fitness の減点判定や他モジュールが使う中間値
      _kingFile: kingFile, _rookFile: rookFile, _routeEndFile: routeEndFile,
      _oppLeadPiece: oppTactic && oppTactic.lead ? oppTactic.lead.piece : null,
    };
  }

  /**
   * 囲いの対戦相性スコア: Σ 重み × ratings。端攻めが効く相手には端攻めを持つ囲いを減点する
   * @param {Object} castle 囲いオブジェクト（ratings, attacks）
   * @param {Object} threatInfo threat() の結果
   * @returns {number} 小数2桁に丸めたスコア
   */
  function fitness(castle, threatInfo) {
    let score = 0;
    const ratings = (castle && castle.ratings) || {};
    const weights = (threatInfo && threatInfo.weights) || {};
    for (const a of AXES) score += (weights[a] || 0) * (ratings[a] || 0);

    // 端攻めは5軸に含まれないので、端攻めが効く相手には別途減点する（計画書 §3-3）
    const hasHashi = castle && Array.isArray(castle.attacks)
      && castle.attacks.some(x => x && x.id === 'hashi');
    const edgeThreat = threatInfo && (
      EDGE_FILES.has(threatInfo._rookFile) ||                                   // 相手の飛車が端筋
      (EDGE_LEADS.has(threatInfo._oppLeadPiece)                                 // 香・桂の主役の経路の終点が
        && threatInfo._routeEndFile != null && threatInfo._kingFile != null     // 玉の筋に近い
        && Math.abs(threatInfo._routeEndFile - threatInfo._kingFile) <= 1));
    if (hasHashi && edgeThreat) score -= 0.5;

    return Math.round(score * 100) / 100;
  }

  /**
   * 戦法の対戦適性: tactic.against[oppStrategy] の3段階評価。
   * 相手の戦略が未選択、または against にキーが無い（データ未整備）ときは 'ok'
   * @param {Object} tactic 戦法オブジェクト
   * @param {string|null} oppStrategy 'ibisha' | 'furibisha' | null
   * @returns {'good'|'ok'|'ng'}
   */
  function tacticFit(tactic, oppStrategy) {
    if (!tactic || !oppStrategy || !tactic.against) return 'ok';
    const v = tactic.against[oppStrategy];
    return v === 'good' || v === 'ok' || v === 'ng' ? v : 'ok';
  }

  const api = { threat, fitness, tacticFit };
  Kakoi.matchup = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api; // node からの読み込み用
})();
