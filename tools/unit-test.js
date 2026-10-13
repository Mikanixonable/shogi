// 単体テスト: compose / compat / matchup の両立判定を node で検査する（対局図 M2）
// 使い方: node shogi/tools/unit-test.js （失敗があれば終了コード1）
// 読み込みは tools/validate-castles.js と同じく node vm + manifest（core+data+logic）。
// compose.js / compat.js は manifest 未収録の段階でも直接読む
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const ctx = vm.createContext({ console });
ctx.window = ctx;

function load(f) {
  const full = path.join(ROOT, f);
  let code;
  try { code = fs.readFileSync(full, 'utf8'); }
  catch (e) { console.error(`missing file: ${f} (${full})`); process.exit(1); }
  try { vm.runInContext(code, ctx, { filename: f }); }
  catch (e) { console.error(`load error in ${f}: ${e && e.stack || e && e.message}`); process.exit(1); }
}

load('js/manifest.js');
const M = ctx.Kakoi && ctx.Kakoi.MANIFEST;
if (!M) { console.error('load error: Kakoi.MANIFEST が未定義'); process.exit(1); }
for (const f of [...M.core, ...M.data, ...M.logic]) load(f);
// M2 の新規コア。manifest 未収録でもファイルがあれば読む（並行実装中のため存在チェックつき）
for (const f of ['js/core/compose.js', 'js/core/compat.js']) {
  if (fs.existsSync(path.join(ROOT, f))) load(f);
}
// hash-link は ui 配属だが parseHash/buildQuery は DOM 非依存なので単体でも試す。
// tactic-nav（placeTactics）と mini-board（miniWindow）も DOM 非依存の純関数なので試す（§5）
ctx.URLSearchParams = URLSearchParams;
load('js/ui/hash-link.js');
load('js/ui/tactic-nav.js');
load('js/ui/mini-board.js');

const K = ctx.Kakoi;
if (!K.compose || !K.compose.position) {
  console.error('load error: Kakoi.compose が未定義。js/core/compose.js がまだ無い（M2 の並行実装待ち）');
  process.exit(1);
}
if (!K.compat || !K.compat.judge) {
  console.error('load error: Kakoi.compat が未定義。js/core/compat.js がまだ無い');
  process.exit(1);
}
for (const key of ['TACTICS', 'CASTLES', 'STRATEGIES', 'SETUPS', 'TACTIC_FAMILIES']) {
  if (!K[key]) { console.error(`load error: Kakoi.${key} が未定義`); process.exit(1); }
}

// ---------- 小さい assert ハーネス ----------
let pass = 0, fail = 0;
function ok(cond, name, detail = '') {
  if (cond) { pass++; console.log(`PASS ${name}`); }
  else { fail++; console.log(`FAIL ${name} -- ${detail}`); }
}
const brief = j => `${j.level} [${j.reasons.map(r => r.code).join(',')}]`;
const has = (j, code) => j.reasons.some(r => r.code === code);
const jstr = o => JSON.stringify(o);

const sideOf = t => {
  const fam = (K.TACTIC_FAMILIES || []).find(f => f.id === t.family);
  return fam ? fam.side : null;
};
// 戦法の系統の side を戦略として、その戦法を選んだ状態
const meOf = t => ({ strategy: sideOf(t), tacticId: t.id });

// ---------- 1. 216-matrix スナップショット ----------
const SYM = { best: '◎', ok: '○', ng: '×' };
const W = Math.max(...K.CASTLES.map(c => c.id.length)) + 1;
const NW = Math.max(...K.TACTICS.map(t => t.id.length)) + 1;
const mlines = [
  '# 戦法×囲い 両立マトリクス（Kakoi.compat.judge の level。 ◎=best ○=ok ×=ng）',
  '# 行=戦法（strategy=系統の side）、列=囲い（CASTLES のデータ順）。tools/unit-test.js が生成・照合する',
  ''.padEnd(NW) + K.CASTLES.map(c => c.id.padEnd(W)).join(' '),
];
for (const t of K.TACTICS) {
  const cells = K.CASTLES.map(c =>
    (SYM[K.compat.judge(meOf(t), 'castle', c.id).level] || '?').padEnd(W));
  mlines.push(t.id.padEnd(NW) + cells.join(' '));
}
const matrixText = mlines.join('\n') + '\n';
const matrixFile = path.join(ROOT, 'tools', 'expected-matrix.txt');
if (!fs.existsSync(matrixFile)) {
  fs.writeFileSync(matrixFile, matrixText);
  pass++;
  console.log('PASS matrix:baseline-created（tools/expected-matrix.txt を作成。以降は照合される）');
} else {
  const expected = fs.readFileSync(matrixFile, 'utf8').replace(/\r\n/g, '\n');
  ok(expected === matrixText, 'matrix:snapshot', 'expected-matrix.txt と不一致（意図した変更ならファイルを消して再生成）');
}
console.log(matrixText);

// ---------- 2. §8-C 受け入れ: ng でない組み合わせに二歩と主役ずれが無い ----------
let c2 = 0, c2fail = [];
for (const t of K.TACTICS) {
  for (const c of K.CASTLES) {
    const j = K.compat.judge(meOf(t), 'castle', c.id);
    if (j.level === 'ng') continue;
    c2++;
    const res = K.compose.position({ strategy: sideOf(t), tacticId: t.id, castleId: c.id });
    const pawn = (res.conflicts || []).find(x => x.code === 'PAWN');
    if (pawn) c2fail.push(`${t.id}×${c.id}: ${pawn.text}`);
    for (const e of K.notation.parsePieces(t.essential)) {
      const on = res.position.at(e.f, e.r);
      if (!on || on.p !== e.p) {
        c2fail.push(`${t.id}×${c.id}: essential ${e.p}${e.f}${e.r} が ${on ? on.p : '不在'} にずれている`);
      }
    }
  }
}
ok(c2fail.length === 0, `compose:ngでない${c2}組の二歩・主役ずれ0件`, c2fail.slice(0, 5).join(' / '));

// ---------- 3. 既知の期待値（計画書 §1-3 / §2-5 / §8 由来） ----------
{
  const j = K.compat.judge({ strategy: 'ibisha', tacticId: 'bougin' }, 'castle', 'funa');
  ok(j.level !== 'ng', 'expect:bougin×funa not-ng', brief(j));
}
{
  const j = K.compat.judge({ strategy: 'furibisha', tacticId: 'mukaibisha' }, 'castle', 'yagura');
  ok(j.level === 'ng' && has(j, 'SQUARE'), 'expect:mukaibisha×yagura ng SQUARE', brief(j));
}
{
  const j = K.compat.judge({ strategy: 'ibisha', tacticId: 'koshikakegin' }, 'castle', 'gangi');
  ok(j.level !== 'ng' && has(j, 'FLEX'), 'expect:koshikakegin×gangi not-ng + 崩し形', brief(j));
}
{
  const j = K.compat.judge({ strategy: 'ibisha', tacticId: 'bougin' }, 'castle', 'anaguma');
  // dedupeReasons で自動生成の TEMPO 注記は内容の同じ（より詳しい）PAIRING 注記に
  // 畳み込まれるので、実質は「手数の警告が残る」ことを見る
  ok(j.level === 'ok' && (has(j, 'TEMPO') || j.reasons.some(r => /手数/.test(r.text))),
    'expect:bougin×anaguma ok + 手数の警告', brief(j));
}
{
  const j = K.compat.judge({ strategy: 'furibisha', tacticId: 'nakabisha' }, 'castle', 'mino');
  // 相性表の注記つき○が自動判定の×を覆す（「飛車が浮いたあとの形」。重なりの理由は notes に残る）
  ok(j.level === 'ok' && has(j, 'PAIRING') && has(j, 'SQUARE'), 'expect:nakabisha×mino 注記つきok（5八の重なりは注意として残る）', brief(j));
}
{
  const j = K.compat.judge({ strategy: 'furibisha', tacticId: 'shikenbisha' }, 'castle', 'mino');
  ok(j.level === 'best' && has(j, 'PAIRING'), 'expect:shikenbisha×mino best(pairing)', brief(j));
}
{
  // 袖飛車の飛3八と美濃の玉2八は筋の差1 → KING_ROOK（SIDE も併記される）
  const j = K.compat.judge({ strategy: 'ibisha', tacticId: 'sodebisha' }, 'castle', 'mino');
  ok(j.level === 'ng' && has(j, 'KING_ROOK'), 'expect:sodebisha×mino ng KING_ROOK', brief(j));
}
{
  // 右四間の飛4八は中央なので SAME_WING は発火しない。×の直接の理由は SIDE（居飛車戦略×振り飛車の囲い）
  const j = K.compat.judge({ strategy: 'ibisha', tacticId: 'migishiken' }, 'castle', 'mino');
  ok(j.level === 'ng' && has(j, 'SIDE'), 'expect:migishiken×mino ng SIDE', brief(j));
}
{
  // L2: 相性表の○は overrides で宣言した理由だけを消す。SIDE（戦略の不一致）は消えない
  const j = K.compat.judge({ strategy: 'furibisha', tacticId: 'bougin', castleId: 'funa' }, 'castle', 'funa');
  ok(j.level === 'ng' && has(j, 'SIDE'), 'expect:bougin×funa 戦略不一致は○相性表でも×（L2）', brief(j));
}
{
  // L2: 端筋（1・9筋）の飛車は玉飛接近・同翼の対象外。一間飛車×美濃は実戦の定番形
  const j = K.compat.judge({ strategy: 'furibisha', tacticId: 'ikkenbisha' }, 'castle', 'mino');
  ok(j.level === 'ok' && has(j, 'KING_ROOK_EXEMPT'),
    'expect:ikkenbisha×mino ok（端筋の飛車は玉飛接近の対象外）', brief(j));
}
{
  // L2: 一間飛車×振り飛車穴熊 — SQUARE は overrides 宣言で○（一間飛車穴熊は定番）
  const j = K.compat.judge({ strategy: 'furibisha', tacticId: 'ikkenbisha' }, 'castle', 'furianaguma');
  ok(j.level === 'ok' && has(j, 'PAIRING') && has(j, 'SQUARE'),
    'expect:ikkenbisha×furianaguma 注記つきok（一間飛車穴熊）', brief(j));
}
{
  // L8: 戦略層の判定にも同じ規則 — 中飛車×美濃の○上書きが戦略の判定にも効く
  const j = K.compat.judge({ tacticId: 'nakabisha', castleId: 'mino' }, 'strategy', 'furibisha');
  ok(j.level !== 'ng', 'expect:nakabisha×mino 戦略層も○上書きが効く（L8）', brief(j));
}

// 戦略テンプレートの既定値どうしは必ず両立する（§4-2 / validate の保証を単体でも固定）
for (const sid of Object.keys(K.STRATEGIES)) {
  const S = K.STRATEGIES[sid];
  const dcIds = typeof S.defaultCastle === 'string'
    ? [S.defaultCastle] : [S.defaultCastle.vsIbisha, S.defaultCastle.vsFuribisha];
  for (const cid of [...new Set(dcIds)]) {
    const j = K.compat.judge({ strategy: sid, tacticId: S.defaultTactic }, 'castle', cid);
    ok(j.level !== 'ng', `strategy-defaults:${sid} 既定戦法×既定囲い(${cid})`, brief(j));
  }
  const jt = K.compat.judge({ strategy: sid, castleId: dcIds[0] }, 'tactic', S.defaultTactic);
  ok(jt.level !== 'ng', `strategy-defaults:${sid} 既定囲い×既定戦法(${S.defaultTactic})`, brief(jt));
}

// ---------- 3.5 rest/hand: 囲い切替で残る駒の正規化（計画書 L1） ----------
{
  // 本美濃（既定の土台）→片美濃: 5八の金は図の定義上いないので、rest の金69へ移る
  const r = K.compose.position({ strategy: 'furibisha', castleId: 'katamino' });
  const a58 = r.position.at(5, 8), a69 = r.position.at(6, 9);
  ok(!a58 || a58.p !== '金', 'compose:rest 本美濃→片美濃で5八に金が残らない',
    `5八=${a58 ? a58.p : '空'} ${a58 ? a58.role : ''}`);
  ok(a69 && a69.p === '金', 'compose:rest 余った金は6九へ（rest）',
    `6九=${a69 ? a69.p : '空'} ${a69 ? a69.role : ''}`);
  // 残った土台の駒は core role を引きずらない（本美濃の core が残らない）
  ok(!r.position.pieces.some(x => x.role === 'core' && x.f === 5 && x.r === 8),
    'compose:rest 土台の core role を引きずらない', jstr(r.position.pieces.filter(x => x.role === 'core').map(x => `${x.p}${x.f}${x.r}`)));
}
{
  // 戦法の図（金58を含む）を土台にしても同じく去る
  const r = K.compose.position({ strategy: 'furibisha', tacticId: 'shikenbisha', castleId: 'katamino' });
  const a58 = r.position.at(5, 8), a69 = r.position.at(6, 9);
  ok(!a58 || a58.p !== '金', 'compose:rest 四間飛車+片美濃でも5八に金が残らない',
    `5八=${a58 ? a58.p : '空'}`);
  ok(a69 && a69.p === '金', 'compose:rest 四間飛車+片美濃でも金は6九へ', `6九=${a69 ? a69.p : '空'}`);
}
{
  // 中飛車の飛58は戦法の主役（ロック）なので rest に動かされない
  const r = K.compose.position({ strategy: 'furibisha', tacticId: 'nakabisha', castleId: 'katamino' });
  const a58 = r.position.at(5, 8);
  ok(a58 && a58.p === '飛', 'compose:rest 中飛車の飛58（主役）は残る', `5八=${a58 ? a58.p : '空'}`);
}
{
  // 高美濃・銀冠・木村美濃も5八に金がいない（同じ美濃系の定義条件）
  for (const cid of ['takamino', 'gincan', 'kimuramino']) {
    const rr = K.compose.position({ strategy: 'furibisha', tacticId: 'shikenbisha', castleId: cid });
    const a = rr.position.at(5, 8);
    ok(!a || a.p !== '金', `compose:rest ${cid} でも5八に金が残らない`, `5八=${a ? a.p : '空'}`);
  }
}
{
  // 兜囲い: 盤上の角は持ち駒へ（hand:'角' と整合）。必須の角は動かせず HAND 衝突
  const r = K.compose.position({ strategy: 'ibisha', castleId: 'kabuto' });
  const a88 = r.position.at(8, 8);
  ok(!a88 || a88.p !== '角', 'compose:hand 兜の8八に角が残らない', `8八=${a88 ? a88.p : '空'}`);
  ok((r.position.hand || []).includes('角'), 'compose:hand 兜の角は持ち駒へ', jstr(r.position.hand));
  const j = K.compat.judge({ strategy: 'ibisha', tacticId: 'sujichigaikaku' }, 'castle', 'kabuto');
  ok(j.level === 'ng' && has(j, 'HAND'), 'compose:hand 筋違い角の必須角は持ち駒にできず ng', brief(j));
  // 腰掛け銀は角を持ち駒にしているので兜と両立する
  const j2 = K.compat.judge({ strategy: 'ibisha', tacticId: 'koshikakegin' }, 'castle', 'kabuto');
  ok(j2.level !== 'ng', 'compose:hand 腰掛け銀（持ち駒に角あり）×兜は両立', brief(j2));
}
{
  // L1 スイープ: 全（戦法 or テンプレート）× 囲いで、盤上の玉・金・銀は
  // core・rest・必須・主役・初期位置のいずれかにある（囲いが定義しない場所に守り駒が残らない）
  const INIT = new Set(['59', '49', '69', '39', '79']);
  const bad = [];
  const bases = [{ tacticId: null }];
  for (const t of K.TACTICS) bases.push({ tacticId: t.id });
  for (const c of K.CASTLES) {
    const allowed = new Set([...K.notation.parsePieces(c.core), ...K.notation.parsePieces(c.rest || '')]
      .map(x => `${x.f}${x.r}`));
    for (const fx of c.flex || []) for (const s of fx.to || []) allowed.add(s); // 崩し形の行き先も囲いの定義
    for (const b of bases) {
      const strategy = b.tacticId
        ? (K.TACTIC_FAMILIES.find(f => f.id === K.TACTICS.find(t => t.id === b.tacticId).family) || {}).side
        : c.side;
      if (!strategy) continue;
      const res = K.compose.position({ strategy, tacticId: b.tacticId, castleId: c.id });
      if (res.conflicts.some(x => x.code === 'SQUARE' || x.code === 'COUNT')) continue; // 合成不能は判定側の領分
      const locked = new Set();
      if (b.tacticId) {
        const t = K.TACTICS.find(t => t.id === b.tacticId);
        for (const e of K.notation.parsePieces(t.essential)) locked.add(`${e.f}${e.r}`);
        if (t.lead) locked.add(t.lead.square);
      }
      for (const x of res.position.pieces) {
        if (x.owner !== 'sente' || !'玉金銀'.includes(x.p)) continue;
        const s = `${x.f}${x.r}`;
        if (!allowed.has(s) && !locked.has(s) && !INIT.has(s)) {
          bad.push(`${b.tacticId || 'template'}+${c.id}: ${x.p}${s}`);
        }
      }
    }
  }
  ok(bad.length === 0, `compose:L1 守り駒が core/rest/必須/初期位置以外に残らない（全組合せ）`, bad.slice(0, 8).join(' / '));
}
{
  // L3: 手数判定（moveCount）。届くものは置ける（ミレニアム・ビッグ4・松尾流・四枚美濃）
  const mc = K.pieceMatch.moveCount;
  ok(mc('銀', '39', '88') === 5 && mc('銀', '39', '79') === 4 && mc('金', '49', '58') === 1,
    'moveCount:銀39→88=5手・39→79=4手・金49→58=1手', `${mc('銀', '39', '88')},${mc('銀', '39', '79')},${mc('金', '49', '58')}`);
  ok(mc('歩', '37', '36') === 1 && !isFinite(mc('歩', '37', '47')) && !isFinite(mc('歩', '37', '38')),
    'moveCount:歩は前だけ（横・後退は届かない）', `${mc('歩', '37', '36')},${mc('歩', '37', '47')},${mc('歩', '37', '38')}`);
  ok(!isFinite(mc('桂', '29', '28')) && mc('桂', '29', '37') === 1,
    'moveCount:桂は前だけ（後退は届かない）', `${mc('桂', '29', '28')},${mc('桂', '29', '37')}`);
  // 香は同じ筋の前方だけ（横・後退・斜めは届かない）。STEP 未定義で GOLD_STEP に落ちると
  // 別筋の香が donor に選ばれ、初期位置の香が盤面から消える（振り飛車穴熊の香99消失）の回帰
  ok(mc('香', '99', '98') === 1 && mc('香', '19', '18') === 1,
    'moveCount:香は同じ筋の前方へ届く', `${mc('香', '99', '98')},${mc('香', '19', '18')}`);
  ok(!isFinite(mc('香', '99', '18')) && !isFinite(mc('香', '19', '28')) && !isFinite(mc('香', '19', '29')),
    'moveCount:香は別の筋・後退・斜めへ届かない', `${mc('香', '99', '18')},${mc('香', '19', '28')},${mc('香', '19', '29')}`);
  for (const cid of ['millennium', 'matsuo-anaguma', 'big4', 'yonmaimino']) {
    const j = K.compat.judge({ strategy: 'ibisha', tacticId: 'ibisha-base' }, 'castle', cid);
    ok(j.level !== 'ng', `compose:L3 ${cid} はibisha-baseから届く`, brief(j));
  }
}
{
  // 穴熊系囲い: 玉が香の元いたマスに入るため香は持ち駒→目標マスへ。別筋の香は
  // 届かないので初期位置に残る（振り飛車穴熊なら香99、居飛車穴熊なら香19 が盤上）
  const checks = [
    ['shikenbisha', 'furianaguma', ['18', '99']],
    ['ibisha-base', 'anaguma', ['19', '98']],
    ['ibisha-base', 'yagura-anaguma', ['19', '98']],
  ];
  for (const [tid, cid, want] of checks) {
    const t = K.TACTICS.find(x => x.id === tid);
    const st = (K.TACTIC_FAMILIES.find(f => f.id === t.family) || {}).side;
    const r = K.compose.position({ strategy: st, tacticId: tid, castleId: cid });
    const got = r.position.pieces.filter(x => x.p === '香').map(x => `${x.f}${x.r}`).sort().join(',');
    const handKyo = r.position.hand.filter(p => p === '香').length;
    ok(got === want.join(',') && handKyo === 0,
      `compose:香 ${tid}+${cid} 盤上=${want.join(',')} 持ち駒=0`,
      `盤上=${got} 持ち駒香=${handKyo}`);
  }
}

// ---------- 4. apply（自動差し替え）の決定性 ----------
{
  // 旧 compat.resolve と同じ場面: 四間飛車＋本美濃の状態で穴熊を選ぶ
  const list = [
    { who: 'me', kind: 'strategy', id: 'furibisha' },
    { who: 'me', kind: 'castle', id: 'mino' },
    { who: 'me', kind: 'tactic', id: 'shikenbisha' },
  ];
  const r1 = K.constraints.apply(list, { type: 'set', who: 'me', kind: 'castle', id: 'anaguma' });
  const r2 = K.constraints.apply(list, { type: 'set', who: 'me', kind: 'castle', id: 'anaguma' });
  ok(r1.changed.length >= 1, 'apply:anaguma選択で差し替えが起きる', jstr(r1.changed));
  ok(r1.changed.some(e => e.kind === 'tactic' && e.from === 'shikenbisha'),
    'apply:changed が戦法の差し替えを説明する', jstr(r1.changed));
  ok(jstr(r1.list) === jstr(r2.list) && jstr(r1.changed) === jstr(r2.changed),
    'apply:2回実行で同一結果', `${jstr(r1.list)} != ${jstr(r2.list)}`);
  ok(r1.list[r1.list.length - 1].kind === 'castle' && r1.list[r1.list.length - 1].id === 'anaguma',
    'apply:リスト末尾はいま選んだ制約', jstr(r1.list));
  // 差し替え後の状態では、差し替わった層が ng でないこと
  const S = K.constraints.sides(r1.list);
  for (const e of r1.changed) {
    const st = S[e.who];
    const j = K.compat.judge(st, e.kind, st[K.constraints.FIELD[e.kind]]);
    ok(j.level !== 'ng', `apply:差し替え後の ${e.kind}(${st[K.constraints.FIELD[e.kind]]}) は両立`, brief(j));
  }
  console.log(`  apply 結果: ${jstr(r1.list)}\n  changed: ${jstr(r1.changed)}`);
}

// ---------- 5. matchup スポットチェック（§1-2 の距離モデル） ----------
{
  const th = K.matchup.threat({ strategy: 'ibisha', castleId: 'yagura' }, { strategy: 'ibisha', tacticId: 'ibisha-base' });
  ok(th.kind === 'aiibisha' && th.distance === 0, 'matchup:相居飛車 distance 0', jstr(th));
}
{
  const th = K.matchup.threat({ strategy: 'ibisha', castleId: 'anaguma' }, { strategy: 'furibisha', tacticId: 'shikenbisha' });
  ok(th.kind === 'taikou-i' && th.distance >= 4, 'matchup:対抗形（自分が居飛車）distance>=4', jstr(th));
}
{
  const th = K.matchup.threat({ strategy: 'furibisha', castleId: 'mino' }, { strategy: 'furibisha', tacticId: 'sankenbisha' });
  ok(th.kind === 'aifuri' && th.distance <= 2, 'matchup:相振り飛車 distance<=2', jstr(th));
}

// ---------- 6. constraints: sides / apply / preview / lateOf / labels（計画書 §1 / §3-2） ----------
if (!K.constraints || !K.constraints.sides || !K.constraints.apply || !K.constraints.preview) {
  ok(false, 'constraints: Kakoi.constraints が未定義', 'js/core/constraints.js を確認');
} else {
  const CS = K.constraints, FIELD = CS.FIELD, KINDS = CS.KINDS;
  // 「ng を残さない」の判定は tactic/castle 層で行う。どの層で評価しても盤上の衝突と
  // SIDE は同じ ng になる（戦略層も同じ規則。L8）
  const judgeAll = (S, who) => {
    const st = S[who], opp = who === 'me' ? S.opp : S.me;
    const bad = [];
    for (const k of ['tactic', 'castle']) {
      const j = K.compat.judge(st, k, st[FIELD[k]], opp);
      if (j.level === 'ng') bad.push(`${who}.${k}=${st[FIELD[k]]} ${brief(j)}`);
    }
    return bad;
  };

  // sides: 暗黙の補完と rank / pick / opp:null
  {
    const s = CS.sides([{ who: 'me', kind: 'castle', id: 'funa' }]);
    ok(s.me.castleId === 'funa' && s.me.strategy === 'ibisha' && s.me.tacticId === 'ibisha-base',
      'constraints:sides 囲いだけ→既定値で補完', jstr(s.me));
    ok(s.me.implied.strategy === true && s.me.implied.tactic === true && !s.me.implied.castle,
      'constraints:sides implied フラグ（strategy/tactic が暗黙）', jstr(s.me.implied));
    ok(s.me.rank.castle === 0 && s.me.rank.strategy === -1 && s.me.rank.tactic === -1,
      'constraints:sides rank（無い層は-1）', jstr(s.me.rank));
    ok(s.opp === null, 'constraints:sides 相手の制約が無いとき opp=null', jstr(s.opp));
  }
  {
    // 戦法だけ指定 → 戦略は系統の side から推論（振り飛車の戦法なら furibisha）
    const s = CS.sides([{ who: 'opp', kind: 'tactic', id: 'shikenbisha' }]);
    ok(s.opp && s.opp.strategy === 'furibisha' && s.opp.implied.strategy === true,
      'constraints:sides 戦略を戦法の系統から推論', jstr(s.opp));
    ok(s.opp.castleId === 'mino', 'constraints:sides 既定囲い（furibisha vs 未指定→vsIbisha）', jstr(s.opp));
  }
  {
    // 既定囲いの vsIbisha/vsFuribisha 振り分け: 相手が振り飛車なら vsFuribisha
    const s = CS.sides([{ who: 'me', kind: 'strategy', id: 'ibisha' }, { who: 'opp', kind: 'strategy', id: 'furibisha' }]);
    ok(s.me.castleId === 'funa', 'constraints:sides ibisha の既定囲いは対振り用 funa', jstr(s.me));
    const s2 = CS.sides([{ who: 'me', kind: 'strategy', id: 'ibisha' }, { who: 'opp', kind: 'strategy', id: 'ibisha' }]);
    ok(s2.me.castleId === 'yagura', 'constraints:sides ibisha の既定囲いは相居飛車用 yagura', jstr(s2.me));
  }
  {
    // 同じ (who,kind) の重複は末尾を採用し、rank は末尾の位置
    const s = CS.sides([
      { who: 'me', kind: 'castle', id: 'funa' },
      { who: 'me', kind: 'tactic', id: 'bougin' },
      { who: 'me', kind: 'castle', id: 'yagura' },
    ]);
    ok(s.me.castleId === 'yagura' && s.me.rank.castle === 1 && s.me.rank.tactic === 0,
      'constraints:sides 重複 (who,kind) は末尾優先（rank は正規化後の位置）', jstr(s.me));
  }

  // apply: set は末尾へ・同 (who,kind) は置き換え、remove は取り除いて連鎖解決（L7）
  {
    const r = CS.apply([{ who: 'me', kind: 'castle', id: 'funa' }],
      { type: 'set', who: 'me', kind: 'castle', id: 'yagura' });
    ok(r.list.length === 1 && r.list[0].id === 'yagura' && r.changed.length === 0,
      'constraints:apply 同 (who,kind) の置き換え', jstr(r));
    const r2 = CS.apply(r.list, { type: 'remove', who: 'me', kind: 'castle' });
    ok(r2.list.length === 0 && r2.changed.length === 0, 'constraints:apply remove は取り除く', jstr(r2));
    const r3 = CS.apply([
      { who: 'me', kind: 'castle', id: 'funa' }, { who: 'opp', kind: 'strategy', id: 'ibisha' }],
      { type: 'set', who: 'me', kind: 'tactic', id: 'bougin' });
    ok(r3.list[r3.list.length - 1].kind === 'tactic' && r3.list[r3.list.length - 1].id === 'bougin',
      'constraints:apply set は末尾へ', jstr(r3.list));
    // 同じ値を選び直すと末尾へ移る（優先度の更新。L11）
    const r4 = CS.apply([
      { who: 'me', kind: 'castle', id: 'funa' }, { who: 'me', kind: 'tactic', id: 'bougin' }],
      { type: 'set', who: 'me', kind: 'castle', id: 'funa' });
    ok(r4.list.length === 2 && r4.list[1].kind === 'castle' && r4.list[1].id === 'funa',
      'constraints:apply 同じ値の再選択は末尾へ（L11）', jstr(r4.list));
    const r5 = CS.apply(r4.list, { type: 'set', who: 'me', kind: 'castle', id: 'funa' });
    ok(r5.list === r4.list, 'constraints:apply 末尾の値の再選択は無操作', jstr(r5.list));
  }
  {
    // 連鎖: furibisha 明示の側に居飛車の戦法を入れる → 古い制約が差し替わる
    const r = CS.apply([
      { who: 'me', kind: 'strategy', id: 'furibisha' }, { who: 'me', kind: 'castle', id: 'mino' }],
      { type: 'set', who: 'me', kind: 'tactic', id: 'bougin' });
    ok(r.changed.length >= 1, 'constraints:apply 連鎖が起きる', jstr(r.changed));
    const bad = judgeAll(CS.sides(r.list), 'me');
    ok(bad.length === 0, 'constraints:apply 連鎖後に ng を残さない', bad.join(' / '));
    // 相手側の制約は変わらない（連鎖は同じ側の中だけ）
    const r2 = CS.apply([
      { who: 'opp', kind: 'strategy', id: 'furibisha' }, { who: 'opp', kind: 'castle', id: 'mino' }],
      { type: 'set', who: 'me', kind: 'tactic', id: 'bougin' });
    ok(r2.changed.every(c => c.who === 'me'), 'constraints:apply 連鎖は同じ側だけ', jstr(r2.changed));
    // L7: remove のあとも連鎖解決する。残った制約に ng を残さない
    const rm = CS.apply(r.list, { type: 'remove', who: 'me', kind: 'tactic' });
    ok(judgeAll(CS.sides(rm.list), 'me').length === 0,
      'constraints:apply remove 後も ng を残さない（L7）', jstr(rm.list));
    // L6: 'constructor' や '__proto__' を有効な id として通さない
    const badCtor = CS.apply(r.list, { type: 'set', who: 'me', kind: 'strategy', id: 'constructor' });
    ok(jstr(badCtor.list) === jstr(r.list), 'constraints:apply strategy:constructor は無効（L6）', jstr(badCtor.list));
    const badProto = CS.apply(r.list, { type: 'set', who: 'me', kind: 'strategy', id: '__proto__' });
    ok(jstr(badProto.list) === jstr(r.list), 'constraints:apply strategy:__proto__ は無効（L6）', jstr(badProto.list));
    // L12: 連鎖の差し替えは「戦略の既定値」を最初に試す
    const sw = CS.apply([
      { who: 'me', kind: 'tactic', id: 'bougin' }, { who: 'me', kind: 'castle', id: 'yagura' }],
      { type: 'set', who: 'me', kind: 'strategy', id: 'furibisha' });
    ok(sw.changed.some(c => c.kind === 'tactic' && c.to === 'shikenbisha'),
      'constraints:L12 差し替えは戦略既定値を優先（tactic→shikenbisha）', jstr(sw.changed));
    ok(sw.changed.some(c => c.kind === 'castle' && c.to === 'mino'),
      'constraints:L12 差し替えは戦略既定値を優先（castle→mino）', jstr(sw.changed));
  }

  // compose.merge: 両軍の歩の接触（L10）
  {
    const P = (p, f, r, owner) => ({ p, f, r, owner });
    // 5五で接触、先手の下げ先 5六 は先手の香が塞ぐ → 後手の歩が 5四 へ下がる
    const me = new K.Position([P('歩', 5, 5, 'sente'), P('香', 5, 6, 'sente')], []);
    const opp = new K.Position([P('歩', 5, 5, 'gote')], []);
    const m = K.compose.merge(me, opp, { late: 'me' });
    const gote = m.position.pieces.find(x => x.owner === 'gote' && x.p === '歩');
    ok(gote && gote.r === 4 && m.contacts[0].kind === 'pawn',
      'compose:merge 歩接触は遅い側が塞がるともう一方を下げる（L10）', jstr(m.contacts));
    // 両方の下げ先が塞がっている → 両方が元の位置のまま ng
    const opp2 = new K.Position([P('歩', 5, 5, 'gote'), P('香', 5, 4, 'gote')], []);
    const m2 = K.compose.merge(me, opp2, { late: 'me' });
    const pawns = m2.position.pieces.filter(x => x.p === '歩');
    ok(m2.contacts[0].kind === 'ng' && pawns.length === 2 && pawns.every(x => x.r === 5),
      'compose:merge 両方塞がる歩は元の位置のまま ng（L10）', jstr(m2.contacts));
  }

  // lateOf（§1-3.5）: リスト末尾の制約の側、空なら 'opp'
  ok(CS.lateOf([]) === 'opp', 'constraints:lateOf 空は opp');
  ok(CS.lateOf([{ who: 'me', kind: 'castle', id: 'funa' }]) === 'me', 'constraints:lateOf 末尾の側');
  ok(CS.lateOf([{ who: 'me', kind: 'castle', id: 'funa' }, { who: 'opp', kind: 'strategy', id: 'ibisha' }]) === 'opp',
    'constraints:lateOf 末尾が opp');

  // labels（§1-4）: 戦型ラベルの代表例
  {
    const l = CS.labels(CS.sides([{ who: 'me', kind: 'strategy', id: 'ibisha' }]).me, null);
    ok(l.length === 0, 'constraints:labels 相手なしなら空', jstr(l));
    const taikou = CS.labels(CS.sides([
      { who: 'me', kind: 'strategy', id: 'ibisha' }, { who: 'opp', kind: 'strategy', id: 'furibisha' }]).me,
      CS.sides([{ who: 'opp', kind: 'strategy', id: 'furibisha' }]).opp);
    ok(taikou.some(x => x.label === '対抗形'), 'constraints:labels 対抗形', jstr(taikou));
    const aifuri = CS.labels(
      CS.sides([{ who: 'me', kind: 'strategy', id: 'furibisha' }]).me,
      CS.sides([{ who: 'opp', kind: 'strategy', id: 'furibisha' }]).opp);
    ok(aifuri.some(x => x.id === 'aifuri' && x.label === '相振り飛車'), 'constraints:labels 相振り飛車', jstr(aifuri));
    // 角換わり: 両者居飛車＋両戦法の持ち駒に角（腰掛け銀）。決定木は排他的で
    // senkei 系のラベルは1つだけ出る（腰掛け銀どうしなら角換わりだけ。L9 / §2-1）
    const kakugawari = CS.labels(
      CS.sides([{ who: 'me', kind: 'tactic', id: 'koshikakegin' }]).me,
      CS.sides([{ who: 'opp', kind: 'tactic', id: 'koshikakegin' }]).opp);
    ok(kakugawari.length === 2 && kakugawari[1].id === 'kakugawari',
      'constraints:labels 角換わりは排他（戦型ラベルは1つ）', jstr(kakugawari));
    // 横歩取り: 両者の戦法が yokofudori タグを持つ（相掛かりタグより先に判定される）
    const yoko = CS.labels(
      CS.sides([{ who: 'me', kind: 'tactic', id: 'hineribisha' }]).me,
      CS.sides([{ who: 'opp', kind: 'tactic', id: 'shigofu-hayajikake' }]).opp);
    ok(yoko.length === 2 && yoko[1].id === 'yokofudori',
      'constraints:labels 横歩取り（yokofudori タグ両者）', jstr(yoko));
    // 矢倉系が両者なら相矢倉、片方だけなら矢倉
    const aiyagura = CS.labels(
      CS.sides([{ who: 'me', kind: 'castle', id: 'yagura' }]).me,
      CS.sides([{ who: 'opp', kind: 'castle', id: 'ginyagura' }]).opp);
    ok(aiyagura.length === 2 && aiyagura[1].id === 'aiyagura',
      'constraints:labels 相矢倉（両者矢倉系）', jstr(aiyagura));
    const yagura = CS.labels(
      CS.sides([{ who: 'me', kind: 'castle', id: 'yagura' }]).me,
      CS.sides([{ who: 'opp', kind: 'castle', id: 'funa' }]).opp);
    ok(yagura.length === 2 && yagura[1].id === 'yagura',
      'constraints:labels 矢倉（片方だけ）', jstr(yagura));
    // 雁木: カニ・兜は refFamily があるので雁木と判定しない。本物の雁木では出る
    const gangiNg = CS.labels(
      CS.sides([{ who: 'me', kind: 'castle', id: 'kani' }]).me,
      CS.sides([{ who: 'opp', kind: 'castle', id: 'kabuto' }]).opp);
    ok(gangiNg.length === 1, 'constraints:labels カニ・兜は雁木と出ない', jstr(gangiNg));
    const gangi = CS.labels(
      CS.sides([{ who: 'me', kind: 'castle', id: 'gangi' }]).me,
      CS.sides([{ who: 'opp', kind: 'castle', id: 'kani' }]).opp);
    ok(gangi.length === 2 && gangi[1].id === 'gangi',
      'constraints:labels 雁木（片方が本物の雁木）', jstr(gangi));
  }

  // compat.judge の対敵軸（§3-1）: level は変えず vs に乗せる。層ごとに候補別の尺度
  {
    // 戦法: against[相手の戦略]（向かい飛車は対居飛車 good）
    const jt = K.compat.judge({ strategy: 'furibisha', castleId: 'mino' }, 'tactic', 'mukaibisha',
      { strategy: 'ibisha', tacticId: 'ibisha-base' });
    ok(jt.vs && jt.vs.level === 'good' && jt.vs.strategy === 'good',
      'compat:vs 戦法（向かい飛車は対居飛車 good）', jstr(jt.vs));
    // 囲い: fitness の帯。この組み合わせで美濃は最高から1.0以上低い下位帯 → bad、銀冠穴熊は上位帯 → good
    const jc = K.compat.judge({ strategy: 'furibisha', tacticId: 'mukaibisha' }, 'castle', 'mino',
      { strategy: 'ibisha', tacticId: 'ibisha-base' });
    ok(jc.vs && jc.vs.level === 'bad' && /相性スコア/.test(jc.vs.reasons[0].text),
      'compat:vs 囲い（fitness 下位帯は bad）', jstr(jc.vs));
    const jg = K.compat.judge({ strategy: 'furibisha', tacticId: 'mukaibisha' }, 'castle', 'ginkananaguma',
      { strategy: 'ibisha', tacticId: 'ibisha-base' });
    ok(jg.vs && jg.vs.level === 'good', 'compat:vs 囲い（fitness 上位帯は good）', jstr(jg.vs));
    const j2 = K.compat.judge({ strategy: 'ibisha', tacticId: 'ibisha-base' }, 'tactic', 'ibisha-base', null);
    ok(j2.vs === null, 'compat:vs 相手がいなければ null', jstr(j2));
  }

  // ---------- 6b. seed 固定の無作為操作列 1000回（§U1 完了条件） ----------
  {
    function mulberry32(a) {
      return function () {
        a |= 0; a = a + 0x6D2B79F5 | 0;
        let t = Math.imul(a ^ a >>> 15, 1 | a);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
      };
    }
    const rnd = mulberry32(20240511);
    const stratIds = Object.keys(K.STRATEGIES);
    const tIds = K.TACTICS.map(t => t.id), cIds = K.CASTLES.map(c => c.id);
    const candsOf = k => k === 'strategy' ? stratIds : k === 'tactic' ? tIds : cIds;
    // その層に「いまの値以外で両立する候補」があるか（暗黙の層が飽和しているかの判定用。
    // 例: 早石田のように玉を囲わずに仕掛ける戦法は、両立する囲いが1つも無い）
    const hasAlternative = (st, k, opp) =>
      candsOf(k).some(id => id !== st[FIELD[k]] && K.compat.judge(st, k, id, opp).level !== 'ng');
    let list = [], drops = 0, swaps = 0, mismatch = 0, mutated = 0;
    const ngLeft = [];
    for (let i = 0; i < 1000; i++) {
      const who = rnd() < 0.5 ? 'me' : 'opp';
      const kind = KINDS[Math.floor(rnd() * 3)];
      const roll = rnd();
      const cur = CS.sides(list)[who];      // 「同じ値を選び直す」（L11）を remove ともに操作列へ混ぜる（§5）
      const op = roll < 0.18 ? { type: 'remove', who, kind }
        : roll < 0.30 && cur && cur[FIELD[kind]] != null
          ? { type: 'set', who, kind, id: cur[FIELD[kind]] }
        : { type: 'set', who, kind,
            id: (kind === 'strategy' ? stratIds : kind === 'tactic' ? tIds : cIds)[Math.floor(rnd() * (kind === 'strategy' ? stratIds.length : kind === 'tactic' ? tIds.length : cIds.length))] };
      const before = jstr(list);
      const a = CS.apply(list, op);
      const p = CS.preview(list, op);
      if (jstr(a) !== jstr(p)) mismatch++;
      if (jstr(list) !== before) mutated++;              // apply/preview は入力を変えない
      for (const c of a.changed) { if (c.dropped) drops++; else swaps++; }
      list = a.list;
      const S = CS.sides(list);
      // 「ng を残さない」の厳密な条件:
      //   - 明示制約（新しい選択＝その側の最高優先を除く）が ng → 連鎖が残した bug
      //   - 暗黙の層が ng → 両立する値が存在しない（飽和）場合だけ許される
      //   - 新しい選択が ng → その ng の出所が「飽和した暗黙の層」の場合だけ許される
      for (const w of ['me', 'opp']) {
        const st = S[w];
        if (!st) continue;
        const opp = w === 'me' ? S.opp : S.me;
        const maxRank = Math.max(...KINDS.map(k => st.rank[k]));
        const impliedUnsat = KINDS.some(k => st.rank[k] < 0
          && K.compat.judge(st, k, st[FIELD[k]], opp).level === 'ng' && !hasAlternative(st, k, opp));
        for (const k of ['tactic', 'castle']) {
          if (K.compat.judge(st, k, st[FIELD[k]], opp).level !== 'ng') continue;
          const implied = st.rank[k] < 0;
          const allowed = implied ? !hasAlternative(st, k, opp)
            : (st.rank[k] === maxRank && impliedUnsat);
          if (!allowed && ngLeft.length < 5) {
            ngLeft.push(`i=${i} op=${jstr(op)} ${w}.${k}=${st[FIELD[k]]} list=${jstr(list)}`);
          }
        }
      }
    }
    ok(mismatch === 0, 'constraints:preview と apply の結果一致（1000回）', `不一致 ${mismatch} 件`);
    ok(mutated === 0, 'constraints:apply は入力リストを変更しない', `${mutated} 件`);
    ok(ngLeft.length === 0,
      `constraints:無作為1000操作で「解があるのに ng」0件（差替 ${swaps}・削除 ${drops}）`, ngLeft.join(' / '));
    // 操作列の終端で preview のキャッシュが効いていること（同じキーで同一結果オブジェクト）
    ok(CS.preview(list, { type: 'remove', who: 'me', kind: 'castle' })
      === CS.preview(list, { type: 'remove', who: 'me', kind: 'castle' }),
      'constraints:preview は同じキーでキャッシュを返す');
  }
}

// ---------- 7. hash-link: 新形式（k=/sel=）と旧形式の変換（計画書 §2） ----------
{
  const HL = K.hashLink;
  ok(HL && HL.parseHash && HL.buildQuery, 'hash-link: parseHash/buildQuery がある');

  // 新形式の読み取り
  {
    const p = HL.parseHash('v=board&k=os:furibisha,ot:shikenbisha,mc:funa&sel=mc');
    ok(jstr(p.constraints) === jstr([
      { who: 'opp', kind: 'strategy', id: 'furibisha' },
      { who: 'opp', kind: 'tactic', id: 'shikenbisha' },
      { who: 'me', kind: 'castle', id: 'funa' },
    ]) && p.selected === 'me.castle' && p.view === 'board',
    'hash-link:新形式 k=/sel= の読み取り', jstr(p));
  }
  // 旧形式 → 新しい状態への変換
  {
    const p = HL.parseHash('v=castle&c=yagura&t=bougin&cf=mino');
    ok(jstr(p.constraints) === jstr([{ who: 'me', kind: 'castle', id: 'yagura' }])
      && p.selected === 'me.castle' && p.view === 'board' && p.clusterFamily === 'mino',
      'hash-link:旧 castle → me.castle 制約', jstr(p));
  }
  {
    const p = HL.parseHash('v=tactic&t=bougin&c=funa');
    ok(jstr(p.constraints) === jstr([{ who: 'me', kind: 'tactic', id: 'bougin' }])
      && p.selected === 'me.tactic' && p.view === 'board',
      'hash-link:旧 tactic → me.tactic 制約', jstr(p));
  }
  {
    // pick 順（'tcs' = tactic→castle→strategy）が制約の並び順になる。mw=0 は showThreat:false
    const p = HL.parseHash('v=matchup&ms=ibisha&mt=bougin&mc=funa&mp=tcs&os=furibisha&ot=shikenbisha&oc=mino&op=&mw=0');
    ok(jstr(p.constraints) === jstr([
      { who: 'me', kind: 'tactic', id: 'bougin' },
      { who: 'me', kind: 'castle', id: 'funa' },
      { who: 'me', kind: 'strategy', id: 'ibisha' },
      { who: 'opp', kind: 'strategy', id: 'furibisha' },
      { who: 'opp', kind: 'tactic', id: 'shikenbisha' },
      { who: 'opp', kind: 'castle', id: 'mino' },
    ]) && p.selected === 'me.strategy' && p.showThreat === false,
      'hash-link:旧 matchup → pick 順の制約', jstr(p));
  }
  {
    // mo=0 は相手の制約を全部取り除く
    const p = HL.parseHash('v=matchup&ms=ibisha&mc=funa&os=furibisha&ot=shikenbisha&mo=0');
    ok(p.constraints.every(e => e.who === 'me'), 'hash-link:旧 mo=0 で相手を除去', jstr(p));
  }
  {
    // pick が空なら strategy,tactic,castle の順
    const p = HL.parseHash('ms=furibisha&mt=shikenbisha&mc=mino');
    ok(jstr(p.constraints) === jstr([
      { who: 'me', kind: 'strategy', id: 'furibisha' },
      { who: 'me', kind: 'tactic', id: 'shikenbisha' },
      { who: 'me', kind: 'castle', id: 'mino' },
    ]), 'hash-link:旧形式 pick 空は層の既定順', jstr(p));
  }
  // 往復: buildQuery → parseHash で同じ状態に戻る
  {
    const st = {
      view: 'board',
      constraints: [
        { who: 'opp', kind: 'strategy', id: 'furibisha' },
        { who: 'opp', kind: 'tactic', id: 'shikenbisha' },
        { who: 'me', kind: 'castle', id: 'funa' },
      ],
      selected: 'me.castle', clusterFamily: null,
    };
    const q = HL.buildQuery(st);
    const p = HL.parseHash(q);
    ok(q.includes('k=os:furibisha,ot:shikenbisha,mc:funa') && q.includes('sel=mc'),
      'hash-link:書き出しは新形式のみ', q);
    ok(jstr(p.constraints) === jstr(st.constraints) && p.selected === st.selected && p.view === st.view,
      'hash-link:ハッシュ往復で同じ状態', `${q} → ${jstr(p)}`);
  }
  {
    // クラスタ系統だけの往復
    const q = HL.buildQuery({ view: 'cluster', constraints: [], selected: 'me.castle', clusterFamily: 'yagura' });
    const p = HL.parseHash(q);
    ok(p.view === 'cluster' && p.clusterFamily === 'yagura', 'hash-link:cluster の往復', `${q} → ${jstr(p)}`);
  }
  {
    // showThreat=false は mw=0 で往復する
    const st = { view: 'board', constraints: [{ who: 'me', kind: 'castle', id: 'funa' }], selected: 'me.castle', showThreat: false };
    const q = HL.buildQuery(st);
    const p = HL.parseHash(q);
    ok(q.includes('mw=0') && p.showThreat === false, 'hash-link:showThreat の往復（mw=0）', `${q} → ${jstr(p)}`);
  }
}

// ---------- 8. §5 追加: placeTactics / miniWindow / evaluate のメモ ----------
{
  // placeTactics（S6 の共有純関数）: 列の規則・束ね・衝突処理・ドット
  {
    const TN = K.tacticNav;
    const mk = (id, files, square) => ({ id, lead: { files, square } });
    const a = TN.placeTactics([mk('t1', [4], '58')]);
    ok(a.cells.length === 1 && a.cells[0].col === 6 && a.cells[0].span === 1 && a.cells[0].row === 1,
      'placeTactics:自分は筋の反転列（4筋→col6）', jstr(a.cells));
    ok(TN.placeTactics([mk('t1', [4], '58')], { flip: true }).cells[0].col === 4,
      'placeTactics:相手は盤の絶対座標（4筋→col4）', '');
    const c = TN.placeTactics([mk('t1', [4], '58'), mk('t2', [4], '58'), mk('t3', [5], '55')]);
    ok(c.cells.length === 2 && c.cells[0].tactics.length === 2,
      'placeTactics:square で同じマスを1セルに束ねる', jstr(c.cells));
    // 衝突: 2筋に広がるセル（col4-5）と単筋のセル（col5）が重なると下の行へ送る
    const e = TN.placeTactics([mk('t1', [6, 5], '58'), mk('t2', [5], '55')]);
    ok(e.cells.length === 2 && e.cells[1].row === 2,
      'placeTactics:重なるセルは下の行へ', jstr(e.cells));
    ok(a.dots.length === 8 && a.dots.every(x => x.row === 1 && x.col >= 1 && x.col <= 9),
      'placeTactics:空き筋にドット', jstr(a.dots));
  }

  // miniWindow（サムネイルの固定窓）: 玉側の隅の 6筋×4段。中央寄りの囲いはずらす。flip は対角へ
  {
    const anaguma = K.CASTLES.find(x => x.id === 'anaguma');
    const pos = K.Position.fromCastle(anaguma, K.SETUPS[anaguma.setup]);
    const w = K.miniWindow(pos, 'ibisha');
    ok(w.f0 === 4 && w.f1 === 9 && w.r0 === 6 && w.r1 === 9,
      'miniWindow:居飛車は4-9筋×6-9段の固定窓', jstr(w));
    const wf = K.miniWindow(pos, 'ibisha', true);
    ok(wf.f0 === 1 && wf.f1 === 6 && wf.r0 === 1 && wf.r1 === 4,
      'miniWindow:flip は対角の隅', jstr(wf));
    // 全囲い: core 駒は全て窓の中に収まる（右玉・中住まいのようにずれる場合を含む）
    let allIn = true, detail = '';
    for (const c of K.CASTLES) {
      const p = K.Position.fromCastle(c, K.SETUPS[c.setup]);
      for (const flip of [false, true]) {
        const w2 = K.miniWindow(p, c.side, flip);
        const out = p.pieces.filter(x => x.role === 'core')
          .map(x => (flip ? { f: 10 - x.f, r: 10 - x.r } : x))
          .filter(x => x.f < w2.f0 || x.f > w2.f1 || x.r < w2.r0 || x.r > w2.r1);
        if (out.length) { allIn = false; detail = `${c.id}${flip ? '(flip)' : ''}: ${out.map(x => x.f + ',' + x.r).join(' ')}`; break; }
      }
      if (!allIn) break;
    }
    ok(allIn, 'miniWindow:全囲いのcore駒が窓に収まる（flip含む）', detail);
    const wsl = K.miniWindow(K.Position.fromCastle(K.CASTLES.find(x => x.id === 'migigyoku'), K.SETUPS.ibisha), 'ibisha');
    ok(wsl.f0 === 3 && wsl.f1 === 8, 'miniWindow:右玉は窓が1筋分ずれる', jstr(wsl));
  }

  // evaluate のメモ（S3/S4・R5 完了条件）: 同じ引数では judge の新規計算が0回
  {
    const list = [{ who: 'me', kind: 'strategy', id: 'ibisha' }];
    const r0 = K.constraints.evaluate(list, 'me', 'castle', 'funa');  // キャッシュを温める
    let n = 0;
    const orig = K.compat.judge;
    K.compat.judge = (...a2) => { n++; return orig(...a2); };
    const r1 = K.constraints.evaluate(list, 'me', 'castle', 'funa');
    K.compat.judge = orig;
    ok(r0 === r1 && n === 0, 'constraints:evaluate は同じ引数でキャッシュを返し judge を再計算しない', `judge ${n}回`);
  }
}

console.log(`---\n${pass + fail} tests, ${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
