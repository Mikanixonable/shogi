// 右の解説: タグ・説明・評価の目安・囲いの駒・長所短所・攻め筋・出典。文章と盤のマスを結びつける
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';
  const { label } = Kakoi.notation;

  const RATINGS = [
    ['hard', '堅さ'],
    ['wide', '玉の広さ'],
    ['top', '上部の強さ'],
    ['side', '横の強さ'],
    ['quick', '組みやすさ'],
  ];

  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const sqAttr = sq => sq && sq.length ? ` data-sq="${sq.join(' ')}"` : '';

  class DetailView {
    /**
     * @param {{ body:HTMLElement, tabs:HTMLElement }} els
     * @param {{ onHover:(squares:string[], tone:string)=>void, onAttack:(id:string|null)=>void }} handlers
     */
    constructor(els, handlers) {
      const el = this.el = els.body;
      this.handlers = handlers;
      this.tab = 'overview';
      this.tabs = new Kakoi.Segmented(els.tabs, v => this.showTab(v));
      el.addEventListener('mouseover', e => {
        const t = e.target.closest('[data-sq]');
        if (t) handlers.onHover(t.dataset.sq.split(' '), t.dataset.tone || 'focus');
      });
      el.addEventListener('mouseout', e => {
        const t = e.target.closest('[data-sq]');
        if (t && !t.contains(e.relatedTarget)) handlers.onHover([], null);
      });
      el.addEventListener('click', e => {
        const b = e.target.closest('.attack');
        if (b) handlers.onAttack(b.getAttribute('aria-pressed') === 'true' ? null : b.dataset.id);
      });
    }

    render(castle, state) {
      const pane = (id, parts) => `<div class="pane" data-pane="${id}">${parts.filter(Boolean).join('')}</div>`;
      this.el.innerHTML = [
        pane('overview', [
          this._tags(castle),
          `<p class="desc">${esc(castle.desc)}</p>`,
          castle.note ? `<p class="note">${esc(castle.note)}</p>` : '',
          this._coreChips(castle),
          this._ratings(castle.ratings),
        ]),
        pane('proscons', [this._list('長所', castle.pros, 'good', ''), this._list('短所', castle.cons, 'bad', 'cons')]),
        pane('attacks', [this._attacks(castle, state.attackId)]),
        pane('sources', [this._sources(castle)]),
      ].join('');
      this.showTab(this.tab);
    }

    /** 表示するタブを切り替える */
    showTab(id) {
      this.tab = id;
      this.tabs.setValue(id);
      for (const p of this.el.querySelectorAll('.pane')) p.classList.toggle('active', p.dataset.pane === id);
    }

    /** 攻め筋の選択状態だけを更新する */
    setAttack(attackId) {
      for (const b of this.el.querySelectorAll('.attack')) b.setAttribute('aria-pressed', b.dataset.id === attackId);
    }

    _tags(c) {
      const tags = c.tags.filter(t => t !== c.group);
      return `<div class="tags"><span class="tag group">${esc(c.group)}</span>${tags.map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div>`;
    }

    _ratings(r) {
      const rows = RATINGS.map(([k, name]) =>
        `<dt>${name}</dt><dd aria-label="${name} ${r[k]}/5">${[1,2,3,4,5].map(i => `<i class="${i <= r[k] ? 'on' : ''}"></i>`).join('')}</dd>`).join('');
      return `<div class="sec"><h3>特徴の目安<small>5段階・主観</small></h3><dl class="ratings">${rows}</dl></div>`;
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
        `<button class="attack" data-id="${a.id}" aria-pressed="${a.id === attackId}"><b>${esc(a.name)}</b>${esc(a.t)}</button>`).join('');
      return `<div class="sec"><h3>典型的な攻め筋<small>押すと盤に表示</small></h3><div class="attacks">${btns}</div></div>`;
    }

    _sources(c) {
      const li = [...c.sources, ...Kakoi.SETUPS[c.setup].sources].filter(s => Kakoi.SOURCES[s.ref]).map(s => {
        const src = Kakoi.SOURCES[s.ref];
        return `<li><span class="cv">${esc(s.for)}</span><span><a href="${esc(src.url)}" target="_blank" rel="noopener">${esc(src.title)}</a>（${esc(src.publisher)}）</span></li>`;
      }).join('');
      return `<div class="sec"><h3>出典</h3><ul class="sources">${li}</ul></div>`;
    }
  }

  Kakoi.DetailView = DetailView;
})();
