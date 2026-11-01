// スクリプト一覧: 読み込み順の唯一の定義（index.html と tools/validate-castles.js が共有する）
// 依存方向は data → core → logic → ui → screen → app。logic 内の参照も一方向
// （constraints→compat→compose→defaults/catalog→pieceRules。逆向きの参照を増やさない）
window.Kakoi = window.Kakoi || {};
Kakoi.MANIFEST = (() => {
  const core = ['js/core/notation.js', 'js/core/piece-rules.js'];
  const data = ['js/data/sources.js', 'js/data/taxonomy.js', 'js/data/setups.js', 'js/data/strategies.js', 'js/data/castles-ibisha.js', 'js/data/castles-furibisha.js', 'js/data/tactic-families.js', 'js/data/tactics.js', 'js/data/tactic-ratings.js', 'js/data/extras.js', 'js/data/combos.js', 'js/data/tesuji.js', 'js/data/senkei.js'];
  const vendor = ['js/vendor/three.min.js']; // 立体駒用。UMD（file:// でも読める）を内蔵
  const logic = ['js/core/catalog.js', 'js/core/lru.js', 'js/core/html.js', 'js/core/position.js', 'js/core/defaults.js', 'js/core/matchup.js', 'js/core/compose.js', 'js/core/compat.js', 'js/core/constraints.js', 'js/core/derive-board.js', 'js/core/repository.js', 'js/core/attack-map.js', 'js/core/validate.js', 'js/core/piece-pairing.js', 'js/core/tesuji-engine.js', 'js/core/tesuji-check.js'];
  const ui = [
    'js/ui/store.js', 'js/ui/segmented-control.js', 'js/ui/mini-board.js', 'js/ui/family-glyph.js', 'js/ui/cites.js',
    'js/ui/piece-art.js', 'js/ui/piece-layer-dom.js', 'js/ui/piece-layer-3d.js', 'js/ui/board-view.js', 'js/ui/overlay-view.js',
    'js/ui/toolbar-view.js',
    'js/ui/detail-sections.js', 'js/ui/detail-view.js',
    'js/ui/tactic-nav.js',
    'js/ui/theme-toggle.js', 'js/ui/tools-toggle.js', 'js/ui/toast.js', 'js/ui/hash-link.js',
    'js/ui/constraint-field.js', 'js/ui/roving-tabindex.js',
    'js/ui/rail-grids.js', 'js/ui/rail-badges.js', 'js/ui/rail-view.js',
    'js/ui/about-modal.js', 'js/ui/mobile-tabs.js',
  ];
  const screen = ['js/screen/keyboard-nav.js', 'js/screen/board-screen.js', 'js/screen/controller.js', 'js/screen/tesuji-mode.js'];
  const app = ['js/app.js'];
  return { core, data, vendor, logic, ui, screen, app, order: [...core, ...data, ...vendor, ...logic, ...ui, ...screen, ...app] };
})();
