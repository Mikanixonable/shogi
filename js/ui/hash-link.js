// URLハッシュ共有: 制約リストと選択状態を location.hash に映し、URLを貼れば同じ状態で開ける。
// 新形式: `#v=board&k=os:furibisha,ot:shikenbisha,mc:funa&sel=mc`
//   - `k=` の並び順が優先度（先頭ほど古い）。側は m=自分/o=相手、層は s/t/c
//   - `sel=` は選択中の制約（例: mc = me.castle）
// 旧形式（v=/c=/t=/ms=…mw=）は読み取り時に制約リストへ変換する。書き出しは新形式のみ。
// 表示の好み（mode/heat/skeleton/dock）はこれまでどおり URL に載せない。
// parseHash / buildQuery は location に触れない純粋関数（unit-test からも使う）。
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';

  const LAYER_CHAR = { s: 'strategy', t: 'tactic', c: 'castle' };
  const LAYER_LETTER = { strategy: 's', tactic: 't', castle: 'c' };
  const WHO_CHAR = { m: 'me', o: 'opp' };
  const WHO_LETTER = { me: 'm', opp: 'o' };
  const LAYERS = ['strategy', 'tactic', 'castle'];

  const encodeSel = sel => {
    const [who, kind] = String(sel || '').split('.');
    return WHO_LETTER[who] && LAYER_LETTER[kind] ? WHO_LETTER[who] + LAYER_LETTER[kind] : '';
  };
  const decodeSel = s => {
    const m = /^([mo])([stc])$/.exec(String(s || ''));
    return m ? `${WHO_CHAR[m[1]]}.${LAYER_CHAR[m[2]]}` : null;
  };

  // 旧形式の pick 圧縮表記（'stc'）→ 層名の列
  const decodePick = s => {
    const out = [];
    for (const ch of String(s || '')) {
      const l = LAYER_CHAR[ch];
      if (l && !out.includes(l)) out.push(l);
    }
    return out;
  };

  /** state からハッシュのクエリ部分（先頭の # を含まない）を作る。parseHash と対称 */
  function buildQuery(state) {
    const p = new URLSearchParams();
    const put = (k, v) => { if (v !== null && v !== undefined && v !== '') p.set(k, v); };
    put('v', state.view);
    const list = Array.isArray(state.constraints) ? state.constraints : [];
    // k= は空でも書く: 制約を全部外した状態も「新形式の空リスト」として往復できるように
    // （書かないと旧形式と区別できず、開いた側が自分の保存値で上書きされてしまう）
    p.set('k', list
      .filter(e => WHO_LETTER[e.who] && LAYER_LETTER[e.kind])
      .map(e => `${WHO_LETTER[e.who]}${LAYER_LETTER[e.kind]}:${e.id}`)
      .join(','));
    put('sel', encodeSel(state.selected));
    put('cf', state.clusterFamily);
    if (state.showThreat === false) put('mw', '0'); // 脅威の帯スイッチ（旧形式と同じキー。消しているときだけ書く）
    // id は ASCII なので %2C→, %3A→: に戻して読みやすい形にする
    return p.toString().replace(/%2C/g, ',').replace(/%3A/g, ':');
  }

  // 旧形式の対局図（ms/mt/mc/mp/os/ot/oc/op/mo）→ 制約リスト。
  // 各側の制約は「pick に無い層が先頭（最も古い）、pick の順が末尾（新しい）」（L5）。
  // mo=0 は相手を全部取り除く
  function legacyMatchup(p) {
    const side = (pre, who) => {
      const vals = { strategy: p.get(pre + 's'), tactic: p.get(pre + 't'), castle: p.get(pre + 'c') };
      const pick = decodePick(p.get(pre + 'p'));
      const order = pick.length ? [...LAYERS.filter(l => !pick.includes(l)), ...pick] : LAYERS;
      return order.filter(l => vals[l] != null && vals[l] !== '')
        .map(l => ({ who, kind: l, id: vals[l] }));
    };
    const opp = p.get('mo') === '0' ? [] : side('o', 'opp');
    return [...side('m', 'me'), ...opp];
  }

  /**
   * ハッシュ文字列（先頭の # を含まない）を解析し、state への差分を返す純粋関数。
   * `k=` があれば新形式、無ければ旧形式を移行規則（計画書 §2）に従って変換する。
   * ハッシュが認識できたとき、脅威の帯は `mw` の指定だけを見る（U9: mw が無いときは
   * 保存値を持ち越さず既定値＝表示する に戻す。mw=0 のときだけ非表示）
   * @returns {{view?:string, constraints?:Array, selected?:string|null,
   *   showThreat?:boolean, clusterFamily?:string|null}}
   */
  function parseHash(h) {
    const out = {};
    const p = new URLSearchParams(String(h || ''));
    if (p.has('cf')) out.clusterFamily = p.get('cf') || null;
    const mw = () => p.get('mw') !== '0';   // 既定値は表示する

    // 新形式
    if (p.has('k')) {
      const list = [];
      for (const tok of String(p.get('k')).split(',')) {
        const m = /^([mo])([stc]):(.+)$/.exec(tok.trim());
        if (m) list.push({ who: WHO_CHAR[m[1]], kind: LAYER_CHAR[m[2]], id: m[3] });
      }
      out.constraints = list;
      out.view = p.get('v') === 'cluster' ? 'cluster' : 'board';
      if (p.has('sel')) {
        const sel = decodeSel(p.get('sel'));
        if (sel) out.selected = sel;
      }
      out.showThreat = mw();
      return out;
    }

    // 旧形式: v= が書き出し側の権威（旧 buildQuery は全キーを常に書いていた）
    const v = p.get('v');
    if (v === 'cluster') { out.view = 'cluster'; out.showThreat = mw(); return out; }
    if (v === 'castle') {
      out.view = 'board';
      const list = [];
      if (p.has('c')) list.push({ who: 'me', kind: 'castle', id: p.get('c') });
      out.constraints = list;
      out.selected = 'me.castle';
      out.showThreat = mw();
      return out;
    }
    if (v === 'tactic') {
      out.view = 'board';
      const list = [];
      if (p.has('t')) list.push({ who: 'me', kind: 'tactic', id: p.get('t') });
      // 旧戦法画面で囲いが別途保持されていた場合（tc= / 後方互換の保険）
      if (p.has('tc')) list.push({ who: 'me', kind: 'castle', id: p.get('tc') });
      out.constraints = list;
      out.selected = 'me.tactic';
      out.showThreat = mw();
      return out;
    }
    const hasMu = v === 'matchup'
      || ['s', 't', 'c', 'p'].some(k => p.has('m' + k) || p.has('o' + k)) || p.has('mo') || p.has('mw');
    if (hasMu) {
      out.view = 'board';
      out.constraints = legacyMatchup(p);
      const lastMe = [...out.constraints].reverse().find(e => e.who === 'me');
      if (lastMe) out.selected = `me.${lastMe.kind}`;
      out.showThreat = mw();
      return out;
    }
    if (p.has('c') || p.has('t')) {
      // v= の無い旧形式の断片: 囲いか戦法を me の制約として拾う
      out.view = 'board';
      const list = [];
      if (p.has('c')) list.push({ who: 'me', kind: 'castle', id: p.get('c') });
      else if (p.has('t')) list.push({ who: 'me', kind: 'tactic', id: p.get('t') });
      out.constraints = list;
      out.showThreat = mw();
      return out;
    }
    if (v === 'board') { out.view = 'board'; out.showThreat = mw(); }
    return out;
  }

  /**
   * location.hash を読み、認識した項目だけ state に書き込む（in-place）。
   * 未知・不正な値は黙って捨てる。起動時に正規化より先に呼ばれ、不正値はそこで丸められる。
   * ハッシュが壊れていても起動を止めない。
   */
  function read(state) {
    try {
      const h = location.hash.replace(/^#/, '');
      if (!h) return undefined;
      const patch = parseHash(h);
      for (const k of ['view', 'constraints', 'selected', 'showThreat', 'clusterFamily']) {
        if (patch[k] !== undefined) state[k] = patch[k];
      }
      return patch;   // 呼び出し側が「ハッシュが何を指定したか」を知れるよう返す
    } catch { return undefined; /* 壊れたハッシュで起動を止めない */ }
  }

  /** store を購読し、状態が変わるたびにハッシュを書き換える（replaceState なので履歴は積まない） */
  function sync(store) {
    store.subscribe(state => {
      const h = '#' + buildQuery(state);
      if (location.hash !== h) history.replaceState(null, '', h);
    });
  }

  // ハッシュ由来の差分を、起動時と同じ規則で正規化する（L4/L5 と同じ経路:
  // 制約は先頭から apply(set) で再生し、存在しない側を指す selected は握り直す）
  function normalize(patch) {
    const out = {};
    if (patch.constraints !== undefined) {
      const valid = e => e && (e.who === 'me' || e.who === 'opp')
        && Kakoi.constraints.KINDS.includes(e.kind)
        && (e.kind === 'strategy' ? Object.hasOwn(Kakoi.STRATEGIES || {}, e.id)
          : e.kind === 'tactic' ? !!Kakoi.lookup.findTactic(e.id)
          : !!Kakoi.lookup.findCastle(e.id));
      out.constraints = (patch.constraints || []).filter(valid)
        .reduce((acc, e) => Kakoi.constraints.apply(acc, {
          type: 'set', who: e.who, kind: e.kind, id: e.id,
        }).list, []);
    }
    if (patch.view !== undefined) out.view = patch.view;
    if (patch.clusterFamily !== undefined) out.clusterFamily = patch.clusterFamily;
    if (patch.showThreat !== undefined) out.showThreat = patch.showThreat;
    if (patch.selected !== undefined) {
      const sel = Kakoi.constraints.parseSel(patch.selected);
      const list = out.constraints || [];
      out.selected = sel && !(sel.who === 'opp' && !list.some(e => e.who === 'opp'))
        ? patch.selected : null;
      if (out.selected == null) {
        const last = [...list].reverse().find(e => e.who === 'me') || list[list.length - 1];
        out.selected = last ? `${last.who}.${last.kind}` : 'me.castle';
      }
    }
    return out;
  }

  /**
   * store との双方向の接続（U9）:
   *   - 状態の変化を replaceState でハッシュへ映す（sync と同じ）
   *   - hashchange を購読し、アドレスバーの直接編集も状態に反映する
   *     （自分の書き込みは replaceState なので hashchange を発火しない＝二重適用にならない）
   * @returns {{ stop:()=>void }}
   */
  function attach(store) {
    sync(store);
    const onChange = () => {
      const h = location.hash.replace(/^#/, '');
      if (!h) return;
      const patch = parseHash(h);
      const next = normalize(patch);
      if (Object.keys(next).length) store.set(next);
    };
    addEventListener('hashchange', onChange);
    return { stop: () => removeEventListener('hashchange', onChange) };
  }

  Kakoi.hashLink = { read, sync, attach, normalize, buildQuery, parseHash };
  if (typeof module !== 'undefined' && module.exports) module.exports = Kakoi.hashLink; // unit-test 用
})();
