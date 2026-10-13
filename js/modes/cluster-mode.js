// 分類マップモード: 形の近さの計算結果（木の図）を、系統の色つきで見せる。盤は使わない
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';
  const K = window.Kakoi;
  const { esc } = K.html;

  class ClusterMode {
    /** @param {{ repo:Kakoi.Repository, store:Kakoi.Store, board, overlay, els:{ rail:HTMLElement, stage:HTMLElement, detail:HTMLElement } }} deps */
    constructor({ repo, store, board, overlay, els }) {
      Object.assign(this, { repo, store, board, overlay, els });
      // 保存値の検証: 未知の系統は解除
      if (!repo.families().some(f => f.id === store.state.clusterFamily)) store.state.clusterFamily = null;
      this.selectedId = null;   // 囲い図鑑の選択（castleId）は「囲い図鑑で開く」まで変えない
      this.model = null;        // 計算は初めて開いたときに一度だけ
    }

    _init() {
      const { repo, els } = this;
      this.model = new K.ClusterModel(repo);
      this.stage = new K.ClusterStageView(els.stage, {
        onSelect: id => this.select(id),
        describe: p => this._tipHtml(p),
      });
      this.rail = new K.ClusterRailView(els.rail, {
        onFamily: id => this.store.set({ clusterFamily: this.store.state.clusterFamily === id ? null : id }),
        onSelect: id => this.select(id),
      });
      this.detail = new K.ClusterDetailView(els.detail, {
        onOpen: id => this._openCastle(id),
        onSelect: id => this.select(id),
      });
    }

    enter() {
      if (!this.model) this._init();
      this._render();
    }

    leave() {}

    update(state, changed) {
      if (changed.has('clusterFamily')) this._render();
    }

    select(id) {
      this.selectedId = this.selectedId === id ? null : id;
      this._render();
    }

    /** 「盤で開く」: この囲いを自分の制約にして盤の画面へ移る（攻め筋は別囲いに誤適用されないようリセット） */
    _openCastle(id) {
      const castle = this.repo.byId(id);
      if (!castle) return;
      const s = this.store.state;
      const r = K.constraints.apply(s.constraints || [], { type: 'set', who: 'me', kind: 'castle', id });
      this.store.set({ view: 'board', constraints: r.list, selected: 'me.castle', attackId: null });
    }

    _render() {
      const { repo, model } = this;
      const family = this.store.state.clusterFamily;
      const view = { selectedId: this.selectedId, family };
      this.stage.render(model, view);
      this.rail.render(repo.families(), id => repo.ofFamily(id), view);
      this.detail.render({
        castle: this.selectedId ? repo.byId(this.selectedId) : null,
        family: family ? repo.families().find(f => f.id === family) : null,
      }, this._ctx());
    }

    /** 詳細表示に渡す読み取り用の窓口（ビューは repo や model を直接持たない） */
    _ctx() {
      const { repo, model } = this;
      return {
        ari: model.ari, k: model.k,
        familyOf: c => repo.familyOf(c), subtypeOf: c => repo.subtypeOf(c),
        familyName: id => repo.families().find(f => f.id === id)?.name ?? '',
        membersOf: id => repo.ofFamily(id),
        match: c => model.match(c), nearest: (id, n) => model.nearest(id, n),
        together: id => model.familyTogether(id),
      };
    }

    /** ホバーカード: 名前・系統とタイプ・ミニ盤 */
    _tipHtml(p) {
      const { repo } = this;
      const c = p.castles[0];
      const fam = repo.familyOf(c), sub = repo.subtypeOf(c);
      return `<b class="t">${esc(p.castles.map(x => x.name).join(' ／ '))}</b>`
        + `<span class="s">${esc(fam.name)}${sub ? ' / ' + esc(sub.name) : ''}</span>`
        + `<span class="mini">${K.miniBoardSVG(repo.positionOf(c), c.side)}</span>`
        + (p.ids.length > 1 ? '<span class="s">左右反転で同じ形</span>' : '');
    }
  }

  K.ClusterMode = ClusterMode;
})();
