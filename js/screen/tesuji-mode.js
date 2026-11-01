// 「図鑑」の全画面モード: 囲い・戦法・戦型・戦略・手筋・格言を、章立てした読み物として全画面に展開する。
// 左は章→節→項の目次ツリー（現在地はスクロールに追従して朱で示す）、右は本文。
// 囲い・戦法・戦型・戦略の項は右 detail（ui/detail-view.js）と同じ内容を持つ。
// 手筋の章の区切りは data/tesuji.js の章コメントと同じ（歩／香・桂・銀・金／角・飛／囲いの崩し方／受け）。
// 「囲いの崩し方」は対象の囲いごとに項へ分ける。格言は PROVERB_GROUPS の節、末尾に出典。
// 開いている章・節は URL ハッシュの tj= が持つ（hash-link.js）。Esc・「盤面へ戻る」で盤へ帰る。
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';
  const K = window.Kakoi;
  const { esc, rich, makeCiter, sourcesBlock, citeRefs } = K.html;
  const { ZEN, KAN } = K.notation;
  const ROLE_JA = { attack: '攻め', defense: '受け', both: '攻め・受け' };
  const W = 10, H = 11, M = 7;   // マスの幅・高さ、座標の余白

  const parse = str => (str || '').trim().split(/\s+/).filter(Boolean)
    .map(t => ({ p: t[0], sq: t.slice(1) }));

  /** 持ち駒 "歩歩" → "歩二" */
  const handText = h => {
    if (!h) return 'なし';
    const cnt = new Map();
    for (const p of h) cnt.set(p, (cnt.get(p) || 0) + 1);
    return [...cnt.entries()].map(([p, n]) => p + (n > 1 ? KAN[n] : '')).join(' ');
  };

  /**
   * 手筋の図（1コマ）の SVG。左ほど筋が大きい（盤と同じ向き）。後手の駒は180度回して描く。
   * 直前のコマから変わったマスは薄く塗る
   */
  function diagramSVG(d, i) {
    const [f0, f1] = d.files, [r0, r1] = d.ranks;
    const cols = f1 - f0 + 1, rows = r1 - r0 + 1;
    const fr = d.frames[i], prev = i > 0 ? d.frames[i - 1] : null;
    const at = fr => {
      const m = new Map();
      for (const x of parse(fr.sente)) m.set(x.sq, { ...x, owner: 'sente' });
      for (const x of parse(fr.gote)) m.set(x.sq, { ...x, owner: 'gote' });
      return m;
    };
    const cur = at(fr), before = prev ? at(prev) : null;
    const x0 = 0, y0 = M;
    let s = `<svg class="tj-svg" viewBox="0 0 ${cols * W + M} ${rows * H + M}" role="img" aria-label="${esc(fr.caption)}">`;
    for (let c = 0; c < cols; c++) s += `<text class="tj-co" x="${x0 + c * W + W / 2}" y="${M - 2}">${ZEN[f1 - c]}</text>`;
    for (let r = 0; r < rows; r++) s += `<text class="tj-co" x="${cols * W + M / 2}" y="${y0 + r * H + H / 2 + 1}">${KAN[r0 + r]}</text>`;
    s += `<rect class="tj-bg" x="${x0}" y="${y0}" width="${cols * W}" height="${rows * H}"/>`;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const sq = `${f1 - c}${r0 + r}`;
      const a = cur.get(sq), b = before && before.get(sq);
      const changed = before && ((a && a.p + a.owner) !== (b && b.p + b.owner));
      if (changed) s += `<rect class="tj-chg" x="${x0 + c * W}" y="${y0 + r * H}" width="${W}" height="${H}"/>`;
    }
    for (let c = 1; c < cols; c++) s += `<line class="tj-ln" x1="${x0 + c * W}" y1="${y0}" x2="${x0 + c * W}" y2="${y0 + rows * H}"/>`;
    for (let r = 1; r < rows; r++) s += `<line class="tj-ln" x1="${x0}" y1="${y0 + r * H}" x2="${x0 + cols * W}" y2="${y0 + r * H}"/>`;
    for (const x of cur.values()) {
      const c = f1 - +x.sq[0], r = +x.sq[1] - r0;
      const cx = x0 + c * W + W / 2, cy = y0 + r * H + H / 2;
      s += `<text class="tj-pc ${x.owner}${'と杏圭全馬龍'.includes(x.p) ? ' prom' : ''}" x="${cx}" y="${cy + 1}"` +
        `${x.owner === 'gote' ? ` transform="rotate(180 ${cx} ${cy})"` : ''}>${x.p}</text>`;
    }
    return s + '</svg>';
  }

  // ---------- 章立て ----------
  // 所属は各手筋の piece / role / onCastle から導くので、新しい手筋はデータに足すだけで章に入る。
  // 順は data/tesuji.js の並び（章コメントと対応）
  const CHAPTERS = [
    { id: 'ch-fu',      title: '歩の手筋',           test: t => !t.onCastle && t.piece === '歩' },
    { id: 'ch-koma',    title: '香・桂・銀・金の手筋', test: t => !t.onCastle && '香桂銀金'.includes(t.piece || '') },
    { id: 'ch-ogoma',   title: '角・飛の手筋',       test: t => !t.onCastle && '角飛馬龍'.includes(t.piece || '') },
    { id: 'ch-kuzushi', title: '囲いの崩し方',       test: t => !!t.onCastle && t.role !== 'defense', byCastle: true },
    { id: 'ch-uke',     title: '受けの手筋',         test: t => !!t.onCastle && t.role === 'defense' },
  ];

  // 囲いの表示名から括弧の別名（「美濃囲い（本美濃）」→「美濃囲い」）を落とす
  const castleName = id => String(K.catalog.nameOf('castle', id)).replace(/（[^）]*）/g, '');

  /**
   * TESUJI を章→（あれば）項→節の木に組み立てる。
   * 崩し方の項は対象の囲い（onCastle.ids / mirrorIds の先頭）で連続するものを束ねる。
   * ids の空いている節は直前の項に続く（＝データの並びで項が決まる）。
   * @returns {Array<{id,title,items:object[],subs:Array<{key,title,items:object[]}>|null}>}
   */
  function buildTree(tesuji) {
    const rest = new Set(tesuji);
    const chapters = [];
    for (const ch of CHAPTERS) {
      const items = tesuji.filter(t => {
        if (!rest.has(t) || !ch.test(t)) return false;
        rest.delete(t);
        return true;
      });
      if (!items.length) continue;
      let subs = null;
      if (ch.byCastle) {
        subs = [];
        for (const t of items) {
          const oc = t.onCastle || {};
          const key = (oc.ids && oc.ids[0]) || (oc.mirrorIds && oc.mirrorIds[0]) || null;
          const last = subs[subs.length - 1];
          if (last && (!key || last.key === key)) last.items.push(t);
          else subs.push({ key, title: key ? castleName(key) : 'その他の囲い', items: [t] });
        }
        if (subs.length === 1) subs = null;   // 項が1つだけなら章に節を直結する
      }
      chapters.push({ id: ch.id, title: ch.title, items, subs });
    }
    // どの章の条件にも合わない手筋（将来の追加）は「その他」へ
    const etc = tesuji.filter(t => rest.has(t));
    if (etc.length) chapters.push({ id: 'ch-etc', title: 'その他', items: etc, subs: null });
    return chapters;
  }

  class TesujiMode {
    /**
     * @param {HTMLElement} root .wiki（.wj-toc・.wj-main・.wj-toc-btn・.wj-scrim を持つ器）
     * @param {Kakoi.Repository} repo 出典の解決に使う
     * @param {{onGo:(id:string)=>void, onExit:()=>void}} cb 目次の遷移（tj= を書く）と「盤へ戻る」
     */
    constructor(root, repo, cb) {
      this.root = root;
      this.repo = repo;
      this.cb = cb || {};
      this.toc = root.querySelector('.wj-toc');
      this.main = root.querySelector('.wj-main');
      this.frame = new Map();   // 手筋 id → いま見ているコマ
      this._built = false;
      this._cur = null;         // 目次で現在地を示すリンク
      root.addEventListener('click', e => this._onClick(e));
      const btn = root.querySelector('.wj-toc-btn');
      if (btn) btn.addEventListener('click', () => this._tocToggle());
      const scrim = root.querySelector('.wj-scrim');
      if (scrim) scrim.addEventListener('click', () => this._tocClose());
      // Esc は盤へ戻る（about モーダルが開いている間はモーダル側の Esc に任せる）
      document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && document.body.classList.contains('tj')
            && !document.querySelector('dialog[open]') && this.cb.onExit) {
          this._tocClose();
          this.cb.onExit();
        }
      });
    }

    /**
     * モードに入った・開く章・節が変わったときに呼ぶ。
     * @param {string|null} id 章・節・項の id（data-id）。なければ先頭へ
     * @param {boolean} [instant] 起動時などアニメ無しで飛ぶ
     */
    /**
     * モードに入った・記事が変わったときに呼ぶ。
     * @param {string|null} id 項の id（data-id）。なければ表紙へ
     * @param {boolean} [instant] 起動時などアニメ無しで飛ぶ
     */
    open(id, instant) {
      if (!this.root) return;
      this._build();
      this._tocClose();
      this._show(id && this._itemOf(id) ? id : 'top', instant);
    }

    // ---------- 左ドック（大項目タブ＋選択肢タイル）と記事単体の表示 ----------
    // 記事は1件ずつ表示する。タブ=大項目（囲い・戦法・戦型・戦略・手筋・格言・出典）、タイル=各項。
    // 囲い・戦法・戦型・戦略の項の中身は右 detail（K.DetailView）と同じ部品で描く（data-mount で紐付け）。
    _build() {
      if (this._built) return;
      this._built = true;
      const mounts = this._mounts = new Map();
      const emptySide = () => ({ tactic: null, castle: null });
      const mount = (key, sel, me) => mounts.set(key,
        { sel, slots: { me: { ...emptySide(), ...me }, opp: emptySide() } });
      const tabs = this._tabs = [];
      const tab = (id, title, items) => { const t = { id, title, items }; tabs.push(t); return t; };
      const famName = f => (f && f.name) || 'その他';

      tab('castle', '囲い', (K.CASTLES || []).map(c => {
        mount(c.id, `me.castle.${c.id}`, { castle: c.id });
        return { id: c.id, name: c.name, reading: c.reading, path: famName(K.catalog.castleFamilyOf(c)) };
      }));
      tab('tactic', '戦法', (K.TACTICS || []).filter(t => !t.variantOf).map(t => {
        mount(t.id, `me.tactic.${t.id}`, { tactic: [t.id] });
        return { id: t.id, name: t.name, reading: t.reading, path: famName(K.catalog.tacticFamilyOf(t)) };
      }));
      {
        const SK = K.SENKEI || {}, GR = K.SENKEI_GROUPS || {};
        const grpOf = e => GR[e.group] ? e.group
          : (Object.keys(GR).find(g => (GR[g].kinds || []).includes(e.group))) || 'misc';
        const items = [];
        for (const [gid, g] of Object.entries(GR)) {
          items.push({ id: `skg:${gid}`, name: g.name, path: '大分類' });
          mount(`skg:${gid}`, `me.senkei.${gid}`);
          for (const [mid, e] of Object.entries(SK).filter(([, x]) => grpOf(x) === gid)) {
            items.push({ id: `senkei:${mid}`, name: e.name, reading: e.reading, path: g.name });
            mount(`senkei:${mid}`, `me.senkei.${mid}`);
          }
        }
        for (const [mid, e] of Object.entries(SK).filter(([, x]) => grpOf(x) === 'misc')) {
          items.push({ id: `senkei:${mid}`, name: e.name, reading: e.reading, path: 'その他' });
          mount(`senkei:${mid}`, `me.senkei.${mid}`);
        }
        tab('senkei', '戦型', items);
      }
      tab('strategy', '戦略', ['furibisha', 'ibisha'].filter(sid => (K.STRATEGIES || {})[sid]).map(sid => {
        const s = K.STRATEGIES[sid];
        mount(sid, 'me.strategy', { tactic: s.defaultTactic ? [s.defaultTactic] : null });
        return { id: sid, name: s.label };
      }));
      {
        const items = [];
        for (const ch of buildTree(K.TESUJI || [])) {
          if (ch.subs) for (const s of ch.subs) for (const t of s.items)
            items.push({ id: t.id, name: t.name, reading: t.reading, path: `${s.title}の崩し方` });
          else for (const t of ch.items)
            items.push({ id: t.id, name: t.name, reading: t.reading, path: ch.title });
        }
        tab('tesuji', '手筋', items);
      }
      {
        const groups = K.PROVERB_GROUPS || [];
        const pvGroups = [...groups.map(([gid, title]) => ({ gid, title })), { gid: 'etc', title: 'その他' }]
          .filter(g => g.gid === 'etc'
            ? (K.PROVERBS || []).some(p => !groups.some(([gid]) => gid === p.group))
            : (K.PROVERBS || []).some(p => p.group === g.gid));
        tab('pv', '格言', pvGroups.map(g => ({ id: `pv-${g.gid}`, name: g.title, path: '格言' })));
      }
      // 将棋の言葉・出来事（extras.js。右 detail のお楽しみ欄から移した項）
      tab('extra', 'お楽しみ', (K.FUN && K.FUN.memes || [])
        .map(m => ({ id: m.id, name: m.t, reading: m.reading, path: '将棋の言葉・出来事' })));
      tab('src', '出典', [{ id: 'sources', name: '出典一覧' }]);

      this.toc.innerHTML = `<p class="wj-back"><button type="button" data-exit>← 盤面へ戻る</button></p>` +
        `<div class="wj-tabs" role="group" aria-label="図鑑の分類">` +
        tabs.map(t => `<button type="button" data-tab="${esc(t.id)}" aria-pressed="false">${esc(t.title)}</button>`).join('') +
        `</div><div class="wj-tiles"></div>`;
      this._tileHtml = new Map(tabs.map(t => [t.id,
        t.items.map(it => `<button type="button" class="wj-tile" data-go="${esc(it.id)}">${esc(it.name)}</button>`).join('')]));
      this.main.innerHTML = '';   // 記事は _show が毎回差し替える
      this._cur = null;
      this._active = null;
    }

    // ---------- 記事の表示: 1件ずつ。タブ・タイルの現在地も同期する ----------
    _itemOf(id) {
      for (const t of this._tabs) {
        const it = t.items.find(x => x.id === id);
        if (it) return { tab: t, item: it };
      }
      return null;
    }

    _show(id, instant) {
      const found = id !== 'top' && this._itemOf(id);
      this.main.innerHTML = `<article class="wj-doc">${found ? this._article(found.tab, found.item) :
        `<header class="wj-doc-h" data-id="top"><p class="wj-back wj-back-doc"><button type="button" data-exit>← 盤面へ戻る</button></p>` +
        `<h1>図鑑</h1><p class="wj-lede">囲い・戦法・戦型・戦略・手筋・格言を引ける読み物です。左のタブで分類を選び、` +
        `タイルで記事を開きます。各項の中身は盤面モードの右の解説パネルと同じものです。</p></header>`}</article>`;
      // 表紙のときも最初のタブのタイルを開いておく（分類が見えるように）
      this._setTab(found ? found.tab : this._tabs[0]);
      if (found) this._mountDock();
      this._markTile(found ? id : null);
      this.main.scrollTop = 0;
      window.scrollTo(0, 0);
    }

    _setTab(tab) {
      this._active = tab.id;
      for (const b of this.toc.querySelectorAll('[data-tab]'))
        b.setAttribute('aria-pressed', String(b.dataset.tab === tab.id));
      this.toc.querySelector('.wj-tiles').innerHTML = this._tileHtml.get(tab.id) || '';
    }

    _markTile(id) {
      const link = id ? this.toc.querySelector(`[data-go="${CSS.escape(id)}"]`) : null;
      if (link === this._cur) return;
      if (this._cur) this._cur.removeAttribute('aria-current');
      this._cur = link;
      if (link) {
        link.setAttribute('aria-current', 'true');
        link.scrollIntoView({ block: 'nearest' });
      }
    }

    // ---------- 記事1件の組み立て ----------
    _article(tab, it) {
      const crumb = `<p class="wj-meta">${esc(tab.title)}${it.path ? ` › ${esc(it.path)}` : ''}</p>`;
      if (this._mounts.has(it.id))
        return `<section class="wj-sec wj-dock" data-id="${esc(it.id)}"><h2 class="wj-ah">${esc(it.name)}` +
          `${it.reading ? `<small>${esc(it.reading)}</small>` : ''}</h2>${crumb}` +
          `<div class="wj-dock-b" data-mount="${esc(it.id)}"></div></section>`;
      if (it.id === 'sources')
        return `<section class="wj-sec" data-id="sources"><h2 class="wj-ah">出典</h2>` +
          sourcesBlock(this._allSources(), makeCiter()) + `</section>`;
      if (it.id.startsWith('pv-')) return this._pvArticle(it);
      if (tab.id === 'extra') return this._extraArticle(it);
      return this._tesujiArticle(tab, it);
    }

    _tesujiArticle(tab, it) {
      const t = (K.TESUJI || []).find(x => x.id === it.id);
      if (!t) return '';
      const citer = makeCiter();
      const proverbs = new Map((K.PROVERBS || []).map(p => [p.id, p]));
      const srcAll = [...(t.sources || [])];
      const declared = new Set(srcAll.map(s => s.ref));
      const addRefs = (text, label) => {
        for (const r of citeRefs(text || '')) if (!declared.has(r)) { declared.add(r); srcAll.push({ ref: r, for: label }); }
      };
      addRefs(t.desc, '本文');
      const pv = (t.proverbs || []).map(pid => proverbs.get(pid)).filter(Boolean).map(p => {
        addRefs(p.desc, '格言');
        for (const s of p.sources || []) if (!declared.has(s.ref)) { declared.add(s.ref); srcAll.push(s); }
        return `<li><b>${esc(p.text)}</b>${rich(p.desc, citer)}</li>`;
      }).join('');
      const meta = [`${esc(tab.title)}${it.path ? ` › ${esc(it.path)}` : ''}`];
      if (t.piece) meta.push(`駒：${esc(t.piece)}`);
      if (t.aliases && t.aliases.length) meta.push(`別名：${t.aliases.map(esc).join('・')}`);
      if (t.onCastle) {
        const names = [...(t.onCastle.ids || []), ...(t.onCastle.mirrorIds || [])].map(castleName);
        if (names.length) meta.push(`対象：${[...new Set(names)].map(esc).join('・')}`);
      }
      const notes = [t.note, t.onCastle && t.onCastle.note].filter(Boolean)
        .map(n => `<p class="wj-note">${esc(n)}</p>`).join('');
      return `<section class="wj-sec" data-id="${esc(t.id)}">` +
        `<h2 class="wj-ah">${esc(t.name)}<small>${esc(t.reading || '')}</small>` +
        `<span class="tj-role" data-role="${esc(t.role)}">${ROLE_JA[t.role] || ''}</span></h2>` +
        `<p class="wj-meta">${meta.join('　')}</p>` +
        `<p class="desc">${rich(t.desc, citer)}</p>` +
        `<figure class="tj-fig">${this._figure(t, this.frame.get(t.id) || 0)}</figure>` +
        notes +
        (pv ? `<h5 class="wj-mini-h">関連する格言</h5><ul class="tj-pv">${pv}</ul>` : '') +
        sourcesBlock(this.repo.resolveSources(srcAll), citer) +
        `</section>`;
    }

    _pvArticle(it) {
      const gid = it.id.slice(3);
      const groups = K.PROVERB_GROUPS || [];
      const items = gid === 'etc'
        ? (K.PROVERBS || []).filter(p => !groups.some(([g]) => g === p.group))
        : (K.PROVERBS || []).filter(p => p.group === gid);
      const citer = makeCiter();
      const srcAll = [], declared = new Set();
      const lis = items.map(p => {
        for (const r of citeRefs(p.desc || '')) if (!declared.has(r)) { declared.add(r); srcAll.push({ ref: r, for: '格言' }); }
        for (const s of p.sources || []) if (!declared.has(s.ref)) { declared.add(s.ref); srcAll.push(s); }
        return `<li><b>${esc(p.text)}</b>` +
          `<small>${esc(p.reading || '')}${p.alt && p.alt.length ? `（別名：${p.alt.map(esc).join('・')}）` : ''}</small>` +
          `${rich(p.desc, citer)}</li>`;
      }).join('');
      return `<section class="wj-sec" data-id="${esc(it.id)}"><h2 class="wj-ah">${esc(it.name)}</h2>` +
        `<p class="wj-meta">格言</p><ul class="tj-pv">${lis}</ul>` +
        sourcesBlock(this.repo.resolveSources(srcAll), citer) + `</section>`;
    }

    // お楽しみ（将棋の言葉・出来事）の記事: 短い本文＋出典だけ
    _extraArticle(it) {
      const m = (K.FUN && K.FUN.memes || []).find(x => x.id === it.id);
      if (!m) return '';
      const citer = makeCiter();
      return `<section class="wj-sec" data-id="${esc(m.id)}"><h2 class="wj-ah">${esc(m.t)}` +
        `${m.reading ? `<small>${esc(m.reading)}</small>` : ''}</h2>` +
        `<p class="wj-meta">お楽しみ › 将棋の言葉・出来事</p>` +
        `<p class="desc">${esc(m.n)}</p>` +
        sourcesBlock(this.repo.resolveSources(m.sources || []), citer) + `</section>`;
    }

    // 「出典」記事は全項目の宣言を束ねる（右 detail 部品内の [n] は項ごとの出典を見る）
    _allSources() {
      const declared = new Set(), list = [];
      const push = s => { if (!declared.has(s.ref)) { declared.add(s.ref); list.push(s); } };
      const refs = (text) => {
        for (const r of citeRefs(text || '')) if (!declared.has(r)) { declared.add(r); list.push({ ref: r, for: '本文' }); }
      };
      const each = a => Array.isArray(a) ? a : Object.values(a || {});
      for (const e of [...each(K.TESUJI), ...each(K.PROVERBS), ...each(K.CASTLES), ...each(K.TACTICS),
        ...each(K.SENKEI), ...each(K.SENKEI_GROUPS), ...each(K.STRATEGIES), ...each(K.COMBOS),
        ...each(K.FUN ? K.FUN.memes : [])]) {
        (e.sources || []).forEach(push);
        refs(e.desc);
      }
      return this.repo.resolveSources(list);
    }

    // ---------- 記事のうち右 detail 部品を持つ項: DetailView で描く（中身はドックと同一） ----------
    // ボタンの動きはモードに合わせる: 制約を立てる系は盤面へ戻して適用し、
    // 解説への導線（戦型・手筋）は図鑑の中でその項へ飛ぶ。
    _mountDock() {
      if (!this._mounts || !K.DetailView || !K.constraints) return;
      const H = {
        repo: this.repo,
        onHover: () => {},   // 盤は隠れているのでマスのハイライトはしない
        onAttack: id => { if (this.cb.onAttack) this.cb.onAttack(id); },
        onSetConstraint: (w, k, id) => { if (this.cb.onSet) this.cb.onSet(w, k, id); },
        onSenkei: id => {
          // 戦型エントリは senkei:id、大分類は skg:id の data-id。下位の区分 id は大分類の項へ寄せる
          const r = (K.SENKEI_RESOLVE || {})[id] || id;
          const GR = K.SENKEI_GROUPS || {};
          const target = this._itemOf(`senkei:${r}`) ? `senkei:${r}`
            : `skg:${Object.keys(GR).find(g => g === r || (GR[g].kinds || []).includes(r)) || r}`;
          if (this.cb.onGo) this.cb.onGo(target);
        },
        onCombo: (w, id, vs) => { if (this.cb.onCombo) this.cb.onCombo(w, id, vs); },
        onDefense: id => { if (this.cb.onDefense) this.cb.onDefense(id); },
        onOpenTesuji: id => { if (this.cb.onGo) this.cb.onGo(id); },
      };
      for (const el of this.main.querySelectorAll('[data-mount]')) {
        const m = this._mounts.get(el.dataset.mount);
        if (!m) continue;
        const S = K.constraints.effectiveSides(m.slots, false);
        const dv = new K.DetailView(el, H);
        dv.render({ sel: m.sel, st: S.me, S, showOpp: false, contacts: [] });
      }
    }

    // ---------- コマ送り: 図・手・一言だけを差し替える（本文や出典の番号は作り直さない） ----------
    _go(id, i) {
      const t = (K.TESUJI || []).find(x => x.id === id);
      const card = this.main.querySelector(`.wj-sec[data-id="${CSS.escape(id)}"]`);
      if (!t || !card) return;
      const n = t.diagram.frames.length;
      i = Math.max(0, Math.min(n - 1, i));
      this.frame.set(id, i);
      card.querySelector('.tj-fig').innerHTML = this._figure(t, i);
    }

    _figure(t, i) {
      const d = t.diagram, fr = d.frames[i], n = d.frames.length;
      const steps = d.frames.map((f, k) =>
        `<button type="button" class="tj-step" data-step="${k}" aria-pressed="${k === i}">${esc(f.move || '初形')}</button>`).join('');
      return diagramSVG(d, i) +
        `<figcaption><p class="tj-move">${esc(fr.move || '初形')}</p><p class="tj-cap">${esc(fr.caption)}</p>` +
        `<p class="tj-hand">先手の持ち駒：${esc(handText(fr.hand))}</p>` +
        (fr.handGote !== undefined ? `<p class="tj-hand">後手の持ち駒：${esc(handText(fr.handGote))}</p>` : '') +
        (d.turn === 'gote' ? '<p class="tj-hand">△後手の番から始まる図</p>' : '') +
        `<div class="tj-nav"><button type="button" class="ib txt" data-step="${i - 1}" ${i === 0 ? 'disabled' : ''} aria-label="前の手">◀</button>` +
        `<span class="tj-steps">${steps}</span>` +
        `<button type="button" class="ib txt" data-step="${i + 1}" ${i === n - 1 ? 'disabled' : ''} aria-label="次の手">▶</button></div>` +
        `</figcaption>`;
    }

    _onClick(e) {
      const step = e.target.closest('[data-step]');
      if (step) { this._go(step.closest('[data-id]').dataset.id, +step.dataset.step); return; }
      const tabBtn = e.target.closest('[data-tab]');
      if (tabBtn) {
        // 大項目のタブは分類の切替だけ（記事は変えない。タイルで項を選ぶ）
        const t = (this._tabs || []).find(x => x.id === tabBtn.dataset.tab);
        if (t) this._setTab(t);
        return;
      }
      const go = e.target.closest('[data-go]');
      if (go) {
        e.preventDefault();
        this._tocClose();
        // 目次からの遷移はハッシュに積む（「戻る」でひとつ前の節に戻れる）
        if (this.cb.onGo) this.cb.onGo(go.dataset.go);
        return;
      }
      if (e.target.closest('[data-exit]') && this.cb.onExit) {
        this._tocClose();
        this.cb.onExit();
      }
    }

    // ---------- 狭い画面: 目次は左端から開くドロワー ----------
    _tocToggle() {
      const open = this.root.dataset.toc === 'open';
      this.root.dataset.toc = open ? '' : 'open';
      const btn = this.root.querySelector('.wj-toc-btn');
      if (btn) btn.setAttribute('aria-expanded', String(!open));
    }
    _tocClose() {
      if (this.root.dataset.toc !== 'open') return;
      this.root.dataset.toc = '';
      const btn = this.root.querySelector('.wj-toc-btn');
      if (btn) btn.setAttribute('aria-expanded', 'false');
    }
  }

  K.TesujiMode = TesujiMode;
  K.tesujiChapters = buildTree;   // 章立ての純関数（unit-test からも使う）
  K.tesujiDiagramSVG = diagramSVG;
})();
