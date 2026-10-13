// 左ドックのバッジと「絞り込んだ戦略に合わない項目」の判定（計画書 S6 の badges）:
//   - バッジ2軸（§3-1/U1）: 両立=compat.judge の ng → data-ng（灰色の破線枠）＋✕。
//     相手との相性=compat.judge().vs → ◎/△ の文字だけ（朱の線は引かない）。相手が無いときは非表示
//   - 戦略に合うかは系統ではなく項目ごとに判定する（片側限定の項目が両側の項目を
//     含む系統にいても正しく隠れる）。合わない項目は dock-view が hidden にする
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';
  const K = window.Kakoi;
  const { plain } = K.html;
  const { findTactic, findCastle, tacticFamilyOf, castleSides } = K.lookup;

  /**
   * 2軸バッジ（data-ng / data-vs / data-implied）を要素に書く
   * @param {HTMLElement} b
   * @param {Object} j compat.judge の結果（level が ng なら両立しない。vs は相手との相性軸）
   * @param {boolean} implied 既定値で補った層なら true（破線）
   */
  function badge(b, j, implied) {
    b.dataset.ng = j && j.level === 'ng' ? 'true' : 'false';
    b.dataset.vs = j && j.vs ? j.vs.level : '';
    if (implied) b.dataset.implied = 'true'; else delete b.dataset.implied;
  }

  /**
   * title の要約（両立しない理由＋相手との相性）
   * @param {Object} j compat.judge の結果
   */
  function tip(j) {
    const tip = [];
    if (j.level === 'ng') tip.push(`両立しない: ${(j.ng || []).map(r => plain(r.text)).join('／')}`);
    else if (j.reasons && j.reasons.length) tip.push(j.reasons.map(r => plain(r.text)).join('／'));
    if (j.vs && j.vs.reasons && j.vs.reasons.length) tip.push(j.vs.reasons.map(r => plain(r.text)).join('／'));
    return tip.join('。');
  }

  /**
   * 項目ごとの「絞り込んだ戦略に合わない」判定（隠す対象。分類は戦略だけ）
   * @param {{kind:string, id:string}} it items() の1項目
   * @param {string|null} strategy 絞り込んでいる戦略（'ibisha'|'furibisha'）
   */
  function offItem(it, strategy) {
    if (!strategy) return false;
    if (it.kind === 'tactic') {
      const f = tacticFamilyOf(findTactic(it.id));
      return f ? f.side !== strategy : false;
    }
    const c = findCastle(it.id);
    return c ? !castleSides(c).includes(strategy) : false;
  }

  K.dockBadges = { badge, tip, offItem };
})();
