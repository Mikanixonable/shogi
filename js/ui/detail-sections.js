// 右ドックのセクション部品（計画書 §5 / U5）: 囲い・戦法の詳細の描画を
// 「HTML文字列を返す関数」に分解したもの。
// 選択中の制約の種類ごとの組み立ては board-detail-view.js（Kakoi.BoardDetailView）が行う。
// 決め事:
//   - 出典: 本文中の [[ref]] / [[a|b]] トークンは rich(text, citer) で [n] に変わる。
//     citer はパネル1枚につき1つ作り、出典リストは sourcesBlock が同じ番号で並べ直す（§7）
//   - マス連動: 部品は data-sq / data-tone を出すだけ。盤へのホバー委譲はビュー側が貼る
//   - クリック: 部品は data-act / クラスを出すだけ。委譲ハンドラもビュー側
//     （.attack＝攻め筋の選択、[data-act="castle"]＝その囲いを制約にする、
//       [data-act="set"]＝任意の層を制約にする）
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';
  const K = window.Kakoi;
  const { label } = K.notation;
  const { esc, sqAttr, rich, plain, sourcesBlock } = K.html;

  // ===== 特徴の目安（ペンタグラム）の幾何 =====
  // 5軸を正五角形の頂点に、上から時計回りで割り当てる
  const RATINGS = [
    ['hard', '堅さ'],
    ['wide', '玉の広さ'],
    ['top', '上部の強さ'],
    ['side', '横の強さ'],
    ['quick', '組みやすさ'],
  ];
  // 戦法の5軸（囲いの RATINGS と同じ頂点の配置。ratings は tactic-ratings.js）
  const TACTIC_RATINGS = [
    ['attack', '攻撃力'],
    ['speed', '速さ'],
    ['flex', '柔軟性'],
    ['safety', '玉の安全'],
    ['easy', '覚えやすさ'],
  ];
  // viewBox に収まるよう左の軸ラベル（組みやすさ）分だけ中心を右へ寄せる
  const RADAR = { cx: 102, cy: 74, r: 42, viewBox: '0 0 200 136' };
  // 頂点ごとの軸ラベル: 頂点からの差し分(dx,dy)と文字の基点
  const RADAR_LABEL = [
    [0, -12, 'middle'],
    [10, -3, 'start'],
    [4, 18, 'middle'],
    [-4, 18, 'middle'],
    [-10, -3, 'end'],
  ];
  const vertex = (i, rad) => {
    const a = (-90 + i * 72) * Math.PI / 180;
    return [RADAR.cx + rad * Math.cos(a), RADAR.cy + rad * Math.sin(a)];
  };
  const num = n => Math.round(n * 10) / 10;

  // h3＋見出し下の本体の定型（<small> は注記。css/layout.css の .sec）
  const sec = (title, small, body) =>
    `<div class="sec"><h3>${title}${small ? `<small>${small}</small>` : ''}</h3>${body}</div>`;

  /**
   * 特徴の目安: 5軸×5段階のレーダーチャート。
   * @param {Object} ratings 囲いの強み {hard,wide,top,side,quick}
   * @param {{weights?:Object|null, title?:string, small?:string, hint?:string}} [opt]
   *   weights: 戦型の重み（matchup.threat().weights）。渡すと重み×10 の多角形を
   *           朱の破線（.mu-w）で重ねる（計画書 §5: ペンタグラムへの戦型重みの重ね方）
   */
  function penta(ratings = {}, { weights = null, title = '特徴の目安', small = '5段階・主観',
    hint = '「横の強さ」は横からの飛車攻めへの耐性。端からの攻めは含みません',
    axes = RATINGS, parent = null, color = '' } = {}) {
    const rings = [1, 2, 3, 4, 5].map(l =>
      `<polygon class="penta-ring${l === 5 ? ' edge' : ''}" points="${axes.map((_, i) => vertex(i, RADAR.r * l / 5).map(num).join(',')).join(' ')}"/>`).join('');
    const spokes = axes.map((_, i) => {
      const [x, y] = vertex(i, RADAR.r).map(num);
      return `<line class="penta-spoke" x1="${RADAR.cx}" y1="${RADAR.cy}" x2="${x}" y2="${y}"/>`;
    }).join('');
    const poly = r => axes.map(([k], i) =>
      vertex(i, RADAR.r * Math.min(5, Math.max(0, r[k] || 0)) / 5).map(num).join(',')).join(' ');
    // 戦法: 派生なら親の形を破線で重ねて「何が変わったか」を見せる
    const parentPoly = parent ? `<polygon class="penta-parent" points="${poly(parent)}"/>` : '';
    // 戦型の重み（0〜0.5 程度）を0〜5の目盛りに換算して重ねる
    const wpts = weights ? axes.map(([k], i) =>
      vertex(i, RADAR.r * Math.min(5, (weights[k] || 0) * 10) / 5).map(num).join(',')).join(' ') : null;
    const labels = axes.map(([k, name], i) => {
      const [x, y] = vertex(i, RADAR.r).map(num);
      const [dx, dy, anchor] = RADAR_LABEL[i];
      const tip = weights
        ? `${name} ${ratings[k]}/5・戦型の重み${(weights[k] || 0).toFixed(2)}`
        : `${name} ${ratings[k]}/5`;
      return `<text class="penta-lbl" x="${num(x + dx)}" y="${num(y + dy)}" text-anchor="${anchor}"><title>${tip}</title>${name}</text>`;
    }).join('');
    return `<div class="sec"><h3${hint ? ` title="${esc(hint)}"` : ''}>${title}${small ? `<small>${small}</small>` : ''}</h3>` +
      `<svg class="penta" viewBox="${RADAR.viewBox}" role="img" aria-label="${esc(title)}（5軸・5段階）"${color ? ` style="--tc:${color}"` : ''}>${rings}${spokes}` +
      `${parentPoly}<polygon class="penta-val${color ? ' tac' : ''}" points="${poly(ratings)}"/>${wpts ? `<polygon class="mu-w" points="${wpts}"/>` : ''}${labels}</svg></div>`;
  }

  // 戦法の特徴の目安: 派生は親（variantOf）の形を破線で重ね、差分を一行で添える
  function tacticPenta(tactic, parent, color) {
    const r = tactic && tactic.ratings;
    if (!r) return '';
    const pr = parent && parent.ratings;
    const diff = pr ? TACTIC_RATINGS.filter(([k]) => pr[k] !== r[k])
      .map(([k, n]) => `${n}${r[k] > pr[k] ? '↑' : '↓'}`).join('・') : '';
    return penta(r, { axes: TACTIC_RATINGS, parent: pr || null, color,
      hint: '「速さ」は仕掛けまでの手数、「覚えやすさ」は定跡の量と注意点の少なさ' }) +
      (pr ? `<p class="note ps-diff">破線＝${esc(parent.name)}${diff ? `（${diff}）` : '（形は同じ）'}</p>` : '');
  }

  // ===== #タグ =====
  // 囲い: 系統（group＝朱）・細分類・その他のタグを個別に並べる（装飾のみ・クリック不可）
  function castleTags(castle, family, subtype) {
    const parts = family ? [`<span class="tag group">#${esc(family.name)}</span>`] : [];
    if (subtype) parts.push(`<span class="tag">#${esc(subtype.name)}</span>`);
    const rest = [...(castle.aliases || []).map(a => `別名：${a}`),
      ...(castle.tags || []).filter(t => !family || t !== family.name)];
    parts.push(...rest.map(t => `<span class="tag">#${esc(t)}</span>`));
    return `<div class="tags">${parts.join('')}</div>`;
  }

  // 戦法: 系統（group）・向き（context）・別名
  function tacticTags(tactic, family) {
    const parts = family ? [`<span class="tag group">#${esc(family.name)}</span>`] : [];
    const tags = [tactic.context, ...(tactic.aliases || []).map(a => `別名：${a}`)].filter(Boolean);
    parts.push(...tags.map(x => `<span class="tag">#${esc(x)}</span>`));
    return `<div class="tags">${parts.join('')}</div>`;
  }

  // ===== 本文 =====
  const desc = (text, citer) => text ? `<p class="desc">${rich(text, citer)}</p>` : '';
  const note = (text, citer) => text ? `<p class="note">${rich(text, citer)}</p>` : '';
  const refFamily = ref => ref ? `<p class="note">文献上の分類：${esc(ref)}</p>` : '';

  // 囲いの駒（core の駒チップ。乗せると盤で光る）
  function coreChips(castle) {
    const chips = K.notation.parsePieces(castle.core).map(x =>
      `<span class="chip" data-sq="${x.f}${x.r}"><b>${x.p}</b>${label(x.f, x.r)}</span>`).join('');
    return sec('囲いの駒', '', `<div class="chips">${chips}</div>`);
  }

  /**
   * 発展の前後: どの囲いから駒を動かして組むか（発展元）/ どの囲いへ組み替えられるか（発展先）。
   * ボタンは .tc-castle を流用し data-act="castle" data-id を出すだけ（委譲はビュー側）。
   * @param {{from:?Object, to:Object[]}} lineage Repository.lineageOf() 相当の出力
   */
  function lineage(lineage) {
    if (!lineage || (!lineage.from && !(lineage.to || []).length)) return '';
    const btn = c =>
      `<button class="tc-castle" data-act="castle" data-id="${esc(c.id)}"><b>${esc(c.short || c.name)}</b></button>`;
    const row = (lbl, list) => list.length
      ? `<div class="ln-row"><span class="ln-lbl">${lbl}</span>${list.map(btn).join('')}</div>` : '';
    return sec('発展', '押すとその囲いへ',
      row('発展元', lineage.from ? [lineage.from] : []) + row('発展先', lineage.to || []));
  }

  /**
   * 長所・短所のリスト。
   * @param {Array<{t:string, sq?:string[]}>} items
   * @param {{tone?:string, cls?:string, small?:string}} [opt]
   *   tone: li の data-tone（盤ホバーの色。'good'/'bad'）。cls: 'cons' で － 印
   */
  function pcList(title, items, { tone = '', cls = '', small = '点線の項目は盤上に表示' } = {}, citer) {
    if (!items || !items.length) return '';
    const li = items.map(it =>
      `<li${sqAttr(it.sq)}${tone ? ` data-tone="${tone}"` : ''}><span>${rich(it.t, citer)}</span></li>`).join('');
    return sec(title, small, `<ul class="pc-list${cls ? ' ' + cls : ''}">${li}</ul>`);
  }

  /**
   * 典型的な攻め筋（押すと盤に重ねる）。
   * hasOpp: 相手の制約があるとき true。盤には駒を置かず狙いのマスと矢印だけが出る（§5）
   */
  function attacks(castle, attackId, citer, { hasOpp = false } = {}) {
    if (!castle.attacks || !castle.attacks.length) {
      return '<p class="note">登録された攻め筋はありません。</p>';
    }
    const btns = castle.attacks.map(a =>
      `<button class="attack" data-id="${esc(a.id)}" aria-pressed="${a.id === attackId}">` +
      `<b>${esc(a.name)}</b>${rich(a.t, citer)}</button>`).join('');
    return sec('典型的な攻め筋',
      hasOpp ? '押すと盤に表示（狙いのマスと矢印のみ。駒は置きません）' : '押すと盤に表示',
      `<div class="attacks">${btns}</div>`);
  }

  // 主役の駒の動き: 経路を「▲３九銀 → ３八 → …」の手順にし、各マスに乗せると盤で光る
  function route(tactic) {
    if (!tactic.route || !tactic.route.length || !tactic.lead) return '';
    const sq = s => label(+s[0], +s[1]);
    const steps = tactic.route.map((s, i) =>
      `<li class="rt-step" data-sq="${s}">${i === 0 ? `▲${sq(s)}${esc(tactic.lead.piece)}` : sq(s)}</li>`).join('');
    const last = tactic.route[tactic.route.length - 1];
    const text = tactic.route.length > 1
      ? `主役の${tactic.lead.piece}は、最終的に${sq(last)}に立ちます。`
      : `主役の${tactic.lead.piece}は${sq(last)}に立ちます（経路は1マスのみ）。`;
    return sec('主役の駒の動き', 'マスに乗せると盤で光る', `<ol class="rt-steps">${steps}</ol>`) +
      `<p class="desc">${esc(text)}</p>` +
      (/推定/.test(tactic.note || '') ? '<p class="note">経路の途中のマスは推定です。</p>' : '');
  }

  /**
   * 相性のよい囲い（pairings の ◎/○。押すとその囲いを制約にする）。
   * @param {Array<{id:string, name:string, familyName:string, level:string,
   *   why?:string, current?:boolean}>} rows
   *   current: いまの実効囲い（pressed で示す）
   */
  function pairingCastles(rows) {
    if (!rows.length) return '<p class="note">データ上の対応する囲いはありません</p>';
    const items = rows.map(c =>
      `<div class="tc-row"><button class="tc-castle" data-act="castle" data-id="${esc(c.id)}" data-compat="${esc(c.level || 'ok')}"` +
        `${c.current ? ' aria-pressed="true"' : ''}` +
        `${c.why ? ` title="${esc(plain(c.why))}"` : ''}>` +
        `<b>${esc(c.name)}</b><span>${esc(c.familyName)}${c.current ? '・選択中' : ''}</span></button>` +
        `<button class="tc-go" data-act="castle" data-id="${esc(c.id)}" title="${esc(c.name)}を制約にして選択" ` +
        `aria-label="${esc(c.name)}を制約にして選択">→</button></div>`
    ).join('');
    return sec('相性のよい囲い', '押すとこの囲いを制約にする', `<div class="tc-castles">${items}</div>`);
  }

  /**
   * 派生の切替: 同じ variantOf 親に束ねられた兄弟タイルをチップで出す。
   * @param {Array<{id:string, name:string, current?:boolean}>} items 親を先頭に含める
   */
  function variants(items) {
    if (!items || items.length < 2) return '';
    const chips = items.map(v =>
      `<button class="vchip" data-act="set" data-kind="tactic" data-id="${esc(v.id)}"` +
      ` aria-pressed="${!!v.current}">${esc(v.name)}</button>`).join('');
    return sec('派生の切替', '同じ形の変化。押すとその戦法を制約にする', `<div class="vchips">${chips}</div>`);
  }

  /**
   * 対戦相性（fitness）: 戦型の重み × 囲いの強みのスコアと、効いている軸のチップ。
   * @param {number} fit matchup.fitness() の値
   * @param {Object} threat その側から見た matchup.threat()（label/weights を使う）
   * @param {Object} castle 評価対象の囲い（ratings を使う）
   */
  function fitness(fit, threat, castle) {
    const w = (threat && threat.weights) || {};
    const ratings = (castle && castle.ratings) || {};
    const chips = RATINGS
      .filter(([k]) => (w[k] || 0) >= .25)
      .map(([k, n]) => `<span class="tag">#${esc(n)} ${ratings[k] != null ? ratings[k] : '―'}/5</span>`).join('');
    return sec('対戦相性', threat && threat.label ? esc(threat.label) : '',
      `<p class="mu-fit">${fit.toFixed(2)}<small>戦型の重み × 囲いの強み</small></p>` +
      (chips ? `<div class="tags">${chips}</div>` : ''));
  }

  /**
   * 「どちらからの攻めが主になるか」: 玉と相手の飛車の筋の差からの説明（§5）
   * @param {number|null} distance 筋の差（threat.distance 相当）
   * @param {string} mineLabel 玉の側の呼称（'自分'/'相手'）
   * @param {string} oppLabel 飛車の側の呼称（'相手'/'自分'）
   */
  function distanceNote(distance, mineLabel, oppLabel) {
    if (distance == null) return '';
    return `<p class="note">${esc(mineLabel)}の玉と${esc(oppLabel)}の飛車の距離は ${distance}筋。` +
      (distance <= 2 ? '近い＝縦（上部）から攻められやすい'
        : distance >= 4 ? '遠い＝横から回り込まれやすい' : '縦と横の両方を意識する') + '</p>';
  }

  /**
   * 相手との相性（compat.judge の vs 軸: against / againstTactic）。
   * 同じ側の整合とは別の軸。苦手でも選べる（要件5）
   * @param {Array<{level:'good'|'neutral'|'bad', text:string}>} rows vsRows() の出力
   * @param {string} otherLabel 相手側の呼称（'相手'/'自分'）
   */
  function vsSection(rows, otherLabel) {
    const mk = l => l === 'good' ? '◎' : l === 'bad' ? '×' : '△';
    const li = (rows && rows.length ? rows : [{ level: 'neutral', text: 'データ上の得意・苦手はありません' }])
      .map(r => `<li data-level="${r.level === 'bad' ? 'ng' : 'ok'}"><span class="mk"${r.level === 'bad' ? ' data-bad' : ''}>${mk(r.level)}</span>` +
        `<span>${esc(r.text)}</span></li>`).join('');
    return sec(`${esc(otherLabel)}との相性`, 'その側の両立とは別の軸。苦手でも選べます',
      `<ul class="mu-reasons">${li}</ul>`);
  }

  // compat.judge().vs を vsSection の行に変換する
  function vsRows(vs) {
    if (!vs) return [];
    const lv = v => v === 'good' || v === 'best' ? 'good' : v === 'ng' ? 'bad' : 'neutral';
    return (vs.reasons || []).map(r => ({
      level: r.code === 'AGAINST_TACTIC' ? lv(vs.tactic) : lv(vs.strategy),
      text: r.text,
    }));
  }

  /**
   * 組み合わせの理由（compat.judge の reasons）。同じ文は重複させない。
   * マスのある理由は点線下線＋ホバーで盤に示す
   * @param {Array<{level:string, text:string, squares?:string[]}>} items
   */
  function reasons(items, citer, { title = '組み合わせの理由' } = {}) {
    const seen = new Set();
    const rows = (items || []).filter(it => it && it.text && !seen.has(it.text) && seen.add(it.text));
    if (!rows.length) return '';
    const li = rows.map(it =>
      `<li data-level="${it.level === 'ng' ? 'ng' : 'ok'}" data-tone="${it.level === 'ng' ? 'bad' : 'focus'}"${sqAttr(it.squares)}>` +
      `<span class="mk">${it.level === 'ng' ? '×' : '＋'}</span><span>${rich(it.text, citer)}</span></li>`).join('');
    return sec(title, '点線の項目は盤上に表示', `<ul class="mu-reasons">${li}</ul>`);
  }

  // 両軍の接触（compose.merge の contacts: {sq, kind:'pawn'|'ng', text}）。
  // マスは合成済みの絶対座標なので data-abs を付け、詳細側の側反転（opp 用 mirrorSq）の対象外にする
  function contacts(list, citer) {
    if (!list || !list.length) return '';
    const li = list.map(c =>
      `<li data-level="${c.kind === 'ng' ? 'ng' : 'ok'}" data-tone="${c.kind === 'ng' ? 'bad' : 'focus'}" data-sq="${esc(c.sq)}" data-abs="1">` +
      `<span class="mk">${c.kind === 'ng' ? '×' : '＋'}</span><span>${rich(c.text, citer)}</span></li>`).join('');
    return sec('両軍の接触', 'マスに乗せると盤で光る', `<ul class="mu-reasons">${li}</ul>`);
  }

  /**
   * 両立しない選択: 理由（マスのある理由は乗せると盤で光る）と、直す候補。
   * 自動では差し替えない。候補を押すとその層をその候補に差し替える（[data-act="set"]）
   * @param {Array<{text:string, squares?:string[]}>} reasons compat.judge の ng の理由
   * @param {Array<{id:string, name:string}>} suggestions constraints.suggest の候補
   * @param {'tactic'|'castle'} kind 差し替える層
   */
  function conflict(reasons, suggestions, kind, citer) {
    const li = reasons.map(r =>
      `<li data-level="ng" data-tone="bad"${sqAttr(r.squares)}><span class="mk">✕</span><span>${rich(r.text, citer)}</span></li>`).join('');
    const chips = suggestions.map(c =>
      `<button class="vchip" data-act="set" data-kind="${kind}" data-id="${esc(c.id)}" aria-pressed="false">${esc(c.name)}</button>`).join('');
    return sec('いまの組み合わせでは両立しません', '自動では差し替えません',
      `<ul class="mu-reasons">${li}</ul>` +
      (chips
        ? `<p class="note">代わりの候補（押すと差し替え）</p><div class="vchips">${chips}</div>`
        : '<p class="note">差し替えで直せる候補はありません。もう一方の層を外すか選び直してください。</p>'));
  }

  // 出典: [[ref]] を引いた本文の番号と同じ並びで出す（cited が先・未引用は後ろに連番）
  function sources(items, citer, small = '') {
    return sec('出典', small, sourcesBlock(items, citer));
  }

  K.detailSections = {
    RATINGS, TACTIC_RATINGS, RADAR, sec,
    penta, tacticPenta, castleTags, tacticTags,
    desc, note, refFamily, coreChips, lineage, pcList, attacks, route,
    pairingCastles, variants, fitness, distanceNote,
    vsSection, vsRows, reasons, conflict, contacts, sources,
  };
})();
