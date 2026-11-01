// 単体テスト: compose / compat / matchup の両立判定を node で検査する（対局図 M2）
// 使い方: node shogi/tools/unit-test.js （失敗があれば終了コード1）
// マトリクスの意図した変更を記録: node shogi/tools/unit-test.js --update-matrix
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
if (!K.compose || !K.compose.build) {
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

const gin46Hidari = K.TACTICS.find(t => t.id === 'gin46-hidari');
ok(gin46Hidari && gin46Hidari.short === '4六銀左', 'notation:4六銀左 short label');
ok(K.notation.label(4, 6) === '4六', 'notation:ASCII file and kanji rank');

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
const matrixText = mlines.map(line => line.trimEnd()).join('\n') + '\n';
const matrixFile = path.join(ROOT, 'tools', 'expected-matrix.txt');
const updateMatrix = process.argv.includes('--update-matrix');
if (updateMatrix) {
  fs.writeFileSync(matrixFile, matrixText);
  pass++;
  console.log('PASS matrix:updated（tools/expected-matrix.txt を更新）');
} else if (!fs.existsSync(matrixFile)) {
  fs.writeFileSync(matrixFile, matrixText);
  pass++;
  console.log('PASS matrix:baseline-created（tools/expected-matrix.txt を作成。以降は照合される）');
} else {
  const expected = fs.readFileSync(matrixFile, 'utf8').replace(/\r\n/g, '\n');
  ok(expected === matrixText, 'matrix:snapshot', 'expected-matrix.txt と不一致（意図した変更ならファイルを消して再生成）');
}
if (!updateMatrix) console.log(matrixText);

// ---------- 2. §8-C 受け入れ: ng でない組み合わせに二歩と主役ずれが無い ----------
let c2 = 0, c2fail = [];
for (const t of K.TACTICS) {
  for (const c of K.CASTLES) {
    const j = K.compat.judge(meOf(t), 'castle', c.id);
    if (j.level === 'ng') continue;
    c2++;
    const res = K.compose.build({ strategy: sideOf(t), tacticId: t.id, castleId: c.id });
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
  const r = K.compose.build({ strategy: 'furibisha', castleId: 'katamino' });
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
  const r = K.compose.build({ strategy: 'furibisha', tacticId: 'shikenbisha', castleId: 'katamino' });
  const a58 = r.position.at(5, 8), a69 = r.position.at(6, 9);
  ok(!a58 || a58.p !== '金', 'compose:rest 四間飛車+片美濃でも5八に金が残らない',
    `5八=${a58 ? a58.p : '空'}`);
  ok(a69 && a69.p === '金', 'compose:rest 四間飛車+片美濃でも金は6九へ', `6九=${a69 ? a69.p : '空'}`);
}
{
  // 中飛車の飛58は戦法の主役（ロック）なので rest に動かされない
  const r = K.compose.build({ strategy: 'furibisha', tacticId: 'nakabisha', castleId: 'katamino' });
  const a58 = r.position.at(5, 8);
  ok(a58 && a58.p === '飛', 'compose:rest 中飛車の飛58（主役）は残る', `5八=${a58 ? a58.p : '空'}`);
}
{
  // 高美濃・銀冠・木村美濃も5八に金がいない（同じ美濃系の定義条件）
  for (const cid of ['takamino', 'gincan', 'kimuramino']) {
    const rr = K.compose.build({ strategy: 'furibisha', tacticId: 'shikenbisha', castleId: cid });
    const a = rr.position.at(5, 8);
    ok(!a || a.p !== '金', `compose:rest ${cid} でも5八に金が残らない`, `5八=${a ? a.p : '空'}`);
  }
}
{
  // 兜囲い: 盤上の角は持ち駒へ（hand:'角' と整合）。必須の角は動かせず HAND 衝突
  const r = K.compose.build({ strategy: 'ibisha', castleId: 'kabuto' });
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
      const res = K.compose.build({ strategy, tacticId: b.tacticId, castleId: c.id });
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
  // L3: 手数判定（reachPly）。届くものは置ける（ミレニアム・ビッグ4・松尾流・四枚美濃）
  const mc = K.pieceRules.reachPly;
  ok(mc('銀', '39', '88') === 5 && mc('銀', '39', '79') === 4 && mc('金', '49', '58') === 1,
    'reachPly:銀39→88=5手・39→79=4手・金49→58=1手', `${mc('銀', '39', '88')},${mc('銀', '39', '79')},${mc('金', '49', '58')}`);
  ok(mc('歩', '37', '36') === 1 && !isFinite(mc('歩', '37', '47')) && !isFinite(mc('歩', '37', '38')),
    'reachPly:歩は前だけ（横・後退は届かない）', `${mc('歩', '37', '36')},${mc('歩', '37', '47')},${mc('歩', '37', '38')}`);
  ok(!isFinite(mc('桂', '29', '28')) && mc('桂', '29', '37') === 1,
    'reachPly:桂は前だけ（後退は届かない）', `${mc('桂', '29', '28')},${mc('桂', '29', '37')}`);
  // 香は同じ筋の前方だけ（横・後退・斜めは届かない）。STEP 未定義で GOLD_STEP に落ちると
  // 別筋の香が donor に選ばれ、初期位置の香が盤面から消える（振り飛車穴熊の香99消失）の回帰
  ok(mc('香', '99', '98') === 1 && mc('香', '19', '18') === 1,
    'reachPly:香は同じ筋の前方へ届く', `${mc('香', '99', '98')},${mc('香', '19', '18')}`);
  ok(!isFinite(mc('香', '99', '18')) && !isFinite(mc('香', '19', '28')) && !isFinite(mc('香', '19', '29')),
    'reachPly:香は別の筋・後退・斜めへ届かない', `${mc('香', '99', '18')},${mc('香', '19', '28')},${mc('香', '19', '29')}`);
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
    const r = K.compose.build({ strategy: st, tacticId: tid, castleId: cid });
    const got = r.position.pieces.filter(x => x.p === '香').map(x => `${x.f}${x.r}`).sort().join(',');
    const handKyo = r.position.hand.filter(p => p === '香').length;
    ok(got === want.join(',') && handKyo === 0,
      `compose:香 ${tid}+${cid} 盤上=${want.join(',')} 持ち駒=0`,
      `盤上=${got} 持ち駒香=${handKyo}`);
  }
}
{
  // 玉は全8方向へ1手（STEP 未登録で GOLD_STEP に落ちると斜め後退が届かないと誤判定される。
  // 金との対比で玉専用の定義があることも確かめる）
  const mc = K.pieceRules.reachPly;
  const king1 = ['44', '54', '64', '45', '65', '46', '56', '66']
    .every(to => mc('玉', '55', to) === 1);
  ok(king1, 'reachPly:玉は全8方向へ1手（斜め後退ふくむ）',
    ['46', '66'].map(to => `${to}=${mc('玉', '55', to)}`).join(','));
  ok(mc('金', '55', '46') === 2 && mc('金', '55', '66') === 2,
    'reachPly:金の斜め後退は2手（玉と区別できる）',
    `46=${mc('金', '55', '46')},66=${mc('金', '55', '66')}`);
  // 銀の滑らせコスト: 斜め前は合法手なので罰則なし。真横・真後ろより安いこと
  const cst = K.piecePairing.slideCost;
  ok(cst('銀', '55', '46') != null && cst('銀', '55', '44') != null
    && cst('銀', '55', '46') < cst('銀', '55', '45'),
    'slideCost:銀の斜め前は罰則なし（真横より安い）',
    `46=${cst('銀', '55', '46')},44=${cst('銀', '55', '44')},45=${cst('銀', '55', '45')}`);
}
{
  // SHELL 注記: 殻の駒が届かないとき、黙って飛ばすのではなく conflicts に記録する
  // （ng にはしない。振り飛車穴熊の歩17 は、歩16 に進んだ四間飛車からは戻れない）
  const r = K.compose.build({ strategy: 'furibisha', tacticId: 'shikenbisha', castleId: 'furianaguma' });
  const shell = (r.conflicts || []).filter(c => c.code === 'SHELL');
  ok(shell.length === 1 && shell[0].squares[0] === '17',
    'compose:SHELL 歩16から歩17は置けず注記が出る', jstr(r.conflicts));
  const j = K.compat.judge({ strategy: 'furibisha', tacticId: 'shikenbisha' }, 'castle', 'furianaguma');
  ok(j.level !== 'ng' && j.reasons.some(x => x.code === 'SHELL'),
    'compat:SHELL は ng ではなく理由（注記）として残る', brief(j));
  const rMino = K.compose.build({ strategy: 'furibisha', tacticId: 'shikenbisha', castleId: 'mino' });
  ok(!(rMino.conflicts || []).some(c => c.code === 'SHELL'),
    'compose:SHELL 届く殻（本美濃の歩16）には注記が出ない', jstr(rMino.conflicts));
}
{
  // 右玉（migigyoku）: 桂37は桂29からしか来られないので、宣言局面は桂29を空けた
  // 専用の想定配置（ibisha37）で桂89・桂37の2枚にする（桂29＋桂37は初期配置から到達不能）
  const c = K.CASTLES.find(x => x.id === 'migigyoku');
  const pos = K.Position.fromCastle(c, K.SETUPS[c.setup]);
  const kei = pos.pieces.filter(x => x.p === '桂').map(x => `${x.f}${x.r}`).sort().join(',');
  ok(kei === '37,89', 'data:migigyoku の宣言局面は桂89・桂37（桂29は空く）', `盤上=${kei}`);
  const r = K.compose.build({ strategy: 'ibisha', tacticId: 'ibisha-base', castleId: 'migigyoku' });
  const kei2 = r.position.pieces.filter(x => x.p === '桂').map(x => `${x.f}${x.r}`).sort().join(',');
  ok(kei2 === '37,89', 'compose:migigyoku 合成後も桂89・桂37', `盤上=${kei2}`);
}

// ---------- 4. setSlot/setTactic（固定スロット）: 選んだものを他の層が勝手に差し替えない ----------
{
  const CS = K.constraints;
  const put = (sl, who, kind, id) => CS.setSlot(sl, who, kind, id);
  const base = put(put(CS.emptySlots(), 'me', 'tactic', 'shikenbisha'), 'me', 'castle', 'mino');
  // 振り飛車の戦法に居飛車穴熊: 戦法は差し替わらず、両立しない選択としてそのまま残る
  const r = put(base, 'me', 'castle', 'anaguma');
  ok(jstr(r.me.tactic) === jstr(['shikenbisha']) && r.me.castle === 'anaguma',
    'setSlot:両立しない選択でも他の層は差し替わらない', jstr(r));
  ok(base.me.castle === 'mino' && r !== base, 'setSlot:入力を書き換えず新しい slots を返す', jstr(base));
  ok(put(base, 'me', 'castle', 'mino') === base, 'setSlot:同じ値は入力の参照を返す');
  ok(put(base, 'me', 'castle', 'no-such') === base && put(base, 'me', 'castle', 'constructor') === base
    && put(base, 'me', 'strategy', 'furibisha') === base,
  'setSlot:存在しない id・層（constructor・strategy）は無視する');
  ok(put(base, 'me', 'castle', null).me.castle === null && jstr(put(base, 'me', 'castle', null).me.tactic) === jstr(['shikenbisha']),
    'setSlot:null でそのスロットだけ外す');
  const both = put(base, 'opp', 'castle', 'funa');
  const cleared = CS.clearSide(both, 'me');
  ok(cleared.me.tactic === null && cleared.me.castle === null && cleared.opp.castle === 'funa'
    && CS.clearSide(cleared, 'me') === cleared, 'clearSide:その側だけ外し、空なら参照を返す', jstr(cleared));
  ok(jstr(CS.normalizeSlots({ me: { tactic: 'bougin', castle: 'zzz' }, opp: { tactic: 5 } }))
    === jstr({ me: { tactic: ['bougin'], castle: null }, opp: { tactic: null, castle: null } }),
  'normalizeSlots:不正な id・型は未選択に戻す');
  ok(jstr(CS.normalizeSlots(null)) === jstr(CS.emptySlots()), 'normalizeSlots:null は空のスロット');
  // 戦法スロットは駒ごと1枠: 同じ駒（銀）の戦法は差し替わり、違う駒（角）は共存する
  const t2 = CS.setTactic(base, 'me', 'koshikakegin');
  ok(jstr(t2.me.tactic) === jstr(['shikenbisha', 'koshikakegin']),
    'setTactic:違う駒の戦法は追加される（共存）', jstr(t2.me.tactic));
  const t3 = CS.setTactic(t2, 'me', 'bougin');
  ok(jstr(t3.me.tactic) === jstr(['shikenbisha', 'bougin']),
    'setTactic:同じ駒（銀）の戦法はその枠だけ差し替わる', jstr(t3.me.tactic));
  const t4 = CS.removeTactic(t3, 'me', 'shikenbisha');
  ok(jstr(t4.me.tactic) === jstr(['bougin']) && CS.removeTactic(t4, 'me', 'bougin').me.tactic === null,
    'removeTactic:その戦法だけ外す（他の枠は残る）', jstr(t4.me.tactic));
  ok(CS.setTactic(base, 'me', 'no-such') === base && CS.removeTactic(base, 'me', 'bougin') === base,
    'setTactic/removeTactic:存在しない id は入力の参照を返す');
  // 実効状態: 複数戦法は tacticIds に全て（主の戦法=飛車は primaryOf で導く導出値）
  const S2 = CS.effectiveSides(t3, false);
  ok(jstr(S2.me.tacticIds) === jstr(['shikenbisha', 'bougin']) && K.defaults.primaryOf(S2.me) === 'shikenbisha'
    && S2.me.tacticId === undefined,
    'sides:複数戦法は tacticIds に全て・主（飛車）は primaryOf で導く', jstr(S2.me));

  // 両立しない選択は conflicts が理由つきで返し、suggest が直す候補を返す
  const S = CS.effectiveSides(r, false);
  const cf = CS.conflicts(r, S, false);
  ok(cf.me.castle && cf.me.castle.some(x => x.code === 'SIDE') && cf.opp.castle === undefined,
    'conflicts:居飛車穴熊×四間飛車は SIDE の理由つきで ng', jstr(cf));
  const sg = CS.suggest(r, false, 'me', 'castle');
  ok(sg.length > 0 && sg.length <= 6 && sg.includes('mino') && !sg.includes('anaguma'),
    'suggest:両立する囲いを返す（現在の選択は含まない）', jstr(sg));
  ok(sg.every(id => CS.evaluate(r, false, 'me', 'castle', id).j.level !== 'ng'),
    'suggest:候補はすべて ng でない');
  ok(sg.indexOf('mino') <= sg.indexOf('katamino') || !sg.includes('katamino'),
    'suggest:相性表の◎（美濃）は先に並ぶ', jstr(sg));
  // 戦法の suggest は同じ駒の枠の中から選ぶ（他の駒の枠は対象外）
  const sgT = CS.suggest(t3, false, 'me', 'tactic', 6, 'bougin');
  ok(sgT.length > 0 && sgT.every(id => {
    const t = K.TACTICS.find(x => x.id === id);
    return t && t.lead && t.lead.piece === '銀' && id !== 'bougin';
  }), 'suggest:戦法の候補は同じ駒（銀）の戦法だけ', jstr(sgT));
  const none = CS.conflicts(base, CS.effectiveSides(base, false), false);
  ok(!Object.keys(none.me.tactic).length && !none.me.castle, 'conflicts:両立する組み合わせは空', jstr(none));
  // 両立しない戦法だけが id つきで ng に上がる（複数採用で片方だけ悪い場合）
  const bad2 = put(put(CS.emptySlots(), 'me', 'tactic', 'sodebisha'), 'me', 'castle', 'mino');
  const mix = CS.setTactic(bad2, 'me', 'sujichigaikaku');   // 袖飛車が角77を固定→筋違角の角45が置けない
  const cf2 = CS.conflicts(mix, CS.effectiveSides(mix, false), false);
  ok(cf2.me.tactic.sodebisha && cf2.me.tactic.sodebisha.some(x => x.code === 'KING_ROOK')
    && cf2.me.tactic.sujichigaikaku && cf2.me.tactic.sujichigaikaku.every(x => x.code !== 'KING_ROOK'),
    'conflicts:複数戦法では衝突した戦法の id だけが ng（玉飛接近は袖飛車のみ）', jstr(cf2));
  // 両立する複数戦法は ng が上がらない
  const okMix = CS.setTactic(CS.setTactic(put(CS.emptySlots(), 'me', 'castle', 'yagura'), 'me', 'sujichigaikaku'), 'me', 'bougin');
  const cf3 = CS.conflicts(okMix, CS.effectiveSides(okMix, false), false);
  ok(!Object.keys(cf3.me.tactic).length && !cf3.me.castle,
    'conflicts:両立する複数戦法（筋違角+棒銀×矢倉）は空', jstr(cf3));
  // 表示していない相手は評価しない
  const hid = CS.conflicts(put(r, 'opp', 'castle', 'anaguma'), CS.effectiveSides(put(r, 'opp', 'castle', 'anaguma'), false), false);
  ok(!Object.keys(hid.opp.tactic).length && hid.opp.castle === undefined, 'conflicts:表示していない相手は対象外', jstr(hid));
  // 複数戦法の合成: 副戦法の必須の駒も盤上に現れる
  const r2 = K.compose.build({ strategy: 'ibisha', tacticIds: ['sujichigaikaku', 'bougin'], castleId: 'yagura' });
  const has45 = r2.position.at(4, 5), has26 = r2.position.at(2, 6), has28 = r2.position.at(2, 8);
  ok(has45 && has45.p === '角' && has26 && has26.p === '銀' && has28 && has28.p === '飛' && !r2.conflicts.length,
    'compose:複数戦法の必須の駒（角45・銀26・飛28）が両方置かれる',
    `4五=${has45 ? has45.p : '空'} 2六=${has26 ? has26.p : '空'} 2八=${has28 ? has28.p : '空'} cf=${jstr(r2.conflicts)}`);
  console.log(`  setSlot 結果: ${jstr(r)}\n  conflicts: ${jstr(cf.me.castle)}\n  suggest: ${jstr(sg)}`);
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

// ---------- 6. constraints: sides / conflicts / evaluate / labels（計画書 §1 / §3-2） ----------
if (!K.constraints || !K.constraints.effectiveSides || !K.constraints.setSlot || !K.constraints.conflicts) {
  ok(false, 'constraints: Kakoi.constraints が未定義', 'js/core/constraints.js を確認');
} else {
  const CS = K.constraints, FIELD = CS.FIELD, KINDS = CS.KINDS;
  // slots の簡易生成: mk(自分の戦法, 自分の囲い, 相手の戦法, 相手の囲い)。
  // 戦法スロットは駒ごとの枠: 単独 id は配列にする（複数なら配列で渡す）
  const tarr = t => t == null ? null : (Array.isArray(t) ? t : [t]);
  const mk = (mt = null, mc = null, ot = null, oc = null) =>
    ({ me: { tactic: tarr(mt), castle: mc }, opp: { tactic: tarr(ot), castle: oc } });

  // sides: 戦略の導出と暗黙の補完
  {
    const s = CS.effectiveSides(mk(null, 'funa'));
    ok(s.me.castleId === 'funa' && s.me.strategy === 'ibisha' && K.defaults.primaryOf(s.me) === 'ibisha-base',
      'constraints:sides 囲いだけ→戦略は囲いの側・戦法は既定値で補完', jstr(s.me));
    ok(s.me.implied.tactic === true && !s.me.implied.castle && !s.me.implied.strategy,
      'constraints:sides implied フラグ（戦法だけが暗黙。戦略は層ではない）', jstr(s.me.implied));
    ok(s.opp && s.opp.strategy === 'ibisha' && s.opp.implied.tactic && s.opp.implied.castle,
      'constraints:sides 相手側も常に実効値を持つ（既定値で補う）', jstr(s.opp));
  }
  {
    // 戦法だけ指定 → 戦略は戦法の系統の side（振り飛車の戦法なら furibisha）
    const s = CS.effectiveSides(mk(null, null, 'shikenbisha'));
    ok(s.opp.strategy === 'furibisha' && !s.opp.implied.tactic && s.opp.implied.castle,
      'constraints:sides 戦略を戦法の系統から導出', jstr(s.opp));
    ok(s.opp.castleId === 'mino', 'constraints:sides 既定囲い（furibisha の既定は mino）', jstr(s.opp));
    // 戦法があれば囲いより戦法が戦略を決める（囲いは明示のまま残る）
    const t = CS.effectiveSides(mk('bougin', 'mino'));
    ok(t.me.strategy === 'ibisha' && t.me.castleId === 'mino' && !t.me.implied.castle,
      'constraints:sides 戦略は戦法が決め、明示した囲いは差し替えない', jstr(t.me));
    // 囲いだけなら囲いの側から導く（美濃→振り飛車の既定戦法）
    const u = CS.effectiveSides(mk(null, 'mino'));
    ok(u.me.strategy === 'furibisha' && K.defaults.primaryOf(u.me) === 'shikenbisha',
      'constraints:sides 囲いだけ（美濃）→ 戦略 furibisha・既定戦法で補完', jstr(u.me));
  }
  {
    // 既定囲いの vsIbisha/vsFuribisha 振り分け: 相手が振り飛車なら vsFuribisha。相手を表示しないときは vsIbisha
    const s = CS.effectiveSides(mk('ibisha-base', null, 'shikenbisha'));
    ok(s.me.castleId === 'funa', 'constraints:sides ibisha の既定囲いは対振り用 funa', jstr(s.me));
    const s2 = CS.effectiveSides(mk('ibisha-base', null, 'ibisha-base'));
    ok(s2.me.castleId === 'yagura', 'constraints:sides ibisha の既定囲いは相居飛車用 yagura', jstr(s2.me));
    const s3 = CS.effectiveSides(mk('ibisha-base', null, 'shikenbisha'), false);
    ok(s3.me.castleId === 'yagura', 'constraints:sides 相手を表示しないなら相手の戦略で振り分けない', jstr(s3.me));
  }
  {
    // 戦略の導出は決定的で、入力の slots を書き換えない
    const sl = mk('koshikakegin', null, 'mukaibisha', 'mino');
    const before = jstr(sl);
    ok(jstr(CS.effectiveSides(sl)) === jstr(CS.effectiveSides(sl)) && jstr(sl) === before,
      'constraints:sides は決定的で入力を変更しない', before);
  }

  // 選択の文字列表現と握り直し（戦法は第3要素に駒枠の id を持てる）
  ok(jstr(CS.parseSel('opp.tactic')) === jstr({ who: 'opp', kind: 'tactic' })
    && jstr(CS.parseSel('me.strategy')) === jstr({ who: 'me', kind: 'strategy' })
    && jstr(CS.parseSel('me.tactic.bougin')) === jstr({ who: 'me', kind: 'tactic', id: 'bougin' })
    && jstr(CS.parseSel('me.senkei.kakugawari')) === jstr({ who: 'me', kind: 'senkei', id: 'kakugawari' })
    && CS.parseSel('me.bogus') === null,
    'constraints:parseSel は tactic/castle/strategy/senkei（戦型は情報を見る選択）と戦法の駒枠 id を受ける');
  ok(CS.normalizeSelected('opp.castle', false) === 'me.castle' && CS.normalizeSelected('opp.castle', true) === 'opp.castle'
    && CS.normalizeSelected('opp.tactic.bougin', true) === 'opp.tactic.bougin'
    && CS.normalizeSelected('opp.tactic.bougin', false) === 'me.tactic'
    && CS.normalizeSelected('opp.strategy', false) === 'me.strategy'
    && CS.normalizeSelected('opp.senkei.yagura', false) === 'me.senkei'
    && CS.normalizeSelected('me.senkei.taikou-shiken', true) === 'me.senkei.taikou-shiken'
    && CS.normalizeSelected(null, false, 'tactic') === 'me.tactic' && CS.normalizeSelected('zzz', true) === 'me.castle',
  'constraints:normalizeSelected は相手が非表示なら自分側へ・不正は fallback の層へ');

  // labels（§1-4）: 戦型ラベルの代表例
  {
    const L = (a, b) => { const S = CS.effectiveSides(a); return CS.senkeiLabels(S.me, S.opp); };
    ok(CS.senkeiLabels(CS.effectiveSides(mk('ibisha-base')).me, null).length === 0, 'constraints:labels 相手を表示しないなら空');
    const taikou = L(mk('ibisha-base', null, 'shikenbisha'));
    ok(taikou.some(x => x.label === '対抗形'), 'constraints:labels 対抗形', jstr(taikou));
    const aifuri = L(mk('shikenbisha', null, 'sankenbisha'));
    ok(aifuri.some(x => x.id === 'aifuri' && x.label === '相振り飛車'), 'constraints:labels 相振り飛車', jstr(aifuri));
    // 角換わり: 両者居飛車＋両戦法の持ち駒に角（腰掛け銀）。決定木は排他的で
    // senkei 系のラベルは1つだけ出る（腰掛け銀どうしなら角換わりだけ。L9 / §2-1）
    const kakugawari = L(mk('koshikakegin', null, 'koshikakegin'));
    ok(kakugawari.length === 2 && kakugawari[1].id === 'kakugawari',
      'constraints:labels 角換わりは排他（戦型ラベルは1つ）', jstr(kakugawari));
    // 横歩取り: 両者の戦法が yokofudori タグを持つ（相掛かりタグより先に判定される）
    const yoko = L(mk('yokofudori', null, 'aonoryu'));
    ok(yoko.length === 2 && yoko[1].id === 'yokofudori',
      'constraints:labels 横歩取り（yokofudori タグ両者）', jstr(yoko));
    // ひねり飛車は相掛かり系（yokofudori は持たない）: 囲いを雁木判定外のものに
    // 揃えたミラーなら、決定木の最後まで進んで相掛かりと出る
    const hineri = L(mk('hineribisha', 'kani', 'hineribisha', 'kani'));
    ok(hineri.length === 2 && hineri[1].id === 'aigakari',
      'constraints:labels ひねり飛車のミラーは相掛かり', jstr(hineri));
    // 矢倉系が両者なら相矢倉、片方だけなら矢倉
    const aiyagura = L(mk(null, 'yagura', null, 'ginyagura'));
    ok(aiyagura.length === 2 && aiyagura[1].id === 'aiyagura',
      'constraints:labels 相矢倉（両者矢倉系）', jstr(aiyagura));
    const yagura = L(mk(null, 'yagura', null, 'funa'));
    ok(yagura.length === 2 && yagura[1].id === 'yagura',
      'constraints:labels 矢倉（片方だけ）', jstr(yagura));
    // 雁木: カニ・兜は refFamily があるので雁木と判定しない。本物の雁木では出る
    const gangiNg = L(mk(null, 'kani', null, 'kabuto'));
    ok(gangiNg.length === 1, 'constraints:labels カニ・兜は雁木と出ない', jstr(gangiNg));
    const gangi = L(mk(null, 'gangi', null, 'kani'));
    ok(gangi.length === 2 && gangi[1].id === 'gangi',
      'constraints:labels 雁木（片方が本物の雁木）', jstr(gangi));
  }

  // labels の細分類（§3-3 Phase 1）: 対抗形の種類×方針×型・相振りの筋・力戦。
  // 明示層が優先で、決まらなければ既定値（implied）込みの第2パス。葉は大分類と合わせて2枚まで
  {
    const L = a => { const S = CS.effectiveSides(a); return CS.senkeiLabels(S.me, S.opp); };
    const leaf = l => l[l.length - 1];
    const isLeaf = (l, id, label, extra = '') => l.length === 2 && leaf(l).id === id && leaf(l).label === label && extra;
    // 対抗形: 振り飛車の筋（rook）× 居飛車側の方針（approach）
    ok(isLeaf(L(mk('bougin', null, 'shikenbisha')), 'taikou-shiken', '対四間飛車・急戦',
      leaf(L(mk('bougin', null, 'shikenbisha'))).sub.id === 'kyusen'),
      'constraints:labels 棒銀×四間飛車 → 対四間飛車・急戦', jstr(L(mk('bougin', null, 'shikenbisha'))));
    ok(isLeaf(L(mk('yamada-jouseki', null, 'shikenbisha')), 'taikou-shiken', '対四間飛車・急戦', true),
      'constraints:labels 山田定跡×四間飛車 → 対四間飛車・急戦', jstr(L(mk('yamada-jouseki', null, 'shikenbisha'))));
    ok(isLeaf(L(mk(null, 'anaguma', 'shikenbisha')), 'taikou-shiken', '対四間飛車・持久戦',
      leaf(L(mk(null, 'anaguma', 'shikenbisha'))).sub.id === 'jikyusen'),
      'constraints:labels 居飛車穴熊（囲い）×四間飛車 → 対四間飛車・持久戦', jstr(L(mk(null, 'anaguma', 'shikenbisha'))));
    ok(isLeaf(L(mk(null, 'hidarimino', 'fujiisystem')), 'taikou-shiken', '対四間飛車・持久戦', true),
      'constraints:labels 左美濃×藤井システム → 対四間飛車・持久戦', jstr(L(mk(null, 'hidarimino', 'fujiisystem'))));
    ok(isLeaf(L(mk('chousoku37gin', null, 'gokigen')), 'taikou-naka', '対中飛車・急戦', true),
      'constraints:labels 超速▲3七銀×ゴキゲン中飛車 → 対中飛車・急戦', jstr(L(mk('chousoku37gin', null, 'gokigen'))));
    ok(isLeaf(L(mk(null, 'anaguma', 'sankenbisha')), 'taikou-sanken', '対三間飛車・持久戦', true),
      'constraints:labels 居飛車穴熊×三間飛車 → 対三間飛車・持久戦', jstr(L(mk(null, 'anaguma', 'sankenbisha'))));
    ok(isLeaf(L(mk('ibisha-base', null, 'mukaibisha')), 'taikou-mukai', '対向かい飛車',
      !leaf(L(mk('ibisha-base', null, 'mukaibisha'))).sub),
      'constraints:labels 居飛車（2筋）×向かい飛車 → 方針は未決定なので付かない', jstr(L(mk('ibisha-base', null, 'mukaibisha'))));
    // 九間・一間は振り飛車の種類に含めない（ROOK_KIND 外）→ 大分類だけ
    ok(L(mk(null, 'funa', 'kyukenbisha')).length === 1,
      'constraints:labels 居飛車×九間飛車 → #対抗形 のみ', jstr(L(mk(null, 'funa', 'kyukenbisha'))));
    // 自分が振り飛車側でも同じ軸（対抗形は側をまたいだ葉）
    ok(isLeaf(L(mk('shikenbisha', null, 'bougin')), 'taikou-shiken', '対四間飛車・急戦', true),
      'constraints:labels 四間飛車×棒銀（自分が振り飛車）→ 対四間飛車・急戦', jstr(L(mk('shikenbisha', null, 'bougin'))));
    // 角交換振り飛車（style 軸）は筋の種類と併記する
    {
      const l = L(mk('direct-mukaibisha', null, 'bougin'));
      ok(leaf(l).id === 'taikou-mukai' && leaf(l).label === '対向かい飛車・急戦・角交換'
        && leaf(l).style && leaf(l).style.id === 'kakukoukan-furi',
        'constraints:labels 角交換振り飛車は別軸で併記', jstr(l));
    }
    // 相振り飛車: 両側の筋が同じなら専用エントリ、違う筋は自由文、取れない筋は相振りだけ
    ok(isLeaf(L(mk('nakabisha', null, 'nakabisha')), 'ai-naka', '相中飛車', true),
      'constraints:labels 中飛車×中飛車 → 相中飛車', jstr(L(mk('nakabisha', null, 'nakabisha'))));
    ok(isLeaf(L(mk('sankenbisha', null, 'sankenbisha')), 'ai-sanken', '相三間飛車', true),
      'constraints:labels 三間飛車×三間飛車 → 相三間飛車', jstr(L(mk('sankenbisha', null, 'sankenbisha'))));
    ok(isLeaf(L(mk('shikenbisha', null, 'shikenbisha')), 'aifuri', '相四間飛車', true),
      'constraints:labels 四間飛車×四間飛車 → 自由文「相四間飛車」（id は親の aifuri）', jstr(L(mk('shikenbisha', null, 'shikenbisha'))));
    ok(isLeaf(L(mk('sankenbisha', null, 'mukaibisha')), 'aifuri', '三間飛車×向かい飛車', true),
      'constraints:labels 三間飛車×向かい飛車 → 自由文ラベル', jstr(L(mk('sankenbisha', null, 'mukaibisha'))));
    // 力戦: 両側が戦法を明示していてもどの戦型にも当たらないときだけ（点線の implied。既定値だけでは出ない）
    {
      const l = L(mk('kamaitachi', null, 'gyokutou-kuraidori'));
      ok(leaf(l).id === 'rikisen' && leaf(l).implied === true,
        'constraints:labels 明示しても戦型に当たらない → 力戦（implied で点線）', jstr(l));
      const l2 = L(mk('kyukenbisha', null, 'ikkenbisha'));
      ok(leaf(l2).id === 'rikisen' && l2.length === 2,
        'constraints:labels 相振りで筋が取れない → 力戦', jstr(l2));
      ok(L(mk(null, 'kani', null, 'kabuto')).length === 1,
        'constraints:labels 既定値だけの状態では力戦を出さない', jstr(L(mk(null, 'kani', null, 'kabuto'))));
    }
    // implied パス: 囲いだけ明示した対抗形でも葉は導ける
    {
      const l = L(mk(null, null, 'shikenbisha'));
      ok(l.length === 2 && leaf(l).id === 'taikou-shiken' && leaf(l).label === '対四間飛車',
        'constraints:labels 相手の明示戦法だけでも振り飛車の種類が出る', jstr(l));
    }
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

  // deriveBoard: 相手の表示 OFF なら後手・脅威・ラベルを出さない。ON なら両側を合成する
  {
    const sl = mk('ibisha-base', 'yagura', 'shikenbisha', 'mino');
    const off = K.deriveBoard(sl, false), on = K.deriveBoard(sl, true);
    ok(off.oppPos === null && off.threat === null && off.labels.length === 0
      && !off.merged.position.pieces.some(x => x.owner === 'gote'),
    'deriveBoard:相手 OFF は後手の駒・脅威・ラベルなし', jstr(off.labels));
    ok(on.oppPos && on.threat && on.labels.length > 0 && on.merged.position.pieces.some(x => x.owner === 'gote'),
      'deriveBoard:相手 ON は両側を合成', '');
    ok(jstr(off.S.opp) === jstr(CS.effectiveSides(sl, false).opp), 'deriveBoard:S は相手 OFF でも opp を持つ', '');
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
    const tIds = K.TACTICS.map(t => t.id), cIds = K.CASTLES.map(c => c.id);
    const candsOf = k => k === 'tactic' ? tIds : cIds;
    // 実効値（FIELD は単一値を持つ層＝castle だけ。戦法は主の戦法を primaryOf で導く）
    const effId = (st, k) => k === 'tactic' ? K.defaults.primaryOf(st) : st[FIELD[k]];
    // その層に「いまの値以外で両立する候補」があるか（暗黙の層が飽和しているかの判定用。
    // 例: 早石田のように玉を囲わずに仕掛ける戦法は、両立する囲いが1つも無い）
    const hasAlternative = (st, k, opp) =>
      candsOf(k).some(id => id !== effId(st, k) && K.compat.judge(st, k, id, opp).level !== 'ng');
    let slots = CS.emptySlots(), showOpp = true, touched = 0, mutated = 0, nondet = 0, sugBad = 0, sugCount = 0;
    const ngLeft = [];
    for (let i = 0; i < 1000; i++) {
      const who = rnd() < 0.5 ? 'me' : 'opp';
      const kind = KINDS[Math.floor(rnd() * KINDS.length)];
      const roll = rnd();
      const id = roll < 0.15 ? null : candsOf(kind)[Math.floor(rnd() * candsOf(kind).length)];
      if (rnd() < 0.1) showOpp = !showOpp;
      const before = jstr(slots);
      const next = CS.setSlot(slots, who, kind, id);
      if (jstr(slots) !== before) mutated++;                 // setSlot は入力を変えない
      // 変わってよいのは操作したスロットだけ（他の層・他の側を勝手に差し替えない）
      // 戦法は駒ごとの枠: 値の配列として等しいかで見る（参照の更新自体は起きる）
      for (const w of ['me', 'opp']) for (const k of KINDS) {
        if (w === who && k === kind) continue;
        if (jstr(next[w][k] || null) !== jstr(slots[w][k] || null)) touched++;
      }
      slots = next;
      const S = CS.effectiveSides(slots, showOpp);
      if (jstr(S) !== jstr(CS.effectiveSides(slots, showOpp))) nondet++;
      // 明示した層はそのまま、暗黙の層が ng になるのは両立する候補が無い（飽和）ときだけ
      for (const w of ['me', 'opp']) {
        const st = S[w];
        const opp = w === 'me' ? (showOpp ? S.opp : null) : S.me;
        for (const k of KINDS) {
          const slotVal = k === 'tactic' ? (slots[w].tactic || []) : slots[w][k];
          const effVal = k === 'tactic' ? st.tacticIds : st[FIELD[k]];
          if (k === 'tactic' ? slotVal.length : slotVal != null) {
            if (jstr(effVal) !== jstr(k === 'tactic' ? slotVal : slotVal)) touched++;
            continue;
          }
          if (K.compat.judge(st, k, effId(st, k), opp).level === 'ng' && hasAlternative(st, k, opp) && ngLeft.length < 5) {
            ngLeft.push(`i=${i} ${w}.${k}=${effId(st, k)} slots=${jstr(slots)}`);
          }
        }
      }
      // 両立しない明示選択には、直す候補（ng でないもの）が返る（候補があるときだけ検証）
      if (i % 20 === 0) {
        const S2 = CS.effectiveSides(slots, showOpp), cf = CS.conflicts(slots, S2, showOpp);
        for (const w of ['me', 'opp']) for (const k of KINDS) {
          const ids = k === 'tactic' ? Object.keys(cf[w].tactic || {}) : (cf[w][k] ? [slots[w][k]] : []);
          for (const tid of ids) {
            sugCount++;
            const sg = CS.suggest(slots, showOpp, w, k, 6, tid);
            if (sg.some(c => CS.evaluate(slots, showOpp, w, k, c).j.level === 'ng')) sugBad++;
          }
        }
      }
    }
    ok(touched === 0, 'constraints:無作為1000操作で他のスロットが勝手に変わらない', `${touched} 件`);
    ok(mutated === 0, 'constraints:setSlot は入力の slots を変更しない', `${mutated} 件`);
    ok(nondet === 0, 'constraints:sides は決定的（1000回）', `${nondet} 件`);
    ok(ngLeft.length === 0, `constraints:無作為1000操作で「解があるのに既定の層が ng」0件`, ngLeft.join(' / '));
    ok(sugBad === 0, `constraints:suggest は ng の候補を返さない（検査 ${sugCount} 件）`, `${sugBad} 件`);
  }
}

// ---------- 7. hash-link: k=/opp=/sel= の読み書き（盤面は URL ハッシュだけが正） ----------
{
  const HL = K.hashLink;
  ok(HL && HL.parseHash && HL.buildQuery, 'hash-link: parseHash/buildQuery がある');
  const tarr = t => t == null ? null : (Array.isArray(t) ? t : [t]);
  const mk = (mt = null, mc = null, ot = null, oc = null) =>
    ({ me: { tactic: tarr(mt), castle: mc }, opp: { tactic: tarr(ot), castle: oc } });

  {
    const p = HL.parseHash('k=ot:shikenbisha,mc:funa&opp=1&sel=mc');
    ok(jstr(p.slots) === jstr(mk(null, 'funa', 'shikenbisha')) && p.showOpp === true && p.selected === 'me.castle',
      'hash-link:k=/opp=/sel= の読み取り', jstr(p));
  }
  {
    // 空・旧形式（k=/opp= が無い、s 層や v= の付いた形）は初期状態で開く
    const init = { slots: mk(), showOpp: false, selected: null, view: 'board', tesujiId: null };
    ok(jstr(HL.parseHash('')) === jstr(init), 'hash-link:空のハッシュは初期状態', jstr(HL.parseHash('')));
    ok(jstr(HL.parseHash('v=castle&c=yagura&t=bougin')) === jstr(init), 'hash-link:旧 castle/tactic 形式は初期状態');
    ok(jstr(HL.parseHash('v=matchup&ms=ibisha&mc=funa&os=furibisha')) === jstr(init), 'hash-link:旧 matchup 形式は初期状態');
    // 旧 k= の戦略層（s）・不正な id は黙って捨てる。sel=ms は「戦型を見る選択」として有効
    const p = HL.parseHash('v=board&k=os:furibisha,ms:ibisha,mt:bougin,mc:nope&sel=ms');
    ok(jstr(K.constraints.normalizeSlots(p.slots)) === jstr(mk('bougin')) && p.selected === 'me.strategy' && p.showOpp === false,
      'hash-link:k= の s 層・不正な id は捨てる（sel の s は有効）', jstr(p));
  }
  // 往復: buildQuery → parseHash で同じ状態に戻る
  {
    const st = { slots: mk('bougin', 'funa', 'shikenbisha', 'mino'), showOpp: true, selected: 'opp.tactic' };
    const q = HL.buildQuery(st);
    const p = HL.parseHash(q);
    ok(q === 'k=mt:bougin,mc:funa,ot:shikenbisha,oc:mino&opp=1&sel=ot', 'hash-link:書き出しの形式（v= も s 層も無い）', q);
    ok(jstr(p.slots) === jstr(st.slots) && p.showOpp === true && p.selected === 'opp.tactic',
      'hash-link:ハッシュ往復で同じ状態', `${q} → ${jstr(p)}`);
  }
  {
    // 初期状態のハッシュは空（リセット＝ハッシュを空にする）。相手の表示だけでも書く
    ok(HL.buildQuery({ slots: mk(), showOpp: false, selected: 'me.tactic' }) === '', 'hash-link:初期状態は空のハッシュ');
    const q = HL.buildQuery({ slots: mk(), showOpp: true, selected: 'opp.castle' });
    ok(q === 'opp=1&sel=oc' && HL.parseHash(q).showOpp === true, 'hash-link:相手の表示だけの往復', q);
    const qs = HL.buildQuery({ slots: mk(), showOpp: true, selected: 'me.strategy' });
    ok(qs === 'opp=1&sel=ms' && HL.parseHash(qs).selected === 'me.strategy',
      'hash-link:戦型の選択も往復できる', qs);
  }
  {
    // tj= は「手筋と格言」の全画面モード。盤面のパラメータと併記でき、往復でも戻る
    const p = HL.parseHash('k=mc:funa&opp=1&tj=otebisha');
    ok(p.view === 'tesuji' && p.tesujiId === 'otebisha' && p.showOpp === true
      && jstr(p.slots) === jstr(mk(null, 'funa')),
      'hash-link:tj= で手筋モード＋盤面を読む', jstr(p));
    ok(HL.parseHash('tj').view === 'tesuji' && HL.parseHash('tj').tesujiId === null,
      'hash-link:tj（値なし）も手筋モード（記事は先頭）');
    const q = HL.buildQuery({ slots: mk(null, 'funa'), showOpp: false, selected: null,
      view: 'tesuji', tesujiId: 'otebisha' });
    ok(q === 'k=mc:funa&tj=otebisha' && HL.parseHash(q).view === 'tesuji',
      'hash-link:tj= の書き出しと往復', q);
    ok(HL.buildQuery({ slots: mk(), showOpp: false, selected: null, view: 'tesuji', tesujiId: null }) === 'tj=',
      'hash-link:記事の無い手筋モードは tj= だけ書く');
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

  // miniWindow（サムネイルの窓）: core 駒の外接矩形を最小 5筋×3段まで広げる。端・自陣の奥へ先に広げる。flip は対角へ
  {
    const anaguma = K.CASTLES.find(x => x.id === 'anaguma');
    const pos = K.Position.fromCastle(anaguma, K.SETUPS[anaguma.setup]);
    const w = K.miniWindow(pos, 'ibisha');
    ok(w.f0 === 5 && w.f1 === 9 && w.r0 === 7 && w.r1 === 9,
      'miniWindow:居飛車穴熊は5-9筋×7-9段（玉側の隅まで）', jstr(w));
    const wf = K.miniWindow(pos, 'ibisha', true);
    ok(wf.f0 === 1 && wf.f1 === 5 && wf.r0 === 1 && wf.r1 === 3,
      'miniWindow:flip は対角の隅', jstr(wf));
    const small = K.CASTLES.every(c => [false, true].every(flip => {
      const x = K.miniWindow(K.Position.fromCastle(c, K.SETUPS[c.setup]), c.side, flip);
      return x.f1 - x.f0 + 1 >= 5 && x.r1 - x.r0 + 1 >= 3 && x.f0 >= 1 && x.f1 <= 9 && x.r0 >= 1 && x.r1 <= 9;
    }));
    ok(small, 'miniWindow:全囲いで窓は5筋×3段以上・盤の内側', '');
    // 全囲い: core 駒は全て窓の中に収まる（右玉・中住まいのようにずれる場合を含む）
    let allIn = true, detail = '';
    for (const c of K.CASTLES) {
      const p = K.Position.fromCastle(c, K.SETUPS[c.setup]);
      for (const flip of [false, true]) {
        const w2 = K.miniWindow(p, c.side, flip);
        const out = p.pieces.filter(x => x.role === 'core')
          .map(x => (flip ? K.notation.mirrorPt(x) : x))
          .filter(x => x.f < w2.f0 || x.f > w2.f1 || x.r < w2.r0 || x.r > w2.r1);
        if (out.length) { allIn = false; detail = `${c.id}${flip ? '(flip)' : ''}: ${out.map(x => x.f + ',' + x.r).join(' ')}`; break; }
      }
      if (!allIn) break;
    }
    ok(allIn, 'miniWindow:全囲いのcore駒が窓に収まる（flip含む）', detail);
    const wsl = K.miniWindow(K.Position.fromCastle(K.CASTLES.find(x => x.id === 'migigyoku'), K.SETUPS.ibisha), 'ibisha');
    ok(wsl.f0 === 3 && wsl.f1 === 7, 'miniWindow:右玉は中央寄りの5筋の窓', jstr(wsl));
  }

  // evaluate のメモ（S3/S4・R5 完了条件）: 同じ引数では judge の新規計算が0回
  {
    const slots = K.constraints.emptySlots();
    const r0 = K.constraints.evaluate(slots, false, 'me', 'castle', 'funa');  // キャッシュを温める
    let n = 0;
    const orig = K.compat.judge;
    K.compat.judge = (...a2) => { n++; return orig(...a2); };
    const r1 = K.constraints.evaluate(slots, false, 'me', 'castle', 'funa');
    K.compat.judge = orig;
    ok(r0 === r1 && n === 0, 'constraints:evaluate は同じ引数でキャッシュを返し judge を再計算しない', `judge ${n}回`);
  }
  // piecePairing.plan: 局面の切り替えの移動リストを1回だけ計算する（駒レイヤは結果を描くだけ）
  {
    const PM = K.piecePairing;
    const mk = (p, sq, owner = 'sente') => ({ p, sq, owner, role: 'core' });
    const before = [mk('銀', '39'), mk('歩', '37'), mk('玉', '59'), mk('歩', '33', 'gote')];
    const after = [mk('銀', '38'), mk('歩', '36'), mk('玉', '59'), mk('歩', '33', 'gote')];
    const pl = PM.plan(before, after, null);
    ok(pl.pairs.length === 4 && pl.gone.length === 0 && pl.appear.length === 0 && pl.lead === -1 && pl.path === null
      && pl.after !== after && after.every(x => x.skip === undefined),
    'piecePairing.plan:全駒が対応づく移動リスト（入力は書き換えない）', jstr(pl));
    // 戦法の主役の駒（trace）は筋道専用になり、通常の対応づけから外れて appear に入る
    const trace = { square: '38', piece: '銀', path: ['39', '38'] };
    const pl2 = PM.plan(before, after, trace);
    ok(pl2.lead === 0 && pl2.after[0].skip === 'lead' && pl2.appear.includes(0) && !pl2.pairs.some(q => q.n === 0)
      && jstr(pl2.path) === jstr(trace.path), 'piecePairing.plan:主役の駒は筋道専用に外す', jstr(pl2));
    ok(PM.plan(before, after, { ...trace, path: ['38'] }).lead === -1, 'piecePairing.plan:経路が1マスなら筋道にしない');
    ok(PM.plan(before, after, { ...trace, piece: '金' }).lead === -1, 'piecePairing.plan:該当する駒がなければ lead なし');
    const pl3 = PM.plan(before, [mk('玉', '59'), mk('金', '49')], null);
    ok(pl3.gone.length === 3 && jstr(pl3.appear) === jstr([1]) && pl3.pairs.length === 1,
      'piecePairing.plan:消える駒（gone）と現れる駒（appear）', jstr(pl3));
    ok(PM.routeMs(['39', '38', '27']) === 560 && PM.routeMs(new Array(20).fill('11')) === 1500,
      'piecePairing.routeMs:区画数に比例し 1500ms で頭打ち');
  }
  {
    const cache = new K.LRU(2);
    cache.set('a', 1);
    cache.set('b', 2);
    ok(cache.delete('a') && !cache.has('a') && cache.delete('missing') === false,
      'LRU:delete は削除結果を返す');
  }
  // attackMap: 利きの数え上げ（piece-rules.js 統一後の回帰。count(f,r) は counts[f][r]）
  {
    const cnt = (m, f, r) => m[f][r];
    // 香99: 同じ筋の前方へ滑走。98・97…へ利き、自駒があればそこで止まる
    const lane = K.Position.fromPieces('香99', {});
    const mLane = K.attackMap(lane, () => true);
    ok(cnt(mLane, 9, 8) === 1 && cnt(mLane, 9, 1) === 1 && cnt(mLane, 8, 8) === 0,
      'attackMap:香は同じ筋の前方へ届く（横には利かない）');
    const blocked = K.Position.fromPieces('香99 歩97', {});
    const mB = K.attackMap(blocked, () => true);
    // 香は98→97（歩のマス）に利いて止まる。97には歩自身は利かない（自分のマス）、
    // 96 は歩が利くので1、95 には誰も届かない（遮断の証明）
    ok(cnt(mB, 9, 7) === 1 && cnt(mB, 9, 6) === 1 && cnt(mB, 9, 5) === 0,
      'attackMap:香の滑走は駒で遮断される', jstr([cnt(mB, 9, 7), cnt(mB, 9, 6), cnt(mB, 9, 5)]));
    // 桂29: (3,7)・(1,7) へ跳ぶ（間の駒に遮られない）
    const kn = K.Position.fromPieces('桂29 歩28', {});
    const mKn = K.attackMap(kn, () => true);
    ok(cnt(mKn, 3, 7) === 1 && cnt(mKn, 1, 7) === 1 && cnt(mKn, 2, 8) === 0,
      'attackMap:桂は前の2方向へ跳ぶ（後ろ・真上には利かない）');
    // 玉55: 全8方向（斜め後退ふくむ）へ1枚ずつ
    const kg = K.Position.fromPieces('玉55', {});
    const mKg = K.attackMap(kg, () => true);
    const ring = [[4,4],[5,4],[6,4],[4,5],[6,5],[4,6],[5,6],[6,6]];
    ok(ring.every(([f, r]) => cnt(mKg, f, r) === 1) && cnt(mKg, 5, 5) === 0,
      'attackMap:玉は全8方向へ利く（自身のマスには利かない）');
    // 角88: 斜めの滑走。77〜11 方向へ届き、直交方向には利かない
    const bish = K.Position.fromPieces('角88', {});
    const mBish = K.attackMap(bish, () => true);
    ok(cnt(mBish, 7, 7) === 1 && cnt(mBish, 1, 1) === 1 && cnt(mBish, 8, 7) === 0 && cnt(mBish, 7, 8) === 0,
      'attackMap:角は斜めに滑走する（直交方向には利かない）');
  }
}

// ---------- 9. K.tesuji: 共有の駒の動き・frames の検算・forCastle/defenders（coverage-tesuji） ----------
{
  ok(K.pieceRules && K.tesuji && K.tesujiCheck, 'tesuji: pieceRules/tesuji/tesujiCheck が読み込まれている');
  if (K.pieceRules) {
    // 成駒の動き: と・杏・圭・全は金と同じ、馬は角の滑走＋縦横、龍は飛の滑走＋斜め
    const g = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [0, 1]];
    for (const p of ['と', '杏', '圭', '全']) ok(jstr(K.pieceRules.STEPS[p]) === jstr(g), `pieceRules:${p} は金の動き`);
    ok(K.pieceRules.SLIDES['馬'] && K.pieceRules.SLIDES['龍'] && !K.pieceRules.SLIDES['と'], 'pieceRules:馬・龍は滑走を持つ');
    ok(K.pieceRules.PROMOTED['角'] === '馬' && K.pieceRules.BASE['龍'] === '飛', 'pieceRules:成りの対応（竜は龍に畳む）');
    const has = () => false;
    ok(K.tesuji.reach('馬', 5, 5, 'sente', has).length === 20 && K.tesuji.reach('龍', 5, 5, 'sente', has).length === 20,
      'tesuji:reach は馬・龍の利きを返す（滑走16+歩み4）', jstr([K.tesuji.reach('馬', 5, 5, 'sente', has).length, K.tesuji.reach('龍', 5, 5, 'sente', has).length]));
  }
  if (K.tesujiCheck) {
    // 全 TESUJI の frames を検算する（付録A）＋ onCastle と囲い core の整合（付録B）
    const bad = (K.TESUJI || []).map(t => {
      const r = K.tesujiCheck.check(t);
      const oc = K.tesujiCheck.onCastleIssues(t, { CASTLES: K.CASTLES });
      return r.issues.length || oc.length ? `${t.id}(${[...r.issues, ...oc].join('/')})` : null;
    }).filter(Boolean);
    ok(bad.length === 0, `tesuji-check:全${(K.TESUJI || []).length}件の frames と onCastle が合法`, bad.join(' / '));
  }
  if (K.tesuji) {
    // 囲い ↔ 手筋: 美濃に結びつく崩し方と急所
    const mino = K.CASTLES.find(c => c.id === 'mino');
    const kz = K.tesuji.forCastle(mino).map(t => t.id).sort();
    ok(jstr(kz) === jstr(['mino-kobin-keima', 'mino-kobin-ryu', 'mino-kyusho39'].sort()),
      'tesuji:forCastle は美濃の崩し方3件を引く', jstr(kz));
    ok(jstr(K.tesuji.weakSquares(mino).sort()) === jstr(['36', '39']),
      'tesuji:weakSquares は美濃の急所 3九・3六', jstr(K.tesuji.weakSquares(mino)));
    // 穴熊: mirrorIds の左穴熊にも引ける（反転して適用する囲い）
    const ana = K.CASTLES.find(c => c.id === 'anaguma');
    ok(K.tesuji.forCastle(ana).some(t => t.id === 'ana-tsugifu-tarefu'),
      'tesuji:forCastle は mirrorIds の囲いにも引く');
    // project: 後手へ重ねる投影は座標を180度回して先後を入れ替える
    const pr = K.tesuji.project({ sente: '角44 龍21', gote: '玉82', hand: '銀', handGote: '角' }, { flip: true });
    ok(pr.sente === '玉28' && jstr(pr.gote.split(' ').sort()) === jstr(['角66', '龍89']) && pr.hand === '角' && pr.handGote === '銀',
      'tesuji:project(flip) は回転して先後を入れ替える', jstr(pr));
    // 登録表: defenders（受けの位置）と detectors（検出器）
    ok(K.tesuji.defenders.sokofu === K.tesuji.sokofu && K.tesuji.detectors.fork === K.tesuji.forks,
      'tesuji:defenders/detectors の登録表');
    // comboOf の回帰（戦法＋囲い → 定番セット）
    const cmb = K.tesuji.comboOf({ strategy: 'furibisha', tacticId: 'shikenbisha', castleId: 'mino' });
    ok(cmb && cmb.id === 'shiken-mino', 'tesuji:comboOf 四間飛車＋美濃囲い', jstr(cmb && cmb.id));
  }
}

// ---------- 10. 監査の回帰（plan-bug-audit.md）: 玉救出・CONTACT→ng・threat(null) ----------
{
  // F-1: どんな両立しない組み合わせでも合成局面に玉が必ず1枚いる（消えない）
  const bad = [];
  for (const t of K.TACTICS) for (const c of K.CASTLES) {
    const pos = K.compose.build({ tacticIds: [t.id], castleId: c.id }).position;
    if (pos.pieces.filter(x => x.p === '玉' && x.owner === 'sente').length !== 1)
      bad.push(`${t.id}+${c.id}`);
    if (pos.hand && pos.hand.includes('玉')) bad.push(`${t.id}+${c.id}:hand玉`);
  }
  ok(bad.length === 0, 'compose:全組合せで玉が盤上に1枚いる（持ち駒に残らない）', bad.slice(0, 5).join(' / '));

  // R-1: merge の 'ng' 接触は deriveBoard の ng に CONTACT 理由として届く
  {
    const slots = { me: { tactic: ['yokofudori'], castle: 'hekomiyagura' },
                    opp: { tactic: ['shin-ishida'], castle: 'chonmagemino' } };
    const d = K.deriveBoard(slots, true);
    const hasContact = d.merged.contacts.some(c => c.kind === 'ng');
    const flagged = [d.ng.me, d.ng.opp].some(n =>
      Object.values(n.tactic).flat().concat(n.castle || []).some(r => r.code === 'CONTACT'));
    ok(hasContact && flagged, 'deriveBoard:mergeのng接触が制約の ✕（CONTACT理由）に届く');
  }

  // R-3: threat は欠けた側に null を返す
  ok(K.matchup.threat(null, null) === null
    && K.matchup.threat({ strategy: 'ibisha', tacticIds: [], castleId: null }, null) === null,
    'matchup:threat(null) は null を返す');
}

console.log(`---\n${pass + fail} tests, ${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
