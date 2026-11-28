(() => {
  'use strict';

  const get = id => document.getElementById('u8-' + id);
  const { rows, trees, examples, selectedDepth, splitExamples, test, logistic } =
    JSON.parse(document.getElementById('foundations-unit-8-data').textContent);
  const byId = new Map([...rows.train, ...rows.validation].map(row => [row.id, row]));
  const email = get('email');
  const depth = get('depth');
  const tree = get('tree');
  const scroller = tree.parentElement;
  const chart = get('regions');
  const trainingPoints = get('training-points');
  const logisticBoundary = get('logistic-boundary');
  const maxX = 1.2;
  const maxUppercase = 100;
  const integer = new Intl.NumberFormat('en-US');
  const decimals = new Intl.NumberFormat('en-US', { maximumFractionDigits: 6 });
  const count = value => integer.format(value);
  const value = (feature, measurement) => decimals.format(measurement) + (feature === 'x' ? '%' : '');
  const gain = n => n.toFixed(6);
  const percentage = n => (100 * n).toFixed(2) + '%';
  const label = y => y ? 'Spam' : 'Legitimate';
  const featureName = key => key === 'x' ? 'Exclamation marks' : 'Longest uppercase run';
  const question = node => featureName(node.feature) + ' ≤ ' + value(node.feature, node.threshold);
  const nodeName = id => ['Root', ...id.slice(4).split('').map(step => step === 'L' ? 'Yes' : 'No')].join(' → ');
  const hasChildren = node => Boolean(node.left);
  const set = (id, text) => { get(id).textContent = text; };
  const nodes = new Map();
  let currentNode;
  let plottedRow;
  let root;

  email.replaceChildren(...examples.map(id => new Option(id + ' · Recorded ' + label(byId.get(id).y), id)));
  email.value = examples[0];
  set('e8-run', count(byId.get('E8').uppercase));
  set('e3383-run', count(byId.get('E3383').uppercase));

  function trace(row, node) {
    const path = [];
    while (hasChildren(node)) {
      const yes = row[node.feature] <= node.threshold;
      path.push({ node, yes });
      node = yes ? node.left : node.right;
    }
    path.push({ node });
    return path;
  }

  function buildBranch(node, path) {
    const branch = document.createElement('div');
    branch.className = 'u8-branch';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'u8-node-button';
    button.classList.toggle('u8-on-path', path.has(node.id));
    button.setAttribute('aria-pressed', 'false');
    button.dataset.node = node.id;
    const title = document.createElement('strong');
    title.textContent = hasChildren(node) ? question(node) + '?' : 'Leaf · ' + label(node.prediction);
    const total = document.createElement('small');
    total.textContent = count(node.n) + ' emails · ' + count(node.spam) + ' Spam';
    button.append(title, total);
    button.addEventListener('click', () => inspect(node.id));
    nodes.set(node.id, { node, button });
    branch.append(button);
    if (hasChildren(node)) {
      const children = document.createElement('div');
      children.className = 'u8-children';
      for (const [child, answer] of [[node.left, 'Yes'], [node.right, 'No']]) {
        const item = buildBranch(child, path);
        const edge = document.createElement('span');
        edge.className = 'u8-edge';
        edge.textContent = answer;
        edge.classList.toggle('u8-on-path', path.has(child.id));
        item.prepend(edge);
        children.append(item);
      }
      branch.append(children);
    }
    return branch;
  }

  function centerNode(button) {
    const pane = scroller.getBoundingClientRect();
    const position = button.getBoundingClientRect();
    scroller.scrollLeft += position.left + position.width / 2 - pane.left - pane.width / 2;
  }

  function inspect(id, center = false) {
    const { node, button } = nodes.get(id);
    currentNode = node;
    for (const item of nodes.values()) item.button.setAttribute('aria-pressed', String(item.node === node));
    const title = document.createElement('h4');
    title.textContent = nodeName(node.id);
    const counts = document.createElement('p');
    counts.textContent = count(node.n) + ' training emails · ' + count(node.spam) + ' Spam · ' +
      count(node.legitimate) + ' Legitimate · Gini ' + gain(node.impurity);
    const worked = document.createElement('p');
    worked.textContent = hasChildren(node)
      ? 'Yes gets ' + count(node.left.n) + ' of these ' + count(node.n) + ' rows. No gets ' + count(node.right.n) +
        '. Weighted Gini ' + gain(node.weightedImpurity) + ' gives a local gain of ' + gain(node.gain) + '.'
      : count(node.spam) + ' ÷ ' + count(node.n) + ' ≈ ' + percentage(node.score) + ' Spam score. Predict ' + label(node.prediction) + '.';
    get('node-detail').replaceChildren(title, counts, worked);
    if (center) centerNode(button);
    drawRegions();
  }

  function showTree() {
    const model = trees[depth.value];
    root = model.root;
    plottedRow = byId.get(email.value);
    const path = trace(plottedRow, root);
    const leaf = path.at(-1).node;
    nodes.clear();
    tree.replaceChildren(buildBranch(root, new Set(path.map(({ node }) => node.id))));
    set('email-features', plottedRow.id + ' · ' + value('x', plottedRow.x) + ' exclamation marks · ' +
      count(plottedRow.uppercase) + ' letters in the longest uppercase run.');
    set('email-outcome', 'Predict ' + label(leaf.prediction) + ' · recorded ' + label(plottedRow.y) +
      ' · leaf Spam score ' + count(leaf.spam) + ' ÷ ' + count(leaf.n) + ' ≈ ' + percentage(leaf.score) + '.');
    const { tp, fp, fn, tn } = model.validation;
    set('validation-trace', 'Depth ' + depth.value + ' on validation · ' + count(tp) + ' TP · ' + count(fp) +
      ' FP · ' + count(fn) + ' FN · ' + count(tn) + ' TN · ' + accuracy(model.validation, rows.validation.length) + ' accuracy.');
    get('path').replaceChildren(...path.map(({ node, yes }) => {
      const item = document.createElement('li');
      const step = document.createElement('button');
      step.type = 'button';
      step.className = 'u8-step';
      step.textContent = hasChildren(node)
        ? featureName(node.feature) + ' · ' + value(node.feature, plottedRow[node.feature]) +
          (yes ? ' ≤ ' : ' > ') + value(node.feature, node.threshold) + (yes ? ' · Yes' : ' · No')
        : 'Leaf · Predict ' + label(node.prediction) + ' from ' + count(node.spam) + ' of ' + count(node.n) + ' Spam';
      step.addEventListener('click', () => inspect(node.id, true));
      item.append(step);
      return item;
    }));
    inspect(root.id, true);
  }

  function drawRegions() {
    const { clientWidth: width, clientHeight: height } = chart;
    if (!root || width < 100 || height < 90) return;
    const ctx = chart.getContext('2d');
    if (!ctx) return;
    const scale = window.devicePixelRatio || 1;
    chart.width = Math.round(width * scale);
    chart.height = Math.round(height * scale);
    ctx.scale(scale, scale);
    const left = 39, right = width - 21, top = 15, bottom = height - 43;
    const px = x => left + (right - left) * x / maxX;
    const py = y => bottom - (bottom - top) * y / maxUppercase;
    let selected;
    function paint(node, x0, x1, y0, y1) {
      if (x0 >= x1 || y0 >= y1) return;
      const box = [px(x0), py(y1), px(x1) - px(x0), py(y0) - py(y1)];
      if (node === currentNode) selected = box;
      if (!hasChildren(node)) {
        ctx.fillStyle = node.prediction ? '#f3d5c7' : '#d7eadf';
        ctx.fillRect(...box);
        ctx.strokeStyle = '#81978a';
        ctx.lineWidth = .75;
        ctx.strokeRect(...box);
      } else if (node.feature === 'x') {
        paint(node.left, x0, Math.min(x1, node.threshold), y0, y1);
        paint(node.right, Math.max(x0, node.threshold), x1, y0, y1);
      } else {
        paint(node.left, x0, x1, y0, Math.min(y1, node.threshold));
        paint(node.right, x0, x1, Math.max(y0, node.threshold), y1);
      }
    }
    paint(root, 0, maxX, 0, maxUppercase);
    if (trainingPoints.checked) {
      for (const row of rows.train) {
        if (row.x > maxX || row.uppercase > maxUppercase) continue;
        ctx.fillStyle = row.y ? '#9a4d37a6' : '#176b5c95';
        ctx.fillRect(px(row.x) - 1, py(row.uppercase) - 1, 2, 2);
      }
    }
    if (selected) {
      ctx.strokeStyle = '#624789';
      ctx.lineWidth = 2;
      ctx.strokeRect(...selected);
    }
    if (logisticBoundary.checked) {
      const cutoffY = x => -(logistic.intercept + logistic.weights.x * x) / logistic.weights.uppercase;
      ctx.save();
      ctx.beginPath();
      ctx.rect(left, top, right - left, bottom - top);
      ctx.clip();
      ctx.setLineDash([5, 4]);
      ctx.strokeStyle = '#263e35';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(px(0), py(cutoffY(0)));
      ctx.lineTo(px(maxX), py(cutoffY(maxX)));
      ctx.stroke();
      ctx.restore();
    }
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillStyle = '#445750';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'right';
    for (const y of [0, 25, 50, 75, 100]) ctx.fillText(String(y), left - 7, py(y));
    ctx.textAlign = 'center';
    for (const x of [0, 0.3, 0.6, 0.9, 1.2]) ctx.fillText(value('x', x), px(x), bottom + 15);
    ctx.fillText('Exclamation marks', (left + right) / 2, bottom + 31);
    ctx.beginPath();
    ctx.arc(px(plottedRow.x), py(plottedRow.uppercase), 5.8, 0, 2 * Math.PI);
    ctx.fillStyle = '#624789';
    ctx.fill();
    ctx.strokeStyle = '#fffefa';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  email.addEventListener('change', showTree);
  depth.addEventListener('change', showTree);
  trainingPoints.addEventListener('change', drawRegions);
  logisticBoundary.addEventListener('change', drawRegions);
  if (typeof ResizeObserver === 'function') new ResizeObserver(() => {
    if (currentNode) centerNode(nodes.get(currentNode.id).button);
    drawRegions();
  }).observe(chart);

  function addRow(body, values) {
    const row = get(body).insertRow();
    const heading = document.createElement('th');
    heading.scope = 'row';
    heading.textContent = values[0];
    row.append(heading);
    for (const value of values.slice(1)) row.insertCell().textContent = value;
  }

  const mix = node => count(node.spam) + ' Spam, ' + count(node.legitimate) + ' Legitimate · n = ' + count(node.n);
  const gini = node => '1 − (' + count(node.spam) + ' ÷ ' + count(node.n) + ')² − (' +
    count(node.legitimate) + ' ÷ ' + count(node.n) + ')² ≈ ' + gain(node.impurity);
  function showSplit(id, { parent, candidates, sampleIds }) {
    set(id + '-parent', (id === 'root' ? 'Root' : 'New parent, the root’s Yes child') + ' · ' +
      mix(parent) + '. Parent Gini = ' + gini(parent) + '.');
    for (const [i, candidate] of candidates.entries()) {
      addRow(id + '-rows', [
        String(i + 1) + ' · ' + question(candidate) + '?', mix(candidate.left), mix(candidate.right),
        gain(candidate.weightedImpurity), gain(candidate.gain)
      ]);
      const explanation = document.createElement(i === 0 ? 'div' : 'details');
      const heading = document.createElement(i === 0 ? 'h4' : 'summary');
      heading.textContent = i === 0 ? 'Work through the winning question' : 'Work through the other question';
      const children = document.createElement('p');
      children.textContent = 'Yes child Gini = ' + gini(candidate.left) + '. No child Gini = ' + gini(candidate.right) + '.';
      const weights = document.createElement('p');
      weights.className = 'formula';
      weights.textContent = '(' + count(candidate.left.n) + ' ÷ ' + count(parent.n) + ') × ' +
        gain(candidate.left.impurity) + ' + (' + count(candidate.right.n) + ' ÷ ' + count(parent.n) + ') × ' +
        gain(candidate.right.impurity) + ' ≈ ' + gain(candidate.weightedImpurity);
      const difference = document.createElement('p');
      difference.textContent = 'Gain ≈ ' + gain(parent.impurity) + ' − ' + gain(candidate.weightedImpurity) +
        ' ≈ ' + gain(candidate.gain) + '. The calculations use full precision.';
      explanation.append(heading, children, weights, difference);
      get(id + '-working').append(explanation);
    }
    for (const rowId of sampleIds) {
      const row = byId.get(rowId);
      addRow(id + '-samples', [
        row.id, value('x', row.x), count(row.uppercase), label(row.y),
        ...candidates.map(candidate => row[candidate.feature] <= candidate.threshold ? 'Yes' : 'No')
      ]);
    }
  }
  showSplit('root', splitExamples[0]);
  showSplit('child', splitExamples[1]);

  function accuracy(metrics, n) {
    return '(' + count(metrics.tp) + ' + ' + count(metrics.tn) + ') ÷ ' + count(n) + ' ≈ ' + percentage(metrics.accuracy);
  }
  for (const [depth, model] of Object.entries(trees)) {
    addRow('depth-rows', ['Depth ' + depth, accuracy(model.train, rows.train.length), accuracy(model.validation, rows.validation.length)]);
  }

  const choice = get('lock-depth');
  const lock = get('lock');
  const reveal = get('reveal');
  let locked = false;
  choice.addEventListener('change', () => { lock.disabled = !choice.value; });
  lock.addEventListener('click', () => {
    const candidate = Number(choice.value);
    if (candidate !== selectedDepth) {
      set('lock-feedback', candidate > selectedDepth
        ? 'Depth ' + candidate + ' ties on validation. Follow the rule and choose the shallower depth.'
        : 'Check the validation column. Depth ' + candidate + ' gets fewer emails right than the best depth.');
      return;
    }
    locked = true;
    choice.disabled = true;
    lock.disabled = true;
    reveal.disabled = false;
    set('lock-feedback', 'Depth ' + selectedDepth + ' is locked at ' +
      percentage(trees[String(selectedDepth)].validation.accuracy) + ' validation accuracy.');
  });
  reveal.addEventListener('click', () => {
    if (!locked) return;
    for (const [name, model] of [['Decision tree · Depth ' + selectedDepth, test.tree], ['Two-feature logistic regression', test.logistic]]) {
      addRow('test-rows', [name, count(model.tp), count(model.fp), count(model.fn), count(model.tn), accuracy(model, rows.test.length)]);
    }
    set('test-summary', 'At this cutoff the tree catches ' + count(test.tree.tp) + ' Spam emails and flags ' +
      count(test.tree.fp) + ' Legitimate emails. Logistic regression catches ' + count(test.logistic.tp) +
      ' Spam emails and flags ' + count(test.logistic.fp) + ' Legitimate emails. The tree catches more Spam and raises more false alarms on these emails.');
    get('heldout').hidden = false;
    reveal.setAttribute('aria-expanded', 'true');
    reveal.disabled = true;
    get('heldout').scrollIntoView({ block: 'nearest' });
  });
  showTree();
})();
