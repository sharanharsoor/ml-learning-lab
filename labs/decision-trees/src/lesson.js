(() => {
  'use strict';

  const { TRAIN, HOLDOUT, entropy, stats, candidates, evaluate, rank, fit, predict, confusion, importance } = TreeLab;
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
  const counts = group => group.auto + ' Auto · ' + group.review + ' Review';
  const rowCount = n => n + (n === 1 ? ' row' : ' rows');
  const chip = row => '<span class="chip"><i class="key ' + (row.label ? 'review' : 'auto') +
    '" aria-hidden="true"></i><span>' + row.id + '<span class="sr-only"> ' + route(row.label) + '</span></span></span>';
  const chips = rows => '<div class="parcel-chips">' + rows.map(chip).join('') + '</div>';

  const criterionInput = get('criterion');
  const searchInput = get('search-mode');
  const candidateInput = get('candidate');
  const depthInput = get('tree-depth');
  const minLeafInput = get('min-leaf');
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
      return row.label
        ? '<rect class="review" x="' + (x - 7) + '" y="' + (y - 7) + '" width="14" height="14" rx="2">' + title + '</rect>'
        : '<circle class="auto" cx="' + x + '" cy="' + y + '" r="7">' + title + '</circle>';
    }).join('');
    write('training-plot', '<svg class="training-chart" viewBox="0 0 695 140" role="img" aria-label="Training parcels by weight and packaging. Packaging A has Auto parcels at weights 1 and 7. Packaging B has Auto at 2 and 3 and Review at 4, 5, 6 and 8.">' +
      '<text x="6" y="44">A</text><text x="6" y="95">B</text>' +
      '<path class="grid" d="M 49 37 H 660 M 49 88 H 660"></path>' + marks +
      TRAIN.map(row => '<text text-anchor="middle" x="' + position(row.x) + '" y="126">' + row.x + '</text>').join('') + '</svg>');
    write('training-rows', TRAIN.map(row => '<tr><th scope="row">' + row.id + '</th><td>' +
      row.x + '</td><td>' + row.y + '</td><td>' + route(row.label) + '</td><td>' + row.minutes + '</td></tr>').join(''));
    all('[data-guess]').forEach(button => button.addEventListener('click', () => {
      all('[data-guess]').forEach(choice => choice.setAttribute('aria-pressed', String(choice === button)));
      get('guess-result').textContent = button.dataset.guess === '0'
        ? 'The closest training match went to Auto. Let’s see whether a tree can learn why packaging matters here.'
        : 'Weight alone would send this parcel to Review. The matching training parcel went to Auto, so a second question may help.';
    }));
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
    const child = (label, rows, group) => '<div class="child ' + label.toLowerCase() + '"><h3>' + label +
      ' · ' + rowCount(group.n) + '</h3>' + chips(rows) + '<p>' + counts(group) + '</p>' +
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

  function rebuildTree() {
    currentTree = fit(TRAIN, criterionInput.value, Number(depthInput.value), Number(minLeafInput.value));
    selected.node = 'root';
    const criterion = criterionInput.value;
    const correct = TRAIN.filter(row => predict(currentTree, row) === row.label).length;
    write('tree-summary', '<strong>' + name(criterion) + ' tree</strong> · ' + correct + '/' +
      TRAIN.length + ' training parcels routed correctly');
    renderTree();
    renderEvaluation();
    renderImportance();
  }

  function renderTree() {
    const records = new Map();

    function draw(node, rows, path, branch) {
      records.set(path, { node, rows, branch });
      const title = node.split ? question(node.split) + '?' : 'Predict ' + route(node.stats.prediction);
      const buttons = '<div class="tree-node' + (node.split ? '' : ' leaf') + '">' +
        (branch ? '<span class="branch-name">' + branch + '</span>' : '') +
        '<button type="button" data-node="' + path + '" aria-pressed="' + String(path === selected.node) + '">' +
        '<strong>' + title + '</strong><span>' + rowCount(node.stats.n) + '</span></button>';
      if (!node.split) return buttons + '</div>';
      const result = evaluate(rows, node.split, criterionInput.value);
      return buttons + '<div class="tree-children">' +
        draw(node.left, result.left, path + 'l', 'Yes') + draw(node.right, result.right, path + 'r', 'No') +
        '</div></div>';
    }

    function inspect(path) {
      selected.node = path;
      const { node, rows, branch } = records.get(path);
      const criterion = criterionInput.value;
      all('[data-node]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.node === path)));
      write('node-details', '<h3>' + (node.split ? question(node.split) + '?' : route(node.stats.prediction) + ' leaf') +
        (branch ? ' · ' + branch + ' branch' : ' · Root') + '</h3><p>' + counts(node.stats) + ' · ' +
        name(criterion) + ' ' + number(node.stats.score) + '</p>' +
        (node.split
          ? '<p class="small">Weighted child score ' + number(node.stats.score - node.gain) + ' · Local gain ' + number(node.gain) + '</p>'
          : '<p class="small">' + (node.stats.score === 0 ? 'All labels agree here.' :
            node.stats.auto === node.stats.review ? 'A class tie is routed to Auto in this lab.' :
              'This leaf routes to its majority class.') + '</p>') + chips(rows));
    }

    write('tree-diagram', draw(currentTree, TRAIN, 'root', null));
    get('tree-diagram').onclick = event => {
      const button = event.target.closest('[data-node]');
      if (button) inspect(button.dataset.node);
    };
    inspect(selected.node);
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
    get('heldout-title').textContent = selected.matrix ? matrixLabels[selected.matrix] + ' parcels' : 'All held-out parcels';
    write('heldout-rows', filtered.length ? filtered.map(({ row, prediction }) => '<tr><th scope="row">' + row.id +
      ' <span class="small">· ' + row.x + ', ' + row.y + '</span></th><td>' + route(row.label) +
      '</td><td>' + route(prediction) + '</td></tr>').join('') : '<tr><td colspan="3">No parcels in this cell.</td></tr>');
    get('heldout-note').textContent = 'Showing ' + filtered.length + ' of ' + view.length + ' held-out parcels.';
  }

  function renderImportance() {
    const credit = importance(currentTree);
    write('importance-bars', [['x', 'Weight X'], ['y', 'Packaging Y']].map(([feature, label]) => {
      const share = credit.total ? credit[feature] / credit.total : 0;
      return '<div class="importance-row"><span>' + label + '</span><div class="importance-meter" aria-hidden="true">' +
        '<span style="width:' + percent(share) + '"></span></div><strong>' + (credit.total ? percent(share) : 'None') + '</strong></div>';
    }).join(''));
    const nodes = [];
    function collect(node) {
      if (!node.split) return;
      nodes.push(node);
      collect(node.left);
      collect(node.right);
    }
    collect(currentTree);
    write('importance-rows', nodes.length ? nodes.map(node => '<tr><th scope="row">' + question(node.split) +
      '</th><td>' + node.stats.n + '/' + TRAIN.length + '</td><td>' + number(node.gain) + '</td><td>' +
      number(node.gain * node.stats.n / TRAIN.length) + '</td></tr>').join('') :
      '<tr><td colspan="4">The current tree has no splits to credit.</td></tr>');
    get('importance-note').textContent = credit.total ? 'Total root-weighted credit: ' + number(credit.total) +
      '. Feature shares use this total as their denominator.' : 'Increase depth to see how a split earns credit.';
  }

  function renderRegression() {
    const threshold = Number(regressionInput.value);
    const result = evaluate(TRAIN, { feature: 'x', threshold }, 'mse');
    const x = weight => 52 + (weight - 1) * 68;
    const y = minutes => 224 - minutes * 20;
    const cutoff = x(threshold);
    const { left, right, leftStats, rightStats } = result;
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
      const terms = rows.map(row => '(' + row.minutes + ' − ' + mean + ')²');
      return '<div class="child ' + label.toLowerCase() + '"><h3>' + label +
        ' · Predict ' + mean + ' min</h3><p><strong>Times</strong> ' + rows.map(row => row.minutes).join(', ') +
        '</p><p class="arithmetic">[' + terms.join(' + ') + '] / ' + group.n +
        ' ≈ ' + number(group.score) + ' min²</p></div>';
    }
    write('regression-calculation', '<div class="split-children">' + leaf('Yes', left, leftStats) +
      leaf('No', right, rightStats) + '</div><div class="calc-lines">' +
      '<p><strong>Parent MSE</strong> <span class="arithmetic">[(2 − 5)² + (2 − 5)² + (2 − 5)² + (6 − 5)² + (8 − 5)² + (8 − 5)² + (4 − 5)² + (8 − 5)²] / 8 = 7</span></p>' +
      calculation(result, 'mse') + '<p class="small">Orange points show actual times. Teal lines show the two predictions. Vertical gaps are residuals.</p></div>');
  }

  setupNavigation();
  renderTraining();
  renderEntropy();
  renderCandidates();
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
