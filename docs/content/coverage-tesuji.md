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

### 2-1. 件数サマリ（機械集計。2026-11-01 15時台の main）

- 囲い86件（居飛車61・振り飛車25）のすべてに attacks が1件以上あり、合計 **90件**（居飛車の囲い64件・振り飛車の囲い26件）。2件あるのは `mino`（`hashi`＋`gyokuto`）、`funa57gin` と `hishigakoi`（`hachinana`＋`gyokuto`）、`tenshukaku`（`gyokuto`＋`dan`）の4囲いだけ。
- **id は7種類しかない**: `hashi` 端攻め 33 / `gyokuto` 玉頭攻め 29（名称違いで「銀への攻め」「桂頭攻め」を含む） / `center` 中央からの攻め 13（名称4種: 中央からの攻め・中央への反発・中央攻め・5八への打ち込み） / `side` 横からの飛車打ち 6（4筋・側面攻めを含む） / `dan` 下段への飛車打ち 5 / `hachinana` 8七への集中砲火 2 / `keima` 桂馬攻め 2。
- 後手の駒の配置（`id`＋`gote`）の異なり方は **31通り**。`hashi` の「歩95 香91 桂73」は16囲いで、「歩15 香11 桂33」は9囲いで共通。`center` の「歩55 桂45」は10囲いで共通。**囲い固有の攻め筋はほぼ無い**。
- 内容は静的な1枚の絵（盤上の後手駒1〜3枚＋ `target`）で、**手順・持ち駒・手番・成駒を持たない**。90件のうち本文に [[出典]] を引くのは12件（13%）。系統別では、穴熊系13囲い（13件）はすべて `hashi`、舟囲い系11囲い（13件）の8件が `gyokuto`、矢倉系20囲い（20件）の10件が `gyokuto`・6件が `hashi`。
- `target` の意味が2種類混ざる。後手駒が**いま利いているマス**と、**この後に狙うマス（弱点）**。機械照合では、90件中16件だけが「target がすべて後手駒の利きの中」で、74件は「いま利いていないマス」を含む（例: 穴熊の端攻めの 9七・9八・9九）。後者は「狙い」として正しいが、同じ `target` で両方を表すため、盤上の強調の意味が読み手に伝わらない。
- 試作の `counters`（底歩 → `side`・`dan`）が結べるのは、この7種のうち `side`（6件）と `dan`（5件）の11囲いだけ。攻め筋の id が囲い横断で同名（`hashi` が33囲い）なので、`counters` は「この囲いの」ではなく「この id の」にしか効かない。

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

#### A. 囲いごとに欠けている代表的な崩し方

座標は**先手の囲いに対する後手の攻め**に換算した値（文献の図は後手の囲いを先手が攻める向き。(筋,段)→(10−筋,10−段)。▲→△）。出典の「確認」は、本文を実際に取得して読んだもの。手順は記事の文面に書かれたものだけを写した。

| 囲い（現行 attacks） | 欠けている崩し方 | 先手換算の要点（後手の攻め） | 出典（確認） |
|---|---|---|---|
| 美濃系 11囲い（`mino` `katamino` `takamino` `gincan` `diamond` `kimuramino` ほか。`hashi`・`gyokuto`・`side`・`dan`・`center` のいずれか） | ① **急所 3九 を狙う攻め**（銀・角を斜め後ろに利かせて打つ。基本の第一手） | 後手の角が 6六 にいて 3九 に利きがあるとき △3九銀。△3九銀▲同金△同角成▲1八玉△2八金 までの詰み。持ち駒が歩だけなら △4八歩（記事上は「▲6二歩」）から入り、竜で金を取って △4九歩成 の**両王手**に持ち込む（vol.3） | 日本将棋連盟「美濃囲いの崩し方」vol.1〜3（記事上は「7一」「▲4四角→▲7一銀」）。確認済み（curl） |
| 同上 | ② **コビン攻め**（角の筋＋桂） | △3六桂。3七の歩で取ると角の筋が通って 2八の玉を取られるので取れない（記事上は「▲7四桂」）。持ち駒が歩だけなら △3六歩 から入り、△3七歩成▲同桂△3六歩 としつこく続ける | 同 vol.4〜5。確認済み（curl） |
| 同上 | ③ **端攻めの組み立て**（歩のたたき→桂で香取り） | △1六歩▲同歩△1八歩▲同香△1七歩▲同香△2五桂（香取り）。基本は「桂で香を狙う」。歩が無いときは △2五桂 から △1七桂成 の強襲 | 同 vol.6〜7（記事上は「▲9四歩…▲8五桂」）。確認済み（curl） |
| 同上 | ④ **持ち駒で変わる急所の攻め**（銀なら 4八歩、金なら 5八歩、歩だけなら 5八歩→6七歩 など） | 持ち駒が金のときは △4八歩 でなく **△5八歩**（1つ隣から打つ）。香と銀なら 4八香→1八歩→1九銀 | 同 vol.9〜10。確認済み（curl） |
| 穴熊系 13囲い（すべて `hashi` のみ） | ① **端攻め**（突き捨て→歩のたたき→桂・香。継ぎ歩で香を吊る） | 振り飛車穴熊（玉19）では △1六歩▲同歩△1七歩 と垂らし、▲同桂なら △1六香。記事は「穴熊の端は金駒が銀1枚しか利かず、穴熊の中でいちばん薄い」とする | 日本将棋連盟「穴熊の崩し方」vol.1〜2・16〜17。確認済み（curl） |
| 同上 | ② **と金攻め**（二段目に垂らす） | △4八歩（次の △4九歩成 を受けにくい。ねらいは 3九 の金）。三段目の △4七歩 は受けられやすい | 同 vol.4。確認済み（curl） |
| 同上 | ③ **大駒を切って金銀をはがす** | △3九角成▲同金△同飛成▲同銀△4九金。「終盤の穴熊の金銀は大駒より価値が高い」 | 同 vol.1・5〜6。確認済み（curl） |
| 同上 | ④ **2七（記事上は 8三）・3七（同 7三）の急所** | △2七桂不成（▲同銀は △1九角成で玉を取れる）。3七へは香の放り込み（▲同銀なら △3九飛成） | 同 vol.1・7〜9・18。確認済み（curl） |
| 同上 | ⑤ **継ぎ歩と垂れ歩で 2七 を攻める** | △2六歩▲同歩△2五歩▲同歩△2六歩 と垂らし、次の △2七桂 を狙う。格言「三歩持ったら継ぎ歩と垂れ歩」の実例 | 同 vol.9。確認済み（curl） |
| 矢倉系 20囲い（`hashi` 6・`gyokuto` 10・`center` 2・`keima` 2） | **急所は金**（記事上は「3二の金」＝先手矢倉の 7八金）。縦からの攻めには歩頭の桂 | 記事の文面: 「4一」（先手換算 6九）から銀などを打つ→金が「4二」（同 6八）へ逃げれば角成で金を取り、同金に飛を切る（同銀なら「3二」＝7八へ金打ちから寄せる）。**図が取得できず手順は【要確認】** | 勝ち将棋ブログ「【矢倉、舟囲い、穴熊の崩し方】囲い攻略のコツ」（確認済み・WebFetch。先手後手の向きは記事に明記なし）。日本将棋連盟「矢倉の崩し方」は 4六銀・3七桂型の**定跡**（vol.93〜102 の題名で確認）で、囲いの急所の解説ではない |
| 舟囲い系 11囲い（`gyokuto` 8・`hachinana` 2 ほか） | **急所は 4一金（先手換算 6九）と角頭 2三（同 8七）**。送りの手筋・焦点の香打ち | 将棋上達塾の例（記事上は後手の3一銀型舟囲い）: ▲5三銀△4二金▲7四角… →先手換算 △5七銀▲6八金△3六角… の形。**送りの手筋**（玉の横に金などを打ち、玉で取らせて詰みに導く）が主役。現行は `hachinana`（8七）が `funa57gin`・`hishigakoi` にあるだけで、基本形の `funa`・`funa68gin`・`elmo` は `gyokuto` のみ | 将棋上達塾「舟囲い崩しの手筋」（確認済み・WebFetch／curl）。勝ち将棋ブログ（確認済み） |
| 雁木・左美濃・銀冠・高美濃・天守閣・中住まい・駒落ち系ほか | 出典未確認【要確認】 | 日本将棋連盟の「崩し方」3シリーズ（美濃・穴熊・矢倉）と『全戦型対応! 囲いの破り方』（矢倉・美濃・穴熊の180問）は3囲いしか扱わない。**それ以外の囲いの崩し方を載せた信頼できる出典は、今回の調査では見つかっていない** | 日本将棋連盟オンラインストア商品ページ（確認済み）。銀冠は個人ブログ「アマチュア初段への道！（16）」が検索で見つかったが本文は未取得 |

#### B. 内容の疑義（🔴=誤り・出典不一致 / 🟡=不正確・不足）

| # | 対象 | 判定 | 内容 | 根拠 |
|---|---|---|---|---|
| B1 | `gangi`・`tsunogin` の `side`（横からの飛車打ち）と、その cons・sources が引く `jsf-kuzushi48`（castles-ibisha.js の 309・313・319・336・345 行付近） | 🔴 | 出典が主張を支えていない。`jsf-kuzushi48` は「矢倉の崩し方【第48回】」で、本文は「4六銀・3七桂型が見られなくなった理由」（矢倉の戦型史）。雁木は第3図の説明で「6七と4七に銀を配置する形が近年大流行」と触れるだけで、**下段への飛車打ち・5九〜6九の弱さには触れない** | 記事本文を全文読んだ（Web Archive を curl で取得）。https://web.archive.org/web/2024/https://www.shogi.or.jp/column/2018/08/post_416.html |
| B2 | `yagura`・`ginyagura` の `hashi` の文「9筋の玉のコビン（9七・8七）」 | 🟡 | 小鬢（コビン）は「玉・飛車の斜め上のマス」。玉88のコビンは **9七と7七**。8七は玉の真上（玉頭） | Wikipedia「将棋用語一覧」小鬢の項（確認済み） |
| B3 | `funa68kin` の `dan`「玉の下の7九・6九から王手がかかる」 | 🟡 | 飛が 6九 にいても玉78には王手ではない（飛は斜めに利かない）。7九なら王手だが玉で取れる。**龍に成れば** 6九・7九から玉に迫る、が正確 | 駒の利き（着手規則）。出典の確認は不要な規則の話 |
| B4 | `gindachiyagura`（銀への攻め）・`ryusenyagura`（桂頭攻め）の `id:'gyokuto'`、`center` の4名称 | 🟡 | id と名称が食い違う。`counters`・集計・UI の見出しが id 単位だと別物が同じ扱いになる | 機械集計（§2-1） |
| B5 | `mino` の `gyokuto`（玉頭攻め） | 🟡 | 誤りではないが、居飛車対振り飛車では玉頭攻めは出にくい（8筋に歩が伸びない）。主筋は「急所・コビン・端」の3つ | 日本将棋連盟「美濃囲いの崩し方」vol.1・vol.8（確認済み・curl） |
| B6 | 攻め筋 90件のうち本文に [[出典]] があるのは12件 | 🟡 | 「この攻め方は実戦で有効か」を支える出典が付いていない攻め筋が多い。端攻め・玉頭攻めは3囲いごとの共通文の複製が多い | 機械集計 |
| B7 | 参考: `kinmusou` の `side`「4筋＝うさぎ耳」 | 🟢 | Wikipedia「金無双」に「4筋は『うさぎ耳』とも呼ばれている」とあり、正確 | Wikipedia「金無双」（確認済み） |

#### C. 構造上の不足

- **囲い固有の急所を表す欄が無い**: 美濃=3九、穴熊（振り飛車穴熊）=2七・3八、矢倉=7八金、舟囲い=6九金・8七。`pros`・`cons` の `sq` は強調できるが、「どの駒をどの順で当てて崩すか」は文章にしか書けない。
- **持ち駒が決め手になる攻めを表せない**: 日本将棋連盟の美濃囲い・穴熊の連載は、持ち駒（銀・金・桂・歩）でほとんどの手順が変わる。`gote` は盤上の駒だけで、後手の持ち駒を持てない。
- **連続技が囲いに結ばれていない**: 「継ぎ歩→垂れ歩→桂」「叩きの歩で香を吊る→桂で香取り」などの手筋名は `TESUJI` にあるが、囲いの `attacks` から呼べない（`counters` は受けの手筋から攻め筋への片方向のみ）。
- **`counters` が id 単位**: `hashi` が33囲いで同名なので、「この囲いのこの端攻めに対する受け」を区別できない。
- **試作に検証が無い**: 本流の `js/core/validate.js` に `tesuji`・`proverb`・`combo` の検証関数が無い（§5-5・§8 参照）。

<!-- TODO:sec2-3-done -->

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
