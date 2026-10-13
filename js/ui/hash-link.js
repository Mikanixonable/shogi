// URLハッシュ: 盤面の状態（各側のスロット・相手の表示・選択）は URL ハッシュだけが正。
// 形式: `#k=mt:bougin,mc:funa,ot:shikenbisha,oc:mino&opp=1&sel=mc`
//   - `k=` は 側（m=自分/o=相手）＋層（t=戦法/c=囲い）:id をコンマで並べる（並びに意味は無い）
//   - `opp=1` は相手を盤に出している
//   - `sel=` は選択中の層（例: mc = me.castle）
// 初期状態は空のハッシュ。`k=`/`opp=` の無いハッシュ（旧形式を含む）は読まず、初期状態で開く。
// 状態が変わると pushState でハッシュを書く（ブラウザの「戻る」＝元に戻す）。
// 選択だけの変更は履歴を積まず replaceState。表示の好み（駒の表示・利き・脅威の帯・テーマ）は
// URL に載せず localStorage に持つ。
// parseHash / buildQuery は location に触れない純粋関数（unit-test からも使う）。
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';

  const KIND_CHAR = { t: 'tactic', c: 'castle' };
  const KIND_LETTER = { tactic: 't', castle: 'c' };
  const WHO_CHAR = { m: 'me', o: 'opp' };
  const WHO_LETTER = { me: 'm', opp: 'o' };
  // 盤面の状態を持つ store のキー。これらが変わるとハッシュを書き直す
  const BOARD_KEYS = ['slots', 'showOpp', 'selected'];

  const encodeSel = sel => {
    const [who, kind] = String(sel || '').split('.');
    return WHO_LETTER[who] && KIND_LETTER[kind] ? WHO_LETTER[who] + KIND_LETTER[kind] : '';
  };
  const decodeSel = s => {
    const m = /^([mo])([tc])$/.exec(String(s || ''));
    return m ? `${WHO_CHAR[m[1]]}.${KIND_CHAR[m[2]]}` : null;
  };

  /** state からハッシュのクエリ部分（先頭の # を含まない）を作る。parseHash と対称。初期状態は '' */
  function buildQuery(state) {
    const slots = state.slots;
    const toks = [];
    for (const who of ['me', 'opp']) {
      for (const kind of ['tactic', 'castle']) {
        const id = slots && slots[who] && slots[who][kind];
        if (id) toks.push(`${WHO_LETTER[who]}${KIND_LETTER[kind]}:${id}`);
      }
    }
    if (!toks.length && !state.showOpp) return '';
    const p = new URLSearchParams();
    if (toks.length) p.set('k', toks.join(','));
    if (state.showOpp) p.set('opp', '1');
    const sel = encodeSel(state.selected);
    if (sel) p.set('sel', sel);
    // id は ASCII なので %2C→, %3A→: に戻して読みやすい形にする
    return p.toString().replace(/%2C/g, ',').replace(/%3A/g, ':');
  }

  /**
   * ハッシュ文字列（先頭の # を含まない）を解析し、盤面の状態を返す純粋関数。
   * 欠けた項目・不正な値は初期値（空のスロット・相手 OFF・selected=null）になる。
   * id の正当性は呼び出し側（constraints.normalizeSlots）が確かめる
   * @returns {{slots:{me:Object, opp:Object}, showOpp:boolean, selected:string|null}}
   */
  function parseHash(h) {
    const p = new URLSearchParams(String(h || ''));
    const slots = { me: { tactic: null, castle: null }, opp: { tactic: null, castle: null } };
    let showOpp = false, selected = null;
    if (p.has('k') || p.has('opp')) {
      for (const tok of String(p.get('k') || '').split(',')) {
        const m = /^([mo])([tc]):(.+)$/.exec(tok.trim());
        if (m) slots[WHO_CHAR[m[1]]][KIND_CHAR[m[2]]] = m[3];
      }
      showOpp = p.get('opp') === '1';
      selected = decodeSel(p.get('sel'));
    }
    return { slots, showOpp, selected };
  }

  /** location.hash から盤面の状態を読み、store へ入れられる形（正規化済み）で返す */
  function read(fallbackKind = 'castle') {
    const C = Kakoi.constraints;
    const p = parseHash(location.hash.replace(/^#/, ''));
    return {
      slots: C.normalizeSlots(p.slots), showOpp: p.showOpp,
      selected: C.normalizeSelected(p.selected, p.showOpp, fallbackKind),
    };
  }

  /**
   * store との双方向の接続:
   *   - 盤面の状態が変わるたびにハッシュを書く（スロット・相手の表示の変更は pushState、
   *     選択だけの変更は replaceState）
   *   - 「戻る／進む」・アドレスバーの編集（popstate）はハッシュから状態を作り直す
   * @returns {{ stop:()=>void }}
   */
  function attach(store) {
    let fromPop = false;   // ハッシュ起点の変更は書き戻しても履歴を積まない
    store.subscribe((state, changed) => {
      if (!BOARD_KEYS.some(k => changed.has(k))) return;
      const q = buildQuery(state);
      if (q === location.hash.replace(/^#/, '')) return;
      const push = !fromPop && (changed.has('slots') || changed.has('showOpp'));
      history[push ? 'pushState' : 'replaceState'](null, '', q ? `#${q}` : location.pathname + location.search);
    });
    // 旧形式・不正な値で開いたときは、正規化した状態のハッシュへ書き直す（履歴は積まない）
    const q0 = buildQuery(store.state);
    if (q0 !== location.hash.replace(/^#/, '')) {
      history.replaceState(null, '', q0 ? `#${q0}` : location.pathname + location.search);
    }
    const onPop = () => {
      const kind = Kakoi.constraints.parseSel(store.state.selected);
      fromPop = true;
      try { store.set(read(kind ? kind.kind : 'castle')); } finally { fromPop = false; }
    };
    addEventListener('popstate', onPop);
    return { stop: () => removeEventListener('popstate', onPop) };
  }

  Kakoi.hashLink = { read, attach, buildQuery, parseHash };
  if (typeof module !== 'undefined' && module.exports) module.exports = Kakoi.hashLink; // unit-test 用
})();
