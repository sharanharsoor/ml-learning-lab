(() => {
  'use strict';

  const { IMPORTANCE_TRAIN, fit, importance } = TreeLab;
  const scope = document.getElementById('deep-importance');
  const limit = scope.querySelector('#importance-depth');
  const graph = scope.querySelector('#importance-diagram');
  const selectedSplit = scope.querySelector('#importance-selected-split');
  const creditList = scope.querySelector('#importance-split-credits');
  const featureTotal = scope.querySelector('#importance-feature-total');
  const featureButtons = [...scope.querySelectorAll('[data-importance-feature]')];
  const names = { x: 'Weight X', y: 'Packaging Y', z: 'Scan score Z' };
  const rootCount = IMPORTANCE_TRAIN.length;
  const number = value => value.toFixed(4);
  const percent = (value, digits = 2) => (100 * value).toFixed(digits) + '%';
  const question = split => split.feature.toUpperCase() +
    (split.feature === 'y' ? ' = ' : ' ≤ ') + split.threshold + '?';

  function splitRecords(tree) {
    const records = [];
    function visit(node, path, depth) {
      if (!node.split) return;
      records.push({
        node, path, depth, feature: node.split.feature,
        credit: node.stats.n / tree.stats.n * node.gain,
      });
      visit(node.left, path + 'l', depth + 1);
      visit(node.right, path + 'r', depth + 1);
    }
    visit(tree, 'root', 0);
    return records;
  }

  const trees = new Map([4, 5].map(depth => [depth, fit(IMPORTANCE_TRAIN, 'entropy', depth)]));
  const maxCredit = Math.max(...splitRecords(trees.get(5)).map(record => record.credit));
  let selectedFeature = 'x';
  let selectedPath = 'rootlr';
  let records = [];

  function renderSplit(record) {
    if (!record) {
      selectedSplit.innerHTML = '<h3>' + names[selectedFeature] + '</h3><p>No split uses this feature at this depth limit.</p>';
      return;
    }
    const { node, depth, feature, credit } = record;
    const n = node.stats.n;
    const left = node.left.stats;
    const right = node.right.stats;
    const reach = n / rootCount;
    const term = child => '(' + child.n + '/' + n + ') × ' + number(child.score);
    const factor = (label, value, detail) => '<div class="importance-factor"><span>' + label +
      '</span><strong>' + value + '</strong><small>' + detail + '</small></div>';
    selectedSplit.innerHTML = '<h3>Depth ' + depth + ' · ' + question(node.split) + '</h3>' +
      '<p class="small">Local gain uses the ' + n + ' rows at this node. Subtract its children’s weighted entropy from its own entropy.</p>' +
      '<p class="arithmetic">' + number(node.stats.score) + ' − [' + term(left) + ' + ' + term(right) + '] ≈ ' +
      number(node.gain) + ' bits</p>' +
      '<div class="importance-flow" data-feature="' + feature + '">' +
      factor('Local gain', number(node.gain), 'bits') + '<span class="importance-operator">×</span>' +
      factor('Root share', n + '/' + rootCount, percent(reach, 0)) + '<span class="importance-operator">≈</span>' +
      factor('Split credit', number(credit), 'bits') + '</div>' +
      '<div class="importance-root-share" data-feature="' + feature + '"><span class="small">' + n +
      ' of ' + rootCount + ' root rows reach this split</span><span class="importance-reach" aria-hidden="true">' +
      '<span class="importance-reach-fill" style="width:' + (100 * reach) + '%"></span></span></div>';
  }

  function render() {
    const tree = trees.get(Number(limit.value));
    records = splitRecords(tree);
    const gains = importance(tree);
    const matching = records.filter(record => record.feature === selectedFeature);
    if (!matching.some(record => record.path === selectedPath)) selectedPath = matching[0]?.path ?? null;
    const selected = matching.find(record => record.path === selectedPath);
    const credits = new Map(records.map(record => [record.path, record.credit]));
    graph.innerHTML = TreeLabDeepDiagram.render(tree, selectedPath, { featureFocus: selectedFeature, credits });
    renderSplit(selected);

    const share = feature => (gains[feature] ?? 0) / gains.total;
    featureButtons.forEach(button => {
      const feature = button.dataset.importanceFeature;
      button.setAttribute('aria-pressed', String(feature === selectedFeature));
      button.querySelector('span').textContent = ' ' + percent(share(feature));
    });

    creditList.innerHTML = records.map(record => {
      const { depth, feature, path, node, credit } = record;
      const active = path === selectedPath;
      return '<li class="importance-credit-row' + (feature === selectedFeature ? ' is-contributor' : '') +
        '" data-feature="' + feature + '"' + (active ? ' aria-current="true"' : '') + '>' +
        '<button type="button" class="importance-credit-label" data-credit-node="' + path +
        '" aria-pressed="' + active + '"><span class="importance-credit-rule">Depth ' + depth + ' · ' +
        question(node.split) + '</span><small class="importance-credit-inputs">' + number(node.gain) +
        ' × ' + node.stats.n + '/' + rootCount + '</small>' +
        '</button><strong>' + number(credit) + ' bits</strong><span class="importance-credit-meter" aria-hidden="true">' +
        '<span style="width:' + (credit / maxCredit * 100) + '%"></span></span></li>';
    }).join('');

    featureTotal.dataset.feature = selectedFeature;
    const rawCredit = gains[selectedFeature] ?? 0;
    const addends = matching.map(record => number(record.credit));
    const rawLine = addends.length
      ? '<p class="arithmetic">' + addends.join(' + ') + ' ≈ ' + number(rawCredit) + ' bits</p>'
      : '<p class="arithmetic">0 bits</p>';
    const sumBar = matching.map(record => '<span style="width:' +
      (100 * record.credit / gains.total) + '%"></span>').join('');
    featureTotal.innerHTML = '<h3>' + names[selectedFeature] + ' total · ' + matching.length +
      (matching.length === 1 ? ' split' : ' splits') + '</h3>' + rawLine +
      '<div class="importance-sum-meter" aria-hidden="true">' + sumBar + '</div>' +
      '<p>Share of all split credit <strong class="arithmetic">' + number(rawCredit) + ' ÷ ' +
      number(gains.total) + ' ≈ ' + percent(share(selectedFeature)) + '</strong></p>' +
      '<p class="small">Calculated before rounding.</p>';
  }

  scope.querySelector('#importance-training-rows').innerHTML = IMPORTANCE_TRAIN.map(row =>
    '<tr><th scope="row">' + row.x + '</th><td>' + row.y + '</td><td>' + row.z +
    '</td><td>' + (row.label ? 'Review' : 'Auto') + '</td></tr>').join('');

  limit.addEventListener('change', render);
  featureButtons.forEach(button => button.addEventListener('click', () => {
    selectedFeature = button.dataset.importanceFeature;
    render();
  }));
  function selectNode(event, container, attribute) {
    const button = event.target.closest('[' + attribute + ']');
    if (!button) return;
    const path = button.getAttribute(attribute);
    const record = records.find(candidate => candidate.path === path);
    selectedPath = path;
    selectedFeature = record.feature;
    render();
    container.querySelector('[' + attribute + '="' + path + '"]').focus({ preventScroll: true });
  }
  graph.addEventListener('click', event => selectNode(event, graph, 'data-deep-node'));
  creditList.addEventListener('click', event => selectNode(event, creditList, 'data-credit-node'));
  render();
})();
