// URLハッシュ共有: いまの画面と選択を location.hash に映し、URLを貼れば同じ状態で開ける。
// 形式は `#` + URLSearchParams。表示の好み（mode/heat/skeleton など）は共有しない。
// pick は層名の頭文字で圧縮する: ['strategy','tactic','castle'] → 'stc'
// mo/mw（相手・脅威の表示）は既定 true なので、'0'（非表示）のときだけ書き出してURLを短く保つ
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';

  // pick の短縮表記 ⇔ 層名
  const PICK_CHAR = { s: 'strategy', t: 'tactic', c: 'castle' };
  const PICK_LETTER = { strategy: 's', tactic: 't', castle: 'c' };

  const decodePick = s => {
    const out = [];
    for (const ch of String(s || '')) {
      const l = PICK_CHAR[ch];
      if (l && !out.includes(l)) out.push(l);
    }
    return out;
  };
  const encodePick = pick => (Array.isArray(pick) ? pick : []).map(l => PICK_LETTER[l] || '').join('');

  const isObj = v => v && typeof v === 'object' && !Array.isArray(v);

  /** state からハッシュのクエリ部分（先頭の # を含まない）を作る。read と対称 */
  function buildQuery(state) {
    const p = new URLSearchParams();
    const put = (k, v) => { if (v !== null && v !== undefined && v !== '') p.set(k, v); };
    put('v', state.view);
    put('c', state.castleId);
    put('t', state.tacticId);
    put('cf', state.clusterFamily);
    const mu = isObj(state.matchup) ? state.matchup : {};
    for (const [side, pre] of [['me', 'm'], ['opp', 'o']]) {
      const s = isObj(mu[side]) ? mu[side] : {};
      put(pre + 's', s.strategy);
      put(pre + 't', s.tacticId);
      put(pre + 'c', s.castleId);
      put(pre + 'p', encodePick(s.pick));
    }
    const sh = isObj(mu.show) ? mu.show : {};
    if (sh.opp === false) p.set('mo', '0');
    if (sh.threat === false) p.set('mw', '0');
    return p.toString();
  }

  /**
   * location.hash を読み、認識した項目だけ state に書き込む（in-place）。
   * 未知・不正な値は黙って捨てる。起動時に正規化より先に呼ばれ、不正値はそこで丸められる。
   * ハッシュが壊れていても起動を止めない。
   */
  function read(state) {
    try {
      const h = location.hash.replace(/^#/, '');
      if (!h) return;
      const p = new URLSearchParams(h);
      if (p.has('v')) state.view = p.get('v');
      if (p.has('c')) state.castleId = p.get('c');
      if (p.has('t')) state.tacticId = p.get('t');
      if (p.has('cf')) state.clusterFamily = p.get('cf');
      const mu = isObj(state.matchup) ? state.matchup : {};
      // 対局図のキーが1つでもあれば共有URLと見なす。共有URLは全項目を書き出すので、
      // 欠けている項目は「保存値を残す」ではなく既定値に戻す（貼った側と同じ状態で開くため）
      const muTouched = ['s', 't', 'c', 'p'].some(k => p.has('m' + k) || p.has('o' + k)) || p.has('mo') || p.has('mw');
      if (muTouched) {
        const readSide = (s, pre) => {
          const out = { ...(isObj(s) ? s : {}) };
          if (p.has(pre + 's')) out.strategy = p.get(pre + 's');
          if (p.has(pre + 't')) out.tacticId = p.get(pre + 't');
          if (p.has(pre + 'c')) out.castleId = p.get(pre + 'c');
          out.pick = p.has(pre + 'p') ? decodePick(p.get(pre + 'p')) : [];
          return out;
        };
        const show = { ...(isObj(mu.show) ? mu.show : {}) };
        show.opp = p.get('mo') !== '0';
        show.threat = p.get('mw') !== '0';
        state.matchup = { me: readSide(mu.me, 'm'), opp: readSide(mu.opp, 'o'), show };
      }
    } catch { /* 壊れたハッシュで起動を止めない */ }
  }

  /** store を購読し、状態が変わるたびにハッシュを書き換える（replaceState なので履歴は積まない） */
  function sync(store) {
    store.subscribe(state => {
      const h = '#' + buildQuery(state);
      if (location.hash !== h) history.replaceState(null, '', h);
    });
  }

  Kakoi.hashLink = { read, sync };
})();
