(() => {
  'use strict';

  const { TRAIN, HOLDOUT, entropy, stats, candidates, evaluate, rank, fit, predict, trace: traceTree, confusion, importance } = TreeLab;
  const get = id => document.getElementById(id);
  const all = selector => [...document.querySelectorAll(selector)];
  const write = (id, html) => { get(id).innerHTML = html; };
  const number = (value, precision = 3) => Number(value.toFixed(precision)).toString();
  const percent = value => value == null ? 'Undefined' : number(value * 100, 1) + '%';
  const route = label => label === 1 ? 'Review' : 'Auto';
  const name = criterion => ({ entropy: 'Entropy', gini: 'Gini', mse: 'MSE' })[criterion];
  const question = split => split.feature === 'x' ? 'X ≤ ' + split.threshold : 'Y = ' + split.threshold;
  const key = split => split.feature + ':' + split.threshold;
  const ratio = (numerator, denominator) => denominator ? numerator / denominator : null;
  const correctCount = (tree, rows) => rows.filter(row => predict(tree, row) === row.label).length;
  const counts = group => group.auto + ' Auto · ' + group.review + ' Review';
  const rowCount = n => n + (n === 1 ? ' row' : ' rows');
  const chips = (rows, feature) => '<div class="parcel-chips">' + rows.map(row => {
    const inputs = feature ? feature.toUpperCase() + ' ' + row[feature] : 'X ' + row.x + ' · Y ' + row.y;
    return '<span class="chip"><i class="key ' + (row.label ? 'review' : 'auto') +
      '" aria-hidden="true"></i><span>' + row.id + ' · ' + inputs + '<span class="sr-only"> ' +
      route(row.label) + '</span></span></span>';
  }).join('') + '</div>';
  const previewParcel = { x: 7, y: 'A' };

  const criterionInput = get('criterion');
  const searchInput = get('search-mode');
  const candidateInput = get('candidate');
  const depthInput = get('tree-depth');
  const minLeafInput = get('min-leaf');
  const stopLeafInput = get('stop-min-leaf');
  const traceInput = get('trace-parcel');
  const probabilityInput = get('review-probability');
  const regressionInput = get('regression-cutoff');
  const matrixLabels = { tn: 'True negative', fp: 'False positive', fn: 'False negative', tp: 'True positive' };
  const binEdges = new Set([2.5, 4.5, 6.5]);
  const selected = { candidate: 'x:3.5', node: 'root', matrix: null };
  let results = [];
  let currentTree;

  function setupNavigation() {
    const chapters = all('.chapter');
    const links = all('.chapters a');
    const menu = get('chapter-select');
    const previous = get('previous-chapter');
    const next = get('next-chapter');
    const teaching = get('teaching-view');
    let index = 0;
    let frame;

    function sync(active) {
      index = active;
      menu.value = chapters[index].id;
      previous.disabled = index === 0;
      next.disabled = index === chapters.length - 1;
      links.forEach((link, i) => {
        if (i === index) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
    }

    function onScroll() {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        const boundary = get('chapter-select').getBoundingClientRect().bottom + 68;
        const visible = chapters.findLastIndex(chapter => chapter.getBoundingClientRect().top <= Math.max(145, boundary));
        const atBottom = Math.ceil(window.scrollY + window.innerHeight) >= document.documentElement.scrollHeight;
        sync(atBottom ? chapters.length - 1 : Math.max(0, visible));
      });
    }

    function goTo(target) {
      const chapter = chapters[target];
      if (!chapter) return;
      history.pushState(null, '', '#' + chapter.id);
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      chapter.scrollIntoView({ behavior: reducedMotion ? 'instant' : 'smooth' });
      sync(target);
    }

    menu.addEventListener('change', () => goTo(chapters.findIndex(chapter => chapter.id === menu.value)));
    previous.addEventListener('click', () => goTo(index - 1));
    next.addEventListener('click', () => goTo(index + 1));
    teaching.addEventListener('click', () => {
      const chapter = chapters[index];
      const enabled = document.body.classList.toggle('teaching');
      teaching.setAttribute('aria-pressed', String(enabled));
      chapter.scrollIntoView({ behavior: 'instant' });
      onScroll();
    });
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    sync(0);
    onScroll();
  }

  function renderTraining() {
    const position = weight => 110 + (weight - 1) * 75;
    const marks = TRAIN.map(row => {
      const x = position(row.x);
      const y = row.y === 'A' ? 37 : 88;
      const title = '<title>' + row.id + ', weight ' + row.x + ', packaging ' + row.y + ', ' + route(row.label) + '</title>';
      const point = row.label
        ? '<rect class="review" x="' + (x - 7) + '" y="' + (y - 7) + '" width="14" height="14" rx="2">' + title + '</rect>'
        : '<circle class="auto" cx="' + x + '" cy="' + y + '" r="7">' + title + '</circle>';
      return point + '<text text-anchor="middle" x="' + x + '" y="' + (y - 13) + '">' + row.id + '</text>';
    }).join('');
    write('training-plot', '<svg class="training-chart" viewBox="0 0 695 140" role="img" aria-label="Training parcels by weight and packaging. Packaging A has Auto parcels at weights 1 and 7. Packaging B has Auto at 2 and 3 and Review at 4, 5, 6 and 8.">' +
      '<text x="6" y="44">A</text><text x="6" y="95">B</text>' +
      '<path class="grid" d="M 49 37 H 660 M 49 88 H 660"></path>' + marks +
      TRAIN.map(row => '<text text-anchor="middle" x="' + position(row.x) + '" y="126">' + row.x + '</text>').join('') + '</svg>');
    write('training-rows', TRAIN.map(row => '<tr><th scope="row">' + row.id + '</th><td>' +
      row.x + '</td><td>' + row.y + '</td><td>' + route(row.label) + '</td><td>' + row.minutes + '</td></tr>').join(''));
    const nearby = TRAIN.filter(row => Math.abs(row.x - previewParcel.x) <= 1);
    write('preview-records', nearby.map(row => '<tr><th scope="row">' + row.id + '</th><td>' +
      row.x + '</td><td>' + row.y + '</td><td>' + route(row.label) + '</td></tr>').join('') +
      '<tr class="preview-new-record"><th scope="row">New parcel</th><td>' + previewParcel.x +
      '</td><td>' + previewParcel.y + '</td><td>Unknown</td></tr>');
    all('[data-guess]').forEach(button => button.addEventListener('click', () => {
      all('[data-guess]').forEach(choice => choice.setAttribute('aria-pressed', String(choice === button)));
      get('guess-result').textContent = button.dataset.guess === '0'
        ? 'The fitted two-question tree also predicts Auto. Follow its path to see where packaging matters.'
        : 'The first weight question puts this parcel in a mostly Review branch. The second question checks packaging and the fitted tree predicts Auto.';
      get('parcel-walkthrough').open = true;
    }));
  }

  function trace(tree, row) {
    const traced = traceTree(tree, row);
    const steps = traced.steps.map(({ split, yes }) => question(split) + '? ' + (yes ? 'Yes' : 'No') +
      ' (' + split.feature.toUpperCase() + ' is ' + row[split.feature] + ')');
    return { ...traced, steps };
  }

  function routeDetails(traced, row, includeLabel) {
    const { steps, leaf } = traced;
    const routeMarkup = steps.length ? '<ol>' + steps.map(step => '<li>' + step + '</li>').join('') + '</ol>' :
      '<p>The root is also the leaf, so there are no questions to answer.</p>';
    const labelMarkup = includeLabel ? ' · Recorded route <strong>' + route(row.label) + '</strong>' : '';
    return routeMarkup + '<p>Predict <strong>' + route(leaf.prediction) + '</strong>' + labelMarkup +
      '</p><p class="small">Leaf label shares: ' + percent(leaf.auto / leaf.n) +
      ' Auto · ' + percent(leaf.review / leaf.n) + ' Review (' + rowCount(leaf.n) + ').</p>';
  }

  function renderParcelPreview() {
    const tree = fit(TRAIN, 'entropy', 2);
    const traced = trace(tree, previewParcel);
    write('preview-tree', TreeLabDiagram.render(tree, {
      criterion: 'entropy', selectedPath: null, tracedPaths: traced.paths, interactive: false,
    }));
    write('preview-route', routeDetails(traced, previewParcel, false));
  }

  function renderEntropy() {
    const p = Number(probabilityInput.value) / 100;
    const result = entropy(p);
    const x = share => 44 + share * 315;
    const y = bits => 183 - bits * 145;
    const coords = Array.from({ length: 81 }, (_, i) => {
      const share = i / 80;
      return number(x(share), 2) + ',' + number(y(entropy(share)), 2);
    }).join(' ');
    get('review-percent').textContent = percent(p);
    probabilityInput.setAttribute('aria-valuetext', percent(p) + ' Review');
    get('probability-bar').firstElementChild.style.width = percent(p);
    write('surprise-rows', [['Auto', 1 - p], ['Review', p]].map(([label, share]) => {
      const surprise = share <= 0 ? null : -Math.log2(share);
      return '<tr><th scope="row">' + label + '</th><td>' + number(share) + '</td><td>' +
        (surprise === null ? '∞' : number(surprise)) + '</td><td>' +
        (surprise === null ? '0' : number(share * surprise)) + '</td></tr>';
    }).join(''));
    const entropyLabel = number(result) + (result === 1 ? ' bit' : ' bits');
    get('entropy-total').textContent = entropyLabel;
    write('entropy-plot', '<svg class="chart" viewBox="0 0 395 228" role="img" aria-label="Binary entropy, zero at 0 and 100 percent, highest at 50 percent. At ' +
      percent(p) + ' Review the entropy is ' + entropyLabel + '.">' +
      '<text x="44" y="20">Entropy (bits)</text><path class="grid" d="M 44 38 H 359 M 44 111 H 359"></path>' +
      '<path class="axis" d="M 44 38 V 183 H 359" fill="none"></path>' +
      '<text x="34" y="43" text-anchor="end">1</text><text x="34" y="188" text-anchor="end">0</text>' +
      '<polyline class="curve" points="' + coords + '"></polyline>' +
      '<line class="cut" x1="' + x(p) + '" y1="' + y(result) + '" x2="' + x(p) + '" y2="183"></line>' +
      '<circle class="marker" cx="' + x(p) + '" cy="' + y(result) + '" r="6"></circle>' +
      '<text x="44" y="206" text-anchor="middle">0%</text><text x="202" y="206" text-anchor="middle">50%</text>' +
      '<text x="359" y="206" text-anchor="middle">100%</text><text x="202" y="225" text-anchor="middle">Review share</text></svg>');
  }

  function groupFormula(group, criterion) {
    const shares = [group.auto, group.review];
    if (criterion === 'gini') return '1 − ' + shares.map(count => '(' + count + '/' + group.n + ')²').join(' − ');
    const parts = shares.filter(count => count > 0).map(count => {
      const p = count + '/' + group.n;
      return '(' + p + ') log₂(' + p + ')';
    });
    return '−[' + parts.join(' + ') + ']';
  }

  function calculation(result, criterion) {
    const left = result.leftStats;
    const right = result.rightStats;
    const parent = result.parent;
    return '<p><strong>Weighted child ' + name(criterion) + '</strong> <span class="arithmetic">(' +
      left.n + '/' + parent.n + ') × ' + number(left.score) + ' + (' + right.n + '/' + parent.n + ') × ' +
      number(right.score) + ' ≈ ' + number(result.weighted) + '</span></p>' +
      '<p><strong>' + (criterion === 'entropy' ? 'Information gain' : name(criterion) + ' reduction') +
      '</strong> <span class="arithmetic">' + number(parent.score) + ' − ' + number(result.weighted) +
      ' ≈ ' + number(result.gain) + '</span></p>';
  }

  function renderCandidates() {
    const criterion = criterionInput.value;
    results = rank(TRAIN, criterion).filter(result => searchInput.value === 'exact' ||
      result.split.feature === 'y' || binEdges.has(result.split.threshold));
    const order = [...results].sort((a, b) =>
      a.split.feature.localeCompare(b.split.feature) || Number(a.split.threshold) - Number(b.split.threshold));
    if (!results.some(result => key(result.split) === selected.candidate)) selected.candidate = key(results[0].split);
    candidateInput.innerHTML = order.map(result => '<option value="' + key(result.split) + '">' +
      question(result.split) + '</option>').join('');
    candidateInput.value = selected.candidate;
    showCandidate();
  }

  function showCandidate() {
    const criterion = criterionInput.value;
    const result = results.find(entry => key(entry.split) === selected.candidate);
    renderSplitPlot(result);
    renderWeightedVisual(result, criterion);
    const child = (label, rows, group) => '<div class="child ' + label.toLowerCase() + '"><h3>' + label +
      ' · ' + rowCount(group.n) + '</h3>' + chips(rows, result.split.feature) + '<p>' + counts(group) + '</p>' +
      '<p class="arithmetic">' + groupFormula(group, criterion) + ' ≈ ' + number(group.score) + '</p></div>';
    write('split-children', child('Yes', result.left, result.leftStats) + child('No', result.right, result.rightStats));
    write('split-calculation', '<div class="calc-lines"><p><strong>Parent ' + name(criterion) +
      '</strong> <span class="arithmetic">' + groupFormula(result.parent, criterion) + ' = ' +
      number(result.parent.score) + '</span></p>' + calculation(result, criterion) +
      '<p class="small">Scores and gains are computed before rounding.</p></div>');
    write('ranking', results.map((entry, index) => {
      const active = key(entry.split) === selected.candidate;
      return '<tr' + (active ? ' class="is-selected"' : '') + '><th scope="row">' + question(entry.split) +
        (index === 0 ? ' · Best' : '') + '</th><td>' + entry.left.length + ' / ' +
        entry.right.length + '</td><td>' + number(entry.weighted) + '</td><td>' + number(entry.gain) + '</td></tr>';
    }).join(''));
    get('rank-summary').textContent = 'Compare ' + results.length + ' candidate gains';
  }

  function renderSplitPlot(result) {
    const { split, left, right } = result;
    const x = weight => 82 + (weight - 1) * 72;
    const top = 37;
    const height = 94;
    const width = 550;
    const finish = 610;
    const isNumeric = split.feature === 'x';
    const cutoff = isNumeric ? x(split.threshold) : 0;
    const rect = (branch, start, y, w, h) => '<rect class="region region-' + branch + '" x="' + start +
      '" y="' + y + '" width="' + w + '" height="' + h + '"></rect>';
    const text = (label, cx, y) => '<text x="' + cx + '" y="' + y + '" text-anchor="middle">' + label + '</text>';
    const regions = isNumeric
      ? rect('yes', 60, top, cutoff - 60, height) + rect('no', cutoff, top, finish - cutoff, height) +
        '<line class="cut" x1="' + cutoff + '" x2="' + cutoff + '" y1="' + top + '" y2="' + (top + height) +
        '"></line>' + text('Yes', (60 + cutoff) / 2, 25) + text('No', (cutoff + finish) / 2, 25)
      : rect('yes', 60, top, width, height / 2) + rect('no', 60, top + height / 2, width, height / 2) +
        text('Yes', 645, 64) + text('No', 645, 111);
    const marks = TRAIN.map(row => {
      const cx = x(row.x);
      const cy = row.y === 'A' ? 61 : 108;
      const title = '<title>' + row.id + ' · ' + route(row.label) + '</title>';
      return row.label ? '<rect class="mark-review" x="' + (cx - 7) + '" y="' + (cy - 7) +
        '" width="14" height="14" rx="2">' + title + '</rect>' :
        '<circle class="mark-auto" cx="' + cx + '" cy="' + cy + '" r="7">' + title + '</circle>';
    }).join('');
    write('split-plot', '<svg class="chart split-chart" viewBox="0 0 675 176" role="img" aria-label="Split ' +
      question(split) + '. Yes: ' + left.map(row => row.id).join(', ') +
      '. No: ' + right.map(row => row.id).join(', ') + '.">' + regions +
      '<path class="grid" d="M 60 61 H 610 M 60 108 H 610"></path>' +
      text('A', 30, 66) + text('B', 30, 113) + marks +
      TRAIN.map(row => text(row.x, x(row.x), 151)).join('') + text('Weight X', 335, 173) + '</svg>');
  }

  function renderWeightedVisual(result, criterion, target = 'weighted-visual', precision = 3) {
    const impurity = name(criterion);
    const regression = criterion === 'mse';
    const max = regression ? Math.max(result.parent.score, result.leftStats.score, result.rightStats.score) || 1 :
      criterion === 'entropy' ? 1 : 0.5;
    const unit = regression ? ' min²' : '';
    const scale = regression ? number(max, precision) + unit + ' for this split' : criterion === 'entropy' ? '1 bit' : '0.5 Gini';
    const total = result.parent.n;
    const bands = [['Yes', result.leftStats], ['No', result.rightStats]];
    const diagram = bands.map(([label, group]) => {
      const share = group.n / total;
      return '<div class="weighted-segment weighted-' + label.toLowerCase() + '" style="width:' +
        (share * 100) + '%"><span class="weighted-fill" style="height:' + (group.score / max * 100) +
        '%"></span><span class="weighted-edge-label">' + label + '</span></div>';
    }).join('');
    const contributions = bands.map(([label, group]) => '<div class="weighted-legend-item"><span class="weighted-swatch weighted-' +
      label.toLowerCase() + '" aria-hidden="true"></span><span><strong>' + label + ' contribution</strong> <span class="arithmetic">' +
      group.n + '/' + total + ' × ' + number(group.score, precision) + ' ≈ ' +
      number(group.n / total * group.score, precision) + unit +
      '</span></span></div>').join('');
    write(target, '<figcaption><strong>See the weighted average</strong><span class="small">Width is the child’s share of rows. Height is its ' +
      (regression ? impurity : impurity.toLowerCase()) + '. Full height represents ' + scale +
      '. Each shaded area represents that child’s contribution.</span></figcaption>' +
      '<div class="weighted-areas" aria-hidden="true">' + diagram + '</div>' +
      '<div class="weighted-legend">' + contributions + '</div>');
  }

  function rebuildTree() {
    currentTree = fit(TRAIN, criterionInput.value, Number(depthInput.value), Number(minLeafInput.value));
    stopLeafInput.value = minLeafInput.value;
    selected.node = 'root';
    const criterion = criterionInput.value;
    const correct = correctCount(currentTree, TRAIN);
    write('tree-summary', '<strong>' + name(criterion) + ' tree</strong> · ' + correct + '/' +
      TRAIN.length + ' training parcels routed correctly');
    renderTree();
    renderEvaluation();
    renderDepthComparison();
    renderImportance();
  }

  function renderTree() {
    const records = new Map();
    const criterion = criterionInput.value;
    const parcel = [...TRAIN, ...HOLDOUT].find(row => row.id === traceInput.value);
    const traced = trace(currentTree, parcel);

    function index(node, rows, path, depth) {
      const split = node.split ? evaluate(rows, node.split, criterion) : null;
      records.set(path, { node, rows, depth, split });
      if (split) {
        index(node.left, split.left, path + 'l', depth + 1);
        index(node.right, split.right, path + 'r', depth + 1);
      }
    }

    index(currentTree, TRAIN, 'root', 0);
    write('tree-diagram', TreeLabDiagram.render(currentTree, {
      criterion, selectedPath: selected.node, tracedPaths: traced.paths,
    }));
    write('traced-route', routeDetails(traced, parcel, true));

    const record = records.get(selected.node);
    const { node, rows, depth, split } = record;
    const role = depth === 0 ? (split ? 'Root decision' : 'Root leaf') : (split ? 'Decision node' : 'Leaf');
    const heading = '<h3>' + role + ' · Depth ' + depth + '</h3><p>' + counts(node.stats) + ' · ' +
      name(criterion) + ' ' + number(node.stats.score) + '</p>';
    const score = split ? '<div class="calc-lines node-calculation">' + calculation(split, criterion) + '</div>' :
      '<p class="small">' + leafReason(node, depth) +
      (node.stats.auto === node.stats.review ? ' This lab resolves a class tie as Auto.' : '') + '</p>';
    write('node-details', heading + chips(rows) + score);
  }

  function leafReason(node, depth) {
    if (node.stats.score === 0) return 'Pure node: all its training rows have the same label.';
    if (depth >= Number(depthInput.value)) return 'The tree reached its maximum depth here.';
    if (node.stats.n < 2 * Number(minLeafInput.value)) return 'Too few rows to make two children of the required size.';
    return 'No eligible question improves impurity here.';
  }

  function renderDepthComparison() {
    const criterion = criterionInput.value;
    const minLeaf = Number(minLeafInput.value);
    function metric(correct, size) {
      return '<span class="accuracy-bar" aria-hidden="true"><span style="width:' + percent(correct / size) +
        '"></span></span><span>' + correct + '/' + size + '</span>';
    }
    const depths = [0, 1, 2, 3].map(depth => {
      const tree = fit(TRAIN, criterion, depth, minLeaf);
      return { depth, training: correctCount(tree, TRAIN), holdout: correctCount(tree, HOLDOUT) };
    });
    const rows = depths.map(({ depth, training, holdout }) => {
      const active = depth === Number(depthInput.value);
      return '<tr' + (active ? ' class="is-selected"' : '') +
        '><th scope="row"><button type="button" class="depth-button" data-stop-depth="' + depth +
        '" aria-label="Set maximum depth to ' + depth + '" aria-pressed="' + active + '">' + depth +
        '</button></th><td>' + metric(training, TRAIN.length) +
        '</td><td>' + metric(holdout, HOLDOUT.length) + '</td></tr>';
    });
    write('depth-comparison', '<div class="table-wrap"><table><caption class="sr-only">' +
      'Accuracy by maximum depth with current impurity criterion and minimum leaf size</caption>' +
      '<thead><tr><th scope="col">Max depth</th><th scope="col">Training</th><th scope="col">Held out</th></tr></thead><tbody>' +
      rows.join('') + '</tbody></table></div>');
    const [, shallow, deeper] = depths;
    get('depth-reading').textContent = shallow.training < deeper.training && shallow.holdout > deeper.holdout
      ? 'Look at depths 1 and 2. Training improves from ' + shallow.training + '/' + TRAIN.length + ' to ' +
        deeper.training + '/' + TRAIN.length + ', while held-out accuracy drops from ' + shallow.holdout + '/' +
        HOLDOUT.length + ' to ' + deeper.holdout + '/' + HOLDOUT.length + '. Choose depth 1 between these two settings on this sample.'
      : 'Changing the minimum leaf size can block some splits even when the depth limit would allow them. Compare held-out results across the settings.';
  }

  function renderEvaluation() {
    const totals = confusion(currentTree, HOLDOUT);
    const view = HOLDOUT.map(row => {
      const prediction = predict(currentTree, row);
      const cell = row.label ? (prediction ? 'tp' : 'fn') : (prediction ? 'fp' : 'tn');
      return { row, prediction, cell };
    });
    all('[data-cell]').forEach(button => {
      const cell = button.dataset.cell;
      button.querySelector('strong').textContent = totals[cell];
      button.setAttribute('aria-pressed', String(cell === selected.matrix));
    });
    const entries = [
      ['Accuracy', (totals.tp + totals.tn) / HOLDOUT.length],
      ['Precision', ratio(totals.tp, totals.tp + totals.fp)],
      ['Recall', ratio(totals.tp, totals.tp + totals.fn)],
    ];
    write('evaluation-metrics', entries.map(([label, value]) => '<div><span>' + label +
      '</span><strong>' + percent(value) + '</strong></div>').join(''));
    const filtered = selected.matrix ? view.filter(item => item.cell === selected.matrix) : view;
    get('show-all').hidden = !selected.matrix;
    write('evaluation-model', '<strong>Current tree</strong> · ' + name(criterionInput.value) +
      ' · Maximum depth ' + depthInput.value + ' · Minimum leaf size ' + minLeafInput.value +
      ' · <a href="#tree">Change the tree settings</a>');
    get('heldout-title').textContent = selected.matrix ? matrixLabels[selected.matrix] + ' parcels' : 'All held-out parcels';
    write('heldout-rows', filtered.length ? filtered.map(({ row, prediction }) => '<tr><th scope="row">' + row.id +
      '<br><a href="#tree" data-trace="' + row.id + '" aria-label="Trace held-out parcel ' + row.id +
      ' through the tree">Trace</a></th><td>' + row.x + '</td><td>' + row.y + '</td><td>' + route(row.label) +
      '</td><td>' + route(prediction) + '</td></tr>').join('') : '<tr><td colspan="5">No parcels in this cell.</td></tr>');
    get('heldout-note').textContent = 'Showing ' + filtered.length + ' of ' + view.length + ' held-out parcels.';
  }

  function renderImportance() {
    const credit = importance(currentTree);
    write('importance-model', '<strong>Current tree</strong> · ' + name(criterionInput.value) +
      ' · Maximum depth ' + depthInput.value + ' · Minimum leaf size ' + minLeafInput.value +
      ' · <a href="#tree">Inspect its nodes</a>');
    write('importance-bars', [['x', 'Weight X'], ['y', 'Packaging Y']].map(([feature, label]) => {
      const share = credit.total ? credit[feature] / credit.total : 0;
      return '<div class="importance-row"><span>' + label + '</span><div class="importance-meter" aria-hidden="true">' +
        '<span style="width:' + percent(share) + '"></span></div><strong>' + (credit.total ? percent(share) : 'None') + '</strong></div>';
    }).join(''));
    const nodes = [];
    function collect(node) {
      if (!node.split) return node.stats.n / TRAIN.length * node.stats.score;
      nodes.push(node);
      return collect(node.left) + collect(node.right);
    }
    const leafImpurity = collect(currentTree);
    write('importance-rows', nodes.length ? nodes.map(node => '<tr><th scope="row">' + question(node.split) +
      '</th><td>' + node.stats.n + '/' + TRAIN.length + '</td><td>' + number(node.gain) + '</td><td class="arithmetic">' +
      '(' + node.stats.n + '/' + TRAIN.length + ') × ' + number(node.gain) + ' ≈ ' +
      number(node.gain * node.stats.n / TRAIN.length) + '</td></tr>').join('') :
      '<tr><td colspan="4">The current tree has no splits to credit.</td></tr>');
    const chosen = credit.y > 0 ? ['Packaging Y', credit.y] : ['Weight X', credit.x];
    const share = credit.total ? '<p><strong>' + chosen[0] + ' share</strong> <span class="arithmetic">' +
      number(chosen[1]) + ' ÷ ' + number(credit.total) + ' ≈ ' + percent(chosen[1] / credit.total) + '</span></p>' : '';
    write('importance-math', '<p><strong>Root score − weighted leaf score</strong> <span class="arithmetic">' +
      number(currentTree.stats.score) + ' − ' + number(leafImpurity) + ' ≈ ' + number(credit.total) + '</span></p>' + share);
    get('importance-note').textContent = credit.total ? 'The tree-wide reduction is the sum of the split credits. Each feature’s percentage uses that sum as its denominator.' :
      'With no impurity reduction to divide up, there are no percentage shares.';
  }

  function renderRegression() {
    const threshold = Number(regressionInput.value);
    const result = evaluate(TRAIN, { feature: 'x', threshold }, 'mse');
    const x = weight => 52 + (weight - 1) * 68;
    const y = minutes => 224 - minutes * 20;
    const cutoff = x(threshold);
    const { left, right, leftStats, rightStats, parent } = result;
    const step = 'M ' + x(1) + ' ' + y(leftStats.mean) + ' H ' + cutoff +
      ' M ' + cutoff + ' ' + y(rightStats.mean) + ' H ' + x(8);
    const marks = TRAIN.map(row => {
      const mean = row.x <= threshold ? leftStats.mean : rightStats.mean;
      return '<line class="residual" x1="' + x(row.x) + '" y1="' + y(mean) + '" x2="' + x(row.x) +
        '" y2="' + y(row.minutes) + '"></line><circle class="observation" cx="' + x(row.x) +
        '" cy="' + y(row.minutes) + '" r="5"><title>' + row.id + ' took ' + row.minutes + ' minutes</title></circle>';
    }).join('');
    const grid = [0, 2, 4, 6, 8, 10].map(value => '<line class="grid" x1="52" y1="' + y(value) +
      '" x2="528" y2="' + y(value) + '"></line><text text-anchor="end" x="44" y="' + (y(value) + 4) +
      '">' + value + '</text>').join('');
    write('regression-plot', '<svg class="chart" viewBox="0 0 570 275" role="img" aria-label="Actual processing times as points and predicted means as two horizontal lines. At cutoff ' +
      threshold + ', the means are ' + number(leftStats.mean) + ' and ' + number(rightStats.mean) + ' minutes.">' +
      '<text x="52" y="17">Minutes</text>' + grid + '<line class="cut" x1="' + cutoff + '" x2="' + cutoff +
      '" y1="25" y2="224"></line><path class="prediction" d="' + step + '"></path>' + marks +
      TRAIN.map(row => '<text text-anchor="middle" x="' + x(row.x) + '" y="245">' + row.x + '</text>').join('') +
      '<text text-anchor="middle" x="290" y="268">Weight X</text></svg>');
    function leaf(label, rows, group) {
      const mean = number(group.mean);
      const times = rows.map(row => row.minutes);
      const terms = rows.map(row => '(' + row.minutes + ' − ' + mean + ')²');
      return '<div class="child ' + label.toLowerCase() + '"><h3>' + label +
        ' · Predict ' + mean + ' min</h3><p><strong>Times</strong> ' + rows.map(row => row.minutes).join(', ') +
        '</p><p class="arithmetic"><strong>Mean</strong> (' + times.join(' + ') + ') / ' + group.n + ' ≈ ' + mean +
        ' min</p><p class="arithmetic"><strong>MSE</strong> [' + terms.join(' + ') + '] / ' + group.n +
        ' ≈ ' + number(group.score) + ' min²</p></div>';
    }
    write('regression-calculation', '<div class="split-children">' + leaf('Yes', left, leftStats) +
      leaf('No', right, rightStats) + '</div><div class="calc-lines">' +
      '<p><strong>Parent MSE</strong> <span class="arithmetic">[' +
      TRAIN.map(row => '(' + row.minutes + ' − ' + number(parent.mean) + ')²').join(' + ') + '] / ' + parent.n +
      ' ≈ ' + number(parent.score) + ' min²</span></p>' + calculation(result, 'mse') +
      '<p class="small">Vertical gaps are residuals. Calculations use the exact means before rounding.</p></div>');
    write('regression-tree', TreeLabDiagram.render({
      stats: result.parent,
      split: result.split,
      left: { stats: leftStats, split: null },
      right: { stats: rightStats, split: null },
    }, { criterion: 'mse', interactive: false }));
  }

  setupNavigation();
  renderTraining();
  renderParcelPreview();
  renderEntropy();
  renderCandidates();
  TreeLabDeepExample.init(renderWeightedVisual);
  TreeLabDeepRegression.init(renderWeightedVisual);
  traceInput.innerHTML = [[HOLDOUT, 'Held out'], [TRAIN, 'Training']].map(([rows, label]) =>
    '<optgroup label="' + label + '">' + rows.map(row => '<option value="' + row.id + '">' +
      row.id + ' · X ' + row.x + ', Y ' + row.y + '</option>').join('') + '</optgroup>').join('');
  traceInput.value = 'P7';
  rebuildTree();
  regressionInput.innerHTML = candidates(TRAIN).filter(split => split.feature === 'x').map(split =>
    '<option value="' + split.threshold + '">' + question(split) + '</option>').join('');
  regressionInput.value = '3.5';
  renderRegression();

  probabilityInput.addEventListener('input', renderEntropy);
  get('reset-entropy').addEventListener('click', () => {
    probabilityInput.value = '50';
    renderEntropy();
  });
  criterionInput.addEventListener('change', () => { renderCandidates(); rebuildTree(); });
  searchInput.addEventListener('change', renderCandidates);
  candidateInput.addEventListener('change', () => {
    selected.candidate = candidateInput.value;
    showCandidate();
  });
  get('best-candidate').addEventListener('click', () => {
    selected.candidate = key(results[0].split);
    candidateInput.value = selected.candidate;
    showCandidate();
  });
  depthInput.addEventListener('change', rebuildTree);
  minLeafInput.addEventListener('change', rebuildTree);
  stopLeafInput.addEventListener('change', () => {
    minLeafInput.value = stopLeafInput.value;
    rebuildTree();
  });
  get('depth-comparison').addEventListener('click', event => {
    const button = event.target.closest('[data-stop-depth]');
    if (!button) return;
    depthInput.value = button.dataset.stopDepth;
    rebuildTree();
    get('depth-comparison').querySelector('[data-stop-depth="' + depthInput.value + '"]').focus({ preventScroll: true });
  });
  traceInput.addEventListener('change', renderTree);
  get('tree-diagram').addEventListener('click', event => {
    const button = event.target.closest('[data-node]');
    if (!button) return;
    selected.node = button.dataset.node;
    renderTree();
    get('tree-diagram').querySelector('[data-node="' + selected.node + '"]').focus({ preventScroll: true });
  });
  get('heldout-rows').addEventListener('click', event => {
    const link = event.target.closest('[data-trace]');
    if (!link) return;
    traceInput.value = link.dataset.trace;
    renderTree();
  });
  all('[data-cell]').forEach(button => button.addEventListener('click', () => {
    selected.matrix = selected.matrix === button.dataset.cell ? null : button.dataset.cell;
    renderEvaluation();
  }));
  get('show-all').addEventListener('click', () => {
    selected.matrix = null;
    renderEvaluation();
    document.querySelector('[data-cell="tn"]').focus();
  });
  regressionInput.addEventListener('change', renderRegression);
})();
