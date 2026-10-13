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
// hash-link は ui 配属だが parseHash/buildQuery は DOM 非依存なので単体でも試す
ctx.URLSearchParams = URLSearchParams;
load('js/ui/hash-link.js');

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

// ---------- 6. constraints: sides / apply / preview / lateOf / labels（計画書 §1 / §3-2） ----------
if (!K.constraints || !K.constraints.sides || !K.constraints.apply || !K.constraints.preview) {
  ok(false, 'constraints: Kakoi.constraints が未定義', 'js/core/constraints.js を確認');
} else {
  const CS = K.constraints, FIELD = CS.FIELD, KINDS = CS.KINDS;
  // 「ng を残さない」の判定は tactic/castle 層で行う。どの層で評価しても盤上の衝突と
  // SIDE は同じ ng になるが、strategy 層だけは相性表(pairings)の○上書きが効かない
  // （compat.judge の仕様）ため、中飛車×美濃のような合法な状態まで ng と報告してしまう
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

  // apply: set は末尾へ・同 (who,kind) は置き換え、remove は削除のみ
  {
    const r = CS.apply([{ who: 'me', kind: 'castle', id: 'funa' }],
      { type: 'set', who: 'me', kind: 'castle', id: 'yagura' });
    ok(r.list.length === 1 && r.list[0].id === 'yagura' && r.changed.length === 0,
      'constraints:apply 同 (who,kind) の置き換え', jstr(r));
    const r2 = CS.apply(r.list, { type: 'remove', who: 'me', kind: 'castle' });
    ok(r2.list.length === 0 && r2.changed.length === 0, 'constraints:apply remove は取り除くのみ', jstr(r2));
    const r3 = CS.apply([
      { who: 'me', kind: 'castle', id: 'funa' }, { who: 'opp', kind: 'strategy', id: 'ibisha' }],
      { type: 'set', who: 'me', kind: 'tactic', id: 'bougin' });
    ok(r3.list[r3.list.length - 1].kind === 'tactic' && r3.list[r3.list.length - 1].id === 'bougin',
      'constraints:apply set は末尾へ', jstr(r3.list));
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
    // 角換わり: 両者居飛車＋両戦法の持ち駒に角（腰掛け銀。senkei 未整備でも補助条件で出る）
    const kakugawari = CS.labels(
      CS.sides([{ who: 'me', kind: 'tactic', id: 'koshikakegin' }]).me,
      CS.sides([{ who: 'opp', kind: 'tactic', id: 'koshikakegin' }]).opp);
    ok(kakugawari.some(x => x.id === 'kakugawari'), 'constraints:labels 角換わり（持ち駒の角）', jstr(kakugawari));
    // 矢倉: 自分の囲い系統が yagura
    const yagura = CS.labels(
      CS.sides([{ who: 'me', kind: 'castle', id: 'yagura' }]).me,
      CS.sides([{ who: 'opp', kind: 'strategy', id: 'ibisha' }]).opp);
    ok(yagura.some(x => x.id === 'yagura'), 'constraints:labels 矢倉（囲い系統）', jstr(yagura));
  }

  // compat.judge の対敵軸（§3-1）: level は変えず vs に乗せる
  {
    const j = K.compat.judge({ strategy: 'furibisha', tacticId: 'mukaibisha' }, 'castle', 'mino',
      { strategy: 'ibisha', tacticId: 'ibisha-base' });
    ok(j.vs && j.vs.strategy === 'good' && j.vs.level === 'good',
      'compat:vs 軸（向かい飛車は対居飛車 good）', jstr(j.vs));
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
      const op = rnd() < 0.25 ? { type: 'remove', who, kind }
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

console.log(`---\n${pass + fail} tests, ${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
