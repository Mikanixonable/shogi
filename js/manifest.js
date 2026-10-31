// スクリプト一覧: 読み込み順の唯一の定義（index.html と tools/validate-castles.js が共有する）
window.Kakoi = window.Kakoi || {};
Kakoi.MANIFEST = (() => {
  const core = ['js/core/notation.js', 'js/core/piece-moves.js'];
  const data = ['js/data/sources.js', 'js/data/taxonomy.js', 'js/data/setups.js', 'js/data/strategies.js', 'js/data/castles-ibisha.js', 'js/data/castles-furibisha.js', 'js/data/tactic-families.js', 'js/data/tactics.js', 'js/data/tactic-ratings.js'];
  const vendor = ['js/vendor/three.min.js']; // 立体駒用。UMD（file:// でも読める）を内蔵
  const logic = ['js/core/lookup.js', 'js/core/lru.js', 'js/core/html.js', 'js/core/position.js', 'js/core/defaults.js', 'js/core/matchup.js', 'js/core/compose.js', 'js/core/compat.js', 'js/core/constraints.js', 'js/core/board-model.js', 'js/core/repository.js', 'js/core/attack-map.js', 'js/core/validate.js', 'js/core/piece-match.js'];
  const ui = [
    'js/ui/store.js', 'js/ui/segmented.js', 'js/ui/mini-board.js', 'js/ui/family-glyph.js', 'js/ui/cites.js',
    'js/ui/kaya-art.js', 'js/ui/piece-layer-dom.js', 'js/ui/piece-layer-3d.js', 'js/ui/board-view.js', 'js/ui/overlay-view.js',
    'js/ui/toolbar-view.js',
    'js/ui/detail-sections.js', 'js/ui/board-detail-view.js',
    'js/ui/tactic-nav.js',
    'js/ui/theme-toggle.js', 'js/ui/tools-toggle.js', 'js/ui/toast.js', 'js/ui/hash-link.js',
    'js/ui/constraint-bar.js', 'js/ui/roving.js',
    'js/ui/dock-grids.js', 'js/ui/dock-badges.js', 'js/ui/dock-view.js',
    'js/ui/about-modal.js',
  ];
  const modes = ['js/modes/keyboard-nav.js', 'js/modes/board-screen.js', 'js/modes/constraint-mode.js'];
  const app = ['js/app.js'];
  return { core, data, vendor, logic, ui, modes, app, order: [...core, ...data, ...vendor, ...logic, ...ui, ...modes, ...app] };
})();
