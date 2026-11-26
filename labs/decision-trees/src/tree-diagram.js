(() => {
  'use strict';

  const criterionNames = { entropy: 'Entropy', gini: 'Gini impurity', mse: 'MSE' };

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[character]);
  }

  function rounded(value) {
    return String(Number(value.toFixed(3)));
  }

  function defaultCondition({ feature, threshold }) {
    return feature.toUpperCase() + (feature === 'y' ? ' = ' : ' ≤ ') + threshold;
  }

  function describeTree(node, path = 'root') {
    if (!node.split) return { node, path, leaves: 1 };
    const yes = describeTree(node.left, path + 'l');
    const no = describeTree(node.right, path + 'r');
    return { node, path, yes, no, leaves: yes.leaves + no.leaves };
  }

  function drawCard(item, options, branch) {
    const { node, path } = item;
    const { criterion, selectedPath, traced, interactive, showScore,
      classLabels, sampleNoun, formatCondition } = options;
    const { n, auto, review, score, prediction } = node.stats;
    const root = path === 'root';
    const leaf = !node.split;
    const onPath = traced.has(path);
    const role = root ? (leaf ? 'Root and leaf' : 'Root') : (leaf ? 'Leaf' : 'Decision node');
    const outcome = classLabels[prediction];
    const condition = node.split && formatCondition(node.split);
    const title = node.split ? condition + '?' : 'Predict ' +
      (criterion === 'mse' ? rounded(prediction) + ' min' : outcome);
    const impurity = criterionNames[criterion] + ' ' + rounded(score) +
      (criterion === 'entropy' ? (score === 1 ? ' bit' : ' bits') : (criterion === 'mse' ? ' min²' : ''));
    const samples = n + ' ' + sampleNoun + (n === 1 ? '' : 's');
    const classes = ['dt-node', root && 'dt-node--root', leaf && 'dt-node--leaf',
      onPath && 'dt-node--traced'].filter(Boolean).join(' ');
    const tag = interactive ? 'button' : 'div';
    const label = [branch && branch + ' branch', role, title, samples, showScore && impurity,
      criterion !== 'mse' && auto + ' ' + classLabels[0] + ', ' + review + ' ' + classLabels[1],
      onPath && 'On traced path'].filter(Boolean).join('. ');
    const attrs = interactive
      ? ' type="button" data-node="' + path + '" aria-pressed="' + String(path === selectedPath) +
        '" aria-label="' + escapeHtml(label) + '"'
      : ' role="group" aria-label="' + escapeHtml(label) + '"';
    const mix = criterion === 'mse' ? '' : '<span class="dt-mix" aria-hidden="true">' +
      '<span class="dt-mix-bar" style="--dt-auto:' + (100 * auto / n) + '%"></span>' +
      '<span class="dt-mix-labels"><span><i class="dt-mark" aria-hidden="true"></i>' + auto +
      ' ' + escapeHtml(classLabels[0]) + '</span><span><i class="dt-mark dt-mark--review" aria-hidden="true"></i>' + review +
      ' ' + escapeHtml(classLabels[1]) + '</span></span></span>';
    return '<' + tag + ' class="' + classes + '"' + attrs + '>' +
      '<span class="dt-node-top"><span class="dt-node-role">' + role +
      '</span><span class="dt-node-samples">' + samples + '</span></span>' +
      '<strong class="dt-node-title">' + escapeHtml(title) + '</strong>' +
      (showScore ? '<span class="dt-node-score">' + impurity + '</span>' : '') + mix +
      (onPath ? '<span class="dt-node-path" aria-hidden="true">On path</span>' : '') +
      '</' + tag + '>';
  }

  function draw(item, options, branch) {
    const card = drawCard(item, options, branch);
    if (!item.yes) return '<div class="dt-subtree">' + card + '</div>';
    const { yes, no } = item;
    const firstWidth = 100 * yes.leaves / item.leaves;
    const edges = [[yes, 'Yes', firstWidth / 2], [no, 'No', (100 + firstWidth) / 2]];
    const lines = edges.map(([child, , x]) => '<path class="dt-edge' +
      (options.traced.has(item.path) && options.traced.has(child.path) ? ' dt-edge--traced' : '') +
      '" vector-effect="non-scaling-stroke" d="M50 0 V9 Q50 23 ' + x +
      ' 23 V53"></path>').join('');
    const branches = edges.map(([child, direction]) => '<div class="dt-child' +
      (options.traced.has(child.path) ? ' dt-child--traced' : '') +
      '"><span class="dt-answer">' + direction + '</span>' + draw(child, options, direction) + '</div>').join('');
    return '<div class="dt-subtree">' + card +
      '<div class="dt-branches" style="--dt-yes:' + yes.leaves + 'fr;--dt-no:' + no.leaves + 'fr">' +
      '<svg class="dt-edges" viewBox="0 0 100 53" preserveAspectRatio="none" aria-hidden="true" focusable="false">' +
      lines + '</svg>' + branches + '</div></div>';
  }

  function render(tree, {
    criterion = 'entropy', selectedPath = 'root', tracedPaths = [], interactive = true, showScore = true,
    classLabels = ['Auto', 'Review'], sampleNoun = 'parcel', formatCondition = defaultCondition,
  } = {}) {
    const item = describeTree(tree);
    const options = { criterion, selectedPath, traced: new Set(tracedPaths), interactive, showScore,
      classLabels, sampleNoun, formatCondition };
    return '<div class="dt-viewport"><div class="dt-graph' +
      (item.leaves > 4 ? ' dt-graph--dense' : '') +
      '" role="group" aria-label="Decision tree diagram">' +
      draw(item, options) + '</div></div>';
  }

  globalThis.TreeLabDiagram = { render };
})();
