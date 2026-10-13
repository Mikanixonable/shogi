// スクリプト一覧: 読み込み順の唯一の定義（castles.html と tools/validate-castles.js が共有する）
window.Kakoi = window.Kakoi || {};
Kakoi.MANIFEST = (() => {
  const core = ['js/core/notation.js'];
  const data = ['js/data/sources.js', 'js/data/taxonomy.js', 'js/data/setups.js', 'js/data/strategies.js', 'js/data/castles-ibisha.js', 'js/data/castles-furibisha.js', 'js/data/tactic-families.js', 'js/data/tactics.js'];
  const vendor = ['js/vendor/three.min.js']; // 立体駒用。UMD（file:// でも読める）を内蔵
  const logic = ['js/core/html.js', 'js/core/position.js', 'js/core/matchup.js', 'js/core/compose.js', 'js/core/compat.js', 'js/core/repository.js', 'js/core/attack-map.js', 'js/core/shape.js', 'js/core/cluster-model.js', 'js/core/validate.js', 'js/core/piece-match.js'];
  const ui = [
    'js/ui/store.js', 'js/ui/segmented.js', 'js/ui/mini-board.js', 'js/ui/family-glyph.js',
    'js/ui/piece-layer-dom.js', 'js/ui/piece-layer-3d.js', 'js/ui/board-view.js', 'js/ui/overlay-view.js',
    'js/ui/rail-view.js', 'js/ui/toolbar-view.js', 'js/ui/stage-view.js', 'js/ui/detail-view.js',
    'js/ui/tactic-nav.js', 'js/ui/tactic-player.js', 'js/ui/tactic-table-view.js', 'js/ui/tactic-rail-view.js', 'js/ui/tactic-stage-view.js', 'js/ui/tactic-detail-view.js',
    'js/ui/cluster-tree-view.js', 'js/ui/cluster-stage-view.js', 'js/ui/cluster-rail-view.js', 'js/ui/cluster-detail-view.js',
    'js/ui/theme-toggle.js', 'js/ui/tools-toggle.js', 'js/ui/toast.js', 'js/ui/hash-link.js',
    'js/ui/matchup-rail-view.js', 'js/ui/matchup-detail-view.js',
  ];
  const modes = ['js/modes/castle-mode.js', 'js/modes/tactic-mode.js', 'js/modes/cluster-mode.js', 'js/modes/matchup-mode.js'];
  const app = ['js/app.js'];
  return { core, data, vendor, logic, ui, modes, app, order: [...core, ...data, ...vendor, ...logic, ...ui, ...modes, ...app] };
})();
