(() => {
  'use strict';

  const get = id => document.getElementById('bag-' + id);
  const { rows, parcel, samples } = JSON.parse(get('data').textContent);
  const rowMap = new Map(rows.map(row => [row.id, row]));
  const route = label => label ? 'Review' : 'Auto';
  const tone = label => label ? 'review' : 'auto';
  const featureName = { x: 'Weight', z: 'Scan score' };
  const fmt = value => String(Number(value.toFixed(4)));
  const percent = value => Number((value * 100).toFixed(1)) + '%';
  const mean = values => values.reduce((sum, value) => sum + value, 0) / values.length;
  const question = split => split.feature.toUpperCase() + ' ≤ ' + fmt(split.threshold);
  const sampleRows = sample => sample.draws.map(id => rowMap.get(id));
  const treeMarkup = (tree, tracedPaths) => TreeLabDiagram.render(tree,
    { criterion: 'gini', tracedPaths, interactive: false, showScore: false });

  function setupNavigation() {
    const chapters = [...document.querySelectorAll('.chapter')];
    const menu = get('chapter');
    const previous = get('previous');
    const next = get('next');
    const teaching = get('teaching');
    const labels = ['Ensemble models', 'Bootstrap sampling', 'Forest intuition and code', 'Diverse trees',
      'Base learners', 'Why variance falls', 'Fit and tune', 'Out-of-bag scoring', 'Interview questions'];
    get('nav').innerHTML = chapters.map((chapter, i) =>
      '<li><a href="#' + chapter.id + '">' + labels[i] + '</a></li>').join('');
    menu.innerHTML = chapters.map((chapter, i) =>
      '<option value="' + chapter.id + '">' + labels[i] + '</option>').join('');
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
      previous.disabled = index === 0 && get('model-stage').hidden;
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
      history.pushState(null, '', '#' + chapters[index].id);
      goTo(index);
    }

    const hashIndex = () => chapters.findIndex(chapter => '#' + chapter.id === location.hash);
    menu.addEventListener('change', () => jump(chapters.findIndex(chapter => chapter.id === menu.value)));
    previous.addEventListener('click', () => {
      if (active === 0) get('back-desk').click();
      else jump(active - 1);
    });
    next.addEventListener('click', () => {
      if (active === 0 && get('model-stage').hidden) get('meet-trees').click();
      else jump(active + 1);
    });
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
    const x = value => 41 + 30 * value;
    const z = value => 226 - 21 * value;
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
    const ticks = [0, 2, 4, 6, 8, 10];
    const grid = ticks.map(t => line(x(t), z(10), x(t), z(0), 'bag-grid') +
      line(x(0), z(t), x(10), z(t), 'bag-grid') +
      '<text x="' + x(t) + '" y="243" text-anchor="middle">' + t + '</text>' +
      '<text x="33" y="' + (z(t) + 4) + '" text-anchor="end">' + t + '</text>').join('');
    const marks = rows.map(row => {
      const px = x(row.x), py = z(row.z);
      const mark = row.label === 0 ? '<circle cx="' + px + '" cy="' + py + '" r="4.8"' :
        '<rect x="' + (px - 3.8) + '" y="' + (py - 3.8) + '" width="7.6" height="7.6" transform="rotate(45 ' + px + ' ' + py + ')"';
      const tag = row.label === 0 ? 'circle' : 'rect';
      return mark + ' class="bag-point ' + tone(row.label) + '"><title>' + row.id + ' · ' + route(row.label) + '</title></' + tag + '>';
    }).join('');
    const px = x(parcel.x), py = z(parcel.z);
    const focus = '<circle class="bag-new-mark" cx="' + px + '" cy="' + py +
      '" r="9"/>' + line(px - 5, py, px + 5, py, 'bag-cross') + line(px, py - 5, px, py + 5, 'bag-cross');
    const root = sample.tree.split;
    const firstCut = root.feature === 'x' ? line(x(root.threshold), z(10), x(root.threshold), z(0), 'bag-cut') :
      line(x(0), z(root.threshold), x(10), z(root.threshold), 'bag-cut');
    return '<svg class="bag-scatter" viewBox="0 0 360 268" role="img" aria-label="Training parcels by weight and scan score. ' +
      (reveal ? 'This tree predicts ' + route(sample.prediction) + ' for the new parcel.' : 'The first split is ' + question(root) + '.') +
      '">' + grid + (reveal ? regions(sample.tree, [0, 10, 0, 10]) : firstCut) + marks + focus +
      '<text x="191" y="262" text-anchor="middle" class="bag-axis">Weight X</text>' +
      '<text transform="translate(12 120) rotate(-90)" text-anchor="middle" class="bag-axis">Scan score Z</text></svg>';
  }

  function setupHook() {
    const reveal = get('hook-reveal');
    const desk = get('desk-stage');
    const models = get('model-stage');
    const chapter = desk.closest('.chapter');
    function showStage(showModels) {
      desk.hidden = showModels;
      models.hidden = !showModels;
      const heading = get(showModels ? 'model-title' : 'title');
      chapter.setAttribute('aria-labelledby', heading.id);
      get('previous').disabled = !showModels;
      if (!showModels) paint(false);
      window.scrollTo({ top: 0, behavior: 'instant' });
      heading.focus({ preventScroll: true });
    }
    get('meet-trees').addEventListener('click', () => showStage(true));
    get('back-desk').addEventListener('click', () => showStage(false));
    get('parcel').textContent = 'New parcel · Weight ' + parcel.x + ' · Scan score ' + parcel.z;
    function paint(shown) {
      get('hook-plots').innerHTML = samples.slice(0, 2).map((sample, i) => '<figure class="bag-plot-card"><figcaption><strong>Tree ' +
        (i + 1) + '</strong>' + (shown ? '<span class="bag-badge ' + tone(sample.prediction) + '">' +
        route(sample.prediction) + '</span>' : '') + '</figcaption>' + scatter(sample, shown) + '</figure>').join('');
      reveal.setAttribute('aria-pressed', String(shown));
      reveal.textContent = shown ? 'Hide the two calls' : 'Show the two calls';
      get('ensemble-takeaway').hidden = !shown;
      get('hook-result').textContent = shown ?
        'Tree 1 says ' + route(samples[0].prediction) + '. Tree 2 says ' + route(samples[1].prediction) +
        '. How could we combine their answers?' :
        'Find the new parcel. Which side of each cut does it fall on?';
    }
    reveal.addEventListener('click', () => paint(reveal.getAttribute('aria-pressed') === 'false'));
    paint(false);
  }

  function setupBootstrap() {
    const selector = get('sample');
    const nextDraw = get('draw');
    const play = get('play');
    const fill = get('fill');
    const reset = get('reset');
    let count = 0;
    let timer = null;
    const current = () => samples[Number(selector.value)].draws;

    function paint() {
      const ids = current();
      const seen = ids.slice(0, count);
      const counts = new Map();
      for (const id of seen) counts.set(id, (counts.get(id) ?? 0) + 1);
      const latest = seen.at(-1);
      const omitted = rows.filter(row => !counts.has(row.id));
      get('source-rows').innerHTML = rows.map(row => '<span class="bag-source-row ' + tone(row.label) +
        (row.id === latest ? ' latest' : '') + '" title="' + route(row.label) + '">' +
        row.id + '<small>×' + (counts.get(row.id) ?? 0) + '</small></span>').join('');
      get('drawn-rows').innerHTML = ids.map((id, i) => '<li class="' + (i < count ? tone(rowMap.get(id).label) : 'empty') +
        (i + 1 === count ? ' latest' : '') + '">' + (i < count ? id : '·') + '</li>').join('');
      get('draw-current').textContent = latest ? 'Draw ' + count + ' picked ' + latest +
        (counts.get(latest) > 1 ? ' again.' : ' for the first time.') : 'The sample tray is empty.';
      get('sample-counts').innerHTML = '<span><strong>' + count + '/' + ids.length + '</strong> draws</span><span><strong>' +
        counts.size + '</strong> unique parcels</span><span><strong>' + omitted.length + '</strong> ' +
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
    let active = 0;
    let shown = 0;
    picker.innerHTML = samples.map((_, index) => '<button type="button" data-tree="' + index + '">Tree ' +
      (index + 1) + '</button>').join('');
    const buttons = [...picker.querySelectorAll('button')];
    get('code-output').innerHTML = '<p>Tree 1 draws <code>' + samples[0].draws.join(', ') +
      '</code>. Its prediction is <strong>' + route(samples[0].prediction) +
      '</strong>. All three predictions are <strong>' + samples.map(sample => route(sample.prediction)).join(', ') + '</strong>.</p>';
    function drawTree() {
      const sample = samples[active];
      const traced = TreeLab.trace(sample.tree, parcel);
      buttons.forEach((button, index) => { button.setAttribute('aria-pressed', String(active === index)); });
      get('tree-meta').innerHTML = '<p><strong>Draws</strong> ' + sample.draws.join(', ') +
        '</p><p><strong>Path</strong> ' + traced.steps.map(({ split, yes }) => question(split) +
          ' (' + (yes ? 'Yes' : 'No') + ')').join(' · ') +
        '</p><p><strong>Leaf</strong> ' + traced.leaf.auto + ' Auto · ' + traced.leaf.review + ' Review · ' +
        percent(sample.reviewProbability) + ' Review probability · Predict <strong>' + route(sample.prediction) + '</strong></p>';
      get('tree-plot').innerHTML = treeMarkup(sample.tree, traced.paths);
    }
    function drawVotes() {
      get('vote-next').disabled = shown === samples.length;
      get('vote-reset').disabled = shown === 0;
      const votes = samples.slice(0, shown);
      const cards = samples.map((sample, i) => '<div class="bag-vote"><span>Tree ' + (i + 1) + '</span><strong>' +
        (i < shown ? route(sample.prediction) : 'Hidden') + '</strong></div>').join('');
      const review = votes.filter(sample => sample.prediction === 1).length;
      const auto = votes.length - review;
      const result = shown === samples.length ? '<p class="bag-readout"><strong>Majority vote</strong> ' + auto + ' Auto · ' +
        review + ' Review. Final prediction <strong>' + route(Number(review > auto)) + '</strong>.</p>' +
        '<p><strong>Mean Review probability</strong> (' + samples.map(sample => {
          const leaf = TreeLab.trace(sample.tree, parcel).leaf;
          return leaf.review + '/' + leaf.n;
        }).join(' + ') + ') ÷ ' + samples.length + ' = ' + percent(mean(samples.map(sample => sample.reviewProbability))) + '</p>' :
        '<p class="bag-readout">' + shown + ' of ' + samples.length + ' votes revealed. ' +
        (shown ? 'Auto ' + auto + ' · Review ' + review + '.' : 'Predict the result before revealing the votes.') + '</p>';
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
    const sample = samples[1];
    const parent = sampleRows(sample);
    const left = TreeLab.evaluate(parent, sample.tree.split, 'gini').left;
    const presets = [['x', 'z'], ['z', 'x'], ['x', 'x'], ['z', 'z']];
    let draw = 0;
    function paint() {
      get('features').innerHTML = [parent, left].map((group, index) => {
        const eligible = mode.value === 'all' ? ['x', 'z'] : [presets[draw][index]];
        const best = TreeLab.rank(group, 'gini').find(result => eligible.includes(result.split.feature));
        return '<article><h3>' + (index ? 'Yes child' : 'Root') + ' · ' + group.length + ' rows</h3><p><strong>Candidate features</strong> ' +
          eligible.map(feature => featureName[feature]).join(', ') + '</p><p>' +
          (best && best.gain > 0 ? 'Best question <strong>' + question(best.split) + '</strong> · Gini decrease ' + fmt(best.gain) :
            'No positive-gain question among these candidates.') + '</p></article>';
      }).join('');
    }
    mode.addEventListener('change', paint);
    get('feature-next').addEventListener('click', () => {
      if (mode.value === 'all') mode.value = 'one';
      else draw = (draw + 1) % presets.length;
      paint();
    });
    paint();
  }

  function setupDepth() {
    const depth = get('base-depth');
    function paint() {
      const trees = samples.map(sample => TreeLab.fit(sampleRows(sample), 'gini', Number(depth.value)));
      const results = trees.map((tree, i) => {
        const training = sampleRows(samples[i]);
        const correct = training.filter(row => TreeLab.predict(tree, row) === row.label).length;
        return '<article><h3>Tree ' + (i + 1) + '</h3><p>New parcel <strong>' +
          route(TreeLab.predict(tree, parcel)) + '</strong></p><p>Training draws correct ' + correct + '/' + training.length + '</p></article>';
      });
      get('depth-summary').innerHTML = '<div class="bag-triptych">' + results.join('') + '</div>';
      get('depth-tree').innerHTML = treeMarkup(trees[0], TreeLab.trace(trees[0], parcel).paths);
    }
    depth.addEventListener('change', paint);
    paint();
  }

  function setupInterview() {
    function credits(tree, totals) {
      if (!tree.split) return;
      const weightedScore = node => node.stats.n * node.stats.score;
      totals[tree.split.feature] += weightedScore(tree) - weightedScore(tree.left) - weightedScore(tree.right);
      credits(tree.left, totals);
      credits(tree.right, totals);
    }
    const scores = samples.map(({ tree }) => {
      const totals = { x: 0, z: 0 };
      credits(tree, totals);
      const total = totals.x + totals.z;
      return { x: totals.x / total, z: totals.z / total };
    });
    const showScore = score => '<td>' + percent(score.x) + '</td><td>' + percent(score.z) + '</td>';
    get('importance').innerHTML = '<div class="table-wrap"><table><thead><tr><th scope="col">Model</th><th scope="col">Weight</th>' +
      '<th scope="col">Scan score</th></tr></thead><tbody>' + scores.map((score, i) => '<tr><th scope="row">Tree ' +
      (i + 1) + '</th>' + showScore(score) + '</tr>').join('') + '<tr class="bag-average"><th scope="row">Ensemble mean</th>' +
      showScore({ x: mean(scores.map(score => score.x)), z: mean(scores.map(score => score.z)) }) + '</tr></tbody></table></div>';
    const settings = [
      ['Number of trees', 'n_estimators', 'How many trees contribute?', 'More trees usually make the aggregate steadier. Training time, memory, and prediction cost grow. Look for a plateau in validation performance.'],
      ['Row sample size', 'max_samples', 'How many rows does each tree draw with replacement?', 'Smaller samples can increase diversity and leave more rows eligible for OOB scoring. Each tree also trains on less evidence, which can weaken its predictions.'],
      ['Columns sampled', 'max_features', 'How many features are candidate inputs at a split?', 'Fewer candidates can reduce similarity between trees. Strong features are available less often, which can increase bias.'],
      ['Tree depth', 'max_depth', 'How many splits can a path contain?', 'A lower limit controls complexity while growing the tree. Too shallow a tree can miss interactions, and deeper trees can be more sensitive to the sample.'],
      ['Pruning', 'ccp_alpha', 'How strongly do we penalize tree size?', 'A larger penalty favors smaller subtrees. Pruning can remove fragile details or discard useful structure. Compare values using validation folds.'],
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
  setupHook();
  setupBootstrap();
  setupForest();
  setupFeatures();
  setupDepth();
  setupInterview();
})();
