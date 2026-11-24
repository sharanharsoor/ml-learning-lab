(() => {
  'use strict';

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[character]);
  }

  function spine(tree) {
    const levels = [[{ node: tree, path: 'root' }]];
    let current = levels[0][0];

    while (current.node.split) {
      const yes = { node: current.node.left, path: current.path + 'l', answer: 'Yes' };
      const no = { node: current.node.right, path: current.path + 'r', answer: 'No' };
      // Keep the continuing decision in the first lane so every depth stays legible.
      const level = no.node.split && !yes.node.split ? [no, yes] : [yes, no];
      if (level[1].node.split) {
        throw new RangeError('The deep-tree diagram requires one continuing branch per level.');
      }
      levels.push(level);
      current = level[0];
    }
    return levels;
  }

  function drawNode({ node, path, answer }, depth, focused) {
    const state = path === focused ? 'parent'
      : path === focused + 'l' || path === focused + 'r' ? 'child' : 'context';
    const note = { parent: 'Scoring parent', child: 'Scoring child', context: 'Context only' }[state];
    const description = node.split?.feature === 'x' ? 'X ≤ ' + node.split.threshold + '?'
      : node.split ? 'Y = ' + node.split.threshold + '?'
        : 'Predict ' + (node.stats.prediction === 1 ? 'Review' : 'Auto');
    const score = String(Number(node.stats.score.toFixed(3)));
    const count = node.stats.n + (node.stats.n === 1 ? ' parcel' : ' parcels');
    const role = path === 'root' ? 'Root' : node.split ? 'Decision node' : 'Leaf';
    const entropy = 'Entropy ' + score + (score === '1' ? ' bit' : ' bits');
    const summary = [role, 'Depth ' + depth, answer && answer + ' branch',
      description.replace(/\?$/, ''), count, entropy, note].filter(Boolean).join('. ');
    const tag = node.split ? 'button' : 'div';
    const attributes = node.split
      ? ' type="button" data-deep-node="' + path + '" aria-pressed="' + String(state === 'parent') + '"'
      : ' role="group"';
    return '<' + tag + ' class="deep-graph-card deep-graph-card--' + state + '"' + attributes +
      ' aria-label="' + escapeHtml(summary) + '">' +
      '<span class="deep-graph-card-title">' + escapeHtml(description) + '</span>' +
      '<span class="deep-graph-card-data"><span>' + count +
      '</span><span><span aria-hidden="true">H </span>' + score + '</span></span>' +
      (state === 'context' ? '' : '<span class="deep-graph-card-note">' + note + '</span>') +
      '</' + tag + '>';
  }

  function drawFork(children, active) {
    return '<div class="deep-graph-fork' + (active ? ' deep-graph-fork--scored' : '') + '">' +
      '<div class="deep-graph-lines">' +
      '<svg viewBox="0 0 100 34" preserveAspectRatio="none" aria-hidden="true" focusable="false">' +
      '<path d="M25 0 V34" vector-effect="non-scaling-stroke"></path>' +
      '<path d="M25 0 V4 Q25 9 30 9 H71 Q75 9 75 14 V34" vector-effect="non-scaling-stroke"></path>' +
      '</svg>' +
      children.map(child => '<span class="deep-graph-answer">' + child.answer + '</span>').join('') +
      '</div></div>';
  }

  function render(tree, selectedPath = 'root') {
    const levels = spine(tree);
    const decisionPaths = levels.map(([first]) => first).filter(({ node }) => node.split).map(({ path }) => path);
    const focused = decisionPaths.includes(selectedPath) ? selectedPath : decisionPaths[0];
    const rows = levels.map((level, depth) => {
      const fork = depth ? drawFork(level, levels[depth - 1][0].path === focused) : '';
      return fork + '<div class="deep-graph-row">' +
        '<span class="deep-graph-depth"><span>Depth</span><strong>' + depth + '</strong></span>' +
        level.map(item => '<div class="deep-graph-slot">' + drawNode(item, depth, focused) + '</div>').join('') + '</div>';
    }).join('');

    return '<figure class="deep-graph" aria-label="Fitted entropy tree, with the three nodes used to score a split highlighted">' +
      '<figcaption class="deep-graph-key">' +
      '<span><i class="deep-graph-keymark deep-graph-keymark--parent" aria-hidden="true"></i>Scoring parent</span>' +
      '<span><i class="deep-graph-keymark deep-graph-keymark--child" aria-hidden="true"></i>Immediate children</span>' +
      '<span><i class="deep-graph-keymark deep-graph-keymark--context" aria-hidden="true"></i>Context only</span>' +
      '</figcaption><p class="deep-graph-caption">The first column follows the continuing splits. H is entropy in bits.</p>' +
      '<div class="deep-graph-board">' + rows + '</div></figure>';
  }

  globalThis.TreeLabDeepDiagram = { render };
})();
