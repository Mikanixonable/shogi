// 分類マップの中央: 見出し・説明・木の図とホバーのカード
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';
  const ARI_TIP = '調整ランド指数。作者の系統分けと、計算で同じ数に切ったグループ分けがどれだけ一致するかの指標です。1なら完全に一致、0なら偶然と同程度、負なら偶然より食い違っています。';

  class ClusterStageView {
    /**
     * @param {HTMLElement} el
     * @param {{ onSelect:(id:string)=>void, describe:(point:object)=>string }} handlers describe はホバーカードの中身(HTML)
     */
    constructor(el, handlers) {
      this.el = el;
      this.handlers = handlers;
      this.model = null;
      this.view = { selectedId: null, family: null };
      el.innerHTML = `<div class="stage-h cl-head"><div class="ttl"><h2>分類マップ</h2></div></div>
        <p class="cl-expl" id="clExpl"></p>
        <div class="cl-body" id="clBody"><div class="cl-chart" id="clTree"></div><div class="cl-tip" id="clTip" hidden></div></div>`;
      this.expl = el.querySelector('#clExpl');
      this.body = el.querySelector('#clBody');
      this.host = el.querySelector('#clTree');
      this.tip = el.querySelector('#clTip');
      const h = { onSelect: handlers.onSelect, onHover: (key, e) => this._hover(key, e) };
      this.chart = new Kakoi.ClusterTreeView(this.host, h);
      // 図の大きさが変わったら描き直す（非表示中は大きさ0なので何もしない）
      new ResizeObserver(() => this._draw()).observe(this.host);
    }

    render(model, view) {
      this.model = model;
      this.view = view;
      this._explain();
      this._draw();
    }

    _explain() {
      const { model } = this;
      const notes = [];
      if (model.merged) notes.push('左右反転で同じ形の囲いは1点にまとめて表示');
      this.expl.innerHTML = `色は作者の分類（系統）、枝の長さは形の近さの計算結果。<span class="ari" title="${ARI_TIP}">一致度（ARI）＝${model.ari.toFixed(2)}</span>`
        + (notes.length ? `<span class="notes">${notes.join('。')}。</span>` : '');
    }

    _draw() {
      if (!this.model) return;
      this._hide();
      this.chart.render(this.model, this.view);
    }

    _hover(key, e) {
      if (!key) return this._hide();
      const p = this.model.pointByKey(key);
      if (this.tipKey !== key) { this.tip.innerHTML = this.handlers.describe(p); this.tipKey = key; }
      this.tip.hidden = false;
      const box = this.body.getBoundingClientRect(), tw = this.tip.offsetWidth, th = this.tip.offsetHeight;
      let x = e.clientX - box.left + 16, y = e.clientY - box.top + 12;
      if (x + tw > box.width - 4) x = e.clientX - box.left - tw - 16;
      if (y + th > box.height - 4) y = box.height - th - 4;
      this.tip.style.transform = `translate(${Math.max(4, x)}px, ${Math.max(4, y)}px)`;
    }

    _hide() { this.tip.hidden = true; this.tipKey = null; }
  }

  Kakoi.ClusterStageView = ClusterStageView;
})();
