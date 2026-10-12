// 分類マップの中央: 見出し・地図/木の切り替え・説明・図とホバーのカード
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';
  const ARI_TIP = '調整ランド指数。作者の系統分けと、計算で同じ数に切ったグループ分けがどれだけ一致するかの指標です。1なら完全に一致、0なら偶然と同程度、負なら偶然より食い違っています。';

  class ClusterStageView {
    /**
     * @param {HTMLElement} el
     * @param {{ onSelect:(id:string)=>void, onChart:(chart:string)=>void, describe:(point:object)=>string }} handlers describe はホバーカードの中身(HTML)
     */
    constructor(el, handlers) {
      this.el = el;
      this.handlers = handlers;
      this.model = null;
      this.view = { chart: 'map', selectedId: null, family: null };
      el.innerHTML = `<div class="stage-h cl-head"><div class="ttl"><h2>分類マップ</h2></div>
          <div class="seg small" id="clChartSeg" role="group" aria-label="図の種類"><button data-value="map">地図</button><button data-value="tree">木の図</button></div></div>
        <p class="cl-expl" id="clExpl"></p>
        <div class="cl-body" id="clBody"><div class="cl-chart" id="clMap"></div><div class="cl-chart" id="clTree"></div><div class="cl-tip" id="clTip" hidden></div></div>`;
      this.seg = new Kakoi.Segmented(el.querySelector('#clChartSeg'), handlers.onChart);
      this.expl = el.querySelector('#clExpl');
      this.body = el.querySelector('#clBody');
      this.hosts = { map: el.querySelector('#clMap'), tree: el.querySelector('#clTree') };
      this.tip = el.querySelector('#clTip');
      const h = { onSelect: handlers.onSelect, onHover: (key, e) => this._hover(key, e) };
      this.charts = { map: new Kakoi.ClusterMapView(this.hosts.map, h), tree: new Kakoi.ClusterTreeView(this.hosts.tree, h) };
      // 図の大きさが変わったら描き直す（非表示中は大きさ0なので何もしない）
      const ro = new ResizeObserver(() => this._draw());
      for (const host of Object.values(this.hosts)) ro.observe(host);
    }

    render(model, view) {
      this.model = model;
      this.view = view;
      this.seg.setValue(view.chart);
      this._explain();
      this._draw();
    }

    _explain() {
      const { model, view } = this;
      const notes = [];
      if (model.merged) notes.push('左右反転で同じ形の囲いは1点にまとめて表示');
      if (view.chart === 'map' && model.compressed) notes.push('距離は見やすさのため圧縮表示');
      const lead = view.chart === 'map' ? '色は作者の分類（系統）、位置は形の近さの計算結果' : '色は作者の分類（系統）、枝の長さは形の近さの計算結果';
      this.expl.innerHTML = `${lead}。<span class="ari" title="${ARI_TIP}">一致度（ARI）＝${model.ari.toFixed(2)}</span>`
        + (notes.length ? `<span class="notes">${notes.join('。')}。</span>` : '');
    }

    _draw() {
      if (!this.model) return;
      this._hide();
      for (const [name, host] of Object.entries(this.hosts)) host.hidden = name !== this.view.chart;
      this.charts[this.view.chart].render(this.model, this.view);
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
