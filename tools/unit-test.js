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

const K = ctx.Kakoi;
if (!K.compose || !K.compose.position) {
  console.error('load error: Kakoi.compose が未定義。js/core/compose.js がまだ無い（M2 の並行実装待ち）');
  process.exit(1);
}
if (!K.compat || !K.compat.judge || !K.compat.resolve) {
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
  ok(j.level === 'ok' && has(j, 'TEMPO'), 'expect:bougin×anaguma ok + TEMPO', brief(j));
}
{
  const j = K.compat.judge({ strategy: 'furibisha', tacticId: 'nakabisha' }, 'castle', 'mino');
  ok(j.level === 'ng', 'expect:nakabisha×mino ng（5八で飛車と金が重なる）', brief(j));
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

// ---------- 4. resolve の決定性 ----------
{
  const side = { strategy: 'furibisha', tacticId: 'shikenbisha', castleId: 'mino', pick: ['strategy', 'castle', 'tactic'] };
  const r1 = K.compat.resolve({ ...side, pick: [...side.pick] }, 'castle', 'anaguma');
  const r2 = K.compat.resolve({ ...side, pick: [...side.pick] }, 'castle', 'anaguma');
  ok(r1.changed.length >= 1, 'resolve:anaguma選択で差し替えが起きる', jstr(r1.changed));
  ok(r1.changed.some(e => e.layer === 'tactic' && e.from === 'shikenbisha'),
    'resolve:changed が戦法の差し替えを説明する', jstr(r1.changed));
  ok(jstr(r1) === jstr(r2), 'resolve:2回実行で同一結果', `${jstr(r1)} != ${jstr(r2)}`);
  ok(Array.isArray(r1.next.pick) && r1.next.pick[r1.next.pick.length - 1] === 'castle',
    'resolve:pick 末尾はいま選んだ層', jstr(r1.next.pick));
  // 差し替え後の状態は、差し替えた層が ng でないこと
  for (const e of r1.changed) {
    const j = K.compat.judge(r1.next, e.layer, r1.next[e.layer === 'strategy' ? 'strategy' : e.layer === 'tactic' ? 'tacticId' : 'castleId']);
    ok(j.level !== 'ng', `resolve:差し替え後の ${e.layer}(${r1.next[e.layer === 'strategy' ? 'strategy' : e.layer === 'tactic' ? 'tacticId' : 'castleId']}) は両立`, brief(j));
  }
  console.log(`  resolve 結果: ${jstr(r1.next)}\n  changed: ${jstr(r1.changed)}`);
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

console.log(`---\n${pass + fail} tests, ${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
