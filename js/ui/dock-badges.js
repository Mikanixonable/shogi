// 左ドックのバッジと「採用中の戦略に合わない項目」の判定（計画書 S6 の badges）:
//   - バッジ2軸（§3-1/U1）: 連動=preview で他層が変わる → data-cascade（灰色の破線枠）＋⇄。
//     相手との相性=compat.judge().vs → ◎/△ の文字だけ（朱の線は引かない）。相手が無いときは非表示
//   - 戦略に合うかは系統ではなく項目ごとに判定する（片側限定の項目が両側の項目を
//     含む系統にいても正しく隠れる）。合わない項目は dock-view が hidden にする
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';
  const K = window.Kakoi;
  const { plain } = K.html;
  const { LAYER_JA, findTactic, findCastle, tacticFamilyOf } = K.lookup;

  const nameOf = (kind, id) => {
    if (id == null) return '（なし）';
    if (kind === 'strategy') return (K.STRATEGIES[id] && K.STRATEGIES[id].label) || id;
    const x = kind === 'tactic' ? findTactic(id) : findCastle(id);
    return x ? x.name : id;
  };
  // その囲いを許す戦略の集合（strategies があればそれだけ、なければ side）
  const sidesOf = c => (Array.isArray(c.strategies) ? c.strategies : [c.side]);

  /**
   * 2軸バッジ（data-cascade / data-vs / data-implied）を要素に書く
   * @param {HTMLElement} b
   * @param {Array} changed preview の changed（空なら連動なし）
   * @param {Object} j compat.judge の結果（vs は相手との相性軸）
   * @param {boolean} implied 既定値で補った層なら true（破線）
   */
  function badge(b, changed, j, implied) {
    b.dataset.cascade = changed && changed.length ? 'true' : 'false';
    b.dataset.vs = j && j.vs ? j.vs.level : '';
    if (implied) b.dataset.implied = 'true'; else delete b.dataset.implied;
  }

  /**
   * title の要約（理由＋連動の予告）
   * @param {Object} j compat.judge の結果
   * @param {Array} changed preview の changed
   */
  function tip(j, changed) {
    const tip = [];
    if (j.reasons && j.reasons.length) tip.push(j.reasons.map(r => plain(r.text)).join('／'));
    if (j.vs && j.vs.reasons && j.vs.reasons.length) tip.push(j.vs.reasons.map(r => plain(r.text)).join('／'));
    if (changed && changed.length) {
      tip.push(`連動して変わる: ${changed.map(c =>
        `${LAYER_JA[c.kind]} ${nameOf(c.kind, c.from)}→${c.to != null ? nameOf(c.kind, c.to) : '外れる'}`).join('、')}`);
    }
    return tip.join('。');
  }

  /**
   * 項目ごとの「採用中の戦略に合わない」判定（隠す対象。分類は戦略だけ）
   * @param {{kind:string, id:string}} it items() の1項目
   * @param {Object|null} st その側の実効状態（sides() の1側。null 可）
   */
  function offItem(it, st) {
    if (!st || !st.strategy) return false;
    if (it.kind === 'tactic') {
      const f = tacticFamilyOf(findTactic(it.id));
      return f ? f.side !== st.strategy : false;
    }
    const c = findCastle(it.id);
    return c ? !sidesOf(c).includes(st.strategy) : false;
  }

  K.dockBadges = { badge, tip, offItem, nameOf, sidesOf };
})();
