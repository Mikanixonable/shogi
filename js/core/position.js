// 局面: 想定配置＋補助の駒＋囲いの駒（＋攻め筋の後手駒）から盤面を組み立てる
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';
  const { key, parsePieces } = Kakoi.notation;

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
    static fromCastle(castle, setup, attack = null) {
      const support = [castle.shell, castle.filler].filter(Boolean).join(' ');
      const pieces = [
        ...parsePieces(setup.pieces, { owner: 'sente', role: 'setup' }),
        ...parsePieces(support, { owner: 'sente', role: 'support' }),
        ...parsePieces(castle.core, { owner: 'sente', role: 'core' }),
        ...(attack ? parsePieces(attack.gote, { owner: 'gote', role: 'attack' }) : []),
      ];
      return new Position(pieces, castle.hand ? [...castle.hand] : []);
    }

    /**
     * 先手だけの駒文字列から局面を作る（戦法用）。leadSquare の駒は role 'lead'、他は 'support'
     * @param {string} str 例: "玉28 飛98"
     * @param {{ leadSquare?:string, hand?:string }} [opts]
     */
    static fromPieces(str, { leadSquare = null, hand = '' } = {}) {
      const pieces = parsePieces(str, { owner: 'sente' })
        .map(x => ({ ...x, role: leadSquare && `${x.f}${x.r}` === leadSquare ? 'lead' : 'support' }));
      return new Position(pieces, hand ? [...hand] : []);
    }
  }

  Kakoi.Position = Position;
})();
