// 右の解説: 特徴のペンタグラム・タグ・説明・囲いの駒・長所短所・攻め筋・出典を一続きに。文章と盤のマスを結びつける
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';
  const { label } = Kakoi.notation;
  const { esc, sqAttr } = Kakoi.html;

  // 特徴の目安の軸。正五角形の頂点に、上から時計回りで割り当てる
  const RATINGS = [
    ['hard', '堅さ'],
    ['wide', '玉の広さ'],
    ['top', '上部の強さ'],
    ['side', '横の強さ'],
    ['quick', '組みやすさ'],
  ];

  // レーダーチャートの幾何。viewBox に収まるよう左の軸ラベル（組みやすさ）分だけ中心を右へ寄せる
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

  class DetailView {
    /**
     * @param {HTMLElement} el `#detail`（.detail-body）
     * @param {{ onHover:(squares:string[], tone:string)=>void, onAttack:(id:string|null)=>void,
     *   onMatchup?:(id:string)=>void }} handlers
     *   onMatchup: 「対局図で開く」でこの囲いを自分側にセットして対局図へ移る
     */
    constructor(el, handlers) {
      this.el = el;
      this.handlers = handlers;
      this._id = null;
      el.addEventListener('mouseover', e => {
        const t = e.target.closest('[data-sq]');
        if (t) handlers.onHover(t.dataset.sq.split(' '), t.dataset.tone || 'focus');
      });
      el.addEventListener('mouseout', e => {
        const t = e.target.closest('[data-sq]');
        if (t && !t.contains(e.relatedTarget)) handlers.onHover([], null);
      });
      el.addEventListener('click', e => {
        const mu = e.target.closest('[data-act="matchup"]');
        if (mu) { if (handlers.onMatchup && this._id) handlers.onMatchup(this._id); return; }
        const b = e.target.closest('.attack');
        if (b) handlers.onAttack(b.getAttribute('aria-pressed') === 'true' ? null : b.dataset.id);
      });
    }

    render(castle, { attackId, sources, family, subtype }) {
      this._id = castle.id;
      this.el.innerHTML = [
        `<button class="mu-open" data-act="matchup">対局図で開く</button>`,
        this._ratings(castle.ratings),
        this._tags(castle, family, subtype),
        castle.refFamily ? `<p class="note">文献上の分類：${esc(castle.refFamily)}</p>` : '',
        `<p class="desc">${esc(castle.desc)}</p>`,
        castle.note ? `<p class="note">${esc(castle.note)}</p>` : '',
        this._coreChips(castle),
        this._list('長所', castle.pros, 'good', ''),
        this._list('短所', castle.cons, 'bad', 'cons'),
        this._attacks(castle, attackId),
        this._sources(sources),
      ].filter(Boolean).join('');
    }

    /** 攻め筋の選択状態だけを更新する */
    setAttack(attackId) {
      for (const b of this.el.querySelectorAll('.attack')) b.setAttribute('aria-pressed', b.dataset.id === attackId);
    }

    // #ハッシュタグ表記: 系統・細分類・その他のタグを個別に並べる（装飾のみ・クリック不可）
    _tags(c, family, subtype) {
      const tags = c.tags.filter(t => t !== family.name);
      const parts = [`<span class="tag group">#${esc(family.name)}</span>`];
      if (subtype) parts.push(`<span class="tag">#${esc(subtype.name)}</span>`);
      parts.push(...tags.map(t => `<span class="tag">#${esc(t)}</span>`));
      return `<div class="tags">${parts.join('')}</div>`;
    }

    // 5軸×5段階を正五角形のレーダーチャートで示す
    _ratings(r) {
      const rings = [1, 2, 3, 4, 5].map(l =>
        `<polygon class="penta-ring${l === 5 ? ' edge' : ''}" points="${RATINGS.map((_, i) => vertex(i, RADAR.r * l / 5).map(num).join(',')).join(' ')}"/>`).join('');
      const spokes = RATINGS.map((_, i) => {
        const [x, y] = vertex(i, RADAR.r).map(num);
        return `<line class="penta-spoke" x1="${RADAR.cx}" y1="${RADAR.cy}" x2="${x}" y2="${y}"/>`;
      }).join('');
      const points = RATINGS.map(([k], i) =>
        vertex(i, RADAR.r * Math.min(5, Math.max(0, r[k] || 0)) / 5).map(num).join(',')).join(' ');
      const labels = RATINGS.map(([k, name], i) => {
        const [x, y] = vertex(i, RADAR.r).map(num);
        const [dx, dy, anchor] = RADAR_LABEL[i];
        return `<text class="penta-lbl" x="${num(x + dx)}" y="${num(y + dy)}" text-anchor="${anchor}"><title>${name} ${r[k]}/5</title>${name}</text>`;
      }).join('');
      return `<div class="sec"><h3 title="「横の強さ」は横からの飛車攻めへの耐性。端からの攻めは含みません">特徴の目安<small>5段階・主観</small></h3>` +
        `<svg class="penta" viewBox="${RADAR.viewBox}" role="img" aria-label="特徴の目安（5軸・5段階）">${rings}${spokes}<polygon class="penta-val" points="${points}"/>${labels}</svg></div>`;
    }

    _coreChips(c) {
      const chips = Kakoi.notation.parsePieces(c.core).map(x =>
        `<span class="chip" data-sq="${x.f}${x.r}"><b>${x.p}</b>${label(x.f, x.r)}</span>`).join('');
      return `<div class="sec"><h3>囲いの駒</h3><div class="chips">${chips}</div></div>`;
    }

    _list(title, items, tone, cls) {
      const li = items.map(it => `<li${sqAttr(it.sq)} data-tone="${tone}">${esc(it.t)}</li>`).join('');
      return `<div class="sec"><h3>${title}<small>点線の項目は盤上に表示</small></h3><ul class="pc-list ${cls}">${li}</ul></div>`;
    }

    _attacks(c, attackId) {
      if (!c.attacks?.length) return '<p class="note">登録された攻め筋はありません。</p>';
      const btns = c.attacks.map(a =>
        `<button class="attack" data-id="${esc(a.id)}" aria-pressed="${a.id === attackId}"><b>${esc(a.name)}</b>${esc(a.t)}</button>`).join('');
      return `<div class="sec"><h3>典型的な攻め筋<small>押すと盤に表示</small></h3><div class="attacks">${btns}</div></div>`;
    }

    _sources(sources) {
      const li = sources.map(s =>
        `<li><span class="cv">${esc(s.for)}</span><span><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a>（${esc(s.publisher)}）</span></li>`).join('');
      return `<div class="sec"><h3>出典</h3><ul class="sources">${li}</ul></div>`;
    }
  }

  Kakoi.DetailView = DetailView;
})();
