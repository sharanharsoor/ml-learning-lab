(() => {
  'use strict';

  const byId = (id) => document.getElementById(id);
  const percent = (value, places = 0) => (100 * value).toFixed(places) + '%';
  const average = (values) => values.reduce((total, value) => total + value, 0) / values.length;
  const { rows, email, samples } = JSON.parse(byId('bag-data').textContent);
  const labelName = label => label ? 'Spam' : 'Legitimate';
  const frequencyName = { x: 'Dollar signs', z: 'Exclamation marks' };
  const frequency = value => `${Number(value.toFixed(4))}%`;
  const spamEstimate = leaf => leaf.review / leaf.n;

  function initializeSpread() {
    let seed = 0;
    const bootstrap = pool => Array.from({ length: pool.length }, () => {
      seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
      return pool[Math.floor(seed / 2 ** 32 * pool.length)];
    });
    const estimate = training => spamEstimate(TreeLab.trace(TreeLab.fit(training, 'gini', 2), email).leaf);
    const batches = Array.from({ length: 5 }, () => {
      const training = bootstrap(rows);
      return [estimate(training), average(Array.from({ length: 25 }, () => estimate(bootstrap(training))))];
    });
    const letters = 'ABCDE';
    const reveal = byId('bagl-next-batch');
    byId('bagl-flow-measurements').textContent = `${email.id} · Dollar signs ${frequency(email.x)} · Exclamation marks ${frequency(email.z)}`;
    byId('bagl-spread-example').textContent = `Track ${email.id} at ${frequency(email.x)} dollar signs and ${frequency(email.z)} exclamation marks. Each row shows two fitted estimates for this same email. A fixed random seed repeats the draws. Reveal another batch to compare the estimates.`;
    let visible = 1;
    const describe = scores => {
      const mean = average(scores);
      const deviations = scores.map(score => score - mean);
      const variance = average(deviations.map(value => value ** 2));
      return { mean, deviations, variance, spread: Math.sqrt(variance) };
    };

    function render() {
      const rows = batches.map(([single, bagged], index) => {
        const shown = visible > index;
        const points = shown ? `
          <i class="bagl-point bagl-symbol bagl-symbol-single" style="--position:${percent(single)}"></i>
          <i class="bagl-point bagl-symbol bagl-symbol-bagged" style="--position:${percent(bagged)}"></i>` : '';
        return `<tr>
          <th scope="row">Batch ${letters[index]}</th>
          <td>${shown ? single.toFixed(2) : 'Pending'}</td>
          <td>${shown ? bagged.toFixed(2) : 'Pending'}</td>
          <td><div class="bagl-plot-track" aria-hidden="true">${points}</div></td>
        </tr>`;
      }).join('');
      byId('bagl-batches').innerHTML = `
        <table>
          <caption class="sr-only">Spam estimates for one held-out email by training batch</caption>
          <thead><tr><th scope="col">Training batch</th><th scope="col">Single tree</th><th scope="col">Bagged trees</th><th scope="col">
            <div class="bagl-plot-scale" aria-label="Probability from 0 to 1"><span>0</span><span>0.5</span><span>1</span></div>
          </th></tr></thead>
          <tbody>${rows}</tbody>
        </table>`;

      reveal.textContent = visible === batches.length ? 'Replay batches' : 'Reveal next batch';
      const worked = byId('bagl-spread-worked');
      if (visible === 1) {
        byId('bagl-batch-summary').textContent = 'One batch is visible. Reveal another to compare how each prediction moves.';
        worked.textContent = 'Reveal Batch B to see the mean, variance, and standard deviation worked out for both columns.';
        return;
      }
      const format = value => value.toFixed(4);
      const displayScore = value => value.toFixed(2).replace('-', '−');
      const exampleCards = ['Single tree', 'Bagged trees'].map((name, column) => {
        const scores = batches.slice(0, 2).map(batch => batch[column]);
        const [a, b] = scores.map(displayScore);
        const { mean, deviations, variance, spread } = describe(scores);
        const center = displayScore(mean);
        const [da, db] = deviations.map(displayScore);
        return `<article><h5>${name}</h5>
          <p><strong>Mean</strong> · (${a} + ${b}) ÷ 2 = ${center}</p>
          <p><strong>Deviations</strong> · ${a} − ${center} = ${da} and ${b} − ${center} = ${db}</p>
          <p><strong>Variance</strong> · [(${da})² + (${db})²] ÷ 2 = ${format(variance)}</p>
          <p><strong>Standard deviation</strong> · √${format(variance)} = ${displayScore(spread)}</p></article>`;
      }).join('');
      worked.innerHTML = `<div class="bag-pair">${exampleCards}</div>`;
      byId('bagl-batch-summary').innerHTML = `<strong>${visible} of ${batches.length} batches</strong>
        ${['Single tree', 'Bagged trees'].map((name, column) => {
          const { mean, variance, spread } = describe(batches.slice(0, visible).map(batch => batch[column]));
          return `<span>${name} mean ${format(mean)}, variance ${format(variance)}, standard deviation ${format(spread)}</span>`;
        }).join('')}`;
    }

    reveal.addEventListener('click', () => {
      visible = visible === batches.length ? 1 : visible + 1;
      render();
    });
    render();
  }

  function initializeVariance() {
    const trees = byId('bagl-trees');
    const correlation = byId('bagl-corr');

    function render() {
      const count = Number(trees.value);
      const rho = Number(correlation.value);
      const pairs = count * (count - 1) / 2;
      const reducible = (1 - rho) / count;
      const ratio = rho + reducible;
      byId('bagl-trees-value').textContent = count;
      byId('bagl-corr-value').textContent = rho.toFixed(2);
      byId('bagl-pair-count').textContent = `${count} ${count === 1 ? 'tree gives' : 'trees give'} ${pairs.toLocaleString('en-US')} distinct ${pairs === 1 ? 'pair' : 'pairs'} (${count} × ${count - 1} ÷ 2).`;
      byId('bagl-shared-fill').style.width = percent(rho, 2);
      byId('bagl-reducible-fill').style.width = percent(reducible, 2);
      byId('bagl-variance-summary').innerHTML = `<strong>${percent(ratio, 1)} of one tree's variance</strong>
        <span class="formula">${rho.toFixed(2)} + (1 − ${rho.toFixed(2)}) / ${count} = ${ratio.toFixed(3)}</span>`;
    }

    trees.addEventListener('input', render);
    correlation.addEventListener('input', render);
    render();
  }

  function initializeOob() {
    const grid = byId('bagl-oob-grid');
    const selected = byId('bagl-oob-selected');
    const countDraws = (draws, id) => draws.filter(draw => draw === id).length;
    const scores = rows.map(row => {
      const leaves = samples.flatMap(({ tree, draws }, index) => {
        if (draws.includes(row.id)) return [];
        return [{ tree: index + 1, ...TreeLab.trace(tree, row) }];
      });
      const probability = leaves.length ? average(leaves.map(({ leaf }) => spamEstimate(leaf))) : null;
      const prediction = probability === null ? null : Number(probability > .5);
      return { row, leaves, probability, prediction };
    });
    grid.innerHTML = rows.map((row, index) => `
      <tr data-bagl-oob-row="${index}">
        <th scope="row"><button type="button" class="button secondary bagl-row-button" data-bagl-pick="${index}" aria-pressed="false">${row.id}</button></th>
        <td>${frequency(row.x)}</td><td>${frequency(row.z)}</td><td>${labelName(row.label)}</td>
        ${samples.map(({ draws }) => {
          const count = countDraws(draws, row.id);
          return `<td>${count ? `<span class="bagl-drawn">${count}×</span>` : '<span class="bagl-eligible">0 · OOB</span>'}</td>`;
        }).join('')}
      </tr>`).join('');

    byId('bagl-oob-samples').innerHTML = `<div class="bagl-leaf-summaries">${samples.map(({ draws, tree }, index) => `
      <div>
        <h3>Tree ${index + 1}</h3>
        <p>${draws.join(', ')}</p>
        <p class="small">${tree.split ? `First question · ${frequencyName[tree.split.feature]} ≤ ${frequency(tree.split.threshold)}` : 'Root is a leaf'}</p>
      </div>`).join('')}</div>`;

    const covered = scores.filter(entry => entry.prediction !== null);
    const matches = covered.filter(({ row, prediction }) => row.label === prediction).length;
    const errors = covered.length - matches;
    const rate = count => covered.length ? `${count} / ${covered.length} ≈ ${percent(count / covered.length, 1)}` : 'Unavailable';
    byId('bagl-oob-score').innerHTML = `
      <div class="table-wrap"><table>
        <caption class="sr-only">Out-of-bag predictions for the training email pool</caption>
        <thead><tr><th scope="col">Email</th><th scope="col">OOB trees</th><th scope="col">Spam estimate</th><th scope="col">Prediction</th><th scope="col">Recorded label</th></tr></thead>
        <tbody>${scores.map(({ row, leaves, probability, prediction }) => `
          <tr><th scope="row">${row.id}</th><td>${leaves.length}</td>
          <td>${probability === null ? 'Unavailable' : percent(probability, 1)}</td>
          <td>${prediction === null ? 'Unavailable' : labelName(prediction)}</td><td>${labelName(row.label)}</td></tr>
        `).join('')}</tbody>
      </table></div>
      <p class="bagl-result"><strong>Coverage ${covered.length} / ${scores.length}</strong>
        <span>OOB accuracy <strong>${rate(matches)}</strong></span>
        <span>OOB error <strong>${rate(errors)}</strong></span></p>`;
    byId('bagl-oob-worked').innerHTML = `
      <p><strong>Coverage.</strong> ${covered.length} of ${scores.length} emails have at least one eligible tree.</p>
      <p><strong>Accuracy.</strong> The OOB predictions match ${matches} of the ${covered.length} covered labels.</p>
      <p><strong>Error.</strong> ${errors} covered emails get the wrong prediction. An email missing an OOB prediction contributes only to the coverage denominator.</p>`;

    function renderSelection(index) {
      grid.querySelectorAll('[data-bagl-pick]').forEach((button, buttonIndex) => {
        const active = buttonIndex === index;
        button.setAttribute('aria-pressed', String(active));
        button.closest('tr').classList.toggle('is-selected', active);
      });
      const { row, leaves, probability, prediction } = scores[index];
      if (!leaves.length) {
        selected.innerHTML = `<h3>${row.id} has no eligible trees</h3>
          <p>All three samples contain this email. Its OOB prediction is unavailable.</p>`;
        return;
      }
      const fraction = ({ leaf }) => `${leaf.review}/${leaf.n}`;
      const sum = leaves.map(fraction).join(' + ');
      selected.innerHTML = `<h3>${row.id} can use ${leaves.length} of ${samples.length} trees</h3>
        <div class="bagl-votes">${leaves.map(entry => {
          const path = entry.steps.map(({ split, yes }) =>
            `${frequencyName[split.feature]} ${frequency(row[split.feature])} ${yes ? '≤' : '>'} ${frequency(split.threshold)}`);
          return `<div><strong>Tree ${entry.tree}</strong><br>${path.length ? path.join('<br>') : 'Root is a leaf'}<br>
            Leaf contains <span class="formula">${fraction(entry)}</span> Spam draws</div>`;
        }).join('')}</div>
        <p class="formula">Mean Spam estimate = (${sum}) ÷ ${leaves.length} ≈ ${percent(probability, 1)}</p>
        <p>OOB prediction <strong>${labelName(prediction)}</strong>. Recorded label <strong>${labelName(row.label)}</strong>.</p>
        <details class="teaching-note"><summary>See highlighted paths in the eligible trees</summary>
          ${leaves.map(({ tree, paths }) => `<h4>Tree ${tree}</h4><div class="tree-diagram">${TreeLabDiagram.render(samples[tree - 1].tree, {
            criterion: 'gini', tracedPaths: paths, interactive: false, showScore: false,
            classLabels: ['Legitimate', 'Spam'], sampleNoun: 'draw',
            formatCondition: ({ feature, threshold }) => `${frequencyName[feature]} ≤ ${frequency(threshold)}`,
          })}</div>`).join('')}
        </details>`;
    }

    grid.addEventListener('click', (event) => {
      const button = event.target.closest('[data-bagl-pick]');
      if (button) renderSelection(Number(button.dataset.baglPick));
    });
    const example = scores.findIndex(({ leaves }) => leaves.length >= 2 &&
      leaves.some(({ leaf }) => spamEstimate(leaf) !== spamEstimate(leaves[0].leaf)));
    renderSelection(Math.max(0, example));
  }

  initializeSpread();
  initializeVariance();
  initializeOob();
})();
