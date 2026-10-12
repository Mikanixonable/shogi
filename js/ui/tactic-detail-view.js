// 戦法モードの右の解説: 概要・組み方・相性のよい囲い・出典の4タブ
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';
  const { label } = Kakoi.notation;
  const { esc } = Kakoi.html;

  class TacticDetailView {
    /**
     * @param {HTMLElement} el `#tacticDetail`
     * @param {{ onHover:(squares:string[], tone:?string)=>void, onCastle:(id:string)=>void }} handlers
     */
    constructor(el, handlers) {
      el.innerHTML =
        '<div class="seg small wide tabs">' +
        ['overview:概要', 'route:組み方', 'castles:相性のよい囲い', 'sources:出典'].map(s => `<button data-value="${s.split(':')[0]}">${s.split(':')[1]}</button>`).join('') +
        '</div><div class="detail-body"></div>';
      this.body = el.querySelector('.detail-body');
      this.tab = 'overview';
      this.tabs = new Kakoi.Segmented(el.querySelector('.tabs'), v => this.showTab(v));
      this.body.addEventListener('mouseover', e => {
        const t = e.target.closest('[data-sq]');
        if (t) handlers.onHover(t.dataset.sq.split(' '), 'focus');
      });
      this.body.addEventListener('mouseout', e => {
        const t = e.target.closest('[data-sq]');
        if (t && !t.contains(e.relatedTarget)) handlers.onHover([], null);
      });
      this.body.addEventListener('click', e => {
        const b = e.target.closest('.tc-castle');
        if (b) handlers.onCastle(b.dataset.id);
      });
    }

    /**
     * @param {object} tactic
     * @param {{ family:object, castles:{id:string,name:string,familyName:string}[], sources:object[] }} info
     */
    render(tactic, { family, castles, sources }) {
      const pane = (id, parts) => `<div class="pane" data-pane="${id}">${parts.filter(Boolean).join('')}</div>`;
      this.body.innerHTML = [
        pane('overview', [
          this._tags(tactic, family),
          `<p class="desc">${esc(tactic.desc)}</p>`,
          tactic.note ? `<p class="note">${esc(tactic.note)}</p>` : '',
          this._list('長所', tactic.pros, ''),
          this._list('短所', tactic.cons, 'cons'),
        ]),
        pane('route', [this._route(tactic)]),
        pane('castles', [this._castles(castles)]),
        pane('sources', [this._sources(sources)]),
      ].join('');
      this.showTab(this.tab);
    }

    showTab(id) {
      this.tab = id;
      this.tabs.setValue(id);
      for (const p of this.body.querySelectorAll('.pane')) p.classList.toggle('active', p.dataset.pane === id);
    }

    _tags(t, family) {
      const tags = [t.context, ...(t.aliases || []).map(a => `別名：${a}`)].filter(Boolean);
      return `<div class="tags"><span class="tag group">${esc(family.name)}</span>${tags.map(x => `<span class="tag">${esc(x)}</span>`).join('')}</div>`;
    }

    _list(title, items, cls) {
      if (!items || !items.length) return '';
      return `<div class="sec"><h3>${title}</h3><ul class="pc-list ${cls}">${items.map(it => `<li>${esc(it.t)}</li>`).join('')}</ul></div>`;
    }

    // 経路を「▲３九銀 → ３八 → …」の手順にし、各マスに乗せると盤で光る
    _route(t) {
      const sq = s => label(+s[0], +s[1]);
      const steps = t.route.map((s, i) =>
        `<li class="rt-step" data-sq="${s}">${i === 0 ? `▲${sq(s)}${esc(t.lead.piece)}` : sq(s)}</li>`).join('');
      const last = t.route[t.route.length - 1];
      const text = t.route.length > 1
        ? `主役の${t.lead.piece}は、最終的に${sq(last)}に立ちます。`
        : `主役の${t.lead.piece}は、初期位置の${sq(last)}のまま動きません。`;
      return `<div class="sec"><h3>主役の駒の動き<small>マスに乗せると盤で光る</small></h3><ol class="rt-steps">${steps}</ol></div>` +
        `<p class="desc">${esc(text)}</p>` +
        (/推定/.test(t.note || '') ? '<p class="note">経路の途中のマスは推定です。</p>' : '');
    }

    _castles(castles) {
      if (!castles.length) return '<p class="note">データ上の対応する囲いはありません</p>';
      const btns = castles.map(c =>
        `<button class="tc-castle" data-id="${esc(c.id)}"><b>${esc(c.name)}</b><span>${esc(c.familyName)}</span></button>`).join('');
      return `<div class="sec"><h3>相性のよい囲い<small>押すと囲いの画面へ</small></h3><div class="tc-castles">${btns}</div></div>`;
    }

    _sources(sources) {
      const li = sources.map(s =>
        `<li><span class="cv">${esc(s.for)}</span><span><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a>（${esc(s.publisher)}）</span></li>`).join('');
      return `<div class="sec"><h3>出典</h3><ul class="sources">${li}</ul></div>`;
    }
  }

  Kakoi.TacticDetailView = TacticDetailView;
})();
