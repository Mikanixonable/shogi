// 層合成（対局図用。DOM に依存しない）: 戦略テンプレート・戦法・囲いの3層を
// ロックつきで重ねて一つの局面を作る。combo.js（距離貪欲な置換）の後継。計画書 §3-1 / §2 L1・L3。
//
// ルールの要点:
//   - 戦法の essential ∪ 主役（lead）のマスはロック。動かさない・追い出さない・donor にしない
//   - castle.core → castle.rest → castle.shell の順に置く。filler は比較専用で合成では置かない
//   - castle.rest は core に含まれない守り駒（金・銀など）の置き場所。ロック済みのマスは飛ばし、
//     置けなくても衝突にしない（囲いが「守り駒すべて」の行き先を決める。計画書 §2 L1）
//   - どこにも属さない金・銀は空いている初期位置へ戻す（届かなければ持ち駒）
//   - castle.hand の駒（兜・ボナンザの角など）は、戦法の持ち駒に無ければ盤上から持ち駒へ移す
//   - 「届くか」は pieceMatch.moveCount（その駒の動きで何手かかるかの BFS）で判定し、
//     donor の優劣は pieceMatch.moveCost（アニメ用コスト）で決める
//   - core の目標マスがロック駒に塞がれているときは castle.flex の to へ逃がす（崩し形）
//   - core の駒が足りないときは、flex.to にいるロック済みの同種の駒が「貸し出し」で兼ねられる
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';
  const { key, parsePieces, parseSquare, label, mirrorSq } = Kakoi.notation;
  const { findTactic, findCastle } = Kakoi.lookup;

  const sq = (f, r) => `${f}${r}`;
  // 金・銀の帰る場所（初期配置のマス。どこにも属さない守り駒はここへ戻す）
  const HOME = { 金: ['49', '69'], 銀: ['39', '79'] };
  // アニメ用の滑らせやすさ（donor の優劣付け用。null なら滑らせない＝多手数の移動）
  const canSlide = (p, from, to) => Kakoi.pieceMatch.moveCost(p, from, to);
  // その駒の動きで何手かかるか（届く判定用。Infinity なら届かない。計画書 L3）
  const moveCount = (p, from, to) => Kakoi.pieceMatch.moveCount(p, from, to);

  // 戦略テンプレートの既定囲い。既定値の解決規則は Kakoi.constraints が唯一の権威
  // （defaultCastle は文字列または {vsIbisha,vsFuribisha}。相手の戦略で振り分け、不明なら vsIbisha）
  function templateCastleOf(strategy, oppStrategy) {
    const id = Kakoi.defaults.defaultCastleId(strategy, oppStrategy);
    return id ? findCastle(id) : null;
  }

  /**
   * 戦略・戦法・囲いの3層を合成した局面を返す。
   * @param {{strategy?:string, tacticId?:string, castleId?:string,
   *          side?:'sente'|'gote', priority?:'tactic'|'castle',
   *          oppStrategy?:string}} opts
   *   oppStrategy: 囲い未選択のとき戦略テンプレートの既定囲いを振り分けるのに使う
   * @returns {{position: Kakoi.Position,
   *            conflicts: Array<{code:string, squares?:string[], text:string}>,
   *            moved: number, flexed: Array<{piece:string, from:string, to:string}>}}
   */
  function position(opts = {}) {
    const { strategy = null, tacticId = null, castleId = null,
      side = 'sente', priority = 'tactic', oppStrategy = null } = opts;
    const tactic = tacticId ? findTactic(tacticId) : null;
    const castle = castleId ? findCastle(castleId) : null;

    // 1. 土台: 戦法があれば戦法の局面、なければ戦略テンプレート（既定囲い＋想定配置）
    let base;
    if (tactic) {
      base = Kakoi.Position.fromPieces(tactic.pieces, {
        leadSquare: tactic.lead ? tactic.lead.square : null,
        hand: tactic.hand || '',
      });
    } else {
      const tc = templateCastleOf(strategy, oppStrategy);
      base = tc ? Kakoi.Position.fromCastle(tc, Kakoi.SETUPS[tc.setup]) : new Kakoi.Position([], []);
    }
    // 土台が既定囲いの局面のとき、前の囲いの core/rest role を引きずらないよう support に均す
    const pieces = base.pieces.map(x => ({
      ...x, role: x.role === 'core' || x.role === 'rest' ? 'support' : x.role,
    }));
    const hand = [...(base.hand || [])];
    const baseSq = new Map(pieces.map(x => [x, sq(x.f, x.r)]));  // moved の基準

    const conflicts = [];
    const flexed = [];
    let displaced = 0;          // 盤から持ち駒へ移した駒の数（moved に加算）
    const assigned = new Set(); // 囲いの目標として確定した駒（donor・追い出しの対象外）
    const at = (f, r) => pieces.find(x => key(x.f, x.r) === key(f, r));

    // 2. ロック: 戦法の essential ∪ 主役のマスにいる駒
    const locked = new Set();
    if (tactic) {
      const sqs = new Set(parsePieces(tactic.essential).map(x => sq(x.f, x.r)));
      if (tactic.lead && tactic.lead.square) sqs.add(tactic.lead.square);
      for (const s of sqs) {
        const { f, r } = parseSquare(s);
        const x = at(f, r);
        if (x) locked.add(x);
      }
    }
    const castleWins = priority === 'castle'; // 最後に選んだ層が勝つ（計画書 §3-1）

    // 盤上で筋 f にいる先手の歩（ex を除く）。持ち駒の歩を打つと二歩になるかの判定用
    const pawnOnFile = (f, ex) => pieces.some(x => x !== ex && x.owner === 'sente' && x.p === '歩' && x.f === f);

    // donor を探す: 盤上の先手駒でロック・主役・確定済み以外の同種の駒。
    // 届くかは moveCount（BFSの手数。歩・香・桂の後退・横滑りを防ぐ。計画書 L3）、
    // 優劣は moveCost（滑らせられるもの優先、なければ手数の少ない順）。同点は盤上の並び順
    function findDonor(p, f, r) {
      const to = sq(f, r);
      let best = null, bestCost = Infinity;
      for (const x of pieces) {
        if (x.p !== p || x.owner !== 'sente') continue;
        if (locked.has(x) || x.role === 'lead' || assigned.has(x)) continue;
        const n = moveCount(x.p, sq(x.f, x.r), to);
        if (!isFinite(n)) continue;
        let c = canSlide(x.p, sq(x.f, x.r), to);
        if (c == null) c = 9 + n;                    // 滑らせない多手数の移動は後順位
        if (c >= bestCost) continue;
        best = x; bestCost = c;
      }
      return best;
    }

    // (f,r) に置く駒を調達できるか。ex はこれから追い出す駒（除いて考える）
    const canSource = (p, f, r, ex) =>
      !!findDonor(p, f, r) || (hand.includes(p) && !(p === '歩' && pawnOnFile(f, ex)));

    // 駒を調達して (f,r) に role で置く。盤上の donor → 持ち駒の順。失敗なら null
    function sourcePlace(p, f, r, role) {
      const d = findDonor(p, f, r);
      if (d) { d.f = f; d.r = r; d.role = role; return d; }
      const i = hand.indexOf(p);
      if (i < 0) return null;
      if (p === '歩' && pawnOnFile(f, null)) return null; // 打っても二歩になるだけ
      hand.splice(i, 1);
      const x = { p, f, r, owner: 'sente', role };
      pieces.push(x);
      return x;
    }

    // 盤上の駒を持ち駒へ
    function displace(x) {
      hand.push(x.p);
      pieces.splice(pieces.indexOf(x), 1);
      displaced++;
    }

    const flexOf = s => (castle && Array.isArray(castle.flex)
      ? castle.flex.find(e => e && e.sq === s) : null);

    // core の目標 (f,r) がロック駒に塞がれたとき、崩し形として flex.to へ置く。
    // to のマスは「空き」か「置ける」（同種の駒＝貸し出しで兼ねる / 別種の非ロック駒＝追い出して置く）
    function tryFlex(t, f, r) {
      const fx = flexOf(sq(f, r));
      if (!fx) return false;
      for (const to of fx.to || []) {
        const { f: tf, r: tr } = parseSquare(to);
        const on = at(tf, tr);
        if (on && on.p === t.p) {                      // 同種がいる: その駒が囲いの駒を兼ねる
          if (on.role !== 'lead') on.role = 'core';
          assigned.add(on);
          flexed.push({ piece: t.p, from: sq(f, r), to });
          return true;
        }
        if (on && (locked.has(on) || assigned.has(on))) continue; // 動かせない駒がいる
        if (!canSource(t.p, tf, tr, on)) continue;
        if (on) displace(on);
        assigned.add(sourcePlace(t.p, tf, tr, 'core'));
        flexed.push({ piece: t.p, from: sq(f, r), to });
        return true;
      }
      return false;
    }

    if (castle) {
      const countFailed = [];
      const placeCore = () => {
        // 3. castle.core を core の記述順に置く
        for (const t of parsePieces(castle.core)) {
          const S = sq(t.f, t.r);
          const on = at(t.f, t.r);
          if (on && on.p === t.p) {                      // 同種がいる: 囲いの駒として採用
            if (on.role !== 'lead') on.role = 'core';
            assigned.add(on);
            continue;
          }
          if (on && locked.has(on)) {                    // ロック駒（essential/主役）と衝突
            if (castleWins) {
              // 囲いを優先: ロック駒は持ち駒へ。衝突の事実は SQUARE として記録する
              conflicts.push({ code: 'SQUARE', squares: [S],
                text: `${label(t.f, t.r)}で${on.p}（戦法の必須）と${t.p}が重なり囲いを優先` });
              displace(on);
              const placed = sourcePlace(t.p, t.f, t.r, 'core');
              if (placed) assigned.add(placed); else countFailed.push(t);
              continue;
            }
            if (!tryFlex(t, t.f, t.r)) {
              conflicts.push({ code: 'SQUARE', squares: [S],
                text: `${label(t.f, t.r)}で${on.p}と${t.p}が重なる` });
            }
            continue;
          }
          if (on && assigned.has(on)) {                  // 先に確定した囲いの駒と衝突
            conflicts.push({ code: 'SQUARE', squares: [S],
              text: `${label(t.f, t.r)}で${on.p}と${t.p}が重なる` });
            continue;
          }
          if (on) displace(on);                          // 別種の駒は持ち駒へ
          const placed = sourcePlace(t.p, t.f, t.r, 'core');
          if (placed) { assigned.add(placed); continue; }
          countFailed.push(t);                           // donor も持ち駒も無い → 4 で貸し出しを試す
        }
      };

      const lendMissingCore = () => {
        // 4. essential の貸し出し: flex.to にいるロック済みの同種の駒が core を兼ねる。
        //    兼ねられれば目標は果たした扱い（COUNT にしない）
        for (const t of countFailed) {
          const fx = flexOf(sq(t.f, t.r));
          let shared = null;
          if (fx) {
            for (const to of fx.to || []) {
              const { f: tf, r: tr } = parseSquare(to);
              const x = at(tf, tr);
              if (x && x.p === t.p && locked.has(x)) { shared = { x, to }; break; }
            }
          }
          if (shared) {
            if (shared.x.role !== 'lead') shared.x.role = 'core';
            assigned.add(shared.x);
            flexed.push({ piece: t.p, from: sq(t.f, t.r), to: shared.to });
            continue;
          }
          conflicts.push({ code: 'COUNT', squares: [sq(t.f, t.r)],
            text: `${t.p}${label(t.f, t.r)}を置く駒が足りない` });
        }
      };

      const placeRest = () => {
        // 5. castle.rest: core に含まれない守り駒（金・銀など）の置き場所。ロック済みの
        //    マスは飛ばし、置けなくても衝突にしない。囲いは「守り駒すべて」の行き先を
        //    core+rest で指定するので、囲い切替の残留駒が残らない（計画書 §2 L1）
        for (const t of parsePieces(castle.rest || '')) {
          const on = at(t.f, t.r);
          if (on && on.p === t.p) {
            if (locked.has(on) || assigned.has(on)) continue;
            if (on.role !== 'lead') on.role = 'rest';
            assigned.add(on);
            continue;
          }
          if (on && (locked.has(on) || assigned.has(on))) continue;
          if (on) displace(on);
          const placed = sourcePlace(t.p, t.f, t.r, 'rest');
          if (placed) assigned.add(placed);
        }
      };

      const normalizeGuardPieces = () => {
        // 6. 取り残された金・銀の正規化: 囲い（core/rest）にも戦法（必須・主役）にも
        //    属さず、初期位置にもいない守り駒は、届くほうの空いた初期位置へ戻す。
        //    どの初期位置も空いていなければ持ち駒へ（例: 片美濃の5八の金は6九へ戻る）
        for (const x of [...pieces]) {
          if (x.owner !== 'sente' || !HOME[x.p]) continue;
          if (x.role === 'lead' || locked.has(x) || assigned.has(x)) continue;
          if (HOME[x.p].includes(sq(x.f, x.r))) continue;
          const home = HOME[x.p].map(parseSquare)
            .filter(h => !at(h.f, h.r))
            .map(h => ({ ...h, n: moveCount(x.p, sq(x.f, x.r), sq(h.f, h.r)) }))
            .filter(h => isFinite(h.n))
            .sort((a, b) => a.n - b.n)[0];
          if (home) { x.f = home.f; x.r = home.r; x.role = 'support'; }
          else displace(x);
        }
      };

      const placeShell = () => {
        // 7. castle.shell: 囲いの前線の歩など。ロック済みのマスは戦法の駒を残して飛ばす
        //    （殻は戦法を追い出さない）。filler は置かない
        for (const t of parsePieces(castle.shell)) {
          const on = at(t.f, t.r);
          if (on && locked.has(on)) continue;
          if (on && on.p === t.p) { assigned.add(on); continue; } // role はそのまま
          if (on && assigned.has(on)) continue;                    // 確定済みの core は動かせない
          if (!canSource(t.p, t.f, t.r, on)) continue;             // 置けない殻はあきらめる
          if (on) displace(on);
          assigned.add(sourcePlace(t.p, t.f, t.r, 'support'));
        }
      };

      const applyCastleHand = () => {
        // 8. castle.hand: 囲いが持ち駒にしている駒（兜・ボナンザの角）を盤上から持ち駒へ。
        //    戦法の持ち駒が既に持っていれば何もしない。必須・確定済みの駒は動かせず、
        //    そのときは HAND 衝突として記録する
        for (const p of (castle.hand || '')) {
          if (hand.includes(p)) continue;
          const on = pieces.find(x => x.p === p && x.owner === 'sente');
          if (!on) continue;
          if (locked.has(on) || assigned.has(on) || on.role === 'lead') {
            conflicts.push({ code: 'HAND', squares: [sq(on.f, on.r)],
              text: `${p}を持ち駒にできない（${label(on.f, on.r)}の駒は戦法の必須）` });
            continue;
          }
          displace(on);
        }
      };

      placeCore();
      lendMissingCore();
      placeRest();
      normalizeGuardPieces();
      placeShell();
      applyCastleHand();
    }

    // 9. 検証: 二歩（同じ筋に先手の歩が2枚）
    const pawnFiles = new Map();
    for (const x of pieces) {
      if (x.owner !== 'sente' || x.p !== '歩') continue;
      if (!pawnFiles.has(x.f)) pawnFiles.set(x.f, []);
      pawnFiles.get(x.f).push(x);
    }
    for (const [f, xs] of pawnFiles) {
      if (xs.length > 1) {
        conflicts.push({ code: 'PAWN', squares: xs.map(x => sq(x.f, x.r)),
          text: `${f}筋に歩が${xs.length}枚（二歩）` });
      }
    }

    // 8. moved: 土台からマスが変わった駒 ＋ 持ち駒へ移した駒 ＋ 持ち駒から出した駒
    let moved = displaced;
    for (const x of pieces) {
      if (x.owner !== 'sente') continue;
      if (!baseSq.has(x) || baseSq.get(x) !== sq(x.f, x.r)) moved++;
    }

    let pos = new Kakoi.Position(pieces, hand);
    if (side === 'gote') {   // 後手は先手の形を回転して使う（計画書 §5）
      pos = mirror(pos);
      for (const c of conflicts) if (c.squares) c.squares = c.squares.map(mirrorSq);
      for (const fx of flexed) { fx.from = mirrorSq(fx.from); fx.to = mirrorSq(fx.to); }
    }
    return { position: pos, conflicts, moved, flexed };
  }

  /**
   * 局面を回転して後手側にする: (f,r)→(10−f,10−r)、owner を反転。持ち駒はそのまま
   * @param {Kakoi.Position} pos
   * @returns {Kakoi.Position}
   */
  function mirror(pos) {
    pos = pos && pos.position ? pos.position : pos; // {position,...} の結果オブジェクトも受け付ける
    const pieces = (pos ? pos.pieces : []).map(x => ({
      ...x, f: 10 - x.f, r: 10 - x.r,
      owner: x.owner === 'sente' ? 'gote' : 'sente',
    }));
    return new Kakoi.Position(pieces, [...((pos && pos.hand) || [])]);
  }

  /**
   * 自分（先手）と相手（後手）の完成図を一つの盤に重ねる（計画書 §5）。
   * 同じマスに両軍の駒が来たら接触として記録する:
   *   - 歩同士 → あとから選んだ側（late）の歩を自陣へ1段下げる（先手は r+1、後手は r−1）。
   *     下げ先が塞がっていたらもう一方を試し、それでも駄目なら両方を元の位置へ戻す（'ng'。L10）
   *   - それ以外の重なり → 'ng'
   * @param {Kakoi.Position} mePos 自分の局面（先手の駒）
   * @param {Kakoi.Position} oppPos 相手の局面（後手の駒。mirror 済みのもの）
   * @returns {{position: Kakoi.Position,
   *            contacts: Array<{sq:string, kind:'pawn'|'ng', text:string}>}}
   */
  function merge(mePos, oppPos, { late = 'opp' } = {}) {
    mePos = mePos && mePos.position ? mePos.position : mePos;   // 結果オブジェクトも受け付ける
    oppPos = oppPos && oppPos.position ? oppPos.position : oppPos;
    const pieces = [...((mePos && mePos.pieces) || []), ...((oppPos && oppPos.pieces) || [])]
      .map(x => ({ ...x }));
    const hand = [...((mePos && mePos.hand) || []), ...((oppPos && oppPos.hand) || [])];
    const occ = new Map();
    for (const x of pieces) {
      const k = key(x.f, x.r);
      if (!occ.has(k)) occ.set(k, []);
      occ.get(k).push(x);
    }
    const contacts = [];
    for (const [k, xs] of [...occ.entries()]) {
      const me = xs.filter(x => x.owner === 'sente');
      const opp = xs.filter(x => x.owner === 'gote');
      if (!me.length || !opp.length) continue;
      const f = Math.floor(k / 10), r = k % 10;
      const sqName = sq(f, r);
      if (me.length === 1 && opp.length === 1 && me[0].p === '歩' && opp[0].p === '歩') {
        // まず「あとから選んだ側（late）」の歩を1段下げる。下げ先が塞がっていたら
        // もう一方の歩を下げる。それでも駄目なら両方を元の位置へ戻す（ng。計画書 L10）
        const latePawn = late === 'me' ? me[0] : opp[0];
        const earlyPawn = late === 'me' ? opp[0] : me[0];
        const tryDrop = (pawn, other) => {
          const nr = pawn.owner === 'sente' ? r + 1 : r - 1;
          const nk = key(f, nr);
          if (nr < 1 || nr > 9 || occ.has(nk)) return false;
          occ.set(k, [other]);
          occ.set(nk, [pawn]);
          pawn.r = nr;
          contacts.push({ sq: sqName, kind: 'pawn',
            text: `${label(f, r)}で両軍の歩が接触。${pawn.owner === 'gote' ? '後手' : '先手'}の歩を${label(f, nr)}へ` });
          return true;
        };
        if (!tryDrop(latePawn, earlyPawn) && !tryDrop(earlyPawn, latePawn)) {
          contacts.push({ sq: sqName, kind: 'ng',
            text: `${label(f, r)}で両軍の歩が接触（どちらも下げ先が塞がっている）` });
        }
      } else {
        contacts.push({ sq: sqName, kind: 'ng',
          text: `${label(f, r)}で${me.map(x => x.p).join('・')}と${opp.map(x => x.p).join('・')}が重なる` });
      }
    }
    return { position: new Kakoi.Position(pieces, hand), contacts };
  }

  const api = { position, mirror, merge };
  Kakoi.compose = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api; // node からの読み込み用
})();
