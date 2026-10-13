// 盤にフォーカスがあるときの矢印キー（U3: 「選択中の制約の隣の候補へ」）。
// 移動先を返す純関数（DOM・store には触れない。計画書 S6 の keyboard-nav）
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';
  const K = window.Kakoi;

  /**
   * @param {{who:string, kind:string}} sel constraints.parseSel の結果
   * @param {object} st その側の実効状態（constraints.sides() の1側）
   * @param {{ rows:Array, repo:Kakoi.Repository }} ctx
   *   rows: tacticNav.tacticRows の全家系統行、repo: tacticById/ofSideByFamily を持つもの
   * @param {string} key 'ArrowLeft'|'ArrowRight'|'ArrowUp'|'ArrowDown'
   * @returns {{kind:string, id:string}|null} 適用する制約（_set に渡す kind/id）。無ければ null
   */
  function arrowTarget(sel, st, { rows, repo }, key) {
    if (!sel || !st) return null;
    if (sel.kind === 'tactic') {
      const list = rows.filter(r => r.family.side === st.strategy);
      const cur = repo.tacticById(st.tacticId);
      const next = cur && K.tacticNav.neighbor(list, cur, key);
      return next ? { kind: 'tactic', id: next.id } : null;
    }
    if (sel.kind === 'castle') {
      const castles = repo.ofSideByFamily(st.strategy);
      const i = castles.findIndex(c => c.id === st.castleId);
      if (i < 0 || castles.length < 2) return null;
      const dir = key === 'ArrowRight' || key === 'ArrowDown' ? 1 : -1;
      return { kind: 'castle', id: castles[(i + dir + castles.length) % castles.length].id };
    }
    // 戦略は2択のトグル
    return { kind: 'strategy', id: st.strategy === 'ibisha' ? 'furibisha' : 'ibisha' };
  }

  K.keyboardNav = { arrowTarget };
  if (typeof module !== 'undefined' && module.exports) module.exports = K.keyboardNav;
})();
