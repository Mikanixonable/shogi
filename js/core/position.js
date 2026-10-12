// 局面: 想定配置＋補助の駒＋囲いの駒（＋攻め筋の後手駒）から盤面を組み立て、整合性を検査する
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';
  const { key, parsePieces } = Kakoi.notation;

  // 先手の駒の総数（盤上＋持ち駒）
  const FULL_SET = { 玉: 1, 飛: 1, 角: 1, 金: 2, 銀: 2, 桂: 2, 香: 2, 歩: 9 };

  class Position {
    /** @param {Array<{p,f,r,owner,role}>} pieces */
    constructor(pieces, hand = []) {
      this.pieces = pieces;
      this.hand = hand;
      this._at = new Map(pieces.map(x => [key(x.f, x.r), x]));
    }

    at(f, r) { return this._at.get(key(f, r)); }
    has(f, r) { return this._at.has(key(f, r)); }

    /** 囲いデータから局面を作る。attack を渡すと後手の駒を重ねる */
    static fromCastle(castle, attack = null) {
      const setup = Kakoi.SETUPS[castle.setup];
      const pieces = [
        ...parsePieces(setup.pieces, { owner: 'sente', role: 'setup' }),
        ...parsePieces(castle.support, { owner: 'sente', role: 'support' }),
        ...parsePieces(castle.core, { owner: 'sente', role: 'core' }),
        ...(attack ? parsePieces(attack.gote, { owner: 'gote', role: 'attack' }) : []),
      ];
      return new Position(pieces, castle.hand ? [...castle.hand] : []);
    }
  }

  /** データの打ち間違いを検出する（駒数・同じマスの重複・二歩・攻め筋の重なり） */
  function validateCastle(castle) {
    const errors = [];
    const sente = Position.fromCastle(castle).pieces;
    const count = {};
    const squares = new Set(), pawnFiles = new Set();
    for (const x of sente) {
      count[x.p] = (count[x.p] || 0) + 1;
      const k = key(x.f, x.r);
      if (squares.has(k)) errors.push(`同じマスに2枚: ${x.f}${x.r}`);
      squares.add(k);
      if (x.p === '歩') {
        if (pawnFiles.has(x.f)) errors.push(`二歩: ${x.f}筋`);
        pawnFiles.add(x.f);
      }
    }
    for (const p of castle.hand || []) count[p] = (count[p] || 0) + 1;
    for (const [p, n] of Object.entries(FULL_SET)) if (count[p] !== n) errors.push(`${p}の枚数 ${count[p] || 0}/${n}`);
    for (const a of castle.attacks || []) {
      for (const g of parsePieces(a.gote)) if (squares.has(key(g.f, g.r))) errors.push(`攻め筋「${a.name}」の駒が先手と重なる: ${g.f}${g.r}`);
    }
    for (const s of castle.sources || []) if (!Kakoi.SOURCES[s.ref]) errors.push(`未登録の出典: ${s.ref}`);
    return errors;
  }

  Kakoi.Position = Position;
  Kakoi.validateCastle = validateCastle;
})();
