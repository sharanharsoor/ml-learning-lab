(() => {
  'use strict';

  const get = id => document.getElementById('bag-' + id);
  const { rows, email, samples, perturbationId } = JSON.parse(get('data').textContent);
  const rowMap = new Map(rows.map(row => [row.id, row]));
  const classLabels = ['Legitimate', 'Spam'];
  const labelName = label => classLabels[label];
  const tone = label => label ? 'review' : 'auto';
  const featureName = { x: 'Dollar signs', z: 'Exclamation marks' };
  const fmt = value => String(Number(value.toFixed(4)));
  const percent = value => Number((value * 100).toFixed(1)) + '%';
  const frequency = value => fmt(value) + '%';
  const mean = values => values.reduce((sum, value) => sum + value, 0) / values.length;
  const question = split => featureName[split.feature] + ' ≤ ' + frequency(split.threshold);
  const measurements = row => 'Dollar signs ' + frequency(row.x) + ' · Exclamation marks ' + frequency(row.z);
  const badge = label => '<span class="bag-badge ' + tone(label) + '">' + labelName(label) + '</span>';
  const sampleRows = sample => sample.draws.map(id => rowMap.get(id));
  const emailTableRows = (records, predict) => records.map(({ id, x, z, label }) =>
    `<tr><th scope="row">${id}</th><td>${frequency(x)}</td><td>${frequency(z)}</td>
      <td>${badge(label)}</td>${predict ? '<td>' + badge(Number(x > 0)) + '</td>' : ''}</tr>`).join('');
  const treeMarkup = (tree, tracedPaths, formatCondition = question) => TreeLabDiagram.render(tree,
    { criterion: 'gini', tracedPaths, interactive: false, showScore: false,
      classLabels, sampleNoun: 'draw', formatCondition });
  const traces = samples.map(({ tree }) => TreeLab.trace(tree, email));
  const probabilities = traces.map(({ leaf }) => leaf.review / leaf.n);
  const drawCounts = ids => {
    const counts = new Map();
    for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
    return counts;
  };

  function pathText(steps) {
    return steps.map(({ split, yes }) => frequency(email[split.feature]) + ' ' +
      (yes ? '≤' : '>') + ' ' + frequency(split.threshold) + ' (' +
      featureName[split.feature] + ', ' + (yes ? 'Yes' : 'No') + ')').join(' → ') || 'Root is already a leaf';
  }

  function plotScale(feature) {
    const top = Math.max(email[feature], ...rows.map(row => row[feature])) || 1;
    const rough = top / 4;
    const power = 10 ** Math.floor(Math.log10(rough));
    const unit = [1, 2, 2.5, 5, 10].find(value => value * power >= rough) * power;
    return Array.from({ length: Math.ceil(top / unit) + 1 }, (_, index) => index * unit);
  }

  function setupNavigation() {
    const chapters = [...document.querySelectorAll('.chapter')];
    const menu = get('chapter');
    const previous = get('previous');
    const next = get('next');
    const teaching = get('teaching');
    const labels = {
      agenda: 'Agenda', ensemble: 'Ensemble models', bootstrap: 'Bootstrap sampling',
      forest: 'Forest intuition and code', diversity: 'Diverse trees', 'base-learners': 'Base learners',
      variance: 'Why variance falls', implementation: 'Fit and tune', 'randomized-search': 'Randomized Search',
      oob: 'Out-of-bag scoring', interview: 'Interview questions',
    };
    get('nav').innerHTML = chapters.map(({ id }) =>
      '<li><a href="#' + id + '">' + labels[id] + '</a></li>').join('');
    menu.innerHTML = chapters.map(({ id }) =>
      '<option value="' + id + '">' + labels[id] + '</option>').join('');
    const links = [...get('nav').querySelectorAll('a')];
    let active = -1;

    function goTo(index, move = true) {
      if (index < 0 || index >= chapters.length) index = 0;
      if (index === active) return;
      active = index;
      const selected = chapters[index];
      chapters.forEach((chapter, i) => { chapter.hidden = i !== index; });
      links.forEach((link, i) => {
        if (i === index) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
      menu.value = selected.id;
      previous.disabled = index === 0;
      next.disabled = index === chapters.length - 1;
      if (move) {
        window.scrollTo({ top: 0, behavior: 'instant' });
        const heading = document.getElementById(selected.getAttribute('aria-labelledby'));
        heading.setAttribute('tabindex', '-1');
        heading.focus({ preventScroll: true });
      }
    }

    function jump(index) {
      if (index < 0 || index >= chapters.length || index === active) return;
      const hash = '#' + chapters[index].id;
      if (location.protocol === 'file:') location.hash = hash;
      else history.pushState(null, '', hash);
      goTo(index);
    }

    const hashIndex = () => chapters.findIndex(chapter => '#' + chapter.id === location.hash);
    menu.addEventListener('change', () => jump(chapters.findIndex(chapter => chapter.id === menu.value)));
    previous.addEventListener('click', () => jump(active - 1));
    next.addEventListener('click', () => jump(active + 1));
    links.forEach((link, i) => link.addEventListener('click', event => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      jump(i);
    }));
    window.addEventListener('popstate', () => goTo(hashIndex()));
    window.addEventListener('hashchange', () => goTo(hashIndex()));
    teaching.addEventListener('click', () => {
      const on = document.body.classList.toggle('teaching');
      teaching.setAttribute('aria-pressed', String(on));
    });
    goTo(hashIndex(), false);
  }

  function scatter(sample, reveal) {
    const xTicks = plotScale('x');
    const zTicks = plotScale('z');
    const xMax = xTicks.at(-1);
    const zMax = zTicks.at(-1);
    const x = value => 54 + 286 * value / xMax;
    const z = value => 226 - 209 * value / zMax;
    const line = (a, b, c, d, css) =>
      '<line class="' + css + '" x1="' + a + '" y1="' + b + '" x2="' + c + '" y2="' + d + '"/>';
    function regions(tree, bounds) {
      const [left, right, bottom, top] = bounds;
      if (!tree.split) {
        return '<rect class="bag-area ' + tone(tree.stats.prediction) + '" x="' + x(left) +
          '" y="' + z(top) + '" width="' + (x(right) - x(left)) + '" height="' + (z(bottom) - z(top)) + '"/>';
      }
      const { feature, threshold: t } = tree.split;
      if (feature === 'x') return regions(tree.left, [left, t, bottom, top]) +
        regions(tree.right, [t, right, bottom, top]) + line(x(t), z(top), x(t), z(bottom), 'bag-cut');
      return regions(tree.left, [left, right, bottom, t]) +
        regions(tree.right, [left, right, t, top]) + line(x(left), z(t), x(right), z(t), 'bag-cut');
    }
    const grid = xTicks.map(t => line(x(t), z(zMax), x(t), z(0), 'bag-grid') +
      '<text x="' + x(t) + '" y="243" text-anchor="middle">' + fmt(t) + '</text>').join('') +
      zTicks.map(t => line(x(0), z(t), x(xMax), z(t), 'bag-grid') +
        '<text x="47" y="' + (z(t) + 4) + '" text-anchor="end">' + fmt(t) + '</text>').join('');
    const counts = drawCounts(sample.draws);
    const marks = rows.map(row => {
      const px = x(row.x), py = z(row.z);
      const mark = row.label === 0 ? '<circle cx="' + px + '" cy="' + py + '" r="4.8"' :
        '<rect x="' + (px - 3.8) + '" y="' + (py - 3.8) + '" width="7.6" height="7.6" transform="rotate(45 ' + px + ' ' + py + ')"';
      const tag = row.label === 0 ? 'circle' : 'rect';
      const count = counts.get(row.id) ?? 0;
      return mark + ' class="bag-point ' + tone(row.label) + (count ? '' : ' is-omitted') + '"><title>' +
        row.id + ' · ' + labelName(row.label) + ' · ' + count + ' in this tray</title></' + tag + '>';
    }).join('');
    const px = x(email.x), py = z(email.z);
    const focus = '<circle class="bag-new-mark" cx="' + px + '" cy="' + py +
      '" r="9"/>' + line(px - 5, py, px + 5, py, 'bag-cross') + line(px, py - 5, px, py + 5, 'bag-cross');
    const root = sample.tree.split;
    const firstCut = root.feature === 'x' ? line(x(root.threshold), z(zMax), x(root.threshold), z(0), 'bag-cut') :
      line(x(0), z(root.threshold), x(xMax), z(root.threshold), 'bag-cut');
    return '<svg class="bag-scatter" viewBox="0 0 360 268" role="img" aria-label="Labeled emails by dollar-sign and exclamation-mark frequency. ' +
      (reveal ? 'This tree predicts ' + labelName(sample.prediction) + ' for email ' + email.id + '.' : 'The first split is ' + question(root) + '.') +
      '">' + grid + (reveal ? regions(sample.tree, [0, xMax, 0, zMax]) : firstCut) + marks + focus +
      '<text x="197" y="262" text-anchor="middle" class="bag-axis">Dollar signs (% of characters)</text>' +
      '<text transform="translate(14 120) rotate(-90)" text-anchor="middle" class="bag-axis">Exclamation marks (% of characters)</text></svg>';
  }

  function setupRule() {
    const control = get('test-rule');
    const result = get('rule-result');
    const legit = rows.find(row => row.label === 0 && row.x > 0);
    const spam = rows.find(row => row.label === 1 && row.x === 0);
    get('desk-examples').innerHTML = emailTableRows([legit, spam], true);
    get('rule-takeaway').textContent = 'This rule flags legitimate email ' + legit.id +
      ' because it has a dollar sign. It misses spam email ' + spam.id + ' because it has none. ' +
      'Compare each prediction with the ground truth to see both errors.';
    control.addEventListener('click', () => {
      const open = result.hidden;
      result.hidden = !open;
      control.setAttribute('aria-expanded', String(open));
      control.textContent = open ? 'Hide the rule’s predictions' : 'Test the dollar-sign rule';
    });
  }

  function setupHook() {
    const reveal = get('hook-reveal');
    get('jump-trees').addEventListener('click', () => {
      const heading = get('model-title');
      heading.scrollIntoView();
      heading.focus({ preventScroll: true });
    });
    get('model-id').textContent = email.id;
    get('methods-email').textContent = email.id;
    get('method-first').innerHTML = badge(samples[0].prediction);
    get('method-second').innerHTML = badge(samples[1].prediction);
    const openingSpamVotes = samples[0].prediction + samples[1].prediction;
    get('method-vote').textContent = openingSpamVotes === 1 ? '1 Legitimate, 1 Spam · tie' :
      'Both predict ' + labelName(samples[0].prediction);
    get('model-dollar').textContent = frequency(email.x);
    get('model-exclaim').textContent = frequency(email.z);
    get('email').textContent = email.id + ' · ' + measurements(email);
    get('opening-paths').innerHTML = traces.slice(0, 2).map(({ steps, leaf }, i) =>
      `<p><strong>Tree ${i + 1}</strong> · ${pathText(steps)} → <strong>${labelName(leaf.prediction)}</strong>.</p>`).join('');
    get('cutoff-origin').innerHTML = samples.slice(0, 2).map((sample, index) => {
      const { feature, threshold } = sample.tree.split;
      const readings = sampleRows(sample).map(row => row[feature]);
      const below = Math.max(...readings.filter(value => value <= threshold));
      const above = Math.min(...readings.filter(value => value > threshold));
      return `<p><strong>Tree ${index + 1}</strong> asks about ${featureName[feature].toLowerCase()}. ` +
        `The neighboring values in its tray are ${frequency(below)} and ${frequency(above)}. Their midpoint is ${frequency(threshold)}.</p>`;
    }).join('');
    const shortQuestion = split => (split.feature === 'x' ? '$' : '!') + ' ≤ ' + frequency(split.threshold);
    function paint(shown) {
      get('hook-trees').innerHTML = samples.slice(0, 2).map(({ tree }, i) =>
        `<article class="bag-opening-tree"><h3>Tree ${i + 1}</h3>` +
        treeMarkup(tree, shown ? traces[i].paths : [], shortQuestion) + '</article>').join('');
      get('hook-plots').innerHTML = samples.slice(0, 2).map((sample, i) => '<figure class="bag-plot-card"><figcaption><strong>Tree ' +
        (i + 1) + '</strong>' + (shown ? '<span class="bag-badge ' + tone(sample.prediction) + '">' +
        labelName(sample.prediction) + '</span>' : '') + '</figcaption>' + scatter(sample, shown) +
        '<p class="bag-plot-question"><strong>First question</strong> ' + question(sample.tree.split) + '?<br>' +
        sample.draws.length + ' draws · ' + new Set(sample.draws).size + ' distinct training emails</p></figure>').join('');
      reveal.setAttribute('aria-pressed', String(shown));
      reveal.textContent = shown ? 'Hide the highlighted paths' : 'Trace the email through both trees';
      get('ensemble-takeaway').hidden = !shown;
      get('hook-result').textContent = shown ?
        'Tree 1 says ' + labelName(samples[0].prediction) + '. Tree 2 says ' + labelName(samples[1].prediction) +
        '. How could we combine their answers?' :
        'Can you tell where this email ends in each tree?';
    }
    reveal.addEventListener('click', () => paint(reveal.getAttribute('aria-pressed') === 'false'));
    paint(false);
  }

  function setupStackingFolds() {
    const controls = [...get('oof-rounds').querySelectorAll('button')];
    const folds = controls.map(control => control.dataset.fold);
    const round = get('oof-round');
    function paint(heldOut) {
      const training = folds.filter(fold => fold !== heldOut).join(' and ');
      controls.forEach(control => control.setAttribute('aria-pressed', String(control.dataset.fold === heldOut)));
      round.innerHTML = '<div class="bag-oof-folds">' + folds.map(fold =>
        `<div class="bag-oof-fold${fold === heldOut ? ' is-held-out' : ''}"><strong>Fold ${fold}</strong>` +
        `<span>${fold === heldOut ? 'Hold out' : 'Use for fitting'}</span><small>4 emails</small></div>`).join('') +
        `</div><ol class="bag-steps bag-oof-steps">
          <li><strong>Fit both base models.</strong> Train the decision tree and logistic model on folds ${training}.</li>
          <li><strong>Predict fold ${heldOut}.</strong> Each model gives a spam score for each of those four emails.</li>
          <li><strong>Save one row per email.</strong> Keep its two spam scores and ground-truth label together.</li>
        </ol>`;
    }
    controls.forEach(control => control.addEventListener('click', () => paint(control.dataset.fold)));
    paint(folds[0]);
  }

  function setupBootstrap() {
    const selector = get('sample');
    const nextDraw = get('draw');
    const play = get('play');
    const fill = get('fill');
    const reset = get('reset');
    get('source-records').innerHTML = emailTableRows(rows);
    const firstSample = drawCounts(samples[0].draws);
    const missed = rows.filter(row => !firstSample.has(row.id));
    const [repeatedID, repeatedCount] = [...firstSample].find(([, total]) => total > 1);
    get('bootstrap-worked').innerHTML = '<p>Tree 1 takes <strong>' + samples[0].draws.length +
      ' draws</strong> and sees <strong>' + firstSample.size + ' distinct emails</strong>. It draws ' +
      '<strong>' + repeatedID + ' ' + repeatedCount + ' times</strong>, and each copy contributes the same ' +
      labelName(rowMap.get(repeatedID).label) + ' label. The emails it skips are ' + missed.map(row => row.id).join(', ') +
      '. These are <strong>out of bag</strong> for Tree 1.</p>';
    let count = 0;
    let timer = null;
    const current = () => samples[Number(selector.value)].draws;

    function paint() {
      const ids = current();
      const seen = ids.slice(0, count);
      const counts = drawCounts(seen);
      const latest = seen.at(-1);
      const omitted = rows.filter(row => !counts.has(row.id));
      get('source-rows').innerHTML = rows.map(row => '<span class="bag-source-row ' + tone(row.label) +
        (row.id === latest ? ' latest' : '') + '" title="' + labelName(row.label) + '">' +
        row.id + '<small>×' + (counts.get(row.id) ?? 0) + '</small></span>').join('');
      get('drawn-rows').innerHTML = ids.map((id, i) => '<li class="' + (i < count ? tone(rowMap.get(id).label) : 'empty') +
        (i + 1 === count ? ' latest' : '') + '">' + (i < count ? id : '·') + '</li>').join('');
      const picked = rowMap.get(latest);
      get('draw-current').textContent = picked ? 'Draw ' + count + ' picked ' + latest +
        (counts.get(latest) > 1 ? ' again. ' : '. ') + measurements(picked) +
        ' · Recorded ' + labelName(picked.label) + '.' : 'The sample tray is empty.';
      get('sample-counts').innerHTML = '<span><strong>' + count + '/' + ids.length + '</strong> draws</span><span><strong>' +
        counts.size + '</strong> unique emails</span><span><strong>' + omitted.length + '</strong> ' +
        (count === ids.length ? 'omitted · ' + (omitted.map(row => row.id).join(', ') || 'none') : 'not drawn yet') + '</span>';
      nextDraw.disabled = fill.disabled = count === ids.length;
      play.disabled = count === ids.length && timer === null;
      play.textContent = timer === null ? 'Play draws' : 'Pause draws';
      reset.disabled = count === 0;
    }

    function stop() {
      if (timer === null) return;
      clearInterval(timer);
      timer = null;
    }

    nextDraw.addEventListener('click', () => { stop(); count += 1; paint(); });
    play.addEventListener('click', () => {
      if (timer !== null) stop();
      else {
        timer = setInterval(() => {
          count += 1;
          if (count >= current().length) stop();
          paint();
        }, 550);
      }
      paint();
    });
    fill.addEventListener('click', () => { stop(); count = current().length; paint(); });
    function clearSample() { stop(); count = 0; paint(); }
    reset.addEventListener('click', clearSample);
    selector.addEventListener('change', clearSample);
    paint();
  }

  function setupForest() {
    const picker = get('tree-picker');
    const labelToggle = get('reveal-label');
    const recorded = get('recorded-label');
    let active = 0;
    let shown = 0;
    picker.innerHTML = samples.map((_, index) => '<button type="button" data-tree="' + index + '">Tree ' +
      (index + 1) + '</button>').join('');
    const buttons = [...picker.querySelectorAll('button')];
    get('code-output').innerHTML = '<p>Tree 1 draws <code>' + samples[0].draws.join(', ') +
      '</code>. Its prediction is <strong>' + labelName(samples[0].prediction) +
      '</strong>. All three predictions are <strong>' + samples.map(sample => labelName(sample.prediction)).join(', ') + '</strong>.</p>';
    get('trace-email').textContent = email.id + ' · ' + measurements(email);
    const spamVotes = samples.reduce((count, sample) => count + sample.prediction, 0);
    const hardLabel = Number(spamVotes > samples.length / 2);
    const meanSpam = mean(probabilities);
    const softLabel = Number(meanSpam > 0.5);
    const fractions = traces.map(({ leaf }) => leaf.review + '/' + leaf.n).join(' + ');
    const meanEquation = '(' + fractions + ') ÷ ' + samples.length + ' = ' + percent(meanSpam);
    const hardSummary = samples.length - spamVotes + ' Legitimate · ' + spamVotes + ' Spam';
    get('forest-worked').innerHTML = traces.map(({ steps, leaf }, index) =>
      `<p><strong>Tree ${index + 1}</strong> · ${pathText(steps)}. The leaf has ${leaf.auto} Legitimate and ${leaf.review} Spam draws, giving a Spam probability of ${leaf.review}/${leaf.n}.</p>`).join('') +
      `<p><strong>Hard vote</strong> · ${hardSummary}. Spam vote share is ${spamVotes}/${samples.length} = ${percent(spamVotes / samples.length)}. Predict <strong>${labelName(hardLabel)}</strong>.</p>` +
      `<p><strong>Average of leaf probabilities</strong> · ${meanEquation}. Predict <strong>${labelName(softLabel)}</strong>.</p>`;
    recorded.textContent = email.id + ' was labeled ' + labelName(email.label) + ' in Spambase. ' +
      (hardLabel === email.label ? 'The majority vote matches that label.' : 'The majority vote misses that label.') +
      ' Evaluating accuracy takes many held-out emails.';
    labelToggle.addEventListener('click', () => {
      const open = recorded.hidden;
      recorded.hidden = !open;
      labelToggle.setAttribute('aria-expanded', String(open));
      labelToggle.textContent = open ? 'Hide the recorded label' : 'Show the recorded label';
    });
    function drawTree() {
      const sample = samples[active];
      const traced = traces[active];
      buttons.forEach((button, index) => { button.setAttribute('aria-pressed', String(active === index)); });
      get('tree-meta').innerHTML = '<p><strong>Draws</strong> ' + sample.draws.join(', ') +
        '</p><p><strong>Path</strong> ' + pathText(traced.steps) +
        '</p><p><strong>Leaf</strong> ' + traced.leaf.auto + ' Legitimate · ' + traced.leaf.review + ' Spam · ' +
        percent(probabilities[active]) + ' Spam probability · Predict <strong>' + labelName(sample.prediction) + '</strong></p>';
      get('tree-plot').innerHTML = treeMarkup(sample.tree, traced.paths);
    }
    function drawVotes() {
      const complete = shown === samples.length;
      get('vote-next').disabled = complete;
      get('vote-reset').disabled = shown === 0;
      get('vote-truth').hidden = !complete;
      if (!complete) {
        recorded.hidden = true;
        labelToggle.setAttribute('aria-expanded', 'false');
        labelToggle.textContent = 'Show the recorded label';
      }
      const votes = samples.slice(0, shown);
      const cards = samples.map((sample, i) => '<div class="bag-vote"><span>Tree ' + (i + 1) + '</span><strong>' +
        (i < shown ? labelName(sample.prediction) : 'Hidden') + '</strong></div>').join('');
      const spam = votes.reduce((count, sample) => count + sample.prediction, 0);
      const legitimate = votes.length - spam;
      const result = complete ? '<p class="bag-readout"><strong>Majority vote</strong> · ' + hardSummary +
        '. Predict <strong>' + labelName(hardLabel) + '</strong>.</p><p><strong>Mean Spam probability</strong> · ' +
        meanEquation + '. Predict <strong>' + labelName(softLabel) + '</strong>.</p>' :
        '<p class="bag-readout">' + shown + ' of ' + samples.length + ' votes revealed. ' +
        (shown ? 'Legitimate ' + legitimate + ' · Spam ' + spam + '.' : 'Predict the result before revealing the votes.') +
        (shown && spam === legitimate ? ' The votes are tied.' : '') + '</p>';
      get('votes').innerHTML = '<div class="bag-triptych">' + cards + '</div>' + result;
    }
    picker.addEventListener('click', event => {
      const button = event.target.closest('[data-tree]');
      if (!button) return;
      active = Number(button.dataset.tree);
      drawTree();
    });
    get('vote-next').addEventListener('click', () => { active = shown; shown += 1; drawTree(); drawVotes(); });
    get('vote-reset').addEventListener('click', () => { active = shown = 0; drawTree(); drawVotes(); });
    drawTree();
    drawVotes();
  }

  function setupFeatures() {
    const mode = get('feature-mode');
    const parent = sampleRows(samples[1]);
    const presets = [['x', 'z', 'z'], ['z', 'x', 'z'], ['x', 'x', 'x'], ['z', 'z', 'x']];
    let draw = 0;
    const available = index => mode.value === 'all' ? ['x', 'z'] : [presets[draw][index]];
    const bestFor = (group, features) => TreeLab.rank(group, 'gini').find(({ split, gain }) =>
      gain > 0 && features.includes(split.feature));
    const initial = bestFor(parent, ['x', 'z']);
    const giniFormula = ({ n, auto, review, score }) =>
      '1 − (' + auto + '/' + n + ')² − (' + review + '/' + n + ')² ≈ ' + fmt(score);
    const { parent: rootStats, leftStats, rightStats, weighted, gain } = initial;
    get('gini-worked').innerHTML = '<p>Start with both features available. The best split is <strong>' +
      question(initial.split) + '</strong>.</p><p><strong>Root Gini</strong> · ' +
      giniFormula(rootStats) + '</p><p><strong>Yes child Gini</strong> · ' + giniFormula(leftStats) +
      '</p><p><strong>No child Gini</strong> · ' + giniFormula(rightStats) +
      '</p><p><strong>Weighted child Gini</strong> · (' + leftStats.n + '/' + rootStats.n +
      ' × ' + fmt(leftStats.score) + ') + (' + rightStats.n + '/' + rootStats.n + ' × ' +
      fmt(rightStats.score) + ') ≈ ' + fmt(weighted) + '</p><p><strong>Gini decrease</strong> · ' +
      fmt(rootStats.score) + ' − ' + fmt(weighted) + ' ≈ ' + fmt(gain) + '</p>';

    function card(title, group, features, split) {
      const { auto, review } = TreeLab.stats(group, 'gini');
      const info = auto && review ? '<p><strong>Candidate features</strong> ' + features.map(feature => featureName[feature]).join(', ') +
        '</p><p>' + (split ? 'Best question <strong>' + question(split.split) + '</strong> · Gini decrease ' + fmt(split.gain) :
          'No positive-gain question among these candidates.') + '</p>' :
        `<p>The draws agree on ${auto ? 'Legitimate' : 'Spam'}, so this branch stops at a leaf.</p>`;
      return `<article><h3>${title} · ${group.length} draws</h3><p>${auto} Legitimate · ${review} Spam</p>${info}
        <p class="small"><strong>Draws at this node</strong> ${group.map(row => row.id).join(', ')}</p></article>`;
    }
    function paint() {
      const root = bestFor(parent, available(0));
      const children = root ? [root.left, root.right].map((group, index) => {
        const features = available(index + 1);
        return card(index ? 'No child' : 'Yes child', group, features, bestFor(group, features));
      }).join('') : '';
      get('features').innerHTML = card('Root', parent, available(0), root) + children;
    }
    mode.addEventListener('change', () => { draw = 0; paint(); });
    get('feature-next').addEventListener('click', () => {
      if (mode.value === 'all') { mode.value = 'one'; draw = 0; }
      else draw = (draw + 1) % presets.length;
      paint();
    });
    paint();
  }

  function setupDepth() {
    const depth = get('base-depth');
    const training = sampleRows(samples[2]);
    const fit = limit => {
      const tree = TreeLab.fit(training, 'gini', limit);
      const correct = training.filter(row => TreeLab.predict(tree, row) === row.label).length;
      return { tree, correct, trace: TreeLab.trace(tree, email) };
    };
    const shallow = fit(2);
    const deeper = fit(4);
    const n = training.length;
    get('depth-email').innerHTML = emailTableRows([email]);
    get('depth-worked').innerHTML = `<p><strong>Try it.</strong> Switch the maximum depth from 2 to 4.
      Tree 3 now asks a third question on ${email.id}’s path. Its training score improves from
      ${shallow.correct}/${n} to ${deeper.correct}/${n}, but its prediction for ${email.id} changes from
      <strong>${labelName(shallow.trace.leaf.prediction)}</strong> to <strong>${labelName(deeper.trace.leaf.prediction)}</strong>.
      Use more unseen emails to judge which setting generalizes better.</p>`;
    function paint() {
      const { tree, correct, trace } = fit(Number(depth.value));
      get('depth-summary').innerHTML = `Tree 3 predicts <strong>${labelName(trace.leaf.prediction)}</strong>
        for ${email.id}. It classifies <strong>${correct}/${n}</strong> training draws correctly.`;
      get('depth-tree').innerHTML = treeMarkup(tree, trace.paths);
    }
    depth.addEventListener('change', paint);
    paint();
  }

  function setupPerturbation() {
    const control = get('flip-label');
    const changedID = perturbationId;
    const actual = rowMap.get(changedID);
    const original = probabilities;
    const afterEdit = samples.map(sample => {
      const training = sampleRows(sample).map(row => row.id === changedID ? { ...row, label: 1 - row.label } : row);
      const leaf = TreeLab.trace(TreeLab.fit(training, 'gini', 2), email).leaf;
      return leaf.review / leaf.n;
    });
    function paint(changed) {
      const probabilities = changed ? afterEdit : original;
      control.setAttribute('aria-pressed', String(changed));
      control.textContent = (changed ? 'Restore ' : 'Flip ') + changedID + '’s recorded label';
      const cards = samples.map((sample, i) => {
        const count = sample.draws.filter(id => id === changedID).length;
        return `<article><h3>Tree ${i + 1}</h3><p>${changedID} drawn ${count} ${count === 1 ? 'time' : 'times'}.</p>
          <p><strong>${percent(probabilities[i])} Spam</strong>${changed && probabilities[i] !== original[i] ?
            ' · was ' + percent(original[i]) : ''}</p></article>`;
      });
      get('perturbation').innerHTML = `<div class="bag-triptych">${cards.join('')}</div>
        <p class="bag-worked"><strong>${changedID} treated as ${labelName(changed ? 1 - actual.label : actual.label)}.</strong>
        Mean Spam probability for ${email.id} ${percent(mean(probabilities))}${changed ? ' · was ' + percent(mean(original)) : ''}.</p>`;
    }
    control.addEventListener('click', () => paint(control.getAttribute('aria-pressed') === 'false'));
    paint(false);
  }

  function setupPruning() {
    const penalty = get('prune-alpha');
    const candidates = [
      { name: 'Keep the larger subtree', impurity: 0.12, leaves: 4 },
      { name: 'Use the smaller subtree', impurity: 0.18, leaves: 2 },
    ];
    function paint() {
      const alpha = Number(penalty.value);
      const costs = candidates.map(({ impurity, leaves }) => (impurity + alpha * leaves).toFixed(2));
      const lowest = Math.min(...costs.map(Number));
      get('prune-alpha-value').textContent = alpha.toFixed(2);
      get('prune-costs').innerHTML = candidates.map(({ name, impurity, leaves }, i) => {
        const preferred = Number(costs[i]) === lowest;
        const status = costs[0] === costs[1] ? ' · Tie' : preferred ? ' · Lower cost' : '';
        return `<article class="${preferred ? 'bag-cost-lowest' : ''}"><h3>${name}</h3>
          <p>${impurity.toFixed(2)} + ${alpha.toFixed(2)} × ${leaves} = <strong>${costs[i]}</strong>${status}</p></article>`;
      }).join('');
    }
    penalty.addEventListener('input', paint);
    paint();
  }

  function setupInterview() {
    function splitCredits(tree, total, path = 'Root') {
      if (!tree.split) return [];
      const { n, score } = tree.stats;
      const weightedChildren = (tree.left.stats.n * tree.left.stats.score + tree.right.stats.n * tree.right.stats.score) / n;
      const gain = score - weightedChildren;
      return [{ path, question: question(tree.split), feature: tree.split.feature, n, gain, credit: n / total * gain },
        ...splitCredits(tree.left, total, path + ' → Yes'), ...splitCredits(tree.right, total, path + ' → No')];
    }
    const models = samples.map(({ tree }) => {
      const splits = splitCredits(tree, tree.stats.n);
      const totals = { x: 0, z: 0 };
      for (const { feature, credit } of splits) totals[feature] += credit;
      const total = totals.x + totals.z;
      return { splits, totals, total, n: tree.stats.n, x: totals.x / total, z: totals.z / total };
    });
    const showScore = score => [score.x, score.z].map(value => `<td><strong>${percent(value)}</strong>
      <span class="bag-importance-track" aria-hidden="true"><span style="width:${percent(value)}"></span></span></td>`).join('');
    get('importance').innerHTML = '<div class="table-wrap"><table><thead><tr><th scope="col">Model</th><th scope="col">Dollar signs</th>' +
      '<th scope="col">Exclamation marks</th></tr></thead><tbody>' + models.map((score, i) => '<tr><th scope="row">Tree ' +
      (i + 1) + '</th>' + showScore(score) + '</tr>').join('') + '<tr class="bag-average"><th scope="row">Ensemble mean</th>' +
      showScore({ x: mean(models.map(score => score.x)), z: mean(models.map(score => score.z)) }) + '</tr></tbody></table></div>';
    const worked = models[0];
    get('importance-worked').innerHTML = '<p>Tree 1 gets ' + worked.n +
      ' training draws. At each split, weight the local Gini decrease by the fraction of those draws that reach the node.</p>' +
      '<div class="table-wrap"><table><caption class="sr-only">Weighted split credit in Tree 1</caption><thead><tr>' +
      '<th scope="col">Node</th><th scope="col">Learned question</th><th scope="col">Weighted credit</th></tr></thead><tbody>' +
      worked.splits.map(split => `<tr><th scope="row">${split.path}</th><td>${split.question}</td>
      <td>${split.n}/${worked.n} × ${fmt(split.gain)} ≈ ${fmt(split.credit)}</td></tr>`).join('') + '</tbody></table></div>' +
      '<p>The credits sum to ' + fmt(worked.total) + '. Divide each feature’s subtotal by that sum. ' +
      'Dollar signs get ' + fmt(worked.totals.x) + '/' + fmt(worked.total) + ' ≈ <strong>' + percent(worked.x) +
      '</strong>. Exclamation marks get ' + fmt(worked.totals.z) + '/' + fmt(worked.total) + ' ≈ <strong>' + percent(worked.z) +
      '</strong>. Average the resulting shares across the three trees.</p>';
    const settings = [
      ['Number of trees', 'n_estimators', 'How many trees answer for one email?', 'If 10 trees already give similar Spam probabilities, the next few may barely move their average. Compare validation scores as you add trees. Every extra tree also takes time to train and to consult for a prediction.'],
      ['Row sample size', 'max_samples', 'How many email rows go into each training tray?', 'Switch from 12 draws per tree to 6. Each tray now has fewer draws, so more emails can be left out for an out-of-bag check. The trees may learn different rules, and each tree has fewer examples to learn from.'],
      ['Columns sampled', 'max_features', 'Which clues can a node consider?', 'Try one candidate instead of both punctuation features. Some nodes can consider only dollar-sign frequency. That can change the rules trees learn, but a node might miss a useful exclamation-mark cutoff.'],
      ['Tree depth', 'max_depth', 'How many questions can an email answer?', 'At depth 1 a tree asks a single question. Depth 2 lets it use a different feature after the first answer. More questions can capture useful patterns or details peculiar to the emails in a training tray.'],
      ['Pruning', 'ccp_alpha', 'How much does a branch have to earn to stay?', 'Imagine a split that creates two leaves and corrects just one training prediction. A larger penalty for extra leaves makes that split more likely to be removed. Check validation scores to see whether pruning helps on unseen emails.'],
    ];
    const knobs = get('knob-buttons');
    knobs.innerHTML = settings.map(([label], i) => '<button class="button secondary" type="button" data-knob="' + i +
      '">' + label + '</button>').join('');
    function select(index) {
      knobs.querySelectorAll('button').forEach((button, i) => button.setAttribute('aria-pressed', String(i === index)));
      const [label, name, prompt, answer] = settings[index];
      get('knob-explanation').innerHTML = '<h3>' + label + ' <code>' + name + '</code></h3><p>' + prompt + '</p><p>' + answer + '</p>';
    }
    knobs.addEventListener('click', event => {
      const button = event.target.closest('[data-knob]');
      if (button) select(Number(button.dataset.knob));
    });
    select(0);
  }

  setupNavigation();
  setupRule();
  setupHook();
  setupStackingFolds();
  setupBootstrap();
  setupForest();
  setupFeatures();
  setupDepth();
  setupPerturbation();
  setupInterview();
  setupPruning();
})();
