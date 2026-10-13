// 対局図の左パネル: 「自分」の3層（戦略・戦法・囲い）を相性バッジつきの一覧で選び、
// 「相手」の3層をコンパクトな選択肢で選ぶ。バッジは compat.judge の best/ok/ng（計画書 §6）
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';
  const K = window.Kakoi;
  const { esc } = K.html;

  const MARK = { best: '◎', ok: '', ng: '×' };          // 行につける印（○は標準なので付けない）
  const OPTION_MARK = { best: '◎', ok: '○', ng: '×' };  // select の選択肢の印（色で伝えられないので記号を常に添える）
  const LEVEL_RANK = { ng: 0, ok: 1, best: 2 };
  const SIDES = [['ibisha', '居飛車'], ['furibisha', '振り飛車']];

  // 未選択の層は戦略テンプレートの既定値で読み替える（compat.js / matchup.js と同じ規則）
  const effTacticId = st => (st && st.tacticId)
    || (st && K.STRATEGIES[st.strategy] ? K.STRATEGIES[st.strategy].defaultTactic : null);
  const effCastleId = (st, opp) => {
    if (st && st.castleId) return st.castleId;
    const dc = st && K.STRATEGIES[st.strategy] ? K.STRATEGIES[st.strategy].defaultCastle : null;
    return typeof dc === 'string' ? dc : dc ? ((opp && opp.strategy === 'furibisha') ? dc.vsFuribisha : dc.vsIbisha) : null;
  };

  class MatchupRailView {
    /**
     * @param {HTMLElement} el `#matchupRail`
     * @param {{ onChoose:(side:'me'|'opp', layer:'strategy'|'tactic'|'castle', id:string)=>void,
     *   onShow:(key:'opp'|'threat', on:boolean)=>void }} handlers
     */
    constructor(el, { onChoose, onShow }) {
      this.el = el;
      el.innerHTML =
        `<section class="mu-side" data-side="me">
          <h3 class="mu-h">自分<small>先手</small></h3>
          <div class="seg wide" data-role="seg-me">
            <button data-value="ibisha">居飛車</button><button data-value="furibisha">振り飛車</button>
          </div>
          <h4 class="mu-sub">戦法</h4>
          <div class="mu-list" data-role="list-tactic-me"></div>
          <h4 class="mu-sub">囲い</h4>
          <div class="mu-list" data-role="list-castle-me"></div>
        </section>
        <section class="mu-side" data-side="opp">
          <h3 class="mu-h">相手<small>後手</small>
            <label class="switch"><input type="checkbox" data-show="opp"> 表示</label>
          </h3>
          <div class="mu-opp" data-role="opp-body">
            <div class="seg small" data-role="seg-opp">
              <button data-value="ibisha">居飛車</button><button data-value="furibisha">振り飛車</button>
            </div>
            <label class="mu-sel"><span>戦法</span><select data-layer="tactic"></select></label>
            <label class="mu-sel"><span>囲い</span><select data-layer="castle"></select></label>
            <p class="mu-status" data-role="opp-status"></p>
            <label class="switch"><input type="checkbox" data-show="threat"> 脅威の帯</label>
          </div>
        </section>`;
      this.els = {
        tMe: el.querySelector('[data-role="list-tactic-me"]'),
        cMe: el.querySelector('[data-role="list-castle-me"]'),
        oppBody: el.querySelector('[data-role="opp-body"]'),
        oppStatus: el.querySelector('[data-role="opp-status"]'),
        tOpp: el.querySelector('select[data-layer="tactic"]'),
        cOpp: el.querySelector('select[data-layer="castle"]'),
        swOpp: el.querySelector('[data-show="opp"]'),
        swThreat: el.querySelector('[data-show="threat"]'),
      };
      this.seg = {
        me: new K.Segmented(el.querySelector('[data-role="seg-me"]'), v => onChoose('me', 'strategy', v)),
        opp: new K.Segmented(el.querySelector('[data-role="seg-opp"]'), v => onChoose('opp', 'strategy', v)),
      };
      el.addEventListener('click', e => {
        const b = e.target.closest('.mu-item');
        if (b) onChoose(b.dataset.side, b.dataset.layer, b.dataset.id);
      });
      el.addEventListener('change', e => {
        const sel = e.target.closest('select[data-layer]');
        if (sel) { onChoose('opp', sel.dataset.layer, sel.value); return; }
        const sw = e.target.closest('input[data-show]');
        if (sw) onShow(sw.dataset.show, sw.checked);
      });

      // 一覧の元データ: 戦法は周期表と同じ行（系統ごと・筋の順）、囲いは戦型ごとに系統順
      this.tacticRows = K.tacticNav.tacticRows(K.TACTIC_FAMILIES, K.TACTICS);
      const famSide = new Map(K.TACTIC_FAMILIES.map(f => [f.id, f.side]));
      this.tacticsBySide = Object.fromEntries(SIDES.map(([side]) =>
        [side, K.TACTICS.filter(t => famSide.get(t.family) === side)]));
      this.castlesBySide = Object.fromEntries(SIDES.map(([side]) =>
        [side, K.CASTLE_FAMILIES.flatMap(f => K.CASTLES.filter(c => c.side === side && c.family === f.id))]));
      this.castleFam = new Map(K.CASTLE_FAMILIES.map(f => [f.id, f.name]));
    }

    /** 選択状態に合わせて一覧とバッジを描き直す（matchup が変わるたびにモードから呼ばれる） */
    update(state) {
      const m = state.matchup;
      const me = m.me, opp = m.opp;
      const jMe = (layer, id) => K.compat.judge(me, layer, id, opp);
      const jOpp = (layer, id) => K.compat.judge(opp, layer, id, me);

      // セグのつまみは表示中の幅で置くので、相手側の開閉は setValue より先に反映する
      this.els.swOpp.checked = !!m.show.opp;
      this.els.swThreat.checked = m.show.threat !== false;
      this.els.oppBody.hidden = !m.show.opp;

      this.seg.me.setValue(me.strategy);
      this.seg.opp.setValue(opp.strategy);
      // 戦略ボタンにも相性を付ける（層の候補と同じ3段階）
      for (const b of this.seg.me.el.querySelectorAll('button')) b.dataset.compat = jMe('strategy', b.dataset.value).level;
      for (const b of this.seg.opp.el.querySelectorAll('button')) b.dataset.compat = jOpp('strategy', b.dataset.value).level;

      const curT = effTacticId(me), curC = effCastleId(me, opp);
      this.els.tMe.innerHTML = this.tacticRows.map(({ family, tactics }) =>
        `<section class="tr-row"><h3><span class="pt-tile">${esc(family.piece)}</span>${esc(family.name)}</h3>` +
        tactics.map(t => this._row('me', 'tactic', t.id, t.name, K.tacticNav.fileBadge(t),
          jMe('tactic', t.id), t.id === curT, me.tacticId == null)).join('') +
        '</section>').join('');
      this.els.cMe.innerHTML = SIDES.map(([side, lab]) =>
        `<section class="tr-row"><h3>${lab}</h3>` +
        this.castlesBySide[side].map(c => this._row('me', 'castle', c.id, c.short, this.castleFam.get(c.family) || '',
          jMe('castle', c.id), c.id === curC, me.castleId == null)).join('') +
        '</section>').join('');

      this._fillSelect(this.els.tOpp, 'tactic', opp, me, effTacticId(opp));
      this._fillSelect(this.els.cOpp, 'castle', opp, me, effCastleId(opp, me));
      this._status(m);
    }

    // 選択肢の行: 名前・補足・相性の印。× には理由を title に添える（色だけに頼らない）
    _row(side, layer, id, name, sub, j, current, implied) {
      const mark = MARK[j.level] ? `<i class="mu-mark">${MARK[j.level]}</i>` : '';
      const tip = j.reasons && j.reasons.length
        ? ` title="${esc(j.reasons.map(r => r.text).join('／'))}"` : '';
      return `<button class="tr-item mu-item" data-side="${side}" data-layer="${layer}" data-id="${esc(id)}"` +
        ` data-compat="${j.level}" aria-current="${current}"${implied && current ? ' data-implied="true"' : ''}${tip}>` +
        `<span class="nm">${esc(name)}</span><span class="fb">${esc(sub)}</span>${mark}</button>`;
    }

    // 相手の select: 戦型ごとの optgroup。各選択肢に compat.judge の印を付ける
    _fillSelect(sel, layer, st, other, cur) {
      const lists = layer === 'tactic' ? this.tacticsBySide : this.castlesBySide;
      sel.innerHTML = SIDES.map(([side, lab]) =>
        `<optgroup label="${lab}">` + lists[side].map(x =>
          `<option value="${esc(x.id)}"${x.id === cur ? ' selected' : ''}>` +
          `${OPTION_MARK[K.compat.judge(st, layer, x.id, other).level]} ${esc(x.name)}</option>`).join('') +
        '</optgroup>').join('');
      if (cur) sel.value = cur;
    }

    // 相手の3層をまとめた相性（一番悪い層の評価）。×なら最初の理由も添える
    _status(m) {
      const opp = m.opp, me = m.me;
      let worst = 'best', reason = null;
      for (const layer of ['strategy', 'tactic', 'castle']) {
        const id = layer === 'strategy' ? opp.strategy
          : layer === 'tactic' ? effTacticId(opp) : effCastleId(opp, me);
        if (!id) continue;
        const j = K.compat.judge(opp, layer, id, me);
        if (LEVEL_RANK[j.level] < LEVEL_RANK[worst]) worst = j.level;
        if (j.level === 'ng' && !reason) reason = j.reasons[0] && j.reasons[0].text;
      }
      this.els.oppStatus.innerHTML = `相性 <b class="mk" data-level="${worst}">${OPTION_MARK[worst]}</b>` +
        (worst === 'ng' && reason ? `<span class="mu-status-r">${esc(reason)}</span>` : '');
    }
  }

  K.MatchupRailView = MatchupRailView;
})();
