(() => {
  'use strict';

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[character]);
  }

  function spine(tree, focusPaths) {
    const levels = [[{ node: tree, path: 'root' }]];
    let current = levels[0][0];

    while (current.node.split) {
      const yes = { node: current.node.left, path: current.path + 'l', answer: 'Yes' };
      const no = { node: current.node.right, path: current.path + 'r', answer: 'No' };
      // Keep the continuing decision in the first lane so every depth stays legible.
      const followNo = focusPaths?.has(no.path) || (!focusPaths?.has(yes.path) && no.node.split && !yes.node.split);
      const level = followNo ? [no, yes] : [yes, no];
      if (!focusPaths && level[1].node.split) {
        throw new RangeError('The deep-tree diagram requires one continuing branch per level.');
      }
      levels.push(level);
      current = level[0];
    }
    return levels;
  }

  function drawNode({ node, path, answer }, depth, focused, { featureFocus, credits, criterion, tracedPaths }) {
    const creditMode = featureFocus != null;
    const regression = !creditMode && criterion === 'mse';
    const onPath = regression && tracedPaths.has(path);
    const feature = node.split?.feature;
    const selected = path === focused;
    const contributes = creditMode && feature === featureFocus;
    const state = creditMode ? 'context' : selected ? 'parent'
      : path === focused + 'l' || path === focused + 'r' ? 'child' : 'context';
    const note = { parent: 'Scoring parent', child: 'Scoring child', context: 'Context only' }[state];
    const prediction = regression ? Number(node.stats.prediction.toFixed(3)) + ' rentals'
      : node.stats.prediction === 1 ? 'Spam' : 'Legitimate';
    const description = node.split
      ? feature.toUpperCase() + (feature === 'y' ? ' = ' : ' ≤ ') + node.split.threshold + '?'
        : 'Predict ' + prediction;
    const score = String(Number(node.stats.score.toFixed(3)));
    const noun = regression ? 'hour' : 'email';
    const count = node.stats.n + ' ' + noun + (node.stats.n === 1 ? '' : 's');
    const role = path === 'root' ? 'Root' : node.split ? 'Decision node' : 'Leaf';
    const scoreLabel = regression ? 'Mean squared error ' + score + ' rentals squared'
      : 'Entropy ' + score + (score === '1' ? ' bit' : ' bits');
    const credit = creditMode && node.split ? credits?.get(path) : undefined;
    const creditLabel = Number.isFinite(credit) ? credit.toFixed(4) + ' bits' : '';
    const creditNote = [
      selected && 'Selected split',
      contributes && 'Contributes to ' + featureFocus.toUpperCase(),
      creditLabel && 'Root-weighted credit ' + creditLabel,
    ].filter(Boolean).join('. ');
    const summary = [role, 'Depth ' + depth, answer && answer + ' branch',
      description.replace(/\?$/, ''), count, scoreLabel, creditMode ? creditNote : note,
      onPath && 'On the hour path'].filter(Boolean).join('. ');
    const tag = node.split ? 'button' : 'div';
    const attributes = node.split
      ? ' type="button" data-deep-node="' + path + '" aria-pressed="' + selected + '"' +
        (creditMode ? ' data-feature="' + escapeHtml(feature) + '"' : '')
      : ' role="group"';
    const classes = 'deep-graph-card deep-graph-card--' + state +
      (contributes ? ' is-contributor' : '') + (creditMode && selected ? ' is-focus' : '') +
      (onPath ? ' is-traced' : '');
    const cardNote = creditMode
      ? (creditLabel ? '<span class="deep-graph-card-note deep-graph-credit">Credit ' + creditLabel + '</span>' : '')
      : (state === 'context' ? '' : '<span class="deep-graph-card-note">' + note + '</span>');
    return '<' + tag + ' class="' + classes + '"' + attributes +
      ' aria-label="' + escapeHtml(summary) + '">' +
      '<span class="deep-graph-card-title">' + escapeHtml(description) + '</span>' +
      '<span class="deep-graph-card-data"><span>' + count +
      '</span><span><span aria-hidden="true">' + (regression ? 'MSE ' : 'H ') + '</span>' + score +
      (regression ? ' rentals²' : '') + '</span></span>' + cardNote +
      (onPath ? '<span class="deep-graph-path">Forecast path</span>' : '') + '</' + tag + '>';
  }

  function drawFork(children, active, tracedPaths) {
    const lines = ['M25 0 V34', 'M25 0 V4 Q25 9 30 9 H71 Q75 9 75 14 V34'];
    return '<div class="deep-graph-fork' + (active ? ' deep-graph-fork--scored' : '') + '">' +
      '<div class="deep-graph-lines">' +
      '<svg viewBox="0 0 100 34" preserveAspectRatio="none" aria-hidden="true" focusable="false">' +
      children.map((child, i) => '<path' + (tracedPaths?.has(child.path) ? ' class="deep-graph-edge--traced"' : '') +
        ' d="' + lines[i] + '" vector-effect="non-scaling-stroke"></path>').join('') +
      '</svg>' +
      children.map(child => '<span class="deep-graph-answer' +
        (tracedPaths?.has(child.path) ? ' deep-graph-answer--traced' : '') + '">' + child.answer + '</span>').join('') +
      '</div></div>';
  }

  function render(tree, selectedPath = 'root', options = {}) {
    const { featureFocus, criterion } = options;
    const creditMode = featureFocus != null;
    const regression = !creditMode && criterion === 'mse';
    const tracedPaths = regression ? new Set(options.tracedPaths) : null;
    const nodeOptions = regression ? { ...options, tracedPaths } : options;
    const focusPath = regression && !tracedPaths.has(selectedPath) ? selectedPath : null;
    const focusPaths = regression ? (focusPath
      ? new Set(Array.from({ length: focusPath.length - 3 }, (_, index) => focusPath.slice(0, index + 4)))
      : tracedPaths) : null;
    const levels = spine(tree, focusPaths);
    const decisionPaths = levels.map(([first]) => first).filter(({ node }) => node.split).map(({ path }) => path);
    const focused = decisionPaths.includes(selectedPath) ? selectedPath : creditMode ? null : decisionPaths[0];
    const rows = levels.map((level, depth) => {
      const parentPath = depth ? levels[depth - 1][0].path : null;
      const fork = depth ? drawFork(level, !creditMode && parentPath === focused,
        tracedPaths?.has(parentPath) ? tracedPaths : null) : '';
      return fork + '<div class="deep-graph-row">' +
        '<span class="deep-graph-depth"><span>Depth</span><strong>' + depth + '</strong></span>' +
        level.map(item => '<div class="deep-graph-slot">' + drawNode(item, depth, focused, nodeOptions) + '</div>').join('') + '</div>';
    }).join('');

    if (creditMode) {
      return '<figure class="deep-graph deep-graph--credits" data-feature="' + escapeHtml(featureFocus) +
        '" aria-label="Fitted entropy tree showing root-weighted credit at each split">' +
        '<figcaption class="deep-graph-key">' +
        '<span><i class="deep-graph-keymark deep-graph-keymark--focus" aria-hidden="true"></i>Selected split</span>' +
        '<span><i class="deep-graph-keymark deep-graph-keymark--contributor" aria-hidden="true"></i>Uses ' +
        escapeHtml(featureFocus.toUpperCase()) + '</span></figcaption>' +
        '<p class="deep-graph-caption">The first column follows the continuing splits. H is entropy in bits.</p>' +
        '<div class="deep-graph-board">' + rows + '</div></figure>';
    }

    const diagramLabel = regression ? 'Fitted regression tree showing the scoring nodes and hour path'
      : 'Fitted entropy tree, with the three nodes used to score a split highlighted';
    const metric = regression ? 'MSE is mean squared error, measured in rentals².' : 'H is entropy in bits.';
    return '<figure class="deep-graph' + (regression ? ' deep-graph--regression' : '') +
      '" aria-label="' + diagramLabel + '">' +
      '<figcaption class="deep-graph-key">' +
      '<span><i class="deep-graph-keymark deep-graph-keymark--parent" aria-hidden="true"></i>Scoring parent</span>' +
      '<span><i class="deep-graph-keymark deep-graph-keymark--child" aria-hidden="true"></i>Immediate children</span>' +
      (regression ? '<span><i class="deep-graph-keymark deep-graph-keymark--path" aria-hidden="true"></i>Forecast path</span>'
        : '<span><i class="deep-graph-keymark deep-graph-keymark--context" aria-hidden="true"></i>Context only</span>') +
      '</figcaption><p class="deep-graph-caption">The first column follows the continuing splits. ' + metric + '</p>' +
      '<div class="deep-graph-board">' + rows + '</div></figure>';
  }

  globalThis.TreeLabDeepDiagram = { render };
})();
