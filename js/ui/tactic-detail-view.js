// 戦法モードの右の解説: タグ・説明・長所短所・主役の駒の動き・相性のよい囲い・出典を一続きに
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';
  const { label } = Kakoi.notation;
  const { esc, makeCiter, rich, plain, sourcesBlock } = Kakoi.html;

  class TacticDetailView {
    /**
     * @param {HTMLElement} el `#tacticDetail`（.detail-body）
     * @param {{ onHover:(squares:string[], tone:?string)=>void,
     *   onCastle:(id:string)=>void, onMatchup:(id:string)=>void }} handlers
     *   onMatchup: その囲いとの組み合わせを対局図で開く。onCastle: 「→」で囲いの画面へ移る
     */
    constructor(el, handlers) {
      this.body = el;
      el.addEventListener('mouseover', e => {
        const t = e.target.closest('[data-sq]');
        if (t) handlers.onHover(t.dataset.sq.split(' '), 'focus');
      });
      el.addEventListener('mouseout', e => {
        const t = e.target.closest('[data-sq]');
        if (t && !t.contains(e.relatedTarget)) handlers.onHover([], null);
      });
      el.addEventListener('click', e => {
        const go = e.target.closest('.tc-go');
        if (go) { handlers.onCastle(go.dataset.id); return; }
        const b = e.target.closest('.tc-castle');
        if (b) handlers.onMatchup(b.dataset.id);
      });
      Kakoi.cites.bind(el); // 本文の [n] ホバーで出典リストの行を強調
    }

    /**
     * @param {object} tactic
     * @param {{ family:object,
     *   castles:{id:string,name:string,familyName:string,level:string,why:?string}[], sources:object[] }} info
     */
    render(tactic, { family, castles, sources }) {
      const citer = makeCiter();
      this.body.innerHTML = [
        this._tags(tactic, family),
        `<p class="desc">${rich(tactic.desc, citer)}</p>`,
        tactic.note ? `<p class="note">${rich(tactic.note, citer)}</p>` : '',
        family.note ? `<p class="note">${esc(family.piece)}が主役の理由：${rich(family.note, citer)}</p>` : '',
        this._list('長所', tactic.pros, '', citer),
        this._list('短所', tactic.cons, 'cons', citer),
        this._route(tactic),
        this._castles(castles),
        this._sources(sources, citer),
      ].filter(Boolean).join('');
    }

    // #ハッシュタグ表記（装飾のみ・クリック不可）
    _tags(t, family) {
      const tags = [t.context, ...(t.aliases || []).map(a => `別名：${a}`)].filter(Boolean);
      return `<div class="tags"><span class="tag group">#${esc(family.name)}</span>${tags.map(x => `<span class="tag">#${esc(x)}</span>`).join('')}</div>`;
    }

    _list(title, items, cls, citer) {
      if (!items || !items.length) return '';
      return `<div class="sec"><h3>${title}</h3><ul class="pc-list ${cls}">${items.map(it => `<li>${rich(it.t, citer)}</li>`).join('')}</ul></div>`;
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

    // 囲い名を押すとその組み合わせを対局図で開く。横の「→」で囲いの画面へ移る
    _castles(castles) {
      if (!castles.length) return '<p class="note">データ上の対応する囲いはありません</p>';
      const rows = castles.map(c =>
        `<div class="tc-row"><button class="tc-castle" data-act="matchup" data-id="${esc(c.id)}" data-compat="${esc(c.level || 'ok')}"` +
          `${c.why ? ` title="${esc(plain(c.why))}"` : ''}>` +
          `<b>${esc(c.name)}</b><span>${esc(c.familyName)}</span></button>` +
          `<button class="tc-go" data-id="${esc(c.id)}" title="${esc(c.name)}を囲いの画面で見る" aria-label="${esc(c.name)}を囲いの画面で見る">→</button></div>`
      ).join('');
      return `<div class="sec"><h3>相性のよい囲い<small>押すと対局図で開く。「→」は囲いの画面へ</small></h3><div class="tc-castles">${rows}</div></div>`;
    }

    _sources(sources, citer) {
      return `<div class="sec"><h3>出典</h3>${sourcesBlock(sources, citer)}</div>`;
    }
  }

  Kakoi.TacticDetailView = TacticDetailView;
})();
