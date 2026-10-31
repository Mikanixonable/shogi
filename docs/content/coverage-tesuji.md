# 戦術層（手筋・囲いの崩し方・受け・格言・定跡）の網羅度調査と可視化設計

作成日: 2026-11-01 / 担当: 調査 cov-tesuji / **状態: 作業中（骨組み＋確認済みの節から順に追記）**
方針: 本書は調査と提案のみ。`js/` `css/` `index.html` は変更しない。URL は本文を実際に開いて確かめたものだけを「確認済み」とし、確認できなかった事実は【要確認】と明記する。

---

## 0. 前提・線引き・進捗

### 0-1. 前提
- データ（2026-11-01 時点の main）: 囲い86・戦法69・出典163。別セッションが `tactics.js` と `sources.js` を編集中。
- **試作**（worktree `.claude/worktrees/tesuji`、ブランチ `tesuji-combos`、未コミット）: `js/data/tesuji.js`（`Kakoi.TESUJI` 7件＋`Kakoi.PROVERBS` 5件）、`js/core/tesuji.js`（`forks` / `sokofu` / `comboOf`）、`js/ui/tesuji-modal.js`、`js/data/combos.js`。**本書はこの設計（`diagram.frames` によるコマ送り・`counters` で囲いの `attacks` と結ぶ・`detect`）を土台**にし、足りない点（成駒・後手の手番・手順の合法性の検証・囲いの崩し方シリーズ）を拡張する案を出す。
- 先行文書との線引き: `docs/content/coverage-tactics.md` §4 は手筋導入の3段階案（ブランチのマージ→歩の手筋→囲いの崩し方シリーズ）を示した。`docs/content-gap-shougi-sites.md` は将棋講座ドットコムの手筋50・格言70の**名前の一覧**を示した。本書はそれらを「中身を信頼できる出典で確認したカタログ」と「拡張設計・データ下書き」へ発展させる。名前だけの一覧は網羅の手がかりに使い、中身は別の出典で確かめる。
- `js/data/fun.js` の `proverbs`（22件）は別担当がファクトチェック中。本書の格言台帳（§4）は、試作の `PROVERBS` と `fun.js` を「手筋・囲い・戦法に結びつける」観点で束ねる。fun.js の個々の誤りは判定しない。
- 出典の確認方法: WebFetch は `web.archive.org` を拒否する。日本将棋連盟（shogi.or.jp）のコラムは原URLが 404 で、Web Archive にだけ残っている。これらは Archive の本文を `curl` で取得して読んだ。本書では「確認済み（curl）」と書く。図の画像（局面図）も同じ方法で取得し、目視で照合した。

### 0-2. 対象一覧と確認状況（1件確認するごとに更新）

| # | 対象 | 状況 |
|---|---|---|
| R1 | 現行 attacks の棚卸し（囲い86件） | 済（§2） |
| R2 | 試作の手筋7件・格言5件の正確性 | 未 |
| R3 | 日本将棋連盟「囲いの崩し方」3シリーズ（美濃11回・穴熊19回・矢倉100回超） | 取得済・読解中 |
| R4 | 舟囲い崩し（将棋上達塾） | 取得済・読解中 |
| R5 | Wikipedia「手筋 (将棋)」「将棋用語一覧」「将棋の格言」 | 手筋は一覧のみ確認済 |
| R6 | 将棋講座ドットコムの手筋50・格言70の突合 | 未 |
| R7 | 受けの手筋（底歩・中合い・早逃げ ほか） | 未 |
| R8 | 定跡（駒組みから仕掛けまでの代表手順） | 未 |
| R9 | 格言台帳（試作 PROVERBS＋fun.js＋新規） | 未 |
| R10 | データモデル・可視化の設計案 | 未 |
| R11 | 優先度Aのデータ下書き＋合法性の検算 | 未 |

### 0-3. 凡例
- 優先度: A=基本・有名で欠けると図鑑として不完全 / B=中級者が知っておくべき / C=マイナー・歴史的
- 分類: 攻め / 受け / 崩し（囲い別の急所の攻略） / 寄せ / 格言 / 定跡
- 局面の座標: 標準の符号の絶対座標（筋1〜9=先手から見て右→左、段1〜9=後手側→先手側）。**文献の図が後手玉（△）の囲いを先手が攻める図のときは (筋,段)→(10−筋,10−段) で先手の囲い・後手の攻め駒に換算**して書く。換算前の表記を併記する。
- 確認済み: 本文を実際に取得して読んだ。【要確認】: 取得できなかった、または本文に見当たらなかった。

---

## 1. 要約

<!-- TODO:sec1 -->

---

## 2. 既存 attacks の棚卸し（現行データ: 囲い86件）

### 2-1. 件数サマリ

- 囲い86件のすべてに attacks が1〜2件あり、合計 **90件**（2件あるのは `mino`（美濃囲い・本美濃）のみで `hashi`＋`gyokuto`。`funa57gin` `hishigakoi` `tenshukaku` は別 id の2件）。
- **id は7種類しかない**: `hashi` 端攻め 33 / `gyokuto` 玉頭攻め 29（「銀への攻め」「桂頭攻め」の名称違い含む） / `center` 中央からの攻め 13 / `side` 横からの飛車打ち 6 / `dan` 下段への飛車打ち 5 / `hachinana` 8七への集中砲火 2 / `keima` 桂馬攻め 2。
- 後手の駒の配置（`gote`）で数えても、**異なる配置は約30通り**。たとえば `hashi` は「歩95 香91 桂73」が16囲いで共通、「歩15 香11 桂33」が9囲いで共通。

<!-- TODO:sec2-1 -->

### 2-2. 囲いごとの件数と内容（機械生成。2026-11-01 時点）

| # | id | 名称 | 側 | 系統 | 件 | 攻め筋（id） |
|---|---|---|---|---|---|---|
| 1 | anaguma | 居飛車穴熊 | 居 | anaguma/sanmai | 1 | hashi（端攻め） |
| 2 | funa | 舟囲い | 居 | funa/base | 1 | gyokuto（玉頭攻め） |
| 3 | funa68gin | 舟囲い（6八銀型） | 居 | funa/base | 1 | gyokuto（玉頭攻め） |
| 4 | funa57gin | 舟囲い（5七銀型） | 居 | funa/base | 2 | hachinana（8七への集中砲火）、gyokuto（玉頭攻め） |
| 5 | hishigakoi | 菱囲い（舟囲い5七銀右型） | 居 | funa/base | 2 | hachinana（8七への集中砲火）、gyokuto（玉頭攻め） |
| 6 | elmo | elmo囲い | 居 | funa/kin79 | 1 | gyokuto（玉頭攻め） |
| 7 | funa68kin | 舟囲い（6八金型） | 居 | funa/kin68 | 1 | dan（下段への飛車打ち） |
| 8 | yagura | 矢倉囲い | 居 | yagura/kin | 1 | hashi（端攻め） |
| 9 | kani | カニ囲い | 居 | gangi/heiretsu | 1 | center（中央からの攻め） |
| 10 | kabuto | 兜囲い（兜矢倉） | 居 | gangi/hidarimae | 1 | dan（下段への飛車打ち） |
| 11 | gangi | 雁木囲い（旧型） | 居 | gangi/nimai | 1 | side（横からの飛車打ち） |
| 12 | tsunogin | ツノ銀雁木 | 居 | gangi/tsuno | 1 | side（横からの飛車打ち） |
| 13 | bonanza | ボナンザ囲い | 居 | yagura/kata | 1 | hashi（端攻め） |
| 14 | hidarimino | 左美濃 | 居 | mino/hon | 1 | gyokuto（玉頭攻め） |
| 15 | ginyagura | 銀矢倉 | 居 | yagura/gin | 1 | hashi（端攻め） |
| 16 | katayagura | 片矢倉（天野矢倉） | 居 | yagura/kata | 1 | hashi（端攻め） |
| 17 | doiyagura | 土居矢倉 | 居 | yagura/doi | 1 | gyokuto（玉頭攻め） |
| 18 | kikusui | 菊水矢倉 | 居 | yagura/kikusui | 1 | hashi（端攻め） |
| 19 | millennium | ミレニアム囲い | 居 | yagura/millennium | 1 | gyokuto（玉頭攻め） |
| 20 | yagura-anaguma | 矢倉穴熊 | 居 | anaguma/yaguramae | 1 | hashi（端攻め） |
| 21 | matsuo-anaguma | 松尾流穴熊 | 居 | anaguma/yonmai | 1 | hashi（端攻め） |
| 22 | big4 | ビッグ4 | 居 | anaguma/yonmai | 1 | hashi（端攻め） |
| 23 | tenshukaku | 天守閣美濃 | 居 | mino/tenshu | 2 | gyokuto（玉頭攻め）、dan（下段への飛車打ち） |
| 24 | yonmaimino | 四枚美濃（左美濃系） | 居 | mino/ginmino | 1 | hashi（端攻め） |
| 25 | hidariginkan | 左銀冠（四枚） | 居 | mino/gincan | 1 | hashi（端攻め） |
| 26 | nakazumai | 中住まい（4八銀型） | 居 | nakazumai | 1 | gyokuto（玉頭攻め） |
| 27 | nakahara | 中原囲い | 居 | nakazumai | 1 | gyokuto（玉頭攻め） |
| 28 | migigyoku | 右玉（角換わり型） | 居 | migigyoku | 1 | dan（下段への飛車打ち） |
| 29 | kuchurokaku | 空中楼閣 | 居 | chudan | 1 | hashi（端攻め） |
| 30 | souyagura | 総矢倉 | 居 | yagura/sou | 1 | gyokuto（玉頭攻め） |
| 31 | gindachiyagura | 銀立ち矢倉 | 居 | yagura/gindachi | 1 | gyokuto（銀への攻め） |
| 32 | hishiyagura | 菱矢倉 | 居 | yagura/hishi | 1 | gyokuto（玉頭攻め） |
| 33 | hekomiyagura | へこみ矢倉 | 居 | yagura/hekomi | 1 | gyokuto（玉頭攻め） |
| 34 | fujimiyagura | 富士見矢倉 | 居 | yagura/fujimi | 1 | center（中央への反発） |
| 35 | nagareyagura | 流れ矢倉 | 居 | yagura/nagare | 1 | gyokuto（玉頭攻め） |
| 36 | ryusenyagura | 流線矢倉 | 居 | yagura/ryusen | 1 | gyokuto（桂頭攻め） |
| 37 | kakuyagura | 角矢倉 | 居 | yagura/kaku | 1 | gyokuto（玉頭攻め） |
| 38 | hakoirimusume | 箱入り娘 | 居 | funa/hako | 1 | gyokuto（玉頭攻め） |
| 39 | hashigyoku-ginkanmuri | 端玉銀冠（米長玉） | 居 | mino/hashigyoku | 1 | hashi（端攻め） |
| 40 | ibisha-ginkananaguma | 銀冠穴熊（居飛車） | 居 | anaguma/ginkan | 1 | hashi（端攻め） |
| 41 | kushikatsu | 串カツ囲い | 居 | anaguma/sanmai | 1 | hashi（端攻め） |
| 42 | ichigo | いちご囲い | 居 | quick/ichigo | 1 | center（中央攻め） |
| 43 | saikyou | 最強囲い | 居 | quick/saikyou | 1 | center（中央攻め） |
| 44 | ahiru | アヒル囲い | 居 | quick/ahiru | 1 | center（中央攻め） |
| 45 | hayagakoi | 早囲い | 振 | quick/hayagakoi | 1 | side（横からの飛車打ち） |
| 46 | tajiri-anaguma | 田尻穴熊 | 居 | anaguma/tajiri | 1 | hashi（端攻め） |
| 47 | kanpyo | かんぴょう囲い | 居 | mino/hashigyoku | 1 | hashi（端攻め） |
| 48 | shikaku-yagura | 四角矢倉（金四角型） | 居 | yagura/shikaku | 1 | gyokuto（玉頭攻め） |
| 49 | gin68-yagura | 6八銀型金矢倉 | 居 | yagura/gin68 | 1 | keima（桂馬攻め） |
| 50 | ichimonji-yagura | 一文字矢倉 | 居 | yagura/ichimonji | 1 | center（中央攻め） |
| 51 | tofu-yagura | 豆腐矢倉 | 居 | yagura/tofu | 1 | keima（桂馬攻め） |
| 52 | torakku | トラック囲い | 居 | funa/torakku | 1 | center（中央攻め） |
| 53 | bunchin | 文鎮囲い | 居 | funa/bunchin | 1 | gyokuto（玉頭攻め） |
| 54 | gendai-anaguma | 現代穴熊 | 振 | anaguma/gendai | 1 | hashi（端攻め） |
| 55 | otonashi-anaguma | 音無し構え | 居 | anaguma/otonashi | 1 | hashi（端攻め） |
| 56 | ibisha-kinmino | 居飛車金美濃 | 居 | mino/kinmino | 1 | center（中央攻め） |
| 57 | kinjun | 金盾囲い | 居 | funa/jun | 1 | gyokuto（玉頭攻め） |
| 58 | oojun | 大盾囲い | 居 | funa/jun | 1 | hashi（端攻め） |
| 59 | yondanhashigyoku | 四段端玉 | 居 | chudan/yondan | 1 | hashi（端攻め） |
| 60 | gintaden | 銀多伝 | 居 | komaochi/taden | 1 | hashi（端攻め） |
| 61 | kintaden | 金多伝 | 居 | komaochi/taden | 1 | hashi（端攻め） |
| 62 | kinzogan | 金象眼 | 居 | komaochi/zougan | 1 | center（中央攻め） |
| 63 | ginzogan | 銀象眼 | 居 | komaochi/zougan | 1 | center（中央攻め） |
| 64 | mino | 美濃囲い（本美濃） | 振 | mino/hon | 2 | hashi（端攻め）、gyokuto（玉頭攻め） |
| 65 | katamino | 片美濃囲い | 振 | mino/kata | 1 | center（5八への打ち込み） |
| 66 | takamino | 高美濃囲い | 振 | mino/taka | 1 | side（横からの飛車打ち） |
| 67 | gincan | 銀冠 | 振 | mino/gincan | 1 | dan（下段への飛車打ち） |
| 68 | diamond | ダイヤモンド美濃 | 振 | mino/ginmino | 1 | hashi（端攻め） |
| 69 | furianaguma | 振り飛車穴熊 | 振 | anaguma/sanmai | 1 | hashi（端攻め） |
| 70 | ginkananaguma | 銀冠穴熊 | 振 | anaguma/ginkan | 1 | hashi（端攻め） |
| 71 | kimuramino | 木村美濃 | 振 | mino/kata | 1 | gyokuto（玉頭攻め） |
| 72 | kinmusou | 金無双 | 振 | kinmusou | 1 | side（4筋・側面攻め） |
| 73 | migiyagura | 右矢倉 | 振 | yagura/migi | 1 | hashi（端攻め） |
| 74 | ginmino | 銀美濃 | 振 | mino/ginmino | 1 | side（横からの飛車打ち） |
| 75 | chonmagemino | ちょんまげ美濃 | 振 | mino/chonmage | 1 | gyokuto（玉頭攻め） |
| 76 | bouzumino | 坊主美濃 | 振 | mino/bouzu | 1 | gyokuto（玉頭攻め） |
| 77 | santegakoi | 三手囲い | 振 | quick/sante | 1 | gyokuto（玉頭攻め） |
| 78 | hirame | 平目 | 振 | low/hirame | 1 | center（中央攻め） |
| 79 | hidarigyoku | 左玉（高田流） | 振 | hidarigyoku/takada | 1 | gyokuto（玉頭攻め） |
| 80 | oosumi | 大住囲い | 振 | kinmusou/oosumi | 1 | gyokuto（玉頭攻め） |
| 81 | furibisha-anaguma-48kin | 相振り穴熊（4八金型） | 振 | anaguma/kin48 | 1 | hashi（端攻め） |
| 82 | nakabisha-hidari-anaguma | 中飛車左穴熊 | 振 | anaguma/sanmai | 1 | hashi（端攻め） |
| 83 | muteki | 無敵囲い | 振 | quick/muteki | 1 | center（中央攻め） |
| 84 | furibisha-hashigyoku | 端玉銀冠（振り飛車） | 振 | mino/hashigyoku | 1 | hashi（端攻め） |
| 85 | airkin | エア金（銀冠エア金） | 振 | mino/gincan | 1 | hashi（端攻め） |
| 86 | kagi | カギ囲い | 振 | komaochi/kagi | 1 | hashi（端攻め） |

### 2-3. 不足・疑義

<!-- TODO:sec2-3 -->

---

## 3. 戦術カタログ

<!-- TODO:sec3 -->

---

## 4. 格言台帳

<!-- TODO:sec4 -->

---

## 5. データモデルと可視化の設計案

<!-- TODO:sec5 -->

---

## 6. 優先度Aのデータ下書き

<!-- TODO:sec6 -->

---

## 7. 新規出典の一覧

| id（案） | title | publisher | url | 確認できた内容 |
|---|---|---|---|---|
<!-- TODO:sec7 -->

---

## 8. 担当外で気づいた点（随時追記）

<!-- TODO:sec8 -->
